'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon, type IconName } from '@/components/icons';
import { useToast } from '@/components/ui/toast';

const CONTACT = {
  address: 'Bole Road, near Friendship Building, Addis Ababa, Ethiopia',
  phone: '+251 11 663 0000',
  email: 'info@fortinventory.com',
  hours: 'Mon – Sat, 8:30am – 6:00pm',
};

const NAV_LINKS = [
  { href: '#services', label: 'Services' },
  { href: '#process', label: 'How We Work' },
  { href: '#why-us', label: 'Why Us' },
  { href: '#contact', label: 'Contact' },
];

const STATS = [
  { value: '15+', label: 'Sourcing countries' },
  { value: '500+', label: 'Products imported' },
  { value: '8', label: 'Years in operation' },
  { value: '99%', label: 'On-time customs clearance' },
];

const SERVICES: { icon: IconName; title: string; description: string }[] = [
  {
    icon: 'beaker',
    title: 'Prescription Pharmaceuticals',
    description: 'EFDA-registered generic and branded medicines sourced from GMP-certified manufacturers worldwide.',
  },
  {
    icon: 'heart',
    title: 'OTC & Consumer Health',
    description: 'Everyday over-the-counter medicines and wellness products for pharmacies and retail chains.',
  },
  {
    icon: 'box',
    title: 'Medical Consumables & Devices',
    description: 'Gloves, dressings, syringes and diagnostic consumables, stocked and distributed at scale.',
  },
  {
    icon: 'clipboard',
    title: 'Surgical & Diagnostic Equipment',
    description: 'Reliable equipment for hospitals and clinics, backed by documentation and after-sales support.',
  },
  {
    icon: 'snowflake',
    title: 'Cold-Chain & Vaccines',
    description: 'Temperature-controlled logistics from origin to destination, monitored at every handover.',
  },
  {
    icon: 'star',
    title: 'Nutraceuticals & Supplements',
    description: 'Vitamins and supplements from trusted global brands, sourced for quality and shelf performance.',
  },
];

const PROCESS = [
  { title: 'Sourcing & Verification', description: 'We vet manufacturers and suppliers against GMP and quality standards before onboarding.' },
  { title: 'Regulatory Compliance', description: 'Every product is cleared through EFDA registration and import documentation.' },
  { title: 'Import & Logistics', description: 'Cold-chain and standard freight, customs clearance, and quality checks on arrival.' },
  { title: 'Nationwide Distribution', description: 'Delivered to pharmacies, hospitals and distributors across Ethiopia.' },
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

export default function Homepage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Navbar menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      <Hero />
      <Stats />
      <Services />
      <Process />
      <WhyUs />
      <CtaBanner />
      <Contact />
      <Footer />
    </div>
  );
}

function Navbar({ menuOpen, setMenuOpen }: { menuOpen: boolean; setMenuOpen: (v: boolean) => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-sm font-bold text-white">F</span>
          <span className="text-lg font-bold tracking-tight text-slate-900">FortInventory</span>
        </div>

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
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgb(148 163 184 / 0.35) 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }}
      />
      <div className="relative mx-auto grid max-w-7xl gap-12 px-6 py-20 md:grid-cols-2 md:items-center md:py-28">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
            <Icon name="globe" className="h-3.5 w-3.5 text-blue-600" />
            Global Pharmaceutical Imports
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Quality medicines, sourced globally. Delivered across Ethiopia.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-600">
            FortInventory imports EFDA-registered pharmaceuticals, medical consumables and equipment
            from trusted manufacturers around the world, and distributes them reliably to pharmacies,
            hospitals and clinics nationwide.
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
        </div>

        <div className="relative">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <span className="text-sm font-semibold text-slate-900">Shipment Overview</span>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">On schedule</span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4">
              {[
                { icon: 'globe' as const, label: 'Origin', value: '12 countries' },
                { icon: 'truck' as const, label: 'In transit', value: '6 shipments' },
                { icon: 'snowflake' as const, label: 'Cold-chain', value: 'Monitored' },
                { icon: 'shield' as const, label: 'Compliance', value: 'EFDA cleared' },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-slate-100 bg-slate-50 p-3.5">
                  <Icon name={item.icon} className="h-5 w-5 text-blue-600" />
                  <p className="mt-2 text-xs text-slate-500">{item.label}</p>
                  <p className="text-sm font-semibold text-slate-900">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-lg bg-slate-900 p-4">
              <p className="text-xs text-slate-300">Powered by real-time inventory technology</p>
              <p className="mt-1 text-sm font-semibold text-white">Full traceability, warehouse to dispensary</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stats() {
  return (
    <section className="border-y border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-6 py-12 sm:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-3xl font-bold tracking-tight text-slate-900">{s.value}</p>
            <p className="mt-1 text-sm text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Services() {
  return (
    <section id="services" className="mx-auto max-w-7xl px-6 py-20 md:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">What we import</h2>
        <p className="mt-3 text-base text-slate-600">
          A full range of pharmaceutical and healthcare products, sourced and quality-checked before they
          reach Ethiopian shelves.
        </p>
      </div>
      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {SERVICES.map((s) => (
          <div
            key={s.title}
            className="group rounded-xl border border-slate-200 p-6 transition-all hover:border-slate-300 hover:shadow-md hover:shadow-slate-900/5"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-900 transition-colors group-hover:bg-blue-600">
              <Icon name={s.icon} className="h-5 w-5 text-white" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-slate-900">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Process() {
  return (
    <section id="process" className="bg-slate-50 py-20 md:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">How we work</h2>
          <p className="mt-3 text-base text-slate-600">From sourcing to your shelf — a compliant, traceable supply chain.</p>
        </div>
        <div className="mt-14 grid gap-8 md:grid-cols-4">
          {PROCESS.map((step, i) => (
            <div key={step.title} className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-slate-900 text-sm font-bold text-slate-900">
                {i + 1}
              </div>
              {i < PROCESS.length - 1 && (
                <div
                  className="absolute top-5 hidden h-px bg-slate-300 md:block"
                  style={{ left: '2.5rem', right: '-1.5rem' }}
                />
              )}
              <h3 className="mt-4 text-sm font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.description}</p>
            </div>
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
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Why partners choose FortInventory</h2>
          <p className="mt-3 text-base text-slate-600">
            We combine global sourcing relationships with strict regulatory compliance and modern
            inventory technology, so partners can trust every shipment.
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
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-900 p-8">
          <Icon name="chart" className="h-8 w-8 text-blue-400" />
          <h3 className="mt-5 text-lg font-semibold text-white">Real-time inventory technology</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            Our internal FortInventory platform gives partners full traceability of stock — from
            warehouse receipt to dispensing — with multi-location visibility and audit trails.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-white/5 p-4">
              <p className="text-xl font-bold text-white">24/7</p>
              <p className="mt-1 text-xs text-slate-400">Stock visibility</p>
            </div>
            <div className="rounded-lg bg-white/5 p-4">
              <p className="text-xl font-bold text-white">Multi-site</p>
              <p className="mt-1 text-xs text-slate-400">Warehouse network</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CtaBanner() {
  return (
    <section className="bg-slate-900">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-6 py-16 text-center md:flex-row md:justify-between md:text-left">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Ready to partner with us?</h2>
          <p className="mt-2 text-sm text-slate-300">
            Reach out to discuss sourcing, pricing or distribution across Ethiopia.
          </p>
        </div>
        <a
          href="#contact"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100"
        >
          Contact our team
          <Icon name="arrowRight" className="h-4 w-4" />
        </a>
      </div>
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
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Get in touch</h2>
          <p className="mt-3 text-base text-slate-600">
            Have a sourcing or distribution inquiry? Send us a message and our team will respond shortly.
          </p>
        </div>

        <div className="mt-14 grid gap-10 md:grid-cols-5">
          <div className="space-y-5 md:col-span-2">
            {infoItems.map((item) => (
              <div key={item.label} className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-900">
                  <Icon name={item.icon} className="h-5 w-5 text-white" />
                </span>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{item.label}</p>
                  <p className="mt-0.5 text-sm font-medium text-slate-900">{item.value}</p>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 md:col-span-3">
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
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-sm font-bold text-white">F</span>
              <span className="text-lg font-bold tracking-tight text-slate-900">FortInventory</span>
            </div>
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
          <p className="text-xs text-slate-400">© {new Date().getFullYear()} FortInventory. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
