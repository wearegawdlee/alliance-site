import { useState, useMemo } from "react";

const BIZ = {
  phone: "(770)742-9433",
  serviceAreas: [
    "Alpharetta","Atlanta","Brookhaven","Buckhead","Buford","Canton","Chamblee",
    "Cumming","Decatur","Doraville","Duluth","Dunwoody","Druid Hills","East Cobb","Johns Creek","Kennesaw",
    "Marietta","Milton","Norcross",  "Peachtree Corners", "Roswell", "Sandy Springs","Smyrna", "Suwanee", "Woodstock",
  ],
};

export default function ServiceAreas() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);

  const results = useMemo(() => {
    const s = query.trim().toLowerCase();
    if (!s) return BIZ.serviceAreas;
    return BIZ.serviceAreas.filter((a) => a.toLowerCase().includes(s));
  }, [query]);

  return (
    <section id="areas" className="bg-black text-white py-16 px-4">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-2xl md:text-3xl font-semibold">Service Areas</h2>
        <p className="mt-2 text-neutral-300">Based in Roswell, covering North Atlanta.</p>

        <div className="relative mt-6 max-w-md">
          <input
            value={query}
            onChange={(e) => {
              const value = e.target.value;
              setQuery(value);
              if (BIZ.serviceAreas.includes(value)) {
                window.dispatchEvent(new CustomEvent("service-area-selected", { detail: value }));
              }
            }}
            placeholder="Search your city..."
            list="service-areas"
            className="w-full rounded-2xl bg-white/5 px-4 py-3 pr-12 ring-1 ring-white/20 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-white/40"
          />
          <button
            type="button"
            onClick={() => {
              const value = query.trim();
              if (!value) {
                setResult({ ok: false, message: "Enter a city to check." });
                return;
              }
              const match = BIZ.serviceAreas.find((area) => area.toLowerCase() === value.toLowerCase());
              if (match) {
                setResult({ ok: true, message: `Yes — we service ${match}.` });
                window.dispatchEvent(new CustomEvent("service-area-selected", { detail: match }));
              } else {
                setResult({ ok: false, message: "Not seeing your area? Call us and we’ll check availability." });
              }
            }}
            className="mt-3 w-full rounded-2xl bg-white text-black px-4 py-2 font-medium hover:bg-neutral-200"
          >
            Check Availability
          </button>
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-neutral-400 hover:text-white"
              aria-label="Clear"
            >
              ✕
            </button>
          )}
          <datalist id="service-areas">
            {results.map((area) => (
              <option value={area} key={area} />
            ))}
          </datalist>
          {result && (
            <p className={result.ok ? "mt-3 text-sm text-emerald-300" : "mt-3 text-sm text-amber-300"}>
              {result.message}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
