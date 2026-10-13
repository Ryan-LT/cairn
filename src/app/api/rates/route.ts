import { resolveRates } from "@/shared/api/rates";

export const dynamic = "force-dynamic";

/**
 * Live USD/VND and Vietnamese gold prices (public market data, no sign-in).
 * The CDN keeps a response for 10 minutes and may serve it stale for half
 * an hour while fetching a fresh one.
 */
export async function GET() {
  const snapshot = await resolveRates();
  return Response.json(snapshot, {
    headers: { "Cache-Control": "public, max-age=300, s-maxage=600, stale-while-revalidate=1800" },
  });
}
