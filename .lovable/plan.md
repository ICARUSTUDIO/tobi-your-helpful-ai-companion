## What I'll build

### 1. Lovable Cloud + Auth
- Enable Lovable Cloud
- Google sign-in (via Lovable broker) + Email/Password
- `/login` page, `/_authenticated` layout guard, sign-out in header
- First-time onboarding modal: ask **name** and **age** (stored in `profiles`)

### 2. Database (schema migration)
- `profiles` — id, name, age, voice_pref, tone_pref, created_at
- `conversations` — id, user_id, title (auto-summarized from first message), updated_at
- `messages` — id, conversation_id, role, content, post (jsonb), places (jsonb), created_at
- `user_facts` — id, user_id, fact, source_message_id, created_at (things Tobi learns: "lives in Lagos", "into running")
- RLS: each user reads/writes only their own rows

### 3. Tobi's new personality (tone = 3, friendly bro)
- Rewrite system prompt in `src/routes/api/chat.ts`:
  - Warm, witty, lightly slangy — "bro/mate/fam" sparingly, never forced
  - Cracks jokes when the moment fits, never on serious topics
  - Uses the user's **name**, references **known facts** naturally
  - Age-aware (different vibe for 16 vs 45)
- Inject `{name, age, facts[]}` into every chat request from saved profile + `user_facts`
- After each assistant reply, a lightweight extractor scans the user's message for durable facts ("I live in…", "I love…", "I work as…") and inserts into `user_facts` (dedup by fuzzy match)

### 4. Conversation history (resumable)
- Sidebar drawer with list of past conversations (title + last updated)
- Click → loads messages, continues where they left off
- "New chat" button creates a fresh conversation
- Auto-title after first exchange (server-generated 4-6 word title)
- All messages persisted as they're sent/received

### 5. Natural voice (ElevenLabs + browser fallback)
- New server route `/api/tts` that calls ElevenLabs (`eleven_turbo_v2_5`, voice **Sarah** by default, user-pickable)
- `ReaderDock` switches to streaming MP3 playback via `<audio>`
- Web Audio AnalyserNode drives the **green glow pulse** from real audio frequency (replaces the fake intensity hack)
- If ElevenLabs returns 401/429/5xx → automatic fallback to current browser TTS, with a small "using free voice" badge
- Voice + rate stored in `profiles.voice_pref`

### 6. Polish
- Header shows avatar + name, dropdown with "New chat", "History", "Voice settings", "Sign out"
- Loading skeletons for history list

## Technical details

- ElevenLabs needs `ELEVENLABS_API_KEY` secret — I'll request it after Cloud is enabled
- Google OAuth: I'll call `supabase--configure_social_auth` with `providers: ["google"]` in the same turn the broker call is added
- Fact extraction runs server-side inside the chat server fn using a tiny Lovable AI Gateway call (cheap model) — no extra UI
- Proton Mail: clarified to user — no public OAuth, but Proton addresses work via email+password
- Existing TobiApp local message state stays; I'll layer Supabase persistence on top so it still feels instant (optimistic insert, then sync)
- All new tables use the `has_role`-style RLS pattern from the playbook, scoped to `auth.uid()`

## Files I'll touch / add

- DB migration (profiles, conversations, messages, user_facts + RLS)
- `src/routes/login.tsx`, `src/routes/_authenticated.tsx`
- `src/routes/_authenticated/index.tsx` (move TobiApp here)
- `src/components/tobi/OnboardingModal.tsx`
- `src/components/tobi/HistorySidebar.tsx`
- `src/components/tobi/UserMenu.tsx`
- `src/lib/conversations.functions.ts`, `src/lib/profile.functions.ts`, `src/lib/facts.functions.ts`
- `src/routes/api/tts.ts` (ElevenLabs proxy)
- `src/routes/api/chat.ts` (new system prompt + personalization + persistence)
- `src/components/tobi/ReaderDock.tsx` (ElevenLabs playback + real audio-reactive glow)
- `src/components/tobi/TobiApp.tsx` (wire conversation id, history, user context)

Approve and I'll start with Cloud + DB, then auth, then personality + voice.