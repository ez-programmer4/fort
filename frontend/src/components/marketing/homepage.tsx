'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon, type IconName } from '@/components/icons';
import { useToast } from '@/components/ui/toast';
import { GlobeToEthiopia } from './globe-map';
import { useCountUp, useReveal } from './hooks';

const CONTACT = {
  address: 'Bole Road, near Friendship Building, Addis Ababa, Ethiopia',
  phone: '+251 11 663 0000',
  email: 'info@fortpharma.com',
  hours: 'Mon – Sat, 8:30am – 6:00pm',
  mapEmbedSrc: 'https://maps.google.com/maps?q=9.0572416,38.7138769&z=16&output=embed',
  directionsUrl: 'https://www.google.com/maps/place/Fort+Pharma+PLC/@9.0572469,38.7112966,17z',
};

const NAV_LINKS = [
  { href: '#services', label: 'Services' },
  { href: '#customers', label: 'Who We Serve' },
  { href: '#process', label: 'How We Work' },
  { href: '#why-us', label: 'Why Us' },
  { href: '#contact', label: 'Contact' },
];

const COUNTRIES = ['India', 'China', 'Germany', 'Turkey', 'UAE', 'Switzerland', 'South Korea', 'Belgium', 'France', 'Egypt'];

const WHO_WE_SERVE: { icon: IconName; title: string; description: string }[] = [
  {
    icon: 'beaker',
    title: 'Pharmacies & Drug Stores',
    description: 'Retail and community pharmacies stocked with our full product range, from Addis Ababa to regional towns.',
  },
  {
    icon: 'heart',
    title: 'Hospitals & Clinics',
    description: 'Public and private healthcare facilities relying on us for consistent, quality-assured supply.',
  },
  {
    icon: 'truck',
    title: 'Wholesalers & Distributors',
    description: 'Regional wholesalers and distributors who resell our products to pharmacies across the country.',
  },
  {
    icon: 'users',
    title: 'Retail Customers',
    description: 'Individual and walk-in customers served directly through our sales counter and partner outlets.',
  },
];

const STATS: { icon: IconName; value: number; suffix: string; label: string }[] = [
  { icon: 'globe', value: 15, suffix: '+', label: 'Sourcing countries' },
  { icon: 'box', value: 500, suffix: '+', label: 'Products imported' },
  { icon: 'clock', value: 8, suffix: '', label: 'Years in operation' },
  { icon: 'check', value: 99, suffix: '%', label: 'On-time customs clearance' },
];

const SERVICES: { icon: IconName; title: string; description: string; examples: string[] }[] = [
  {
    icon: 'beaker',
    title: 'Medication',
    description:
      'EFDA-registered prescription and over-the-counter medicines, sourced from GMP-certified manufacturers worldwide.',
    examples: ['Antibiotics', 'Analgesics', 'Chronic-disease therapies', 'OTC medicines'],
  },
  {
    icon: 'gear',
    title: 'Equipment',
    description:
      'Medical, diagnostic and surgical equipment for hospitals, clinics and pharmacies, backed by documentation and after-sales support.',
    examples: ['Diagnostic devices', 'Surgical instruments', 'Consumables', 'Cold-chain units'],
  },
  {
    icon: 'sparkles',
    title: 'Cosmetics',
    description:
      'Quality-assured cosmetic and personal care products from trusted global brands, sourced for safety and shelf performance.',
    examples: ['Skincare', 'Personal care', 'Wellness & beauty'],
  },
];

const PROCESS: { icon: IconName; title: string; description: string }[] = [
  { icon: 'globe', title: 'Sourcing & Verification', description: 'We vet manufacturers and suppliers against GMP and quality standards before onboarding.' },
  { icon: 'shield', title: 'Regulatory Compliance', description: 'Every product is cleared through EFDA registration and import documentation.' },
  { icon: 'truck', title: 'Import & Logistics', description: 'Cold-chain and standard freight, customs clearance, and quality checks on arrival.' },
  { icon: 'mapPin', title: 'Distribution & Sales', description: 'Sold and delivered to pharmacies, hospitals, wholesalers and customers across Ethiopia.' },
];

const WHY_US = [
  'EFDA-registered & GMP-certified suppliers',
  'Reliable, monitored cold-chain logistics',
  'Competitive, transparent pricing',
  'Nationwide distribution network',
  'Dedicated account support for partners',
];

const inputClass =
  'w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900';

function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, visible } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export default function Homepage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Navbar menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      <Hero />
      <CountryTicker />
      <Stats />
      <Services />
      <WhoWeServe />
      <Process />
      <WhyUs />
      <CtaBanner />
      <Contact />
      <Footer />
      <BackToTop />
    </div>
  );
}

function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-xs font-bold text-white">
        FP
      </span>
      <span className={`text-lg font-bold tracking-tight ${dark ? 'text-white' : 'text-slate-900'}`}>Fort Pharma PLC</span>
    </div>
  );
}

function Navbar({ menuOpen, setMenuOpen }: { menuOpen: boolean; setMenuOpen: (v: boolean) => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Brand />

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
          >
            Client Portal
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="rounded-md p-2 text-slate-600 hover:bg-slate-100 md:hidden"
          aria-label="Toggle menu"
        >
          <Icon name={menuOpen ? 'x' : 'menu'} className="h-6 w-6" />
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-slate-200 bg-white px-6 py-4 md:hidden">
          <nav className="flex flex-col gap-4">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                {l.label}
              </a>
            ))}
            <Link
              href="/login"
              className="mt-2 rounded-md bg-slate-900 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-slate-700"
            >
              Client Portal
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-slate-50">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgb(148 163 184 / 0.35) 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }}
      />
      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-6 py-20 md:grid-cols-2 md:gap-8 md:py-28">
        <Reveal>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
            <Icon name="globe" className="h-3.5 w-3.5 text-blue-600" />
            Global Pharmaceutical Imports
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Quality medicines, sourced globally. Sold and delivered across Ethiopia.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600">
            Fort Pharma PLC imports EFDA-registered pharmaceuticals, medical consumables and equipment
            from trusted manufacturers around the world — and sells them directly to pharmacies,
            hospitals, wholesalers and customers across Ethiopia.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#contact"
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
            >
              Get in touch
              <Icon name="arrowRight" className="h-4 w-4" />
            </a>
            <a
              href="#services"
              className="inline-flex items-center rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900"
            >
              What we import
            </a>
          </div>
          <p className="mt-6 text-xs font-medium uppercase tracking-wide text-slate-400">
            GMP-compliant sourcing &nbsp;·&nbsp; Cold-chain logistics &nbsp;·&nbsp; EFDA-registered
          </p>
        </Reveal>

        <Reveal delay={150}>
          <GlobeToEthiopia />
        </Reveal>
      </div>
    </section>
  );
}

const SOLD_TO = ['Pharmacies', 'Hospitals & Clinics', 'Wholesalers', 'Distributors', 'Retail Customers', 'Drug Stores'];

function CountryTicker() {
  const sourced = [...COUNTRIES, ...COUNTRIES];
  const soldTo = [...SOLD_TO, ...SOLD_TO];
  return (
    <div className="overflow-hidden border-y border-slate-200 bg-white py-3 text-sm font-medium text-slate-500">
      <div className="flex w-max animate-marquee items-center gap-10 whitespace-nowrap px-6 py-0.5">
        {sourced.map((c, i) => (
          <span key={`${c}-${i}`} className="flex items-center gap-2">
            <Icon name="globe" className="h-3.5 w-3.5 text-blue-500" />
            Sourced from {c}
          </span>
        ))}
      </div>
      <div className="mt-2 flex w-max animate-marquee-reverse items-center gap-10 whitespace-nowrap px-6 py-0.5">
        {soldTo.map((c, i) => (
          <span key={`${c}-${i}`} className="flex items-center gap-2">
            <Icon name="truck" className="h-3.5 w-3.5 text-slate-400" />
            Sold to {c}
          </span>
        ))}
      </div>
    </div>
  );
}

function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
      className={`fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg transition-all duration-300 hover:bg-blue-600 print:hidden ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
      }`}
    >
      <Icon name="chevronUp" className="h-5 w-5" />
    </button>
  );
}

function StatCard({ stat, delay }: { stat: (typeof STATS)[number]; delay: number }) {
  const { ref, visible } = useReveal<HTMLDivElement>();
  const count = useCountUp(stat.value, visible);
  return (
    <div
      ref={ref}
      className={`group flex h-full flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-7 text-center transition-all duration-700 ease-out hover:-translate-y-1 hover:border-blue-200 hover:shadow-md hover:shadow-slate-900/5 ${visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
        <Icon name={stat.icon} className="h-5 w-5" />
      </span>
      <p className="text-3xl font-bold tracking-tight text-slate-900">
        {count}
        {stat.suffix}
      </p>
      <p className="text-sm text-slate-500">{stat.label}</p>
    </div>
  );
}

function Stats() {
  return (
    <section className="bg-white">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-5 px-6 py-14 sm:grid-cols-4">
        {STATS.map((s, i) => (
          <StatCard key={s.label} stat={s} delay={i * 80} />
        ))}
      </div>
    </section>
  );
}

function Services() {
  return (
    <section id="services" className="mx-auto max-w-7xl px-6 py-20 md:py-24">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">What we import</h2>
        <p className="mt-3 text-base text-slate-600">
          A full range of pharmaceutical and healthcare products, sourced and quality-checked before they
          reach Ethiopian shelves.
        </p>
      </Reveal>
      <div className="mt-14 grid gap-6 sm:grid-cols-3">
        {SERVICES.map((s, i) => (
          <Reveal key={s.title} delay={i * 100}>
            <div className="group relative h-full overflow-hidden rounded-xl border border-slate-200 p-7 transition-all hover:-translate-y-1 hover:border-slate-300 hover:shadow-md hover:shadow-slate-900/5">
              <span className="pointer-events-none absolute -right-2 -top-3 -z-10 text-6xl font-bold text-slate-50 transition-colors group-hover:text-blue-50">
                0{i + 1}
              </span>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-900 transition-colors group-hover:bg-blue-600">
                <Icon name={s.icon} className="h-6 w-6 text-white" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-slate-900">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.description}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {s.examples.map((e) => (
                  <span key={e} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                    {e}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function WhoWeServe() {
  return (
    <section id="customers" className="mx-auto max-w-7xl px-6 py-20 md:py-24">
      <Reveal className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
          <Icon name="users" className="h-3.5 w-3.5 text-blue-600" />
          Beyond importing
        </span>
        <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">Who we serve</h2>
        <p className="mt-3 text-base text-slate-600">
          We don&apos;t just import — we sell directly to the customers who keep Ethiopia&apos;s
          healthcare supply chain moving.
        </p>
      </Reveal>
      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {WHO_WE_SERVE.map((c, i) => (
          <Reveal key={c.title} delay={i * 90}>
            <div className="group flex h-full flex-col items-center rounded-xl border border-slate-200 p-6 text-center transition-all hover:-translate-y-1 hover:border-blue-200 hover:shadow-md hover:shadow-slate-900/5">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                <Icon name={c.icon} className="h-6 w-6" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-slate-900">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{c.description}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Process() {
  return (
    <section id="process" className="bg-slate-50 py-20 md:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">How we work</h2>
          <p className="mt-3 text-base text-slate-600">From sourcing to your shelf — a compliant, traceable supply chain.</p>
        </Reveal>
        <div className="mt-14 grid gap-8 md:grid-cols-4">
          {PROCESS.map((step, i) => (
            <Reveal key={step.title} delay={i * 100} className="group relative">
              <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white transition-colors group-hover:bg-blue-600">
                <Icon name={step.icon} className="h-6 w-6" />
                <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-50 bg-white text-xs font-bold text-slate-900">
                  {i + 1}
                </span>
              </div>
              {i < PROCESS.length - 1 && (
                <div
                  className="absolute top-7 hidden h-px bg-slate-300 md:block"
                  style={{ left: '3.5rem', right: '-1.5rem' }}
                />
              )}
              <h3 className="mt-4 text-sm font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.description}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhyUs() {
  return (
    <section id="why-us" className="mx-auto max-w-7xl px-6 py-20 md:py-24">
      <div className="grid gap-12 md:grid-cols-2 md:items-center">
        <Reveal>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Why partners choose Fort Pharma</h2>
          <p className="mt-3 text-base text-slate-600">
            We combine global sourcing relationships with strict regulatory compliance and modern
            inventory technology — so every customer, from a single pharmacy to a nationwide
            distributor, can trust every order.
          </p>
          <ul className="mt-8 space-y-4">
            {WHY_US.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50">
                  <Icon name="check" className="h-3.5 w-3.5 text-blue-600" />
                </span>
                <span className="text-sm text-slate-700">{point}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={150} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-blue-600/30 blur-3xl" />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)',
              backgroundSize: '20px 20px',
            }}
          />
          <div className="relative">
            <Icon name="chart" className="h-8 w-8 text-blue-400" />
            <h3 className="mt-5 text-lg font-semibold text-white">Real-time inventory technology</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Our internal FortInventory platform gives partners full traceability of stock — from
              warehouse receipt to dispensing — with multi-location visibility and audit trails.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-white/5 p-4 backdrop-blur-sm">
                <p className="text-xl font-bold text-white">24/7</p>
                <p className="mt-1 text-xs text-slate-400">Stock visibility</p>
              </div>
              <div className="rounded-lg bg-white/5 p-4 backdrop-blur-sm">
                <p className="text-xl font-bold text-white">Multi-site</p>
                <p className="mt-1 text-xs text-slate-400">Warehouse network</p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function CtaBanner() {
  return (
    <section className="relative overflow-hidden bg-slate-900">
      <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-xl -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/25 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />
      <Reveal className="relative mx-auto flex max-w-7xl flex-col items-center gap-6 px-6 py-16 text-center md:flex-row md:justify-between md:text-left">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Ready to partner with us?</h2>
          <p className="mt-2 text-sm text-slate-300">
            Reach out to discuss sourcing, pricing or distribution across Ethiopia.
          </p>
        </div>
        <a
          href="#contact"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100 hover:scale-105"
        >
          Contact our team
          <Icon name="arrowRight" className="h-4 w-4" />
        </a>
      </Reveal>
    </section>
  );
}

function Contact() {
  const toast = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    const subject = encodeURIComponent(`Website inquiry from ${name}`);
    const body = encodeURIComponent(`${message}\n\n— ${name} (${email})`);
    window.location.href = `mailto:${CONTACT.email}?subject=${subject}&body=${body}`;
    toast.success('Opening your email client to send the message…');
    setSending(false);
  }

  const infoItems: { icon: IconName; label: string; value: string }[] = [
    { icon: 'mapPin', label: 'Address', value: CONTACT.address },
    { icon: 'phone', label: 'Phone', value: CONTACT.phone },
    { icon: 'mail', label: 'Email', value: CONTACT.email },
    { icon: 'clock', label: 'Business hours', value: CONTACT.hours },
  ];

  return (
    <section id="contact" className="bg-slate-50 py-20 md:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Get in touch</h2>
          <p className="mt-3 text-base text-slate-600">
            Have a sourcing or distribution inquiry? Send us a message and our team will respond shortly.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {infoItems.map((item, i) => (
            <Reveal key={item.label} delay={i * 70}>
              <div className="group flex h-full items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 transition-all hover:-translate-y-1 hover:border-blue-200 hover:shadow-md hover:shadow-slate-900/5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-900 transition-colors group-hover:bg-blue-600">
                  <Icon name={item.icon} className="h-5 w-5 text-white" />
                </span>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{item.label}</p>
                  <p className="mt-0.5 text-sm font-medium text-slate-900">{item.value}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Reveal className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
            <iframe
              title="Fort Pharma PLC on Google Maps"
              src={CONTACT.mapEmbedSrc}
              className="h-72 w-full grow"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <a
              href={CONTACT.directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 border-t border-slate-200 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              <Icon name="mapPin" className="h-4 w-4" />
              Get directions
            </a>
          </Reveal>

          <Reveal delay={100}>
            <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Name</label>
                  <input required value={name} onChange={(e) => setName(e.target.value)} className={`mt-1 ${inputClass}`} placeholder="Your name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`mt-1 ${inputClass}`}
                    placeholder="you@company.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Message</label>
                <textarea
                  required
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className={`mt-1 ${inputClass} resize-none`}
                  placeholder="Tell us what you're looking for…"
                />
              </div>
              <button
                type="submit"
                disabled={sending}
                className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
              >
                Send message
                <Icon name="arrowRight" className="h-4 w-4" />
              </button>
            </form>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex flex-col justify-between gap-8 md:flex-row">
          <div className="max-w-xs">
            <Brand />
            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              Importing quality-assured pharmaceuticals from around the world, distributed reliably
              across Ethiopia.
            </p>
          </div>
          <div className="flex flex-wrap gap-12">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Company</p>
              <ul className="mt-3 space-y-2">
                {NAV_LINKS.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} className="text-sm text-slate-600 hover:text-slate-900">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Contact</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li>{CONTACT.phone}</li>
                <li>{CONTACT.email}</li>
                <li>{CONTACT.address}</li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Staff</p>
              <ul className="mt-3 space-y-2">
                <li>
                  <Link href="/login" className="text-sm text-slate-600 hover:text-slate-900">
                    Client Portal login
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-10 border-t border-slate-100 pt-6">
          <p className="text-xs text-slate-400">© {new Date().getFullYear()} Fort Pharma PLC. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
