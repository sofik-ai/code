/* Copyright (c) Microsoft Corporation. Licensed under the MIT License. */
import { spawn } from 'node:child_process';
import { Readable, Writable } from 'node:stream';
import { ClientSideConnection, ndJsonStream, PROTOCOL_VERSION } from '@agentclientprotocol/sdk';

export class AgentSession {
	constructor(client, { onStderr = () => {}, timeout = 30000 } = {}) {
		this.client = client;
		this.onStderr = onStderr;
		this.timeout = timeout;
		this.cancelled = false;
	}
	async connect(config, cwd) {
		if (this.process) { throw new Error('Agent already connected.'); }
		this.cwd = cwd;
		this.process = spawn(config.command, config.args, { cwd, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
		const failed = new Promise((_, reject) => {
			this.process.once('error', reject);
			this.process.once('exit', code => reject(new Error(`Agent exited (${code ?? 'signal'}).`)));
		});
		// A persistent rejection observer prevents an unhandled rejection after initialization.
		failed.catch(() => {});
		this.process.stderr.on('data', data => this.onStderr(data.toString()));
		try { await Promise.race([failed, new Promise(resolve => this.process.once('spawn', resolve))]); }
		catch (error) { this.dispose(); throw error; }
		this.connection = new ClientSideConnection(() => ({
			...this.client,
			requestPermission: async params => {
				if (this.cancelled || params.sessionId !== this.sessionId) { return { outcome: { outcome: 'cancelled' } }; }
				const result = await this.client.requestPermission(params);
				return this.cancelled ? { outcome: { outcome: 'cancelled' } } : result;
			}
		}), ndJsonStream(Writable.toWeb(this.process.stdin), Readable.toWeb(this.process.stdout)));
		let timer;
		try {
			await Promise.race([failed, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Agent initialization timed out.')), this.timeout); }), (async () => {
				const response = await this.connection.initialize({ protocolVersion: PROTOCOL_VERSION, clientInfo: { name: 'sofik-code', version: '0.1.0' }, clientCapabilities: { fs: { readTextFile: true, writeTextFile: true } } });
				if (response.protocolVersion !== PROTOCOL_VERSION) { throw new Error('Unsupported ACP protocol version.'); }
				const session = await this.connection.newSession({ cwd, mcpServers: [] });
				this.sessionId = session.sessionId;
			})()]);
		} catch (error) { this.dispose(); throw error; }
		finally { clearTimeout(timer); }
	}
	async prompt(text) {
		if (!this.sessionId || this.connection.signal.aborted) { throw new Error('Agent is not connected.'); }
		if (this.busy) { throw new Error('Wait for the current turn or cancel it first.'); }
		this.busy = true;
		this.cancelled = false;
		try { return await this.connection.prompt({ sessionId: this.sessionId, prompt: [{ type: 'text', text }] }); }
		finally { this.busy = false; }
	}
	async cancel() {
		this.cancelled = true;
		if (this.sessionId && !this.connection.signal.aborted) { await this.connection.cancel({ sessionId: this.sessionId }); }
	}
	dispose() {
		this.cancelled = true;
		this.sessionId = undefined;
		if (!this.process) { return; }
		const child = this.process;
		this.process = undefined;
		child.stdin.destroy();
		child.stdout.destroy();
		child.stderr.destroy();
		child.kill();
		const timer = setTimeout(() => { if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); } }, 2000);
		timer.unref();
		child.once('exit', () => clearTimeout(timer));
	}
}
