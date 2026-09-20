import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WebSocketServer } from 'ws';
import { mkdtemp, mkdir, writeFile, rename, symlink, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ChatBridgeSession, readChatBridge, automaticChatContext, watchChatBridge, canonicalChatFolders } from '../src/chat-bridge.mjs';

test('desktop ACP loads the card conversation and sends provider metadata without token in URL', async t => {
	const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
	await new Promise(resolve => server.once('listening', resolve));
	t.after(() => { for (const client of server.clients) client.terminate(); server.close(); });
	const requests = [];
	server.on('connection', socket => socket.on('message', raw => {
		const request = JSON.parse(raw.toString()); requests.push(request);
		if (request.token) { socket.send(JSON.stringify({ authenticated: true })); return; }
		if (request.method === 'session/prompt') {
			socket.send(JSON.stringify({ jsonrpc: '2.0', method: 'session/update', params: { sessionId: 'card-conversation', update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'edited file' } } } }));
		}
		const result = request.method === 'initialize' ? { protocolVersion: 1, agentCapabilities: { loadSession: true } } : request.method === 'session/prompt' ? { stopReason: 'end_turn' } : request.method === '_sofik/session_context' ? { cwd: '/fixture/worktree', sourceFolders: ['/fixture/worktree', '/fixture/docs'] } : {};
		if (request.id !== undefined) socket.send(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }));
	}));
	const updates = [];
	const session = new ChatBridgeSession({ sessionUpdate: async p => updates.push(p.update.content.text) });
	t.after(() => session.dispose());
	await session.connect({ endpoint: `ws://127.0.0.1:${server.address().port}/acp`, token: 'private-test', sessionId: 'card-conversation', providerId: 'fixture', modelId: 'test-model' }, os.tmpdir());
	assert.equal(requests.some(request => request.method === 'session/prompt'), false);
	assert.equal((await session.prompt('change file')).stopReason, 'end_turn');
	assert.equal(requests.find(r => r.method === 'session/load').params.sessionId, 'card-conversation');
	assert.equal(requests.find(r => r.method === 'session/load').params.cwd, '/fixture/worktree');
	const prompt = requests.find(r => r.method === 'session/prompt');
	assert.deepEqual(session.sourceFolders, [path.resolve('/fixture/worktree'), path.resolve('/fixture/docs')]);
	assert.equal(prompt.params._meta.sofik.providerId, 'fixture');
	assert.equal(prompt.params._meta.sofik.modelId, 'test-model');
	assert.equal(typeof prompt.params._meta.sofik.clientMessageId, 'string');
	assert.deepEqual(updates, ['edited file']);
});

test('desktop context rejects project workspace files and non-loopback endpoints', async t => {
	const root = await mkdtemp(path.join(os.tmpdir(), 'sofik-bridge-test-'));
	t.after(() => rm(root, { recursive: true, force: true }));
	await mkdir(path.join(root, 'managed')); await mkdir(path.join(root, 'project'));
	const file = path.join(root, 'managed', 'Sofik.code-workspace');
	await writeFile(file, '{}'); await writeFile(path.join(root, 'project', 'Sofik.code-workspace'), '{}');
	assert.equal(await readChatBridge(path.join(root, 'project', 'Sofik.code-workspace'), path.join(root, 'managed')), undefined);
	await writeFile(path.join(root, 'managed', 'chat-bridge.json'), JSON.stringify({ endpoint: 'ws://example.com/acp', token: 'test', sessionId: 'card' }));
	await assert.rejects(readChatBridge(file, path.join(root, 'managed')), /Invalid desktop/);
});


test('automatic connection selects only the explicit or sole card', () => {
	assert.equal(automaticChatContext(undefined), undefined);
	assert.equal(automaticChatContext({ sessions: [{ sessionId: 'one' }, { sessionId: 'two' }] }), undefined);
	assert.equal(automaticChatContext({ sessions: [{ sessionId: 'one' }] }).sessionId, 'one');
	assert.equal(automaticChatContext({ sessionId: 'selected', sessions: [{ sessionId: 'other' }] }).sessionId, 'selected');
});

test('desktop context watcher observes activation and atomic changes and stops on disposal', async t => {
	const root = await mkdtemp(path.join(os.tmpdir(), 'sofik-watch-test-'));
	t.after(() => rm(root, { recursive: true, force: true }));
	const workspace = path.join(root, 'Sofik.code-workspace');
	const sidecar = path.join(root, 'chat-bridge.json');
	await writeFile(workspace, '{}');
	const context = sessionId => JSON.stringify({ endpoint: 'ws://127.0.0.1:1234/acp', token: 'private', sessionId });
	await writeFile(sidecar, context('first'));
	const observed = [];
	const waitFor = async count => {
		const timeout = Date.now() + 2000;
		while (observed.length < count && Date.now() < timeout) { await new Promise(resolve => setTimeout(resolve, 10)); }
		assert.equal(observed.length, count);
	};
	const watcher = await watchChatBridge(workspace, async () => observed.push((await readChatBridge(workspace, root)).sessionId), { root, debounceMs: 5 });
	t.after(() => watcher.dispose());
	await waitFor(1);
	await writeFile(`${sidecar}.tmp`, context('second'));
	await rename(`${sidecar}.tmp`, sidecar);
	await waitFor(2);
	assert.deepEqual(observed, ['first', 'second']);
	watcher.dispose();
	await writeFile(sidecar, context('third'));
	await new Promise(resolve => setTimeout(resolve, 50));
	assert.deepEqual(observed, ['first', 'second']);
});


test('agent folders resolve symlink aliases before appending workspace roots', async t => {
	const root = await mkdtemp(path.join(os.tmpdir(), 'sofik-roots-test-'));
	t.after(() => rm(root, { recursive: true, force: true }));
	await mkdir(path.join(root, 'project'));
	await symlink(path.join(root, 'project'), path.join(root, 'alias'));
	const folders = await canonicalChatFolders([path.join(root, 'project'), path.join(root, 'alias')]);
	assert.equal(folders.length, 1);
	assert.equal(path.basename(folders[0]), 'project');
});
