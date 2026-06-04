# SEO & Google Search Console — Codex AI Workspace

## Live URLs to verify after deploy

| Resource | URL |
|----------|-----|
| App (canonical) | https://codex.itsnomatata.com/ |
| Login | https://codex.itsnomatata.com/login |
| About / credits (crawlable) | https://codex.itsnomatata.com/about |
| Robots | https://codex.itsnomatata.com/robots.txt |
| Sitemap | https://codex.itsnomatata.com/sitemap.xml |
| Company site | https://itsnomatata.com/ |

If your production domain differs, set `VITE_PUBLIC_SITE_URL` in `.env` and update `public/sitemap.xml`, `public/robots.txt`, and `index.html` canonical URLs before deploy.

## What was added

- **index.html** — title, meta description, Open Graph, Twitter Card, JSON-LD (Organization + WebApplication + creators).
- **public/about.html** — public page naming **Thando Mpofu** and **Benjamin McDonald** with links to [GitHub (thando544)](https://github.com/thando544), [Instagram (@thando.dev1)](https://www.instagram.com/thando.dev1/), [IT's No Matata](https://itsnomatata.com/), and [ItsnomatataDev](https://github.com/ItsnomatataDev).
- **public/robots.txt** — allows `/`, `/login`, `/about`; blocks authenticated app paths.
- **public/sitemap.xml** — entry points for Google.
- **vercel.json** — `/about` serves static HTML; SPA routes still work.

## Public sources used (team credits)

- [Thando Mpofu — GitHub](https://github.com/thando544) — full-stack & mobile developer, Victoria Falls; builds Codex at IT's No Matata.
- [IT's No Matata — itsnomatata.com](https://itsnomatata.com/) — **Benjamin McDonald**: website developer, designer, AI engineer & SEO specialist; **Thando Mpofu**: software developer on the marketing team page.
- [ITsNomatataDev — GitHub](https://github.com/ItsnomatataDev) — company engineering org; Codex flagship at codex.itsnomatata.com.

## Google Search Console checklist

1. **Deploy** the latest build to production (Vercel or your host).
2. Open [Google Search Console](https://search.google.com/search-console).
3. **Add property** → URL prefix: `https://codex.itsnomatata.com`
4. Verify ownership (HTML tag, DNS, or Google Analytics — DNS recommended if you control the domain).
5. **Sitemaps** → Submit: `https://codex.itsnomatata.com/sitemap.xml`
6. **URL inspection** → Test:
   - `https://codex.itsnomatata.com/`
   - `https://codex.itsnomatata.com/about`
   - `https://codex.itsnomatata.com/robots.txt`
7. Request indexing for `/` and `/about` once verification passes.

## Important notes for SPAs

- Most routes (`/dashboard`, `/admin/...`) are **behind login** and listed as `Disallow` in robots — correct for a private workspace.
- Google will primarily index **`/`**, **`/login`**, and **`/about`** — the about page carries the developer/company story for search.
- For richer SEO later, consider a marketing landing route or SSR for public pages only.

## Optional env

```env
VITE_PUBLIC_SITE_URL=https://codex.itsnomatata.com
```

Used by `src/config/seo.ts` for any future in-app meta updates.
