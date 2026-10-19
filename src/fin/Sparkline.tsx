import React from "react";

// Recorded points only. This preview is decorative; the full chart exposes
// dates and values to pointer, touch and keyboard users.
export function Sparkline({
  values,
  times,
  className = "",
}: {
  values: number[];
  times?: number[];
  className?: string;
}) {
  if (!values.length)
    return (
      <span className={`sparkline-empty ${className}`} aria-hidden="true">
        —
      </span>
    );
  const low = Math.min(...values),
    high = Math.max(...values),
    range = Math.max(high - low, Math.abs(high) * 0.0001, 0.001);
  const x = (i: number) =>
    times && times.length === values.length && times.at(-1)! > times[0]
      ? 2 + ((times[i] - times[0]) / (times.at(-1)! - times[0])) * 92
      : values.length === 1
        ? 94
        : 2 + (i / (values.length - 1)) * 92;
  const y = (v: number) => 28 - ((v - low) / range) * 24;
  return (
    <svg
      className={`sparkline ${className}`}
      viewBox="0 0 96 32"
      aria-hidden="true"
      focusable="false"
    >
      {values.length > 1 && (
        <path
          d={values.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ")}
        />
      )}
      <circle cx={x(values.length - 1)} cy={y(values.at(-1)!)} r="1.8" />
    </svg>
  );
}
