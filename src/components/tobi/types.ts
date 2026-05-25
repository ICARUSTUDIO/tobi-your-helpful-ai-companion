export type Role = "user" | "assistant";

export interface Place {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating?: number;
  ratingCount?: number;
  type?: string;
  website?: string;
  mapsUrl?: string;
}

export interface RedditComment {
  id: string;
  author: string;
  body: string;
  score: number;
  depth: number;
  createdUtc?: number;
}

export interface RedditPost {
  id: string;
  source: "reddit" | "x" | "instagram" | "facebook" | "tiktok" | "youtube" | "threads" | "linkedin" | "quora" | "hackernews" | "web";
  subreddit?: string;
  title: string;
  author: string;
  body: string;
  url: string;
  score?: number;
  numComments?: number;
  related?: { title: string; url: string; subreddit?: string; score?: number; numComments?: number }[];
  comments: RedditComment[]; // server may return all; we paginate client-side
}

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  places?: Place[] | null;
  post?: RedditPost | null;
  attachments?: { name: string; kind: "docx" | "xlsx"; preview: string }[];
  mode?: "normal" | "research";
  pending?: boolean;
}
