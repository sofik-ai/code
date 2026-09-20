/* Copyright (c) Microsoft Corporation. Licensed under the MIT License. */
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const root = fileURLToPath(new URL('../../', import.meta.url));
async function run(args) {
	await new Promise((resolve, reject) => {
		const child = spawn(process.execPath, args, { cwd: root, stdio: 'inherit' });
		child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(new Error(`${args.join(' ')} exited ${code}`)));
	});
}
await run(['build/next/index.ts', 'transpile']);
for (const dir of await fs.readdir(path.join(root, 'extensions'))) {
	if (existsSync(path.join(root, 'extensions', dir, 'esbuild.mts'))) {
		await run([`extensions/${dir}/esbuild.mts`]);
		// Development manifests reference out/. Production uses dist/.
		// Both are generated artifacts; keep one bundle for each entrypoint.
		const copyBundles = async folder => {
			for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
				if (!entry.isDirectory() || ['node_modules', 'out', 'test'].includes(entry.name)) { continue; }
				const child = path.join(folder, entry.name);
				if (entry.name === 'dist') { await fs.cp(child, path.join(folder, 'out'), { recursive: true }); }
				else { await copyBundles(child); }
			}
		};
		await copyBundles(path.join(root, 'extensions', dir));
	}
}
await run(['extensions/sofik-runtime/build.mjs']);
await fs.mkdir(path.join(root, 'out/vs/base/browser/ui/codicons/codicon'), { recursive: true });
await fs.copyFile(path.join(root, 'node_modules/@vscode/codicons/dist/codicon.ttf'), path.join(root, 'out/vs/base/browser/ui/codicons/codicon/codicon.ttf'));
console.log('Sofik Code compiled. Run npm run sofik:serve -- --folder /absolute/project/path');
