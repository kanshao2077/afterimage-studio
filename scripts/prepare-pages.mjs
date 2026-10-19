// AFTERIMAGE GitHub Pages output preparation, 2026-10-19.
import { readFile, writeFile } from 'node:fs/promises';

const site = new URL(process.env.SITE_URL || 'https://kanshao2077.github.io/afterimage-studio/');
if (!site.pathname.endsWith('/')) site.pathname += '/';
const url = site.toString();
const escapeXml = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
await writeFile('dist/404.html', await readFile('dist/index.html'));
await writeFile('dist/.nojekyll', '');
await writeFile('dist/robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${new URL('sitemap.xml', site)}\n`);
await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${escapeXml(url)}</loc></url></urlset>\n`);
await writeFile('dist/llms.txt', `# AFTERIMAGE / 余像\n\nA minimal image and video dithering darkroom by 马路Milo.\nCanonical: ${url}\n30 algorithms, local media processing, color palettes, comparison and image/video export.\nAll media processing runs in the browser.\n`);
console.log(`Prepared GitHub Pages output for ${url}`);
