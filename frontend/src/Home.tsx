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
          <a className="home-sub" href="/sydbank_sovs">
            Øvekort til oplægget →
          </a>
        </div>
      </div>
    </div>
  );
}
