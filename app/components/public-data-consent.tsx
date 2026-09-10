"use client";

import Link from "next/link";

export function PublicDataConsent({
  id,
  checked,
  onChange,
}: {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex min-h-10 cursor-pointer items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        required
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 size-4 accent-kiln"
      />
      <span className="text-sm leading-relaxed text-foreground">
        I understand this is public on Irys and I agree to the{" "}
        <Link
          href="/privacy"
          className="text-kiln underline underline-offset-4 hover:text-foreground"
          onClick={(event) => event.stopPropagation()}
        >
          Privacy Policy
        </Link>{" "}
        and{" "}
        <Link
          href="/terms"
          className="text-kiln underline underline-offset-4 hover:text-foreground"
          onClick={(event) => event.stopPropagation()}
        >
          Terms
        </Link>
        .
      </span>
    </label>
  );
}
