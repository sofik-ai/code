/* Copyright (c) Microsoft Corporation. Licensed under the MIT License. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createMessageConnection, StreamMessageReader, StreamMessageWriter } from '../../extensions/sofik-runtime/node_modules/vscode-jsonrpc/node.js';
import pty from 'node-pty';

test('native terminal runs a command and reports its exit status', { timeout: 10000 }, async t => {
	const terminal = pty.spawn(process.execPath, ['-e', 'console.log("sofik-terminal-ok")'], { name: 'xterm-256color', cols: 80, rows: 24, cwd: os.tmpdir(), env: process.env });
	// ConPTY keeps a worker alive after shell exit until the terminal is disposed.
	t.after(() => { try { terminal.kill(); } catch (error) { if (error.code !== 'ESRCH') { throw error; } } });
	let output = '';
	const result = await new Promise(resolve => { terminal.onData(data => { output += data; }); terminal.onExit(resolve); });
	// Windows also emits OSC window-title and cursor-control sequences.
	assert.match(output, /sofik-terminal-ok/);
	assert.equal(result.exitCode, 0);
});

test('bundled JSON LSP provides schema autocomplete over stdio', { timeout: 10000 }, async t => {
	const child = spawn(process.execPath, ['extensions/json-language-features/server/dist/node/jsonServerMain.js', '--stdio'], { stdio: ['pipe', 'pipe', 'pipe'] });
	const connection = createMessageConnection(new StreamMessageReader(child.stdout), new StreamMessageWriter(child.stdin));
	t.after(() => { connection.dispose(); child.kill(); });
	connection.listen();
	await connection.sendRequest('initialize', { processId: process.pid, rootUri: null, capabilities: {} });
	await connection.sendNotification('initialized', {});
	await connection.sendNotification('workspace/didChangeConfiguration', { settings: { json: { schemas: [{ uri: 'inmemory://sofik-test', fileMatch: ['*.json'], schema: { type: 'object', properties: { sofikCompletion: { type: 'string' } } } }] } } });
	const uri = 'file:///sofik-test.json';
	await connection.sendNotification('textDocument/didOpen', { textDocument: { uri, languageId: 'json', version: 1, text: '{\n  \n}' } });
	const response = await connection.sendRequest('textDocument/completion', { textDocument: { uri }, position: { line: 1, character: 2 } });
	assert.ok(response.items.some(item => item.label.includes('sofikCompletion')));
	await connection.sendRequest('shutdown');
	await connection.sendNotification('exit');
});

test('local server requires its connection token', { timeout: 20000 }, async t => {
	const directory = await mkdtemp(path.join(os.tmpdir(), 'sofik-code-auth-test-'));
	const tokenFile = path.join(directory, 'token');
	await writeFile(tokenFile, 'sofik-test-only-token', { mode: 0o600 });
	const child = spawn(process.execPath, ['out/server-main.js', '--host', '127.0.0.1', '--port', '0', '--connection-token-file', tokenFile, '--server-data-dir', directory, '--accept-server-license-terms'], { env: { ...process.env, VSCODE_DEV: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
	t.after(async () => {
		if (child.exitCode === null && child.signalCode === null) {
			const exited = once(child, 'exit');
			if (process.platform === 'win32') { spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); }
			else { child.kill(); }
			await exited;
		}
		await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
	});
	let diagnostics = '';
	for (const stream of [child.stdout, child.stderr]) { stream.on('data', data => { diagnostics = (diagnostics + data).slice(-16000); }); }
	const port = await new Promise((resolve, reject) => {
		let buffer = '';
		child.stdout.on('data', data => { buffer += data; const match = buffer.match(/Server bound to 127\.0\.0\.1:(\d+)/); if (match) { resolve(match[1]); } });
		child.once('error', reject); child.once('exit', code => reject(new Error(`Server exited ${code}`)));
	});
	const request = async (url, options) => {
		try { return await fetch(url, { ...options, signal: AbortSignal.timeout(10000) }); }
		catch (error) { throw new Error(`Server request failed: ${error.cause?.message ?? error.message}\n${diagnostics}`, { cause: error }); }
	};
	const denied = await request(`http://127.0.0.1:${port}/`);
	await denied.text();
	const allowed = await request(`http://127.0.0.1:${port}/?tkn=sofik-test-only-token`, { redirect: 'manual' });
	await allowed.text();
	assert.deepEqual({ denied: denied.status, allowed: allowed.status, cookie: Boolean(allowed.headers.get('set-cookie')) }, { denied: 403, allowed: 302, cookie: true });
});
