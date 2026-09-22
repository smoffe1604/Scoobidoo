import { useEffect, useState } from "react";

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

type Comparison = { portfolios: PortfolioRow[] };
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
    const path = filters.portfolioId
      ? `/portfolios/${filters.portfolioId}/loss-experience`
      : "/portfolios/loss-experience";
    let cancelled = false;
    getJson<Comparison & Experience>(query ? `${path}?${query}` : path)
      .then((body) => {
        if (cancelled) return;
        setError(null);
        if (filters.portfolioId) {
          setExperience(body);
          setComparison(null);
        } else {
          setComparison(body);
          setExperience(null);
        }
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message);
      });
    return () => {
      cancelled = true;
    };
  }, [filters]);

  return (
    <main className="page">
      <header>
        <h1>Loss experience</h1>
        <p>Danish property book. Figures in DKK. Full annual premium, no pro-rata.</p>
      </header>

      {error && <p className="error">{error}</p>}

      <section className="panel">
        <div className="filters">
          <Select
            label="Portfolio"
            value={filters.portfolioId}
            onChange={(portfolioId) => setFilters({ ...filters, portfolioId })}
            options={[["", "All portfolios"], ...(meta?.portfolios ?? []).map((id) => [id, id] as [string, string])]}
          />
          <Select
            label="Underwriting year"
            value={filters.year}
            onChange={(year) => setFilters({ ...filters, year })}
            options={[["", "All years"], ...(meta?.underwriting_years ?? []).map((year) => [String(year), String(year)] as [string, string])]}
          />
          <Select
            label="Region"
            value={filters.region}
            onChange={(region) => setFilters({ ...filters, region })}
            options={[["", "All regions"], ...(meta?.regions ?? []).map((region) => [region, region] as [string, string])]}
          />
          <Select
            label="Asset type"
            value={filters.assetType}
            onChange={(assetType) => setFilters({ ...filters, assetType })}
            options={[["", "All types"], ...(meta?.asset_types ?? []).map((kind) => [kind, kind] as [string, string])]}
          />
        </div>

        {experience && (
          <div className="headline">
            <Figure label="Earned premium" value={formatMoney(experience.totals.earned_premium_dkk)} />
            <Figure label="Incurred loss" value={formatMoney(experience.totals.incurred_loss_dkk)} />
            <Figure label="Loss ratio" value={formatRatio(experience.totals.loss_ratio)} bad={isBad(experience.totals.loss_ratio)} />
            <Figure label="Claims" value={formatCount(experience.totals.claim_count)} />
          </div>
        )}

        {comparison && <PortfolioTable rows={comparison.portfolios} onPick={(portfolioId) => setFilters({ ...filters, portfolioId })} />}
        {experience && <PerilTable rows={experience.perils} />}
      </section>

      {quality && (
        <details className="panel quality" open>
          <summary>Data quality</summary>
          <ul>
            {quality.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </details>
      )}
    </main>
  );
}

function PortfolioTable({ rows, onPick }: { rows: PortfolioRow[]; onPick: (id: string) => void }) {
  return (
    <table>
      <caption>Worst loss ratio first. Claim count includes withdrawn and declined claims; they add nothing to incurred loss.</caption>
      <thead>
        <tr>
          <th>Portfolio</th>
          <th>Policies</th>
          <th>Earned premium</th>
          <th>Incurred loss</th>
          <th>Loss ratio</th>
          <th>Claims</th>
          <th>Largest claim</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.portfolio_id}>
            <td><button type="button" onClick={() => onPick(row.portfolio_id)}>{row.portfolio_id}</button></td>
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
  );
}

function PerilTable({ rows }: { rows: PerilRow[] }) {
  return (
    <table>
      <caption>Worst loss ratio first. Claim count includes withdrawn and declined claims; they add nothing to incurred loss.</caption>
      <thead>
        <tr>
          <th>Peril</th>
          <th>Policies</th>
          <th>Earned premium</th>
          <th>Incurred loss</th>
          <th>Loss ratio</th>
          <th>Claims</th>
          <th>Largest claim</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.peril}>
            <td>{row.peril}</td>
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
