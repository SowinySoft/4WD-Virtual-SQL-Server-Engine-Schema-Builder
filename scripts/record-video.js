#!/usr/bin/env node
'use strict';

// Automated VSSE Video Recording Script
// Uses puppeteer-core + Edge + FFmpeg to capture a 3-min walkthrough

const puppeteer = require('puppeteer-core');
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'recording');
const PORT = 4005;
const BASE = `http://localhost:${PORT}`;
const FPS = 1; // 1 screenshot per second → 180 frames for 3 min
const TOTAL_SECONDS = 180;

// Scene definitions: time (seconds) → action + text overlay
const SCENES = [
  { at: 0, label: '4WD Virtual SQL Server Engine — Schema Builder', wait: 500, action: 'home' },
  { at: 5, label: 'Design offline. Generate for 4 engines. Zero DB required.', wait: 500, action: null },
  { at: 10, label: 'The VSSE Pattern: treat DB engine as config, not a connection', wait: 500, action: null },

  { at: 18, label: 'Designer — add columns with types, PK, UK, FK', wait: 800, action: 'designer' },
  { at: 28, label: 'Toggle FK → REFERENCES panel at bottom with cascade controls', wait: 1000, action: 'toggle-fk' },
  { at: 38, label: 'Generate SQL — all 4 engines at once (PostgreSQL, MySQL, SQLite, MSSQL)', wait: 1000, action: 'generate' },
  { at: 50, label: 'DDL is dialect-translated automatically via ENGINE_TYPE_MAP', wait: 500, action: null },

  { at: 58, label: 'QBE Query Builder — drag tables onto the canvas', wait: 1000, action: 'qbe' },
  { at: 70, label: 'Select columns via chips, configure WHERE/GROUP/HAVING/ORDER', wait: 800, action: 'qbe-configure' },
  { at: 82, label: 'Auto-generated SQL with syntax validation badge', wait: 1000, action: 'qbe-generate' },
  { at: 92, label: 'ER Diagram — visual schema from local tree data', wait: 1000, action: 'er' },

  { at: 104, label: 'Clean architecture: design layer has ZERO DB drivers', wait: 500, action: 'home' },
  { at: 110, label: 'lib/designer.js, lib/translator.js, lib/ddl-generator.js — pure JS', wait: 500, action: null },
  { at: 118, label: 'Only builder.js imports DB drivers — and only on explicit request', wait: 500, action: null },
  { at: 126, label: 'The Dry-Run First flow: design → generate → dry-run → deploy', wait: 500, action: null },

  { at: 134, label: 'Type maps: VARCHAR, SERIAL, UUID translated per engine', wait: 500, action: 'engines' },
  { at: 144, label: 'Tree browser with localStorage persistence', wait: 500, action: 'tree' },
  { at: 152, label: 'Save to tree → edit → re-generate — full round trip', wait: 500, action: null },
  { at: 162, label: 'Export SQL with engine detection on import', wait: 500, action: null },
  { at: 170, label: 'Ready for production. Deploy on Railway with one command.', wait: 500, action: null },
  { at: 176, label: 'github.com/SowinySoft/4WD-Virtual-SQL-Server-Engine-Schema-Builder', wait: 1000, action: null },
];

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('=== VSSE Video Recording Script ===\n');

  // Clean output directory
  if (fs.existsSync(OUT_DIR)) fs.rmSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Kill old server
  try { execSync(`netstat -ano | findstr ":${PORT}"`, { shell:'powershell.exe' }); } catch(e) {}
  await sleep(1000);

  // Start server
  console.log('Starting server...');
  const server = spawn('node', ['server.js'], {
    cwd: path.join(__dirname, '..'),
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true
  });
  server.stdout.on('data', d => process.stdout.write(`[server] ${d}`));
  server.stderr.on('data', d => process.stderr.write(`[server-err] ${d}`));

  // Wait for server ready
  await sleep(3000);

  // Launch browser
  console.log('Launching Edge...');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1920,1080']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  let sceneIdx = 0;
  let lastSceneAction = '';

  console.log(`Recording ${TOTAL_SECONDS} frames at ${FPS} FPS...\n`);

  for (let t = 0; t < TOTAL_SECONDS; t++) {
    // Check if we need to perform an action at this timestamp
    while (sceneIdx < SCENES.length && t >= SCENES[sceneIdx].at) {
      const scene = SCENES[sceneIdx];
      if (scene.action && scene.action !== lastSceneAction) {
        try {
          await performAction(page, scene.action);
          await sleep(scene.wait || 500);
          lastSceneAction = scene.action;
        } catch(e) {
          console.error(`[action error at ${t}s: ${scene.action}] ${e.message}`);
        }
      }
      sceneIdx++;
    }

    // Take screenshot
    const frameFile = path.join(OUT_DIR, `frame_${String(t).padStart(4,'0')}.png`);
    await page.screenshot({ path: frameFile, type: 'png' });

    // Progress indicator
    if (t % 10 === 0) process.stdout.write(`  ${t}/${TOTAL_SECONDS}s (${Math.round(t/TOTAL_SECONDS*100)}%)\n`);
  }

  console.log('\nAll frames captured. Generating video...');

  // Close browser
  await browser.close();
  server.kill();

  // Use FFmpeg to create video from frames with text overlays
  const outputMp4 = path.join(__dirname, '..', 'vsse-demo.mp4');
  const ffmpegCmd = `ffmpeg -y -framerate ${FPS} -i "${OUT_DIR}\\frame_%04d.png" -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -vf "scale=1920:1080" "${outputMp4}"`;

  console.log('Running FFmpeg...');
  try {
    execSync(ffmpegCmd, { stdio: 'pipe', timeout: 120000 });
    const stats = fs.statSync(outputMp4);
    console.log(`\n✅ Video created: ${outputMp4}`);
    console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(1)} MB`);
    console.log(`   Duration: ${TOTAL_SECONDS}s at ${FPS} FPS`);
    console.log(`   Resolution: 1920x1080`);
  } catch(e) {
    console.error(`FFmpeg failed: ${e.message}`);
  }

  // Cleanup frames
  try { fs.rmSync(OUT_DIR, { recursive: true }); } catch(e) {}

  console.log('\nDone.');
}

async function performAction(page, action) {
  switch(action) {
    case 'home':
      await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 15000 });
      break;

    case 'designer':
      await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 15000 });
      await sleep(1000);
      // Click Designer tab (first mode-toggle button)
      await page.evaluate(() => {
        const btns = document.querySelectorAll('.mode-toggle button');
        if (btns[0]) btns[0].click();
      });
      await sleep(500);
      break;

    case 'toggle-fk':
      // Enable FK on first column
      await page.evaluate(() => {
        if (typeof toggleFK === 'function') toggleFK(0, true);
      });
      await sleep(300);
      // Set ref table/column
      await page.evaluate(() => {
        if (typeof updateCol === 'function') {
          updateCol(0, 'refTable', 'roles');
          updateCol(0, 'refColumn', 'id');
        }
      });
      await sleep(500);
      break;

    case 'generate':
      await page.evaluate(() => {
        if (typeof generatePreview === 'function') generatePreview();
      });
      await sleep(1500);
      break;

    case 'qbe':
      await page.evaluate(() => {
        const btns = document.querySelectorAll('.mode-toggle button');
        if (btns[1]) btns[1].click();
      });
      await sleep(1500);
      break;

    case 'qbe-configure':
      // Add some where conditions and order
      await page.evaluate(() => {
        if (typeof qbeAddWhere === 'function') {
          qbeAddWhere('users.is_active', '=', 'TRUE');
        }
        if (typeof qbeAddOrderBy === 'function') qbeAddOrderBy();
      });
      await sleep(1000);
      break;

    case 'qbe-generate':
      await page.evaluate(() => {
        if (typeof qbeGenerateNow === 'function') qbeGenerateNow();
      });
      await sleep(1500);
      break;

    case 'er':
      await page.evaluate(() => {
        const btns = document.querySelectorAll('.mode-toggle button');
        if (btns[2]) btns[2].click();
      });
      await sleep(2000);
      break;

    case 'engines':
      // Hit the engines API endpoint
      await page.goto(`${BASE}/api/design/engines`, { waitUntil: 'networkidle2', timeout: 10000 });
      break;

    case 'tree':
      await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 15000 });
      await sleep(500);
      // Toggle tree items
      await page.evaluate(() => {
        const treeArrows = document.querySelectorAll('.tree-arrow');
        if (treeArrows.length > 0) treeArrows[0].click();
      });
      await sleep(500);
      break;

    default:
      break;
  }
  await sleep(500);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
