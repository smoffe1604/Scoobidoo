import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  EDGE_ARG,
  FLAG_ARGS,
  FLAG_MANY,
  GraphCanvas,
  SearchIndex,
  buildView,
  kindVisible,
  rowLabel,
  rowTarget,
  type Details,
  type GNode,
  type Graph,
  type Hit,
  type Layout,
  type SearchHit,
  type Selection,
  type Variant,
  type View,
} from "./flexiblecurrent-graph";
import "./flexiblecurrent.css";

const BASE = "/flexiblecurrent";

type Perf = {
  dataMs?: number;
  viewMs?: number;
  firstFrameMs?: number;
  searchMs?: number;
  searchSamples: number[];
  engine?: GraphCanvas["stats"];
};

declare global {
  interface Window {
    __fc?: Perf;
  }
}

const perf: Perf = { searchSamples: [] };
window.__fc = perf;

function layoutId(v: Variant) {
  return v.relay && v.inputs ? "relay-inputs" : v.relay ? "relay" : v.inputs ? "inputs" : "compact";
}

function cleanText(text: string) {
  return text.replace(/#NOTES#/g, "\n").replace(/<\/?memo>/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

const SEARCH_KEY = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K";

const KIND_LABEL: Record<GNode["k"], string> = { o: "type", f: "interface", c: "connection", e: "edge", i: "input" };

export default function FlexibleCurrent() {
  const [graph, setGraph] = useState<Graph | null>(null);
  const [details, setDetails] = useState<Details | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [variant, setVariant] = useState<Variant>({ relay: false, inputs: false });
  const [layouts, setLayouts] = useState<Record<string, Layout>>({});
  const [hidden, setHidden] = useState<Set<number>>(() => new Set());
  const [root, setRoot] = useState(0);
  const [selection, setSelection] = useState<Selection>(null);
  const [history, setHistory] = useState<Selection[]>([]);
  const [view, setView] = useState<View | null>(null);
  const [engine, setEngine] = useState<GraphCanvas | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const deepLink = useRef(new URLSearchParams(window.location.search));

  useEffect(() => {
    document.title = "flexibleCurrent v3 · skemaoversigt";
    const t0 = performance.now();
    fetch(`${BASE}/graph.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<Graph>;
      })
      .then((g) => {
        perf.dataMs = performance.now() - t0;
        performance.mark("fc:data");
        const wanted = deepLink.current.get("type");
        const node = g.nodes.find((n) => n.n === wanted);
        if (node) setVariant({ relay: node.k === "c" || node.k === "e" || node.n === "PageInfo", inputs: node.k === "i" });
        setLayouts({ compact: g.layout });
        setGraph(g);
      })
      .catch((e: Error) => setError(`Kunne ikke hente skemaet (${e.message}).`));
  }, []);

  // Descriptions and arguments are 2 MB raw, so they arrive after the first frame.
  useEffect(() => {
    if (!engine) return;
    const load = () =>
      fetch(`${BASE}/details.json`)
        .then((r) => r.json() as Promise<Details>)
        .then(setDetails)
        .catch(() => undefined);
    const idle = window.requestIdleCallback ?? ((fn: () => void) => window.setTimeout(fn, 200));
    idle(load);
  }, [engine]);

  useEffect(() => {
    const id = layoutId(variant);
    if (!graph || layouts[id]) return;
    fetch(`${BASE}/layout-${id}.json`)
      .then((r) => r.json() as Promise<Layout>)
      .then((layout) => setLayouts((all) => ({ ...all, [id]: layout })))
      .catch(() => setError("Kunne ikke hente layoutet."));
  }, [graph, variant, layouts]);

  const index = useMemo(() => (graph ? new SearchIndex(graph) : null), [graph]);

  const selectionRef = useRef(selection);
  selectionRef.current = selection;

  const select = useCallback(
    (next: Selection, opts: { focus?: boolean; row?: number; push?: boolean } = {}) => {
      const prev = selectionRef.current;
      if (opts.push !== false && prev && (!next || prev.node !== next.node || prev.field !== next.field)) {
        setHistory((h) => [...h.slice(-49), prev]);
      }
      setSelection(next);
      if (next && opts.focus) engine?.focus(next.node, opts.row ?? -1);
    },
    [engine],
  );

  const back = useCallback(() => {
    setHistory((h) => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      setSelection(prev);
      if (prev) engine?.focus(prev.node, prev.field ?? -1);
      return h.slice(0, -1);
    });
  }, [engine]);

  const viewRef = useRef(view);
  viewRef.current = view;

  const onHit = useCallback(
    (hit: Hit, dbl: boolean) => {
      const v = viewRef.current;
      if (!graph || !v) return;
      if (!hit) {
        if (!dbl) select(null);
        return;
      }
      if ("edge" in hit) {
        select({ node: v.et[hit.edge], via: { s: v.es[hit.edge], f: v.ef[hit.edge] } }, { focus: true });
        return;
      }
      if (dbl) {
        engine?.focus(hit.node);
        return;
      }
      const row = hit.row >= 0 ? graph.nodes[hit.node].f[hit.row] : null;
      const target = row ? rowTarget(row, v.variant.relay) : -1;
      if (row && target >= 0 && v.on[target] && target !== hit.node) {
        select({ node: target, via: { s: hit.node, f: hit.row } }, { focus: true });
      } else if (row) {
        select({ node: hit.node, field: hit.row });
      } else {
        select({ node: hit.node });
      }
    },
    [graph, engine, select],
  );
  const onHitRef = useRef(onHit);
  onHitRef.current = onHit;

  useEffect(() => {
    if (!graph || !canvasRef.current) return;
    const g = new GraphCanvas(canvasRef.current, graph, {
      onClick: (hit) => onHitRef.current(hit, false),
      onDoubleClick: (hit) => onHitRef.current(hit, true),
    });
    perf.engine = g.stats;
    setEngine(g);
    return () => g.destroy();
  }, [graph]);

  const firstView = useRef(true);
  useEffect(() => {
    const layout = layouts[layoutId(variant)];
    if (!graph || !engine || !layout) return;
    const t0 = performance.now();
    const v = buildView(graph, layout, variant, hidden, root);
    perf.viewMs = performance.now() - t0;
    setView(v);
    engine.setView(v);
    const current = selectionRef.current;
    if (firstView.current) {
      firstView.current = false;
      const wanted = deepLink.current.get("type");
      const id = graph.nodes.findIndex((n) => n.n === wanted);
      if (id >= 0 && v.on[id]) {
        const fieldName = deepLink.current.get("field");
        const field = graph.nodes[id].f.findIndex((r) => r[0] === fieldName);
        const sel: Selection = field >= 0 ? { node: id, field } : { node: id };
        setSelection(sel);
        engine.setSelection(sel);
        engine.focus(id, field, false);
      } else engine.fit(undefined, false);
      requestAnimationFrame(() => {
        perf.firstFrameMs = engine.stats.firstFrameAt;
      });
    } else if (current && v.on[current.node]) {
      engine.setSelection(current);
      engine.focus(current.node);
    } else {
      if (current) setSelection(null);
      engine.fit();
    }
  }, [graph, engine, layouts, variant, hidden, root]);

  useEffect(() => {
    engine?.setSelection(selection);
    if (!graph) return;
    const params = new URLSearchParams();
    if (selection) {
      params.set("type", graph.nodes[selection.node].n);
      const field = selection.field;
      if (field !== undefined) params.set("field", graph.nodes[selection.node].f[field][0]);
    }
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `${BASE}?${qs}` : BASE);
  }, [selection, engine, graph]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest?.("input, select, textarea");
      if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") || (e.key === "/" && !typing)) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (e.key === "Escape" && !typing) {
        select(null, { push: false });
      } else if (!typing && (e.key === "Backspace" || (e.altKey && e.key === "ArrowLeft"))) {
        e.preventDefault();
        back();
      } else if (!typing && (e.key === "+" || e.key === "=")) {
        engine?.zoomBy(1.4);
      } else if (!typing && e.key === "-") {
        engine?.zoomBy(1 / 1.4);
      } else if (!typing && e.key === "0") {
        engine?.fit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [select, back, engine]);

  const ensureVisible = useCallback(
    (id: number) => {
      if (!graph) return;
      const node = graph.nodes[id];
      if (!kindVisible(node, variant)) {
        setVariant((v) => ({ relay: v.relay || node.k === "c" || node.k === "e", inputs: v.inputs || node.k === "i" }));
      }
      if (hidden.has(node.r)) setHidden((h) => new Set([...h].filter((r) => r !== node.r)));
    },
    [graph, variant, hidden],
  );

  const goTo = useCallback(
    (sel: NonNullable<Selection>) => {
      const v = viewRef.current;
      if (v && !v.on[sel.node]) {
        ensureVisible(sel.node);
        select(sel);
        return;
      }
      select(sel, { focus: true, row: sel.field ?? -1 });
    },
    [ensureVisible, select],
  );

  if (error) {
    return (
      <div className="fc fc-message">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="fc">
      <aside className="fc-panel">
        <header className="fc-head">
          <a className="fc-home" href="/">
            ← Opgaver
          </a>
          <h1>flexibleCurrent v3</h1>
          <p className="fc-sub">
            Datafordelerens GraphQL-skema
            {graph && (
              <>
                {" "}
                · {graph.stats.objects} typer · {graph.stats.fields.toLocaleString("da-DK")} felter
              </>
            )}
          </p>
        </header>

        {graph && index && view && (
          <Search
            inputRef={searchRef}
            graph={graph}
            index={index}
            view={view}
            onPick={(hit) => goTo(hit.field >= 0 ? { node: hit.node, field: hit.field } : { node: hit.node })}
          />
        )}

        {graph && view && (
          <Options
            graph={graph}
            view={view}
            variant={variant}
            setVariant={setVariant}
            hidden={hidden}
            setHidden={setHidden}
            root={root}
            setRoot={setRoot}
          />
        )}

        {graph && view && selection ? (
          <TypeDetails
            graph={graph}
            details={details}
            view={view}
            selection={selection}
            canGoBack={history.length > 0}
            onBack={back}
            onClose={() => select(null)}
            goTo={goTo}
          />
        ) : (
          <Help />
        )}
      </aside>

      <main className="fc-stage">
        <canvas ref={canvasRef} className="fc-canvas" aria-label="Graf over typer i skemaet" />
        {!view && <div className="fc-loading">Indlæser skema…</div>}
        <div className="fc-zoom">
          <button type="button" onClick={() => engine?.zoomBy(1.4)} aria-label="Zoom ind">
            +
          </button>
          <button type="button" onClick={() => engine?.zoomBy(1 / 1.4)} aria-label="Zoom ud">
            −
          </button>
          <button type="button" onClick={() => engine?.fit()} aria-label="Vis hele grafen">
            ⤢
          </button>
        </div>
      </main>
    </div>
  );
}

function Search({
  inputRef,
  graph,
  index,
  view,
  onPick,
}: {
  inputRef: React.RefObject<HTMLInputElement>;
  graph: Graph;
  index: SearchIndex;
  view: View;
  onPick: (hit: SearchHit) => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  // Hidden kinds stay searchable (ranked last); picking one switches its toggle on.
  const result = useMemo(() => {
    const t0 = performance.now();
    const found = index.search(query, (id) => !view.on[id]);
    const ms = performance.now() - t0;
    if (query) {
      perf.searchMs = ms;
      perf.searchSamples.push(ms);
    }
    return { ...found, ms };
  }, [index, query, view]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const pick = (hit: SearchHit | undefined) => {
    if (!hit) return;
    onPick(hit);
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(result.hits.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      pick(result.hits[active]);
    } else if (e.key === "Escape") {
      if (query) setQuery("");
      else inputRef.current?.blur();
      setOpen(false);
    }
  };

  return (
    <div className="fc-search">
      <input
        ref={inputRef}
        type="search"
        value={query}
        placeholder={`Søg type eller felt  ( ${SEARCH_KEY} )`}
        aria-label="Søg i skemaet"
        aria-expanded={open && result.hits.length > 0}
        aria-controls="fc-results"
        role="combobox"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKey}
      />
      {open && query && (
        <div className="fc-results">
          <ul id="fc-results" role="listbox" ref={listRef}>
            {result.hits.map((hit, i) => {
              const node = graph.nodes[hit.node];
              const row = hit.field >= 0 ? node.f[hit.field] : null;
              return (
                <li
                  key={`${hit.node}.${hit.field}`}
                  data-i={i}
                  role="option"
                  aria-selected={i === active}
                  className={i === active ? "is-active" : undefined}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(hit);
                  }}
                  onMouseEnter={() => setActive(i)}
                >
                  <span className="fc-dot" style={{ background: graph.registers[node.r][1] }} />
                  {row ? (
                    <span className="fc-result-text">
                      <span className="fc-muted">{node.n}.</span>
                      <b>{row[0]}</b>
                      <span className="fc-muted">: {rowLabel(row, view.variant.relay)}</span>
                    </span>
                  ) : (
                    <span className="fc-result-text">
                      <b>{node.n}</b>
                      {node.k !== "o" && <span className="fc-kind">{KIND_LABEL[node.k]}</span>}
                    </span>
                  )}
                </li>
              );
            })}
            {!result.hits.length && <li className="fc-empty">Ingen træf</li>}
          </ul>
          <p className="fc-results-foot">
            {result.total.toLocaleString("da-DK")} træf · {result.ms.toFixed(1)} ms
          </p>
        </div>
      )}
    </div>
  );
}

function Options({
  graph,
  view,
  variant,
  setVariant,
  hidden,
  setHidden,
  root,
  setRoot,
}: {
  graph: Graph;
  view: View;
  variant: Variant;
  setVariant: (v: Variant) => void;
  hidden: Set<number>;
  setHidden: (h: Set<number>) => void;
  root: number;
  setRoot: (r: number) => void;
}) {
  const counts = useMemo(() => {
    const c = new Map<number, number>();
    graph.nodes.forEach((n) => {
      if (kindVisible(n, variant)) c.set(n.r, (c.get(n.r) ?? 0) + 1);
    });
    return c;
  }, [graph, variant]);
  const roots = useMemo(
    () =>
      graph.nodes
        .map((n, i) => [n, i] as const)
        .filter(([n]) => n.k === "o" || n.k === "f")
        .sort((a, b) => (a[1] === 0 ? -1 : b[1] === 0 ? 1 : a[0].n.localeCompare(b[0].n))),
    [graph],
  );

  const toggle = (r: number, solo: boolean) => {
    if (solo) {
      setHidden(new Set([...counts.keys()].filter((k) => k !== r && k !== 0)));
      return;
    }
    const next = new Set(hidden);
    if (next.has(r)) next.delete(r);
    else next.add(r);
    setHidden(next);
  };

  return (
    <details className="fc-options">
      <summary>
        Visning
        <span className="fc-muted">
          {" "}
          · {view.order.length} typer · {view.edgeCount.toLocaleString("da-DK")} relationer
        </span>
      </summary>
      <label className="fc-check">
        <input type="checkbox" checked={variant.relay} onChange={(e) => setVariant({ ...variant, relay: e.target.checked })} />
        Vis Connection- og Edge-typer
      </label>
      <label className="fc-check">
        <input type="checkbox" checked={variant.inputs} onChange={(e) => setVariant({ ...variant, inputs: e.target.checked })} />
        Vis input-typer (filtre)
      </label>
      <label className="fc-field">
        Rod-type
        <select value={root} onChange={(e) => setRoot(Number(e.target.value))}>
          {roots.map(([n, i]) => (
            <option key={i} value={i}>
              {n.n}
            </option>
          ))}
        </select>
      </label>
      <div className="fc-registers">
        <p className="fc-label">
          Registre <span className="fc-muted">(shift-klik viser kun ét)</span>
          {hidden.size > 0 && (
            <button type="button" className="fc-link" onClick={() => setHidden(new Set())}>
              Vis alle
            </button>
          )}
        </p>
        <div className="fc-chips">
          {graph.registers.map(([name, color], r) =>
            counts.get(r) ? (
              <button
                key={name}
                type="button"
                className={`fc-chip${hidden.has(r) ? " is-off" : ""}`}
                aria-pressed={!hidden.has(r)}
                onClick={(e) => toggle(r, e.shiftKey)}
              >
                <span className="fc-dot" style={{ background: color }} />
                {name}
                <span className="fc-muted">{counts.get(r)}</span>
              </button>
            ) : null,
          )}
        </div>
      </div>
    </details>
  );
}

function Help() {
  return (
    <div className="fc-help">
      <p>Klik en type for at se dens felter og relationer. Klik et felt eller en kant for at følge relationen.</p>
      <ul>
        <li>
          <kbd>{SEARCH_KEY}</kbd> eller <kbd>/</kbd> søg · <kbd>Esc</kbd> ryd valg · <kbd>⌫</kbd> tilbage
        </li>
        <li>
          Træk for at panorere · hjul eller knib for at zoome · dobbeltklik for at fokusere
        </li>
        <li>
          Sider (<code>XConnection → XEdge → X</code>) er foldet sammen til én relation <code>[X]</code>.
        </li>
      </ul>
    </div>
  );
}

function TypeDetails({
  graph,
  details,
  view,
  selection,
  canGoBack,
  onBack,
  onClose,
  goTo,
}: {
  graph: Graph;
  details: Details | null;
  view: View;
  selection: NonNullable<Selection>;
  canGoBack: boolean;
  onBack: () => void;
  onClose: () => void;
  goTo: (sel: NonNullable<Selection>) => void;
}) {
  const id = selection.node;
  const node = graph.nodes[id];
  const [register, color] = graph.registers[node.r];
  const description = details?.d[id];
  const listRef = useRef<HTMLOListElement>(null);
  const incoming = useMemo(() => {
    const seen = new Set<string>();
    return view.inc[id]
      .map((e) => ({ s: view.es[e], f: view.ef[e], arg: view.edgeKind[e] }))
      .filter(({ s, f }) => !seen.has(`${s}.${f}`) && seen.add(`${s}.${f}`));
  }, [view, id]);

  useEffect(() => {
    if (selection.field === undefined) return;
    listRef.current?.querySelector(`[data-f="${selection.field}"]`)?.scrollIntoView({ block: "center" });
  }, [selection]);

  return (
    <section className="fc-type" key={id}>
      <div className="fc-type-bar">
        <button type="button" className="fc-link" disabled={!canGoBack} onClick={onBack}>
          ← Tilbage
        </button>
        <button type="button" className="fc-link" onClick={onClose} aria-label="Luk">
          Luk ✕
        </button>
      </div>
      <h2>
        <span className="fc-dot fc-dot-lg" style={{ background: color }} />
        {node.n}
      </h2>
      <p className="fc-badges">
        <span className="fc-kind">{KIND_LABEL[node.k]}</span>
        <span className="fc-kind">{register}</span>
        <span className="fc-muted">{node.f.length} felter</span>
      </p>
      {selection.via && (
        <p className="fc-via">
          Via{" "}
          <button type="button" className="fc-link" onClick={() => goTo({ node: selection.via!.s, field: selection.via!.f })}>
            {graph.nodes[selection.via.s].n}.{graph.nodes[selection.via.s].f[selection.via.f][0]}
          </button>
          {graph.nodes[selection.via.s].f[selection.via.f][5] & FLAG_MANY ? " (til-mange)" : " (til-en)"}
        </p>
      )}
      {node.i && (
        <p className="fc-muted">
          Implementerer{" "}
          {node.i.map((t) => (
            <button key={t} type="button" className="fc-link" onClick={() => goTo({ node: t })}>
              {graph.nodes[t].n}
            </button>
          ))}
        </p>
      )}
      {description ? <Description text={description} /> : !details && <p className="fc-muted">Henter beskrivelser…</p>}

      <h3>Felter</h3>
      <ol className="fc-fields" ref={listRef}>
        {node.f.map((_, f) => (
          <FieldItem
            key={f}
            graph={graph}
            details={details}
            view={view}
            node={id}
            field={f}
            marked={selection.field === f}
            goTo={goTo}
          />
        ))}
      </ol>

      {incoming.length > 0 && (
        <>
          <h3>Bruges af ({incoming.length})</h3>
          <ul className="fc-incoming">
            {incoming.map(({ s, f, arg }) => (
              <li key={`${s}.${f}`}>
                <button type="button" className="fc-link" onClick={() => goTo({ node: s, field: f })}>
                  {graph.nodes[s].n}.{graph.nodes[s].f[f][0]}
                </button>
                {arg === EDGE_ARG ? <span className="fc-muted"> (argument)</span> : null}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Description({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const clean = cleanText(text);
  const long = clean.length > 220;
  return (
    <div className={`fc-desc${open || !long ? " is-open" : ""}`}>
      <p>{clean}</p>
      {long && (
        <button type="button" className="fc-link" onClick={() => setOpen(!open)}>
          {open ? "Vis mindre" : "Vis mere"}
        </button>
      )}
    </div>
  );
}

function FieldItem({
  graph,
  details,
  view,
  node,
  field,
  marked,
  goTo,
}: {
  graph: Graph;
  details: Details | null;
  view: View;
  node: number;
  field: number;
  marked: boolean;
  goTo: (sel: NonNullable<Selection>) => void;
}) {
  const row = graph.nodes[node].f[field];
  const [argsOpen, setArgsOpen] = useState(false);
  const target = rowTarget(row, view.variant.relay);
  const description = details?.f[`${node}.${field}`];
  const args = details?.a[`${node}.${field}`];
  return (
    <li data-f={field} className={marked ? "is-marked" : undefined}>
      <div className="fc-field-line">
        <button type="button" className="fc-field-name" onClick={() => goTo({ node, field })}>
          {row[0]}
        </button>
        {row[5] & FLAG_ARGS ? (
          <button type="button" className="fc-args-toggle" aria-expanded={argsOpen} onClick={() => setArgsOpen(!argsOpen)}>
            (…)
          </button>
        ) : null}
        <span className="fc-colon">:</span>
        {target >= 0 ? (
          <button
            type="button"
            className="fc-type-link"
            onClick={() => goTo(target === node ? { node } : { node: target, via: { s: node, f: field } })}
          >
            {rowLabel(row, view.variant.relay)}
          </button>
        ) : (
          <span className="fc-type-name" title={enumTitle(details, rowLabel(row, view.variant.relay))}>
            {rowLabel(row, view.variant.relay)}
          </span>
        )}
      </div>
      {description && <p className="fc-field-desc">{cleanText(description)}</p>}
      {argsOpen && (
        <ul className="fc-args">
          {!args && <li className="fc-muted">Henter argumenter…</li>}
          {args?.map(([name, type, t, def]) => (
            <li key={name}>
              <span className="fc-arg-name">{name}</span>
              <span className="fc-colon">:</span>
              {t >= 0 && graph.nodes[t].k === "i" ? (
                <InputType graph={graph} id={t} label={type} depth={0} goTo={goTo} view={view} />
              ) : (
                <span className="fc-type-name">{type}</span>
              )}
              {def !== undefined && <span className="fc-muted"> = {def}</span>}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function enumTitle(details: Details | null, label: string) {
  const values = details?.e[label.replace(/[[\]!]/g, "")];
  return values ? values.join(" | ") : undefined;
}

function InputType({
  graph,
  id,
  label,
  depth,
  goTo,
  view,
}: {
  graph: Graph;
  id: number;
  label: string;
  depth: number;
  goTo: (sel: NonNullable<Selection>) => void;
  view: View;
}) {
  const [open, setOpen] = useState(false);
  const node = graph.nodes[id];
  return (
    <span className="fc-input">
      <button type="button" className="fc-type-link" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "▾ " : "▸ "}
        {label}
      </button>
      {view.on[id] ? (
        <button type="button" className="fc-link fc-small" onClick={() => goTo({ node: id })}>
          vis i graf
        </button>
      ) : null}
      {open && (
        <ul className="fc-args">
          {node.f.map((row) => {
            const t = row[4];
            return (
              <li key={row[0]}>
                <span className="fc-arg-name">{row[0]}</span>
                <span className="fc-colon">:</span>
                {t >= 0 && graph.nodes[t].k === "i" && depth < 5 ? (
                  <InputType graph={graph} id={t} label={row[1]} depth={depth + 1} goTo={goTo} view={view} />
                ) : (
                  <span className="fc-type-name">{row[1]}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </span>
  );
}
