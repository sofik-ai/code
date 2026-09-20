/* Copyright (c) Microsoft Corporation. Licensed under the MIT License. */
import { lstat, realpath } from 'node:fs/promises';
import path from 'node:path';

export function parseConfig(text) {
	const value = JSON.parse(text);
	if (!value || typeof value !== 'object' || Array.isArray(value)) { throw new Error('Expected a configuration object.'); }
	const command = entry => {
		if (!entry || typeof entry.command !== 'string' || !entry.command.trim() || !Array.isArray(entry.args) || entry.args.some(arg => typeof arg !== 'string')) {
			throw new Error('Each process needs a command and an array of string arguments.');
		}
		return { command: entry.command, args: entry.args };
	};
	if (value.languageServers !== undefined && !Array.isArray(value.languageServers)) { throw new Error('languageServers must be an array.'); }
	const ids = new Set();
	return {
		agent: value.agent ? command(value.agent) : undefined,
		languageServers: (value.languageServers ?? []).map(server => {
			if (typeof server.id !== 'string' || !/^[a-z][a-z0-9-]*$/i.test(server.id) || ids.has(server.id)) { throw new Error('Language server IDs must be unique identifiers.'); }
			ids.add(server.id);
			if (!Array.isArray(server.languages) || !server.languages.length || server.languages.some(language => typeof language !== 'string' || !language)) { throw new Error('Language servers need language IDs.'); }
			return { ...command(server), id: server.id, languages: server.languages };
		})
	};
}

// Agent file callbacks cannot escape the selected workspace through traversal or symlinks.
export async function workspacePath(root, candidate) {
	if (!path.isAbsolute(candidate)) { throw new Error('ACP file paths must be absolute.'); }
	const canonicalRoot = await realpath(root);
	let canonical;
	try { canonical = await realpath(candidate); }
	catch (error) {
		if (error.code !== 'ENOENT') { throw error; }
		try {
			if ((await lstat(candidate)).isSymbolicLink()) { throw new Error('Unresolved symbolic link.'); }
		} catch (statError) { if (statError.code !== 'ENOENT') { throw statError; } }
		canonical = path.join(await realpath(path.dirname(candidate)), path.basename(candidate));
	}
	const relative = path.relative(canonicalRoot, canonical);
	if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) { throw new Error('The file is outside the agent workspace.'); }
	return canonical;
}
