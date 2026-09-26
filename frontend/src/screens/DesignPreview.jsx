// Design reference: the companion's three moods and the color palette, for the team to review.
import Companion from '../components/Companion';

const PALETTE = [
  ['--bg', 'Background'],
  ['--card', 'Card'],
  ['--ink', 'Text'],
  ['--sky', 'Primary'],
  ['--mint', 'Low risk'],
  ['--sun', 'Moderate risk / XP'],
  ['--coral', 'High risk'],
  ['--lav', 'Levels & badges'],
  ['--pollen', 'Pollen zones'],
  ['--air', 'Air quality zones'],
  ['--weather', 'Weather zones'],
];

const MOODS = [
  ['happy', 'Low risk', 'var(--mint)'],
  ['uneasy', 'Moderate', 'var(--sun)'],
  ['worried', 'High risk', 'var(--coral)'],
];

export default function DesignPreview() {
  return (
    <main className="design">
      <header>
        <h1>Breezy design</h1>
        <p className="muted">Companion, moods and palette for the asthma flare-up app.</p>
      </header>

      <section className="card">
        <h2>Meet Breezy</h2>
        <p className="muted">A little cloud with a sprout. Its mood follows tomorrow's flare-up risk.</p>
        <div className="mood-row">
          {MOODS.map(([mood, label, color]) => (
            <div key={mood}>
              <Companion mood={mood} size={110} />
              <div className="tag" style={{ color }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Palette</h2>
        <p className="muted">Mint, sun and coral are only used for risk levels, so their meaning stays clear.</p>
        <div className="swatches">
          {PALETTE.map(([token, name]) => (
            <div className="swatch" key={token}>
              <div className="chip" style={{ background: `var(${token})` }} />
              <div className="name">{name}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Type and shape</h2>
        <p className="muted">Nunito, heavy weights for headings. Rounded cards (22px), soft shadows, big touch targets.</p>
      </section>
    </main>
  );
}
