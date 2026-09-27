// Trigger "enemies" shown on the map, one animated creature per trigger type:
// pollen (spiky grain), weather (storm cloud) and air quality (smog ghost).
// Each stands on a ground ring colored by how bad that trigger is right now.

const LEVEL_RING = { low: '#3fae8c', moderate: '#f0a92e', high: '#e2574c' };

// Grumpy face shared by all three; `y` moves it to fit each body.
function AngryFace({ y = 0 }) {
  return (
    <g transform={`translate(0 ${y})`}>
      <g stroke="#1f2a37" strokeWidth="3.5" strokeLinecap="round">
        <path d="M44 50 l11 5" />
        <path d="M76 50 l-11 5" />
      </g>
      <g className="enemy-blink">
        <circle cx="50" cy="60" r="4.2" fill="#1f2a37" />
        <circle cx="70" cy="60" r="4.2" fill="#1f2a37" />
        <circle cx="51.3" cy="58.6" r="1.4" fill="#fff" />
        <circle cx="71.3" cy="58.6" r="1.4" fill="#fff" />
      </g>
      <path d="M51 73 q9 -7 18 0" stroke="#1f2a37" strokeWidth="3.5" strokeLinecap="round" fill="none" />
    </g>
  );
}

function PollenBody() {
  const spikes = Array.from({ length: 12 }, (_, index) => index * 30);
  return (
    <>
      <g className="pollen-dust" fill="#f5cf45">
        <circle className="dust dust-1" cx="30" cy="40" r="2.5" />
        <circle className="dust dust-2" cx="92" cy="36" r="2" />
        <circle className="dust dust-3" cx="96" cy="70" r="2.5" />
        <circle className="dust dust-4" cx="24" cy="74" r="2" />
      </g>
      <g className="pollen-spikes">
        {spikes.map((angle) => (
          <path key={angle} d="M60 18 l6 14 h-12z" fill="#e0a41c" transform={`rotate(${angle} 60 60)`} />
        ))}
      </g>
      <circle cx="60" cy="60" r="31" fill="#f5c93a" />
      <g fill="#e8b224" opacity="0.7">
        <circle cx="47" cy="44" r="4" />
        <circle cx="75" cy="47" r="3" />
        <circle cx="80" cy="72" r="3.5" />
        <circle cx="40" cy="75" r="3" />
      </g>
      <circle cx="49" cy="42" r="7" fill="#fff" opacity="0.35" />
      <AngryFace />
    </>
  );
}

function StormBody({ level }) {
  return (
    <>
      <g className="rain" stroke="#5fa8e8" strokeWidth="3" strokeLinecap="round">
        <path className="drop drop-1" d="M42 84 l-3 9" />
        <path className="drop drop-2" d="M60 86 l-3 9" />
        <path className="drop drop-3" d="M78 84 l-3 9" />
      </g>
      {level === 'high' && <path className="bolt" d="M66 76 l-10 16 h9 l-6 14 l16 -20 h-9 l6 -10z" fill="#ffd84a" stroke="#e0a41c" strokeWidth="1.5" />}
      <g fill="#7b8aa6">
        <circle cx="40" cy="60" r="18" />
        <circle cx="60" cy="48" r="23" />
        <circle cx="82" cy="60" r="17" />
        <rect x="24" y="58" width="74" height="22" rx="11" />
      </g>
      <g fill="#9aa8c1">
        <circle cx="54" cy="40" r="12" />
        <circle cx="70" cy="44" r="8" />
      </g>
      <AngryFace y={2} />
    </>
  );
}

function SmogBody() {
  return (
    <>
      <g className="smog-puffs" fill="#b3a9c9">
        <circle className="smoke smoke-1" cx="36" cy="30" r="6" />
        <circle className="smoke smoke-2" cx="84" cy="26" r="5" />
      </g>
      <path
        d="M30 62 q0 -36 30 -36 q30 0 30 36 v24 q-5 8 -10 0 q-5 8 -10 0 q-5 8 -10 0 q-5 8 -10 0 q-5 8 -10 0 q-5 8 -10 0z"
        fill="#9d8fbd"
      />
      <path d="M40 40 q20 -12 40 0" stroke="#c5bbdc" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.8" />
      <path className="swirl" d="M72 76 q8 -6 2 -12 q-6 -4 -9 2" stroke="#c5bbdc" strokeWidth="3" strokeLinecap="round" fill="none" />
      <AngryFace y={2} />
    </>
  );
}

const BODIES = { pollen: PollenBody, weather: StormBody, air_quality: SmogBody };

export default function Enemy({ type, level = 'moderate', size = 80, label }) {
  const Body = BODIES[type] || PollenBody;
  return (
    <svg
      className={`enemy enemy-${type} enemy-${level}`}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label={label || `${type} trigger, ${level}`}
    >
      <ellipse className="enemy-ring" cx="60" cy="108" rx="34" ry="8" fill="none" stroke={LEVEL_RING[level]} strokeWidth="4" />
      <ellipse cx="60" cy="108" rx="24" ry="5" fill="#1f2a37" opacity="0.18" />
      <g className="enemy-float">
        <Body level={level} />
      </g>
    </svg>
  );
}
