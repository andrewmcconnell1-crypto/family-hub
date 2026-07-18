// Treehouse ICS proxy (Supabase Edge Function)
// ============================================
// Fetches an external calendar feed (Google/Outlook/iCloud ".ics" URL) server
// side and returns the raw text with CORS headers, because those feeds don't
// allow the browser to read them directly. Deploy with JWT verification ON —
// only signed-in Treehouse users may call it, so it isn't an open proxy.
//
//   POST { "url": "https://calendar.google.com/…/basic.ics" }
//
// Basic SSRF guards: https/http/webcal only, and obvious localhost / private
// / cloud-metadata hosts are refused. Responses are capped in size.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB is plenty for a personal calendar

// Reject hosts that shouldn't be reachable from a public feed URL.
function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (h === "169.254.169.254" || h === "metadata.google.internal") return true; // cloud metadata
  // IPv4 literals in private / loopback / link-local ranges.
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  if (h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) return true;
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS });
  }

  let target = "";
  try {
    target = (await req.json())?.url ?? "";
  } catch {
    return Response.json({ error: "bad-request" }, { status: 400, headers: CORS });
  }

  // webcal:// is just http(s) for calendar subscriptions.
  target = target.trim().replace(/^webcal:\/\//i, "https://");

  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return Response.json({ error: "invalid-url" }, { status: 400, headers: CORS });
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return Response.json({ error: "unsupported-scheme" }, { status: 400, headers: CORS });
  }
  if (isBlockedHost(url.hostname)) {
    return Response.json({ error: "blocked-host" }, { status: 400, headers: CORS });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const upstream = await fetch(url.toString(), {
      headers: { Accept: "text/calendar, text/plain, */*", "User-Agent": "Treehouse-Calendar/1.0" },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!upstream.ok) {
      return Response.json({ error: "fetch-failed", status: upstream.status }, { status: 502, headers: CORS });
    }
    const text = (await upstream.text()).slice(0, MAX_BYTES);
    if (!text.includes("BEGIN:VCALENDAR")) {
      return Response.json({ error: "not-a-calendar" }, { status: 422, headers: CORS });
    }
    return new Response(text, {
      headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === "AbortError";
    return Response.json(
      { error: aborted ? "timeout" : "fetch-error" },
      { status: 504, headers: CORS },
    );
  } finally {
    clearTimeout(timeout);
  }
});
