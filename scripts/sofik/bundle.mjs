/* Copyright (c) Sofik AI. Licensed under the MIT License. */
// Self-contained desktop payload using this build's Node ABI and native modules.
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const target = path.resolve(process.argv[2] ?? path.join(root, '.build/desktop-runtime'));
if (target === path.resolve(root) || root.startsWith(target + path.sep) || (target.startsWith(root) && !target.startsWith(path.join(root, '.build') + path.sep))) { throw new Error('Output must not contain the source tree.'); }
if (existsSync(target)) { throw new Error('Output already exists; choose a fresh staging directory.'); }
const copy = async (source, dest) => fs.cp(source, dest, { recursive: true, dereference: true,
	filter: source => !['node_modules', '.git', 'test', 'tests', 'src', '.cache'].includes(path.basename(source)) && !source.endsWith('.map') });
await fs.mkdir(target, { recursive: true });
for (const name of ['out', 'product.json', 'package.json', 'LICENSE.txt', 'ThirdPartyNotices.txt']) { await copy(path.join(root, name), path.join(target, name)); }
await fs.mkdir(path.join(target, 'scripts/sofik'), { recursive: true });
await fs.copyFile(path.join(root, 'scripts/sofik/host.mjs'), path.join(target, 'scripts/sofik/host.mjs'));
await fs.mkdir(path.join(target, 'bin'), { recursive: true });
await fs.copyFile(process.execPath, path.join(target, 'bin', process.platform === 'win32' ? 'node.exe' : 'node'));
await fs.chmod(path.join(target, 'bin', process.platform === 'win32' ? 'node.exe' : 'node'), 0o755);
// Node's distribution license is required alongside the redistributed binary.
const nodeLicense = [process.env.SOFIK_NODE_LICENSE, path.join(path.dirname(process.execPath), 'LICENSE'), path.resolve(path.dirname(process.execPath), '../LICENSE')].find(candidate => candidate && existsSync(candidate));
if (!nodeLicense) { throw new Error('Node distribution LICENSE is missing. Use an official Node distribution.'); }
await fs.copyFile(nodeLicense, path.join(target, 'bin', 'LICENSE'));
const copied = new Set();
async function dependencies(directory, inputManifest) {
	const manifest = inputManifest ?? JSON.parse(await fs.readFile(path.join(directory, 'package.json'), 'utf8'));
	for (const name of new Set([...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.optionalDependencies ?? {})])) {
		let parent = directory;
		let found;
		while (parent.startsWith(root.replace(/\/$/, ''))) {
			const candidate = path.join(parent, 'node_modules', name);
			if (existsSync(path.join(candidate, 'package.json'))) { found = candidate; break; }
			if (parent === path.dirname(parent)) { break; }
			parent = path.dirname(parent);
		}
		if (!found) {
			if (manifest.optionalDependencies?.[name]) { continue; }
			throw new Error(`Missing runtime dependency ${name} of ${directory}`);
		}
		if (copied.has(found)) { continue; }
		copied.add(found);
		// Dependencies can load resources from src/ or test-named paths; preserve
		// their contents, excluding only nested node_modules (resolved below).
		await fs.cp(found, path.join(target, path.relative(root, found)), { recursive: true, dereference: true,
			filter: source => source === found || (path.basename(source) !== 'node_modules' && !source.endsWith('.map') && !/\.(o|a|obj|pdb)$/.test(source)) });
		await dependencies(found);
	}
}
await dependencies(root);
await dependencies(root, JSON.parse(await fs.readFile(path.join(root, 'remote/package.json'), 'utf8')));
await copy(path.join(root, 'extensions'), path.join(target, 'extensions'));
await dependencies(path.join(root, 'extensions'));
for (const entry of await fs.readdir(path.join(root, 'extensions'), { withFileTypes: true })) {
	if (entry.isDirectory() && entry.name !== 'node_modules' && existsSync(path.join(root, 'extensions', entry.name, 'package.json'))) {
		await dependencies(path.join(root, 'extensions', entry.name));
	}
}
await fs.writeFile(path.join(target, 'sofik-runtime.json'), JSON.stringify({ format: 1, platform: process.platform, arch: process.arch, node: process.version, base: '1.138.0', sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim() }, null, 2));
console.log(`Desktop runtime: ${target}`);
