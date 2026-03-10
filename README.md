# Alliance Garage Doors of Roswell — Website

Production website for Alliance Garage Doors of Roswell.

## Stack
- Astro 5
- React islands
- Tailwind CSS 4
- Vercel deploy target

## Local Development
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
npm run preview
```

## Repository Conventions
- **Default/working branch:** `astro-migration` (to be renamed later if desired)
- Keep Astro app at repository root (single source of truth)
- Open PRs for all changes

## Operational Notes
- Business copy/content lives mainly in `src/pages/index.astro`
- React interactive component: `src/components/ServiceAreas.jsx`
- Global layout/styles: `src/layouts/Base.astro`, `src/styles/global.css`
