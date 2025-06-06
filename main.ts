import {
	App,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
} from "obsidian";
import {
	ExportedItem,
	FetchItemsParams,
	Note,
	fetchDeletedItemIds,
} from "./src/infoflow-api";
import SyncModal from "./SyncModal";
import { fetchAllItems, convertHtmlToMarkdown } from "./src/utils/infoflow";

interface InfoFlowPluginSettings {
	infoFlowEndpoint?: string;
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
	deleteActionForSyncedNotes: "trash" | "permanent" | "nothing";
	lastSyncTime?: number;
}

const DEFAULT_SETTINGS: InfoFlowPluginSettings = {
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
infoflow_id: {{id}}
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
	deleteActionForSyncedNotes: "trash",
};

export default class InfoFlowPlugin extends Plugin {
	settings: InfoFlowPluginSettings;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new InfoFlowSettingTab(this.app, this));

		// Add a command to manually trigger the sync process
		this.addCommand({
			id: "sync-infoflow-items",
			name: "Sync items",
			callback: async () => {
				const syncModal = new SyncModal(this.app);
				syncModal.open();

				try {
					const lastSyncTimeSeconds = this.settings.lastSyncTime ? Math.floor(this.settings.lastSyncTime / 1000) : undefined;
					let fetchParams: FetchItemsParams = {
						from: this.settings.from,
						to: this.settings.to,
						tags: this.settings.tags,
						folders: this.settings.folders,
						updatedAt: this.settings.updatedAt,
					};

					if (lastSyncTimeSeconds) {
						fetchParams = {
							last_synced_at: lastSyncTimeSeconds,
							tags: this.settings.tags,
							folders: this.settings.folders,
						};
						syncModal.setProgress("Fetching updated items since last sync...");
					} else {
						syncModal.setProgress("Fetching all items (full sync)...");
					}

					const items = await fetchAllItems(
						this.settings.infoFlowEndpoint || "https://www.infoflow.app",
						this.settings.apiToken,
						fetchParams,
						(current, total) => {
							syncModal.setProgress(
								`Fetching items... (${current}/${total} items)`
							);
						}
					);

					syncModal.setProgress("Processing items...");
					await this.syncItems(items);

					if (lastSyncTimeSeconds) {
						syncModal.setProgress("Fetching deleted item IDs...");
						try {
							const deletedItemIds = await fetchDeletedItemIds(
								this.settings.infoFlowEndpoint || "https://www.infoflow.app",
								this.settings.apiToken,
								lastSyncTimeSeconds
							);

							if (deletedItemIds && deletedItemIds.length > 0) {
								syncModal.setProgress(`Processing ${deletedItemIds.length} deleted items...`);
								await this.deleteObsidianNotes(deletedItemIds);
							}
						} catch (deleteError) {
							console.error("Error fetching or processing deleted items:", deleteError);
							syncModal.setError(`Error processing deletions: ${deleteError.message || deleteError}`);
						}
					}

					this.settings.lastSyncTime = Date.now();
					await this.saveSettings();
					syncModal.setProgress("Sync completed successfully.");
				} catch (error) {
					console.error("Error syncing items:", error);
					syncModal.setError(
						`Error syncing items: ${error}`
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
				.replace("{{id}}", item.id)
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

	async deleteObsidianNotes(deletedItemIds: string[]) {
		if (!deletedItemIds || deletedItemIds.length === 0) {
			return;
		}
		new Notice(`Attempting to process ${deletedItemIds.length} deleted item IDs.`);
		const targetFolderPath = this.settings.targetFolder;
		const files = this.app.vault.getMarkdownFiles();
		let deletedCount = 0;
		const remainingIdsToDelete = [...deletedItemIds];

		for (const file of files) {
			if (remainingIdsToDelete.length === 0) break;

			if (file.path.startsWith(targetFolderPath + "/")) {
				const fileCache = this.app.metadataCache.getFileCache(file);
				const frontmatter = fileCache?.frontmatter;

				if (frontmatter && frontmatter.infoflow_id) {
					const noteId = String(frontmatter.infoflow_id);
					const index = remainingIdsToDelete.indexOf(noteId);
					if (index > -1) {
						const deleteAction = this.settings.deleteActionForSyncedNotes;
						if (deleteAction === "nothing") {
							new Notice(`Skipped deletion for note (ID: ${noteId}) as per settings: ${file.name}`);
							remainingIdsToDelete.splice(index, 1);
							continue;
						}

						try {
							if (deleteAction === "trash") {
								await this.app.vault.trash(file, true);
								new Notice(`Moved to trash: ${file.name} (ID: ${noteId})`);
							} else {
								await this.app.vault.delete(file);
								new Notice(`Permanently deleted: ${file.name} (ID: ${noteId})`);
							}
							deletedCount++;
							remainingIdsToDelete.splice(index, 1);
						} catch (e) {
							new Notice(`Error processing deletion for ${file.name} (Action: ${deleteAction}): ${e.message}`);
							console.error(`Error processing deletion for file ${file.path} (Action: ${deleteAction}):`, e);
						}
					}
				}
			}
		}

		if (deletedCount > 0) {
			new Notice(`Successfully processed ${deletedCount} notes for deletion/trashing based on InfoFlow IDs.`);
		}
		if (remainingIdsToDelete.length > 0) {
			const unprocessedMessage = this.settings.deleteActionForSyncedNotes === "nothing"
				? `${remainingIdsToDelete.length} notes were kept as per settings.`
				: `${remainingIdsToDelete.length} IDs were not found or couldn't be deleted/trashed.`;
			new Notice(unprocessedMessage);
			if (this.settings.deleteActionForSyncedNotes !== "nothing") {
				console.warn("Could not delete/trash notes for IDs:", remainingIdsToDelete);
			}
		} else if (deletedCount === 0 && deletedItemIds.length > 0 && this.settings.deleteActionForSyncedNotes !== "nothing") {
			new Notice("No notes matched the IDs for deletion/trashing in the target folder.");
		} else if (deletedItemIds.length === 0) {
			new Notice("No deleted item IDs to process.");
		}
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

		new Setting(containerEl)
			.setName("InfoFlow Endpoint")
			.setDesc("The endpoint for the InfoFlow API")
			.addText((text) =>
				text
					.setPlaceholder("Enter the InfoFlow endpoint")
					.setValue(this.plugin.settings.infoFlowEndpoint || "https://www.infoflow.app")
					.onChange(async (value) => {
						this.plugin.settings.infoFlowEndpoint = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Action for Deleted Notes in InfoFlow")
			.setDesc("What to do with a synced note in Obsidian when its corresponding item is deleted in InfoFlow.")
			.addDropdown(dropdown => dropdown
				.addOption("nothing", "Do Nothing (Keep Note)")
				.addOption("trash", "Move to Obsidian Trash")
				.addOption("permanent", "Permanently Delete Note")
				.setValue(this.plugin.settings.deleteActionForSyncedNotes)
				.onChange(async (value: "trash" | "permanent" | "nothing") => {
					this.plugin.settings.deleteActionForSyncedNotes = value;
					await this.plugin.saveSettings();
				}));

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

		const lastSyncTimeSetting = new Setting(containerEl)
            .setName("Last Sync Time")
            .setDesc("The date and time of the last successful synchronization. This value is updated automatically by the plugin.");

        const lastSyncValue = this.plugin.settings.lastSyncTime
            ? new Date(this.plugin.settings.lastSyncTime).toLocaleString()
            : "Not synced yet";

        lastSyncTimeSetting.addText(text => text.setValue(lastSyncValue).setDisabled(true));
	}
}
