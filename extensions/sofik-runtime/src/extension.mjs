/* Copyright (c) Microsoft Corporation. Licensed under the MIT License. */
import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
import { AgentSession } from './acp.mjs';
import { parseConfig, workspacePath } from './config.mjs';

export function activate(context) {
	const output = vscode.window.createOutputChannel('Sofik Agent');
	const languageOutput = vscode.window.createOutputChannel('Sofik Languages');
	context.subscriptions.push(output, languageOutput);
	const configUri = vscode.Uri.joinPath(context.globalStorageUri, 'runtime.json');
	const languageClients = [];
	let agent;
	let connecting = false;
	const t = vscode.l10n.t;
	const readConfig = async () => {
		try { return parseConfig(new TextDecoder().decode(await vscode.workspace.fs.readFile(configUri))); }
		catch (error) { if (error.code === 'FileNotFound') { return { languageServers: [] }; } throw error; }
	};
	const configure = async () => {
		await vscode.workspace.fs.createDirectory(context.globalStorageUri);
		try { await vscode.workspace.fs.stat(configUri); }
		catch (error) {
			if (error.code !== 'FileNotFound') { throw error; }
			await vscode.workspace.fs.writeFile(configUri, new TextEncoder().encode(JSON.stringify({ agent: null, languageServers: [] }, null, 2) + '\n'));
		}
		await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(configUri));
	};
	const stopLanguages = async () => { await Promise.all(languageClients.splice(0).map(client => client.stop())); };
	const startLanguages = async () => {
		await stopLanguages();
		if (!vscode.workspace.isTrusted) { return; }
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
	const prompt = async () => {
		if (!vscode.workspace.isTrusted) { throw new Error(t('Trust the workspace before connecting an agent.')); }
		if (connecting || agent?.busy) { throw new Error(t('An agent turn is already running.')); }
		const folders = vscode.workspace.workspaceFolders ?? [];
		const folder = folders.length === 1 ? folders[0] : await vscode.window.showWorkspaceFolderPick();
		if (!folder) { return; }
		const text = await vscode.window.showInputBox({ prompt: t('Ask your ACP agent'), ignoreFocusOut: true });
		if (!text?.trim()) { return; }
		const config = await readConfig();
		if (!config.agent) { await configure(); void vscode.window.showInformationMessage(t('Set agent.command and agent.args, save, then ask again.')); return; }
		output.show(true);
		if (agent && (agent.cwd !== folder.uri.fsPath || agent.connection.signal.aborted)) { disconnect(); }
		if (!agent) {
			connecting = true;
			const session = new AgentSession({
				sessionUpdate: async ({ update }) => {
					if (update.sessionUpdate === 'agent_message_chunk' && update.content.type === 'text') { output.append(update.content.text); }
					else if (update.sessionUpdate === 'tool_call' || update.sessionUpdate === 'tool_call_update') { output.appendLine(`\n${update.title ?? update.toolCallId}: ${update.status ?? ''}`); }
				},
				requestPermission: async ({ toolCall, options }) => {
					const selection = await vscode.window.showQuickPick(options.map(option => ({ label: option.name, option })), { title: toolCall.title, placeHolder: t('Agent permission'), ignoreFocusOut: true });
					return { outcome: selection ? { outcome: 'selected', optionId: selection.option.optionId } : { outcome: 'cancelled' } };
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
					const approved = await vscode.window.showWarningMessage(t('Apply agent changes to {0}?', vscode.workspace.asRelativePath(uri)), { modal: true }, t('Apply'));
					if (!approved || session.cancelled) { throw new Error('File change declined.'); }
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
			try { await session.connect(config.agent, folder.uri.fsPath); }
			catch (error) { disconnect(); throw error; }
			finally { connecting = false; }
		}
		output.appendLine(`\n> ${text}\n`);
		await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: t('Sofik Agent'), cancellable: true }, async (_, token) => {
			const subscription = token.onCancellationRequested(() => { void agent?.cancel(); });
			try { const result = await agent.prompt(text); output.appendLine(`\n[${result.stopReason}]`); }
			finally { subscription.dispose(); }
		});
	};
	for (const [id, handler] of Object.entries({ 'sofik.agent.prompt': prompt, 'sofik.agent.cancel': () => agent?.cancel(), 'sofik.agent.disconnect': disconnect, 'sofik.runtime.configure': configure, 'sofik.languages.restart': startLanguages })) {
		context.subscriptions.push(vscode.commands.registerCommand(id, async () => { try { await handler(); } catch (error) { output.appendLine(error.message); void vscode.window.showErrorMessage(error.message); } }));
	}
	context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(() => { disconnect(); void startLanguages().catch(error => languageOutput.appendLine(error.message)); }));
	context.subscriptions.push({ dispose: () => { disconnect(); void stopLanguages(); } });
	void startLanguages().catch(error => languageOutput.appendLine(error.message));
}
