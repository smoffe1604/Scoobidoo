import { useEffect, useRef, useState } from "react";
import maplibregl, { type Map } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { danishLabel } from "./labels";

const REGIONS = ["Hovedstaden", "Midtjylland", "Nordjylland", "Sjaelland", "Syddanmark"];

const LOW = "#2f6b4f";
const MID = "#c4a15a";
const HIGH = "#9f2d2d";

type Filters = {
  portfolioId: string;
  year: string;
  assetType: string;
  region: string;
};

type Bucket = { loss_ratio: number | null };
type WithTotals = { totals: Bucket };

type Ratios = Record<string, number | null>;
type Scale = { low: number; high: number };

const percent = new Intl.NumberFormat("da-DK", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export default function RegionMap({
  portfolioId,
  year,
  assetType,
  region,
  onSelectRegion,
}: Filters & { onSelectRegion: (region: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const readyRef = useRef(false);
  const ratiosRef = useRef<Ratios>({});
  const regionRef = useRef(region);
  const onSelectRef = useRef(onSelectRegion);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [scale, setScale] = useState<Scale | null>(null);
  regionRef.current = region;
  onSelectRef.current = onSelectRegion;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const map = new maplibregl.Map({
      container,
      style: {
        version: 8,
        sources: {},
        layers: [{ id: "background", type: "background", paint: { "background-color": "#beddf3" } }],
      },
      center: [10.6, 56.2],
      zoom: 5.4,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    map.addControl(
      new maplibregl.AttributionControl({
        customAttribution: "Regioner: Dataforsyningen. Lande: Natural Earth",
      }),
      "bottom-right",
    );
    mapRef.current = map;
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8 });
    popupRef.current = popup;

    map.on("load", () => {
      void Promise.all([
        fetch("/countries.geojson").then((response) => (response.ok ? response.json() : null)),
        fetch("/regions.geojson").then((response) => response.json()),
      ]).then(([countries, data]: [GeoJSON.FeatureCollection | null, GeoJSON.FeatureCollection]) => {
        if (countries) {
          map.addSource("countries", { type: "geojson", data: countries });
          map.addLayer({ id: "countries-fill", type: "fill", source: "countries", paint: { "fill-color": "#e7e2d6" } });
          map.addLayer({
            id: "countries-line",
            type: "line",
            source: "countries",
            paint: { "line-color": "#8b90a8", "line-width": 1.25 },
          });
        }
        map.addSource("regions", { type: "geojson", data, promoteId: "region" });
        map.addLayer({ id: "regions-land", type: "fill", source: "regions", paint: { "fill-color": "#e7e2d6" } });
        map.addLayer({
          id: "regions-fill",
          type: "fill",
          source: "regions",
          paint: {
            "fill-color": [
              "case",
              ["boolean", ["feature-state", "hasRatio"], false],
              ["interpolate", ["linear"], ["feature-state", "position"], 0, LOW, 0.5, MID, 1, HIGH],
              "#d9d3c7",
            ],
            "fill-opacity": ["case", ["boolean", ["feature-state", "selected"], false], 0.95, 0.78],
          },
        });
        map.addLayer({
          id: "regions-line",
          type: "line",
          source: "regions",
          paint: {
            "line-color": ["case", ["boolean", ["feature-state", "selected"], false], "#1f1c16", "#f7f5f0"],
            "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 2.5, 1],
          },
        });
        readyRef.current = true;
        paint(map);
        map.fitBounds(
          [
            [7.7, 54.25],
            [15.5, 58.0],
          ],
          { padding: 20, animate: false },
        );
        map.on("click", "regions-fill", (event) => {
          const clicked = regionOf(event.features?.[0]);
          if (!clicked) return;
          onSelectRef.current(clicked === regionRef.current ? "" : clicked);
        });
        map.on("mousemove", "regions-fill", (event) => {
          const name = regionOf(event.features?.[0]);
          if (!name) return;
          map.getCanvas().style.cursor = "pointer";
          const ratio = ratiosRef.current[name];
          popup
            .setLngLat(event.lngLat)
            .setHTML(
              `<strong>${danishLabel(name)}</strong><br/>${ratio == null ? "Ingen policer i udsnittet" : `Skadeprocent ${percent.format(ratio)}`}`,
            )
            .addTo(map);
        });
        map.on("mouseleave", "regions-fill", () => {
          map.getCanvas().style.cursor = "";
          popup.remove();
        });
      });
    });

    return () => {
      readyRef.current = false;
      popup.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (map && readyRef.current) paint(map);
  }, [region]);

  useEffect(() => {
    let cancelled = false;
    void loadRatios({ portfolioId, year, assetType }).then((ratios) => {
      if (cancelled) return;
      ratiosRef.current = ratios;
      setScale(scaleFor(ratios));
      const map = mapRef.current;
      if (map && readyRef.current) paint(map);
    });
    return () => {
      cancelled = true;
    };
  }, [portfolioId, year, assetType]);

  return (
    <div className="map-block">
      <div ref={containerRef} className="region-map" />
      <div className="map-legend" aria-live="polite">
        <span className="map-legend-title">Skadeprocent pr. region{portfolioId ? ` i ${portfolioId}` : ""}</span>
        {scale ? (
          <span className="map-legend-scale">
            <span>{percent.format(scale.low)}</span>
            <span className="map-legend-bar" />
            <span>{percent.format(scale.high)}</span>
          </span>
        ) : (
          <span className="map-legend-empty">Ingen policer i udsnittet</span>
        )}
      </div>
    </div>
  );

  function paint(map: Map) {
    const current = scaleFor(ratiosRef.current);
    for (const name of REGIONS) {
      const ratio = ratiosRef.current[name];
      map.setFeatureState(
        { source: "regions", id: name },
        {
          position: ratio == null || current == null ? 0 : positionOf(ratio, current),
          hasRatio: ratio != null,
          selected: regionRef.current === name,
        },
      );
    }
  }
}

function regionOf(feature: GeoJSON.Feature | undefined): string | null {
  const name = feature?.properties?.region ?? feature?.id;
  return typeof name === "string" ? name : null;
}

/** Colour runs from the lowest to the highest region on the map right now. */
function scaleFor(ratios: Ratios): Scale | null {
  const values = Object.values(ratios).filter((value): value is number => value != null);
  if (!values.length) return null;
  const low = Math.min(...values);
  const high = Math.max(...values);
  if (high - low < 0.01) return { low: low - 0.05, high: high + 0.05 };
  return { low, high };
}

function positionOf(ratio: number, scale: Scale): number {
  return Math.min(1, Math.max(0, (ratio - scale.low) / (scale.high - scale.low)));
}

async function loadRatios(filters: Pick<Filters, "portfolioId" | "year" | "assetType">): Promise<Ratios> {
  const entries = await Promise.all(REGIONS.map(async (name) => [name, await ratioFor(name, filters)] as const));
  return Object.fromEntries(entries);
}

async function ratioFor(region: string, filters: Pick<Filters, "portfolioId" | "year" | "assetType">) {
  const params = new URLSearchParams({ region });
  if (filters.year) params.set("underwriting_year", filters.year);
  if (filters.assetType) params.set("asset_type", filters.assetType);
  const path = filters.portfolioId
    ? `/portfolios/${filters.portfolioId}/loss-experience?${params}`
    : `/portfolios/loss-experience?${params}`;
  const response = await fetch(path);
  if (!response.ok) return null;
  const body = (await response.json()) as WithTotals;
  return body.totals.loss_ratio;
}
