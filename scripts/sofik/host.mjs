/* Copyright (c) Sofik AI. Licensed under the MIT License. */
// Private stdio contract with the desktop host. Closing stdin owns shutdown.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root = fileURLToPath(new URL('../../', import.meta.url));
const { values } = parseArgs({ options: { 'data-dir': { type: 'string' }, 'token-file': { type: 'string' } } });
if (!values['data-dir'] || !values['token-file']) { throw new Error('Desktop data directory and token file are required.'); }
const portFile = path.join(path.resolve(values['data-dir']), 'host-port');
let preferredPort = 0;
try {
	const value = Number(await readFile(portFile, 'utf8'));
	if (Number.isInteger(value) && value > 1023 && value < 65536) { preferredPort = value; }
} catch { /* First launch. */ }
let child;
let stopping = false;
function signalTree(signal) {
	if (!child?.pid) { return; }
	try {
		if (process.platform === 'win32') { spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); }
		else { process.kill(-child.pid, signal); }
	} catch (error) { if (error.code !== 'ESRCH') { throw error; } }
}
function stop() {
	if (stopping) { return; }
	stopping = true;
	signalTree('SIGTERM');
	setTimeout(() => { signalTree('SIGKILL'); process.exit(0); }, 2000);
}
function start(port) {
	let addressInUse = false;
	child = spawn(process.execPath, [path.join(root, 'out/server-main.js'), '--host', '127.0.0.1', '--port', String(port), '--server-data-dir', path.resolve(values['data-dir']), '--connection-token-file', path.resolve(values['token-file']), '--accept-server-license-terms', '--disable-telemetry'], {
		cwd: root, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
		env: { ...process.env, VSCODE_DEV: '1', PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH ?? ''}` }
	});
	for (const stream of [child.stdout, child.stderr]) {
		createInterface({ input: stream }).on('line', line => {
			if (port !== 0 && line.includes('EADDRINUSE')) { addressInUse = true; child.kill('SIGTERM'); }
			const ready = /^Web UI available at http:\/\/localhost:(\d+)/.exec(line);
			if (ready) {
				// Stable origin preserves browser storage and workspace trust on restart.
				writeFile(portFile, ready[1], { mode: 0o600 }).then(() => {
					process.stdout.write(`${JSON.stringify({ event: 'ready', port: Number(ready[1]) })}\n`);
				}, stop);
			} else { process.stderr.write(`${line.replace(/([?&]tkn=)[^\s&]+/g, '$1[redacted]')}\n`); }
		});
	}
	child.once('error', () => { process.stderr.write('Sofik Code could not start.\n'); stop(); });
	child.once('exit', code => {
		if (!stopping && addressInUse && port !== 0) { start(0); return; }
		if (!stopping) { process.stdout.write(`${JSON.stringify({ event: 'exit', code })}\n`); stop(); }
	});
}
start(preferredPort);
process.stdin.resume();
process.stdin.once('end', stop);
process.stdin.once('error', stop);
for (const signal of ['SIGTERM', 'SIGINT']) { process.once(signal, stop); }
