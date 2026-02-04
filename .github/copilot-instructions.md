# Copilot / AI agent instructions — lakeland-health-insurance

This repo is a small, static marketing site (hand-authored HTML/CSS/JS). The goal of AI contributions is to be precise, minimal, and preserve the site's static structure.

- **Big picture**: pages are plain HTML in the repo root and `blog/`. Styles live in `css/`, images and other media in `assets/`, and small UI JavaScript in `main.js` and `js/blog.js`.
- **Hosting hint**: a `_headers` file exists at the repo root — this suggests Netlify-style static hosting. There is no `package.json` or build pipeline; changes are deployed as static files.

**What to edit and how**

- Add or change pages by editing or adding HTML files under the repo root or `blog/`. Example blog posts: `blog/5-critical-health-insurance-mistakes.html`.
- Keep paths and relative links consistent. The site uses relative linking extensively (no template engine), so moving files or renaming directories may break links.
- Media and icons should go into `assets/` and referenced with relative paths.

**Key patterns & examples**

- Menu toggle: `main.js` manipulates an element with id `dropdownMenu` and a button with class `menu-button`. Preserve those IDs/classes when editing the header markup.
- Footer year: `js/blog.js` sets the year into the element with id `current-year`. Use that id on footer markup to keep the dynamic year behavior.
- Article cards: blog list pages use `.article-card` elements and rely on `js/blog.js` for fade-in timing; avoid changing that class name without updating the script.

**Conventions & gotchas discovered**

- The repository has a directory named `our approach` (space in folder name). Avoid renaming it; many links are relative and expect that path.
- `sitemap.xml` is present — it's managed manually in this project. When adding pages, remember to update `sitemap.xml`.
- There is no automated test or CI configuration. Validate changes locally by running a static server (example command below) and spot-check pages in a browser.

**Local QA commands**

Run a quick local static server from the repo root:

```bash
python3 -m http.server 8000
# then open http://localhost:8000 in a browser
```

Search & follow patterns by example rather than introducing new frameworks. Small, focused changes are preferred over large refactors.

**When proposing code changes**

- Limit scope: change only the files necessary for the task. Keep HTML structure and class/ID names stable unless the change is intentional.
- If you need to introduce a build tool, document why, and provide a migration plan and minimal scripts (`package.json`) — do not add a build system silently.
- Update `sitemap.xml` and `_headers` (if needed) with any new public-facing pages.

If anything above is unclear or you want me to include additional, more-specific examples (page template snippet, canonical head meta, or common link patterns), tell me which area and I'll expand the instructions.
