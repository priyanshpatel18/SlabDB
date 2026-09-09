import { redirect } from "next/navigation";
import { profilePath } from "@/lib/cluster";

export default async function LegacyUserPage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const { uid } = await params;
  redirect(profilePath(decodeURIComponent(uid)));
}
