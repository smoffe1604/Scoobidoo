import { useEffect, useRef } from "react";
import maplibregl, { type Map } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const REGIONS = ["Hovedstaden", "Midtjylland", "Nordjylland", "Sjaelland", "Syddanmark"];

type Filters = {
  portfolioId: string;
  year: string;
  assetType: string;
  region: string;
};

type Bucket = {
  earned_premium_dkk: number;
  incurred_loss_dkk: number;
  loss_ratio: number | null;
};

type Comparison = { portfolios: Array<Bucket> };
type Experience = { totals: Bucket };

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
  const ratiosRef = useRef<Record<string, number | null>>({});
  const regionRef = useRef(region);
  const onSelectRef = useRef(onSelectRegion);
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

    map.on("load", () => {
      void Promise.all([
        fetch("/countries.geojson").then((response) => (response.ok ? response.json() : null)),
        fetch("/regions.geojson").then((response) => response.json()),
      ]).then(([countries, data]: [GeoJSON.FeatureCollection | null, GeoJSON.FeatureCollection]) => {
          if (countries) {
            map.addSource("countries", { type: "geojson", data: countries });
            map.addLayer({
              id: "countries-fill",
              type: "fill",
              source: "countries",
              paint: { "fill-color": "#e7e2d6" },
            });
            map.addLayer({
              id: "countries-line",
              type: "line",
              source: "countries",
              paint: { "line-color": "#8b90a8", "line-width": 1.25 },
            });
          }
          map.addSource("regions", { type: "geojson", data, promoteId: "region" });
          map.addLayer({
            id: "regions-land",
            type: "fill",
            source: "regions",
            paint: { "fill-color": "#e7e2d6" },
          });
          map.addLayer({
            id: "regions-fill",
            type: "fill",
            source: "regions",
            paint: {
              "fill-color": [
                "case",
                ["boolean", ["feature-state", "hasRatio"], false],
                [
                  "interpolate",
                  ["linear"],
                  ["feature-state", "ratio"],
                  0.55,
                  "#2f6b4f",
                  0.68,
                  "#c4a15a",
                  0.85,
                  "#9f2d2d",
                ],
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
            const feature = event.features?.[0];
            const clicked = feature?.properties?.region ?? feature?.id;
            if (typeof clicked !== "string") return;
            onSelectRef.current(clicked === regionRef.current ? "" : clicked);
          });
          map.on("mouseenter", "regions-fill", () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", "regions-fill", () => {
            map.getCanvas().style.cursor = "";
          });
        });
    });

    return () => {
      readyRef.current = false;
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
      <div className="map-legend" aria-label="Skadeprocent fra 55 procent til 85 procent">
        <span className="map-legend-title">Skadeprocent</span>
        <span className="map-legend-scale">
          <span>55 %</span>
          <span className="map-legend-bar" />
          <span>85 %</span>
        </span>
      </div>
    </div>
  );

  function paint(map: Map) {
    for (const name of REGIONS) {
      const ratio = ratiosRef.current[name];
      map.setFeatureState(
        { source: "regions", id: name },
        {
          ratio: ratio ?? 0,
          hasRatio: ratio != null,
          selected: regionRef.current === name,
        },
      );
    }
  }
}

async function loadRatios(filters: Pick<Filters, "portfolioId" | "year" | "assetType">) {
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
  const body = (await response.json()) as Comparison & Experience;
  if (filters.portfolioId) return body.totals.loss_ratio;
  const earned = body.portfolios.reduce((sum, row) => sum + row.earned_premium_dkk, 0);
  const incurred = body.portfolios.reduce((sum, row) => sum + row.incurred_loss_dkk, 0);
  return earned === 0 ? null : incurred / earned;
}
