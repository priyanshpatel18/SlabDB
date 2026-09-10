"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Pfp } from "@/components/pfp";
import { assertUid, type ProfileDraft } from "@/lib/profile";
import { lookupUsername } from "@/lib/username";

export function ProfileFields({
  draft,
  onChange,
  extra = false,
  ownerWallet = "",
}: {
  draft: ProfileDraft;
  onChange: (next: ProfileDraft) => void;
  extra?: boolean;
  ownerWallet?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = useMemo(
    () => (draft.pfpFile ? URL.createObjectURL(draft.pfpFile) : ""),
    [draft.pfpFile]
  );
  const [uidHint, setUidHint] = useState("");

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  useEffect(() => {
    const raw = draft.uid.trim().toLowerCase();
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!raw) {
        setUidHint("");
        return;
      }
      let uid: string;
      try {
        uid = assertUid(raw);
      } catch (err) {
        if (!cancelled && raw.length >= 3) {
          setUidHint(
            err instanceof Error ? err.message : "Username is not valid"
          );
        } else if (!cancelled) {
          setUidHint("");
        }
        return;
      }
      void lookupUsername(uid)
        .then((row) => {
          if (cancelled) {
            return;
          }
          if (row && row.wallet && row.wallet !== ownerWallet) {
            setUidHint("Username is taken");
            return;
          }
          setUidHint("");
        })
        .catch(() => {
          if (!cancelled) {
            setUidHint("");
          }
        });
    }, raw ? 400 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [draft.uid, ownerWallet]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <Label htmlFor="profile-pfp">Profile picture</Label>
          <p className="text-xs text-muted-foreground">
            Optional. Square crop, stored on Irys.
          </p>
        </div>
        <div className="relative w-fit">
          {preview ? (
            <span
              className="inline-flex size-28 overflow-hidden rounded-full bg-muted bg-cover bg-center"
              style={{ backgroundImage: `url("${preview}")` }}
              aria-hidden
            />
          ) : (
            <Pfp id={draft.pfp} size={112} alt={draft.name || "Profile picture"} />
          )}
          <Button
            type="button"
            size="sm"
            className="absolute bottom-1 left-1 h-8"
            aria-label="Change profile picture"
            onClick={() => fileRef.current?.click()}
          >
            <Pencil />
            Edit
          </Button>
          <input
            id="profile-pfp"
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label="Upload profile picture"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              onChange({ ...draft, pfpFile: file });
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="profile-name">Display name</Label>
        <Input
          id="profile-name"
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          className="h-11"
          autoComplete="nickname"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="profile-uid">Username</Label>
        <Input
          id="profile-uid"
          value={draft.uid}
          onChange={(e) => onChange({ ...draft, uid: e.target.value })}
          className="h-11 font-mono"
          autoComplete="username"
          aria-describedby={
            uidHint
              ? "profile-uid-hint profile-uid-error"
              : "profile-uid-hint"
          }
        />
        <p id="profile-uid-hint" className="text-xs text-muted-foreground">
          Public URL. Start with a letter. Use a-z, 0-9, and _.
        </p>
        {uidHint ? (
          <p id="profile-uid-error" className="text-xs text-destructive" role="alert">
            {uidHint}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="profile-bio">Bio {extra ? "" : "(optional)"}</Label>
        <Textarea
          id="profile-bio"
          value={draft.bio}
          onChange={(e) => onChange({ ...draft, bio: e.target.value })}
          maxLength={160}
        />
      </div>

      {extra ? (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-web">Website (optional)</Label>
            <Input
              id="profile-web"
              value={draft.website}
              onChange={(e) => onChange({ ...draft, website: e.target.value })}
              className="h-11"
              placeholder="https://"
              autoComplete="url"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Extra links</Label>
            {draft.links.map((link, i) => (
              <div key={i} className="flex flex-col gap-1">
                <Label htmlFor={`profile-link-${i}`} className="sr-only">
                  Extra link {i + 1}
                </Label>
                <Input
                  id={`profile-link-${i}`}
                  value={link}
                  onChange={(e) => {
                    const links = [...draft.links];
                    links[i] = e.target.value;
                    onChange({ ...draft, links });
                  }}
                  className="h-11"
                  placeholder={`Link ${i + 1}`}
                  autoComplete="url"
                />
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
