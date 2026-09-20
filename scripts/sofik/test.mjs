/* Copyright (c) Sofik AI. Licensed under the MIT License. */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
// node-pty's own suite uses --exit: the Windows ConPTY DLL can retain a native
// worker after all assertions and cleanup hooks finish. Force only that test
// runner to exit after completion, preserving failed assertions and timeouts.
const args = ['--test', ...(process.platform === 'win32' ? ['--test-force-exit'] : []), '--test-concurrency=1', '--test-timeout=60000', '--test-reporter=tap', 'scripts/sofik/*.test.mjs', 'extensions/sofik-runtime/test/*.test.mjs'];
const result = spawnSync(process.execPath, args, { cwd: fileURLToPath(new URL('../../', import.meta.url)), stdio: 'inherit', timeout: 180000 });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
