"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DESC_MAX } from "@/lib/files";

export function RepoAbout({
  description,
  canEdit = false,
  onSave,
}: {
  description: string;
  canEdit?: boolean;
  onSave?: (text: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(description);
  const [bound, setBound] = useState(description);
  const [saving, setSaving] = useState(false);

  if (description !== bound) {
    setBound(description);
    setDraft(description);
  }

  const dirty = draft !== description;
  const remaining = DESC_MAX - draft.length;

  async function save() {
    if (!onSave || !dirty || saving) {
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
      toast.success("Description saved");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save description"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside className="flex w-full shrink-0 flex-col lg:w-72">
      <h2 className="text-base font-semibold">About</h2>
      {canEdit && onSave ? (
        <form
          className="mt-2 flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label className="sr-only" htmlFor="repo-about">
            Repository description
          </label>
          <Textarea
            id="repo-about"
            value={draft}
            maxLength={DESC_MAX}
            rows={4}
            placeholder="No description."
            className="min-h-20 text-sm"
            disabled={saving}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {remaining} left
            </p>
            <Button
              type="submit"
              size="sm"
              className="min-h-10"
              disabled={!dirty || saving}
            >
              {saving ? "Saving" : "Save"}
            </Button>
          </div>
        </form>
      ) : description ? (
        <p className="mt-2 text-sm leading-relaxed text-foreground">
          {description}
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">No description.</p>
      )}
    </aside>
  );
}
