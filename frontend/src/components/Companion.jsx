// The companion: a little inhaler character, drawn in SVG so it needs no image files.
// Its mood follows tomorrow's risk: happy (low), uneasy (moderate), worried (high).
// The canister presses down and the mouthpiece puffs mist; how often depends on the mood.

const MOOD_COLORS = {
  happy: { body: '#8fdcc0', shade: '#6cc7a6', label: '#3fae8c' },
  uneasy: { body: '#f7cf78', shade: '#ebb54f', label: '#e0a02c' },
  worried: { body: '#f4a097', shade: '#e87d72', label: '#d9574c' },
};

function Eyes({ mood }) {
  if (mood === 'happy') {
    // Closed, smiling eyes.
    return (
      <g stroke="#1f2a37" strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M72 108 q9 -11 18 0" />
        <path d="M110 108 q9 -11 18 0" />
      </g>
    );
  }
  return (
    <g>
      <g className="blink">
        <ellipse cx="81" cy="108" rx="6.5" ry="8.5" fill="#1f2a37" />
        <circle cx="83" cy="104" r="2.3" fill="#fff" />
      </g>
      <g className="blink">
        <ellipse cx="119" cy="108" rx="6.5" ry="8.5" fill="#1f2a37" />
        <circle cx="121" cy="104" r="2.3" fill="#fff" />
      </g>
      <g stroke="#1f2a37" strokeWidth="4" strokeLinecap="round">
        {mood === 'worried' ? (
          <>
            <path d="M70 91 l17 -6" />
            <path d="M130 91 l-17 -6" />
          </>
        ) : (
          <>
            <path d="M72 91 h17" />
            <path d="M111 91 h17" />
          </>
        )}
      </g>
    </g>
  );
}

function Mouth({ mood }) {
  if (mood === 'happy') return <path d="M88 127 q12 14 24 0" stroke="#1f2a37" strokeWidth="5" strokeLinecap="round" fill="none" />;
  if (mood === 'uneasy') return <path d="M89 131 q5.5 -5 11 0 t11 0" stroke="#1f2a37" strokeWidth="5" strokeLinecap="round" fill="none" />;
  return <ellipse cx="100" cy="133" rx="7.5" ry="6" fill="#1f2a37" />;
}

export default function Companion({ mood = 'happy', size = 160, label }) {
  const colors = MOOD_COLORS[mood] || MOOD_COLORS.happy;
  return (
    <svg
      className={`companion mood-${mood}`}
      width={size}
      height={size}
      viewBox="0 0 200 200"
      role="img"
      aria-label={label || `Your companion looks ${mood}`}
    >
      <ellipse className="shadow" cx="100" cy="190" rx="52" ry="7" fill="#1f2a37" />
      <g className="bob">
        {/* Metal canister, sitting in the top of the body. It presses down on each puff. */}
        <g className="canister">
          <rect x="76" y="14" width="48" height="66" rx="14" fill="#e3eaef" stroke="#b7c4cc" strokeWidth="3" />
          <rect x="76" y="40" width="48" height="16" fill={colors.label} opacity="0.85" />
          <rect x="84" y="20" width="8" height="52" rx="4" fill="#fff" opacity="0.7" />
        </g>

        {/* Mouthpiece sticking out to the right, with its opening. */}
        <rect x="128" y="138" width="54" height="36" rx="12" fill={colors.shade} />
        <ellipse cx="180" cy="156" rx="5" ry="12" fill="#1f2a37" opacity="0.55" />

        {/* Main plastic body. */}
        <rect className="body" x="50" y="62" width="100" height="116" rx="32" fill={colors.body} />
        <rect x="56" y="66" width="88" height="14" rx="7" fill={colors.shade} opacity="0.5" />
        <rect x="60" y="88" width="10" height="64" rx="5" fill="#fff" opacity="0.35" />
        <path d="M54 160 q46 22 92 0 v4 q0 14 -24 14 h-44 q-24 0 -24 -14z" fill={colors.shade} opacity="0.5" />

        <circle cx="70" cy="128" r="8.5" fill="#ff8fa3" opacity="0.45" />
        <circle cx="130" cy="128" r="8.5" fill="#ff8fa3" opacity="0.45" />
        <Eyes mood={mood} />
        <Mouth mood={mood} />
        {mood === 'worried' && <path className="sweat" d="M146 84 q7 11 0 16 q-7 -5 0 -16z" fill="#7cc3f0" />}
      </g>

      {/* Mist puffs from the mouthpiece. */}
      {mood !== 'worried' && (
        <g className="mist" fill="#ffffff" stroke="#cfe3ea" strokeWidth="1.5">
          <circle className="puff puff-1" cx="192" cy="150" r="7" />
          <circle className="puff puff-2" cx="192" cy="160" r="5" />
          <circle className="puff puff-3" cx="190" cy="154" r="4" />
        </g>
      )}
    </svg>
  );
}
