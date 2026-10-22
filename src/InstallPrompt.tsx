import { useEffect, useRef, useState } from "react";
import { ArrowUpFromLine, Smartphone, X } from "lucide-react";

const STORAGE_KEY = "crp-install-v1";
const VISIT_GAP = 30 * 60_000;
const ENGAGED_TIME = 3 * 60_000;
const SNOOZE_TIME = 14 * 86_400_000;
type Preference = {
  visits: number;
  lastSeen: number;
  dismissedUntil: number;
  installed: boolean;
};
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
function readPreference(): Preference {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return {
      visits:
        Number.isSafeInteger(saved.visits) && saved.visits > 0
          ? saved.visits
          : 0,
      lastSeen: Number.isFinite(saved.lastSeen) ? saved.lastSeen : 0,
      dismissedUntil: Number.isFinite(saved.dismissedUntil)
        ? saved.dismissedUntil
        : 0,
      installed: saved.installed === true,
    };
  } catch {
    return { visits: 0, lastSeen: 0, dismissedUntil: 0, installed: false };
  }
}
function savePreference(patch: Partial<Preference>) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...readPreference(), ...patch }),
    );
  } catch {
    // Private browsing or blocked storage must not prevent using the app.
  }
}

export function InstallPrompt() {
  const [eligible, setEligible] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);
  const [offer, setOffer] = useState<InstallEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const [instructions, setInstructions] = useState<"ios" | "fallback" | null>(
    null,
  );
  const help = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const display = matchMedia("(display-mode: standalone)");
    const isStandalone = () =>
      display.matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const saved = readPreference();
    const now = Date.now();
    const visits =
      saved.visits +
      (!saved.lastSeen || now - saved.lastSeen >= VISIT_GAP ? 1 : 0);
    savePreference({ visits, lastSeen: now });
    setEligible(visits >= 3);
    setBlocked(saved.installed || saved.dismissedUntil > now);
    setIos(
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    );
    setStandalone(isStandalone());

    const installed = () => {
      savePreference({ installed: true });
      setBlocked(true);
      setOffer(null);
      help.current?.close();
    };
    const displayChanged = () => {
      setStandalone(isStandalone());
      if (isStandalone()) installed();
    };
    if (isStandalone()) installed();
    const beforeInstall = (event: Event) => {
      // Defer browser promotion until our engagement gate and a user click.
      event.preventDefault();
      setOffer(event as InstallEvent);
    };
    const storageChanged = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const current = readPreference();
      setBlocked(current.installed || current.dismissedUntil > Date.now());
    };
    let active = 0;
    let visibleSince: number | null = null;
    let timer: number | undefined;
    const visibilityChanged = () => {
      if (visibleSince !== null) active += performance.now() - visibleSince;
      visibleSince = null;
      clearTimeout(timer);
      savePreference({ lastSeen: Date.now() });
      if (document.visibilityState !== "visible") return;
      visibleSince = performance.now();
      timer = window.setTimeout(
        () => {
          if (document.visibilityState === "visible") setEligible(true);
        },
        Math.max(0, ENGAGED_TIME - active),
      );
    };
    const pageHidden = () => savePreference({ lastSeen: Date.now() });
    visibilityChanged();
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", installed);
    window.addEventListener("storage", storageChanged);
    window.addEventListener("pagehide", pageHidden);
    document.addEventListener("visibilitychange", visibilityChanged);
    display.addEventListener("change", displayChanged);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", installed);
      window.removeEventListener("storage", storageChanged);
      window.removeEventListener("pagehide", pageHidden);
      document.removeEventListener("visibilitychange", visibilityChanged);
      display.removeEventListener("change", displayChanged);
    };
  }, []);

  useEffect(() => {
    if (instructions) help.current?.showModal();
  }, [instructions]);

  function dismiss() {
    savePreference({ dismissedUntil: Date.now() + SNOOZE_TIME });
    setBlocked(true);
    setInstructions(null);
    // The suggestion disappears, so restore focus to the adjacent header action.
    const next =
      help.current
        ?.closest<HTMLDialogElement>("dialog.sheet")
        ?.querySelector<HTMLElement>(".sheet-heading button") ??
      document.querySelector<HTMLElement>("main");
    next?.focus();
  }
  async function install() {
    if (!offer) {
      setInstructions("ios");
      return;
    }
    setBusy(true);
    try {
      await offer.prompt();
      const choice = await offer.userChoice;
      if (choice.outcome === "accepted") savePreference({ installed: true });
      dismiss();
    } catch {
      setInstructions("fallback");
    } finally {
      setOffer(null);
      setBusy(false);
    }
  }
  const show = eligible && !blocked && !standalone && (ios || offer);
  return (
    <>
      {show ? (
        <span className="install-offer" role="group" aria-label="Installer Fin">
          <button className="install-action" onClick={install} disabled={busy}>
            <Smartphone size={14} />
            {busy ? "Ouverture…" : "Installer"}
          </button>
          <button
            className="install-dismiss"
            aria-label="Masquer la proposition d’installation"
            onClick={dismiss}
          >
            <X size={13} />
          </button>
        </span>
      ) : null}
      <dialog
        ref={help}
        className="install-help"
        aria-labelledby="install-title"
        onClose={dismiss}
      >
        <div className="dialog-heading">
          <h2 id="install-title">Installer Fin</h2>
          <button
            className="icon-button"
            aria-label="Fermer le guide d’installation"
            onClick={() => help.current?.close()}
          >
            <X size={18} />
          </button>
        </div>
        {instructions === "ios" ? (
          <>
            <p>Ajouter Fin à l’écran d’accueil.</p>
            <ol>
              <li>
                Ouvrir le menu <strong>Partager</strong> du navigateur{" "}
                <ArrowUpFromLine size={15} aria-hidden="true" />.
              </li>
              <li>
                Choisir <strong>Sur l’écran d’accueil</strong>.
              </li>
              <li>
                Activer <strong>Ouvrir comme app web</strong> si proposé, puis
                choisir <strong>Ajouter</strong>.
              </li>
            </ol>
            <p className="small-note">
              Si le partage est absent, ouvrir cette page dans Safari.
            </p>
          </>
        ) : (
          <p>
            Ouvrir le menu du navigateur et choisir <strong>Installer</strong>.
            Si l’installation est indisponible, recharger la page puis
            réessayer.
          </p>
        )}
        <button className="secondary" onClick={() => help.current?.close()}>
          Fermer
        </button>
      </dialog>
    </>
  );
}
