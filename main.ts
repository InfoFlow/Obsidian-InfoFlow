import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { fetchItems, FetchItemsParams } from './src/infoflow-api';
import SyncModal from './SyncModal';

interface MyPluginSettings {
	mySetting: string;
	infoFlowEndpoint: string;
	apiToken: string;
	from?: string;
	to?: string;
	tags?: string[];
	folders?: string[];
	updatedAt?: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default',
	infoFlowEndpoint: 'https://www.infoflow.app',
	apiToken: '',
	from: undefined,
	to: undefined,
	tags: undefined,
	folders: undefined,
	updatedAt: undefined
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('This is a notice!');
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));

		// Add a command to manually trigger the sync process
		this.addCommand({
			id: 'sync-infoflow-items',
			name: 'Sync InfoFlow Items',
			callback: async () => {
				const syncModal = new SyncModal(this.app);
				syncModal.open();

				try {
					const params: FetchItemsParams = {
						from: this.settings.from,
						to: this.settings.to,
						tags: this.settings.tags,
						folders: this.settings.folders,
						updatedAt: this.settings.updatedAt,
					};
					const response = await fetchItems(this.settings.infoFlowEndpoint, this.settings.apiToken, params);
					// Process the response and sync items into Obsidian
					console.log('Fetched items:', response.items);
					syncModal.setProgress('Sync completed successfully.');
				} catch (error) {
					console.error('Error syncing items:', error);
					syncModal.setError('Error syncing items. Please check the console for more details.');
				}
			}
		});
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
					}));

		new Setting(containerEl)
			.setName('InfoFlow Endpoint')
			.setDesc('The endpoint for the InfoFlow API')
			.addText(text => text
				.setPlaceholder('Enter the InfoFlow endpoint')
				.setValue(this.plugin.settings.infoFlowEndpoint)
				.onChange(async (value) => {
					this.plugin.settings.infoFlowEndpoint = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('API Token')
			.setDesc('The API token for accessing the InfoFlow API')
			.addText(text => text
				.setPlaceholder('Enter your API token')
				.setValue(this.plugin.settings.apiToken)
				.onChange(async (value) => {
					this.plugin.settings.apiToken = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('From Date')
			.setDesc('Filter items from this date (optional)')
			.addText(text => text
				.setPlaceholder('Enter the from date')
				.setValue(this.plugin.settings.from || '')
				.onChange(async (value) => {
					this.plugin.settings.from = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('To Date')
			.setDesc('Filter items to this date (optional)')
			.addText(text => text
				.setPlaceholder('Enter the to date')
				.setValue(this.plugin.settings.to || '')
				.onChange(async (value) => {
					this.plugin.settings.to = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Tags')
			.setDesc('Filter items by tags (optional, comma-separated)')
			.addText(text => text
				.setPlaceholder('Enter tags')
				.setValue(this.plugin.settings.tags?.join(', ') || '')
				.onChange(async (value) => {
					this.plugin.settings.tags = value.split(',').map(tag => tag.trim());
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Folders')
			.setDesc('Filter items by folders (optional, comma-separated)')
			.addText(text => text
				.setPlaceholder('Enter folders')
				.setValue(this.plugin.settings.folders?.join(', ') || '')
				.onChange(async (value) => {
					this.plugin.settings.folders = value.split(',').map(folder => folder.trim());
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Updated At')
			.setDesc('Filter items by updated at date (optional)')
			.addText(text => text
				.setPlaceholder('Enter the updated at date')
				.setValue(this.plugin.settings.updatedAt || '')
				.onChange(async (value) => {
					this.plugin.settings.updatedAt = value;
					await this.plugin.saveSettings();
				}));
	}
}
