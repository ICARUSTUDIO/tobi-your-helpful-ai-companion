import { createFileRoute } from "@tanstack/react-router";
import { TobiApp } from "@/components/tobi/TobiApp";

export const Route = createFileRoute("/_authenticated/app")({
  component: TobiApp,
  head: () => ({
    meta: [
      { title: "Tobi AI: your AI bro" },
      { name: "description", content: "Chat with Tobi AI: your personalized AI that codes, debugs, researches, finds places, and remembers what matters." },
    ],
  }),
});
