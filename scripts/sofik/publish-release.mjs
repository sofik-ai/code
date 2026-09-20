/* Copyright (c) Sofik AI. Licensed under the MIT License. */
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const directory = path.resolve(process.argv[2] ?? '.build/release');
const repository = process.env.GITHUB_REPOSITORY;
const commit = process.env.GITHUB_SHA;
const tag = `v1.138.0-sofik.${process.env.GITHUB_RUN_NUMBER}`;
if (repository !== 'sofik-ai/code' || !/^[0-9a-f]{40}$/.test(commit ?? '') || !/^\d+$/.test(process.env.GITHUB_RUN_NUMBER ?? '')) throw new Error('Release requires the Code CI context.');
const artifacts = {};
const assets = [];
for (const target of ['darwin-arm64', 'linux-x64', 'win32-x64']) {
	const metadata = JSON.parse(await fs.readFile(path.join(directory, `artifact-${target}.json`), 'utf8'));
	if (metadata.sourceCommit !== commit || metadata.target !== target || metadata.filename !== `sofik-code-${target}.tar.gz` || metadata.base !== '1.138.0') throw new Error(`Invalid metadata: ${target}`);
	const archive = path.join(directory, metadata.filename);
	const hash = createHash('sha256');
	for await (const chunk of createReadStream(archive)) hash.update(chunk);
	if (hash.digest('hex') !== metadata.sha256) throw new Error(`Checksum mismatch: ${target}`);
	artifacts[target] = { filename: metadata.filename, sha256: metadata.sha256, size: metadata.size, url: `https://github.com/${repository}/releases/download/${tag}/${metadata.filename}` };
	assets.push(archive, `${archive}.sha256`);
}
const manifest = path.join(directory, 'artifacts.json');
await fs.writeFile(manifest, JSON.stringify({ format: 1, repository, tag, commit, base: '1.138.0', artifacts }, null, 2) + '\n');
const gh = args => execFileSync('gh', args, { stdio: 'inherit' });
// A tag is published only after all native platforms have passed tests.
// Failed publication leaves a draft; a rerun never overwrites a public release.
gh(['release', 'create', tag, ...assets, manifest, '--repo', repository, '--target', commit, '--title', `Sofik Code ${tag}`, '--notes', `Fixed Code OSS 1.138.0 desktop runtime. Source: ${commit}. Native terminal, LSP and ACP included. See artifacts.json for pinned SHA-256 checksums.`, '--draft']);
gh(['release', 'edit', tag, '--repo', repository, '--draft=false', '--latest']);
