import { Fragment, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import "./sydbank.css";

const FONTS = "https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,500&family=Inter:wght@400;500;600&display=swap";

function d(seconds: number): CSSProperties {
  return { "--d": `${seconds}s` } as CSSProperties;
}

function useCountUp(target: number, delayMs: number, durationMs = 1400): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let frame = 0;
    const start = performance.now() + delayMs;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / durationMs));
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, delayMs, durationMs]);
  return value;
}

function Person({ x, y, label, delay }: { x: number; y: number; label: string; delay: number }) {
  return (
    <g className="cd-pop" style={d(delay)}>
      <circle cx={x} cy={y} r={34} className="cd-svg-disc" />
      <circle cx={x} cy={y - 8} r={9} className="cd-svg-ink" />
      <path d={`M ${x - 16} ${y + 18} a 16 14 0 0 1 32 0`} className="cd-svg-ink" />
      <text x={x} y={y + 60} textAnchor="middle" className="cd-svg-label">
        {label}
      </text>
    </g>
  );
}

function TitleSlide() {
  return (
    <div className="cd-center">
      <div className="cd-orbs" aria-hidden>
        <span className="cd-orb cd-orb-a" />
        <span className="cd-orb cd-orb-b" />
      </div>
      <p className="cd-eyebrow cd-rise" style={d(0.1)}>
        AL Sydbank · Case B
      </p>
      <h1 className="cd-hero">
        <span className="cd-rise" style={d(0.25)}>
          Samme spørgsmål.
        </span>
        <span className="cd-rise cd-accent-text" style={d(0.6)}>
          Samme svar.
        </span>
      </h1>
      <p className="cd-byline cd-rise" style={d(1.1)}>
        Simon Lolk
      </p>
    </div>
  );
}

function ProblemSlide() {
  return (
    <div className="cd-center">
      <h2 className="cd-h2 cd-rise" style={d(0.1)}>
        Samme situation. <span className="cd-accent-text">To svar.</span>
      </h2>
      <svg viewBox="0 0 900 320" className="cd-diagram">
        <path d="M 150 90 C 300 90, 330 160, 450 160" className="cd-draw" style={d(0.5)} />
        <path d="M 150 250 C 300 250, 330 160, 450 160" className="cd-draw" style={d(0.6)} />
        <path d="M 450 160 C 570 160, 600 90, 700 90" className="cd-draw" style={d(1.2)} />
        <path d="M 450 160 C 570 160, 600 250, 700 250" className="cd-draw cd-draw-accent" style={d(1.4)} />
        <Person x={110} y={90} label="Rådgiver A" delay={0.2} />
        <Person x={110} y={250} label="Rådgiver B" delay={0.3} />
        <g className="cd-pop" style={d(0.9)}>
          <rect x={395} y={125} width={110} height={70} rx={16} className="cd-svg-card" />
          <text x={450} y={166} textAnchor="middle" className="cd-svg-strong">
            Support
          </text>
        </g>
        <g className="cd-pop" style={d(1.8)}>
          <rect x={700} y={62} width={170} height={56} rx={28} className="cd-svg-bubble" />
          <text x={785} y={96} textAnchor="middle" className="cd-svg-text">
            Ingen legitimation
          </text>
        </g>
        <g className="cd-pop" style={d(2.1)}>
          <rect x={700} y={222} width={170} height={56} rx={28} className="cd-svg-bubble cd-svg-bubble-accent" />
          <text x={785} y={256} textAnchor="middle" className="cd-svg-text cd-svg-text-light">
            Tjek legitimation
          </text>
        </g>
      </svg>
    </div>
  );
}

function RootCauseSlide() {
  const lines = (hi: number) =>
    [0, 1, 2, 3, 4].map((i) => <span key={i} className={i === hi ? "cd-line cd-line-hi" : "cd-line"} />);
  return (
    <div className="cd-center">
      <h2 className="cd-h2 cd-rise" style={d(0.1)}>
        Fejlen sidder i <span className="cd-accent-text">kilderne</span>.
      </h2>
      <div className="cd-docs">
        <div className="cd-doc cd-rise" style={d(0.4)}>
          <span className="cd-doc-id">FG-114</span>
          {lines(2)}
        </div>
        <div className="cd-neq cd-pop" style={d(1.3)}>
          ≠
        </div>
        <div className="cd-doc cd-rise" style={d(0.6)}>
          <span className="cd-doc-id">FG-207</span>
          {lines(1)}
        </div>
        <div className="cd-doc cd-doc-old cd-rise" style={d(0.8)}>
          <span className="cd-doc-id">FG-114 · 2023</span>
          {lines(3)}
          <span className="cd-stamp cd-stamp-in" style={d(1.7)}>
            forældet
          </span>
        </div>
      </div>
      <p className="cd-sub cd-rise" style={d(2.2)}>
        En chatbot oven på dem svarer bare forkert <em>hurtigere</em>.
      </p>
    </div>
  );
}

const TOPICS = [
  { label: "Kort", v: 24 },
  { label: "Fuldmagter", v: 15 },
  { label: "Dødsboer", v: 12 },
  { label: "Kontooprettelse", v: 10 },
  { label: "40+ andre emner", v: 39 },
];

function InvestigateSlide() {
  return (
    <div className="cd-center">
      <p className="cd-step cd-rise" style={d(0)}>
        01
      </p>
      <h2 className="cd-h2 cd-rise" style={d(0.1)}>
        Først: forstå hverdagen
      </h2>
      <div className="cd-two">
        <div className="cd-people">
          {[
            { t: "Supportere", s: "Sid med en dag" },
            { t: "Rådgivere", s: "Hvad ringer de om?" },
            { t: "Fagejere", s: "Hvem afgør tvivl?" },
          ].map((p, i) => (
            <div className="cd-person cd-rise" style={d(0.4 + i * 0.2)} key={p.t}>
              <span className="cd-avatar">{p.t[0]}</span>
              <div>
                <strong>{p.t}</strong>
                <span>{p.s}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="cd-card cd-rise" style={d(0.9)}>
          <div className="cd-card-head">
            <span>Supportsager efter emne</span>
            <span className="cd-chip">illustrativt</span>
          </div>
          {TOPICS.map((t, i) => (
            <div className="cd-bar" key={t.label}>
              <span>{t.label}</span>
              <div className="cd-bar-track">
                <div
                  className={i === 0 ? "cd-bar-fill cd-bar-hot" : i === TOPICS.length - 1 ? "cd-bar-fill cd-bar-tail" : "cd-bar-fill"}
                  style={{ ...d(1.2 + i * 0.12), width: `${t.v * 2.4}%` }}
                />
              </div>
            </div>
          ))}
          <p className="cd-card-foot cd-rise" style={d(2.1)}>
            Start dér, hvor det gør mest ondt.
          </p>
        </div>
      </div>
    </div>
  );
}

const RING = "M 300 70 A 150 150 0 1 1 299.9 70";
const NODES = [
  { x: 300, y: 70, t: "Kilder", s: "" },
  { x: 450, y: 220, t: "LLM Wiki", s: "+ lint" },
  { x: 300, y: 370, t: "Konflikter", s: "de få" },
  { x: 150, y: 220, t: "Fagperson", s: "afgør" },
];

function LoopSlide() {
  return (
    <div className="cd-center">
      <p className="cd-step cd-rise" style={d(0)}>
        02
      </p>
      <h2 className="cd-h2 cd-rise" style={d(0.1)}>
        En løkke, der <span className="cd-accent-text">retter kilderne</span>
      </h2>
      <div className="cd-loop-wrap">
        <svg viewBox="0 0 600 440" className="cd-loop">
          <path d={RING} className="cd-ring cd-draw" style={d(0.4)} />
          <g className="cd-fade" style={d(1.6)}>
            <circle r={7} className="cd-runner">
              <animateMotion dur="6s" begin="0s" repeatCount="indefinite" path={RING} />
            </circle>
          </g>
          {NODES.map((n, i) => (
            <g key={n.t} className="cd-pop" style={d(0.6 + i * 0.25)}>
              <circle cx={n.x} cy={n.y} r={54} className={i === 3 ? "cd-node cd-node-human" : "cd-node"} />
              <text x={n.x} y={n.s ? n.y - 2 : n.y + 5} textAnchor="middle" className="cd-svg-strong cd-small">
                {n.t}
              </text>
              {n.s && (
                <text x={n.x} y={n.y + 15} textAnchor="middle" className="cd-svg-label cd-small">
                  {n.s}
                </text>
              )}
            </g>
          ))}
          <g className="cd-pop" style={d(1.8)}>
            <rect x={215} y={180} width={170} height={80} rx={18} className="cd-svg-card cd-center-card" />
            <text x={300} y={214} textAnchor="middle" className="cd-svg-strong">
              Supportassistent
            </text>
            <text x={300} y={238} textAnchor="middle" className="cd-svg-label">
              læser det rene lag
            </text>
          </g>
        </svg>
        <div className="cd-rank">
          <p className="cd-rank-label cd-rise" style={d(2.1)}>
            Wikien afgør selv efter rangorden
          </p>
          {["Nyeste version", "Forretningsgang", "Supportsvar"].map((t, i) => (
            <div className="cd-rank-step cd-rise" style={{ ...d(2.3 + i * 0.2), marginLeft: `${i * 28}px` }} key={t}>
              <span className="cd-rank-n">{i + 1}</span>
              {t}
            </div>
          ))}
          <div className="cd-rank-human cd-rise" style={d(3.1)}>
            <span className="cd-dot cd-dot-human" />
            <div>
              <strong>Kun to gældende regler, der strides</strong>
              <span>går til fagpersonen</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type Scenario = {
  label: string;
  q: string;
  sources: { ref: string; text: string; superseded?: boolean }[];
  escalate: boolean;
  answer: string;
  note: string;
};

const SCENARIOS: Scenario[] = [
  {
    label: "Afgjort af regel",
    q: "Kan kunden hente det nye kort i filialen?",
    sources: [
      { ref: "FG-114 §3.2 · 2023", text: "Sendes altid til adressen.", superseded: true },
      { ref: "FG-114 §3.2 · 2025", text: "Levering eller afhentning i filial." },
    ],
    escalate: false,
    answer: "Ja. Kunden kan vælge afhentning i filial.",
    note: "Regel: nyeste version gælder",
  },
  {
    label: "Til fagperson",
    q: "Skal jeg tjekke legitimation, når kunden skal have et nyt kort?",
    sources: [
      { ref: "FG-114 §4.1 · gældende", text: "Uden fornyet legitimation." },
      { ref: "FG-207 §2.3 · gældende", text: "Tjek, hvis ældre end 24 mdr." },
    ],
    escalate: true,
    answer: "To gældende regler er uenige. Afventer fagansvarlig for kort.",
    note: "Undtagelsen, ikke reglen",
  },
];

function DemoSlide() {
  const [which, setWhich] = useState(0);
  const [run, setRun] = useState(0);
  const [step, setStep] = useState(0);
  const [typed, setTyped] = useState(0);
  const s = SCENARIOS[which];

  useEffect(() => {
    setStep(0);
    setTyped(0);
    const timers: number[] = [];
    const chars = s.q.length;
    for (let i = 1; i <= chars; i++) timers.push(window.setTimeout(() => setTyped(i), 400 + i * 28));
    const typedAt = 400 + chars * 28;
    [typedAt + 300, typedAt + 1300, typedAt + 2200, typedAt + 3000].forEach((t, i) =>
      timers.push(window.setTimeout(() => setStep(i + 1), t)),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [which, run, s.q.length]);

  return (
    <div className="cd-center">
      <div className="cd-demo-top">
        <h2 className="cd-h2 cd-h2-tight cd-rise" style={d(0)}>
          Sådan kunne det se ud
        </h2>
        <div className="cd-seg cd-rise" style={d(0.2)}>
          {SCENARIOS.map((sc, i) => (
            <button key={sc.label} className={i === which ? "on" : undefined} onClick={() => setWhich(i)}>
              {sc.label}
            </button>
          ))}
          <button className="cd-replay" onClick={() => setRun((r) => r + 1)} aria-label="Afspil igen">
            ↻
          </button>
        </div>
      </div>
      <div className="cd-demo cd-rise" style={d(0.3)}>
        <div className="cd-chat">
          <div className="cd-msg cd-msg-q">
            {s.q.slice(0, typed)}
            {typed < s.q.length && <span className="cd-caret" />}
          </div>
          {step >= 1 && step < 4 && (
            <div className="cd-msg cd-msg-think">
              <span className="cd-think" />
              <span className="cd-think" />
              <span className="cd-think" />
            </div>
          )}
          {step >= 4 && (
            <div className={s.escalate ? "cd-msg cd-msg-a cd-msg-stop cd-in" : "cd-msg cd-msg-a cd-in"}>
              {s.escalate && <span className="cd-stop">Siger fra</span>}
              {s.answer}
              {!s.escalate && <span className="cd-cite">FG-114 §3.2 · 2025</span>}
            </div>
          )}
        </div>
        <div className="cd-sources">
          <p className="cd-sources-label">Kilder i wikien</p>
          <div className="cd-src-row">
            {s.sources.map((src, i) => (
              <Fragment key={src.ref}>
                {i > 0 && (
                  <div
                    className={[
                      "cd-neq cd-neq-small",
                      s.escalate ? "" : "cd-neq-rule",
                      step >= 3 ? "cd-in" : "cd-neq-wait",
                    ].join(" ")}
                  >
                    {s.escalate ? "≠" : "→"}
                  </div>
                )}
                {step >= 2 ? (
                  <div
                    className={src.superseded && step >= 3 ? "cd-src cd-src-old cd-in" : "cd-src cd-in"}
                    style={d(i * 0.15)}
                  >
                    <span>{src.ref}</span>
                    <p>{src.text}</p>
                  </div>
                ) : (
                  <div className="cd-src cd-src-ghost" />
                )}
              </Fragment>
            ))}
          </div>
          {step >= 4 &&
            (s.escalate ? (
              <div className="cd-ticket cd-in">
                <strong>K1</strong> sendt til fagperson · {s.note}
              </div>
            ) : (
              <div className="cd-ticket cd-ticket-rule cd-in">
                <strong>✓</strong> {s.note}
              </div>
            ))}
        </div>
      </div>
      <p className="cd-fine cd-rise" style={d(0.6)}>
        Mockup · fiktive dokumenter
      </p>
    </div>
  );
}

function IconDoc() {
  return (
    <svg viewBox="0 0 48 48" className="cd-icon">
      <path d="M12 6 h18 l8 8 v28 h-26 z" className="cd-icon-line cd-draw" style={d(0.5)} />
      <path d="M17 28 l5 5 l10 -11" className="cd-icon-line cd-icon-accent cd-draw" style={d(1)} />
    </svg>
  );
}

function IconMask() {
  return (
    <svg viewBox="0 0 48 48" className="cd-icon">
      <path d="M12 6 h18 l8 8 v28 h-26 z" className="cd-icon-line cd-draw" style={d(0.5)} />
      <path d="M17 18 h14 M17 34 h10" className="cd-icon-line cd-icon-soft" />
      <rect x="16" y="23" width="17" height="6" rx="1.5" className="cd-icon-fill cd-grow" style={d(1)} />
    </svg>
  );
}

function IconEu() {
  return (
    <svg viewBox="0 0 48 48" className="cd-icon">
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return (
          <circle
            key={i}
            cx={24 + Math.cos(a) * 15}
            cy={24 + Math.sin(a) * 15}
            r={2.4}
            className="cd-icon-star cd-pop"
            style={d(0.6 + i * 0.06)}
          />
        );
      })}
    </svg>
  );
}

function DataSlide() {
  const tiles = [
    { icon: <IconDoc />, t: "Kun gældende versioner", s: "historik bruges til at finde forældede kopier" },
    { icon: <IconMask />, t: "Personoplysninger fjernes", s: "navne, CPR og kontonumre fra supportsager" },
    { icon: <IconEu />, t: "EU · ingen træning", s: "adgangsstyring og logning" },
  ];
  return (
    <div className="cd-center">
      <p className="cd-step cd-rise" style={d(0)}>
        03
      </p>
      <h2 className="cd-h2 cd-rise" style={d(0.1)}>
        Data med omtanke
      </h2>
      <div className="cd-tiles">
        {tiles.map((t, i) => (
          <div className="cd-tile cd-rise" style={d(0.3 + i * 0.15)} key={t.t}>
            {t.icon}
            <strong>{t.t}</strong>
            <span>{t.s}</span>
          </div>
        ))}
      </div>
      <div className="cd-banner cd-rise" style={d(1.4)}>
        Gamle supportsvar er <strong>testspørgsmål</strong>, ikke facit.
      </div>
    </div>
  );
}

const PHRASINGS = [
  "Skal der legitimation til nyt kort?",
  "Kunden har mistet kortet, ID-tjek?",
  "Erstatningskort, kræver det legitimation?",
  "Nyt Dankort, skal jeg se pas?",
  "Legitimation ved genbestilling?",
];

function PilotSlide() {
  return (
    <div className="cd-center">
      <p className="cd-step cd-rise" style={d(0)}>
        04
      </p>
      <h2 className="cd-h2 cd-rise" style={d(0.1)}>
        Ét område. Seks uger.
      </h2>
      <div className="cd-timeline cd-rise" style={d(0.3)}>
        <div className="cd-tl-track">
          <div className="cd-tl-fill" style={d(0.6)} />
        </div>
        {[
          { at: 0, w: "Uge 1–2", t: "Ryd op i kilderne" },
          { at: 33, w: "Uge 3–6", t: "Assistent ved siden af" },
          { at: 100, w: "Uge 6", t: "Beslut" },
        ].map((m, i) => (
          <div className="cd-tl-mark cd-pop" style={{ ...d(0.8 + i * 0.6), left: `${m.at}%` }} key={m.w}>
            <span className="cd-tl-dot" />
            <span className="cd-tl-w">{m.w}</span>
            <strong>{m.t}</strong>
          </div>
        ))}
      </div>
      <div className="cd-converge">
        <div className="cd-phrasings">
          {PHRASINGS.map((p, i) => (
            <span className="cd-pill cd-rise" style={d(2.4 + i * 0.1)} key={p}>
              {p}
            </span>
          ))}
        </div>
        <svg viewBox="0 0 160 220" className="cd-converge-lines" preserveAspectRatio="none">
          {PHRASINGS.map((_, i) => (
            <path key={i} d={`M 0 ${22 + i * 44} C 80 ${22 + i * 44}, 80 110, 160 110`} className="cd-draw cd-thin" style={d(3 + i * 0.08)} />
          ))}
        </svg>
        <div className="cd-one cd-pop" style={d(3.6)}>
          <span className="cd-one-k">Samme svar</span>
          FG-114 §4.1 · afklaret
        </div>
      </div>
      <div className="cd-metrics cd-rise" style={d(4)}>
        <span>Ensartethed</span>
        <span>Korrekthed på testsæt</span>
        <span>Genåbnede sager</span>
        <span>Konflikter løst</span>
      </div>
    </div>
  );
}

function Stat({ n, unit, label, sub, delay }: { n: number; unit: string; label: string; sub: string; delay: number }) {
  const v = useCountUp(n, delay * 1000);
  return (
    <div className="cd-stat cd-rise" style={d(delay - 0.2)}>
      <span className="cd-stat-n">{v.toLocaleString("da-DK")}</span>
      <span className="cd-stat-unit">{unit}</span>
      <strong>{label}</strong>
      <span>{sub}</span>
    </div>
  );
}

function ExperienceSlide() {
  return (
    <div className="cd-center">
      <h2 className="cd-h2 cd-rise" style={d(0.1)}>
        Det har jeg bygget før
      </h2>
      <div className="cd-stats">
        <Stat n={3} unit="regelsæt" label="HR-assistent" sub="overenskomst, funktionærlov, håndbog" delay={0.5} />
        <Stat n={500} unit="kendelser" label="Kendelsessøger" sub="drikkevand og BNBO, ca. 30 sider hver" delay={0.8} />
        <Stat n={70000} unit="dokumenter" label="Juridisk vidensbase" sub="love, domme og lærebøger" delay={1.1} />
      </div>
      <p className="cd-sub cd-rise" style={d(2.6)}>
        Omfanget er ikke det svære. <span className="cd-accent-text">Kvaliteten af kilderne er.</span>
      </p>
    </div>
  );
}

function ClosingSlide() {
  return (
    <div className="cd-center">
      <h2 className="cd-hero cd-hero-close">
        <span className="cd-rise" style={d(0.2)}>
          Ret kilderne.
        </span>
        <span className="cd-rise" style={d(0.7)}>
          Så følger <span className="cd-underline">svarene</span>.
        </span>
      </h2>
      <p className="cd-byline cd-rise" style={d(1.8)}>
        Spørgsmål?
      </p>
    </div>
  );
}

const SLIDES: { name: string; render: () => ReactNode }[] = [
  { name: "Titel", render: () => <TitleSlide /> },
  { name: "Problemet", render: () => <ProblemSlide /> },
  { name: "Årsagen", render: () => <RootCauseSlide /> },
  { name: "01 Undersøg", render: () => <InvestigateSlide /> },
  { name: "02 Løsning", render: () => <LoopSlide /> },
  { name: "Demo", render: () => <DemoSlide /> },
  { name: "03 Data", render: () => <DataSlide /> },
  { name: "04 Pilot", render: () => <PilotSlide /> },
  { name: "Erfaring", render: () => <ExperienceSlide /> },
  { name: "Afslutning", render: () => <ClosingSlide /> },
];

function slideFromHash(): number {
  const n = Number.parseInt(window.location.hash.slice(1), 10);
  return Number.isFinite(n) && n >= 1 && n <= SLIDES.length ? n - 1 : 0;
}

export default function Sydbank() {
  const [index, setIndex] = useState(slideFromHash);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    document.title = "Samme spørgsmål. Samme svar.";
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONTS;
    document.head.appendChild(link);
    return () => link.remove();
  }, []);

  useEffect(() => {
    window.history.replaceState(null, "", `#${index + 1}`);
  }, [index]);

  useEffect(() => {
    const sync = () => setIndex(slideFromHash());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const go = (delta: number) => {
      setStartedAt((s) => s ?? Date.now());
      setIndex((i) => Math.min(SLIDES.length - 1, Math.max(0, i + delta)));
    };
    const onKey = (event: KeyboardEvent) => {
      if (["ArrowRight", "PageDown", " "].includes(event.key)) {
        event.preventDefault();
        go(1);
      } else if (["ArrowLeft", "PageUp"].includes(event.key)) {
        event.preventDefault();
        go(-1);
      } else if (event.key === "Home") {
        setIndex(0);
      } else if (event.key === "End") {
        setIndex(SLIDES.length - 1);
      } else if (event.key === "t") {
        setStartedAt(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const elapsed = startedAt === null ? 0 : Math.floor((now - startedAt) / 1000);
  const clock = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <div className="cd">
      <main className="cd-stage" key={index}>
        {SLIDES[index].render()}
      </main>
      <footer className="cd-foot">
        <nav className="cd-dots" aria-label="Slides">
          {SLIDES.map((s, i) => (
            <button
              key={s.name}
              className={i === index ? "on" : undefined}
              onClick={() => setIndex(i)}
              title={s.name}
              aria-label={s.name}
            />
          ))}
        </nav>
        <span className={elapsed > 600 ? "cd-clock cd-clock-over" : "cd-clock"} title="Tryk t for at nulstille">
          {clock}
        </span>
      </footer>
    </div>
  );
}
