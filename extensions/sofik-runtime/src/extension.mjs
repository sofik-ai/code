/* Copyright (c) Microsoft Corporation. Licensed under the MIT License. */
import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
import { AgentSession } from './acp.mjs';
import { ChatBridgeSession, readChatBridge, automaticChatContext, watchChatBridge, canonicalChatFolders } from './chat-bridge.mjs';
import { parseConfig, workspacePath } from './config.mjs';

export function activate(context) {
	const output = vscode.window.createOutputChannel('Sofik Agent');
	const languageOutput = vscode.window.createOutputChannel('Sofik Languages');
	context.subscriptions.push(output, languageOutput);
	const configUri = vscode.Uri.joinPath(context.globalStorageUri, 'runtime.json');
	const languageClients = [];
	let agent;
	let connecting = false;
	let disposed = false;
	let refreshTimer;
	let bridgeWatcher;
	const t = vscode.l10n.t;
	const readConfig = async () => {
		try { return parseConfig(new TextDecoder().decode(await vscode.workspace.fs.readFile(configUri))); }
		catch (error) { if (error.code === 'FileNotFound') { return { languageServers: [] }; } throw error; }
	};
	const stopLanguages = async () => { await Promise.all(languageClients.splice(0).map(client => client.stop())); };
	const startLanguages = async () => {
		await stopLanguages();
		const config = await readConfig();
		for (const folder of vscode.workspace.workspaceFolders ?? []) {
			for (const server of config.languageServers) {
				const client = new LanguageClient(`sofik.${server.id}.${folder.index}`, server.id,
					{ command: server.command, args: server.args, options: { cwd: folder.uri.fsPath, shell: false } },
					{ documentSelector: server.languages.map(language => ({ scheme: 'file', language, pattern: new vscode.RelativePattern(folder, '**/*') })), workspaceFolder: folder, outputChannel: languageOutput });
				languageClients.push(client);
				try { await client.start(); } catch (error) { languageOutput.appendLine(`${server.id}: ${error.message}`); }
			}
		}
	};
	const disconnect = () => { agent?.dispose(); agent = undefined; };
	const ensureAgent = async (bridge, folder, config) => {
		if (disposed) { return; }
		if (connecting || agent?.busy) { throw new Error(t('An agent turn is already running.')); }
		if (agent && ((!bridge && agent.cwd !== folder.uri.fsPath) || agent.connection.signal.aborted || (bridge && agent instanceof ChatBridgeSession && (agent.context.endpoint !== bridge.endpoint || agent.context.token !== bridge.token)) || agent.sessionId !== (bridge?.sessionId ?? agent.sessionId))) { disconnect(); }
		if (!agent) {
			connecting = true;
			const session = new (bridge ? ChatBridgeSession : AgentSession)({
				sessionUpdate: async ({ update }) => {
					if (update.sessionUpdate === 'agent_message_chunk' && update.content.type === 'text') { output.append(update.content.text); }
					else if (update.sessionUpdate === 'tool_call' || update.sessionUpdate === 'tool_call_update') { output.appendLine(`\n${update.title ?? update.toolCallId}: ${update.status ?? ''}`); }
				},
				requestPermission: async ({ options }) => {
					const option = options.find(item => item.kind === 'allow_once') ?? options.find(item => item.kind === 'allow_always');
					return { outcome: option ? { outcome: 'selected', optionId: option.optionId } : { outcome: 'cancelled' } };
				},
				readTextFile: async ({ sessionId, path, line = 1, limit }) => {
					if (sessionId !== session.sessionId || session.cancelled) { throw new Error('Inactive agent session.'); }
					const uri = vscode.Uri.file(await workspacePath(folder.uri.fsPath, path));
					const document = await vscode.workspace.openTextDocument(uri);
					return { content: document.getText().split('\n').slice(line - 1, limit === undefined ? undefined : line - 1 + limit).join('\n') };
				},
				writeTextFile: async ({ sessionId, path, content }) => {
					if (sessionId !== session.sessionId || session.cancelled) { throw new Error('Inactive agent session.'); }
					const uri = vscode.Uri.file(await workspacePath(folder.uri.fsPath, path));
					if (session.cancelled) { throw new Error('Agent turn cancelled.'); }
					const edit = new vscode.WorkspaceEdit();
					try {
						const document = await vscode.workspace.openTextDocument(uri);
						edit.replace(uri, new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)), content);
					} catch (error) {
						try { await vscode.workspace.fs.stat(uri); throw error; } catch (statError) {
							if (statError.code === 'FileNotFound') { edit.createFile(uri, { contents: new TextEncoder().encode(content) }); }
							else { throw error; }
						}
					}
					if (!await vscode.workspace.applyEdit(edit)) { throw new Error('Could not apply agent changes.'); }
					const document = await vscode.workspace.openTextDocument(uri);
					await vscode.window.showTextDocument(document, { preview: false, preserveFocus: true });
					if (!await document.save()) { throw new Error('Could not save agent changes.'); }
					return {};
				}
			}, { onStderr: message => output.append(message) });
			agent = session;
			try {
				await session.connect(bridge ?? config.agent, bridge?.cwd ?? folder.uri.fsPath);
				if (disposed) { session.dispose(); return; }
				if (session instanceof ChatBridgeSession) {
					const existing = vscode.workspace.workspaceFolders ?? [];
					const known = new Set(await canonicalChatFolders(existing.map(item => item.uri.fsPath)));
					const additions = session.sourceFolders.filter(root => !known.has(root)).map(root => ({ uri: vscode.Uri.file(root) }));
					// Appending leaves the first root intact and avoids restarting
					// this extension host during an active ACP connection.
					if (additions.length && !vscode.workspace.updateWorkspaceFolders(existing.length, 0, ...additions)) {
						throw new Error(t('Could not open the conversation folders.'));
					}
				}
			}
			catch (error) { disconnect(); throw error; }
			finally { connecting = false; }
		}
		if (bridge && agent instanceof ChatBridgeSession) { agent.context = bridge; }
	};
	const refreshBridge = async () => {
		if (disposed) { return; }
		if (connecting || agent?.busy) {
			clearTimeout(refreshTimer);
			refreshTimer = setTimeout(() => { void refreshBridge().catch(error => output.appendLine(error.message)); }, 250);
			return;
		}
		const bridge = automaticChatContext(await readChatBridge(vscode.workspace.workspaceFile?.fsPath));
		if (!bridge) {
			if (agent instanceof ChatBridgeSession) { disconnect(); }
			return;
		}
		const folder = vscode.workspace.workspaceFolders?.[0];
		if (folder) { await ensureAgent(bridge, folder, {}); }
	};
	const prompt = async () => {
		if (connecting || agent?.busy) { throw new Error(t('An agent turn is already running.')); }
		const folders = vscode.workspace.workspaceFolders ?? [];
		let bridge = await readChatBridge(vscode.workspace.workspaceFile?.fsPath);
		if (bridge && !bridge.sessionId) {
			const choices = bridge.sessions.map(session => ({ label: session.label || t('Conversation'), session }));
			const selected = choices.length === 1 ? choices[0] : await vscode.window.showQuickPick(choices, { title: t('Conversation'), ignoreFocusOut: true });
			if (!selected) { return; }
			bridge = { ...bridge, ...selected.session };
		}
		const folder = bridge ? folders[0] : folders.length === 1 ? folders[0] : await vscode.window.showWorkspaceFolderPick();
		if (!folder) { return; }
		const text = await vscode.window.showInputBox({ prompt: t('Ask your ACP agent'), ignoreFocusOut: true });
		if (!text?.trim()) { return; }
		const config = await readConfig();
		if (!bridge && !config.agent) { throw new Error(t('Open a chat card in this Space to connect its agent.')); }
		output.show(true);
		await ensureAgent(bridge, folder, config);
		output.appendLine(`\n> ${text}\n`);
		const result = await agent.prompt(text);
		output.appendLine(`\n[${result.stopReason}]`);
	};
	for (const [id, handler] of Object.entries({ 'sofik.agent.prompt': prompt, 'sofik.agent.cancel': () => agent?.cancel(), 'sofik.agent.disconnect': disconnect, 'sofik.languages.restart': startLanguages })) {
		context.subscriptions.push(vscode.commands.registerCommand(id, async () => { try { await handler(); } catch (error) { output.appendLine(error.message); output.show(true); } }));
	}
	context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(() => { if (!(agent instanceof ChatBridgeSession)) { disconnect(); } void startLanguages().catch(error => languageOutput.appendLine(error.message)); }));
	context.subscriptions.push({ dispose: () => { disposed = true; clearTimeout(refreshTimer); bridgeWatcher?.dispose(); disconnect(); void stopLanguages(); } });
	void watchChatBridge(vscode.workspace.workspaceFile?.fsPath, refreshBridge, { onError: error => output.appendLine(error.message) }).then(watcher => { if (disposed) { watcher.dispose(); } else { bridgeWatcher = watcher; } });
	void startLanguages().catch(error => languageOutput.appendLine(error.message));
}
