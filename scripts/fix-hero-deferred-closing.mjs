#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const BLOG = join(resolve(import.meta.dirname, '..'), 'blog');
const broken = /(<div class="lhi-hero-deferred-block">[\s\S]*?)<div class="meta">By David Huff, licensed Florida health agent #W371813 \| NPN 18213932\s*\n<\/div>\s*\n\s*<\/div>\s*\n<\/section>\s*\n<\/div>/g;
const fixed = `$1<div class="meta">By David Huff, licensed Florida health agent #W371813 | NPN 18213932</div>
</div>
  </div>
</section>
</div>`;

let n = 0;
for (const name of readdirSync(BLOG).filter((f) => f.endsWith('.html'))) {
  const path = join(BLOG, name);
  const html = readFileSync(path, 'utf8');
  if (!html.includes('lhi-hero-deferred-block')) continue;
  const next = html.replace(broken, fixed);
  if (next !== html) {
    writeFileSync(path, next);
    n += 1;
  }
}
console.log(`fixed deferred closing in ${n} files`);
