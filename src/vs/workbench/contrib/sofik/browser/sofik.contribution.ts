/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IConfigurationService, ConfigurationTarget } from '../../../../platform/configuration/common/configuration.js';
import { Extensions, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { KeyMod, KeyCode } from '../../../../base/common/keyCodes.js';
import { KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { SettingsFileSystemProvider } from '../../preferences/common/settingsFilesystemProvider.js';
import { ExtensionEnablementWorkspaceTrustTransitionParticipant } from '../../extensions/browser/extensionEnablementWorkspaceTrustTransitionParticipant.js';

// Built-in language modules and ACP must activate when a user trusts a project.
registerWorkbenchContribution2('sofik.workspaceTrustLanguages', ExtensionEnablementWorkspaceTrustTransitionParticipant, WorkbenchPhase.AfterRestored);

// JSON language services need schema documents, independently of the settings UI.
class SofikSchemaDocuments extends Disposable {
	static readonly ID = 'sofik.schemaDocuments';
	constructor(@IFileService files: IFileService, @IInstantiationService instantiation: IInstantiationService) {
		super();
		const provider = this._register(instantiation.createInstance(SettingsFileSystemProvider));
		this._register(files.registerProvider(SettingsFileSystemProvider.SCHEMA, provider));
	}
}
registerWorkbenchContribution2(SofikSchemaDocuments.ID, SofikSchemaDocuments, WorkbenchPhase.BlockStartup);


// Keep the configuration service required by the editor and language engines.
// Sofik exposes only these preferences, without the upstream settings editor.
Registry.as<IConfigurationRegistry>(Extensions.Configuration).registerDefaultConfigurations([{
	overrides: {
		'workbench.colorTheme': 'GitHub Dark',
		'workbench.preferredDarkColorTheme': 'GitHub Dark',
		'workbench.preferredLightColorTheme': 'GitHub Light',
		'window.autoDetectColorScheme': true,
		'workbench.startupEditor': 'none',
		'workbench.tips.enabled': false,
		'workbench.secondarySideBar.defaultVisibility': 'hidden',
		'workbench.commandCenter': false,
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

registerAction2(class SofikPreferences extends Action2 {
	constructor() {
		super({
			id: 'workbench.action.openSettings',
			title: localize2('sofik.preferences', "Preferences"),
			f1: true,
			menu: [{ id: MenuId.GlobalActivity, group: '2_configuration', order: 1 }, { id: MenuId.MenubarPreferencesMenu, group: '1_settings', order: 1 }],
			keybinding: { primary: KeyMod.CtrlCmd | KeyCode.Comma, weight: KeybindingWeight.WorkbenchContrib }
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const quick = accessor.get(IQuickInputService);
		const configuration = accessor.get(IConfigurationService);
		const options = [
			{ label: localize('sofik.theme', "Theme"), key: 'workbench.colorTheme', values: ['GitHub Dark', 'GitHub Light'] },
			{ label: localize('sofik.font', "Font Size"), key: 'editor.fontSize', values: [12, 13, 14, 15, 16, 18, 20] },
			{ label: localize('sofik.tab', "Indentation"), key: 'editor.tabSize', values: [2, 4, 8] },
			{ label: localize('sofik.wrap', "Word Wrap"), key: 'editor.wordWrap', values: ['off', 'on'] },
			{ label: localize('sofik.save', "Auto Save"), key: 'files.autoSave', values: ['off', 'afterDelay', 'onFocusChange'] }
		];
		const selected = await quick.pick(options.map(option => ({ ...option, description: String(configuration.getValue(option.key)) })), { placeHolder: localize('sofik.preferences', "Preferences") });
		if (!selected) { return; }
		const value = await quick.pick(selected.values.map(value => ({ label: String(value), value })), { placeHolder: selected.label });
		if (!value) { return; }
		if (selected.key === 'workbench.colorTheme') {
			await configuration.updateValue('window.autoDetectColorScheme', false, ConfigurationTarget.USER);
		}
		await configuration.updateValue(selected.key, value.value, ConfigurationTarget.USER);
	}
});
