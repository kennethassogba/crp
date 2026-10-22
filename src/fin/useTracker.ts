import { useCallback, useEffect, useRef, useState } from "react";
import type { Tracker } from "./tracker-types";
export function useTracker() {
  const [data, setData] = useState<Tracker | null>(null),
    [error, setError] = useState("");
  const pending = useRef(false),
    version = useRef(0),
    failed = useRef(false);
  const load = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;
    const current = version.current;
    try {
      const r = await fetch("/api/warrants/tracker", {
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) throw Error();
      const d = await r.json();
      if (!Array.isArray(d.positions) || !d.stats) throw Error();
      if (current === version.current) {
        failed.current = false;
        setData((previous) =>
          previous !== null &&
          previous.updatedAt === d.updatedAt &&
          previous.health.stale === d.health.stale &&
          previous.positions.length === d.positions.length &&
          previous.positions.every(
            (p, i) =>
              p.id === d.positions[i]?.id &&
              p.status === d.positions[i]?.status,
          )
            ? previous
            : d,
        );
        setError("");
      }
    } catch {
      failed.current = true;
      if (current === version.current)
        setError(
          navigator.onLine
            ? "Connexion interrompue. Reconnexion automatique."
            : "Hors ligne. Reconnexion automatique.",
        );
    } finally {
      pending.current = false;
    }
  }, []);
  useEffect(() => {
    load();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 60000);
    const resume = () => {
      if (document.visibilityState === "visible") load();
    };
    const retry = setInterval(() => {
      if (
        failed.current &&
        document.visibilityState === "visible" &&
        navigator.onLine
      )
        load();
    }, 15000);
    window.addEventListener("online", resume);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      version.current++;
      clearInterval(interval);
      clearInterval(retry);
      window.removeEventListener("online", resume);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [load]);
  return { data, error };
}
