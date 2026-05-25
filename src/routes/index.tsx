import { createFileRoute } from "@tanstack/react-router";
import { TobiApp } from "@/components/tobi/TobiApp";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Tobi — your interactive AI" },
      { name: "description", content: "Chat with Tobi: code help, deep research, and real-world place discovery on an interactive map." },
    ],
  }),
});

function Index() {
  return <TobiApp />;
}
