/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Extensions, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { WorkspaceTrustContext } from '../../workspace/common/workspace.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { SettingsFileSystemProvider } from '../../preferences/common/settingsFilesystemProvider.js';


// JSON language services need schema documents, independently of the settings UI.
class SofikSchemaDocuments extends Disposable {
	static readonly ID = 'sofik.schemaDocuments';
	constructor(@IFileService files: IFileService, @IInstantiationService instantiation: IInstantiationService, @IContextKeyService contextKeys: IContextKeyService) {
		super();
		WorkspaceTrustContext.IsEnabled.bindTo(contextKeys).set(false);
		WorkspaceTrustContext.IsTrusted.bindTo(contextKeys).set(true);
		const provider = this._register(instantiation.createInstance(SettingsFileSystemProvider));
		this._register(files.registerProvider(SettingsFileSystemProvider.SCHEMA, provider));
	}
}
registerWorkbenchContribution2(SofikSchemaDocuments.ID, SofikSchemaDocuments, WorkbenchPhase.BlockStartup);


// Keep the configuration service required by the editor and language engines.
// Product defaults are fixed; the host owns preferences.
Registry.as<IConfigurationRegistry>(Extensions.Configuration).registerDefaultConfigurations([{
	overrides: {
		'workbench.colorTheme': 'GitHub Dark',
		'workbench.preferredDarkColorTheme': 'GitHub Dark',
		'workbench.preferredLightColorTheme': 'GitHub Light',
		'window.autoDetectColorScheme': true,
		'workbench.startupEditor': 'none',
		'workbench.tips.enabled': false,
		'workbench.secondarySideBar.defaultVisibility': 'hidden',
		'window.commandCenter': false,
		'window.menuBarVisibility': 'hidden',
		'workbench.layoutControl.enabled': false,
		'security.workspace.trust.enabled': false,
		'security.workspace.trust.startupPrompt': 'never',
		'chat.disableAIFeatures': true,
		'extensions.ignoreRecommendations': true,
		'extensions.autoCheckUpdates': false,
		'extensions.autoUpdate': false,
		'update.mode': 'none',
		'telemetry.telemetryLevel': 'off',
		'workbench.enableExperiments': false,
		'editor.minimap.enabled': false,
		'editor.fontSize': 14,
		'editor.tabSize': 2,
		'files.autoSave': 'off'
	}
}]);
