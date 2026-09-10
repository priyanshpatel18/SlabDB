"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { FileText, Pencil, WrapText } from "lucide-react";
import { TEXT_MAX_BYTES } from "slabdb";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { CommitDialog } from "@/components/commit-dialog";
import { DocsProse } from "@/components/docs-prose";
import { isMarkdownPath, formatBytes, utf8Bytes } from "@/lib/files";
import { suggestedCommitMessage } from "@/lib/history";

function lineCount(text: string): number {
  return Math.max(1, text.split("\n").length);
}

export function RepoFile({
  label,
  path,
  source,
  canEdit,
  canDelete,
  status,
  onCommit,
  onDelete,
  chrome = "embed",
  askCommit = true,
}: {
  label: string;
  path: string;
  source: string;
  canEdit: boolean;
  canDelete?: boolean;
  status?: string;
  onCommit: (body: string, message: string) => Promise<void>;
  onDelete?: (message: string) => Promise<void>;
  chrome?: "embed" | "page";
  askCommit?: boolean;
}) {
  const fieldId = useId();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const markdown = isMarkdownPath(path);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<"edit" | "preview">(markdown ? "edit" : "edit");
  const [view, setView] = useState<"preview" | "code">(
    markdown ? "preview" : "code"
  );
  const [wrap, setWrap] = useState(true);
  const [draft, setDraft] = useState(source);
  const [saving, setSaving] = useState(false);
  const [prompt, setPrompt] = useState<"update" | "delete" | null>(null);

  const dirty = draft !== source;
  const bytes = utf8Bytes(draft);
  const over = bytes > TEXT_MAX_BYTES;
  const lines = useMemo(
    () => Array.from({ length: lineCount(draft) }, (_, i) => i + 1),
    [draft]
  );

  function openEdit() {
    setDraft(source);
    setTab("edit");
    setEditing(true);
  }

  function cancel() {
    if (saving) {
      return;
    }
    if (dirty && !window.confirm("Discard file changes?")) {
      return;
    }
    setDraft(source);
    setEditing(false);
    setTab("edit");
    setPrompt(null);
  }

  async function commit(message: string) {
    if (!dirty || over || saving) {
      return;
    }
    setSaving(true);
    try {
      await onCommit(draft, message);
      setPrompt(null);
      setEditing(false);
      setTab("edit");
      toast.success(`Saved ${path}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save file");
    } finally {
      setSaving(false);
    }
  }

  async function remove(message: string) {
    if (!onDelete || saving) {
      return;
    }
    setSaving(true);
    try {
      await onDelete(message);
      setPrompt(null);
      toast.success(`Deleted ${path}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete file");
      setSaving(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "s" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      setWrap((on) => !on);
    }
  }

  function syncScroll() {
    if (gutterRef.current && textRef.current) {
      gutterRef.current.scrollTop = textRef.current.scrollTop;
    }
  }

  const showMarkdown = markdown && !editing && (chrome === "embed" || view === "preview");
  const showCode = !editing && !showMarkdown;
  const sourceLines = source ? source.split("\n") : [];
  const lineTotal = sourceLines.length;
  const loc = sourceLines.filter((line) => line.trim()).length;
  const sizeLabel = formatBytes(utf8Bytes(source));

  return (
    <section className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        {editing ? (
          <>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <p className="truncate font-mono text-sm">{label}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-10"
                disabled={saving}
                onClick={cancel}
              >
                Cancel changes
              </Button>
              <Button
                type="button"
                size="sm"
                className="min-h-10"
                disabled={!dirty || over || saving}
                onClick={() => {
                  if (askCommit) {
                    setPrompt("update");
                    return;
                  }
                  void commit(suggestedCommitMessage("update", path));
                }}
              >
                Commit changes
              </Button>
            </div>
          </>
        ) : chrome === "page" ? (
          <>
            <div
              className="flex min-w-0 flex-1 items-center gap-1"
              role={markdown ? "tablist" : undefined}
              aria-label={markdown ? "File view" : undefined}
            >
              {markdown ? (
                <>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={view === "preview"}
                    className={cn(
                      "min-h-10 px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      view === "preview"
                        ? "border-b-2 border-foreground text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setView("preview")}
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={view === "code"}
                    className={cn(
                      "min-h-10 px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      view === "code"
                        ? "border-b-2 border-foreground text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setView("code")}
                  >
                    Code
                  </button>
                </>
              ) : (
                <p className="px-1 text-sm font-medium">Code</p>
              )}
            </div>
            <p className="hidden text-xs text-muted-foreground sm:block">
              {lineTotal} {lineTotal === 1 ? "line" : "lines"}
              {loc !== lineTotal ? ` (${loc} loc)` : ""}
              {" · "}
              {sizeLabel}
            </p>
            <div className="flex items-center gap-1">
              {canDelete && onDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-10 text-destructive"
                  disabled={saving}
                  onClick={() => setPrompt("delete")}
                >
                  Delete
                </Button>
              ) : null}
              {canEdit ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="min-h-10 min-w-10"
                  aria-label={`Edit ${path}`}
                  onClick={openEdit}
                >
                  <Pencil />
                </Button>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <p className="truncate font-mono text-sm">{label}</p>
            </div>
            <div className="flex items-center gap-1">
              {canDelete && onDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-10 text-destructive"
                  disabled={saving}
                  onClick={() => setPrompt("delete")}
                >
                  Delete
                </Button>
              ) : null}
              {canEdit ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="min-h-10 min-w-10"
                  aria-label={`Edit ${path}`}
                  onClick={openEdit}
                >
                  <Pencil />
                </Button>
              ) : null}
            </div>
          </>
        )}
      </div>

      {editing ? (
        <>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-3">
            <div className="flex items-center gap-1" role="tablist" aria-label="File editor">
              <button
                type="button"
                role="tab"
                aria-selected={tab === "edit"}
                className={cn(
                  "min-h-10 px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  tab === "edit"
                    ? "border-b-2 border-foreground text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setTab("edit")}
              >
                Edit
              </button>
              {markdown ? (
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "preview"}
                  className={cn(
                    "min-h-10 px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    tab === "preview"
                      ? "border-b-2 border-foreground text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setTab("preview")}
                >
                  Preview
                </button>
              ) : null}
            </div>
            {tab === "edit" ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="min-h-10 min-w-10"
                aria-pressed={wrap}
                aria-label={wrap ? "Unwrap lines" : "Wrap lines"}
                onClick={() => setWrap((on) => !on)}
              >
                <WrapText />
              </Button>
            ) : null}
          </div>

          {tab === "edit" ? (
            <div className="flex min-h-64">
              <div
                ref={gutterRef}
                aria-hidden
                className="overflow-hidden border-r border-border bg-muted/40 px-2 py-3 text-right font-mono text-xs leading-6 text-muted-foreground select-none"
              >
                {lines.map((n) => (
                  <div key={n}>{n}</div>
                ))}
              </div>
              <label className="sr-only" htmlFor={fieldId}>
                Edit {path}
              </label>
              <textarea
                id={fieldId}
                ref={textRef}
                value={draft}
                spellCheck={false}
                wrap={wrap ? "soft" : "off"}
                disabled={saving}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={onKeyDown}
                onScroll={syncScroll}
                className={cn(
                  "min-h-0 min-w-0 flex-1 resize-none border-0 bg-transparent px-3 py-3 font-mono text-sm leading-6 text-foreground outline-none focus-visible:ring-0",
                  wrap
                    ? "overflow-y-auto whitespace-pre-wrap"
                    : "overflow-auto whitespace-pre"
                )}
              />
            </div>
          ) : (
            <div className="px-4 py-6 sm:px-6">
              {draft.trim() ? (
                <DocsProse source={draft} variant="readme" />
              ) : (
                <p className="text-sm text-muted-foreground">Nothing to preview.</p>
              )}
            </div>
          )}

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground">
            <p>Use Control + S to toggle wrap.</p>
            <p className={over ? "text-destructive" : undefined}>
              {bytes} / {TEXT_MAX_BYTES} bytes
              {status ? ` · ${status}` : ""}
            </p>
          </div>
        </>
      ) : showMarkdown && source ? (
        <div className="px-4 py-6 sm:px-6">
          <DocsProse source={source} variant="readme" />
        </div>
      ) : showCode && source ? (
        <div className="flex overflow-auto">
          <div
            aria-hidden
            className="border-r border-border bg-muted/40 px-2 py-3 text-right font-mono text-xs leading-6 text-muted-foreground select-none"
          >
            {sourceLines.map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          <pre className="min-w-0 flex-1 overflow-auto px-3 py-3 font-mono text-sm leading-6">
            {source}
          </pre>
        </div>
      ) : (
        <div className="px-4 py-10">
          <p className="text-sm text-muted-foreground">This file is empty.</p>
        </div>
      )}
      <CommitDialog
        open={prompt === "update"}
        onOpenChange={(open) => {
          if (!open && !saving) {
            setPrompt(null);
          }
        }}
        title="Commit changes"
        description={`Update ${path}. This records a commit with the current time.`}
        defaultMessage={suggestedCommitMessage("update", path)}
        confirmLabel="Commit changes"
        busy={saving}
        onConfirm={commit}
      />
      <CommitDialog
        open={prompt === "delete"}
        onOpenChange={(open) => {
          if (!open && !saving) {
            setPrompt(null);
          }
        }}
        title="Delete file"
        description={`Delete ${path}. This records a commit with the current time.`}
        defaultMessage={suggestedCommitMessage("delete", path)}
        confirmLabel="Commit delete"
        destructive
        busy={saving}
        onConfirm={remove}
      />
    </section>
  );
}
