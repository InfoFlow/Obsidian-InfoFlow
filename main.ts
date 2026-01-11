import {
	App,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
} from "obsidian";
import { StatusBarQueue } from "./src/sync/status_bar";
import { SyncManager, SyncState } from "./src/sync/sync_manager";
import { getInfoFlowIdFromFrontmatter, INFOFLOW_ID_FRONTMATTER_KEY } from "./src/sync/frontmatter";
import { validateTemplate } from "./src/sync/templating";

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
	syncFrequency: number; // in minutes (0 = manual)
	syncOnLoad: boolean;
	syncDeletedFiles: boolean;
	showRibbonIcon: boolean;
	lastSyncTime?: number;

	// New sync state (v2)
	syncState: SyncState;
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
	noteTemplate: `# {{title}}

{{#url}}
Source: {{url}}
{{/url}}

{{{content}}}

## Highlights
{{#notes}}
> {{content}}
{{#quotedText}}

Source: {{quotedText}}
{{/quotedText}}

{{/notes}}
`,
	syncFrequency: 60,
	syncOnLoad: true,
	syncDeletedFiles: false,
	showRibbonIcon: true,
	syncState: {
		lastSuccessfulCursor: null,
		inFlightRun: null,
		itemPathIndex: {},
		reimportQueue: [],
		deletedResyncQueue: [],
		lastRun: null,
	},
};

export default class InfoFlowPlugin extends Plugin {
	settings: InfoFlowPluginSettings;
	private statusBar?: StatusBarQueue;
	private statusBarIntervalId: number | null = null;
	private scheduleIntervalId: number | null = null;
	private syncManager?: SyncManager;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new InfoFlowSettingTab(this.app, this));

		this.statusBar = new StatusBarQueue(this.addStatusBarItem());
		this.statusBarIntervalId = window.setInterval(() => this.statusBar?.tick(), 250);
		this.syncManager = new SyncManager({
			app: this.app,
			vault: this.app.vault,
			status: this.statusBar,
			saveState: async (nextState) => {
				this.settings.syncState = nextState;
				this.settings.lastSyncTime = Date.now();
				await this.saveSettings();
			},
		});

		this.configureSchedule();

		if (this.settings.showRibbonIcon) {
			const ribbonIconEl = this.addRibbonIcon("cloud", "Sync InfoFlow items", async () => {
				try {
					new Notice("Starting InfoFlow sync...");
					await this.runSync({ auto: false });
				} catch (error) {
					console.error("Error syncing items:", error);
					new Notice(`InfoFlow sync failed: ${error instanceof Error ? error.message : String(error)}`);
				}
			});
			ribbonIconEl.addClass("infoflow-ribbon-icon");
		}

		// Add a command to manually trigger the sync process
		this.addCommand({
			id: "sync-infoflow-items",
			name: "Sync items",
			callback: async () => {
				try {
					new Notice("Starting InfoFlow sync...");
					await this.runSync({ auto: false });
				} catch (error) {
					console.error("Error syncing items:", error);
					new Notice(`InfoFlow sync failed: ${error instanceof Error ? error.message : String(error)}`);
				}
			},
		});

		this.addCommand({
			id: "infoflow-reimport-active-file",
			name: "Delete and reimport this document",
			callback: async () => {
				const active = this.app.workspace.getActiveFile();
				if (!active) {
					new Notice("No active file");
					return;
				}
				const cache = this.app.metadataCache.getFileCache(active);
				const id = getInfoFlowIdFromFrontmatter(cache);
				if (!id) {
					new Notice(`Missing ${INFOFLOW_ID_FRONTMATTER_KEY} in frontmatter`);
					return;
				}

				// Explicit user action: allow full reimport fetch but filter to this ID.
				this.settings.syncState.reimportQueue = Array.from(new Set([...this.settings.syncState.reimportQueue, id]));
				await this.saveSettings();

				await this.app.vault.delete(active);
				await this.runSync({ auto: false });
			},
		});

		this.registerEvent(
			this.app.vault.on("rename", async (file, oldPath) => {
				if (!(file instanceof TFile)) return;
				const cache = this.app.metadataCache.getFileCache(file);
				const id = getInfoFlowIdFromFrontmatter(cache);
				if (!id) return;
				if (this.settings.syncState.itemPathIndex[id] === oldPath) {
					this.settings.syncState.itemPathIndex[id] = file.path;
					await this.saveSettings();
				}
			})
		);

		this.registerEvent(
			this.app.vault.on("delete", async (file) => {
				if (!(file instanceof TFile)) return;
				const cache = this.app.metadataCache.getFileCache(file);
				let id = getInfoFlowIdFromFrontmatter(cache);
				if (!id) {
					const entry = Object.entries(this.settings.syncState.itemPathIndex).find(
						([, path]) => path === file.path
					);
					if (entry) id = entry[0];
				}
				if (!id) return;
				if (!this.settings.syncDeletedFiles) return;

				this.settings.syncState.deletedResyncQueue = Array.from(
					new Set([...this.settings.syncState.deletedResyncQueue, id])
				);
				await this.saveSettings();
			})
		);

		this.app.workspace.onLayoutReady(async () => {
			if (this.settings.syncOnLoad) {
				await this.runSync({ auto: true });
			}
		});
	}

	onunload() {
		if (this.statusBarIntervalId) window.clearInterval(this.statusBarIntervalId);
		if (this.scheduleIntervalId) window.clearInterval(this.scheduleIntervalId);
	}

	async loadSettings() {
		const loaded = (await this.loadData()) as Partial<InfoFlowPluginSettings> | null;
		const merged = Object.assign({}, DEFAULT_SETTINGS, loaded ?? {});

		// Backfill new state fields for older installs.
		if (!merged.syncState) {
			merged.syncState = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.syncState)) as SyncState;
		}
		if (merged.syncOnLoad === undefined) merged.syncOnLoad = DEFAULT_SETTINGS.syncOnLoad;
		if (merged.syncDeletedFiles === undefined) merged.syncDeletedFiles = DEFAULT_SETTINGS.syncDeletedFiles;
		if (merged.showRibbonIcon === undefined) merged.showRibbonIcon = DEFAULT_SETTINGS.showRibbonIcon;
		if (merged.syncFrequency === undefined) merged.syncFrequency = DEFAULT_SETTINGS.syncFrequency;

		// Legacy key: keep supporting `updatedAt` filter, but cursor lives in syncState.
		this.settings = merged;
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private isSyncing(): boolean {
		const inflight = this.settings.syncState.inFlightRun;
		if (!inflight) return false;
		// Treat very old locks as crashes.
		return Date.now() - inflight.startedAtMs < 10 * 60 * 1000;
	}

	private async runSync(opts: { auto: boolean }) {
		if (!this.syncManager) throw new Error("Sync manager not initialized");
		if (!this.settings.apiToken) {
			new Notice("InfoFlow API token missing");
			return;
		}
		if (this.isSyncing()) {
			new Notice("InfoFlow sync already in progress");
			return;
		}

		// Clear orphaned lock if present.
		if (this.settings.syncState.inFlightRun) {
			this.settings.syncState.inFlightRun = null;
			await this.saveSettings();
		}

		await this.syncManager.sync(this.settings.syncState, {
			infoFlowEndpoint: this.settings.infoFlowEndpoint || "https://www.infoflow.app",
			apiToken: this.settings.apiToken,
			targetFolder: this.settings.targetFolder,
			fileNameTemplate: this.settings.fileNameTemplate,
			noteTemplate: this.settings.noteTemplate,
			from: this.settings.from,
			to: this.settings.to,
			tags: this.settings.tags,
			folders: this.settings.folders,
		}, { auto: opts.auto });
	}

	public configureSchedule() {
		if (this.scheduleIntervalId) {
			window.clearInterval(this.scheduleIntervalId);
			this.scheduleIntervalId = null;
		}
		const minutes = Number(this.settings.syncFrequency);
		if (!Number.isFinite(minutes) || minutes <= 0) return;

		const ms = minutes * 60 * 1000;
		this.scheduleIntervalId = window.setInterval(() => {
			this.runSync({ auto: true }).catch((e) => console.error("Auto sync error:", e));
		}, ms);
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

		containerEl.createEl("h2", { text: "InfoFlow Sync" });

		const lastRun = this.plugin.settings.syncState.lastRun;
		if (lastRun) {
			const statusText =
				lastRun.status === "success"
					? `Last sync: success (${new Date(lastRun.atMs).toLocaleString()})`
					: `Last sync: failed (${new Date(lastRun.atMs).toLocaleString()}): ${lastRun.error ?? ""}`;
			containerEl.createEl("p", { text: statusText });
		}

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
						const check = validateTemplate(value);
						if (!check.ok) {
							new Notice(`Invalid file name template: ${check.error}`);
							return;
						}
						this.plugin.settings.fileNameTemplate = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Note Template")
			.setDesc("Mustache template. Supports sections like {{#notes}}...{{/notes}} and {{{content}}} for raw markdown.")
			.addText((text) =>
				text
					.setPlaceholder("Enter the note template")
					.setValue(this.plugin.settings.noteTemplate)
					.onChange(async (value) => {
						const check = validateTemplate(value);
						if (!check.ok) {
							new Notice(`Invalid note template: ${check.error}`);
							return;
						}
						this.plugin.settings.noteTemplate = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Sync Frequency")
			.setDesc("Minutes between automatic sync runs while Obsidian is open. Use 0 for Manual.")
			.addText((text) =>
				text
					.setPlaceholder("Enter the sync frequency (in minutes)")
					.setValue(this.plugin.settings.syncFrequency.toString())
					.onChange(async (value) => {
						this.plugin.settings.syncFrequency = parseInt(value);
						await this.plugin.saveSettings();
						this.plugin.configureSchedule();
					})
			);

		new Setting(containerEl)
			.setName("Sync automatically when Obsidian opens")
			.setDesc("If enabled, the plugin will sync once when Obsidian finishes loading.")
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.syncOnLoad);
				toggle.onChange(async (val) => {
					this.plugin.settings.syncOnLoad = val;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Show ribbon icon")
			.setDesc("If enabled, adds an InfoFlow sync icon to the left ribbon.")
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.showRibbonIcon);
				toggle.onChange(async (val) => {
					this.plugin.settings.showRibbonIcon = val;
					await this.plugin.saveSettings();
					new Notice("Restart Obsidian to apply ribbon icon changes");
				});
			});

		new Setting(containerEl)
			.setName("Resync deleted files")
			.setDesc("If enabled, deleting a synced file queues that item for reimport on next sync.")
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.syncDeletedFiles);
				toggle.onChange(async (val) => {
					this.plugin.settings.syncDeletedFiles = val;
					await this.plugin.saveSettings();
				});
			});

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
