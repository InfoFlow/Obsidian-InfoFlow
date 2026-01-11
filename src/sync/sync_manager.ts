import type { App, TFile, Vault } from "obsidian";
import { Notice, normalizePath } from "obsidian";
import type { ExportedItem, FetchItemsParams } from "../infoflow-api";
import { convertHtmlToMarkdown, fetchAllItems } from "../utils/infoflow";
import { buildNewFileContents, getInfoFlowIdFromFrontmatter, isMarkdownFile, upsertManagedBlock } from "./frontmatter";
import { buildRenderContext, renderFileName, renderTemplate, validateTemplate } from "./templating";
import type { StatusBarQueue } from "./status_bar";

export interface SyncRunOutcome {
  status: "success" | "failed";
  atMs: number;
  error?: string;
}

export interface InFlightRunState {
  runId: string;
  startedAtMs: number;
  cursor: string | null;
  processed: number;
}

export interface SyncState {
  lastSuccessfulCursor: string | null;
  inFlightRun: InFlightRunState | null;
  itemPathIndex: Record<string, string>;
  reimportQueue: string[];
  deletedResyncQueue: string[];
  lastRun: SyncRunOutcome | null;
}

export interface SyncSettings {
  infoFlowEndpoint: string;
  apiToken: string;
  targetFolder: string;
  fileNameTemplate: string;
  noteTemplate: string;
  // Optional filters
  from?: string;
  to?: string;
  tags?: string[];
  folders?: string[];
}

export interface SyncManagerDeps {
  app: App;
  vault: Vault;
  status?: StatusBarQueue;
  saveState: (next: SyncState) => Promise<void>;
}

const OVERLAP_MS = 5 * 60 * 1000;

export class SyncManager {
  private readonly app: App;
  private readonly vault: Vault;
  private readonly status?: StatusBarQueue;
  private readonly saveState: (next: SyncState) => Promise<void>;

  constructor(deps: SyncManagerDeps) {
    this.app = deps.app;
    this.vault = deps.vault;
    this.status = deps.status;
    this.saveState = deps.saveState;
  }

  async validateTemplatesOrThrow(fileNameTemplate: string, noteTemplate: string) {
    const fileNameCheck = validateTemplate(fileNameTemplate);
    if (!fileNameCheck.ok) throw new Error(`Invalid file name template: ${fileNameCheck.error}`);

    const noteCheck = validateTemplate(noteTemplate);
    if (!noteCheck.ok) throw new Error(`Invalid note template: ${noteCheck.error}`);
  }

  async findFileByItemId(itemId: string): Promise<TFile | null> {
    const markdownFiles = this.vault.getMarkdownFiles();
    for (const file of markdownFiles) {
      const cache = this.app.metadataCache.getFileCache(file);
      const id = getInfoFlowIdFromFrontmatter(cache);
      if (id === itemId) return file;
    }
    return null;
  }

  private async ensureTargetFolderExists(folderPath: string) {
    if (!(await this.vault.adapter.exists(folderPath))) {
      await this.vault.createFolder(folderPath);
    }
  }

  private async findAvailablePath(desiredPath: string): Promise<string> {
    const existing = this.vault.getAbstractFileByPath(desiredPath);
    if (!existing) return desiredPath;

    for (let i = 1; i <= 50; i++) {
      const candidate = desiredPath.replace(/\.md$/i, ` (${i}).md`);
      if (!this.vault.getAbstractFileByPath(candidate)) return candidate;
    }

    // Last resort: add random suffix.
    return desiredPath.replace(/\.md$/i, ` (${Date.now()}).md`);
  }

  private computeCursorStart(state: SyncState): string | null {
    if (!state.lastSuccessfulCursor) return null;
    const t = Date.parse(state.lastSuccessfulCursor);
    if (Number.isNaN(t)) return state.lastSuccessfulCursor;
    return new Date(Math.max(0, t - OVERLAP_MS)).toISOString();
  }

  private async checkpoint(state: SyncState, processed: number) {
    if (!state.inFlightRun) return;
    if (processed % 10 !== 0) return;
    state.inFlightRun.processed = processed;
    await this.saveState({ ...state, inFlightRun: { ...state.inFlightRun } });
  }

  async sync(state: SyncState, settings: SyncSettings, opts?: { auto?: boolean; resume?: boolean }) {
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const cursorStart = this.computeCursorStart(state);

    await this.validateTemplatesOrThrow(settings.fileNameTemplate, settings.noteTemplate);
    await this.ensureTargetFolderExists(settings.targetFolder);

    const shouldFullReimport = state.reimportQueue.length > 0 || state.deletedResyncQueue.length > 0;
    const forcedIds = new Set([...state.reimportQueue, ...state.deletedResyncQueue]);

    const params: FetchItemsParams = {
      from: settings.from,
      to: settings.to,
      tags: settings.tags,
      folders: settings.folders,
      updatedAt: shouldFullReimport ? undefined : cursorStart ?? undefined,
    };

    const nextState: SyncState = {
      ...state,
      inFlightRun: {
        runId,
        startedAtMs: Date.now(),
        cursor: shouldFullReimport ? null : cursorStart,
        processed: 0,
      },
    };
    await this.saveState(nextState);

    const statusMsg = opts?.auto ? "Auto sync started" : "Sync started";
    this.status?.enqueue(statusMsg, 2, true);

    let items: ExportedItem[] = [];
    try {
      items = await fetchAllItems(settings.infoFlowEndpoint, settings.apiToken, params);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await this.failRun(nextState, msg);
      throw error;
    }

    const filteredItems = forcedIds.size ? items.filter((i) => forcedIds.has(i.id)) : items;

    let processed = 0;
    let maxUpdatedAtMs = 0;

    for (const item of filteredItems) {
      processed++;
      const updatedAtMs = Date.parse(item.updatedAt);
      if (!Number.isNaN(updatedAtMs)) maxUpdatedAtMs = Math.max(maxUpdatedAtMs, updatedAtMs);

      await this.upsertItem(nextState, settings, item);
      await this.checkpoint(nextState, processed);

      if (processed % 25 === 0) {
        this.status?.enqueue(`Synced ${processed}/${filteredItems.length}`, 2);
      }
    }

    const newCursor = maxUpdatedAtMs ? new Date(maxUpdatedAtMs).toISOString() : state.lastSuccessfulCursor;
    const finalState: SyncState = {
      ...nextState,
      lastSuccessfulCursor: shouldFullReimport ? state.lastSuccessfulCursor : newCursor ?? state.lastSuccessfulCursor,
      inFlightRun: null,
      reimportQueue: [],
      deletedResyncQueue: [],
      lastRun: { status: "success", atMs: Date.now() },
    };
    await this.saveState(finalState);
    this.status?.enqueue("Sync complete", 3, true);
    new Notice("InfoFlow sync completed");
  }

  private async failRun(state: SyncState, errorMessage: string) {
    const failed: SyncState = {
      ...state,
      inFlightRun: null,
      lastRun: { status: "failed", atMs: Date.now(), error: errorMessage },
    };
    await this.saveState(failed);
    this.status?.enqueue(`Sync failed: ${errorMessage}`, 5, true);
    new Notice(`InfoFlow sync failed: ${errorMessage}`);
  }

  private async upsertItem(state: SyncState, settings: SyncSettings, item: ExportedItem) {
    const markdownContent = item.content ? convertHtmlToMarkdown(item.content) : "";
    const ctx = buildRenderContext(item, markdownContent);

    const baseName = renderFileName(settings.fileNameTemplate, ctx);
    const desiredPath = normalizePath(`${settings.targetFolder}/${baseName}.md`);

    let existingPath: string | null = state.itemPathIndex[item.id] ?? null;
    let file: TFile | null = null;

    if (existingPath) {
      const existing = this.vault.getAbstractFileByPath(existingPath);
      if (isMarkdownFile(existing)) {
        const cache = this.app.metadataCache.getFileCache(existing);
        const id = getInfoFlowIdFromFrontmatter(cache);
        if (id === item.id) {
          file = existing;
        } else {
          // Stale/colliding index entry.
          existingPath = null;
        }
      } else {
        existingPath = null;
      }
    }

    if (!file) {
      // Cache miss: attempt reconciliation by scanning frontmatter ID.
      const byId = await this.findFileByItemId(item.id);
      if (byId) {
        file = byId;
        existingPath = byId.path;
        state.itemPathIndex[item.id] = byId.path;
      }
    }

    const renderedBody = renderTemplate(settings.noteTemplate, ctx);

    if (!file) {
      const contents = buildNewFileContents(item, renderedBody);
      const targetPath = await this.findAvailablePath(desiredPath);
      await this.vault.create(targetPath, contents);
      state.itemPathIndex[item.id] = targetPath;
      return;
    }

    // If template path changed, prefer moving the managed file to match (without overwriting).
    if (file.path !== desiredPath) {
      const destinationExists = this.vault.getAbstractFileByPath(desiredPath);
      if (!destinationExists) {
        await this.vault.rename(file, desiredPath);
        state.itemPathIndex[item.id] = desiredPath;
        file = this.vault.getAbstractFileByPath(desiredPath) as TFile;
      } else {
        // If destination already exists, keep current path to avoid collisions.
        state.itemPathIndex[item.id] = file.path;
      }
    }

    const existingText = await this.vault.read(file);
    const nextText = upsertManagedBlock(existingText, renderedBody.trim());
    if (nextText !== existingText) {
      await this.vault.modify(file, nextText);
    }
  }
}
