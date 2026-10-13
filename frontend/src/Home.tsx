import { useEffect } from "react";
import "./home.css";

const BARS = [38, 64, 46, 82, 55, 70];

export default function Home() {
  useEffect(() => {
    document.title = "Simon Lolk · Opgaver";
  }, []);

  return (
    <div className="home">
      <header className="home-head">
        <p className="home-eyebrow">Simon Lolk</p>
        <h1>Opgaver og oplæg</h1>
      </header>

      <div className="home-grid">
        <a className="home-card" href="/envira">
          <div className="home-art home-art-envira" aria-hidden>
            {BARS.map((h, i) => (
              <span key={i} style={{ height: `${h}%`, animationDelay: `${i * 70}ms` }} />
            ))}
          </div>
          <div className="home-body">
            <p className="home-kicker">Envira · caseopgave</p>
            <h2>Skadesforløb</h2>
            <p>Hvordan en portefølje af ejendomsforsikringer har klaret sig. Kort, tabeller og datakvalitet.</p>
            <span className="home-go">Åbn dashboard →</span>
          </div>
        </a>

        <div className="home-stack">
          <a className="home-card" href="/sydbank">
            <div className="home-art home-art-sydbank" aria-hidden>
              <span>Samme spørgsmål.</span>
              <span className="home-coral">Samme svar.</span>
            </div>
            <div className="home-body">
              <p className="home-kicker">AL Sydbank · Case B</p>
              <h2>Forretningsgange og AI</h2>
              <p>Oplæg om, hvordan supportlinjen kan give ensartede svar med kilde.</p>
              <span className="home-go">Start præsentation →</span>
            </div>
          </a>

          <a className="home-card" href="/flexiblecurrent">
            <svg className="home-art home-art-schema" viewBox="0 0 400 180" preserveAspectRatio="xMidYMid slice" aria-hidden>
              <path d="M118 52 C 170 52, 170 40, 222 40 M118 70 C 170 70, 170 120, 222 120 M298 128 C 330 128, 320 92, 342 92" />
              {[
                [42, 30, 76, 88, "#141413"],
                [222, 22, 76, 56, "#d97757"],
                [222, 102, 76, 60, "#2563eb"],
                [342, 74, 76, 50, "#0f766e"],
              ].map(([x, y, w, h, c]) => (
                <g key={`${x}-${y}`}>
                  <rect x={x} y={y} width={w} height={h} rx={4} fill="#fff" stroke="#e4e1d6" />
                  <rect x={x} y={y} width={w} height={12} rx={2} fill={c as string} />
                </g>
              ))}
            </svg>
            <div className="home-body">
              <p className="home-kicker">Datafordeler · GraphQL</p>
              <h2>flexibleCurrent v3</h2>
              <p>Hele skemaet som en hurtig, søgbar graf over typer og relationer.</p>
              <span className="home-go">Åbn skemaet →</span>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
