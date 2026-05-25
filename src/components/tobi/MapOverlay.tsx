import { useEffect, useMemo, useRef, useState } from "react";
import type { Place } from "./types";

declare global {
  interface Window {
    google?: any;
    __tobiInitMap?: () => void;
    __tobiMapsLoading?: Promise<void>;
  }
}

function loadMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (window.__tobiMapsLoading) return window.__tobiMapsLoading;

  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
  const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;
  if (!key) return Promise.reject(new Error("Google Maps browser key missing"));

  window.__tobiMapsLoading = new Promise<void>((resolve, reject) => {
    window.__tobiInitMap = () => resolve();
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__tobiInitMap${channel ? `&channel=${channel}` : ""}`;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
  return window.__tobiMapsLoading;
}

interface Props {
  places: Place[];
  summary: string;
  onClose: () => void;
}

export function MapOverlay({ places, summary, onClose }: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObj = useRef<any>(null);
  const markers = useRef<any[]>([]);
  const [active, setActive] = useState<string | null>(places[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);

  const center = useMemo(() => {
    if (places.length === 0) return { lat: 0, lng: 0 };
    const lat = places.reduce((a, p) => a + p.lat, 0) / places.length;
    const lng = places.reduce((a, p) => a + p.lng, 0) / places.length;
    return { lat, lng };
  }, [places]);

  useEffect(() => {
    let cancelled = false;
    loadMaps()
      .then(() => {
        if (cancelled || !mapRef.current || !window.google) return;
        const g = window.google;
        mapObj.current = new g.maps.Map(mapRef.current, {
          center,
          zoom: 12,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
          styles: [
            { elementType: "geometry", stylers: [{ color: "#1a1f2e" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#1a1f2e" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#8b95a8" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a3142" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1420" }] },
            { featureType: "poi", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] },
          ],
        });

        const bounds = new g.maps.LatLngBounds();
        markers.current = places.map((p) => {
          const m = new g.maps.Marker({
            position: { lat: p.lat, lng: p.lng },
            map: mapObj.current,
            title: p.name,
            label: { text: "●", color: "#0f1420", fontSize: "16px", fontWeight: "700" },
            icon: {
              path: g.maps.SymbolPath.CIRCLE,
              scale: 14,
              fillColor: "#5eead4",
              fillOpacity: 1,
              strokeColor: "#0f1420",
              strokeWeight: 2,
            },
          });
          m.addListener("click", () => setActive(p.id));
          bounds.extend({ lat: p.lat, lng: p.lng });
          return m;
        });
        if (places.length > 1) mapObj.current.fitBounds(bounds, 60);
      })
      .catch((e) => setError(e.message));
    return () => {
      cancelled = true;
      markers.current.forEach((m) => m.setMap(null));
      markers.current = [];
    };
  }, [places, center]);

  useEffect(() => {
    if (!mapObj.current || !active) return;
    const p = places.find((x) => x.id === active);
    if (!p) return;
    mapObj.current.panTo({ lat: p.lat, lng: p.lng });
  }, [active, places]);

  return (
    <div className="absolute inset-0 z-30 bg-background animate-in fade-in duration-300">
      <div ref={mapRef} className="absolute inset-0" />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-destructive">{error}</div>
      )}

      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 left-4 z-10 rounded-full bg-card/90 backdrop-blur px-4 py-2 text-sm font-medium text-foreground border border-border hover:bg-card transition"
      >
        ← Back to chat
      </button>

      {/* Captions: top-right scrollable, non-intrusive */}
      <div className="absolute top-4 right-4 bottom-32 w-[min(380px,calc(100vw-2rem))] z-10 flex flex-col gap-3 pointer-events-none">
        <div className="pointer-events-auto rounded-2xl bg-card/85 backdrop-blur-xl border border-border p-4 shadow-2xl">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-tobi font-semibold">
            <span className="size-2 rounded-full bg-tobi animate-pulse" /> Tobi found {places.length} {places.length === 1 ? "place" : "places"}
          </div>
          <p className="mt-2 text-sm text-foreground/90 leading-relaxed line-clamp-4">{summary}</p>
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
                >Open in Google Maps ↗</a>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
