import { useEffect, useState } from "react";
import DataBrowser from "./DataBrowser";
import { danishLabel } from "./labels";
import RegionMap from "./RegionMap";

type Filters = {
  portfolioId: string;
  year: string;
  region: string;
  assetType: string;
};

type Bucket = {
  policy_count: number;
  earned_premium_dkk: number;
  incurred_loss_dkk: number;
  loss_ratio: number | null;
  claim_count: number;
  largest_claim_dkk: number | null;
};

type PortfolioRow = Bucket & { portfolio_id: string };
type PerilRow = Bucket & { peril: string };

type Meta = {
  portfolios: string[];
  regions: string[];
  asset_types: string[];
  underwriting_years: number[];
};

type Comparison = { totals: Bucket; portfolios: PortfolioRow[] };
type Experience = { portfolio_id: string; totals: Bucket; perils: PerilRow[] };
type Quality = { notes: string[] };

const money = new Intl.NumberFormat("da-DK", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const percent = new Intl.NumberFormat("da-DK", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export default function App() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [quality, setQuality] = useState<Quality | null>(null);
  const [filters, setFilters] = useState<Filters>({
    portfolioId: "",
    year: "",
    region: "",
    assetType: "",
  });
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [experience, setExperience] = useState<Experience | null>(null);
  const [error, setError] = useState<string | null>(null);
  const path = usePath();
  const onData = path === "/kildedata" || path === "/kildedata/";

  useEffect(() => {
    Promise.all([getJson<Meta>("/meta"), getJson<Quality>("/data-quality")])
      .then(([nextMeta, nextQuality]) => {
        setMeta(nextMeta);
        setQuality(nextQuality);
      })
      .catch((reason: Error) => setError(reason.message));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.year) params.set("underwriting_year", filters.year);
    if (filters.region) params.set("region", filters.region);
    if (filters.assetType) params.set("asset_type", filters.assetType);
    const query = params.toString();
    const suffix = query ? `?${query}` : "";
    let cancelled = false;
    const comparisonRequest = getJson<Comparison>(`/portfolios/loss-experience${suffix}`);
    const experienceRequest = filters.portfolioId
      ? getJson<Experience>(`/portfolios/${filters.portfolioId}/loss-experience${suffix}`)
      : Promise.resolve(null);
    Promise.all([comparisonRequest, experienceRequest])
      .then(([nextComparison, nextExperience]) => {
        if (cancelled) return;
        setError(null);
        setComparison(nextComparison);
        setExperience(nextExperience);
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message);
      });
    return () => {
      cancelled = true;
    };
  }, [filters]);

  function showAll() {
    setExperience(null);
    setFilters({ ...filters, portfolioId: "" });
  }

  function pickPortfolio(portfolioId: string) {
    if (filters.portfolioId === portfolioId) {
      showAll();
      return;
    }
    setFilters({ ...filters, portfolioId });
  }

  useEffect(() => {
    document.title = onData ? "Kildedata" : "Skadesforløb";
  }, [onData]);

  const book = comparison?.totals ?? null;
  const ratioById = new Map((comparison?.portfolios ?? []).map((row) => [row.portfolio_id, row.loss_ratio]));
  const portfolioIds = [
    ...(meta?.portfolios ?? comparison?.portfolios.map((row) => row.portfolio_id) ?? []),
  ].sort((a, b) => a.localeCompare(b, "da", { numeric: true }));
  const portfolioChoices = portfolioIds.map((id) => ({
    portfolio_id: id,
    loss_ratio: ratioById.get(id) ?? null,
  }));
  const filterSummary = describeFilters(filters);

  return (
    <main className="page">
      <header className="top">
        <div className="title-row">
          {onData && (
            <a className="icon-button" href="/" aria-label="Tilbage" onClick={(event) => follow(event, "/")}>
              <BackIcon />
            </a>
          )}
          <div>
            <h1>{onData ? "Kildedata" : "Skadesforløb"}</h1>
            <p>{onData ? "De fire filer, tallene er regnet ud fra." : "Danske ejendomme. Beløb i kroner. Hele årpræmien tæller med."}</p>
          </div>
        </div>
        {!onData && (
          <nav className="top-nav" aria-label="Andre sider">
            <a className="icon-button" href="/kildedata" aria-label="Kildedata" onClick={(event) => follow(event, "/kildedata")}>
              <TableIcon />
            </a>
          </nav>
        )}
      </header>

      {onData ? (
        <DataBrowser />
      ) : (
        <>
          {error && <p className="error">{error}</p>}

          <div className="dashboard">
            <nav className="toc" aria-label="Portefølje">
              <button type="button" className={filters.portfolioId ? undefined : "on"} onClick={showAll}>
                <span className="chip-id">Alle</span>
                <span className={isBad(book?.loss_ratio ?? null) ? "chip-ratio bad" : "chip-ratio"}>
                  {formatRatio(book?.loss_ratio ?? null)}
                </span>
              </button>
              {portfolioChoices.map((row) => (
                <button
                  key={row.portfolio_id}
                  type="button"
                  className={filters.portfolioId === row.portfolio_id ? "on" : undefined}
                  onClick={() => pickPortfolio(row.portfolio_id)}
                >
                  <span className="chip-id">{row.portfolio_id}</span>
                  <span className={isBad(row.loss_ratio) ? "chip-ratio bad" : "chip-ratio"}>{formatRatio(row.loss_ratio)}</span>
                </button>
              ))}
            </nav>
            <div className="dashboard-main">
              <section className="panel">
                <div className="scope">
                  <div className="filters">
                    <Select
                      label="Tegningsår"
                      value={filters.year}
                      onChange={(year) => setFilters({ ...filters, year })}
                      options={[["", "Alle år"], ...(meta?.underwriting_years ?? []).map((year) => [String(year), String(year)] as [string, string])]}
                    />
                    <Select
                      label="Region"
                      value={filters.region}
                      onChange={(region) => setFilters({ ...filters, region })}
                      options={[["", "Alle regioner"], ...(meta?.regions ?? []).map((region) => [region, danishLabel(region)] as [string, string])]}
                    />
                    <Select
                      label="Ejendomstype"
                      value={filters.assetType}
                      onChange={(assetType) => setFilters({ ...filters, assetType })}
                      options={[["", "Alle typer"], ...(meta?.asset_types ?? []).map((kind) => [kind, danishLabel(kind)] as [string, string])]}
                    />
                  </div>
                </div>

                {experience ? (
                  <section className="portfolio-detail">
                    <div className="detail-head">
                      <h2>
                        {experience.portfolio_id}
                        {filterSummary && <small>{filterSummary}</small>}
                      </h2>
                      <button type="button" className="linkish" onClick={showAll}>
                        Tilbage til alle porteføljer
                      </button>
                    </div>
                    <Headline totals={experience.totals} />
                    {experience.perils.length ? (
                      <PerilTable rows={experience.perils} />
                    ) : (
                      <p className="empty">Ingen policer i dette udsnit.</p>
                    )}
                  </section>
                ) : (
                  comparison && (
                    <section className="portfolio-detail">
                      <div className="detail-head">
                        <h2>
                          Alle porteføljer
                          {filterSummary && <small>{filterSummary}</small>}
                        </h2>
                      </div>
                      <Headline totals={comparison.totals} />
                      {comparison.portfolios.length ? (
                        <PortfolioTable rows={comparison.portfolios} onPick={pickPortfolio} />
                      ) : (
                        <p className="empty">Ingen policer i dette udsnit.</p>
                      )}
                    </section>
                  )
                )}

                <RegionMap
                  portfolioId={filters.portfolioId}
                  year={filters.year}
                  assetType={filters.assetType}
                  region={filters.region}
                  onSelectRegion={(region) => setFilters({ ...filters, region })}
                />
              </section>

              {quality && (
                <details className="panel quality" open>
                  <summary>Datakvalitet</summary>
                  <ul>
                    {quality.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </div>
        </>
      )}
    </main>
  );
}

function describeFilters(filters: Filters): string {
  const parts = [
    filters.year ? `tegningsår ${filters.year}` : "",
    filters.region ? danishLabel(filters.region) : "",
    filters.assetType ? danishLabel(filters.assetType) : "",
  ].filter(Boolean);
  return parts.join(" · ");
}

function Headline({ totals }: { totals: Bucket }) {
  return (
    <div className="headline">
      <Figure label="Policer" value={formatCount(totals.policy_count)} />
      <Figure label="Optjent præmie" value={formatMoney(totals.earned_premium_dkk)} />
      <Figure label="Skadeudgift" value={formatMoney(totals.incurred_loss_dkk)} />
      <Figure label="Skadeprocent" value={formatRatio(totals.loss_ratio)} bad={isBad(totals.loss_ratio)} />
      <Figure label="Skader" value={formatCount(totals.claim_count)} />
      <Figure label="Største skade" value={formatMoney(totals.largest_claim_dkk)} />
    </div>
  );
}

function PortfolioTable({ rows, onPick }: { rows: PortfolioRow[]; onPick: (portfolioId: string) => void }) {
  return (
    <div className="table-scroll">
      <table>
        <caption>Højeste skadeprocent først. Klik på en portefølje for at se den fordelt på fare.</caption>
        <thead>
          <tr>
            <th>Portefølje</th>
            <th>Policer</th>
            <th>Optjent præmie</th>
            <th>Skadeudgift</th>
            <th>Skadeprocent</th>
            <th>Skader</th>
            <th>Største skade</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.portfolio_id}>
              <td>
                <button type="button" onClick={() => onPick(row.portfolio_id)}>
                  {row.portfolio_id}
                </button>
              </td>
              <td>{formatCount(row.policy_count)}</td>
              <td>{formatMoney(row.earned_premium_dkk)}</td>
              <td>{formatMoney(row.incurred_loss_dkk)}</td>
              <td className={isBad(row.loss_ratio) ? "bad" : undefined}>{formatRatio(row.loss_ratio)}</td>
              <td>{formatCount(row.claim_count)}</td>
              <td>{formatMoney(row.largest_claim_dkk)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PerilTable({ rows }: { rows: PerilRow[] }) {
  return (
    <div className="table-scroll">
      <table>
        <caption>Højeste skadeprocent først. Antallet tæller også afviste og tilbagekaldte skader. De lægger 0 kr. til skadeudgiften.</caption>
        <thead>
          <tr>
            <th>Fare</th>
            <th>Policer</th>
            <th>Optjent præmie</th>
            <th>Skadeudgift</th>
            <th>Skadeprocent</th>
            <th>Skader</th>
            <th>Største skade</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.peril}>
              <td>{danishLabel(row.peril)}</td>
              <td>{formatCount(row.policy_count)}</td>
              <td>{formatMoney(row.earned_premium_dkk)}</td>
              <td>{formatMoney(row.incurred_loss_dkk)}</td>
              <td className={isBad(row.loss_ratio) ? "bad" : undefined}>{formatRatio(row.loss_ratio)}</td>
              <td>{formatCount(row.claim_count)}</td>
              <td>{formatMoney(row.largest_claim_dkk)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue || "all"} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function Figure({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div>
      <span>{label}</span>
      <strong className={bad ? "bad" : undefined}>{value}</strong>
    </div>
  );
}

function usePath(): string {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const sync = () => setPath(window.location.pathname);
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  return path;
}

function follow(event: { preventDefault: () => void; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }, path: string) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  window.history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function TableIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <rect x="1.25" y="1.25" width="15.5" height="15.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M1.25 6.5h15.5M1.25 11.5h15.5M6.75 6.5V16.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M11.5 3.5 6 9l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(body?.detail || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

function formatMoney(value: number | null): string {
  if (value === null) return "—";
  return money.format(value);
}

function formatRatio(value: number | null): string {
  if (value === null) return "—";
  return percent.format(value);
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("da-DK").format(value);
}

function isBad(value: number | null): boolean {
  return value !== null && value >= 1;
}
