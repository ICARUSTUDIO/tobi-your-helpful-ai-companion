import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Place } from "./types";

interface Props {
  places: Place[];
  summary: string;
  onClose: () => void;
}

export function MapOverlay({ places, summary, onClose }: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObj = useRef<L.Map | null>(null);
  const markers = useRef<L.Marker[]>([]);
  const [active, setActive] = useState<string | null>(places[0]?.id ?? null);

  const center = useMemo(() => {
    if (places.length === 0) return { lat: 0, lng: 0 };
    const lat = places.reduce((a, p) => a + p.lat, 0) / places.length;
    const lng = places.reduce((a, p) => a + p.lng, 0) / places.length;
    return { lat, lng };
  }, [places]);

  useEffect(() => {
    if (!mapRef.current || mapObj.current) return;
    const map = L.map(mapRef.current, {
      center: [center.lat, center.lng],
      zoom: 12,
      zoomControl: true,
      attributionControl: true,
    });
    // CARTO Dark Matter — free, no key, matches the app's dark theme
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(map);
    mapObj.current = map;

    const pinIcon = L.divIcon({
      className: "tobi-pin",
      html: '<div style="width:18px;height:18px;border-radius:9999px;background:#5eead4;border:2px solid #0f1420;box-shadow:0 0 12px rgba(94,234,212,0.6)"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    const bounds = L.latLngBounds([]);
    markers.current = places.map((p) => {
      const m = L.marker([p.lat, p.lng], { icon: pinIcon, title: p.name }).addTo(map);
      m.on("click", () => setActive(p.id));
      bounds.extend([p.lat, p.lng]);
      return m;
    });
    if (places.length > 1) map.fitBounds(bounds, { padding: [60, 60] });

    return () => {
      markers.current.forEach((m) => m.remove());
      markers.current = [];
      map.remove();
      mapObj.current = null;
    };
  }, [places, center]);

  useEffect(() => {
    if (!mapObj.current || !active) return;
    const p = places.find((x) => x.id === active);
    if (!p) return;
    mapObj.current.panTo([p.lat, p.lng]);
  }, [active, places]);

  return (
    <div className="absolute inset-0 z-30 bg-background animate-in fade-in duration-300">
      <div ref={mapRef} className="absolute inset-0" style={{ background: "#0e1420" }} />

      <button
        onClick={onClose}
        className="absolute top-4 left-4 z-[1000] rounded-full bg-card/90 backdrop-blur px-4 py-2 text-sm font-medium text-foreground border border-border hover:bg-card transition"
      >
        ← Back to chat
      </button>

      <div className="absolute top-4 right-4 bottom-32 w-[min(380px,calc(100vw-2rem))] z-[1000] flex flex-col gap-3 pointer-events-none">
        <div className="pointer-events-auto rounded-2xl bg-card/85 backdrop-blur-xl border border-border p-4 shadow-2xl">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-tobi font-semibold">
            <span className="size-2 rounded-full bg-tobi animate-pulse" /> Tobi found {places.length} {places.length === 1 ? "place" : "places"}
          </div>
          <div className="prose-tobi mt-2 text-sm text-foreground/90 leading-relaxed max-h-32 overflow-y-auto scrollbar-thin">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
          </div>
        </div>

        <div className="pointer-events-auto flex-1 overflow-y-auto scrollbar-thin space-y-2 pr-1">
          {places.map((p) => (
            <button
              key={p.id}
              onClick={() => setActive(p.id)}
              className={`w-full text-left rounded-xl border p-3 backdrop-blur-xl transition ${
                active === p.id
                  ? "bg-tobi/15 border-tobi/60 glow-ring"
                  : "bg-card/80 border-border hover:bg-card"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-display font-semibold text-sm text-foreground">{p.name}</div>
                {typeof p.rating === "number" && (
                  <div className="text-xs text-tobi shrink-0">★ {p.rating.toFixed(1)}</div>
                )}
              </div>
              {p.type && <div className="text-[11px] uppercase tracking-wide text-muted-foreground mt-0.5">{p.type}</div>}
              <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.address}</div>
              {p.mapsUrl && (
                <a
                  href={p.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="mt-2 inline-block text-[11px] text-tobi hover:underline"
                >Open in OpenStreetMap ↗</a>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
