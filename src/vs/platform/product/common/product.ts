/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { env } from '../../../base/common/process.js';
import { IProductConfiguration } from '../../../base/common/product.js';
import { ISandboxConfiguration } from '../../../base/parts/sandbox/common/sandboxTypes.js';

interface IPackageConfiguration {
	readonly version: string;
	readonly dependencies?: Readonly<Record<string, string>>;
}

function getDependencyVersion(packageConfiguration: IPackageConfiguration, packageName: string): string | undefined {
	return packageConfiguration.dependencies?.[packageName]?.replace(/^[~^]/, '');
}

/**
 * @deprecated It is preferred that you use `IProductService` if you can. This
 * allows web embedders to override our defaults. But for things like `product.quality`,
 * the use is fine because that property is not overridable.
 */
let product: IProductConfiguration;

// Native sandbox environment
const vscodeGlobal = (globalThis as { vscode?: { context?: { configuration(): ISandboxConfiguration | undefined } } }).vscode;
if (typeof vscodeGlobal !== 'undefined' && typeof vscodeGlobal.context !== 'undefined') {
	const configuration: ISandboxConfiguration | undefined = vscodeGlobal.context.configuration();
	if (configuration) {
		product = configuration.product;
	} else {
		throw new Error('Sandbox: unable to resolve product configuration from preload script.');
	}
}
// _VSCODE environment
else if (globalThis._VSCODE_PRODUCT_JSON && globalThis._VSCODE_PACKAGE_JSON) {
	// Obtain values from product.json and package.json-data
	product = globalThis._VSCODE_PRODUCT_JSON as unknown as IProductConfiguration;
	const packageConfiguration = globalThis._VSCODE_PACKAGE_JSON as unknown as IPackageConfiguration;

	// Running out of sources
	if (env['VSCODE_DEV']) {
		Object.assign(product, {
			nameShort: `${product.nameShort} Dev`,
			nameLong: `${product.nameLong} Dev`,
			dataFolderName: `${product.dataFolderName}-dev`,
			serverDataFolderName: product.serverDataFolderName ? `${product.serverDataFolderName}-dev` : undefined
		});
	}

	// Version is added during built time, but we still
	// want to have it running out of sources so we
	// read it from package.json only when we need it.
	if (!product.version) {
		Object.assign(product, {
			version: packageConfiguration.version
		});
	}

	if (!product.copilotVersions) {
		const runtime = getDependencyVersion(packageConfiguration, '@github/copilot');
		const sdk = getDependencyVersion(packageConfiguration, '@github/copilot-sdk');
		if (runtime && sdk) {
			Object.assign(product, { copilotVersions: { runtime, sdk } });
		}
	}
}

// Web environment or unknown
else {

	// Built time configuration (do NOT modify)
	// eslint-disable-next-line local/code-no-dangerous-type-assertions
	product = { /*BUILD->INSERT_PRODUCT_CONFIGURATION*/ } as unknown as IProductConfiguration;

	// Running out of sources
	if (Object.keys(product).length === 0) {
		Object.assign(product, {
	"nameShort": "Sofik Code",
	"nameLong": "Sofik Code",
	"applicationName": "sofik-code",
	"dataFolderName": ".sofik-code",
	"sharedDataFolderName": ".sofik-code-shared",
	"win32MutexName": "sofikcode",
	"licenseName": "MIT",
	"licenseUrl": "https://github.com/microsoft/vscode/blob/main/LICENSE.txt",
	"serverLicenseUrl": "https://github.com/microsoft/vscode/blob/main/LICENSE.txt",
	"serverGreeting": [],
	"serverLicense": [],
	"serverLicensePrompt": "",
	"serverApplicationName": "sofik-code-server",
	"serverDataFolderName": ".sofik-code-server",
	"tunnelApplicationName": "code-tunnel-oss",
	"win32DirName": "Sofik Code",
	"win32NameVersion": "Sofik Code",
	"win32RegValueName": "SofikCode",
	"win32x64AppId": "{{D77B7E06-80BA-4137-BCF4-654B95CCEBC5}",
	"win32arm64AppId": "{{D1ACE434-89C5-48D1-88D3-E2991DF85475}",
	"win32x64UserAppId": "{{CC6B787D-37A0-49E8-AE24-8559A032BE0C}",
	"win32arm64UserAppId": "{{3AEBF0C8-F733-4AD4-BADE-FDB816D53D7B}",
	"win32AppUserModelId": "Sofik.Code",
	"win32ShellNameShort": "Sofik Code",
	"win32TunnelServiceMutex": "vscodeoss-tunnelservice",
	"win32TunnelMutex": "vscodeoss-tunnel",
	"darwinBundleIdentifier": "ai.sofik.code",
	"darwinProfileUUID": "47827DD9-4734-49A0-AF80-7E19B11495CC",
	"darwinProfilePayloadUUID": "CF808BE7-53F3-46C6-A7E2-7EDB98A5E959",
	"linuxIconName": "sofik-code",
	"licenseFileName": "LICENSE.txt",
	"reportIssueUrl": "https://github.com/sofik-ai/code/issues/new",
	"nodejsArtifactFeed": "",
	"electronArtifactFeed": "",
	"urlProtocol": "sofik-code",
	"builtInExtensions": [],
	"enableTelemetry": false,
	"enableCrashReporter": false,
	"builtInExtensionsEnabledWithAutoUpdates": [],
	"version": "1.138.0"
});
	}
}

export default product;
