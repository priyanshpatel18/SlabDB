"use client";

import Link from "next/link";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  existingRepoCliCommands,
  newRepoCliCommands,
  repoRemoteUrl,
} from "@/lib/cli-setup";
import { newFileHref } from "@/lib/files";
import { BASE_URL } from "@/lib/seo";

function copyText(value: string) {
  void navigator.clipboard.writeText(value).then(
    () => toast.success("Copied"),
    () => toast.error("Could not copy")
  );
}

function CliBlock({ title, commands }: { title: string; commands: string }) {
  return (
    <div className="border-t border-border">
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <p className="pt-0.5 text-sm text-muted-foreground">{title}</p>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="min-h-10 min-w-10 shrink-0 sm:min-h-8 sm:min-w-8"
          aria-label={`Copy ${title}`}
          onClick={() => copyText(commands)}
        >
          <Copy aria-hidden />
        </Button>
      </div>
      <pre className="overflow-x-auto px-4 pb-4 font-mono text-[13px] leading-relaxed text-foreground">
        <code>{commands}</code>
      </pre>
    </div>
  );
}

export function RepoCliSetup({
  uid,
  repo,
  canAddFile = false,
}: {
  uid: string;
  repo: string;
  canAddFile?: boolean;
}) {
  const remote = repoRemoteUrl(BASE_URL, uid, repo);
  const create = newRepoCliCommands(remote, repo);
  const existing = existingRepoCliCommands(remote);

  return (
    <section
      className="overflow-hidden rounded-lg border border-border bg-card"
      aria-label="Command line setup"
    >
      <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-foreground">
          Quick setup. If you have done this before
        </p>
        <div className="flex min-w-0 items-center gap-2">
          <Input
            readOnly
            value={remote}
            aria-label="Repository URL"
            className="h-9 min-w-0 font-mono text-xs"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="min-h-10 min-w-10 shrink-0 sm:min-h-8 sm:min-w-8"
            aria-label="Copy repository URL"
            onClick={() => copyText(remote)}
          >
            <Copy aria-hidden />
          </Button>
        </div>
      </div>
      <p className="px-4 pb-4 text-sm text-muted-foreground">
        Run{" "}
        <code className="font-mono text-foreground">slab login</code> once, then
        these commands in your project folder. Keep each file under 4,096 bytes.
        Binary files are skipped.
        {canAddFile ? (
          <>
            {" "}
            You can also{" "}
            <Link
              href={newFileHref(uid, repo)}
              className="text-kiln underline-offset-4 hover:underline"
            >
              create a new file
            </Link>{" "}
            in the browser.
          </>
        ) : null}
      </p>
      <CliBlock
        title="...or create a new repository on the command line"
        commands={create}
      />
      <CliBlock
        title="...or push an existing repository from the command line"
        commands={existing}
      />
    </section>
  );
}
