/* Copyright (c) Microsoft Corporation. Licensed under the MIT License. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createMessageConnection, StreamMessageReader, StreamMessageWriter } from '../../extensions/sofik-runtime/node_modules/vscode-jsonrpc/node.js';
import pty from 'node-pty';

test('native terminal runs a command and reports its exit status', { timeout: 10000 }, async () => {
	const terminal = pty.spawn(process.execPath, ['-e', 'console.log("sofik-terminal-ok")'], { name: 'xterm-256color', cols: 80, rows: 24, cwd: os.tmpdir(), env: process.env });
	let output = '';
	const result = await new Promise(resolve => { terminal.onData(data => { output += data; }); terminal.onExit(resolve); });
	assert.deepEqual({ output: output.trim(), code: result.exitCode }, { output: 'sofik-terminal-ok', code: 0 });
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
	t.after(async () => { child.kill(); if (child.exitCode === null && child.signalCode === null) { await once(child, 'exit'); } await rm(directory, { recursive: true, force: true }); });
	const port = await new Promise((resolve, reject) => {
		let buffer = '';
		child.stdout.on('data', data => { buffer += data; const match = buffer.match(/Server bound to 127\.0\.0\.1:(\d+)/); if (match) { resolve(match[1]); } });
		child.once('error', reject); child.once('exit', code => reject(new Error(`Server exited ${code}`)));
	});
	const denied = await fetch(`http://127.0.0.1:${port}/`);
	const allowed = await fetch(`http://127.0.0.1:${port}/?tkn=sofik-test-only-token`, { redirect: 'manual' });
	assert.deepEqual({ denied: denied.status, allowed: allowed.status, cookie: Boolean(allowed.headers.get('set-cookie')) }, { denied: 403, allowed: 302, cookie: true });
});
