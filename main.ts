import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
} from "obsidian";
import {
	ExportedItem,
	fetchItems,
	FetchItemsParams,
	Note,
} from "./src/infoflow-api";
import SyncModal from "./SyncModal";
import { fetchAllItems, convertHtmlToMarkdown } from "./src/utils/infoflow";

interface InfoFlowPluginSettings {
	mySetting: string;
	infoFlowEndpoint: string;
	apiToken: string;
	from?: string;
	to?: string;
	tags?: string[];
	folders?: string[];
	updatedAt?: string;
	// Sync settings
	targetFolder: string;
	fileNameTemplate: string;
	noteTemplate: string;
	syncFrequency: number; // in minutes
	lastSyncTime?: number;
}

const DEFAULT_SETTINGS: InfoFlowPluginSettings = {
	mySetting: "default",
	infoFlowEndpoint: "https://www.infoflow.app",
	apiToken: "",
	from: undefined,
	to: undefined,
	tags: undefined,
	folders: undefined,
	updatedAt: undefined,
	// Default sync settings
	targetFolder: "InfoFlow",
	fileNameTemplate: "{{title}}_{{id}}_{{itemType}}",
	noteTemplate: `---
title: {{title}}
url: {{url}}
item_type: {{itemType}}
author: {{author}}
tags: {{tags}}
created: {{createdAt}}
updated: {{updatedAt}}
---

{{content}}

## Highlights
{{#notes}}
> {{content}}
{{#quotedText}}
Source: {{quotedText}}
{{/quotedText}}
{{/notes}}`,
	syncFrequency: 60,
};

export default class InfoFlowPlugin extends Plugin {
	settings: InfoFlowPluginSettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon(
			"sync",
			"Sync InfoFlow Items",
			async (evt: MouseEvent) => {
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

					syncModal.setProgress("Fetching items...");
					const items = await fetchAllItems(
						this.settings.infoFlowEndpoint,
						this.settings.apiToken,
						params,
						(current, total) => {
							syncModal.setProgress(
								`Fetching items... (${current}/${total} items)`
							);
						}
					);

					syncModal.setProgress("Processing items...");
					await this.syncItems(items);
					syncModal.setProgress("Sync completed successfully.");
				} catch (error) {
					console.error("Error syncing items:", error);
					syncModal.setError(
						"Error syncing items. Please check the console for more details."
					);
				}
			}
		);
		// Perform additional things with the ribbon
		ribbonIconEl.addClass("my-plugin-ribbon-class");

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText("Status Bar Text");

		// This adds a simple command that can be triggered anywhere
		// this.addCommand({
		// 	id: 'open-sample-modal-simple',
		// 	name: 'Open sample modal (simple)',
		// 	callback: () => {
		// 		new SampleModal(this.app).open();
		// 	}
		// });
		// This adds an editor command that can perform some operation on the current editor instance

		// This adds a complex command that can check whether the current state of the app allows execution of the command

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new InfoFlowSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, "click", (evt: MouseEvent) => {
			console.log("click", evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(
			window.setInterval(() => console.log("setInterval"), 5 * 60 * 1000)
		);

		// Add a command to manually trigger the sync process
		this.addCommand({
			id: "sync-infoflow-items",
			name: "Sync Items",
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

					syncModal.setProgress("Fetching items...");
					const items = await fetchAllItems(
						this.settings.infoFlowEndpoint,
						this.settings.apiToken,
						params,
						(current, total) => {
							syncModal.setProgress(
								`Fetching items... (${current}/${total} items)`
							);
						}
					);

					syncModal.setProgress("Processing items...");
					await this.syncItems(items);
					syncModal.setProgress("Sync completed successfully.");
				} catch (error) {
					console.error("Error syncing items:", error);
					syncModal.setError(
						"Error syncing items. Please check the console for more details."
					);
				}
			},
		});
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async syncItemToObsidian(item: ExportedItem) {
		try {
			// Create target folder if it doesn't exist
			const folderPath = this.settings.targetFolder;
			if (!(await this.app.vault.adapter.exists(folderPath))) {
				await this.app.vault.createFolder(folderPath);
			}

			// Generate file name from template
			const fileName =
				this.settings.fileNameTemplate
					.replace("{{title}}", item.title)
					.replace("{{id}}", item.id)
					.replace("{{itemType}}", item.itemType)
					.replace(/[\\/:*?"<>|]/g, "-") + // Replace invalid characters
				".md";

			const filePath = `${folderPath}/${fileName}`;

			// Convert content from HTML to Markdown if needed
			const content = item.content
				? convertHtmlToMarkdown(item.content)
				: "";

			// Generate note content from template
			let noteContent = this.settings.noteTemplate;
			noteContent = noteContent
				.replace("{{title}}", item.title)
				.replace("{{url}}", item.url || "")
				.replace("{{author}}", item.metadata?.author || "")
				.replace("{{tags}}", item.tags.join(", "))
				.replace("{{createdAt}}", item.createdAt)
				.replace("{{itemType}}", item.itemType)
				.replace("{{updatedAt}}", item.updatedAt)
				.replace("{{content}}", content);

			// Process highlights/notes
			let highlightsSection = "";
			if (item.notes && item.notes.length > 0) {
				highlightsSection = item.notes
					.map((note: Note) => {
						let highlight = `> ${note.content}`;
						if (note.quotedText) {
							highlight += `\nSource: ${note.quotedText}`;
						}
						return highlight;
					})
					.join("\n\n");
			}
			noteContent = noteContent.replace(
				"{{#notes}}(.*?){{/notes}}",
				highlightsSection
			);

			// Create or update the file
			const existingFile = this.app.vault.getAbstractFileByPath(filePath);
			if (existingFile instanceof TFile) {
				await this.app.vault.modify(existingFile, noteContent);
			} else {
				await this.app.vault.create(filePath, noteContent);
			}

			// Update last sync time
			this.settings.lastSyncTime = Date.now();
			await this.saveSettings();

			new Notice(`Synced: ${item.title}`);
		} catch (error) {
			console.error("Error syncing item:", error);
			new Notice(`Error syncing: ${item.title}`);
		}
	}

	async syncItems(items: ExportedItem[]) {
		for (const item of items) {
			await this.syncItemToObsidian(item);
		}
	}
}

class InfoFlowSyncModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText("InfoFlow Sync");
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class InfoFlowSettingTab extends PluginSettingTab {
	plugin: InfoFlowPlugin;

	constructor(app: App, plugin: InfoFlowPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		// new Setting(containerEl)
		// 	.setName('Setting #1')
		// 	.setDesc('It\'s a secret')
		// 	.addText(text => text
		// 		.setPlaceholder('Enter your secret')
		// 		.setValue(this.plugin.settings.mySetting)
		// 		.onChange(async (value) => {
		// 			this.plugin.settings.mySetting = value;
		// 			await this.plugin.saveSettings();
		// 			}));

		new Setting(containerEl)
			.setName("InfoFlow Endpoint")
			.setDesc("The endpoint for the InfoFlow API")
			.addText((text) =>
				text
					.setPlaceholder("Enter the InfoFlow endpoint")
					.setValue(this.plugin.settings.infoFlowEndpoint)
					.onChange(async (value) => {
						this.plugin.settings.infoFlowEndpoint = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("API Token")
			.setDesc(createFragment((frag) => {
				frag.appendText("The API token for accessing the InfoFlow API. Can be created at ");
				const link = frag.createEl("a", {
					href: "https://www.infoflow.app/user_portal/external_token",
					text: "https://www.infoflow.app/user_portal/external_token"
				});
				link.setAttr("target", "_blank");
			}))
			.addText((text) =>
				text
					.setPlaceholder("Enter your API token. Sample format: `if_ext_*****`")
					.setValue(this.plugin.settings.apiToken)
					.onChange(async (value) => {
						this.plugin.settings.apiToken = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("From Date")
			.setDesc("Filter items from this date (optional)")
			.addText((text) =>
				text
					.setPlaceholder("Enter the from date")
					.setValue(this.plugin.settings.from || "")
					.onChange(async (value) => {
						this.plugin.settings.from = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("To Date")
			.setDesc("Filter items to this date (optional)")
			.addText((text) =>
				text
					.setPlaceholder("Enter the to date")
					.setValue(this.plugin.settings.to || "")
					.onChange(async (value) => {
						this.plugin.settings.to = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Tags")
			.setDesc("Filter items by tags (optional, comma-separated)")
			.addText((text) =>
				text
					.setPlaceholder("Enter tags")
					.setValue(this.plugin.settings.tags?.join(", ") || "")
					.onChange(async (value) => {
						this.plugin.settings.tags = value
							.split(",")
							.map((tag) => tag.trim());
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Folders")
			.setDesc("Filter items by folders (optional, comma-separated)")
			.addText((text) =>
				text
					.setPlaceholder("Enter folders")
					.setValue(this.plugin.settings.folders?.join(", ") || "")
					.onChange(async (value) => {
						this.plugin.settings.folders = value
							.split(",")
							.map((folder) => folder.trim());
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Updated At")
			.setDesc("Filter items by updated at date (optional)")
			.addText((text) =>
				text
					.setPlaceholder("Enter the updated at date")
					.setValue(this.plugin.settings.updatedAt || "")
					.onChange(async (value) => {
						this.plugin.settings.updatedAt = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Target Folder")
			.setDesc("The target folder for synced items")
			.addText((text) =>
				text
					.setPlaceholder("Enter the target folder")
					.setValue(this.plugin.settings.targetFolder)
					.onChange(async (value) => {
						this.plugin.settings.targetFolder = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("File Name Template")
			.setDesc("The template for generating file names. Parameters available: {{title}}, {{id}}, {{itemType}}")
			.addText((text) =>
				text
					.setPlaceholder("Enter the file name template")
					.setValue(this.plugin.settings.fileNameTemplate)
					.onChange(async (value) => {
						this.plugin.settings.fileNameTemplate = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Note Template")
			.setDesc("The template for generating note content. Parameters available: {{title}}, {{url}}, {{itemType}}, {{author}}, {{tags}}, {{createdAt}}, {{updatedAt}}, {{content}}, {{notes}}")
			.addText((text) =>
				text
					.setPlaceholder("Enter the note template")
					.setValue(this.plugin.settings.noteTemplate)
					.onChange(async (value) => {
						this.plugin.settings.noteTemplate = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Sync Frequency")
			.setDesc("The frequency for syncing items")
			.addText((text) =>
				text
					.setPlaceholder("Enter the sync frequency (in minutes)")
					.setValue(this.plugin.settings.syncFrequency.toString())
					.onChange(async (value) => {
						this.plugin.settings.syncFrequency = parseInt(value);
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Last Sync Time")
			.setDesc("The time of the last sync")
			.addText((text) =>
				text
					.setPlaceholder("Enter the last sync time")
					.setValue(
						this.plugin.settings.lastSyncTime?.toString() || ""
					)
					.onChange(async (value) => {
						this.plugin.settings.lastSyncTime = value
							? parseInt(value)
							: undefined;
						await this.plugin.saveSettings();
					})
			);
	}
}
