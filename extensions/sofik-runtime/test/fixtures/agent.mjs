/* Copyright (c) Microsoft Corporation. Licensed under the MIT License. */
import { AgentSideConnection, ndJsonStream } from '@agentclientprotocol/sdk';
import { Readable, Writable } from 'node:stream';
let finish;
new AgentSideConnection(client => ({
	initialize: async ({ protocolVersion }) => ({ protocolVersion, agentCapabilities: {} }),
	newSession: async () => ({ sessionId: 'test-session' }),
	cancel: async () => { finish?.({ stopReason: 'cancelled' }); },
	prompt: async ({ sessionId, prompt }) => {
		if (prompt[0].text === 'wait') { return new Promise(resolve => { finish = resolve; }); }
		const permission = await client.requestPermission({ sessionId, toolCall: { toolCallId: 'tool-1', title: 'Test operation' }, options: [{ optionId: 'allow', name: 'Allow Once', kind: 'allow_once' }, { optionId: 'deny', name: 'Reject Once', kind: 'reject_once' }] });
		await client.sessionUpdate({ sessionId, update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: permission.outcome.outcome === 'selected' ? permission.outcome.optionId : 'cancelled' } } });
		return { stopReason: 'end_turn' };
	}
}), ndJsonStream(Writable.toWeb(process.stdout), Readable.toWeb(process.stdin)));
