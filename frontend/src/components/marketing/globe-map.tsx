'use client';

// Ethiopia's real national outline, extracted from Natural Earth boundary data
// (world-atlas countries-50m, ISO-3166 numeric 231) and simplified to ~90
// points, projected to fit this viewBox. Not for navigational use, but a true
// (simplified) representation of the country's actual shape, not a guess.
const ETHIOPIA_POLYGON =
  '537.5,304.2 532.6,299.4 529.4,289.8 522.9,273.7 517.0,267.5 506.1,259.0 501.9,251.6 491.7,246.4 480.5,243.4 480.0,237.7 485.6,227.4 495.1,227.5 506.3,224.6 507.0,219.2 506.4,201.8 508.5,190.4 512.5,181.7 515.7,166.1 520.1,164.1 525.7,166.9 529.7,156.4 532.0,144.4 537.1,135.6 548.0,118.2 556.2,116.1 560.1,113.5 563.6,97.8 566.7,92.1 570.2,75.6 581.1,75.0 585.2,73.6 591.8,72.6 597.5,78.5 604.0,63.9 610.5,64.0 614.4,65.4 621.8,71.3 636.7,66.0 640.0,69.9 648.6,68.4 658.1,70.8 666.6,71.1 680.9,78.6 696.4,95.4 709.3,107.7 718.9,117.2 720.3,126.0 711.7,138.2 706.9,149.8 709.7,161.7 717.3,160.8 730.1,158.5 735.1,160.6 735.5,163.1 730.1,171.0 733.5,177.0 736.8,183.0 744.8,192.6 751.7,202.8 760.6,208.8 781.6,218.3 805.7,226.2 841.3,238.1 860.0,238.9 855.2,252.1 828.4,278.0 807.7,299.6 789.7,319.3 765.8,318.3 760.7,319.3 747.8,323.5 736.4,333.7 722.3,337.6 710.8,342.3 696.7,344.5 690.6,344.1 680.8,336.0 661.2,344.4 651.9,354.1 638.1,356.1 624.6,353.5 611.0,352.3 592.6,340.2 578.7,332.0 563.6,331.5 554.4,326.9 550.2,318.3 551.1,311.6 541.5,306.2 538.0,307.0';

// Addis Ababa's real coordinates (9.0572416, 38.7138769), projected the same way.
const ADDIS = { x: 627.3, y: 211.2 };

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
      <polygon points={ETHIOPIA_POLYGON} fill="url(#ethiopiaFill)" stroke="#0f172a" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <text x="650" y="300" textAnchor="middle" className="fill-slate-900 text-[15px] font-bold tracking-wide">
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
