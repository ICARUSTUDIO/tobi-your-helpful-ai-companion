# Tobi AI

**Tobi AI** is a personalized, interactive AI assistant built to feel more useful and continuous than a one-off chatbot conversation. It can help with coding and debugging, deep research, document-based work, location discovery through interactive maps, and persistent user memories so conversations can pick up where previous ones left off.

> **Status: Under active development.** Tobi AI is a working live project, but features, integrations, UI, and infrastructure are still being improved and may change as development continues.

## Live application

**https://t-obi.xyz**

## What Tobi AI does

- **Coding and debugging** — writes, explains, reviews, and helps fix code across different stacks.
- **Deep research** — gathers and synthesizes information into practical answers rather than returning a single search result.
- **Interactive maps** — helps users discover places, explore areas, and work with location-based results directly in the experience.
- **Document interaction** — supports document-driven conversations and analysis.
- **Persistent memories** — stores user-specific information with consent so future conversations can retain useful context.
- **Conversation history** — authenticated users can return to previous conversations instead of starting from zero each time.
- **Authentication** — supports account-based access, including email and Google sign-in flows.

## Why I built it

Most AI chat experiences are useful in the moment but lose context between sessions or require users to repeatedly explain the same projects, preferences, and goals. Tobi AI is an experiment in building a more personal assistant around continuity: combining conversational AI with memory, research, tools, documents, and location-aware experiences in one product.

The project is also a practical full-stack engineering playground for working with AI integrations, authentication, persistent data, server routes, external APIs, deployment infrastructure, and increasingly complex UI state.

## Technology

Tobi AI currently uses:

- **React 19**
- **TypeScript**
- **TanStack Start**
- **TanStack Router**
- **TanStack Query**
- **Supabase** for backend data and authentication-related workflows
- **Cloudflare** tooling for deployment and edge infrastructure
- **Vite**
- **Tailwind CSS**
- **Zod** for validation
- **React Hook Form**
- **Leaflet** for map-based functionality
- **React Markdown / remark-gfm** for rich conversational output
- Document-processing utilities including **Mammoth** and **SheetJS**

## Application structure

The application is organized around TanStack Start routes and authenticated application areas.

```text
src/
├── components/       # Reusable UI and Tobi-specific application components
├── hooks/            # Shared React hooks and application state helpers
├── integrations/     # External service integrations
├── lib/              # Shared utilities
├── routes/           # Public, authenticated, API, legal, and application routes
├── router.tsx        # TanStack Router setup
├── server.ts         # Server-side application entry
└── styles.css        # Global styling
```

Public routes include the landing page, authentication, privacy policy, terms, and sitemap, while the main Tobi experience is protected behind authenticated routes.

## Local development

### Prerequisites

- Node.js 20+ or a compatible Bun installation
- npm or Bun
- Access to the external services required by the application

### Install

```bash
git clone https://github.com/ICARUSTUDIO/tobi-your-helpful-ai-companion.git
cd tobi-your-helpful-ai-companion
npm install
```

### Run locally

```bash
npm run dev
```

### Production build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

## Development status

Tobi AI is **not finished**. The current live version demonstrates the core product direction, but I am actively working on areas such as:

- Improving reliability of AI/tool interactions
- Expanding and refining research capabilities
- Improving memory controls and user transparency
- Strengthening document workflows
- Improving map and location experiences
- Hardening authentication and server-side behavior
- Expanding automated testing and engineering checks
- Improving deployment reliability and observability
- Refactoring larger application areas as the product grows
- General UX, accessibility, and performance improvements

Because the project is still under development, some functionality may be experimental or change between releases.

## Privacy and user control

Memory is intended to be user-aware rather than invisible. Tobi AI's product direction is to retain useful personal context only when appropriate and to give users control over the information associated with their account.

The application also includes dedicated privacy and terms pages in the public site.

## Project goals

The longer-term goal is to make Tobi AI a capable personal assistant that combines:

1. High-quality conversational help
2. Software-development assistance
3. Research and information synthesis
4. Useful tool integrations
5. Persistent, consent-based context
6. A polished web experience that works across devices

## Author

Built and maintained by **Oluwatobi Obafemi**.

- GitHub: https://github.com/ICARUSTUDIO
- Live application: https://t-obi.xyz

---

If you are viewing this project as part of my engineering portfolio, the repository represents an actively evolving product rather than a frozen demo. I am continuing to iterate on both the user experience and the underlying engineering as Tobi AI develops.


## Model provider configuration

Tobi AI uses an OpenAI-compatible model endpoint. Configure `AI_API_KEY` and `AI_GATEWAY_URL` in the server environment. The default endpoint is compatible with OpenRouter, while the provider and model can be changed without altering the application architecture.
