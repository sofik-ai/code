/* Copyright (c) Microsoft Corporation. Licensed under the MIT License. */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { dirs } from '../../build/npm/dirs.ts';
const root = fileURLToPath(new URL('../../', import.meta.url));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
async function run(args, directory = '', env = process.env) {
	console.log(`[setup] ${directory || '.'}: npm ${args.join(' ')}`);
	await new Promise((resolve, reject) => {
		const child = spawn(npm, args, { cwd: path.join(root, directory), env, stdio: 'inherit', shell: process.platform === 'win32' });
		child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Install failed in ${directory || '.'} (${code}).`)));
	});
}
const install = ['ci', '--ignore-scripts', '--no-audit', '--no-fund'];
await run(install);
await run(install, 'build');
await run(install, 'extensions');
for (const dir of dirs.filter(dir => dir.startsWith('extensions/'))) { await run(install, dir); }
await run(install, 'extensions/sofik-runtime');
// The embedding server uses Node, not Electron. Compile its native modules for this ABI.
await run(['rebuild', '@vscode/spdlog', '@vscode/sqlite3', '@vscode/native-watchdog', '@vscode/fs-copyfile', 'node-pty', '--runtime=node', `--target=${process.versions.node}`, '--dist-url=https://nodejs.org/download/release', '--build-from-source'], '', { ...process.env, CXXFLAGS: `${process.env.CXXFLAGS ?? ''} -std=c++20`.trim(), npm_config_force_process_config: 'true' });
await run(['rebuild', '@vscode/fs-copyfile', '--runtime=node', `--target=${process.versions.node}`, '--dist-url=https://nodejs.org/download/release', '--build-from-source'], 'extensions/git', { ...process.env, CXXFLAGS: '-std=c++20', npm_config_force_process_config: 'true' });
if (process.platform === 'win32') {
	// These addons have no prebuilt fallback; the server and terminal load them on Windows.
	await run(['rebuild', '@vscode/windows-registry', '@vscode/windows-process-tree', '@vscode/windows-ca-certs', '--runtime=node', `--target=${process.versions.node}`, '--dist-url=https://nodejs.org/download/release', '--build-from-source'], '', { ...process.env, npm_config_force_process_config: 'true' });
}
console.log('Setup complete. Run npm run sofik:build.');
