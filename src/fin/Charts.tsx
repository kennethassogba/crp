import React from "react";
import { euro, number, percent, signedEuro } from "./format";
import benchmark from "./home-chart.json";

export function PriceChart({
  closes,
  dates,
  name,
}: {
  closes: number[];
  dates: string[];
  name: string;
}) {
  const data = closes.slice(-252),
    min = Math.min(...data) * 0.97,
    max = Math.max(...data) * 1.03;
  const path = data
    .map(
      (v, i) =>
        `${i ? "L" : "M"}${40 + (i / (data.length - 1)) * 710},${178 - ((v - min) / (max - min)) * 145}`,
    )
    .join(" ");
  return (
    <svg
      viewBox="0 0 800 215"
      role="img"
      aria-label={`${name}, clôtures sur un an, dernière valeur ${number(data.at(-1)!, 2)}`}
      className="price-chart"
    >
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <line
            x1="40"
            x2="750"
            y1={33 + i * 72.5}
            y2={33 + i * 72.5}
            className="gridline"
          />
          <text x="760" y={37 + i * 72.5}>
            {number(max - (i / 2) * (max - min))}
          </text>
        </g>
      ))}
      <path d={path} className="price-path" />
      <circle
        cx="750"
        cy={178 - ((data.at(-1)! - min) / (max - min)) * 145}
        r="3"
        className="price-dot"
      />
      {[0, 0.25, 0.5, 0.75, 1].map((q, i) => (
        <text
          key={i}
          x={40 + q * 710}
          y="207"
          textAnchor={i === 0 ? "start" : i === 4 ? "end" : "middle"}
        >
          {new Intl.DateTimeFormat("fr-FR", {
            month: "short",
            timeZone: "UTC",
          }).format(
            new Date(dates.slice(-252)[Math.round(q * (data.length - 1))]),
          )}
        </text>
      ))}
    </svg>
  );
}
export function Distribution({
  net,
  budget,
}: {
  net: number[];
  budget: number;
}) {
  const upper = budget * 10,
    bins = Array.from({ length: 30 }, () => 0);
  net.forEach(
    (v) =>
      bins[
        Math.min(
          29,
          Math.max(
            0,
            Math.floor(((Math.min(v, upper) + budget) / (upper + budget)) * 30),
          ),
        )
      ]++,
  );
  const top = Math.max(...bins),
    zero = 48 + (budget / (upper + budget)) * 690;
  return (
    <figure className="distribution">
      <svg
        viewBox="0 0 790 235"
        role="img"
        aria-label={`Distribution historique : ${percent(net.filter((v) => v <= -budget * 0.99).length / net.length)} des scénarios perdent presque toute la mise. La dernière barre regroupe les gains supérieurs à dix fois le budget.`}
      >
        {[0, 0.5, 1].map((q) => (
          <g key={q}>
            <line
              className="gridline"
              x1="48"
              x2="738"
              y1={185 - q * 150}
              y2={185 - q * 150}
            />
            <text x="37" y={189 - q * 150} textAnchor="end">
              {percent((q * top) / net.length, 0)}
            </text>
          </g>
        ))}
        {bins.map((v, i) => (
          <rect
            key={i}
            x={48 + i * 23}
            y={185 - (v / top) * 150}
            width="18"
            height={Math.max(1, (v / top) * 150)}
            rx="2"
            className={i < 3 ? "hist-loss" : "hist-gain"}
          >
            <title>
              {v} scénarios · {percent(v / net.length)}
            </title>
          </rect>
        ))}
        <line x1={zero} x2={zero} y1="25" y2="190" className="zero-line" />
        <text x="48" y="216">
          {signedEuro(-budget)}
        </text>
        <text x="245" y="216">
          {euro(budget * 2)}
        </text>
        <text x="452" y="216">
          {euro(budget * 5)}
        </text>
        <text x="738" y="216" textAnchor="end">
          ≥ {euro(upper)}
        </text>
      </svg>
      <figcaption>
        Distribution des gains nets à l’échéance. La dernière barre regroupe les
        gains ≥ {euro(upper)}.
      </figcaption>
    </figure>
  );
}
export function MiniChart({ kind }: { kind: "warrants" | "crp" }) {
  const curve = benchmark.curve,
    low = Math.min(...curve),
    high = Math.max(...curve);
  const line = curve
    .map(
      (v, i) =>
        `${i ? "L" : "M"}${(i / (curve.length - 1)) * 220},${85 - ((v - low) / Math.max(1, high - low)) * 78}`,
    )
    .join(" ");
  return (
    <svg viewBox="0 0 220 92" aria-hidden="true" className="mini-chart">
      {[20, 45, 70].map((y) => (
        <line key={y} x1="0" x2="220" y1={y} y2={y} className="gridline" />
      ))}
      {kind === "warrants" ? (
        <>
          <path
            d="M0 76 L65 76 L92 76 L120 58 L150 38 L185 15 L215 0"
            className="price-path"
          />
          <line x1="92" x2="92" y1="5" y2="85" className="zero-line" />
        </>
      ) : (
        <path d={line} className="price-path" />
      )}
    </svg>
  );
}
