import type { CachedMetadata, TFile } from "obsidian";
import type { ExportedItem } from "../infoflow-api";

export const INFOFLOW_ID_FRONTMATTER_KEY = "infoflow_id" as const;
export const INFOFLOW_MANAGED_START = "<!-- INFOFLOW:START -->" as const;
export const INFOFLOW_MANAGED_END = "<!-- INFOFLOW:END -->" as const;

export function getInfoFlowIdFromFrontmatter(cache: CachedMetadata | null | undefined): string | null {
  const id = cache?.frontmatter?.[INFOFLOW_ID_FRONTMATTER_KEY];
  return typeof id === "string" && id.length ? id : null;
}

export function buildFrontmatter(item: ExportedItem): string {
  const tags = item.tags?.length ? `[${item.tags.map((t) => JSON.stringify(t)).join(", ")}]` : "[]";
  const safe = (value: string) => JSON.stringify(value ?? "");
  return [
    "---",
    `${INFOFLOW_ID_FRONTMATTER_KEY}: ${safe(item.id)}`,
    `title: ${safe(item.title)}`,
    `url: ${safe(item.url ?? "")}`,
    `item_type: ${safe(item.itemType)}`,
    `author: ${safe(item.metadata?.author ?? "")}`,
    `tags: ${tags}`,
    `created: ${safe(item.createdAt)}`,
    `updated: ${safe(item.updatedAt)}`,
    "---",
  ].join("\n");
}

export function upsertManagedBlock(existing: string, managedBody: string): string {
  const startIdx = existing.indexOf(INFOFLOW_MANAGED_START);
  const endIdx = existing.indexOf(INFOFLOW_MANAGED_END);
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = existing.slice(0, startIdx + INFOFLOW_MANAGED_START.length);
    const after = existing.slice(endIdx);
    return `${before}\n\n${managedBody}\n\n${after}`;
  }

  return `${existing.trimEnd()}\n\n${INFOFLOW_MANAGED_START}\n\n${managedBody}\n\n${INFOFLOW_MANAGED_END}\n`;
}

export function buildNewFileContents(item: ExportedItem, renderedBody: string): string {
  return `${buildFrontmatter(item)}\n\n${INFOFLOW_MANAGED_START}\n\n${renderedBody.trim()}\n\n${INFOFLOW_MANAGED_END}\n`;
}

export function isMarkdownFile(file: unknown): file is TFile {
  return !!file && typeof (file as TFile).path === "string" && (file as TFile).extension === "md";
}

