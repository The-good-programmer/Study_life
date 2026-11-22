/**
 * Post-build checks run in CI (npm run check:build): the service worker got a
 * build id, its routing table shipped, the avatar manifest only points at
 * files that exist, and a first visit downloads no more than the budget.
 */
import { existsSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const dist = 'dist';
const problems = [];
const sw = readFileSync(join(dist, 'sw.js'), 'utf8');
if (sw.includes('__BUILD_ID__') || !/const BUILD_ID = '[0-9a-f]{12}'/.test(sw)) problems.push('dist/sw.js has no build id');
for (const f of ['sw-routes.js', 'register-sw.js', 'index.html']) {
  if (!existsSync(join(dist, f))) problems.push(`dist/${f} is missing`);
}
const manifest = JSON.parse(readFileSync(join(dist, 'avatar', 'manifest.json'), 'utf8'));
const entries = [manifest.base, ...Object.values(manifest.items).flatMap((slot) => Object.values(slot))];
for (const entry of entries) {
  for (const url of Object.values(entry.files ?? {})) {
    if (!existsSync(join(dist, url))) problems.push(`avatar manifest points at a missing file: ${url}`);
  }
}
// The JavaScript a first visit downloads (the scripts index.html loads and preloads), compressed.
const FIRST_VISIT_BUDGET_KB = 200;
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const firstVisit = [...new Set([...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map((m) => m[1]))];
const firstVisitKb = Math.round(firstVisit.reduce((sum, file) => sum + gzipSync(readFileSync(join(dist, file))).length, 0) / 1024);
if (firstVisitKb > FIRST_VISIT_BUDGET_KB) {
  problems.push(`a first visit downloads ${firstVisitKb} KB of JavaScript (compressed), over the ${FIRST_VISIT_BUDGET_KB} KB budget. Load the new code when it's needed (React.lazy or import()).`);
}
if (problems.length) {
  console.error(problems.map((p) => `- ${p}`).join('\n'));
  process.exit(1);
}
console.log(`build ok (service worker ${/BUILD_ID = '([0-9a-f]+)'/.exec(sw)[1]}, ${entries.length} avatar entries, first visit ${firstVisitKb} KB of ${FIRST_VISIT_BUDGET_KB} KB)`);
