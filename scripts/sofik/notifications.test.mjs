/* Copyright (c) Microsoft Corporation. Licensed under the MIT License. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NotificationService } from '../../out/vs/workbench/services/notification/common/notificationService.js';
import { WorkspaceTrustEnablementService } from '../../out/vs/workbench/services/workspaces/common/workspaceTrust.js';

test('removed notifications dismiss API promises without executing choices or retaining items', async () => {
 const messages = [];
 const service = new NotificationService({ info: value => messages.push(value), warn: value => messages.push(value), error: value => messages.push(value) });
 let cancelled = 0;
 let selected = false;
 const handle = service.prompt(1, 'local notification fixture', [{label: 'Do not run', run: () => { selected = true; }}], {onCancel: () => cancelled++});
 await new Promise(resolve => handle.onDidClose(resolve));
 handle.close();
 assert.equal(cancelled, 1);
 assert.equal(selected, false);
 assert.deepEqual(messages, ['local notification fixture']);
 assert.equal(service.model.notifications.length, 0);
 service.dispose();
});

test('legacy workspace trust setting cannot restore restricted mode', () => {
 const service = new WorkspaceTrustEnablementService({getValue: () => true}, {disableWorkspaceTrust: false});
 assert.equal(service.isWorkspaceTrustEnabled(), false);
 service.dispose();
});
