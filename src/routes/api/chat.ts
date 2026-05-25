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
- Find places in the real world using the find_places tool. ALWAYS call find_places when the user asks about locations, addresses, restaurants, landmarks, "near me", "where is", "find a", etc. After the tool runs, write a short, friendly summary of what you found — the map UI will render the actual results.
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

async function fetchReddit(args: { url?: string; query?: string; subreddit?: string }) {
  const headers = { "User-Agent": "TobiAI/1.0 (by /u/tobi)" } as Record<string, string>;
  let postUrl = args.url;
  if (!postUrl) {
    const q = (args.query || "").trim();
    if (!q) throw new Error("Need a url or query");
    const sub = args.subreddit ? `r/${args.subreddit}/` : "";
    const searchUrl = `https://www.reddit.com/${sub}search.json?q=${encodeURIComponent(q)}&restrict_sr=${args.subreddit ? "on" : "off"}&sort=relevance&limit=5`;
    const sres = await fetch(searchUrl, { headers });
    if (!sres.ok) throw new Error(`Reddit search failed [${sres.status}]`);
    const sdata = await sres.json() as any;
    const first = sdata?.data?.children?.[0]?.data;
    if (!first) throw new Error("No reddit posts found");
    postUrl = `https://www.reddit.com${first.permalink}`;
  }
  // Normalize → .json
  const jsonUrl = postUrl.replace(/\/?$/, "").replace(/\.json$/, "") + ".json?limit=200&depth=4";
  const res = await fetch(jsonUrl, { headers });
  if (!res.ok) throw new Error(`Reddit fetch failed [${res.status}]`);
  const data = await res.json() as any[];
  const post = data?.[0]?.data?.children?.[0]?.data;
  if (!post) throw new Error("Could not parse reddit post");

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
  const top = data?.[1]?.data?.children ?? [];
  top.forEach((c: any) => walk(c, 0));

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

async function findPlaces(query: string, near?: string) {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
  if (!GOOGLE_MAPS_API_KEY) throw new Error("GOOGLE_MAPS_API_KEY missing");

  const textQuery = near ? `${query} near ${near}` : query;
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
  return places;
}

async function callAI(messages: any[], mode: "normal" | "research") {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

  const body: any = {
    model: mode === "research" ? "google/gemini-2.5-pro" : "google/gemini-3-flash-preview",
    messages,
    tools,
  };

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Response(JSON.stringify({ error: `AI gateway error [${res.status}]: ${t}` }), {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  }
  return res.json() as Promise<any>;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const json = await request.json();
          const parsed = BodySchema.safeParse(json);
          if (!parsed.success) {
            return new Response(JSON.stringify({ error: "Invalid input" }), { status: 400, headers: { "Content-Type": "application/json" } });
          }
          const { messages, mode } = parsed.data;

          const sys = SYSTEM_PROMPT + (mode === "research" ? RESEARCH_PROMPT : "");
          const convo: any[] = [{ role: "system", content: sys }, ...messages];

          let collectedPlaces: any[] | null = null;
          let collectedPost: any = null;
          let toolUsed: string | null = null;

          for (let i = 0; i < 3; i++) {
            const data = await callAI(convo, mode);
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

                if (name === "find_places") {
                  try {
                    const places = await findPlaces(String(args.query || ""), args.near ? String(args.near) : undefined);
                    collectedPlaces = places;
                    toolUsed = "find_places";
                    convo.push({ role: "tool", tool_call_id: tc.id, name, content: JSON.stringify({ count: places.length, places: places.slice(0, 8) }) });
                  } catch (e: any) {
                    convo.push({ role: "tool", tool_call_id: tc.id, name, content: JSON.stringify({ error: e?.message || "tool failed" }) });
                  }
                } else if (name === "fetch_reddit") {
                  try {
                    const post = await fetchReddit(args);
                    collectedPost = post;
                    toolUsed = "fetch_reddit";
                    // Send the model a compact view (title + body + first 5 comments)
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
                    convo.push({ role: "tool", tool_call_id: tc.id, name, content: JSON.stringify({ error: e?.message || "tool failed" }) });
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
            }), { headers: { "Content-Type": "application/json" } });
          }

          return new Response(JSON.stringify({ text: "I had trouble finishing that thought — try again?", places: collectedPlaces, post: collectedPost, tool: toolUsed }), { headers: { "Content-Type": "application/json" } });
        } catch (e: any) {
          if (e instanceof Response) return e;
          console.error("chat error", e);
          return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), { status: 500, headers: { "Content-Type": "application/json" } });
        }
      },
    },
  },
});
