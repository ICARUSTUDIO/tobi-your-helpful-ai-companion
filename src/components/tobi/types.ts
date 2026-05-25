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

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  places?: Place[] | null;
  mode?: "normal" | "research";
  pending?: boolean;
}
