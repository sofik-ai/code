/* Copyright (c) Microsoft Corporation. Licensed under the MIT License. */
import { createMessageConnection, StreamMessageReader, StreamMessageWriter } from 'vscode-jsonrpc/node.js';
const connection = createMessageConnection(new StreamMessageReader(process.stdin), new StreamMessageWriter(process.stdout));
connection.onRequest('initialize', () => ({ capabilities: { textDocumentSync: 1, completionProvider: { triggerCharacters: ['.'] } } }));
connection.onRequest('textDocument/completion', () => ({ isIncomplete: false, items: [{ label: 'sofikExternalCompletion', kind: 3, insertText: 'sofikExternalCompletion', detail: 'Sofik LSP fixture' }] }));
connection.onRequest('shutdown', () => null);
connection.onNotification('exit', () => process.exit(0));
connection.listen();
