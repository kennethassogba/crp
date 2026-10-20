import React, { useEffect, useId, useRef, useState } from "react";
import {
  date,
  observedTime,
  euro,
  number,
  percent,
  signedEuro,
} from "./format";

export function useChartWidth(key: number) {
  const ref = useRef<HTMLDivElement>(null),
    [width, setWidth] = useState(790);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(260, Math.round(entry.contentRect.width))),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [key]);
  return { ref, width };
}

export function LineChart({
  values,
  dates,
  name,
  unit = "$",
  elapsedTime = false,
  baseline,
}: {
  values: number[];
  dates: string[];
  name: string;
  unit?: string;
  elapsedTime?: boolean;
  baseline?: number;
}) {
  const [active, setActive] = useState<number | null>(null),
    id = useId(),
    { ref, width } = useChartWidth(values.length);
  useEffect(() => setActive(null), [name, values.length]);
  if (values.length < 2)
    return (
      <p className="chart-empty">
        Pas encore assez de points pour tracer une courbe.
      </p>
    );
  const low = Math.min(...values, baseline ?? Infinity),
    high = Math.max(...values, baseline ?? -Infinity),
    range = Math.max(high - low, high * 0.001, 1),
    min = low - range * 0.12,
    max = high + range * 0.12;
  const times = dates.map((d) => Date.parse(d)),
    firstTime = times[0],
    duration = times.at(-1)! - firstTime;
  const span = width - 76,
    x = (i: number) =>
      12 +
      (elapsedTime && duration > 0
        ? (times[i] - firstTime) / duration
        : i / (values.length - 1)) *
        span,
    y = (v: number) => 188 - ((v - min) / (max - min)) * 156;
  const path = values
      .map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`)
      .join(" "),
    index = active ?? values.length - 1;
  const value = (v: number) =>
    unit === "€" ? euro(v, 2) : `${number(v, 2)} ${unit}`;
  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const target = ((e.clientX - box.left) / box.width) * width;
    setActive(
      values.reduce(
        (best, _, i) =>
          Math.abs(x(i) - target) < Math.abs(x(best) - target) ? i : best,
        0,
      ),
    );
  };
  const axisDate = (i: number) =>
    new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "short",
      timeZone: dates[i].includes("T") ? "Europe/Paris" : "UTC",
    }).format(new Date(dates[i]));
  return (
    <div
      ref={ref}
      className="interactive-chart line-chart"
      tabIndex={0}
      role="group"
      aria-label={`${name}. Utiliser les flèches pour parcourir les dates.`}
      aria-describedby={id}
      onKeyDown={(e) => {
        if (["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) {
          e.preventDefault();
          setActive(
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? values.length - 1
                : Math.max(
                    0,
                    Math.min(
                      values.length - 1,
                      index + (e.key === "ArrowRight" ? 1 : -1),
                    ),
                  ),
          );
        }
      }}
    >
      <div className="chart-readout" id={id} role="status">
        <span>
          {dates[index].includes("T")
            ? observedTime(dates[index])
            : date(dates[index], true)}
        </span>
        <strong>{value(values[index])}</strong>
      </div>
      <svg
        viewBox={`0 0 ${width} 225`}
        role="img"
        aria-label={`${name}, de ${value(values[0])} à ${value(values.at(-1)!)}`}
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setActive(null);
        }}
      >
        {[0, 0.5, 1].map((q) => (
          <g key={q}>
            <line
              x1="12"
              x2={width - 64}
              y1={188 - q * 156}
              y2={188 - q * 156}
              className="gridline"
            />
            <text x={width - 54} y={192 - q * 156}>
              {number(min + q * (max - min), 0)}
            </text>
          </g>
        ))}
        {baseline !== undefined && (
          <line
            x1="12"
            x2={width - 64}
            y1={y(baseline)}
            y2={y(baseline)}
            className="zero-line"
          >
            <title>Départ {value(baseline)}</title>
          </line>
        )}
        <path d={path} className="price-path" />
        {active !== null && (
          <line
            x1={x(index)}
            x2={x(index)}
            y1="25"
            y2="188"
            className="crosshair"
          />
        )}
        <circle
          cx={x(index)}
          cy={y(values[index])}
          r="4"
          className="price-dot"
        />
        {(width < 480 || elapsedTime ? [0, 1] : [0, 0.5, 1]).map((q) => (
          <text
            key={q}
            x={12 + q * span}
            y="217"
            textAnchor={q === 0 ? "start" : q === 1 ? "end" : "middle"}
          >
            {axisDate(Math.round(q * (values.length - 1)))}
          </text>
        ))}
      </svg>
      <span className="chart-instruction">
        Survoler, toucher ou utiliser les flèches.
      </span>
    </div>
  );
}
export function PriceChart({
  closes,
  dates,
  name,
}: {
  closes: number[];
  dates: string[];
  name: string;
}) {
  return (
    <LineChart
      values={closes.slice(-252)}
      dates={dates.slice(-252)}
      name={name}
    />
  );
}
export function Distribution({
  net,
  budget,
}: {
  net: number[];
  budget: number;
}) {
  const [active, setActive] = useState(0),
    id = useId(),
    { ref, width: chartWidth } = useChartWidth(net.length);
  const plotWidth = chartWidth - 56,
    step = plotWidth / 30,
    upper = budget * 10,
    width = (upper + budget) / 30,
    bins = Array.from({ length: 30 }, () => 0);
  net.forEach(
    (v) => bins[Math.max(0, Math.min(29, Math.floor((v + budget) / width)))]++,
  );
  const top = Math.max(1, ...bins),
    label = (i: number) =>
      i === 29
        ? `Au moins ${signedEuro(-budget + i * width)}`
        : `${signedEuro(-budget + i * width)} à ${signedEuro(-budget + (i + 1) * width)}`;
  return (
    <div
      ref={ref}
      className="interactive-chart distribution"
      role="group"
      tabIndex={0}
      aria-label="Gains nets à l’échéance. Utiliser les flèches pour explorer les tranches."
      aria-describedby={id}
      onKeyDown={(e) => {
        if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
          e.preventDefault();
          setActive(
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? 29
                : Math.max(
                    0,
                    Math.min(29, active + (e.key === "ArrowRight" ? 1 : -1)),
                  ),
          );
        }
      }}
    >
      <div className="chart-readout" role="status" id={id}>
        <span>{label(active)}</span>
        <strong>
          {percent(bins[active] / net.length)}
          <small>
            {" "}
            · {number(bins[active])}/{number(net.length)} scénarios
          </small>
        </strong>
      </div>
      <svg
        viewBox={`0 0 ${chartWidth} 230`}
        role="img"
        aria-label={`Distribution de ${number(net.length)} scénarios de gain net`}
      >
        {[0, 0.5, 1].map((q) => (
          <g key={q}>
            <line
              x1="48"
              x2={chartWidth - 8}
              y1={185 - q * 150}
              y2={185 - q * 150}
              className="gridline"
            />
            <text x="39" y={189 - q * 150} textAnchor="end">
              {percent((q * top) / net.length, 0)}
            </text>
          </g>
        ))}
        {bins.map((v, i) => (
          <g
            key={i}
            onPointerEnter={() => setActive(i)}
            onPointerDown={() => setActive(i)}
          >
            <rect
              x={48 + i * step}
              y="25"
              width={step}
              height="162"
              fill="transparent"
            />
            <rect
              x={48 + i * step + 2}
              y={185 - (v / top) * 150}
              width={Math.max(2, step * 0.75)}
              height={Math.max(1, (v / top) * 150)}
              rx="2"
              className={`${-budget + (i + 1) * width <= 0 ? "hist-loss" : "hist-gain"} ${active === i ? "is-active" : ""}`}
            >
              <title>
                {label(i)} : {percent(v / net.length)}, {v} scénarios
              </title>
            </rect>
          </g>
        ))}
        <line
          x1={48 + (budget / (upper + budget)) * plotWidth}
          x2={48 + (budget / (upper + budget)) * plotWidth}
          y1="25"
          y2="190"
          className="zero-line"
        />
        {(chartWidth < 480 ? [0, 14, 29] : [0, 10, 20, 29]).map((i) => (
          <text
            key={i}
            x={i === 29 ? chartWidth - 8 : 48 + i * step}
            y="218"
            textAnchor={i === 0 ? "start" : i === 29 ? "end" : "middle"}
          >
            {i === 29 ? "≥ " : ""}
            {signedEuro(-budget + i * width)}
          </text>
        ))}
      </svg>
      <span className="chart-instruction">
        Chaque barre regroupe une tranche de gain net, après frais et avant
        impôts.
      </span>
    </div>
  );
}
