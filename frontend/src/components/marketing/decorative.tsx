'use client';

type ShapeProps = { className?: string; style?: React.CSSProperties };

function Capsule({ className, style }: ShapeProps) {
  return (
    <svg viewBox="0 0 48 24" fill="none" className={className} style={style} aria-hidden="true">
      <rect x="2" y="2" width="44" height="20" rx="10" stroke="currentColor" strokeWidth="1.5" />
      <line x1="24" y1="2" x2="24" y2="22" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function Tablet({ className, style }: ShapeProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
      <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function Bottle({ className, style }: ShapeProps) {
  return (
    <svg viewBox="0 0 24 32" fill="none" className={className} style={style} aria-hidden="true">
      <rect x="8" y="2" width="8" height="5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 9h12v18a2 2 0 01-2 2H8a2 2 0 01-2-2V9z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <line x1="6" y1="18" x2="18" y2="18" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function MedCross({ className, style }: ShapeProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 7v10M7 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

interface Placement {
  Shape: typeof Capsule;
  top: string;
  left: string;
  size: number;
  rotate: number;
  duration: string;
  delay: string;
}

const LIGHT_PLACEMENTS: Placement[] = [
  { Shape: Capsule, top: '9%', left: '5%', size: 38, rotate: -20, duration: '7s', delay: '0s' },
  { Shape: Tablet, top: '74%', left: '9%', size: 26, rotate: 8, duration: '8s', delay: '1s' },
  { Shape: MedCross, top: '14%', left: '47%', size: 24, rotate: 0, duration: '6.5s', delay: '0.5s' },
  { Shape: Bottle, top: '78%', left: '42%', size: 28, rotate: -8, duration: '9s', delay: '1.4s' },
  { Shape: Capsule, top: '18%', left: '89%', size: 32, rotate: 35, duration: '7.5s', delay: '0.8s' },
  { Shape: Tablet, top: '62%', left: '85%', size: 22, rotate: -15, duration: '6s', delay: '0.3s' },
  { Shape: MedCross, top: '90%', left: '92%', size: 20, rotate: 12, duration: '8.5s', delay: '1.2s' },
];

const SPARSE_PLACEMENTS: Placement[] = [
  { Shape: Capsule, top: '6%', left: '4%', size: 30, rotate: -15, duration: '7.5s', delay: '0.2s' },
  { Shape: Tablet, top: '88%', left: '8%', size: 22, rotate: 10, duration: '6.5s', delay: '0.9s' },
  { Shape: Bottle, top: '10%', left: '94%', size: 26, rotate: 12, duration: '8s', delay: '0.5s' },
  { Shape: MedCross, top: '85%', left: '93%', size: 20, rotate: -8, duration: '7s', delay: '1.1s' },
];

const DARK_PLACEMENTS: Placement[] = [
  { Shape: Capsule, top: '12%', left: '6%', size: 34, rotate: -18, duration: '7s', delay: '0s' },
  { Shape: Tablet, top: '70%', left: '10%', size: 22, rotate: 12, duration: '8s', delay: '0.8s' },
  { Shape: MedCross, top: '20%', left: '90%', size: 22, rotate: 0, duration: '6.5s', delay: '0.4s' },
  { Shape: Bottle, top: '68%', left: '92%', size: 26, rotate: -10, duration: '9s', delay: '1.3s' },
];

const VARIANTS = {
  light: { placements: LIGHT_PLACEMENTS, color: 'text-slate-300/70' },
  sparse: { placements: SPARSE_PLACEMENTS, color: 'text-blue-200/60' },
  dark: { placements: DARK_PLACEMENTS, color: 'text-white/10' },
};

export function FloatingPharmaIcons({ variant = 'light' }: { variant?: keyof typeof VARIANTS }) {
  const { placements, color } = VARIANTS[variant];
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {placements.map((p, i) => (
        <span key={i} className="absolute" style={{ top: p.top, left: p.left, transform: `rotate(${p.rotate}deg)` }}>
          <p.Shape
            className={`animate-float ${color}`}
            style={{ width: p.size, height: p.size, animationDuration: p.duration, animationDelay: p.delay }}
          />
        </span>
      ))}
    </div>
  );
}
