import { getLanguage, locale } from "./i18n";
export const number = (n: number, d = 0) =>
  Number.isFinite(n)
    ? new Intl.NumberFormat(locale(), {
        maximumFractionDigits: d,
        minimumFractionDigits: d,
      }).format(n)
    : "—";
export const euro = (n: number, d = 0) =>
  getLanguage() === "en"
    ? `${n < 0 ? "-" : ""}€${number(Math.abs(n), d)}`
    : `${number(n, d)} €`;
export const signedEuro = (n: number, d = 0) => {
  const v = Math.abs(n) < 0.5 * 10 ** -d ? 0 : n;
  return `${v > 0 ? "+" : ""}${euro(v, d)}`;
};
export const percent = (n: number, d = 1) => `${number(n * 100, d)}${getLanguage() === "fr" ? " " : ""}%`;
export const date = (s: string, short = false) =>
  new Intl.DateTimeFormat(locale(), {
    day: "numeric",
    month: short ? "short" : "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(s));
export const safeUrl = (s?: string) =>
  s && /^https:\/\//.test(s) ? s : undefined;
export function download(
  name: string,
  content: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const observedTime = (s: string) =>
  new Intl.DateTimeFormat(locale(), {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(new Date(s));
