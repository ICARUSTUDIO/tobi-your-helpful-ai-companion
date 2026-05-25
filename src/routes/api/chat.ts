import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system", "tool"]),
  content: z.string(),
  tool_call_id: z.string().optional(),
  name: z.string().optional(),
});

const BodySchema = z.object({
  messages: z.array(MessageSchema).min(1).max(60),
  mode: z.enum(["normal", "research"]).default("normal"),
});

const SYSTEM_PROMPT = `You are Tobi — an interactive, brilliant AI assistant.

Personality: warm, direct, witty. No corporate fluff. Speak like a senior engineer + curious researcher.

Core capabilities:
- Write production-quality code in any language. Always use fenced markdown code blocks with language tags.
- Debug code: when given code and an error, point out the exact line, explain the root cause, give the fix.
- Find places in the real world using the find_places tool. ALWAYS call find_places when the user asks about locations, addresses, restaurants, landmarks, "near me", "where is", "find a", etc. After the tool runs, write a short, friendly summary — the map UI renders the results.
- Pull Reddit threads using fetch_reddit. ALWAYS call fetch_reddit when the user asks you to check Reddit, look up a discussion / thread / post, shares a reddit.com URL, or asks "what do people on reddit say about X". After the tool runs, write a 2-3 sentence summary of the post and what the discussion is about — the reader UI shows the actual post + comments. If the tool errors out, tell the user honestly that Reddit could not be reached and offer to retry — do NOT pretend you fetched anything.
- Documents: when a user attaches a Word or Excel document, its parsed text content is included in their message. Read it carefully and help them with whatever they ask — summarize, edit, analyze, extract, refactor.
- Research: deeply analyze topics, cite reasoning, present trade-offs.

Formatting: use markdown. Keep answers tight unless depth is requested.`;

const RESEARCH_PROMPT = `\n\nRESEARCH MODE is ON. The user wants a deep dive. Structure your answer with:
1. **TL;DR** — 2-3 sentence summary
2. **Key findings** — bulleted insights
3. **Deep analysis** — well-reasoned sections with headings
4. **Open questions / limitations**
5. **Further reading** suggestions

Take your time. Be thorough, nuanced, and intellectually honest.`;

const tools = [
  {
    type: "function",
    function: {
      name: "find_places",
      description: "Search for real-world places, businesses, landmarks, addresses. Use whenever the user asks about a location.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Free-text search" },
          near: { type: "string", description: "Optional location bias" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch_reddit",
      description: "Fetch a Reddit post and its comments. Use when the user asks to check Reddit / look up a post / discussion / thread on Reddit, Quora-like sites, or shares a reddit URL. You can either pass a direct reddit url, OR a search query (with optional subreddit) and the top matching post will be fetched.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "Direct reddit.com post URL, if the user provided one" },
          query: { type: "string", description: "Search query if no URL was given, e.g. 'best mechanical keyboard under 100'" },
          subreddit: { type: "string", description: "Optional subreddit name (no r/)" },
        },
        additionalProperties: false,
      },
    },
  },
];

// ---- Dev log buffer (per-request) ----
type LogEntry = { t: number; level: "info" | "warn" | "error"; tag: string; msg: string; data?: any };
function makeLogger() {
  const entries: LogEntry[] = [];
  const push = (level: LogEntry["level"], tag: string, msg: string, data?: any) => {
    entries.push({ t: Date.now(), level, tag, msg, data });
    // also mirror to server console for stack_modern logs
    const line = `[${tag}] ${msg}` + (data ? ` :: ${JSON.stringify(data).slice(0, 400)}` : "");
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  };
  return {
    entries,
    info: (tag: string, msg: string, data?: any) => push("info", tag, msg, data),
    warn: (tag: string, msg: string, data?: any) => push("warn", tag, msg, data),
    error: (tag: string, msg: string, data?: any) => push("error", tag, msg, data),
  };
}

// ---- Reddit ----
// reddit.com blocks/limits Cloudflare Worker UAs aggressively. We try multiple hosts
// with rotating UAs and fall back to the search-result preview if the post JSON fails.
const REDDIT_HOSTS = ["www.reddit.com", "old.reddit.com", "api.reddit.com"];
const UAS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "TobiAI/1.0 (research assistant; +https://lovable.dev)",
];

async function redditFetch(path: string, log: ReturnType<typeof makeLogger>): Promise<any> {
  let lastErr = "";
  // 1) direct attempts to reddit hosts
  for (const host of REDDIT_HOSTS) {
    for (const ua of UAS) {
      const url = `https://${host}${path}`;
      try {
        log.info("reddit.fetch", `GET ${url}`, { ua: ua.slice(0, 30) });
        const res = await fetch(url, {
          headers: { "User-Agent": ua, Accept: "application/json, */*" },
          // @ts-ignore – cf workers honor this
          cf: { cacheTtl: 0 },
        });
        const ct = res.headers.get("content-type") || "";
        log.info("reddit.fetch", `← ${res.status} ${ct}`);
        if (!res.ok) { lastErr = `${host} → ${res.status}`; continue; }
        const text = await res.text();
        if (!text.trim().startsWith("{") && !text.trim().startsWith("[")) {
          lastErr = `${host} → non-JSON (${text.slice(0, 80)}…)`;
          log.warn("reddit.fetch", lastErr);
          continue;
        }
        return JSON.parse(text);
      } catch (e: any) {
        lastErr = `${host} → ${e?.message || e}`;
        log.warn("reddit.fetch", lastErr);
      }
    }
  }
  // 2) fallback: r.jina.ai reader proxy — free, no key. Often rate-limited too.
  for (const host of REDDIT_HOSTS) {
    const url = `https://r.jina.ai/https://${host}${path}`;
    try {
      log.info("reddit.fetch", `jina GET ${url}`);
      const res = await fetch(url, {
        headers: { "User-Agent": UAS[0], Accept: "application/json, text/plain, */*", "X-Return-Format": "text" },
      });
      log.info("reddit.fetch", `← jina ${res.status}`);
      if (!res.ok) { lastErr = `jina(${host}) → ${res.status}`; continue; }
      const text = await res.text();
      const start = Math.min(...["{", "["].map((c) => { const i = text.indexOf(c); return i < 0 ? Infinity : i; }));
      if (!Number.isFinite(start)) { lastErr = `jina(${host}) → no JSON in body`; continue; }
      try { return JSON.parse(text.slice(start)); }
      catch (e: any) { lastErr = `jina(${host}) → parse fail (${e?.message})`; log.warn("reddit.fetch", lastErr); }
    } catch (e: any) {
      lastErr = `jina(${host}) → ${e?.message || e}`;
      log.warn("reddit.fetch", lastErr);
    }
  }

  // 3) final fallback: Firecrawl — paid, very reliable. Scrapes the .json endpoint
  //    as rawHtml (which for a JSON URL is just the JSON text).
  const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
  if (FIRECRAWL_API_KEY) {
    for (const host of REDDIT_HOSTS) {
      const target = `https://${host}${path}`;
      try {
        log.info("reddit.fetch", `firecrawl scrape ${target}`);
        const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
          method: "POST",
          headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ url: target, formats: ["rawHtml"], onlyMainContent: false }),
        });
        log.info("reddit.fetch", `← firecrawl ${res.status}`);
        if (!res.ok) { lastErr = `firecrawl(${host}) → ${res.status} ${(await res.text()).slice(0,120)}`; continue; }
        const body = await res.json() as any;
        const raw: string = body?.data?.rawHtml || body?.data?.html || body?.data?.markdown || "";
        if (!raw) { lastErr = `firecrawl(${host}) → empty body`; continue; }
        // strip any HTML wrapper firecrawl might add around plain JSON
        const stripped = raw.replace(/<[^>]+>/g, "").trim();
        const start = Math.min(...["{", "["].map((c) => { const i = stripped.indexOf(c); return i < 0 ? Infinity : i; }));
        if (!Number.isFinite(start)) { lastErr = `firecrawl(${host}) → no JSON in body`; continue; }
        try { return JSON.parse(stripped.slice(start)); }
        catch (e: any) { lastErr = `firecrawl(${host}) → parse fail (${e?.message})`; log.warn("reddit.fetch", lastErr); }
      } catch (e: any) {
        lastErr = `firecrawl(${host}) → ${e?.message || e}`;
        log.warn("reddit.fetch", lastErr);
      }
    }
  } else {
    log.warn("reddit.fetch", "FIRECRAWL_API_KEY not set — skipping firecrawl fallback");
  }

  throw new Error(`All Reddit routes failed: ${lastErr}`);
}

async function fetchReddit(args: { url?: string; query?: string; subreddit?: string }, log: ReturnType<typeof makeLogger>) {
  let permalinkPath: string | null = null;

  if (args.url) {
    const u = new URL(args.url.startsWith("http") ? args.url : `https://${args.url}`);
    permalinkPath = u.pathname.replace(/\/?$/, "");
  } else {
    const q = (args.query || "").trim();
    if (!q) throw new Error("Need a url or query");
    const sub = args.subreddit ? `r/${args.subreddit}/` : "";
    const searchPath = `/${sub}search.json?q=${encodeURIComponent(q)}&restrict_sr=${args.subreddit ? "on" : "off"}&sort=relevance&limit=5&raw_json=1`;
    log.info("reddit.search", `query="${q}" sub="${args.subreddit ?? ""}"`);
    const sdata = await redditFetch(searchPath, log);
    const first = sdata?.data?.children?.[0]?.data;
    if (!first) throw new Error("No matching reddit posts found");
    permalinkPath = first.permalink.replace(/\/?$/, "");
    log.info("reddit.search", `top → ${first.title?.slice(0, 60)}…`);
  }

  const jsonPath = `${permalinkPath}.json?limit=200&depth=4&raw_json=1`;
  const data = await redditFetch(jsonPath, log);
  const arr = Array.isArray(data) ? data : [];
  const post = arr?.[0]?.data?.children?.[0]?.data;
  if (!post) throw new Error("Could not parse reddit post payload");

  const flat: any[] = [];
  function walk(node: any, depth: number) {
    if (!node || node.kind !== "t1") return;
    const d = node.data;
    if (!d || d.body === "[deleted]" || d.body === "[removed]") return;
    flat.push({
      id: d.id, author: d.author || "unknown", body: d.body || "",
      score: d.score ?? 0, depth, createdUtc: d.created_utc,
    });
    const replies = d.replies?.data?.children;
    if (Array.isArray(replies)) replies.forEach((r) => walk(r, depth + 1));
  }
  const top = arr?.[1]?.data?.children ?? [];
  top.forEach((c: any) => walk(c, 0));

  log.info("reddit.parse", `post="${post.title?.slice(0,60)}…" comments=${flat.length}`);

  return {
    id: post.id,
    source: "reddit" as const,
    subreddit: post.subreddit,
    title: post.title,
    author: post.author,
    body: post.selftext || "",
    url: `https://www.reddit.com${post.permalink}`,
    score: post.score,
    numComments: post.num_comments,
    comments: flat.slice(0, 100),
  };
}

async function findPlaces(query: string, near: string | undefined, log: ReturnType<typeof makeLogger>) {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
  if (!GOOGLE_MAPS_API_KEY) throw new Error("GOOGLE_MAPS_API_KEY missing");

  const textQuery = near ? `${query} near ${near}` : query;
  log.info("places.search", textQuery);
  const res = await fetch("https://connector-gateway.lovable.dev/google_maps/places/v1/places:searchText", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
      "Content-Type": "application/json",
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.websiteUri,places.googleMapsUri,places.primaryTypeDisplayName",
    },
    body: JSON.stringify({ textQuery, pageSize: 8 }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Places API failed [${res.status}]: ${t}`);
  }
  const data = await res.json() as { places?: any[] };
  const places = (data.places ?? []).map((p) => ({
    id: p.id,
    name: p.displayName?.text ?? "Unknown",
    address: p.formattedAddress ?? "",
    lat: p.location?.latitude,
    lng: p.location?.longitude,
    rating: p.rating,
    ratingCount: p.userRatingCount,
    type: p.primaryTypeDisplayName?.text,
    website: p.websiteUri,
    mapsUrl: p.googleMapsUri,
  })).filter((p) => typeof p.lat === "number" && typeof p.lng === "number");
  log.info("places.search", `→ ${places.length} results`);
  return places;
}

async function callAI(messages: any[], mode: "normal" | "research", log: ReturnType<typeof makeLogger>) {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

  const model = mode === "research" ? "google/gemini-2.5-pro" : "google/gemini-3-flash-preview";
  log.info("ai.request", `${model} (${messages.length} msgs)`);
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, tools }),
  });
  if (!res.ok) {
    const t = await res.text();
    log.error("ai.request", `failed [${res.status}]`, { body: t.slice(0, 300) });
    throw new Response(JSON.stringify({ error: `AI gateway error [${res.status}]: ${t}` }), {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  }
  const json = await res.json() as any;
  const finish = json?.choices?.[0]?.finish_reason;
  log.info("ai.response", `finish=${finish}`);
  return json;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const log = makeLogger();
        try {
          const json = await request.json();
          const parsed = BodySchema.safeParse(json);
          if (!parsed.success) {
            return new Response(JSON.stringify({ error: "Invalid input", logs: log.entries }), { status: 400, headers: { "Content-Type": "application/json" } });
          }
          const { messages, mode } = parsed.data;
          log.info("chat", `mode=${mode} messages=${messages.length}`);

          const sys = SYSTEM_PROMPT + (mode === "research" ? RESEARCH_PROMPT : "");
          const convo: any[] = [{ role: "system", content: sys }, ...messages];

          let collectedPlaces: any[] | null = null;
          let collectedPost: any = null;
          let toolUsed: string | null = null;

          for (let i = 0; i < 3; i++) {
            const data = await callAI(convo, mode, log);
            const choice = data.choices?.[0];
            const msg = choice?.message;
            if (!msg) break;

            const toolCalls = msg.tool_calls;
            if (toolCalls && toolCalls.length > 0) {
              convo.push(msg);
              for (const tc of toolCalls) {
                const name = tc.function?.name;
                let args: any = {};
                try { args = JSON.parse(tc.function.arguments || "{}"); } catch {}
                log.info("tool.call", `${name}`, args);

                if (name === "find_places") {
                  try {
                    const places = await findPlaces(String(args.query || ""), args.near ? String(args.near) : undefined, log);
                    collectedPlaces = places;
                    toolUsed = "find_places";
                    convo.push({ role: "tool", tool_call_id: tc.id, name, content: JSON.stringify({ count: places.length, places: places.slice(0, 8) }) });
                  } catch (e: any) {
                    log.error("tool.error", `find_places: ${e?.message}`);
                    convo.push({ role: "tool", tool_call_id: tc.id, name, content: JSON.stringify({ error: e?.message || "tool failed" }) });
                  }
                } else if (name === "fetch_reddit") {
                  try {
                    const post = await fetchReddit(args, log);
                    collectedPost = post;
                    toolUsed = "fetch_reddit";
                    convo.push({
                      role: "tool", tool_call_id: tc.id, name,
                      content: JSON.stringify({
                        title: post.title, subreddit: post.subreddit, author: post.author,
                        score: post.score, numComments: post.numComments,
                        body: post.body.slice(0, 1500),
                        topComments: post.comments.slice(0, 5).map((c: any) => ({ author: c.author, score: c.score, body: c.body.slice(0, 400) })),
                      }),
                    });
                  } catch (e: any) {
                    log.error("tool.error", `fetch_reddit: ${e?.message}`);
                    convo.push({ role: "tool", tool_call_id: tc.id, name, content: JSON.stringify({ error: e?.message || "tool failed", hint: "Reddit blocked the request from the server. Tell the user honestly." }) });
                  }
                }
              }
              continue;
            }

            return new Response(JSON.stringify({
              text: msg.content ?? "",
              places: collectedPlaces,
              post: collectedPost,
              tool: toolUsed,
              logs: log.entries,
            }), { headers: { "Content-Type": "application/json" } });
          }

          return new Response(JSON.stringify({ text: "I had trouble finishing that thought — try again?", places: collectedPlaces, post: collectedPost, tool: toolUsed, logs: log.entries }), { headers: { "Content-Type": "application/json" } });
        } catch (e: any) {
          if (e instanceof Response) {
            // attach logs to the body
            try {
              const body = await e.clone().json();
              return new Response(JSON.stringify({ ...body, logs: log.entries }), { status: e.status, headers: { "Content-Type": "application/json" } });
            } catch { return e; }
          }
          log.error("chat", e?.message || String(e));
          return new Response(JSON.stringify({ error: e?.message || "Unknown error", logs: log.entries }), { status: 500, headers: { "Content-Type": "application/json" } });
        }
      },
    },
  },
});
