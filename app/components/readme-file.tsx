"use client";

import { RepoFile } from "@/components/repo-file";
import { README_PATH } from "@/lib/cluster";

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
  return (
    <RepoFile
      label={`${uid} / ${README_PATH}`}
      path={README_PATH}
      source={source}
      canEdit={canEdit}
      status={status}
      onCommit={onCommit}
      askCommit={false}
    />
  );
}
