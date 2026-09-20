/* Copyright (c) Microsoft Corporation. Licensed under the MIT License. */
import { parseArgs } from 'node:util';
import { randomBytes } from 'node:crypto';
import { chmod, mkdir, writeFile, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../../', import.meta.url));
const { values } = parseArgs({ options: { folder: { type: 'string' }, port: { type: 'string', default: '9889' }, 'data-dir': { type: 'string' }, 'token-file': { type: 'string' } } });
if (!/^\d+$/.test(values.port) || Number(values.port) < 1 || Number(values.port) > 65535) { throw new Error('Invalid port.'); }
const dataDir = path.resolve(values['data-dir'] ?? path.join(root, '.build/sofik-local'));
await mkdir(dataDir, { recursive: true, mode: 0o700 });
const tokenFile = path.resolve(values['token-file'] ?? path.join(dataDir, 'connection-token'));
if (!values['token-file']) { await writeFile(tokenFile, randomBytes(32).toString('hex'), { mode: 0o600 }); await chmod(tokenFile, 0o600); }
else { await stat(tokenFile); }
const args = [path.join(root, 'out/server-main.js'), '--host', '127.0.0.1', '--port', values.port, '--server-data-dir', dataDir, '--connection-token-file', tokenFile, '--accept-server-license-terms'];
if (values.folder) {
	const folder = path.resolve(values.folder);
	if (!(await stat(folder)).isDirectory()) { throw new Error('The workspace must be a directory.'); }
	args.push('--default-folder', folder);
}
console.log(`Sofik Code: http://127.0.0.1:${values.port}`);
console.log(`Local host connection token file: ${tokenFile}`);
console.log('The embedding host should read this file and use the tkn query parameter for the initial connection.');
const child = spawn(process.execPath, args, { cwd: root, env: { ...process.env, VSCODE_DEV: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
for (const stream of [child.stdout, child.stderr]) {
	createInterface({ input: stream }).on('line', line => console.log(line.replace(/([?&]tkn=)[^\s&]+/g, '$1[redacted]')));
}
for (const signal of ['SIGINT', 'SIGTERM']) { process.once(signal, () => child.kill(signal)); }
child.once('error', error => { console.error(error.message); process.exitCode = 1; });
child.once('exit', code => { process.exitCode = code ?? 0; });
