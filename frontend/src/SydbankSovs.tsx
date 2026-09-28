import { useEffect, useState, type ReactNode } from "react";
import "./sydbank-sovs.css";

type Project = {
  name: string;
  scale: string;
  what: string;
  lesson: string;
  href: string | null;
};

const PROJECTS: Project[] = [
  {
    name: "HR-assistent",
    scale: "Overenskomst, funktionærlov, personalehåndbog",
    what: "Svarer på medarbejdernes spørgsmål og viser præcis, hvor i teksten svaret står.",
    lesson: "Kildehenvisning er det, der får brugerne til at stole på svaret.",
    href: null,
  },
  {
    name: "Kendelsessøger",
    scale: "Ca. 500 kendelser × ca. 30 sider",
    what: "Landinspektører finder afgørelser om drikkevand og BNBO, fx om prisen på juletræer, og åbner dokumentet.",
    lesson: "Brugerne skal kunne efterprøve svaret i originalen med ét klik.",
    href: null,
  },
  {
    name: "Juridisk vidensbase",
    scale: "Ca. 70.000 dokumenter",
    what: "Love, bekendtgørelser, cirkulærer, EU-domme og lærebøger i en LLM Wiki-struktur, med ekstra søgemetoder til præcise paragraffer.",
    lesson: "I store samlinger skal nøgleordssøgning og semantisk søgning kombineres.",
    href: null,
  },
];

type Doc = { id: string; title: string; version: string; status: "gældende" | "forældet" };

const DOCS: Doc[] = [
  { id: "FG-114", title: "Kort: bestilling og erstatning", version: "v. 2025-01", status: "gældende" },
  { id: "FG-114", title: "Kort: bestilling og erstatning", version: "v. 2023-03", status: "forældet" },
  { id: "FG-207", title: "Legitimation ved kortudstedelse", version: "v. 2024-06", status: "gældende" },
];

type Conflict = {
  id: string;
  kind: string;
  severity: "høj" | "middel";
  summary: string;
  a: { ref: string; text: string };
  b: { ref: string; text: string };
  evidence: string;
  owner: string;
};

const CONFLICTS: Conflict[] = [
  {
    id: "K1",
    kind: "Modstrid mellem forretningsgange",
    severity: "høj",
    summary: "Skal legitimation kontrolleres igen ved et erstatningskort?",
    a: { ref: "FG-114 §4.1 (2025-01)", text: "Rådgiveren kan bestille erstatningskort uden fornyet legitimation." },
    b: { ref: "FG-207 §2.3 (2024-06)", text: "Ved enhver kortudstedelse kontrolleres legitimation, hvis den er ældre end 24 måneder." },
    evidence: "23 supportsager om emnet. Der er givet to forskellige svar.",
    owner: "Fagansvarlig, kortområdet",
  },
  {
    id: "K2",
    kind: "Forældet version i omløb",
    severity: "middel",
    summary: "Hvor sendes erstatningskortet hen?",
    a: { ref: "FG-114 §3.2 (2023-03)", text: "Erstatningskort sendes altid til folkeregisteradressen." },
    b: { ref: "FG-114 §3.2 (2025-01)", text: "Kunden kan vælge levering til folkeregisteradressen eller afhentning i filial." },
    evidence: "Den gamle version ligger stadig på intranettet. 9 supportsvar henviser til den.",
    owner: "Dokumentejer, FG-114",
  },
  {
    id: "K3",
    kind: "Manglende trin",
    severity: "høj",
    summary: "Hvad gør man, når kortet er spærret på grund af mistanke om misbrug?",
    a: { ref: "FG-114 §5 (2025-01)", text: "Beskriver spærring ved bortkomst. Misbrug er ikke nævnt." },
    b: { ref: "Supportsager", text: "14 sager spørger til netop dette. Der er givet tre forskellige svar." },
    evidence: "Ingen forretningsgang dækker situationen.",
    owner: "Fagansvarlig, kortområdet",
  },
];

type Exchange = {
  q: string;
  kind: "answer" | "abstain";
  body: string;
  sources: string[];
};

const EXCHANGES: Exchange[] = [
  {
    q: "Kunden vil hente sit nye kort i filialen i stedet for at få det sendt. Kan det lade sig gøre?",
    kind: "answer",
    body: "Ja. Kunden kan vælge afhentning i filial. Notér valget på bestillingen.",
    sources: ["FG-114 §3.2 · v. 2025-01 · gældende"],
  },
  {
    q: "Skal jeg tjekke legitimation, når kunden har mistet sit kort og skal have et nyt?",
    kind: "abstain",
    body: "Kilderne er uenige, og sagen er ikke afklaret endnu (K1). Jeg giver ikke et svar. Kontakt fagansvarlig for kortområdet.",
    sources: ["FG-114 §4.1 · v. 2025-01", "FG-207 §2.3 · v. 2024-06"],
  },
];

const TOPICS = [
  { label: "Kort", share: 24 },
  { label: "Fuldmagter", share: 15 },
  { label: "Dødsboer", share: 12 },
  { label: "Kontooprettelse", share: 10 },
  { label: "Overførsler", share: 8 },
  { label: "Øvrige 40+ emner", share: 31 },
];

function Kicker({ children }: { children: ReactNode }) {
  return <p className="sb-kicker">{children}</p>;
}

function TitleSlide() {
  return (
    <div className="sb-title">
      <Kicker>AL Sydbank · AI Engineer · Case B</Kicker>
      <h1>Samme spørgsmål, samme svar</h1>
      <p className="sb-lead">Hvordan AI kan gøre forretningsgangene tydeligere, så supportlinjen svarer ens.</p>
      <p className="sb-byline">Simon Lolk · 29. september 2026</p>
    </div>
  );
}

function ProblemSlide() {
  return (
    <div className="sb-split">
      <div>
        <Kicker>Problemet</Kicker>
        <h2>To rådgivere, samme situation, to forskellige svar</h2>
        <blockquote>
          “Vores forretningsgange har uklare formuleringer, manglende trin og afsnit, der ikke stemmer overens. Derfor
          udfylder kollegerne hullerne med deres egen erfaring.”
          <cite>Lea, teamleder i supportlinjen</cite>
        </blockquote>
      </div>
      <div className="sb-callout">
        <p className="sb-callout-label">Min vinkel</p>
        <p className="sb-callout-big">Det er et kvalitetsproblem i kilderne, ikke et søgeproblem.</p>
        <p>
          En chatbot oven på modstridende dokumenter giver stadig forskellige svar. Den gør det bare hurtigere og mere
          selvsikkert.
        </p>
        <p>
          Derfor gør løsningen to ting: <strong>finder og retter uenighederne i kilderne</strong> og giver derefter
          supporterne <strong>svar med kilde</strong>.
        </p>
      </div>
    </div>
  );
}

function InvestigateSlide() {
  return (
    <div className="sb-split">
      <div>
        <Kicker>01 · Undersøg problemet</Kicker>
        <h2>Forstå hverdagen, før noget bygges</h2>
        <ul className="sb-list">
          <li>
            <strong>Lea og 3–4 supportere.</strong> Sid med ved telefonen en dag. Hvor slår de op? Hvornår gætter de?
          </li>
          <li>
            <strong>Et par rådgivere.</strong> Hvad ringer de om, og hvad sker der, når svaret viser sig at være forkert?
          </li>
          <li>
            <strong>Ejerne af forretningsgangene.</strong> Hvordan bliver de opdateret i dag, og hvem afgør tvivl?
          </li>
        </ul>
        <h3>Hvor stort er problemet?</h3>
        <ul className="sb-list sb-compact">
          <li>Antal forretningsgange, og hvor mange der har mere end én version i omløb</li>
          <li>Supportsager pr. måned, og hvordan de fordeler sig på emner</li>
          <li>Hvor ofte skal et svar rettes bagefter? Det er udgangspunktet, vi måler på</li>
        </ul>
      </div>
      <div className="sb-panel">
        <p className="sb-panel-head">
          Første analyse: gruppér gamle supportsager efter emne
          <span className="sb-tag">Illustrativt, ikke data</span>
        </p>
        <div className="sb-bars">
          {TOPICS.map((t) => (
            <div className="sb-bar" key={t.label}>
              <span>{t.label}</span>
              <div className="sb-bar-track">
                <div className="sb-bar-fill" style={{ width: `${t.share * 3}%` }} />
              </div>
              <span className="sb-bar-val">{t.share} %</span>
            </div>
          ))}
        </div>
        <p className="sb-note">
          Formentlig står få emner for de fleste sager. Så kan piloten starte der, hvor det gør mest ondt, uden at alt
          skal være samlet først.
        </p>
      </div>
    </div>
  );
}

function SolutionSlide() {
  return (
    <div>
      <Kicker>02 · AI-teknologier</Kicker>
      <h2>En løkke, der gør kilderne bedre, mens de bliver brugt</h2>
      <div className="sb-flow">
        <div className="sb-node">
          <span className="sb-node-k">Ind</span>
          <strong>Forretningsgange</strong>
          <span>med versionsdatoer</span>
          <strong>Supportsager</strong>
          <span>spørgsmål og svar</span>
        </div>
        <div className="sb-arrow">→</div>
        <div className="sb-node sb-node-ai">
          <span className="sb-node-k">Teknologi 1</span>
          <strong>LLM Wiki og lint</strong>
          <span>En sprogmodel samler kilderne i en struktureret wiki og leder efter modsigelser, forældede versioner og manglende trin.</span>
        </div>
        <div className="sb-arrow">→</div>
        <div className="sb-node sb-node-human">
          <span className="sb-node-k">Menneske</span>
          <strong>Fagperson afgør</strong>
          <span>Konfliktliste med kilder. Forretningsgangen rettes af den ansvarlige.</span>
        </div>
      </div>
      <div className="sb-flow sb-flow-second">
        <div className="sb-node sb-node-ai sb-wide">
          <span className="sb-node-k">Teknologi 2</span>
          <strong>Supportassistent med kildehenvisning</strong>
          <span>
            Søger med både nøgleord og betydning (hybrid søgning) i de godkendte tekster. Foreslår et svar med afsnit og
            versionsdato. Supporteren beslutter.
          </span>
        </div>
        <div className="sb-loop">
          <span>↺</span>
          <p>
            Spørgsmål, assistenten ikke kan besvare, bliver til <strong>forslag om rettelse</strong> hos fagpersonen.
          </p>
        </div>
      </div>
      <p className="sb-principle">
        <strong>Princip:</strong> Wikien er en vejviser, ikke et regelsæt. Svar henviser altid til den godkendte
        originaltekst, og bankens regler ændres kun af den ansvarlige fagperson.
      </p>
    </div>
  );
}

function MockupSlide() {
  const [picked, setPicked] = useState(0);
  const [asked, setAsked] = useState(1);
  const c = CONFLICTS[picked];
  const x = EXCHANGES[asked];
  return (
    <div>
      <div className="sb-mock-head">
        <div>
          <Kicker>Sådan kunne det se ud</Kicker>
          <h2>Konfliktliste og supportassistent</h2>
        </div>
        <span className="sb-tag">Mockup · fiktive dokumenter</span>
      </div>
      <div className="sb-mock">
        <aside className="sb-mock-docs">
          <p className="sb-mock-label">Kilder · kortområdet</p>
          {DOCS.map((d) => (
            <div key={d.id + d.version} className={`sb-doc ${d.status === "forældet" ? "sb-doc-old" : ""}`}>
              <strong>{d.id}</strong> {d.title}
              <span>
                {d.version} · {d.status}
              </span>
            </div>
          ))}
          <p className="sb-mock-label">Supportsager</p>
          <div className="sb-doc">
            <strong>212</strong> sager om kort
            <span>seneste 12 mdr.</span>
          </div>
        </aside>

        <section className="sb-mock-conf">
          <p className="sb-mock-label">Konfliktliste · 3 åbne</p>
          <div className="sb-conf-tabs">
            {CONFLICTS.map((k, i) => (
              <button key={k.id} className={i === picked ? "on" : undefined} onClick={() => setPicked(i)}>
                <span className={`sb-sev sb-sev-${k.severity}`}>{k.id}</span>
                {k.kind}
              </button>
            ))}
          </div>
          <div className="sb-conf">
            <p className="sb-conf-q">{c.summary}</p>
            <div className="sb-conf-pair">
              <div>
                <span>{c.a.ref}</span>
                <p>{c.a.text}</p>
              </div>
              <div>
                <span>{c.b.ref}</span>
                <p>{c.b.text}</p>
              </div>
            </div>
            <p className="sb-conf-ev">{c.evidence}</p>
            <p className="sb-conf-owner">
              Afventer: <strong>{c.owner}</strong>
            </p>
          </div>
        </section>

        <section className="sb-mock-chat">
          <p className="sb-mock-label">Supportassistent</p>
          <div className="sb-q-tabs">
            {EXCHANGES.map((_, i) => (
              <button key={i} className={i === asked ? "on" : undefined} onClick={() => setAsked(i)}>
                Spørgsmål {i + 1}
              </button>
            ))}
          </div>
          <div className="sb-msg sb-msg-q">{x.q}</div>
          <div className={`sb-msg sb-msg-a ${x.kind === "abstain" ? "sb-msg-stop" : ""}`}>
            {x.kind === "abstain" && <strong className="sb-stop">Siger fra</strong>}
            <p>{x.body}</p>
            <div className="sb-sources">
              {x.sources.map((s) => (
                <span key={s}>{s}</span>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function DataSlide() {
  return (
    <div>
      <Kicker>03 · Data</Kicker>
      <h2>Hvad der skal bruges, og hvordan det beskyttes</h2>
      <div className="sb-cols">
        <div className="sb-col">
          <h3>Data</h3>
          <ul className="sb-list sb-compact">
            <li>
              <strong>Forretningsgange med versionsdato.</strong> Kun gældende versioner besvarer spørgsmål. Historikken
              bruges til at finde forældede kopier.
            </li>
            <li>
              <strong>Supportsager.</strong> Spørgsmålene er et realistisk testsæt. Svarene er <em>ikke</em> facit,
              fordi de kan være forkerte.
            </li>
            <li>
              <strong>Ekstra:</strong> Oversigt over hvem der ejer hvilken forretningsgang, og ca. 50 spørgsmål med
              facit godkendt af en fagperson.
            </li>
          </ul>
        </div>
        <div className="sb-col">
          <h3>Datakvalitet</h3>
          <ul className="sb-list sb-compact">
            <li>Dubletter og flere versioner af samme dokument</li>
            <li>Manglende eller forkerte versionsdatoer</li>
            <li>
              <strong>Dækning:</strong> Hvor stor en del af supportsagerne kan overhovedet besvares ud fra
              forretningsgangene? Det, der mangler, er i sig selv et fund.
            </li>
          </ul>
        </div>
        <div className="sb-col">
          <h3>Fortrolighed</h3>
          <ul className="sb-list sb-compact">
            <li>Navne, CPR- og kontonumre fjernes fra supportsagerne, før de behandles</li>
            <li>Modellen kører i EU og trænes ikke på bankens data</li>
            <li>Adgangsstyring og logning af, hvem der spørger om hvad</li>
            <li>Internt værktøj med et menneske, der beslutter: lav risiko under AI-forordningen</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function PilotSlide() {
  return (
    <div>
      <Kicker>04 · Pilot</Kicker>
      <h2>Ét område, seks uger, målt mod i dag</h2>
      <div className="sb-pilot">
        <div className="sb-phase">
          <span className="sb-phase-k">Uge 1–2</span>
          <strong>Ryd op i kilderne</strong>
          <p>Ca. 15 forretningsgange om kort bygges til en wiki. Konfliktlisten gennemgås med en fagperson fra kortområdet.</p>
        </div>
        <div className="sb-phase">
          <span className="sb-phase-k">Uge 3–6</span>
          <strong>Assistent ved siden af</strong>
          <p>3–4 supportere bruger assistenten. Den foreslår, supporteren beslutter. Uafklarede spørgsmål går til fagpersonen.</p>
        </div>
        <div className="sb-phase sb-phase-end">
          <span className="sb-phase-k">Uge 6</span>
          <strong>Beslutning</strong>
          <p>Fortsæt, justér eller stop, ud fra tallene nedenfor.</p>
        </div>
      </div>
      <div className="sb-cols sb-cols-2">
        <div className="sb-col">
          <h3>Virker det bedre end i dag?</h3>
          <ul className="sb-list sb-compact">
            <li>
              <strong>Ensartethed:</strong> Samme spørgsmål formuleret fem måder giver samme svar
            </li>
            <li>
              <strong>Korrekthed:</strong> Andel rigtige svar på det godkendte testsæt, før og efter
            </li>
            <li>
              <strong>Rettelser bagefter:</strong> Antal sager, der skal genåbnes
            </li>
            <li>
              <strong>Kilder:</strong> Antal konflikter fundet og afklaret
            </li>
          </ul>
        </div>
        <div className="sb-col">
          <h3>Sådan opdager vi forkerte svar</h3>
          <ul className="sb-list sb-compact">
            <li>Intet svar uden kildehenvisning</li>
            <li>Assistenten siger fra, når kilderne er uenige</li>
            <li>Supporterne markerer forkerte svar med ét klik</li>
            <li>Fagpersonen tager en ugentlig stikprøve</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function ProjectsSlide() {
  return (
    <div>
      <Kicker>Erfaring</Kicker>
      <h2>Det har jeg bygget før</h2>
      <div className="sb-cards">
        {PROJECTS.map((p) => (
          <div className="sb-card" key={p.name}>
            <strong>{p.name}</strong>
            <span className="sb-card-scale">{p.scale}</span>
            <p>{p.what}</p>
            <p className="sb-card-lesson">{p.lesson}</p>
            {p.href ? (
              <a href={p.href} target="_blank" rel="noreferrer">
                Åbn →
              </a>
            ) : (
              <span className="sb-card-nolink">Vises på min skærm</span>
            )}
          </div>
        ))}
      </div>
      <p className="sb-note">
        En banks forretningsgange fylder langt mindre end 70.000 dokumenter. Omfanget er ikke den svære del. Det er
        kvaliteten af kilderne.
      </p>
    </div>
  );
}

function ClosingSlide() {
  return (
    <div className="sb-title">
      <Kicker>Opsummering</Kicker>
      <h2 className="sb-closing">Ret kilderne først, og giv derefter svar med kilde.</h2>
      <ul className="sb-list sb-summary">
        <li>AI finder uenighederne. Fagpersonen afgør dem.</li>
        <li>Supporterne får svar med afsnit og version, og assistenten siger fra, når den er i tvivl.</li>
        <li>En lille pilot på kortområdet, målt på ensartethed og rettelser bagefter.</li>
      </ul>
      <p className="sb-byline">Spørgsmål?</p>
    </div>
  );
}

const SLIDES: { name: string; render: () => ReactNode }[] = [
  { name: "Titel", render: () => <TitleSlide /> },
  { name: "Problemet", render: () => <ProblemSlide /> },
  { name: "01 Undersøg", render: () => <InvestigateSlide /> },
  { name: "02 Løsning", render: () => <SolutionSlide /> },
  { name: "Mockup", render: () => <MockupSlide /> },
  { name: "03 Data", render: () => <DataSlide /> },
  { name: "04 Pilot", render: () => <PilotSlide /> },
  { name: "Erfaring", render: () => <ProjectsSlide /> },
  { name: "Opsummering", render: () => <ClosingSlide /> },
];

function slideFromHash(): number {
  const n = Number.parseInt(window.location.hash.slice(1), 10);
  return Number.isFinite(n) && n >= 1 && n <= SLIDES.length ? n - 1 : 0;
}

export default function SydbankSovs() {
  const [index, setIndex] = useState(slideFromHash);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    document.title = "Case B · Øvekort";
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
    <div className="sb">
      <main className="sb-stage" key={index}>
        {SLIDES[index].render()}
      </main>
      <footer className="sb-foot">
        <nav className="sb-dots" aria-label="Slides">
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
        <span className="sb-foot-name">{SLIDES[index].name}</span>
        <span className={`sb-clock ${elapsed > 600 ? "sb-clock-over" : ""}`} title="Tryk t for at nulstille">
          {clock}
        </span>
        <span className="sb-foot-nav">
          <button onClick={() => setIndex((i) => Math.max(0, i - 1))} aria-label="Forrige">
            ←
          </button>
          {index + 1} / {SLIDES.length}
          <button onClick={() => setIndex((i) => Math.min(SLIDES.length - 1, i + 1))} aria-label="Næste">
            →
          </button>
        </span>
      </footer>
    </div>
  );
}
