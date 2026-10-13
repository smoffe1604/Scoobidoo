// Turns the flexibleCurrent SDL into a small, pre-laid-out graph for the
// /flexiblecurrent page. All parsing and layout happen here, once, so the
// browser only fetches coordinates and draws.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import ELK from "elkjs/lib/elk.bundled.js";
import {
  buildSchema,
  getNamedType,
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isListType,
  isNonNullType,
  isObjectType,
} from "graphql";

const here = dirname(fileURLToPath(import.meta.url));
const SCHEMA = resolve(here, "../../flexiblecurrent/FLEX_CURRENT_V003.schema.graphql");
const OUT = resolve(here, "../public/flexiblecurrent");

// Must match the drawing constants in src/FlexibleCurrent.tsx.
const HEADER = 30;
const ROW = 20;
const PAD = 10;
const CHAR = 7.25;
const TITLE_CHAR = 8.4;
const MIN_W = 160;

const REGISTERS = [
  ["Query", "#141413"],
  ["BBR", "#d97757"],
  ["CPR", "#c2410c"],
  ["CVR", "#2563eb"],
  ["DAGI", "#0f766e"],
  ["DAR", "#7c3aed"],
  ["DHMHoejdekurver", "#65a30d"],
  ["DHMOprindelse", "#4d7c0f"],
  ["DS", "#0891b2"],
  ["EBR", "#be185d"],
  ["EJF", "#b45309"],
  ["EJFCustom", "#92400e"],
  ["FIKSPUNKT", "#475569"],
  ["GEODKV", "#15803d"],
  ["HISTKORT", "#9f1239"],
  ["MAT", "#a16207"],
  ["SVR", "#6d28d9"],
  ["VUR", "#1d4ed8"],
  ["Spatial", "#64748b"],
  ["Core", "#78716c"],
];
const REGISTER_INDEX = new Map(REGISTERS.map(([name], i) => [name, i]));

const VARIANTS = [
  { id: "compact", relay: false, inputs: false },
  { id: "relay", relay: true, inputs: false },
  { id: "inputs", relay: false, inputs: true },
  { id: "relay-inputs", relay: true, inputs: true },
];

function registerOf(name) {
  if (name === "Query") return REGISTER_INDEX.get("Query");
  const prefix = name.split("_")[0];
  if (prefix !== name && REGISTER_INDEX.has(prefix)) return REGISTER_INDEX.get(prefix);
  if (name.startsWith("Spatial")) return REGISTER_INDEX.get("Spatial");
  return REGISTER_INDEX.get("Core");
}

function typeLabel(type) {
  if (isNonNullType(type)) return `${typeLabel(type.ofType)}!`;
  if (isListType(type)) return `[${typeLabel(type.ofType)}]`;
  return type.name;
}

function isConnection(type) {
  return isObjectType(type) && type.name.endsWith("Connection") && "nodes" in type.getFields();
}

function isEdge(type) {
  return isObjectType(type) && type.name.endsWith("Edge") && "node" in type.getFields() && "cursor" in type.getFields();
}

function connectionNode(type) {
  return getNamedType(type.getFields().nodes.type);
}

async function main() {
  const sdl = readFileSync(SCHEMA, "utf8");
  const script = readFileSync(fileURLToPath(import.meta.url), "utf8");
  const hash = createHash("sha256").update(sdl).update(script).digest("hex").slice(0, 16);
  const stamp = resolve(OUT, "graph.json");
  if (existsSync(stamp) && process.argv[2] !== "--force") {
    try {
      if (JSON.parse(readFileSync(stamp, "utf8")).hash === hash) {
        console.log(`flexiblecurrent: graph is up to date (${hash})`);
        return;
      }
    } catch {
      // fall through and rebuild
    }
  }

  const started = Date.now();
  const schema = buildSchema(sdl, { assumeValidSDL: true });
  const types = Object.values(schema.getTypeMap()).filter((t) => !t.name.startsWith("__"));

  // Node kinds: o = object, f = interface, c = connection, e = edge, i = input.
  const graphTypes = types.filter((t) => isObjectType(t) || isInterfaceType(t) || isInputObjectType(t));
  graphTypes.sort((a, b) => (a.name === "Query" ? -1 : b.name === "Query" ? 1 : a.name.localeCompare(b.name)));
  const index = new Map(graphTypes.map((t, i) => [t.name, i]));

  const nodes = [];
  const details = { d: {}, f: {}, a: {}, e: {} };
  for (const [i, t] of graphTypes.entries()) {
    const kind = isInputObjectType(t)
      ? "i"
      : isInterfaceType(t)
        ? "f"
        : isConnection(t)
          ? "c"
          : isEdge(t)
            ? "e"
            : "o";
    const fields = [];
    for (const [j, field] of Object.values(t.getFields()).entries()) {
      const named = getNamedType(field.type);
      const raw = index.has(named.name) ? index.get(named.name) : -1;
      let compact = raw;
      let label = typeLabel(field.type);
      let many = isListType(isNonNullType(field.type) ? field.type.ofType : field.type);
      if (isConnection(named)) {
        const target = connectionNode(named);
        compact = index.get(target.name);
        label = `[${target.name}]`;
        many = true;
      }
      // Field row: name, compact label, relay label, compact target, relay target,
      // flags (1 = to-many, 2 = has args, 4 = paged connection), first input arg target.
      let flags = many ? 1 : 0;
      if ("args" in field && field.args.length) flags |= 2;
      if (isConnection(named)) flags |= 4;
      const inputArgs = [];
      if ("args" in field) {
        for (const arg of field.args) {
          const at = getNamedType(arg.type);
          if (isInputObjectType(at)) inputArgs.push(index.get(at.name));
        }
      }
      const relayLabel = typeLabel(field.type);
      const row = [field.name, label, relayLabel === label ? 0 : relayLabel, compact, raw, flags];
      if (inputArgs.length) row.push(inputArgs);
      fields.push(row);

      if (field.description) details.f[`${i}.${j}`] = field.description;
      if ("args" in field && field.args.length) {
        details.a[`${i}.${j}`] = field.args.map((arg) => {
          const at = getNamedType(arg.type);
          const out = [arg.name, typeLabel(arg.type), index.has(at.name) ? index.get(at.name) : -1];
          if (arg.defaultValue !== undefined) out.push(JSON.stringify(arg.defaultValue));
          if (arg.description) out[4] = arg.description;
          return out;
        });
      }
    }
    if (t.description) details.d[i] = t.description;
    const node = { n: t.name, k: kind, r: registerOf(t.name), f: fields };
    if (isObjectType(t) && t.getInterfaces().length) node.i = t.getInterfaces().map((x) => index.get(x.name));
    nodes.push(node);
  }
  for (const t of types.filter(isEnumType)) details.e[t.name] = t.getValues().map((v) => v.name);

  const visibleIn = (node, variant) => {
    if (node.k === "i") return variant.inputs;
    if (node.k === "c" || node.k === "e") return variant.relay;
    if (node.n === "PageInfo") return variant.relay;
    return true;
  };

  const elk = new ELK();
  const layouts = {};
  for (const variant of VARIANTS) {
    const t0 = Date.now();
    layouts[variant.id] = await layout(elk, nodes, variant, visibleIn);
    console.log(`flexiblecurrent: layout ${variant.id} in ${Date.now() - t0} ms`);
  }

  mkdirSync(OUT, { recursive: true });
  const write = (name, value) => {
    const body = JSON.stringify(value);
    writeFileSync(resolve(OUT, name), body);
    writeFileSync(resolve(OUT, `${name}.gz`), gzipSync(body, { level: 9 }));
    return body.length;
  };
  const stats = {
    types: types.length,
    objects: nodes.filter((n) => n.k === "o").length,
    connections: nodes.filter((n) => n.k === "c").length,
    edges: nodes.filter((n) => n.k === "e").length,
    inputs: nodes.filter((n) => n.k === "i").length,
    fields: nodes.reduce((sum, n) => sum + n.f.length, 0),
  };
  const sizes = {};
  sizes.graph = write("graph.json", {
    hash,
    stats,
    registers: REGISTERS,
    nodes,
    layout: layouts.compact,
  });
  for (const variant of VARIANTS.slice(1)) sizes[variant.id] = write(`layout-${variant.id}.json`, layouts[variant.id]);
  sizes.details = write("details.json", details);
  console.log(`flexiblecurrent: wrote ${OUT} in ${Date.now() - started} ms`, stats, sizes);
}

function nodeSize(node, variant) {
  let longest = 0;
  for (const row of node.f) {
    const label = variant.relay && row[2] ? row[2] : row[1];
    const extra = row[5] & 2 ? 3 : 0;
    longest = Math.max(longest, row[0].length + extra + label.length + 2);
  }
  const width = Math.max(MIN_W, Math.ceil(longest * CHAR + PAD * 2), Math.ceil(node.n.length * TITLE_CHAR + PAD * 2 + 8));
  return [width, HEADER + node.f.length * ROW + 4];
}

function targetOf(row, variant) {
  return variant.relay ? row[4] : row[3];
}

async function layout(elk, nodes, variant, visibleIn) {
  const visible = nodes.map((n) => visibleIn(n, variant));
  const sizes = nodes.map((n, i) => (visible[i] ? nodeSize(n, variant) : null));
  const query = nodes.findIndex((n) => n.n === "Query");

  // One ELK layered run per register keeps related types close together and
  // stays fast; clusters are then packed so cross-register edges stay short.
  const groups = new Map();
  for (const [i, node] of nodes.entries()) {
    if (!visible[i] || i === query) continue;
    if (!groups.has(node.r)) groups.set(node.r, []);
    groups.get(node.r).push(i);
  }

  const clusters = [];
  for (const [register, members] of groups) {
    const inside = new Set(members);
    const edges = [];
    const seen = new Set();
    for (const i of members) {
      for (const row of nodes[i].f) {
        const targets = [targetOf(row, variant)];
        if (variant.inputs && row[6]) targets.push(...row[6]);
        for (const t of targets) {
          if (t < 0 || t === i || !inside.has(t)) continue;
          const key = `${i}>${t}`;
          if (seen.has(key)) continue;
          seen.add(key);
          edges.push({ id: `e${edges.length}`, sources: [`n${i}`], targets: [`n${t}`] });
        }
      }
    }
    const graph = await elk.layout({
      id: `r${register}`,
      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": "RIGHT",
        "elk.edgeRouting": "SPLINES",
        "elk.spacing.nodeNode": "28",
        "elk.layered.spacing.nodeNodeBetweenLayers": "90",
        "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
        "elk.separateConnectedComponents": "true",
        "elk.spacing.componentComponent": "40",
        "elk.aspectRatio": "1.6",
        "elk.padding": "[top=56,left=32,bottom=32,right=32]",
      },
      children: members.map((i) => ({ id: `n${i}`, width: sizes[i][0], height: sizes[i][1] })),
      edges,
    });
    clusters.push({ register, graph, members });
  }

  // Pack clusters into rows (biggest first) to the right of Query.
  clusters.sort((a, b) => b.graph.width * b.graph.height - a.graph.width * a.graph.height);
  const area = clusters.reduce((sum, c) => sum + c.graph.width * c.graph.height, 0);
  const rowWidth = Math.max(Math.sqrt(area * 1.6), ...clusters.map((c) => c.graph.width));
  const GAP = 120;
  const [qw, qh] = sizes[query];
  const originX = qw + 260;
  let x = originX;
  let y = 0;
  let rowHeight = 0;
  const out = { nodes: [], clusters: [] };
  for (const cluster of clusters) {
    if (x > originX && x + cluster.graph.width > originX + rowWidth) {
      x = originX;
      y += rowHeight + GAP;
      rowHeight = 0;
    }
    out.clusters.push([cluster.register, x, y, Math.round(cluster.graph.width), Math.round(cluster.graph.height)]);
    for (const child of cluster.graph.children) {
      out.nodes.push([Number(child.id.slice(1)), Math.round(x + child.x), Math.round(y + child.y), child.width, child.height]);
    }
    x += cluster.graph.width + GAP;
    rowHeight = Math.max(rowHeight, cluster.graph.height);
  }
  const totalHeight = y + rowHeight;
  out.nodes.unshift([query, 0, Math.round(Math.max(0, totalHeight / 2 - qh / 2)), qw, qh]);
  return out;
}

await main();
