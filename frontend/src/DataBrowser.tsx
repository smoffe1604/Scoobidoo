import { useEffect, useState } from "react";

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

export default function DataBrowser() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [name, setName] = useState("assets");
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<Page | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJson<{ tables: TableInfo[] }>("/tables")
      .then((body) => setTables(body.tables))
      .catch((reason: Error) => setError(reason.message));
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => setQ(draft), 250);
    return () => window.clearTimeout(handle);
  }, [draft]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("offset", String(offset));
    params.set("limit", "40");
    for (const [key, value] of Object.entries(filters)) {
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
  }, [name, q, filters, offset]);

  function chooseTable(next: string) {
    setName(next);
    setDraft("");
    setQ("");
    setFilters({});
    setOffset(0);
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
          Search
          <input
            type="search"
            value={draft}
            placeholder="Any column"
            onChange={(event) => {
              setDraft(event.target.value);
              setOffset(0);
            }}
          />
        </label>
        {page?.filters.map((filter) => (
          <label key={filter.key}>
            {filter.label}
            <select
              value={filters[filter.key] ?? ""}
              onChange={(event) => {
                setFilters({ ...filters, [filter.key]: event.target.value });
                setOffset(0);
              }}
            >
              <option value="">All</option>
              {filter.options.map((option) => (
                <option key={option} value={option}>
                  {option}
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
              <tr key={`${row.claim_id || row.policy_id || row.asset_id || index}`} className={row.policy_found === "no" ? "missing" : undefined}>
                {page.columns.map((column) => (
                  <td key={column.key}>{row[column.key] || "—"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pager">
        <span>
          {count.format(from)}–{count.format(to)} of {count.format(page?.matched ?? 0)}
        </span>
        <span>
          <button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 40))}>
            Previous
          </button>
          <button
            type="button"
            disabled={!page || offset + page.rows.length >= page.matched}
            onClick={() => setOffset(offset + 40)}
          >
            Next
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
