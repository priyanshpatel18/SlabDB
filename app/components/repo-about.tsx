"use client";

import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { IconBook, IconGear, IconLink } from "@/components/repo-icons";
import {
  DESC_MAX,
  WEBSITE_MAX,
  websiteLabel,
} from "@/lib/files";

export function RepoAbout({
  description,
  website = "",
  readmeHref,
  canEdit = false,
  onSave,
}: {
  description: string;
  website?: string;
  readmeHref?: string;
  canEdit?: boolean;
  onSave?: (next: { description: string; website: string }) => Promise<void>;
}) {
  const descId = useId();
  const siteId = useId();
  const [open, setOpen] = useState(false);
  const [draftDesc, setDraftDesc] = useState(description);
  const [draftSite, setDraftSite] = useState(website);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const remaining = DESC_MAX - draftDesc.length;
  const empty = !description && !website;

  function close() {
    if (saving) {
      return;
    }
    setOpen(false);
  }

  function startEdit() {
    setDraftDesc(description);
    setDraftSite(website);
    setError("");
    setOpen(true);
  }

  async function save() {
    if (!onSave || saving) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({ description: draftDesc, website: draftSite });
      toast.success("Repository details saved");
      setOpen(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save repository details"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside className="flex w-full shrink-0 flex-col lg:w-72">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">About</h2>
        {canEdit && onSave ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            aria-label="Edit repository details"
            onClick={startEdit}
          >
            <IconGear aria-hidden />
          </Button>
        ) : null}
      </div>
      {description ? (
        <p className="mt-2 text-sm leading-relaxed text-foreground">
          {description}
        </p>
      ) : empty ? (
        <p className="mt-2 text-sm text-muted-foreground">
          No description or website provided.
        </p>
      ) : null}
      {website && /^https?:\/\//i.test(website) ? (
        <a
          href={website}
          target="_blank"
          rel="noopener noreferrer"
          referrerPolicy="no-referrer"
          className="mt-3 flex min-h-10 items-center gap-2 text-sm text-kiln hover:underline focus-visible:underline sm:min-h-7"
        >
          <IconLink className="text-muted-foreground" aria-hidden />
          <span className="truncate">{websiteLabel(website)}</span>
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : null}
      {readmeHref ? (
        <a
          href={readmeHref}
          className="mt-3 flex min-h-10 items-center gap-2 border-t border-border pt-3 text-sm text-foreground hover:text-kiln hover:underline focus-visible:text-kiln sm:min-h-7"
        >
          <IconBook className="text-muted-foreground" aria-hidden />
          Readme
        </a>
      ) : null}

      {canEdit && onSave ? (
        <Dialog
          open={open}
          onOpenChange={(next) => {
            if (!next) {
              close();
              return;
            }
            setOpen(true);
          }}
        >
          <DialogContent className="sm:max-w-xl" showCloseButton={!saving}>
            <DialogHeader>
              <DialogTitle>Edit repository details</DialogTitle>
            </DialogHeader>
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void save();
              }}
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor={descId}>Description</Label>
                <Textarea
                  id={descId}
                  value={draftDesc}
                  maxLength={DESC_MAX}
                  rows={3}
                  autoFocus
                  disabled={saving}
                  className="min-h-20"
                  onChange={(event) => setDraftDesc(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {remaining} characters remaining
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor={siteId}>Website</Label>
                <Input
                  id={siteId}
                  value={draftSite}
                  maxLength={WEBSITE_MAX}
                  autoComplete="url"
                  autoCapitalize="none"
                  spellCheck={false}
                  inputMode="url"
                  placeholder="https://example.com"
                  disabled={saving}
                  className="h-11"
                  aria-invalid={Boolean(error)}
                  onChange={(event) => {
                    setDraftSite(event.target.value);
                    setError("");
                  }}
                />
              </div>
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-10"
                  disabled={saving}
                  onClick={close}
                >
                  Cancel
                </Button>
                <Button type="submit" className="min-h-10" disabled={saving}>
                  {saving ? "Saving" : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}
    </aside>
  );
}
