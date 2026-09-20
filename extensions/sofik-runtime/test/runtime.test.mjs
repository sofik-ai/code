/* Copyright (c) Microsoft Corporation. Licensed under the MIT License. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, symlink, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AgentSession } from '../src/acp.mjs';
import { parseConfig, workspacePath } from '../src/config.mjs';

const fixture = fileURLToPath(new URL('./fixtures/agent.mjs', import.meta.url));
function session(updates = [], permissions = []) {
	return new AgentSession({ sessionUpdate: async p => { updates.push(p.update.content.text); }, requestPermission: async p => { permissions.push(p); return { outcome: { outcome: 'selected', optionId: 'deny' } }; } });
}
test('ACP negotiates a session, streams output and preserves the user permission choice', async t => {
	const updates = [], permissions = [], agent = session(updates, permissions);
	t.after(() => agent.dispose());
	await agent.connect({ command: process.execPath, args: [fixture] }, os.tmpdir());
	const response = await agent.prompt('hello');
	assert.deepEqual({ session: agent.sessionId, updates, requested: permissions[0].toolCall.title, stop: response.stopReason }, { session: 'test-session', updates: ['deny'], requested: 'Test operation', stop: 'end_turn' });
});
test('ACP cancellation ends the active turn and prevents concurrent prompts', async t => {
	const agent = session(); t.after(() => agent.dispose());
	await agent.connect({ command: process.execPath, args: [fixture] }, os.tmpdir());
	const turn = agent.prompt('wait');
	await assert.rejects(agent.prompt('second'), /current turn/);
	await new Promise(resolve => setTimeout(resolve, 40));
	await agent.cancel();
	assert.equal((await turn).stopReason, 'cancelled');
});
test('missing executable and initialization timeout fail cleanly', async () => {
	const missing = session();
	await assert.rejects(missing.connect({ command: '/sofik-missing-agent', args: [] }, os.tmpdir()), /ENOENT/);
	const stalled = new AgentSession({ requestPermission: async () => {}, sessionUpdate: async () => {} }, { timeout: 50 });
	await assert.rejects(stalled.connect({ command: process.execPath, args: ['-e', 'setInterval(() => {}, 1000)'] }, os.tmpdir()), /timed out/);
	assert.equal(stalled.process, undefined);
});
test('workspace callbacks reject traversal and symlinks outside the selected project', async t => {
	const temp = await mkdtemp(path.join(os.tmpdir(), 'sofik-code-test-')); t.after(() => rm(temp, { recursive: true, force: true }));
	const root = path.join(temp, 'project'); await mkdir(root);
	await writeFile(path.join(temp, 'private.txt'), 'test');
	await symlink(path.join(temp, 'private.txt'), path.join(root, 'link.txt'));
	await assert.rejects(workspacePath(root, path.join(root, '../private.txt')), /outside/);
	await assert.rejects(workspacePath(root, path.join(root, 'link.txt')), /outside/);
	await assert.rejects(workspacePath(root, 'relative.txt'), /absolute/);
	await symlink(path.join(temp, 'missing.txt'), path.join(root, 'dangling.txt'));
	await assert.rejects(workspacePath(root, path.join(root, 'dangling.txt')), /symbolic link/);
	assert.equal(path.basename(await workspacePath(root, path.join(root, 'new.txt'))), 'new.txt');
});
test('runtime configuration accepts explicit arguments and rejects malformed processes', () => {
	assert.deepEqual(parseConfig('{"agent":{"command":"agent","args":["--acp"]},"languageServers":[]}').agent, { command: 'agent', args: ['--acp'] });
	assert.throws(() => parseConfig('{"agent":{"command":"agent","args":"--acp"}}'), /arguments/);
	assert.throws(() => parseConfig('{"languageServers":[{"id":"go","command":"gopls","args":[],"languages":[]}]}'), /language IDs/);
});
