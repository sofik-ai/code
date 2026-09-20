/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { existsSync } from 'fs';

/**
 * Complete list of directories where npm should be executed to install node modules
 */
export const dirs = [
	'',
	'build',
	'build/rspack',
	'build/vite',
	'extensions',
	'extensions/configuration-editing',
	'extensions/css-language-features',
	'extensions/css-language-features/server',
	'extensions/emmet',
	'extensions/git',
	'extensions/git-base',
	'extensions/html-language-features',
	'extensions/html-language-features/server',
	'extensions/json-language-features',
	'extensions/json-language-features/server',
	'extensions/markdown-language-features',
	'extensions/media-preview',
	'extensions/merge-conflict',
	'extensions/npm',
	'extensions/php-language-features',
	'extensions/references-view',
	'extensions/search-result',
	'extensions/terminal-suggest',
	'extensions/typescript-language-features',
	'remote',
	'remote/web',
	'test/automation',
	'test/integration/browser',
	'test/monaco',
	'test/smoke',
	'test/scenario',
	'test/mcp',
	'.vscode/extensions/vscode-selfhost-import-aid',
	'.vscode/extensions/vscode-selfhost-test-provider',
	'.vscode/extensions/vscode-extras',
	'.vscode/extensions/vscode-pr-pinger',
];

if (existsSync(`${import.meta.dirname}/../../.build/distro/npm`)) {
	dirs.push('.build/distro/npm');
	dirs.push('.build/distro/npm/remote');
	dirs.push('.build/distro/npm/remote/web');
}
