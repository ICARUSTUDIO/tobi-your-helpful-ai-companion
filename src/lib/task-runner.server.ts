// Server-only worker that executes a background agent task.
// Small, self-contained tool set: web search, page reading, arithmetic.

type Log = (msg: string) => void;

const TASK_TOOLS = [
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the live web. Returns titles, URLs and snippets.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" }, limit: { type: "number" } },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_url",
      description: "Fetch a web page and read it as clean markdown.",
      parameters: {
        type: "object",
        properties: { url: { type: "string" } },
        required: ["url"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calculate",
      description: "Evaluate an arithmetic expression exactly.",
      parameters: {
        type: "object",
        properties: { expression: { type: "string" } },
        required: ["expression"],
        additionalProperties: false,
      },
    },
  },
];

async function webSearch(query: string, limit: number) {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("Web search is not configured");
  const res = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit: Math.min(Math.max(limit || 5, 1), 8) }),
  });
  if (!res.ok) throw new Error(`search failed ${res.status}`);
  const json = (await res.json()) as any;
  const hits: any[] = json?.data?.web ?? json?.data ?? [];
  return hits
    .slice(0, 8)
    .map((h) => ({
      title: String(h.title ?? h.url ?? "").slice(0, 200),
      url: String(h.url ?? ""),
      snippet: String(h.description ?? h.snippet ?? "").slice(0, 400),
    }))
    .filter((r) => r.url);
}

async function readUrl(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("Only http(s) URLs can be read");
  const key = process.env.JINA_API_KEY;
  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers: key ? { Authorization: `Bearer ${key}` } : {},
  });
  if (!res.ok) throw new Error(`read failed ${res.status}`);
  const md = await res.text();
  if (!md.trim()) throw new Error("That page came back empty");
  return { url, markdown: md.slice(0, 12000), truncated: md.length > 12000 };
}

function calculate(expression: string) {
  const expr = expression.trim();
  if (expr.length > 300) throw new Error("Expression too long");
  if (!/^[0-9+\-*/%().,^\s a-zA-Z]+$/.test(expr)) throw new Error("Unsupported characters");
  const allowed = ["sqrt", "abs", "min", "max", "round", "floor", "ceil", "log", "log2", "log10", "exp", "sin", "cos", "tan", "pow", "pi", "e"];
  for (const n of expr.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) ?? []) {
    if (!allowed.includes(n)) throw new Error(`Unknown name: ${n}`);
  }
  const js = expr
    .replace(/\^/g, "**")
    .replace(/[a-zA-Z_][a-zA-Z0-9_]*/g, (m) => (m === "pi" ? "Math.PI" : m === "e" ? "Math.E" : `Math.${m}`));
  const value = Function(`"use strict"; return (${js});`)() as unknown;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Not a finite number");
  return { expression, value };
}

async function callModel(messages: any[]) {
  const key = process.env.AI_API_KEY;
  if (!key) throw new Error("AI_API_KEY missing");
  const res = await fetch(process.env.AI_GATEWAY_URL ?? "https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "google/gemini-2.5-pro", messages, tools: TASK_TOOLS }),
  });
  if (!res.ok) throw new Error(`AI gateway error ${res.status}: ${(await res.text()).slice(0, 180)}`);
  return (await res.json()) as any;
}

const SYSTEM = `You are Tobi working a background job on your own. You have web search, page reading and a calculator.

- Work the task properly: search, read the best sources, cross-check, compute where numbers matter.
- Cite the URLs you actually read.
- Never invent facts, numbers, or sources. Say what you couldn't verify.
- Finish with a clear, self-contained markdown answer the user can read cold - they will not see your intermediate steps.
- Keep it tight: a short summary up front, then the detail.`;

export async function runTaskAgent(instruction: string, log: Log = () => {}): Promise<string> {
  const convo: any[] = [
    { role: "system", content: SYSTEM },
    { role: "user", content: instruction },
  ];

  for (let step = 0; step < 14; step++) {
    const data = await callModel(convo);
    const msg = data.choices?.[0]?.message;
    if (!msg) break;
    const calls = msg.tool_calls;
    if (!calls || calls.length === 0) return String(msg.content ?? "").trim() || "No result produced.";

    convo.push(msg);
    for (const tc of calls) {
      const name = tc.function?.name;
      let args: any = {};
      try {
        args = JSON.parse(tc.function.arguments || "{}");
      } catch {
        /* keep {} */
      }
      log(`tool ${name} ${JSON.stringify(args).slice(0, 120)}`);
      let payload: any;
      try {
        if (name === "web_search") payload = { results: await webSearch(String(args.query || ""), Number(args.limit) || 5) };
        else if (name === "read_url") payload = await readUrl(String(args.url || ""));
        else if (name === "calculate") payload = calculate(String(args.expression || ""));
        else payload = { error: `Unknown tool ${name}` };
      } catch (e: any) {
        payload = { error: e?.message || "tool failed" };
      }
      convo.push({ role: "tool", tool_call_id: tc.id, name, content: JSON.stringify(payload) });
    }
  }

  return "I ran out of steps on this one without a solid answer. Try a narrower version of the task.";
}
