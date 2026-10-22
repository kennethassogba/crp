import { t, useLanguage, locale } from "./i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  LineSeries,
  ColorType,
  CrosshairMode,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { Maximize2, Minus, Plus } from "lucide-react";
import { date, number, observedTime, percent } from "./format";
export type MarketPoint = { at: string; value: number };
export function MarketChart({
  points,
  selectedDay,
  name,
  unit = "€",
  initial,
}: {
  points: MarketPoint[];
  selectedDay: string;
  name: string;
  unit?: string;
  initial?: number;
}) {
  const language = useLanguage();
  const host = useRef<HTMLDivElement>(null),
    api = useRef<IChartApi | null>(null),
    line = useRef<ISeriesApi<"Line"> | null>(null),
    [period, setPeriod] = useState("1M"),
    [active, setActive] = useState<number | null>(null);
  const data = useMemo(
    () => [
      ...new Map(
        points
          .filter(
            (p) =>
              Number.isFinite(p.value) && Number.isFinite(Date.parse(p.at)),
          )
          .sort((a, b) => a.at.localeCompare(b.at))
          .map((p) => [Math.floor(Date.parse(p.at) / 1000), p]),
      ).values(),
    ],
    [points],
  );
  const index =
      active === null ? data.length - 1 : Math.min(active, data.length - 1),
    point = data[index];
  const reference = initial ?? data[0]?.value,
    delta = point ? point.value - reference : 0;
  const fmt = (v: number) => {
    const value = number(v, unit === "€" && v < 10 ? 3 : 2);
    return language === "en" ? `${unit}${value}` : `${value} ${unit}`;
  };
  useEffect(() => {
    const el = host.current;
    if (!el || !data.length) return;
    const style = getComputedStyle(el),
      color = (token: string) => style.getPropertyValue(token).trim(),
      accent = color("--accent"),
      muted = color("--muted");
    const chart = createChart(el, {
      autoSize: true,
      height: Math.max(100, el.clientHeight),
      layout: {
        background: { type: ColorType.Solid, color: color("--bg") },
        textColor: muted,
        fontFamily: "Public Sans Variable, sans-serif",
        fontSize: 16,
        attributionLogo: true,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: color("--line") },
      },
      rightPriceScale: {
        borderVisible: false,
        minimumWidth: 96,
        scaleMargins: { top: 0.14, bottom: 0.12 },
      },
      timeScale: {
        borderVisible: false,
        rightOffset: 3,
        timeVisible: false,
        secondsVisible: false,
        fixLeftEdge: true,
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: { color: muted, labelBackgroundColor: color("--surface") },
        horzLine: { color: muted, labelBackgroundColor: color("--surface") },
      },
      handleScroll: {
        mouseWheel: false,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        mouseWheel: false,
        pinch: true,
        axisPressedMouseMove: true,
      },
      localization: {
        locale: locale(),
        priceFormatter: fmt,
        timeFormatter: (t: Time) =>
          typeof t === "number"
            ? observedTime(new Date(t * 1000).toISOString())
            : String(t),
      },
    });
    const series = chart.addSeries(LineSeries, {
      color: accent,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerRadius: 4,
      priceFormat: {
        type: "price",
        precision: unit === "€" ? 3 : 2,
        minMove: unit === "€" ? 0.001 : 0.01,
      },
    });
    const cutoff = Date.parse(selectedDay) / 1000;
    series.setData(
      data.map((p) => ({
        time: Math.floor(Date.parse(p.at) / 1000) as UTCTimestamp,
        value: p.value,
        color: Date.parse(p.at) / 1000 < cutoff ? muted : accent,
      })),
    );
    const entry = data.find((p) => Date.parse(p.at) / 1000 >= cutoff);
    if (entry)
      createSeriesMarkers(series, [
        {
          time: Math.floor(Date.parse(entry.at) / 1000) as UTCTimestamp,
          position: "aboveBar",
          color: accent,
          shape: "circle",
          text: "",
          size: 0.4,
        },
      ]);
    if (initial !== undefined)
      series.createPriceLine({
        price: initial,
        color: muted,
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: false,
        title: t("Entrée"),
      });
    chart.subscribeCrosshairMove((p) => {
      if (typeof p.time !== "number") {
        setActive(null);
        return;
      }
      const i = data.findIndex(
        (d) => Math.floor(Date.parse(d.at) / 1000) === p.time,
      );
      if (i >= 0) setActive(i);
    });
    api.current = chart;
    line.current = series;
    chart.timeScale().fitContent();
    return () => {
      api.current = null;
      line.current = null;
      chart.remove();
    };
  }, [data, selectedDay, unit, initial, language]);
  useEffect(() => {
    const chart = api.current;
    if (!chart || !data.length) return;
    const last = Date.parse(data.at(-1)!.at),
      span =
        period === "1S" ? 7 : period === "1M" ? 31 : period === "3M" ? 93 : 366;
    const start = Math.max(Date.parse(data[0].at), last - span * 86400000);
    if (start < last)
      chart.timeScale().setVisibleRange({
        from: Math.floor(start / 1000) as UTCTimestamp,
        to: Math.floor(last / 1000) as UTCTimestamp,
      });
    else chart.timeScale().fitContent();
  }, [period, data, language]);
  const zoom = (factor: number) => {
    const chart = api.current,
      r = chart?.timeScale().getVisibleLogicalRange();
    if (chart && r) {
      const mid = (r.from + r.to) / 2,
        half = ((r.to - r.from) * factor) / 2;
      chart
        .timeScale()
        .setVisibleLogicalRange({ from: mid - half, to: mid + half });
    }
  };
  const key = (e: React.KeyboardEvent) => {
    if (
      !["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key) ||
      !data.length
    )
      return;
    e.preventDefault();
    const i =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? data.length - 1
          : Math.max(
              0,
              Math.min(
                data.length - 1,
                index + (e.key === "ArrowRight" ? 1 : -1),
              ),
            );
    setActive(i);
    if (line.current)
      api.current?.setCrosshairPosition(
        data[i].value,
        Math.floor(Date.parse(data[i].at) / 1000) as UTCTimestamp,
        line.current,
      );
  };
  return (
    <div className="market-chart" role="group" aria-label={name}>
      <div className="market-readout" role="status">
        <div>
          <strong>{point ? fmt(point.value) : "—"}</strong>
          <span className={delta < 0 ? "negative" : "positive"}>
            {point && reference
              ? `${delta > 0 ? "+" : ""}${number(delta, 2)} (${percent(delta / reference, 2)})`
              : ""}
          </span>
        </div>
        <span>
          {point
            ? point.at.includes("T")
              ? observedTime(point.at)
              : date(point.at, true)
            : ""}
        </span>
      </div>
      <div className="chart-controls">
        <div
          className="chart-periods"
          role="group"
          aria-label={t("Période du cours")}
        >
          {["1S", "1M", "3M", "1A"].map((p) => (
            <button
              key={p}
              aria-pressed={period === p}
              onClick={() => {
                setPeriod(p);
                setActive(null);
              }}
            >
              {t(p)}
            </button>
          ))}
        </div>
        <div className="chart-zoom">
          <button aria-label={t("Dézoomer le graphique")} onClick={() => zoom(1.4)}>
            <Minus size={20} aria-hidden="true" />
          </button>
          <button aria-label={t("Zoomer le graphique")} onClick={() => zoom(0.7)}>
            <Plus size={20} aria-hidden="true" />
          </button>
          <button
            aria-label={t("Afficher tout l’historique")}
            onClick={() => api.current?.timeScale().fitContent()}
          >
            <Maximize2 size={20} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div
        className="chart-canvas"
        ref={host}
        tabIndex={0}
        role="group"
        aria-label={`${name}. ${t("Flèches pour lire les prix, début et fin pour les extrêmes.")}`}
        onKeyDown={key}
      />
      <span className="visually-hidden">
        {t("Courbe grise avant sélection, bleue à partir du")}{" "}
        {date(selectedDay, true)}.
      </span>
    </div>
  );
}
