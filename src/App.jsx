// Single‑file React component for a small‑business website
// Tech: React + Tailwind CSS classes (no external UI deps)
// Deploy anywhere (Netlify/Vercel/Static). Replace the TODO fields below.


const BIZ = {
  name: "Alliance Garage Doors of Roswell", // TODO: business name
  phone: "(770)742-9433", // TODO: real phone
  address: "Roswell, GA 30075", 
  sms: "(770)742-9433", // TODO: SMS-capable number (can be same as phone)
  email: "alliancegaragedoorroswell@gmail.com",// TODO: full street + city + ZIP
  hours: "Mon–Sat 7:00am–7:00pm",
  serviceAreas: [
    "Atlanta",
    "Alpharetta",
    "Buckhead",
    "Buford",
    "Brookhaven",
    "Canton",
    "Chamblee",
    "Cumming",
    "Decatur",
    "Duluth",
    "Dunwoody",
    "Doraville",
    "Johns Creek",
    "Kennesaw",
    "East Cobb",
    "Johns Creek",
    "Marietta",
    "Milton",
    "Norcross",
    "Roswell",
    "Sandy Springs",
    "Woodstock",
    // add more as needed
  ],
  license: "Locally owned & insured",
  
};

// Logo assets )
const LOGO = {
  main: "logo-main.webp", // horizontal lockup
  markBlue: "house-logo.jpg", // square mark, blue
  markWhite: "white-logo.png", // square mark, white
};

export default function AllianceGarageDoorsSite() {
  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <Header />
      <SiteHead />
      <Hero />
      <TrustBar />
      <Services />
      <ServiceAreas />
      <WhyUs />
      <Gallery />
      <Contact />
      <FAQ />
      <Footer />
      <StructuredData />
    </main>
  );
}

function SiteHead() {
  return (
    <>
      {/* Basic meta + OG — add in your framework's head manager if available */}
      <title>{BIZ.name} | Garage Door Repair & Installation in Roswell, GA</title>
      <meta
        name="description"
        content="Same‑day garage door repair, spring replacement, opener installs, and new doors. Sensible pricing. Serving Roswell & North Atlanta. Call now for a qutoe."
      />
      <meta property="og:title" content={`${BIZ.name} — Repair & Installation`} />
      <meta
        property="og:description"
        content="Same‑day repairs, opener installs, new doors. Serving Roswell & North Atlanta."
      />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content="en_US" />
      {/* Favicon / PWA icons */}
      <link rel="icon" href={LOGO.markBlue} />
    </>
  );
}

function Header() {
  return (
    <header className="bg-white border-b border-neutral-200">
      <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={LOGO.main} alt={`${BIZ.name} logo`} className="h-10 md:h-24 object-contain" />
          
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <a href="#services" className="hover:text-neutral-600">Services</a>
          <a href="#why" className="hover:text-neutral-600">Why Us</a>
          <a href="#areas" className="hover:text-neutral-600">Areas</a>
          <a href="#faq" className="hover:text-neutral-600">FAQ</a>
          <a href="#contact" className="hover:text-neutral-600">Contact</a>
        </nav>
        
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-cyan-900 via-teal-900 to-blue-900 text-white">
      <div className="absolute inset-0 opacity-20" aria-hidden>
        {/* Subtle pattern */}
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>
      <div className="relative mx-auto max-w-6xl px-4 py-20 md:py-28">
        <h1 className="text-4xl md:text-5xl font-semibold leading-tight">
          Top of class Garage Door Service for Roswell & North Atlanta
        </h1>
        <p className="mt-4 max-w-2xl text-neutral-200">
          Spring and cable replacement, opener and new door installs.
          Get your quote today.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href={`tel:${BIZ.phone}`} className="rounded-2xl bg-white text-neutral-900 px-5 py-3 font-medium hover:bg-neutral-100">
            Call {formatPhone(BIZ.phone)}
          </a>
          <a href={`sms:${BIZ.sms}`} className="rounded-2xl bg-transparent ring-1 ring-white/40 px-5 py-3 font-medium hover:bg-white/10">
            Text for ETA
          </a>
          <a href="#contact" className="rounded-2xl bg-transparent ring-1 ring-white/40 px-5 py-3 font-medium hover:bg-white/10">
            Email
          </a>
        </div>
        <p className="mt-3 text-sm text-neutral-300">Hours: {BIZ.hours}</p>
      </div>
    </section>
  );
}

function TrustBar() {
  const items = [
    "Same‑Day Service",
    "Licensed & Insured",
    "Workmanship Warranty",
    "Locally Owned",
  ];
  return (
    <div className="bg-white">
      <div className="mx-auto max-w-6xl px-4 py-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {items.map((t) => (
          <div key={t} className="rounded-xl border border-neutral-200 px-3 py-2 text-center text-sm">
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}

function Services() {
  const services = [
    {
      title: "Repairs",
      desc: "Broken springs, cables, rollers, tracks, panels, off‑track doors, noisy operation.",
      bullets: ["Torsion & extension springs", "Cables/rollers/hinges", "Track & alignment"],
    },
    {
      title: "Openers",
      desc: "Install, replace, or fix belt/chain drive openers. Smart Wi‑Fi setups included.",
      bullets: ["LiftMaster • Chamberlain • Genie", "Keypads & remotes", "MyQ, HomeKit, Google"],
    },
    {
      title: "New Doors",
      desc: "Sales & installation — steel, carriage, insulated, glass. Free onsite measure.",
      bullets: ["Design consult", "Insulated R‑values", "Haul‑away included"],
    },
    {
      title: "Maintenance",
      desc: "Lube & tune, safety checks, balance, preventive parts before costly failures.",
      bullets: ["Annual tune‑ups", "Safety sensors", "Door balance & force"],
    },
  ];
  return (
    <section id="services" className="bg-neutral-200">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-2xl md:text-3xl font-semibold">Services</h2>
        <p className="mt-2 text-neutral-600 max-w-2xl">
          Whether it’s a broken spring at 7am or a quiet new opener, we keep your doors functioning safely and securely.
        </p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((s) => (
            <article key={s.title} className="rounded-2xl bg-white border border-neutral-200 p-5">
              <h3 className="font-semibold text-lg">{s.title}</h3>
              <p className="mt-2 text-sm text-neutral-600">{s.desc}</p>
              <ul className="mt-3 space-y-1 text-sm">
                {s.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-neutral-900" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhyUs() {
  const points = [
    {
      title: "No pressure, just facts",
      body: "Clear diagnostics and options. If a repair is all you need, that’s what we’ll do.",
    },
    {
      title: "Parts that last",
      body: "We use high-cycle springs, sealed rollers, and pro-grade hardware to extend service life.",
    },
    {
      title: "Respect for your time",
      body: "Tight arrival windows and text updates so you’re not stuck waiting all day.",
    },
    {
      title: "Local and accountable",
      body: "Owned in Roswell. We live where we work. Your referrals keep us honest.",
    },
  ];

  return (
    <section id="why" className="bg-white">
      <div className="mx-auto max-w-6x1 px-4 py-16 grid md:grid-cols-1 gap-10">
        <div>
          <h2 className="text-2xl md:text-3xl font-semibold text-center">
            Why choose {BIZ.name}?
          </h2>
          <p className="mt-3 text-neutral-600 text-center">
            We’re the crew neighbors call when they want it fixed right the first time.
          </p>

          {/* Changed this line to make the cards 2 by 2 */}
          
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {points.map((p) => (
              <div
                key={p.title}
                className="rounded-xl border border-neutral-200 p-4"
              >
                <h3 className="font-medium">{p.title}</h3>
                <p className="text-sm text-neutral-600 mt-1">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}


import { useState, useMemo, useRef, useEffect } from "react";

function ServiceAreas() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);

  const results = useMemo(() => {
    const s = query.trim().toLowerCase();
    if (!s) return BIZ.serviceAreas;
    return BIZ.serviceAreas.filter((a) => a.toLowerCase().includes(s));
  }, [query]);

  useEffect(() => {
    const closeOnClickOutside = (e) => {
      if (!inputRef.current) return;
      if (!inputRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("click", closeOnClickOutside);
    return () => document.removeEventListener("click", closeOnClickOutside);
  }, []);

  return (
    <section id="areas" className="bg-black text-white py-16 px-4">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-2xl md:text-3xl font-semibold">Service Areas</h2>
        <p className="mt-2 text-neutral-300">Based in Roswell, covering North Atlanta.</p>

        <div className="relative mt-6 max-w-md" ref={inputRef}>
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="Search your city..."
            className="w-full rounded-2xl bg-white/5 px-4 py-3 pr-12 ring-1 ring-white/20 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-white/40"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-neutral-400 hover:text-white"
            >
              ✕
            </button>
          )}

          {open && (
            <ul className="absolute z-10 mt-2 w-full rounded-2xl bg-black/90 backdrop-blur border border-white/10 max-h-60 overflow-y-auto">
              {results.length > 0 ? (
                results.map((area) => (
                  <li key={area} className="px-4 py-3 hover:bg-white/10 cursor-pointer">
                    {area}
                  </li>
                ))
              ) : (
                <li className="px-4 py-3 text-neutral-400">
                  Not seeing your area?{" "}
                  <a href={`tel:${BIZ.phone}`} className="underline">Call us</a>.
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}


function Gallery() {
  // Placeholder images — swap for real project photos
  // Replace these with your own images.
  // Put your images in the /public folder (e.g. public/garage1.jpg)
  // Then reference them with a relative path like "/garage1.jpg"
  const imgs = [
    "/Before1.webp",
    "/After1.webp",
  ];
  return (
    <section className="bg-neutral-200">
      <div className="mx-auto max-w-2x1 px-12 py-8">
        <h2 className="text-2xl md:text-3xl font-semibold text-center">Recent Work</h2>
        <p className="mt-2 text-neutral-600 text-center">A few before and after pics from the past month.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-2">
          {imgs.map((src, i) => (
            <img
              key={i}
              src={src}
              alt="Garage door project"
              className="h-100 w-auto object-cover rounded-xl border border-neutral-200"
              loading="lazy"
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const qa = [
    {
      q: "How fast can you come out?",
      a: "Same‑day in most cases for Roswell and nearby cities. Emergency 24/7 available.",
    },
    {
      q: "Do you warranty repairs?",
      a: "Yes. We warranty labor and manufacturer parts. Ask for details per job.",
    },
    {
      q: "What opener brands do you install?",
      a: "LiftMaster, Chamberlain, Genie, and others. We configure smart features on request.",
    },
    {
      q: "Can I get a ballpark price by text?",
      a: "Yes — text a photo of your setup and issue. We’ll reply with options.",
    },
  ];
  return (
    <section id="faq" className="bg-black text-white">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-2xl md:text-3xl font-semibold">FAQ</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {qa.map((item) => (
            <details key={item.q} className="rounded-xl border border-neutral-200 p-4">
              <summary className="font-medium cursor-pointer">{item.q}</summary>
              <p className="mt-2 text-sm text-white">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Contact() {
  return (
    <section id="contact" className="bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-16 grid md:grid-cols-2 gap-10">
        <div>
          <h2 className="text-2xl md:text-3xl font-semibold">Get a Quote</h2>
          <p className="mt-2 text-neutral-600">
            Call, text, or send the form. Include photos for fastest pricing.
          </p>
          <div className="mt-4 space-y-2 text-sm">
            <p><strong>Phone/Text:</strong> <a className="underline" href={`tel:${BIZ.phone}`}>{formatPhone(BIZ.phone)}</a></p>
            <p><strong>Email:</strong> <a className="underline" href={`mailto:${BIZ.email}`}>{BIZ.email}</a></p>
            <p><strong>Address:</strong> {BIZ.address}</p>
            <p><strong>Hours:</strong> {BIZ.hours}</p>
          </div>
        </div>
        <form
          className="rounded-2xl bg-white border border-neutral-200 p-6 space-y-4"
          action="https://formspree.io/f/xdkwwdnv"method="POST">
        
          <div>
            <label className="block text-sm font-medium">Name</label>
            <input name="name" required className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium">Phone</label>
            <input name="phone" required className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium">Email</label>
            <input type="email" name="email" className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium">City</label>
            <input name="city" className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium">What’s going on?</label>
            <textarea name="message" rows={4} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2" placeholder="Broken spring, opener install, new doors…" />
          </div>
          <button type="submit" className="w-full rounded-2xl bg-neutral-900 text-white px-5 py-3 font-medium hover:bg-neutral-800">
            Send Request
          </button>
          <p className="text-xs text-neutral-500">By submitting, you agree to be contacted about your service request.</p>
        </form>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-white border-t border-neutral-200">
      <div className="mx-auto max-w-6xl px-4 py-10 grid md:grid-cols-3 gap-8 text-sm">
        <div>
          <p className="mt-2 text-neutral-600 max-w-sm">
            Reliable installation and repair with fair and sensible pricing.
          </p>
        </div>
        <div>
          <p className="font-medium">Quick Links</p>
          <ul className="mt-2 space-y-1">
            <li><a className="hover:underline" href="#services">Services</a></li>
            <li><a className="hover:underline" href="#areas">Service Areas</a></li>
            <li><a className="hover:underline" href="#faq">FAQ</a></li>
            <li><a className="hover:underline" href="#contact">Contact</a></li>
          </ul>
        </div>
        <div>
          <p className="font-medium">Contact</p>
          <ul className="mt-2 space-y-1">
            <li><a className="hover:underline" href={`tel:${BIZ.phone}`}>{formatPhone(BIZ.phone)}</a></li>
            <li><a className="hover:underline" href={`sms:${BIZ.sms}`}>Text us</a></li>
            <li><a className="hover:underline" href={`mailto:${BIZ.email}`}>{BIZ.email}</a></li>
            <li>{BIZ.address}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-neutral-200 py-4 text-center text-xs text-neutral-500">
        © {new Date().getFullYear()} {BIZ.name}. All rights reserved.
      </div>
    </footer>
  );
}

function Logo({ variant = "blue" }) {
  const src = variant === "white" ? LOGO.markWhite : LOGO.markBlue;
  return (
    <img
      src={src}
      alt="Alliance Garage Doors mark"
      className="h-10 w-10 object-contain"
    />
  );
}

function StructuredData() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: BIZ.name,
    telephone: BIZ.phone,
    email: BIZ.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: BIZ.address, // TODO: full street address
      addressLocality: 'Roswell',
      addressRegion: 'GA',
      postalCode: '30075', // TODO
      addressCountry: 'US',
    },
    areaServed: BIZ.serviceAreas,
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: [
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
        ],
        opens: '07:00',
        closes: '19:00',
      },
    ],
    url: 'https://www.alliancegaragedoors.com', // TODO
  };
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
  );
}

function formatPhone(p) {
  const digits = String(p).replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
  return p;
}

// =====================
// Minimal self-tests
// =====================
function runSelfTests() {
  const errs = [];
  const req = (cond, msg) => { if (!cond) errs.push(msg); };

  // BIZ shape
  req(typeof BIZ.name === 'string' && BIZ.name.length > 0, 'BIZ.name missing');
  req(/\d{10}/.test(String(BIZ.phone).replace(/\D/g, '')), 'BIZ.phone should be 10 digits');
  req(Array.isArray(BIZ.serviceAreas) && BIZ.serviceAreas.length >= 3, 'BIZ.serviceAreas too small');

  // LOGO paths sanity
  req(typeof LOGO.main === 'string' && LOGO.main.length > 0, 'LOGO.main missing');
  req(typeof LOGO.markBlue === 'string' && LOGO.markBlue.length > 0, 'LOGO.markBlue missing');
  req(typeof LOGO.markWhite === 'string' && LOGO.markWhite.length > 0, 'LOGO.markWhite missing');

  if (errs.length) {
    // Do not throw in production; just log to console for debugging
    // eslint-disable-next-line no-console
    console.warn('[AllianceGarageDoorsSite] Self-tests warnings:\n - ' + errs.join('\n - '));
  } else {
    // eslint-disable-next-line no-console
    console.log('[AllianceGarageDoorsSite] Self-tests passed');
  }
}

try {
  if (typeof window !== 'undefined' && (typeof process === 'undefined' || process?.env?.NODE_ENV !== 'production')) {
    runSelfTests();
  }
} catch (_) {
  // swallow
}
// =====================