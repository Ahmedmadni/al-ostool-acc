import { useEffect, useState } from "react";

const KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
const CHANNEL = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;
const CB_NAME = "__lovableInitGoogleMaps";

let promise: Promise<any> | null = null;

function loadScript(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if ((window as any).google?.maps) return Promise.resolve((window as any).google);
  if (promise) return promise;
  if (!KEY) return Promise.reject(new Error("Google Maps key missing"));

  promise = new Promise((resolve, reject) => {
    (window as any)[CB_NAME] = () => resolve((window as any).google);
    const s = document.createElement("script");
    const ch = CHANNEL ? `&channel=${CHANNEL}` : "";
    s.src = `https://maps.googleapis.com/maps/api/js?key=${KEY}&loading=async&callback=${CB_NAME}${ch}`;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
  return promise;
}

export function useGoogleMaps() {
  const [ready, setReady] = useState<boolean>(typeof window !== "undefined" && !!(window as any).google?.maps);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadScript()
      .then(() => { if (!cancelled) setReady(true); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);
  return { ready, error, hasKey: !!KEY };
}
