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
// Strategy: Worker IPs are blocked by reddit.com directly (403), and Firecrawl refuses
// to scrape reddit.com. So we:
//   - SEARCH via Firecrawl /v2/search with `site:reddit.com ...` (Google-backed, works fine).
//   - SCRAPE a specific thread via r.jina.ai/<url> which returns the page as clean markdown.

async function jinaMarkdown(targetUrl: string, log: ReturnType<typeof makeLogger>): Promise<string> {
  const url = `https://r.jina.ai/${targetUrl}`;
  log.info("reddit.jina", `GET ${url}`);
  const res = await fetch(url, {
    headers: {
      Accept: "text/plain, */*",
      "X-Return-Format": "markdown",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15",
    },
  });
  log.info("reddit.jina", `← ${res.status}`);
  if (!res.ok) throw new Error(`jina ${res.status} for ${targetUrl}`);
  const text = await res.text();
  if (!text || text.length < 50) throw new Error(`jina returned empty body for ${targetUrl}`);
  return text;
}

async function firecrawlSearchReddit(query: string, subreddit: string | undefined, log: ReturnType<typeof makeLogger>) {
  const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
  if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY not set — cannot search Reddit");
  const scoped = subreddit
    ? `site:reddit.com/r/${subreddit} ${query}`
    : `site:reddit.com ${query}`;
  log.info("reddit.search", `firecrawl search: ${scoped}`);
  const res = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: scoped, limit: 8 }),
  });
  log.info("reddit.search", `← firecrawl ${res.status}`);
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`firecrawl search ${res.status}: ${t.slice(0, 200)}`);
  }
  const body = await res.json() as any;
  const results: any[] =
    body?.data?.web ?? body?.data?.results ?? (Array.isArray(body?.data) ? body.data : []) ?? [];
  const filtered = results
    .filter((r) => typeof r?.url === "string" && /reddit\.com\/r\/[^/]+\/comments\//.test(r.url))
    .map((r) => ({
      url: r.url as string,
      title: (r.title || "") as string,
      description: (r.description || r.snippet || "") as string,
    }));
  log.info("reddit.search", `→ ${filtered.length} reddit thread results`);
  return filtered;
}

function extractRedditMeta(markdown: string, url: string) {
  const titleMatch = markdown.match(/^Title:\s*(.+)$/m);
  const title = (titleMatch?.[1] || "").replace(/\s*:\s*r\/\w+\s*$/i, "").trim();
  const subMatch = url.match(/reddit\.com\/r\/([^/]+)\//i);
  const subreddit = subMatch?.[1] || "";
  const contentStart = markdown.indexOf("Markdown Content:");
  const content = contentStart >= 0 ? markdown.slice(contentStart + "Markdown Content:".length).trim() : markdown;
  return { title: title || "Reddit thread", subreddit, content };
}

async function fetchReddit(args: { url?: string; query?: string; subreddit?: string }, log: ReturnType<typeof makeLogger>) {
  let postUrl: string;
  let searchSnippets: { url: string; title: string; description: string }[] = [];

  if (args.url) {
    const u = new URL(args.url.startsWith("http") ? args.url : `https://${args.url}`);
    postUrl = `https://www.reddit.com${u.pathname.replace(/\/?$/, "")}/`;
  } else {
    const q = (args.query || "").trim();
    if (!q) throw new Error("Need a url or query");
    searchSnippets = await firecrawlSearchReddit(q, args.subreddit, log);
    if (searchSnippets.length === 0) throw new Error("No matching reddit threads found via search");
    postUrl = searchSnippets[0].url;
    log.info("reddit.search", `top → ${searchSnippets[0].title.slice(0, 60)}…`);
  }

  let markdown = "";
  try {
    markdown = await jinaMarkdown(postUrl, log);
  } catch (e: any) {
    log.warn("reddit.jina", `failed: ${e?.message}`);
    if (searchSnippets.length > 0) {
      const synth = searchSnippets
        .slice(0, 6)
        .map((s, i) => `### ${i + 1}. ${s.title}\n${s.url}\n\n${s.description}`)
        .join("\n\n---\n\n");
      markdown = `Title: Reddit search results for "${args.query}"\nMarkdown Content:\n${synth}`;
    } else {
      throw e;
    }
  }

  const meta = extractRedditMeta(markdown, postUrl);
  const body = meta.content.slice(0, 8000);

  const paragraphs = body.split(/\n\n+/).map((p) => p.trim()).filter((p) => p.length > 40);
  const comments = paragraphs.slice(0, 30).map((p, i) => ({
    id: `c${i}`,
    author: "redditor",
    body: p,
    score: 0,
    depth: 0,
    createdUtc: 0,
  }));

  log.info("reddit.parse", `post="${meta.title.slice(0, 60)}…" chunks=${comments.length}`);

  return {
    id: postUrl,
    source: "reddit" as const,
    subreddit: meta.subreddit,
    title: meta.title,
    author: "unknown",
    body,
    url: postUrl,
    score: 0,
    numComments: comments.length,
    comments,
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
