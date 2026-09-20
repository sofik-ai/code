/* Copyright (c) Sofik AI. Licensed under the MIT License. */
// Run existing terminal, LSP and authenticated server checks with only packaged files.
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const bundle = path.resolve(process.argv[2] ?? '.build/desktop-runtime');
const test = path.join(bundle, 'scripts/sofik/runtime.test.mjs');
await fs.copyFile(new URL('./runtime.test.mjs', import.meta.url), test);
try {
	const result = spawnSync(path.join(bundle, 'bin', process.platform === 'win32' ? 'node.exe' : 'node'), ['--test', test], { cwd: bundle, stdio: 'inherit', timeout: 90000 });
	if (result.error || result.status !== 0) throw result.error ?? new Error(`Packaged runtime tests failed (${result.status}).`);
} finally { await fs.rm(test, { force: true }); }
