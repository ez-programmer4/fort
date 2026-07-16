'use client';

// Decorative, hand-plotted low-poly outline of Ethiopia (not survey-accurate) —
// stylized for the hero graphic, not for navigation.
const ETHIOPIA_POLYGON =
  '555.6,72.6 643.8,65 706.8,110.4 744.6,160.8 858,236.4 757.2,337.2 681.6,349.8 568.2,324.6 517.8,274.2 480,236.4 505.2,173.4 530.4,123';

const ADDIS = { x: 624, y: 210 };

const ORIGINS = [
  { id: 'china', label: 'China', x: 300, y: 120, labelX: 352, labelY: 88 },
  { id: 'india', label: 'India', x: 270, y: 160, labelX: 350, labelY: 182 },
  { id: 'germany', label: 'Germany', x: 140, y: 108, labelX: 48, labelY: 72 },
  { id: 'uae', label: 'UAE', x: 232, y: 253, labelX: 232, labelY: 296 },
];

const MERIDIANS = [
  'M190,55 L190,385',
  'M190,55 Q75,220 190,385',
  'M190,55 Q305,220 190,385',
  'M190,55 Q130,220 190,385',
  'M190,55 Q250,220 190,385',
];

const PARALLELS = [
  'M25,220 L355,220',
  'M55,150 Q190,175 325,150',
  'M55,290 Q190,265 325,290',
  'M90,100 Q190,125 290,100',
  'M90,340 Q190,315 290,340',
];

function flightPath(x: number, y: number, arc: number) {
  const midX = (x + ADDIS.x) / 2;
  const midY = (y + ADDIS.y) / 2 - arc;
  return `M${x},${y} Q${midX},${midY} ${ADDIS.x},${ADDIS.y}`;
}

const FLIGHTS = [
  { ...ORIGINS[0], d: flightPath(ORIGINS[0].x, ORIGINS[0].y, 90), delay: '0s' },
  { ...ORIGINS[1], d: flightPath(ORIGINS[1].x, ORIGINS[1].y, 70), delay: '0.9s' },
  { ...ORIGINS[2], d: flightPath(ORIGINS[2].x, ORIGINS[2].y, 110), delay: '1.8s' },
  { ...ORIGINS[3], d: flightPath(ORIGINS[3].x, ORIGINS[3].y, 40), delay: '2.7s' },
];

export function GlobeToEthiopia() {
  return (
    <svg
      viewBox="0 0 900 440"
      className="mx-auto w-full max-w-4xl"
      role="img"
      aria-label="Illustration of pharmaceutical shipments flowing from global sourcing countries to Ethiopia"
    >
      <defs>
        <radialGradient id="globeFill" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </radialGradient>
        <linearGradient id="ethiopiaFill" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#eff6ff" />
          <stop offset="100%" stopColor="#dbeafe" />
        </linearGradient>
      </defs>

      {/* Globe */}
      <circle cx="190" cy="220" r="165" fill="url(#globeFill)" stroke="#cbd5e1" strokeWidth="1.5" />
      <g fill="none" stroke="#cbd5e1" strokeWidth="1" opacity="0.8">
        {MERIDIANS.map((d) => (
          <path key={d} d={d} />
        ))}
        {PARALLELS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <circle cx="190" cy="220" r="165" fill="none" stroke="#94a3b8" strokeWidth="1.5" />

      {/* Origin markers */}
      {ORIGINS.map((o) => (
        <g key={o.id}>
          <line x1={o.x} y1={o.y} x2={o.labelX} y2={o.labelY} stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 2" />
          <circle cx={o.x} cy={o.y} r="4" fill="#2563eb" />
          <circle cx={o.x} cy={o.y} r="4" fill="#2563eb" className="animate-pulse-ring" style={{ transformOrigin: `${o.x}px ${o.y}px` }} />
          <text
            x={o.labelX}
            y={o.labelY}
            textAnchor={o.labelX < o.x ? 'end' : o.labelX === o.x ? 'middle' : 'start'}
            className="fill-slate-500 text-[13px] font-medium"
          >
            {o.label}
          </text>
        </g>
      ))}

      {/* Flight paths from origins to Addis Ababa */}
      <g fill="none" strokeLinecap="round">
        {FLIGHTS.map((f) => (
          <g key={f.id}>
            <path d={f.d} stroke="#93c5fd" strokeWidth="1.5" opacity="0.5" />
            <path
              d={f.d}
              stroke="#2563eb"
              strokeWidth="1.5"
              strokeDasharray="5 7"
              className="animate-dash-flow"
              style={{ animationDelay: f.delay }}
            />
            <circle r="3.5" fill="#1d4ed8">
              <animateMotion dur="3.6s" repeatCount="indefinite" begin={f.delay} path={f.d} rotate="auto" />
            </circle>
          </g>
        ))}
      </g>

      {/* Ethiopia */}
      <polygon points={ETHIOPIA_POLYGON} fill="url(#ethiopiaFill)" stroke="#0f172a" strokeWidth="2" strokeLinejoin="round" />
      <text x="669" y="315" textAnchor="middle" className="fill-slate-900 text-[15px] font-bold tracking-wide">
        ETHIOPIA
      </text>

      {/* Addis Ababa pin */}
      <circle cx={ADDIS.x} cy={ADDIS.y} r="5" fill="#0f172a" />
      <circle cx={ADDIS.x} cy={ADDIS.y} r="5" fill="#0f172a" className="animate-pulse-ring" style={{ transformOrigin: `${ADDIS.x}px ${ADDIS.y}px` }} />
      <circle cx={ADDIS.x} cy={ADDIS.y} r="2" fill="#ffffff" />
      <text x={ADDIS.x} y={ADDIS.y - 16} textAnchor="middle" className="fill-slate-900 text-[13px] font-semibold">
        Addis Ababa
      </text>
    </svg>
  );
}
