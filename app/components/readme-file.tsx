"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { FileText, Pencil, WrapText } from "lucide-react";
import { TEXT_MAX_BYTES } from "slabdb";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { DocsProse } from "@/components/docs-prose";
import { README_PATH } from "@/lib/cluster";

function lineCount(text: string): number {
  return Math.max(1, text.split("\n").length);
}

function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

export function ReadmeFile({
  uid,
  source,
  canEdit,
  status,
  onCommit,
}: {
  uid: string;
  source: string;
  canEdit: boolean;
  status?: string;
  onCommit: (body: string) => Promise<void>;
}) {
  const fieldId = useId();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [wrap, setWrap] = useState(true);
  const [draft, setDraft] = useState(source);
  const [saving, setSaving] = useState(false);

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
    if (dirty && !window.confirm("Discard README changes?")) {
      return;
    }
    setDraft(source);
    setEditing(false);
    setTab("edit");
  }

  async function commit() {
    if (!dirty || over || saving) {
      return;
    }
    setSaving(true);
    try {
      await onCommit(draft);
      setEditing(false);
      setTab("edit");
      toast.success("README.md saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save README");
    } finally {
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

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="truncate font-mono text-sm">
            {uid} / {README_PATH}
          </p>
          {editing ? (
            <span className="shrink-0 text-xs text-muted-foreground">in home</span>
          ) : null}
        </div>
        {editing ? (
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
              onClick={() => void commit()}
            >
              {saving ? "Committing…" : "Commit changes"}
            </Button>
          </div>
        ) : canEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-10 min-w-10"
            aria-label="Edit README.md"
            onClick={openEdit}
          >
            <Pencil />
          </Button>
        ) : null}
      </div>

      {editing ? (
        <>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-3">
            <div className="flex items-center gap-1" role="tablist" aria-label="README editor">
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
            <div className="flex min-h-0 flex-1">
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
                Edit README.md
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
                  wrap ? "overflow-y-auto whitespace-pre-wrap" : "overflow-auto whitespace-pre"
                )}
              />
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
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
      ) : source ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <DocsProse source={source} variant="readme" />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-10">
          <p className="text-sm text-muted-foreground">
            This profile has no README.md yet.
          </p>
        </div>
      )}
    </section>
  );
}
