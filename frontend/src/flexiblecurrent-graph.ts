// Canvas renderer for the pre-laid-out flexibleCurrent graph. Everything that
// runs per frame reads typed arrays; React never re-renders while panning.

// Must match scripts/build-flexcurrent.mjs.
export const HEADER = 30;
export const ROW = 20;
export const PAD = 10;
export const CHAR = 7.25;

export type Row = [name: string, label: string, relayLabel: string | 0, compact: number, raw: number, flags: number, inputs?: number[]];
export type Kind = "o" | "f" | "c" | "e" | "i";
export type GNode = { n: string; k: Kind; r: number; f: Row[]; i?: number[] };
export type Layout = {
  nodes: [id: number, x: number, y: number, w: number, h: number][];
  clusters: [register: number, x: number, y: number, w: number, h: number][];
};
export type Graph = {
  hash: string;
  stats: Record<string, number>;
  registers: [name: string, color: string][];
  nodes: GNode[];
  layout: Layout;
};
export type ArgRow = [name: string, type: string, target: number, defaultValue?: string, description?: string];
export type Details = {
  d: Record<string, string>;
  f: Record<string, string>;
  a: Record<string, ArgRow[]>;
  e: Record<string, string[]>;
};
/** prefLabel (da) and definition/comment, either may be "". Types keyed by index, fields by "type.field". */
export type Meaning = [label: string, text: string];
export type Meanings = { t: Record<string, Meaning>; f: Record<string, Meaning> };
export type Variant = { relay: boolean; inputs: boolean };
/** `field` marks one row of the selected type; `via` is the relation that led here. */
export type Selection = { node: number; field?: number; via?: { s: number; f: number } } | null;

export const EDGE_FIELD = 0;
export const EDGE_ARG = 1;
export const EDGE_ROOT = 2;

export const FLAG_MANY = 1;
export const FLAG_ARGS = 2;

export function rowLabel(row: Row, relay: boolean): string {
  return relay && row[2] ? row[2] : row[1];
}

export function rowTarget(row: Row, relay: boolean): number {
  return relay ? row[4] : row[3];
}

export function kindVisible(node: GNode, variant: Variant): boolean {
  if (node.k === "i") return variant.inputs;
  if (node.k === "c" || node.k === "e" || node.n === "PageInfo") return variant.relay;
  return true;
}

export type View = {
  variant: Variant;
  x: Float64Array;
  y: Float64Array;
  w: Float64Array;
  h: Float64Array;
  on: Uint8Array;
  order: Int32Array;
  edgeCount: number;
  es: Int32Array;
  ef: Int32Array;
  et: Int32Array;
  edgeKind: Uint8Array;
  geo: Float64Array;
  box: Float64Array;
  out: number[][];
  inc: number[][];
  clusters: Layout["clusters"];
  bounds: [number, number, number, number];
};

export function buildView(graph: Graph, layout: Layout, variant: Variant, hidden: Set<number>, root: number): View {
  const n = graph.nodes.length;
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const w = new Float64Array(n);
  const h = new Float64Array(n);
  const placed = new Uint8Array(n);
  for (const [id, nx, ny, nw, nh] of layout.nodes) {
    x[id] = nx;
    y[id] = ny;
    w[id] = nw;
    h[id] = nh;
    placed[id] = kindVisible(graph.nodes[id], variant) && !hidden.has(graph.nodes[id].r) ? 1 : 0;
  }

  const targetsOf = (id: number): number[] => {
    const list: number[] = [];
    for (const row of graph.nodes[id].f) {
      const t = rowTarget(row, variant.relay);
      if (t >= 0) list.push(t);
      if (variant.inputs && row[6]) list.push(...row[6]);
    }
    return list;
  };

  // Like Voyager, only types reachable from the root are drawn.
  const on = new Uint8Array(n);
  const start = placed[root] ? root : -1;
  if (start >= 0) {
    const stack = [start];
    on[start] = 1;
    while (stack.length) {
      for (const t of targetsOf(stack.pop()!)) {
        if (placed[t] && !on[t]) {
          on[t] = 1;
          stack.push(t);
        }
      }
    }
  }

  const es: number[] = [];
  const ef: number[] = [];
  const et: number[] = [];
  const edgeKind: number[] = [];
  const out: number[][] = Array.from({ length: n }, () => []);
  const inc: number[][] = Array.from({ length: n }, () => []);
  for (let s = 0; s < n; s++) {
    if (!on[s]) continue;
    const rows = graph.nodes[s].f;
    for (let f = 0; f < rows.length; f++) {
      const row = rows[f];
      const add = (t: number, kind: number) => {
        if (t < 0 || !on[t]) return;
        out[s].push(es.length);
        inc[t].push(es.length);
        es.push(s);
        ef.push(f);
        et.push(t);
        edgeKind.push(kind);
      };
      add(rowTarget(row, variant.relay), s === root ? EDGE_ROOT : EDGE_FIELD);
      if (variant.inputs && row[6]) for (const t of new Set(row[6])) add(t, EDGE_ARG);
    }
  }

  const edgeCount = es.length;
  const geo = new Float64Array(edgeCount * 8);
  const box = new Float64Array(edgeCount * 4);
  for (let e = 0; e < edgeCount; e++) {
    const s = es[e];
    const t = et[e];
    const sx = x[s] + w[s];
    const sy = y[s] + HEADER + ef[e] * ROW + ROW / 2;
    let tx = x[t];
    const ty = y[t] + HEADER / 2;
    let c1x: number, c2x: number, c1y = sy, c2y = ty;
    if (s === t) {
      tx = x[t] + w[t];
      c1x = sx + 70;
      c2x = tx + 70;
    } else {
      const d = Math.max(60, Math.abs(tx - sx) * 0.4);
      c1x = sx + d;
      c2x = tx - d;
    }
    geo.set([sx, sy, c1x, c1y, c2x, c2y, tx, ty], e * 8);
    box[e * 4] = Math.min(sx, c1x, c2x, tx);
    box[e * 4 + 1] = Math.min(sy, ty);
    box[e * 4 + 2] = Math.max(sx, c1x, c2x, tx);
    box[e * 4 + 3] = Math.max(sy, ty);
  }

  const order: number[] = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const clusterBoxes = new Map<number, [number, number, number, number]>();
  for (let i = 0; i < n; i++) {
    if (!on[i]) continue;
    order.push(i);
    minX = Math.min(minX, x[i]);
    minY = Math.min(minY, y[i]);
    maxX = Math.max(maxX, x[i] + w[i]);
    maxY = Math.max(maxY, y[i] + h[i]);
    const r = graph.nodes[i].r;
    const b = clusterBoxes.get(r);
    if (b) {
      b[0] = Math.min(b[0], x[i]);
      b[1] = Math.min(b[1], y[i]);
      b[2] = Math.max(b[2], x[i] + w[i]);
      b[3] = Math.max(b[3], y[i] + h[i]);
    } else clusterBoxes.set(r, [x[i], y[i], x[i] + w[i], y[i] + h[i]]);
  }
  const clusters: Layout["clusters"] = [];
  for (const [register, cx, cy, cw, ch] of layout.clusters) {
    const b = clusterBoxes.get(register);
    if (!b) continue;
    // Shrink the precomputed cluster frame to what survived filtering.
    const x0 = Math.max(cx, b[0] - 32);
    const y0 = Math.max(cy, b[1] - 56);
    clusters.push([register, x0, y0, Math.min(cx + cw, b[2] + 32) - x0, Math.min(cy + ch, b[3] + 32) - y0]);
  }
  if (!order.length) {
    minX = minY = 0;
    maxX = maxY = 1;
  }

  return {
    variant,
    x,
    y,
    w,
    h,
    on,
    order: Int32Array.from(order),
    edgeCount,
    es: Int32Array.from(es),
    ef: Int32Array.from(ef),
    et: Int32Array.from(et),
    edgeKind: Uint8Array.from(edgeKind),
    geo,
    box,
    out,
    inc,
    clusters,
    bounds: [minX, minY, maxX, maxY],
  };
}

const CELL = 512;

class Grid {
  private cells = new Map<number, number[]>();
  private key(cx: number, cy: number) {
    return (cx + 2048) * 8192 + (cy + 2048);
  }
  add(id: number, x0: number, y0: number, x1: number, y1: number) {
    for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) {
      for (let cy = Math.floor(y0 / CELL); cy <= Math.floor(y1 / CELL); cy++) {
        const k = this.key(cx, cy);
        const list = this.cells.get(k);
        if (list) {
          if (list[list.length - 1] !== id) list.push(id);
        } else this.cells.set(k, [id]);
      }
    }
  }
  at(x: number, y: number): number[] {
    return this.cells.get(this.key(Math.floor(x / CELL), Math.floor(y / CELL))) ?? [];
  }
}

function bezier(g: Float64Array, o: number, t: number): [number, number] {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [a * g[o] + b * g[o + 2] + c * g[o + 4] + d * g[o + 6], a * g[o + 1] + b * g[o + 3] + c * g[o + 5] + d * g[o + 7]];
}

export type Hit = { node: number; row: number } | { edge: number } | null;

export type GraphEvents = {
  onClick(hit: Hit): void;
  onDoubleClick(hit: Hit): void;
  /** Every pointer move over the canvas, with canvas-local coordinates; null while dragging or away. */
  onHover?(hit: Hit, x: number, y: number): void;
};

type Camera = { s: number; tx: number; ty: number };

const FONT_TITLE = '600 13px Inter, "Segoe UI", system-ui, sans-serif';
const FONT_ROW = '12px ui-monospace, SFMono-Regular, Menlo, Consolas, "DejaVu Sans Mono", monospace';
const FONT_CLUSTER = 'Georgia, "Times New Roman", serif';

export class GraphCanvas {
  private ctx: CanvasRenderingContext2D;
  private view: View | null = null;
  private nodeGrid = new Grid();
  private edgeGrid = new Grid();
  private edgePoly: Float32Array[] = [];
  private cam: Camera = { s: 1, tx: 0, ty: 0 };
  private width = 0;
  private height = 0;
  private dpr = 1;
  private frame = 0;
  private anim: { from: Camera; to: Camera; start: number; ms: number } | null = null;
  private nodeHi: Uint8Array | null = null;
  private edgeHi: Uint8Array | null = null;
  private selected = -1;
  private mark: [node: number, row: number] = [-1, -1];
  private hover: Hit = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private drag: { x: number; y: number; moved: boolean; pinch?: number } | null = null;
  private resizer: ResizeObserver;
  private cleanup: (() => void)[] = [];

  readonly stats = { frames: 0, drawMs: 0, maxDrawMs: 0, firstFrameAt: 0 };

  constructor(
    private canvas: HTMLCanvasElement,
    private graph: Graph,
    private events: GraphEvents,
  ) {
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.resizer = new ResizeObserver(() => this.resize());
    this.resizer.observe(canvas);
    this.resize();
    this.bind();
  }

  destroy() {
    cancelAnimationFrame(this.frame);
    this.resizer.disconnect();
    for (const off of this.cleanup) off();
  }

  setView(view: View) {
    this.view = view;
    this.nodeGrid = new Grid();
    this.edgeGrid = new Grid();
    for (const i of view.order) this.nodeGrid.add(i, view.x[i], view.y[i], view.x[i] + view.w[i], view.y[i] + view.h[i]);
    this.edgePoly = [];
    for (let e = 0; e < view.edgeCount; e++) {
      const o = e * 8;
      const g = view.geo;
      const length = Math.hypot(g[o + 2] - g[o], g[o + 3] - g[o + 1]) + Math.hypot(g[o + 4] - g[o + 2], g[o + 5] - g[o + 3]) + Math.hypot(g[o + 6] - g[o + 4], g[o + 7] - g[o + 5]);
      const steps = Math.min(400, Math.max(8, Math.ceil(length / 200)));
      const poly = new Float32Array((steps + 1) * 2);
      for (let k = 0; k <= steps; k++) {
        const [px, py] = bezier(g, o, k / steps);
        poly[k * 2] = px;
        poly[k * 2 + 1] = py;
        if (k) {
          const ax = poly[k * 2 - 2], ay = poly[k * 2 - 1];
          this.edgeGrid.add(e, Math.min(ax, px) - 8, Math.min(ay, py) - 8, Math.max(ax, px) + 8, Math.max(ay, py) + 8);
        }
      }
      this.edgePoly.push(poly);
    }
    this.hover = null;
    this.events.onHover?.(null, 0, 0);
    this.redraw();
  }

  setSelection(sel: Selection) {
    const view = this.view;
    this.mark = [-1, -1];
    if (!view || !sel || !view.on[sel.node]) {
      this.nodeHi = this.edgeHi = null;
      this.selected = -1;
      this.redraw();
      return;
    }
    const nodeHi = new Uint8Array(view.on.length);
    const edgeHi = new Uint8Array(view.edgeCount);
    nodeHi[sel.node] = 2;
    if (sel.via) {
      this.mark = [sel.via.s, sel.via.f];
      nodeHi[sel.via.s] ||= 1;
      for (const e of view.out[sel.via.s]) if (view.ef[e] === sel.via.f && view.et[e] === sel.node) edgeHi[e] = 1;
    } else if (sel.field !== undefined) {
      this.mark = [sel.node, sel.field];
      for (const e of view.out[sel.node]) {
        if (view.ef[e] !== sel.field) continue;
        edgeHi[e] = 1;
        nodeHi[view.et[e]] ||= 1;
      }
    } else {
      for (const e of view.out[sel.node]) {
        edgeHi[e] = 1;
        nodeHi[view.et[e]] ||= 1;
      }
      for (const e of view.inc[sel.node]) {
        edgeHi[e] = 1;
        nodeHi[view.es[e]] ||= 1;
      }
    }
    this.nodeHi = nodeHi;
    this.edgeHi = edgeHi;
    this.selected = sel.node;
    this.redraw();
  }

  fit(ids?: number[], animate = true) {
    const view = this.view;
    if (!view) return;
    let [x0, y0, x1, y1] = view.bounds;
    if (ids && ids.length) {
      x0 = y0 = Infinity;
      x1 = y1 = -Infinity;
      for (const i of ids) {
        x0 = Math.min(x0, view.x[i]);
        y0 = Math.min(y0, view.y[i]);
        x1 = Math.max(x1, view.x[i] + view.w[i]);
        y1 = Math.max(y1, view.y[i] + view.h[i]);
      }
    }
    const margin = 40;
    const s = Math.min(1.2, (this.width - margin * 2) / (x1 - x0), (this.height - margin * 2) / (y1 - y0));
    this.go({ s, tx: this.width / 2 - ((x0 + x1) / 2) * s, ty: this.height / 2 - ((y0 + y1) / 2) * s }, animate);
  }

  /** Centers a node (or one of its rows) at a readable zoom. */
  focus(id: number, row = -1, animate = true) {
    const view = this.view;
    if (!view || !view.on[id]) return;
    // Keep field rows legible: tall types are shown from the top, not shrunk to fit.
    const s = Math.max(0.55, Math.min(1, (this.height - 80) / view.h[id], (this.width * 0.6) / view.w[id]));
    const cx = view.x[id] + view.w[id] / 2;
    const tx = this.width / 2 - cx * s;
    if (row >= 0) {
      const cy = view.y[id] + HEADER + row * ROW + ROW / 2;
      this.go({ s, tx, ty: this.height / 2 - cy * s }, animate);
    } else if (view.h[id] * s > this.height - 80) {
      this.go({ s, tx, ty: 40 - view.y[id] * s }, animate);
    } else {
      this.go({ s, tx, ty: this.height / 2 - (view.y[id] + view.h[id] / 2) * s }, animate);
    }
  }

  zoomBy(factor: number) {
    this.zoomAt(this.width / 2, this.height / 2, factor, true);
  }

  private go(to: Camera, animate: boolean) {
    if (!animate || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.anim = null;
      this.cam = to;
      this.redraw();
      return;
    }
    this.anim = { from: { ...this.cam }, to, start: performance.now(), ms: 380 };
    this.redraw();
  }

  private minScale() {
    const view = this.view;
    if (!view) return 0.01;
    const [x0, y0, x1, y1] = view.bounds;
    return Math.min(0.5, 0.4 * Math.min(this.width / (x1 - x0), this.height / (y1 - y0)));
  }

  private zoomAt(sx: number, sy: number, factor: number, animate = false) {
    const c = this.anim ? this.anim.to : this.cam;
    const s = Math.min(4, Math.max(this.minScale(), c.s * factor));
    const k = s / c.s;
    const to = { s, tx: sx - (sx - c.tx) * k, ty: sy - (sy - c.ty) * k };
    if (animate) this.go(to, true);
    else {
      this.anim = null;
      this.cam = to;
      this.redraw();
    }
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.max(1, Math.round(rect.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * this.dpr));
    this.redraw();
  }

  private toWorld(sx: number, sy: number): [number, number] {
    return [(sx - this.cam.tx) / this.cam.s, (sy - this.cam.ty) / this.cam.s];
  }

  hitTest(sx: number, sy: number): Hit {
    const view = this.view;
    if (!view) return null;
    const [wx, wy] = this.toWorld(sx, sy);
    const nodes = this.nodeGrid.at(wx, wy);
    for (let k = nodes.length - 1; k >= 0; k--) {
      const i = nodes[k];
      if (wx >= view.x[i] && wx <= view.x[i] + view.w[i] && wy >= view.y[i] && wy <= view.y[i] + view.h[i]) {
        const row = Math.floor((wy - view.y[i] - HEADER) / ROW);
        return { node: i, row: row >= 0 && row < this.graph.nodes[i].f.length ? row : -1 };
      }
    }
    const tolerance = 6 / this.cam.s;
    let best = -1;
    let bestDist = tolerance * tolerance;
    for (const e of this.edgeGrid.at(wx, wy)) {
      const poly = this.edgePoly[e];
      for (let k = 2; k < poly.length; k += 2) {
        const d = segmentDistance(wx, wy, poly[k - 2], poly[k - 1], poly[k], poly[k + 1]);
        // Prefer highlighted edges when several overlap.
        const bias = this.edgeHi?.[e] ? 0.5 : 1;
        if (d * bias < bestDist) {
          bestDist = d * bias;
          best = e;
        }
      }
    }
    return best >= 0 ? { edge: best } : null;
  }

  private bind() {
    const c = this.canvas;
    const local = (e: PointerEvent | WheelEvent | MouseEvent) => {
      const r = c.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const on = <K extends keyof HTMLElementEventMap>(type: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      c.addEventListener(type, fn as EventListener, opts);
      this.cleanup.push(() => c.removeEventListener(type, fn as EventListener));
    };

    on(
      "wheel",
      (e) => {
        e.preventDefault();
        this.events.onHover?.(null, 0, 0);
        const p = local(e);
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.height : 1;
        const dx = e.deltaX * unit;
        const dy = e.deltaY * unit;
        // Pinch and mouse wheels zoom; two-finger trackpad scrolls pan.
        const mouseWheel = e.deltaMode !== 0 || (dx === 0 && Math.abs(dy) >= 40 && Number.isInteger(dy));
        if (e.ctrlKey || e.metaKey || mouseWheel) {
          this.zoomAt(p.x, p.y, Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0018)));
        } else {
          this.anim = null;
          this.cam = { ...this.cam, tx: this.cam.tx - dx, ty: this.cam.ty - dy };
          this.redraw();
        }
      },
      { passive: false },
    );

    on("pointerdown", (e) => {
      this.events.onHover?.(null, 0, 0);
      c.setPointerCapture(e.pointerId);
      const p = local(e);
      this.pointers.set(e.pointerId, p);
      this.anim = null;
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.drag = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, moved: true, pinch: Math.hypot(a.x - b.x, a.y - b.y) };
      } else this.drag = { x: p.x, y: p.y, moved: false };
    });

    on("pointermove", (e) => {
      const p = local(e);
      if (!this.drag || !this.pointers.has(e.pointerId)) {
        const hit = this.hitTest(p.x, p.y);
        if (!sameHit(hit, this.hover)) {
          this.hover = hit;
          c.style.cursor = hit ? "pointer" : "grab";
          this.redraw();
        }
        this.events.onHover?.(hit, p.x, p.y);
        return;
      }
      this.pointers.set(e.pointerId, p);
      if (this.drag.pinch !== undefined && this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        this.cam = { ...this.cam, tx: this.cam.tx + mx - this.drag.x, ty: this.cam.ty + my - this.drag.y };
        this.zoomAt(mx, my, dist / this.drag.pinch);
        this.drag = { x: mx, y: my, moved: true, pinch: dist };
        return;
      }
      const dx = p.x - this.drag.x;
      const dy = p.y - this.drag.y;
      if (!this.drag.moved && Math.hypot(dx, dy) < 4) return;
      this.drag = { x: p.x, y: p.y, moved: true };
      c.style.cursor = "grabbing";
      this.cam = { ...this.cam, tx: this.cam.tx + dx, ty: this.cam.ty + dy };
      this.redraw();
    });

    const release = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      const drag = this.drag;
      if (this.pointers.size) {
        const [rest] = [...this.pointers.values()];
        this.drag = { x: rest.x, y: rest.y, moved: true };
        return;
      }
      this.drag = null;
      c.style.cursor = this.hover ? "pointer" : "grab";
      if (drag && !drag.moved && e.type === "pointerup") {
        const p = local(e);
        this.events.onClick(this.hitTest(p.x, p.y));
      }
    };
    on("pointerup", release);
    on("pointercancel", release);
    on("pointerleave", () => {
      this.events.onHover?.(null, 0, 0);
      if (this.hover && !this.drag) {
        this.hover = null;
        this.redraw();
      }
    });
    on("dblclick", (e) => {
      const p = local(e);
      this.events.onDoubleClick(this.hitTest(p.x, p.y));
    });
  }

  redraw() {
    if (!this.frame) this.frame = requestAnimationFrame((now) => this.draw(now));
  }

  private draw(now: number) {
    this.frame = 0;
    const t0 = performance.now();
    if (this.anim) {
      const { from, to, start, ms } = this.anim;
      const t = Math.min(1, (now - start) / ms);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      // Interpolate the world point under the screen center and log-scale.
      const s = Math.exp(Math.log(from.s) + (Math.log(to.s) - Math.log(from.s)) * e);
      const fcx = (this.width / 2 - from.tx) / from.s, fcy = (this.height / 2 - from.ty) / from.s;
      const tcx = (this.width / 2 - to.tx) / to.s, tcy = (this.height / 2 - to.ty) / to.s;
      const cx = fcx + (tcx - fcx) * e, cy = fcy + (tcy - fcy) * e;
      this.cam = { s, tx: this.width / 2 - cx * s, ty: this.height / 2 - cy * s };
      if (t >= 1) {
        this.cam = to;
        this.anim = null;
      } else this.redraw();
    }

    const ctx = this.ctx;
    const { s, tx, ty } = this.cam;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = "#f5f3ec";
    ctx.fillRect(0, 0, this.width, this.height);
    const view = this.view;
    if (!view) return;

    ctx.setTransform(this.dpr * s, 0, 0, this.dpr * s, this.dpr * tx, this.dpr * ty);
    const vx0 = -tx / s, vy0 = -ty / s;
    const vx1 = (this.width - tx) / s, vy1 = (this.height - ty) / s;
    const nodes = this.graph.nodes;
    const registers = this.graph.registers;
    const dimming = this.nodeHi !== null;

    for (const [r, cx, cy, cw, ch] of view.clusters) {
      if (cx > vx1 || cy > vy1 || cx + cw < vx0 || cy + ch < vy0) continue;
      ctx.globalAlpha = dimming ? 0.5 : 1;
      ctx.fillStyle = registers[r][1] + "0d";
      ctx.strokeStyle = registers[r][1] + "33";
      ctx.lineWidth = 1 / s;
      ctx.beginPath();
      ctx.roundRect(cx, cy, cw, ch, 24);
      ctx.fill();
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    this.drawEdges(vx0, vy0, vx1, vy1, s);

    const titleVisible = 13 * s >= 4.5;
    const rowsVisible = ROW * s >= 8;
    const sketchRows = !rowsVisible && ROW * s >= 2.5;
    const hoverNode = this.hover && "node" in this.hover ? this.hover.node : -1;
    const hoverRow = this.hover && "node" in this.hover ? this.hover.row : -1;
    const hoverEdge = this.hover && "edge" in this.hover ? this.hover.edge : -1;

    // Dimmed nodes first so highlighted ones paint on top.
    for (const litPass of dimming ? [false, true] : [true]) {
      for (const i of view.order) {
        const lit = !dimming || this.nodeHi![i] > 0;
        if (lit !== litPass) continue;
        const x = view.x[i], y = view.y[i], w = view.w[i], h = view.h[i];
        if (x > vx1 || y > vy1 || x + w < vx0 || y + h < vy0) continue;
        const node = nodes[i];
        const color = registers[node.r][1];
        ctx.globalAlpha = lit ? 1 : 0.22;
        ctx.fillStyle = node.k === "i" ? "#f8fafc" : "#ffffff";
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, HEADER);
        if (s > 0.06) {
          ctx.strokeStyle = node.k === "c" || node.k === "e" ? "#a8a29e" : "#d6d3c9";
          ctx.lineWidth = 1 / s;
          ctx.strokeRect(x, y, w, h);
        }
        if (i === this.selected || i === hoverNode || (this.nodeHi && this.nodeHi[i] === 1 && dimming)) {
          ctx.strokeStyle = i === this.selected ? "#d97757" : i === hoverNode ? "#141413" : color;
          ctx.lineWidth = (i === this.selected ? 3 : 1.5) / s;
          ctx.strokeRect(x, y, w, h);
        }
        if (titleVisible) {
          ctx.font = FONT_TITLE;
          ctx.fillStyle = "#ffffff";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          const tag = node.k === "i" ? "input " : node.k === "f" ? "interface " : "";
          ctx.fillText(tag + node.n, x + PAD, y + HEADER / 2 + 1, w - PAD * 2);
        }
        if (sketchRows) {
          ctx.fillStyle = "#d6d3c9";
          ctx.beginPath();
          const first = Math.max(0, Math.floor((vy0 - y - HEADER) / ROW));
          const last = Math.min(node.f.length - 1, Math.ceil((vy1 - y - HEADER) / ROW));
          for (let k = first; k <= last; k++) {
            ctx.rect(x + PAD, y + HEADER + k * ROW + 7, Math.min(w - PAD * 2, node.f[k][0].length * CHAR), 6);
          }
          ctx.fill();
        } else if (rowsVisible) {
          this.drawRows(i, vy0, vy1, i === hoverNode ? hoverRow : -1);
        }
      }
    }
    ctx.globalAlpha = 1;

    // Register names go on top of the nodes so they stay readable when zoomed out.
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.lineJoin = "round";
    for (const [r, cx, cy, cw, ch] of view.clusters) {
      if (cx > vx1 || cy > vy1 || cx + cw < vx0 || cy + ch < vy0) continue;
      const size = Math.min(Math.max(30, 16 / s), cw / 5, ch / 2);
      ctx.font = `${size}px ${FONT_CLUSTER}`;
      ctx.globalAlpha = dimming ? 0.6 : 1;
      ctx.strokeStyle = "#f5f3ecdd";
      ctx.lineWidth = size / 5;
      ctx.strokeText(registers[r][0], cx + 24, cy + Math.max(40, size + 8));
      ctx.fillStyle = registers[r][1];
      ctx.fillText(registers[r][0], cx + 24, cy + Math.max(40, size + 8));
    }
    ctx.globalAlpha = 1;

    if (hoverEdge >= 0) {
      this.strokeEdge(hoverEdge, "#141413", 2.5);
    }

    const ms = performance.now() - t0;
    this.stats.frames++;
    this.stats.drawMs = ms;
    this.stats.maxDrawMs = Math.max(this.stats.maxDrawMs, ms);
    if (!this.stats.firstFrameAt) {
      this.stats.firstFrameAt = performance.now();
      performance.mark("fc:first-frame");
    }
  }

  private strokeEdge(e: number, color: string, width: number) {
    const g = this.view!.geo;
    const o = e * 8;
    const ctx = this.ctx;
    const dpr = this.dpr;
    const k = dpr * this.cam.s, ox = dpr * this.cam.tx, oy = dpr * this.cam.ty;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.strokeStyle = color;
    ctx.lineWidth = width * dpr;
    ctx.beginPath();
    ctx.moveTo(g[o] * k + ox, g[o + 1] * k + oy);
    ctx.bezierCurveTo(g[o + 2] * k + ox, g[o + 3] * k + oy, g[o + 4] * k + ox, g[o + 5] * k + oy, g[o + 6] * k + ox, g[o + 7] * k + oy);
    ctx.stroke();
    ctx.setTransform(k, 0, 0, k, ox, oy);
  }

  private drawEdges(vx0: number, vy0: number, vx1: number, vy1: number, s: number) {
    const view = this.view!;
    const ctx = this.ctx;
    const g = view.geo;
    const hi = this.edgeHi;
    const arrows = s > 0.18;
    const dpr = this.dpr;
    const k = dpr * s, ox = dpr * this.cam.tx, oy = dpr * this.cam.ty;
    // Edges are stroked in device pixels: 1px strokes then hit Skia's hairline
    // path, which in software rendering is ~25x faster than scaled world strokes.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // Batched by style: [edge kind, highlighted?] -> one path and one stroke each.
    // The root fans out to every entity, so its edges stay faint until selected.
    const styles: [number, number, string, number, number][] = hi
      ? [
          [EDGE_FIELD, 0, "#a8a29e", 0.1, 0],
          [EDGE_ARG, 0, "#2563eb", 0.08, 0],
          [EDGE_FIELD, 1, "#d97757", 1, 2.4],
          [EDGE_ARG, 1, "#2563eb", 1, 2],
        ]
      : [
          [EDGE_ROOT, 0, "#8a857a", 0.12, 0],
          [EDGE_FIELD, 0, "#8a857a", 0.5, 0],
          [EDGE_ARG, 0, "#2563eb", 0.35, 0],
        ];
    for (const [kind, isHi, color, alpha, width] of styles) {
      const isArg = kind === EDGE_ARG;
      ctx.beginPath();
      const heads: number[] = [];
      for (let e = 0; e < view.edgeCount; e++) {
        const ek = hi && view.edgeKind[e] === EDGE_ROOT ? EDGE_FIELD : view.edgeKind[e];
        if (ek !== kind) continue;
        if (hi && hi[e] !== isHi) continue;
        const b = e * 4;
        if (view.box[b] > vx1 || view.box[b + 1] > vy1 || view.box[b + 2] < vx0 || view.box[b + 3] < vy0) continue;
        const o = e * 8;
        ctx.moveTo(g[o] * k + ox, g[o + 1] * k + oy);
        ctx.bezierCurveTo(g[o + 2] * k + ox, g[o + 3] * k + oy, g[o + 4] * k + ox, g[o + 5] * k + oy, g[o + 6] * k + ox, g[o + 7] * k + oy);
        if ((arrows && kind !== EDGE_ROOT) || isHi) heads.push(o);
      }
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = width ? width * dpr : 1;
      if (isArg) ctx.setLineDash([6 * dpr, 4 * dpr]);
      ctx.stroke();
      ctx.setLineDash([]);
      if (heads.length) {
        const size = Math.min(10 * s, 7) * dpr;
        ctx.fillStyle = color;
        ctx.beginPath();
        for (const o of heads) {
          const hx = g[o + 6] * k + ox, hy = g[o + 7] * k + oy;
          const dir = g[o + 4] > g[o + 6] ? -1 : 1;
          ctx.moveTo(hx, hy);
          ctx.lineTo(hx - dir * size, hy - size * 0.55);
          ctx.lineTo(hx - dir * size, hy + size * 0.55);
          ctx.closePath();
        }
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.setTransform(k, 0, 0, k, ox, oy);
  }


  private drawRows(i: number, vy0: number, vy1: number, hoverRow: number) {
    const view = this.view!;
    const ctx = this.ctx;
    const node = this.graph.nodes[i];
    const relay = view.variant.relay;
    const x = view.x[i], y = view.y[i], w = view.w[i];
    const first = Math.max(0, Math.floor((vy0 - y - HEADER) / ROW));
    const last = Math.min(node.f.length - 1, Math.ceil((vy1 - y - HEADER) / ROW));
    if (first > last) return;
    const markRow = this.mark[0] === i ? this.mark[1] : -1;
    for (const k of [markRow, hoverRow]) {
      if (k < first || k > last) continue;
      ctx.fillStyle = k === hoverRow ? "#f1ede2" : "#fbe7df";
      ctx.fillRect(x + 1, y + HEADER + k * ROW, w - 2, ROW);
    }
    ctx.font = FONT_ROW;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = "#141413";
    for (let k = first; k <= last; k++) ctx.fillText(node.f[k][0], x + PAD, y + HEADER + k * ROW + ROW / 2 + 1);
    ctx.fillStyle = "#a8a29e";
    for (let k = first; k <= last; k++) {
      if (node.f[k][5] & FLAG_ARGS) ctx.fillText("(…)", x + PAD + node.f[k][0].length * CHAR + 2, y + HEADER + k * ROW + ROW / 2 + 1);
    }
    ctx.textAlign = "right";
    for (let k = first; k <= last; k++) {
      const row = node.f[k];
      const target = rowTarget(row, relay);
      ctx.fillStyle = target >= 0 && view.on[target] ? "#c2410c" : "#6b7280";
      ctx.fillText(rowLabel(row, relay), x + w - PAD, y + HEADER + k * ROW + ROW / 2 + 1);
    }
  }
}

function segmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  const qx = ax + t * dx - px, qy = ay + t * dy - py;
  return qx * qx + qy * qy;
}

function sameHit(a: Hit, b: Hit): boolean {
  if (a === null || b === null) return a === b;
  if ("edge" in a) return "edge" in b && a.edge === b.edge;
  return "node" in b && a.node === b.node && a.row === b.row;
}

export type SearchHit = { node: number; field: number; score: number };

/** Score at and above which a hit matched the Danish meaning, not the name. */
export const SCORE_MEANING = 16;
const MEANING_MIN_QUERY = 3;

/** Flat lowercase index over type and field names; one pass per keystroke. */
export class SearchIndex {
  private labels: string[] = [];
  private texts: string[] | null = null;
  private nodes: Int32Array;
  private fields: Int32Array;

  constructor(graph: Graph) {
    const nodes: number[] = [];
    const fields: number[] = [];
    graph.nodes.forEach((node, i) => {
      this.labels.push(node.n.toLowerCase());
      nodes.push(i);
      fields.push(-1);
      node.f.forEach((row, j) => {
        this.labels.push(row[0].toLowerCase());
        nodes.push(i);
        fields.push(j);
      });
    });
    this.nodes = Int32Array.from(nodes);
    this.fields = Int32Array.from(fields);
  }

  /** Lets queries of three or more letters also match prefLabel and definition text. */
  setMeanings(meanings: Meanings) {
    this.texts = this.labels.map((_, k) => {
      const m = this.fields[k] < 0 ? meanings.t[this.nodes[k]] : meanings.f[`${this.nodes[k]}.${this.fields[k]}`];
      return m ? `${m[0]} ${m[1]}`.toLowerCase() : "";
    });
  }

  /** Types rank above fields; `demote` pushes e.g. hidden input types to the end. */
  search(query: string, demote: (node: number) => boolean, limit = 60): { hits: SearchHit[]; total: number } {
    let q = query.trim().toLowerCase();
    if (!q) return { hits: [], total: 0 };
    let owner = "";
    const dot = q.indexOf(".");
    if (dot > 0) {
      owner = q.slice(0, dot);
      q = q.slice(dot + 1);
    }
    // Exact > prefix > word start (after "_") > substring, within types then fields;
    // meaning-text matches rank after every name match.
    const buckets: SearchHit[][] = Array.from({ length: SCORE_MEANING + 4 }, () => []);
    const labels = this.labels;
    const texts = !owner && q.length >= MEANING_MIN_QUERY ? this.texts : null;
    let total = 0;
    let ownerOk = false;
    for (let k = 0; k < labels.length; k++) {
      const isType = this.fields[k] < 0;
      if (owner) {
        if (isType) ownerOk = labels[k].includes(owner);
        if (isType || !ownerOk) continue;
      }
      const label = labels[k];
      const at = q ? label.indexOf(q) : 0;
      if (at < 0) {
        if (!texts || !texts[k].includes(q)) continue;
        const score = SCORE_MEANING + (demote(this.nodes[k]) ? 2 : 0) + (isType ? 0 : 1);
        total++;
        if (buckets[score].length < limit) buckets[score].push({ node: this.nodes[k], field: this.fields[k], score });
        continue;
      }
      const rank = !q ? 1 : label.length === q.length ? 0 : at === 0 ? 1 : label[at - 1] === "_" ? 2 : 3;
      const score = (demote(this.nodes[k]) ? 8 : 0) + (isType ? 0 : 4) + rank;
      total++;
      if (buckets[score].length < limit) buckets[score].push({ node: this.nodes[k], field: this.fields[k], score });
    }
    return { hits: buckets.flat().slice(0, limit), total };
  }
}
