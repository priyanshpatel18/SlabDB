"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  COMMIT_MESSAGE_MAX,
  normalizeCommitMessage,
} from "@/lib/history";

export function CommitDialog({
  open,
  onOpenChange,
  title,
  description,
  defaultMessage,
  confirmLabel,
  destructive = false,
  busy = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  defaultMessage: string;
  confirmLabel: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: (message: string) => Promise<void>;
}) {
  const fieldId = useId();
  const [seed, setSeed] = useState(open ? defaultMessage : "");
  const [message, setMessage] = useState(defaultMessage);
  const [error, setError] = useState("");

  if (open && seed !== defaultMessage) {
    setSeed(defaultMessage);
    setMessage(defaultMessage);
    setError("");
  }
  if (!open && seed !== "") {
    setSeed("");
  }

  function close() {
    if (busy) {
      return;
    }
    onOpenChange(false);
  }

  async function submit() {
    if (busy) {
      return;
    }
    let next = "";
    try {
      next = normalizeCommitMessage(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Commit message is required");
      return;
    }
    await onConfirm(next);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          close();
          return;
        }
        onOpenChange(true);
      }}
    >
      <DialogContent className="sm:max-w-lg" showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor={fieldId}>Commit message</Label>
            <Input
              id={fieldId}
              value={message}
              maxLength={COMMIT_MESSAGE_MAX}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck
              disabled={busy}
              aria-invalid={Boolean(error)}
              className="h-11"
              onChange={(event) => {
                setMessage(event.target.value);
                setError("");
              }}
            />
            <p className="text-xs text-muted-foreground">
              {message.trim().length} / {COMMIT_MESSAGE_MAX}
            </p>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="min-h-10"
              disabled={busy}
              onClick={close}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={destructive ? "destructive" : "default"}
              className="min-h-10"
              disabled={busy || !message.trim()}
            >
              {busy ? "Committing" : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
