import { useEffect, useState } from "react";
import { danishLabel } from "./labels";

type TableInfo = { name: string; label: string; blurb: string; count: number };
type Column = { key: string; label: string };
type Filter = { key: string; label: string; options: string[]; value: string };
type Page = {
  name: string;
  label: string;
  blurb: string;
  total: number;
  matched: number;
  offset: number;
  limit: number;
  columns: Column[];
  filters: Filter[];
  rows: Record<string, string>[];
};

const count = new Intl.NumberFormat("da-DK");

type Remembered = {
  draft: string;
  q: string;
  filters: Record<string, string>;
  offset: number;
};

const blank = (): Remembered => ({ draft: "", q: "", filters: {}, offset: 0 });

// Survives leaving Kildedata, so a search is still there when you come back.
const remembered: Record<string, Remembered> = {};
let rememberedTable = "assets";

export default function DataBrowser() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [name, setName] = useState(rememberedTable);
  const [query, setQuery] = useState<Remembered>(() => remembered[rememberedTable] ?? blank());
  const [page, setPage] = useState<Page | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJson<{ tables: TableInfo[] }>("/tables")
      .then((body) => setTables(body.tables))
      .catch((reason: Error) => setError(reason.message));
  }, []);

  useEffect(() => {
    rememberedTable = name;
    remembered[name] = query;
  }, [name, query]);

  useEffect(() => {
    const draft = query.draft;
    const handle = window.setTimeout(() => {
      setQuery((current) => {
        if (current.draft !== draft || current.q === draft) return current;
        return { ...current, q: draft };
      });
    }, 250);
    return () => window.clearTimeout(handle);
  }, [name, query.draft]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    params.set("offset", String(query.offset));
    params.set("limit", "40");
    for (const [key, value] of Object.entries(query.filters)) {
      if (value) params.set(key, value);
    }
    let cancelled = false;
    getJson<Page>(`/tables/${name}?${params.toString()}`)
      .then((body) => {
        if (!cancelled) {
          setPage(body);
          setError(null);
        }
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message);
      });
    return () => {
      cancelled = true;
    };
  }, [name, query]);

  function chooseTable(next: string) {
    if (next === name) return;
    remembered[name] = { ...query, q: query.draft };
    rememberedTable = next;
    setName(next);
    setQuery(remembered[next] ?? blank());
  }

  function update(next: Remembered) {
    remembered[name] = next;
    setQuery(next);
  }

  const from = page && page.matched > 0 ? page.offset + 1 : 0;
  const to = page ? Math.min(page.offset + page.rows.length, page.matched) : 0;

  return (
    <section className="panel">
      <div className="tabs">
        {tables.map((table) => (
          <button
            key={table.name}
            type="button"
            className={table.name === name ? "on" : undefined}
            onClick={() => chooseTable(table.name)}
          >
            {table.label}
            <span>{count.format(table.count)}</span>
          </button>
        ))}
      </div>

      {page && <p className="blurb">{page.blurb}</p>}
      {error && <p className="error">{error}</p>}

      <div className="filters">
        <label>
          Søg
          <input
            type="search"
            value={query.draft}
            placeholder="Alle kolonner"
            onChange={(event) => update({ ...query, draft: event.target.value, offset: 0 })}
          />
        </label>
        {page?.filters.map((filter) => (
          <label key={filter.key}>
            {filter.label}
            <select
              value={query.filters[filter.key] ?? ""}
              onChange={(event) =>
                update({
                  ...query,
                  filters: { ...query.filters, [filter.key]: event.target.value },
                  offset: 0,
                })
              }
            >
              <option value="">Alle</option>
              {filter.options.map((option) => (
                <option key={option} value={option}>
                  {danishLabel(option)}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {page?.columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {page?.rows.map((row, index) => (
              <tr key={`${row.claim_id || row.policy_id || row.asset_id || index}`} className={row.policy_found === "nej" ? "missing" : undefined}>
                {page.columns.map((column) => (
                  <td key={column.key}>{danishLabel(row[column.key] || "") || "—"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pager">
        <span>
          {count.format(from)}–{count.format(to)} af {count.format(page?.matched ?? 0)}
        </span>
        <span>
          <button type="button" disabled={query.offset === 0} onClick={() => update({ ...query, offset: Math.max(0, query.offset - 40) })}>
            Forrige
          </button>
          <button
            type="button"
            disabled={!page || query.offset + page.rows.length >= page.matched}
            onClick={() => update({ ...query, offset: query.offset + 40 })}
          >
            Næste
          </button>
        </span>
      </div>
    </section>
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
