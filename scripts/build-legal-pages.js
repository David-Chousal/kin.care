/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderMarkdownToHtml(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');

  const out = [];
  let inUl = false;

  function closeUl() {
    if (inUl) out.push('</ul>');
    inUl = false;
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const t = line.trim();

    if (!t) {
      closeUl();
      continue;
    }

    const h1 = t.match(/^#\s+(.+)$/);
    if (h1) {
      closeUl();
      out.push(`<h1>${escapeHtml(h1[1])}</h1>`);
      continue;
    }

    const h2 = t.match(/^##\s+(.+)$/);
    if (h2) {
      closeUl();
      out.push(`<h2>${escapeHtml(h2[1])}</h2>`);
      continue;
    }

    const li = t.match(/^-\s+(.+)$/);
    if (li) {
      if (!inUl) out.push('<ul>');
      inUl = true;
      out.push(`<li>${escapeHtml(li[1])}</li>`);
      continue;
    }

    closeUl();
    out.push(`<p>${escapeHtml(t)}</p>`);
  }

  closeUl();
  return out.join('\n');
}

function wrapHtml({ title, bodyHtml }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light dark; }
      body { font-family: -apple-system, system-ui, Segoe UI, Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 24px; line-height: 1.55; }
      main { max-width: 860px; margin: 0 auto; }
      h1 { font-size: 28px; margin: 0 0 16px; letter-spacing: -0.02em; }
      h2 { font-size: 18px; margin: 22px 0 10px; letter-spacing: -0.01em; }
      p { margin: 0 0 12px; opacity: 0.92; }
      ul { margin: 0 0 14px 18px; padding: 0; }
      li { margin: 0 0 6px; }
      a { color: inherit; }
      .fineprint { opacity: 0.75; font-size: 13px; margin-top: 18px; }
    </style>
  </head>
  <body>
    <main>
${bodyHtml}
      <p class="fineprint">If you have trouble viewing this page, contact <a href="mailto:support@kin.care">support@kin.care</a>.</p>
    </main>
  </body>
</html>`;
}

function readText(p) {
  return fs.readFileSync(p, 'utf8');
}

function writeText(p, contents) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, contents, 'utf8');
}

function buildOne({ mdPath, outHtmlPath }) {
  const md = readText(mdPath);
  const firstHeading = (md.match(/^#\s+(.+)$/m) || [])[1] || 'Kin Legal';
  const bodyHtml = renderMarkdownToHtml(md)
    .split('\n')
    .map((l) => '      ' + l)
    .join('\n');
  const html = wrapHtml({ title: firstHeading, bodyHtml });
  writeText(outHtmlPath, html);
  console.log(`wrote ${path.relative(process.cwd(), outHtmlPath)}`);
}

function main() {
  const root = process.cwd();
  buildOne({
    mdPath: path.join(root, 'legal', 'privacy.md'),
    outHtmlPath: path.join(root, 'legal', 'dist', 'privacy.html'),
  });
  buildOne({
    mdPath: path.join(root, 'legal', 'terms.md'),
    outHtmlPath: path.join(root, 'legal', 'dist', 'terms.html'),
  });
}

main();

