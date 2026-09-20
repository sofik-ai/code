/* Copyright (c) Microsoft Corporation. Licensed under the MIT License. */
import { build } from '../../build/node_modules/esbuild/lib/main.js';
import { fileURLToPath } from 'node:url';
await build({ entryPoints: [fileURLToPath(new URL('./src/extension.mjs', import.meta.url))], outfile: fileURLToPath(new URL('./dist/extension.cjs', import.meta.url)), bundle: true, platform: 'node', format: 'cjs', target: 'node22', external: ['vscode'], sourcemap: true });
