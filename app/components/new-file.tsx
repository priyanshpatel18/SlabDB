"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TEXT_MAX_BYTES } from "slabdb";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { RepoCrumb } from "@/components/repo-crumb";
import { RepoHeader } from "@/components/repo-header";
import { SiteHeader } from "@/components/site-header";
import { useRepo } from "@/hooks/use-repo";
import { assertFilePath, blobHref, repoHref, utf8Bytes } from "@/lib/files";
import {
  COMMIT_MESSAGE_MAX,
  normalizeCommitMessage,
  suggestedCommitMessage,
} from "@/lib/history";

export function NewFile({
  uid,
  repo,
  initialPath = "",
}: {
  uid: string;
  repo: string;
  initialPath?: string;
}) {
  const router = useRouter();
  const access = useRepo(uid, repo);
  const [path, setPath] = useState(initialPath);
  const [body, setBody] = useState("");
  const [message, setMessage] = useState(
    suggestedCommitMessage("add", initialPath || "file")
  );
  const [messageDirty, setMessageDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const pathError = useMemo(() => {
    const raw = path.trim();
    if (!raw || raw.endsWith("/")) {
      return raw.endsWith("/") ? "Add a file name after the folder" : "";
    }
    try {
      const next = assertFilePath(raw);
      if (access.files.some((file) => file.path === next)) {
        return "This path already exists";
      }
      return "";
    } catch (err) {
      return err instanceof Error ? err.message : "Invalid path";
    }
  }, [access.files, path]);

  const bytes = utf8Bytes(body);
  const over = bytes > TEXT_MAX_BYTES;
  const suggestion = suggestedCommitMessage("add", path.trim() || "file");
  const commitMessage = messageDirty ? message : suggestion;
  let messageError = "";
  try {
    if (commitMessage.trim()) {
      normalizeCommitMessage(commitMessage);
    } else {
      messageError = "Commit message is required";
    }
  } catch (err) {
    messageError = err instanceof Error ? err.message : "Invalid commit message";
  }
  const canSave =
    access.own &&
    access.found &&
    !saving &&
    !pathError &&
    !messageError &&
    Boolean(path.trim()) &&
    !over;

  function onCreate() {
    if (!canSave) {
      return;
    }
    const next = assertFilePath(path);
    const text = normalizeCommitMessage(commitMessage);
    setSaving(true);
    void access
      .writeFile(next, body, text)
      .then(() => {
        toast.success(`Created ${next}`);
        router.push(blobHref(uid, repo, next));
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Could not create file");
      })
      .finally(() => {
        setSaving(false);
      });
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SiteHeader />
      {!access.loading && access.found ? (
        <RepoHeader uid={uid} repo={repo} pfp={access.profile?.pfp} own={access.own} />
      ) : null}
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-4 sm:px-6">
        <RepoCrumb uid={uid} repo={repo} />
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Create a new file</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Use folders in the path. Example: src/lib/mod.ts.
          </p>
        </div>

        {access.error ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load repository</AlertTitle>
            <AlertDescription>{access.error}</AlertDescription>
          </Alert>
        ) : null}

        {access.loading ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <Skeleton className="h-11 w-full motion-reduce:animate-none" />
            <Skeleton className="h-64 w-full motion-reduce:animate-none" />
          </div>
        ) : null}

        {!access.loading && !access.found ? (
          <Empty className="border border-dashed border-border py-12">
            <EmptyHeader>
              <EmptyTitle>Repository not found</EmptyTitle>
              <EmptyDescription>
                {uid} has no repository named {repo}.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}

        {!access.loading && access.found && !access.own ? (
          <p className="text-sm text-muted-foreground">
            Sign in as the owner to add files.
          </p>
        ) : null}

        {!access.loading && access.own && access.found ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              onCreate();
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-file-path">File path</Label>
              <Input
                id="new-file-path"
                value={path}
                onChange={(event) => setPath(event.target.value)}
                placeholder="src/index.ts"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                aria-invalid={Boolean(pathError)}
                className="h-11 font-mono"
              />
              {pathError ? (
                <p className="text-sm text-destructive">{pathError}</p>
              ) : path.trim() ? (
                <p className="text-sm text-muted-foreground">
                  {uid}/{repo}/{path.trim()}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-file-body">File contents</Label>
              <Textarea
                id="new-file-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={18}
                spellCheck={false}
                className="min-h-64 font-mono text-sm"
              />
              <p className={over ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
                {bytes} / {TEXT_MAX_BYTES} bytes
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-file-message">Commit message</Label>
              <Input
                id="new-file-message"
                value={commitMessage}
                maxLength={COMMIT_MESSAGE_MAX}
                onChange={(event) => {
                  setMessage(event.target.value);
                  setMessageDirty(true);
                }}
                autoComplete="off"
                className="h-11"
                aria-invalid={Boolean(messageError)}
              />
              <p className="text-xs text-muted-foreground">
                {commitMessage.trim().length} / {COMMIT_MESSAGE_MAX}. This records a
                commit with the current time.
              </p>
              {messageError ? (
                <p className="text-sm text-destructive">{messageError}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="h-11"
                nativeButton={false}
                render={<Link href={repoHref(uid, repo)} />}
              >
                Cancel
              </Button>
              <Button type="submit" className="h-11 sm:min-w-40" disabled={!canSave}>
                {saving ? "Creating" : "Commit new file"}
              </Button>
            </div>
          </form>
        ) : null}
      </main>
    </div>
  );
}
