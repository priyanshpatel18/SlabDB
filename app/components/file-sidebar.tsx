"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "cn";
import { GoToFile } from "@/components/go-to-file";
import { IconDirectory, IconFile } from "@/components/repo-icons";
import {
  blobHref,
  buildSideTree,
  treeHref,
  type RepoFileRow,
  type SideNode,
} from "@/lib/files";

export function FileSidebar({
  uid,
  repo,
  files,
  current,
}: {
  uid: string;
  repo: string;
  files: RepoFileRow[];
  current: string;
}) {
  const tree = useMemo(() => buildSideTree(files), [files]);
  const openStart = useMemo(() => {
    const next = new Set<string>();
    if (!current) {
      return next;
    }
    const parts = current.split("/").filter(Boolean);
    for (let i = 1; i <= parts.length; i++) {
      next.add(parts.slice(0, i).join("/"));
    }
    return next;
  }, [current]);
  const [open, setOpen] = useState<Set<string>>(() => new Set(openStart));
  const [seen, setSeen] = useState(current);
  if (current !== seen) {
    setSeen(current);
    const next = new Set(open);
    for (const path of openStart) {
      next.add(path);
    }
    setOpen(next);
  }

  function toggle(path: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border pr-3 lg:flex">
      <p className="px-2 pb-2 text-sm font-semibold">Files</p>
      <GoToFile uid={uid} repo={repo} files={files} compact />
      <nav className="mt-3 min-h-0 flex-1 overflow-y-auto" aria-label="Files">
        <ul className="flex flex-col">
          {tree.map((node) => (
            <SideItem
              key={node.path}
              uid={uid}
              repo={repo}
              node={node}
              current={current}
              depth={0}
              open={open}
              onToggle={toggle}
            />
          ))}
        </ul>
      </nav>
    </aside>
  );
}

function SideItem({
  uid,
  repo,
  node,
  current,
  depth,
  open,
  onToggle,
}: {
  uid: string;
  repo: string;
  node: SideNode;
  current: string;
  depth: number;
  open: Set<string>;
  onToggle: (path: string) => void;
}) {
  const active = current === node.path;
  const expanded = node.kind === "dir" && open.has(node.path);
  const href =
    node.kind === "dir" ? treeHref(uid, repo, node.path) : blobHref(uid, repo, node.path);

  return (
    <li>
      <div
        className={cn(
          "flex min-h-8 items-center rounded-md",
          active && "bg-muted"
        )}
      >
        {node.kind === "dir" ? (
          <button
            type="button"
            className="flex size-8 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-label={expanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
            aria-expanded={expanded}
            onClick={() => onToggle(node.path)}
          >
            {expanded ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
          </button>
        ) : (
          <span className="size-8 shrink-0" />
        )}
        <Link
          href={href}
          className="flex min-w-0 flex-1 items-center gap-1.5 py-1 pr-2 text-sm hover:underline focus-visible:underline"
          style={{ paddingLeft: depth ? 4 : 0 }}
        >
          {node.kind === "dir" ? (
            <IconDirectory className="size-3.5 text-muted-foreground" />
          ) : (
            <IconFile className="size-3.5 text-muted-foreground" />
          )}
          <span className={cn("truncate", active && "font-medium text-kiln")}>
            {node.name}
          </span>
        </Link>
      </div>
      {node.kind === "dir" && expanded ? (
        <ul>
          {node.children.map((child) => (
            <SideItem
              key={child.path}
              uid={uid}
              repo={repo}
              node={child}
              current={current}
              depth={depth + 1}
              open={open}
              onToggle={onToggle}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
