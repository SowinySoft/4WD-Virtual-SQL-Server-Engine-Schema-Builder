#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const MD_FILE = path.join(__dirname, '..', 'docs', 'VIRTUAL_SQL_SERVER_ENGINE_PAPER.md');
const PDF_FILE = path.join(__dirname, '..', 'docs', 'VIRTUAL_SQL_SERVER_ENGINE_PAPER.pdf');

const md = fs.readFileSync(MD_FILE, 'utf8');

function mdToHtml(md) {
  let html = '';
  const lines = md.split('\n');
  let inCodeBlock = false;
  let codeBuf = [];
  let inTable = false;
  let tableBuf = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        html += `<pre class="code-block">${escHtml(codeBuf.join('\n'))}</pre>\n`;
        codeBuf = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeBuf = [];
      }
      continue;
    }
    if (inCodeBlock) {
      codeBuf.push(line);
      continue;
    }

    // Horizontal rule
    if (/^---+\s*$/.test(line)) {
      html += '<hr>\n';
      continue;
    }

    // Headers
    const hMatch = line.match(/^(#{1,4})\s+(.+)/);
    if (hMatch) {
      const level = hMatch[1].length;
      const text = hMatch[2].replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      html += `<h${level}>${text}</h${level}>\n`;
      continue;
    }

    // Table rows
    if (line.startsWith('|') && line.endsWith('|') && line.includes('|')) {
      // Check if it's a separator row
      if (/^\|[\s:-]+\|[\s:-]+\|/.test(line)) {
        continue; // skip separator
      }
      const cells = line.split('|').filter(c => c.trim()).map(c => c.trim());
      if (!inTable) {
        inTable = true;
        tableBuf = [];
      }
      tableBuf.push(cells);
      continue;
    } else {
      if (inTable) {
        html += renderTable(tableBuf);
        inTable = false;
        tableBuf = [];
      }
    }

    // Unordered lists
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.+)/);
    if (ulMatch) {
      const indent = ulMatch[1].length;
      const text = ulMatch[2].replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`(.+?)`/g, '<code>$1</code>');
      html += `<li>${text}</li>\n`;
      continue;
    }

    // Inline code, bold, and escaped pipe handling for paragraph text
    let processed = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                       .replace(/`(.+?)`/g, '<code>$1</code>')
                       .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');

    if (line.trim() === '') {
      html += '\n';
    } else {
      html += `<p>${processed}</p>\n`;
    }
  }

  if (inTable) html += renderTable(tableBuf);
  if (inCodeBlock) html += `<pre class="code-block">${escHtml(codeBuf.join('\n'))}</pre>\n`;

  return html;
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderTable(rows) {
  let h = '<table>\n';
  // First row as header
  if (rows.length > 0) {
    h += '  <thead><tr>';
    for (const cell of rows[0]) {
      h += `<th>${escHtml(cell)}</th>`;
    }
    h += '</tr></thead>\n';
  }
  if (rows.length > 1) {
    h += '  <tbody>\n';
    for (let i = 1; i < rows.length; i++) {
      h += '    <tr>';
      for (const cell of rows[i]) {
        h += `<td>${escHtml(cell.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'))}</td>`;
      }
      h += '</tr>\n';
    }
    h += '  </tbody>\n';
  }
  h += '</table>\n';
  return h;
}

const content = mdToHtml(md);

const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Virtual SQL Server Engine (VSSE) — A New Architectural Pattern</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Inter', -apple-system, sans-serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #1a1a2e;
    max-width: 800px;
    margin: 0 auto;
    padding: 60px 60px 80px;
  }
  h1 { font-size: 22pt; font-weight: 700; margin-top: 0; margin-bottom: 6pt; color: #0f0c29; }
  h2 { font-size: 15pt; font-weight: 600; margin-top: 28pt; margin-bottom: 10pt; color: #0f0c29; border-bottom: 2px solid #e2e8f0; padding-bottom: 4pt; }
  h3 { font-size: 12pt; font-weight: 600; margin-top: 20pt; margin-bottom: 8pt; color: #302b63; }
  h4 { font-size: 11pt; font-weight: 600; margin-top: 16pt; margin-bottom: 6pt; color: #302b63; }
  p { margin-bottom: 8pt; }
  strong { font-weight: 600; color: #0f0c29; }
  code {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9.5pt;
    background: #f1f5f9;
    padding: 1pt 4pt;
    border-radius: 3px;
    color: #b91c1c;
  }
  pre.code-block {
    font-family: 'JetBrains Mono', monospace;
    font-size: 8.5pt;
    line-height: 1.45;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 5px;
    padding: 12pt 14pt;
    overflow-x: auto;
    margin: 10pt 0;
    white-space: pre-wrap;
    color: #1e293b;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 10pt 0;
    font-size: 9.5pt;
  }
  th {
    background: #f1f5f9;
    font-weight: 600;
    text-align: left;
    padding: 6pt 8pt;
    border: 1px solid #cbd5e1;
    color: #0f0c29;
  }
  td {
    padding: 5pt 8pt;
    border: 1px solid #e2e8f0;
    vertical-align: top;
  }
  tr:nth-child(even) td { background: #fafafa; }
  hr { border: none; border-top: 2px solid #e2e8f0; margin: 20pt 0; }
  li { margin-bottom: 4pt; margin-left: 20pt; }
  a { color: #2563eb; text-decoration: none; }
  .meta {
    font-size: 10pt;
    color: #64748b;
    margin-bottom: 24pt;
    line-height: 1.8;
  }
  .meta strong { color: #475569; }
  .abstract-box {
    background: #f0f9ff;
    border-left: 4px solid #2563eb;
    padding: 12pt 16pt;
    margin: 16pt 0;
    border-radius: 0 5px 5px 0;
  }
  .abstract-box p { margin-bottom: 0; font-style: italic; color: #1e40af; }
  @media print {
    body { padding: 0; max-width: none; }
    pre.code-block { break-inside: avoid; }
    table { break-inside: avoid; }
    h2, h3 { break-after: avoid; }
  }
</style>
</head>
<body>
${content}
</body>
</html>`;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(HTML_TEMPLATE, { waitUntil: 'networkidle' });
  await page.pdf({
    path: PDF_FILE,
    format: 'A4',
    margin: { top: '25mm', bottom: '25mm', left: '20mm', right: '20mm' },
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: '<div style="width:100%;text-align:center;font-size:8pt;color:#94a3b8;"><span class="pageNumber"></span></div>',
  });
  await browser.close();
  console.log('PDF generated: ' + PDF_FILE);
})();
