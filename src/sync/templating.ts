import Mustache from "mustache";
import type { ExportedItem, Note } from "../infoflow-api";

export type TemplateVersion = 1 | 2;

export interface RenderContext {
  title: string;
  id: string;
  itemType: string;
  url: string;
  author: string;
  tags: string;
  tagsArray: string[];
  createdAt: string;
  updatedAt: string;
  content: string;
  notes: Array<{
    content: string;
    quotedText?: string;
  }>;
}

export function buildRenderContext(item: ExportedItem, markdownContent: string): RenderContext {
  return {
    title: item.title,
    id: item.id,
    itemType: item.itemType,
    url: item.url ?? "",
    author: item.metadata?.author ?? "",
    tags: item.tags.join(", "),
    tagsArray: item.tags,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    content: markdownContent,
    notes: (item.notes ?? []).map((note: Note) => ({
      content: note.content,
      quotedText: note.quotedText,
    })),
  };
}

export function validateTemplate(template: string): { ok: true } | { ok: false; error: string } {
  try {
    // Mustache parse throws on some malformed templates; also helps surface missing tag closures.
    Mustache.parse(template);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function renderTemplate(template: string, view: unknown): string {
  return Mustache.render(template, view);
}

export function sanitizeFileName(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  // Obsidian disallows: \ / : * ? " < > |
  const withoutInvalid = trimmed.replace(/[\\/:*?"<>|]/g, "-");
  // Avoid "." or empty names
  const collapsed = withoutInvalid.replace(/-+/g, "-").replace(/^\.+/, "").trim();
  return collapsed.length ? collapsed : "InfoFlow Item";
}

export function renderFileName(template: string, ctx: RenderContext): string {
  const rendered = renderTemplate(template, ctx);
  return sanitizeFileName(rendered);
}

