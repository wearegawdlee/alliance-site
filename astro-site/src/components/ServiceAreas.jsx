import { useState, useMemo, useRef, useEffect } from "react";

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
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);

  const results = useMemo(() => {
    const s = query.trim().toLowerCase();
    if (!s) return BIZ.serviceAreas;
    return BIZ.serviceAreas.filter((a) => a.toLowerCase().includes(s));
  }, [query]);

  useEffect(() => {
    const close = (e) => {
      if (!inputRef.current) return;
      if (!inputRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
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
              aria-label="Clear"
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
                  Not seeing your area? <a href={`tel:${BIZ.phone}`} className="underline">Call us</a>.
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
