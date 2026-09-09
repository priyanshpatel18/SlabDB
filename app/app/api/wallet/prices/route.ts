import { NextResponse } from "next/server";

export const runtime = "nodejs";

type PriceRow = {
  usdPrice?: number;
};

export async function GET(req: Request) {
  const ids = new URL(req.url).searchParams.get("ids") ?? "";
  const mints = ids
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 50);
  if (mints.length === 0) {
    return NextResponse.json({ data: {} });
  }
  const url = `https://lite-api.jup.ag/price/v3?ids=${encodeURIComponent(mints.join(","))}`;
  try {
    const res = await fetch(url, { next: { revalidate: 20 } });
    if (!res.ok) {
      return NextResponse.json({ data: {} }, { status: 200 });
    }
    const body = (await res.json()) as Record<string, PriceRow | null>;
    const data: Record<string, number> = {};
    for (const [mint, row] of Object.entries(body)) {
      const n = Number(row?.usdPrice);
      if (Number.isFinite(n)) data[mint] = n;
    }
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ data: {} });
  }
}
