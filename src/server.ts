import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

type RuntimeBindings = Record<string, unknown>;

const EXISTING_AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

function getStringBinding(bindings: RuntimeBindings, name: string): string | undefined {
  const value = bindings[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function preserveAiRuntimeConfiguration(env: unknown): void {
  if (typeof process === "undefined" || !process.env) return;

  const bindings: RuntimeBindings = env && typeof env === "object" ? (env as RuntimeBindings) : {};

  const configuredKey = process.env.AI_API_KEY ?? getStringBinding(bindings, "AI_API_KEY");
  const existingKey = process.env.LOVABLE_API_KEY ?? getStringBinding(bindings, "LOVABLE_API_KEY");

  if (!process.env.AI_API_KEY) {
    const key = configuredKey ?? existingKey;
    if (key) process.env.AI_API_KEY = key;
  }

  if (!process.env.AI_GATEWAY_URL) {
    process.env.AI_GATEWAY_URL =
      getStringBinding(bindings, "AI_GATEWAY_URL") ?? EXISTING_AI_GATEWAY_URL;
  }
}

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => ((m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry)),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} - try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      preserveAiRuntimeConfiguration(env);
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};
