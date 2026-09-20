/* Copyright (c) Microsoft Corporation. Licensed under the MIT License. */
import { watch } from 'node:fs';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { ClientSideConnection, PROTOCOL_VERSION } from '@agentclientprotocol/sdk';

// Only the desktop-owned workspace directory may provide connection context.
// Project files cannot redirect an agent or supply executable configuration.
export async function readChatBridge(workspaceFile, root = process.env.SOFIK_CODE_WORKSPACES_ROOT) {
	if (!root || !workspaceFile) { return undefined; }
	const base = await realpath(root);
	const workspace = await realpath(workspaceFile);
	const relative = path.relative(base, workspace);
	if (relative.startsWith('..') || path.isAbsolute(relative) || path.basename(workspace) !== 'Sofik.code-workspace') { return undefined; }
	let data;
	try { data = JSON.parse(await readFile(path.join(path.dirname(workspace), 'chat-bridge.json'), 'utf8')); }
	catch (error) { if (error.code === 'ENOENT') { return undefined; } throw error; }
	const endpoint = new URL(data.endpoint);
	if (endpoint.protocol !== 'ws:' || endpoint.hostname !== '127.0.0.1' || endpoint.pathname !== '/acp' || endpoint.search || endpoint.hash || endpoint.username || endpoint.password || typeof data.token !== 'string' || !data.token || !(typeof data.sessionId === 'string' && data.sessionId) && !(Array.isArray(data.sessions) && data.sessions.length)) {
		throw new Error('Invalid desktop chat connection.');
	}
	return data;
}

export class ChatBridgeSession {
	constructor(client, { timeout = 15000 } = {}) {
		this.client = client;
		this.timeout = timeout;
	}
	async connect(config, cwd) {
		this.cwd = cwd;
		this.sessionId = config.sessionId;
		this.context = config;
		const socket = this.socket = new WebSocket(config.endpoint);
		let authenticated = false;
		let controller;
		const readable = new ReadableStream({ start(value) { controller = value; } });
		const writable = new WritableStream({ write(message) {
			if (socket.readyState !== WebSocket.OPEN) { throw new Error('Chat connection closed.'); }
			socket.send(JSON.stringify(message));
		} });
		let timer;
		try {
			await new Promise((resolve, reject) => {
				timer = setTimeout(() => reject(new Error('Chat connection timed out.')), this.timeout);
				socket.addEventListener('open', () => socket.send(JSON.stringify({ token: config.token })));
				socket.addEventListener('message', event => {
					try {
						const message = JSON.parse(event.data);
						if (!authenticated) {
							if (message.authenticated !== true) { throw new Error('Chat authentication failed.'); }
							authenticated = true; resolve();
						} else { controller.enqueue(message); }
					} catch { reject(new Error('Invalid chat response.')); socket.close(); }
				});
				socket.addEventListener('error', () => reject(new Error('Chat connection failed.')));
				socket.addEventListener('close', () => { reject(new Error('Chat connection closed.')); try { controller.close(); } catch {} });
			});
			clearTimeout(timer);
			this.connection = new ClientSideConnection(() => ({ extNotification: async () => {}, ...this.client }), { readable, writable });
			await Promise.race([
				new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Chat initialization timed out.')), this.timeout); }),
				(async () => {
					const result = await this.connection.initialize({ protocolVersion: PROTOCOL_VERSION, clientInfo: { name: 'sofik-code', version: '0.1.0' }, clientCapabilities: {} });
					if (result.protocolVersion !== PROTOCOL_VERSION) { throw new Error('Unsupported ACP version.'); }
					const context = await this.connection.extMethod('_sofik/session_context', { sessionId: config.sessionId });
					if (typeof context.cwd !== 'string' || !context.cwd) { throw new Error('The chat workspace is unavailable.'); }
					this.cwd = context.cwd;
					this.sourceFolders = await canonicalChatFolders([context.cwd, ...(Array.isArray(context.sourceFolders) ? context.sourceFolders : [])]);
					await this.connection.loadSession({ sessionId: config.sessionId, cwd: context.cwd, mcpServers: [] });
				})()
			]);
		} catch (error) { this.dispose(); throw error; }
		finally { clearTimeout(timer); }
	}
	async prompt(text) {
		if (this.busy) { throw new Error('An agent turn is already running.'); }
		this.busy = true;
		try {
			const { providerId, accountId, modelId, reasoningEffort } = this.context;
			return await this.connection.prompt({ sessionId: this.sessionId, prompt: [{ type: 'text', text }], _meta: { sofik: { providerId, accountId, modelId, reasoningEffort, clientMessageId: crypto.randomUUID() } } });
		} finally { this.busy = false; }
	}
	async cancel() { if (this.connection && !this.connection.signal.aborted) { await this.connection.cancel({ sessionId: this.sessionId }); } }
	dispose() { this.socket?.close(); }
}

// Multiple cards require an explicit selection; merely opening Code never
// chooses a conversation or sends a prompt on the user's behalf.
export function automaticChatContext(context) {
	if (!context) { return undefined; }
	if (context.sessionId) { return context; }
	if (context.sessions?.length === 1) { return { ...context, ...context.sessions[0] }; }
	return undefined;
}

export async function watchChatBridge(workspaceFile, onChange, { root = process.env.SOFIK_CODE_WORKSPACES_ROOT, onError = () => {}, debounceMs = 50 } = {}) {
	const empty = { dispose() {} };
	if (!workspaceFile || !root) { return empty; }
	let watcher;
	let timer;
	let closed = false;
	let previousContent;
	try {
		const base = await realpath(root);
		const workspace = await realpath(workspaceFile);
		const relative = path.relative(base, workspace);
		if (relative.startsWith('..') || path.isAbsolute(relative) || path.basename(workspace) !== 'Sofik.code-workspace') { return empty; }
		const changed = () => {
			clearTimeout(timer);
			timer = setTimeout(() => {
				if (closed) { return; }
				void (async () => {
					let content;
					try { content = await readFile(path.join(path.dirname(workspace), 'chat-bridge.json'), 'utf8'); }
					catch (error) { if (error.code === 'ENOENT') { content = null; } else { throw error; } }
					if (closed || content === previousContent) { return; }
					previousContent = content;
					await onChange();
				})().catch(onError);
			}, debounceMs);
		};
		watcher = watch(path.dirname(workspace), (_, filename) => {
			if (!filename || filename.toString() === 'chat-bridge.json') { changed(); }
		});
		watcher.on('error', onError);
		changed();
	} catch (error) { onError(error); }
	return { dispose() { closed = true; clearTimeout(timer); watcher?.close(); } };
}

export async function canonicalChatFolders(folders) {
	const resolved = await Promise.all(folders.filter(folder => typeof folder === 'string' && path.isAbsolute(folder)).map(async folder => {
		try { return await realpath(folder); }
		catch (error) { if (error.code === 'ENOENT') { return path.resolve(folder); } throw error; }
	}));
	return [...new Set(resolved)];
}
