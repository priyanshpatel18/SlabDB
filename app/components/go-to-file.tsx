"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { IconDirectory, IconFile } from "@/components/repo-icons";
import {
  blobHref,
  fileName,
  isHiddenPath,
  treeHref,
  type RepoFileRow,
} from "@/lib/files";

type Hit = { kind: "dir" | "file"; path: string; name: string };

function catalog(files: RepoFileRow[]): Hit[] {
  const dirs = new Set<string>();
  const hits: Hit[] = [];
  for (const file of files) {
    if (isHiddenPath(file.path)) {
      continue;
    }
    const parts = file.path.split("/").filter(Boolean);
    for (let i = 1; i < parts.length; i++) {
      dirs.add(parts.slice(0, i).join("/"));
    }
    hits.push({ kind: "file", path: file.path, name: fileName(file.path) });
  }
  for (const path of dirs) {
    hits.push({ kind: "dir", path, name: fileName(path) });
  }
  hits.sort((a, b) => a.path.localeCompare(b.path));
  return hits;
}

export function GoToFile({
  uid,
  repo,
  files,
  compact = false,
}: {
  uid: string;
  repo: string;
  files: RepoFileRow[];
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const items = useMemo(() => catalog(files), [files]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return items.slice(0, 40);
    }
    return items.filter((item) => item.path.toLowerCase().includes(q)).slice(0, 40);
  }, [items, query]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "t" && event.key !== "T") {
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.closest("input, textarea, select, [contenteditable=true]") ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function go(item: Hit) {
    setOpen(false);
    setQuery("");
    router.push(
      item.kind === "dir" ? treeHref(uid, repo, item.path) : blobHref(uid, repo, item.path)
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={
          compact
            ? "h-8 min-h-10 w-full justify-start gap-2 px-3 text-sm font-normal text-muted-foreground sm:min-h-8"
            : "h-8 min-h-10 w-full justify-start gap-2 px-3 text-sm font-normal text-muted-foreground sm:min-h-8 sm:max-w-xs"
        }
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" aria-hidden />
        Go to file
        {compact ? null : (
          <kbd className="ml-auto hidden rounded border border-border px-1 font-mono text-[10px] text-muted-foreground sm:inline">
            t
          </kbd>
        )}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setQuery("");
          }
        }}
      >
        <DialogContent className="max-w-lg p-0 sm:max-w-lg" showCloseButton={false}>
          <DialogHeader className="border-b border-border px-3 py-2">
            <DialogTitle className="sr-only">Go to file</DialogTitle>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Go to file"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className="h-10 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
          </DialogHeader>
          <ul className="max-h-72 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                No files match.
              </li>
            ) : (
              filtered.map((item) => (
                <li key={`${item.kind}:${item.path}`}>
                  <button
                    type="button"
                    className="flex min-h-10 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    onClick={() => go(item)}
                  >
                    {item.kind === "dir" ? (
                      <IconDirectory className="text-muted-foreground" />
                    ) : (
                      <IconFile className="text-muted-foreground" />
                    )}
                    <span className="truncate">{item.path}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
