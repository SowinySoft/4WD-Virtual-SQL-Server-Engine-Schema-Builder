#!/usr/bin/env node

/**
 * schema-builder — CLI entry point & Express router
 * 
 * Usage:
 *   node index.js --serve              Start web server on port 4005
 *   node index.js --json '{"...'       Generate DDL from JSON design
 *   node index.js --file design.json   Generate DDL from JSON file
 *   node index.js --interactive        Interactive table designer (CLI)
 * 
 * Express routes:
 *   GET  /health                  Health check
 *   GET  /api/design              Schema builder web UI (serves public/index.html)
 *   POST /api/design/generate     Generate DDL from design object
 *   POST /api/design/build        Generate + execute DDL on target server
 *   GET  /api/design/engines      List supported engines and types
 *   GET  /api/design/templates/:type/:engine  Get code template
 */

'use strict';

const path = require('path');
const fs = require('fs');
const designer = require('./lib/designer');
const ddlGen = require('./lib/ddl-generator');
const translator = require('./lib/translator');
const builder = require('./lib/builder');
const templates = require('./lib/templates');
const config = require('./config');

// ─── CLI ───────────────────────────────────────────────────────────────
function runCLI() {
  const args = process.argv.slice(2);

  if (args.includes('--serve') || args.includes('-s')) {
    return startServer();
  }

  if (args.includes('--json') || args.includes('-j')) {
    const jsonIdx = args.indexOf('--json') !== -1 ? args.indexOf('--json') : args.indexOf('-j');
    const jsonStr = args[jsonIdx + 1];
    if (!jsonStr) {
      console.error('Error: --json requires a JSON string argument');
      process.exit(1);
    }
    try {
      const design = JSON.parse(jsonStr);
      const obj = designer.createDesignObject(design);
      const validation = designer.validateDesignObject(obj);
      if (!validation.valid) {
        console.error('Validation errors:', validation.errors.join(', '));
        process.exit(1);
      }
      const results = ddlGen.generateAllEngines(obj);
      for (const engine of translator.ENGINES) {
        console.log(`\n── ${translator.ENGINE_LABELS[engine]} ──`);
        console.log(results[engine].join('\n'));
      }
    } catch (err) {
      console.error('Error:', err.message);
      process.exit(1);
    }
    return;
  }

  if (args.includes('--file') || args.includes('-f')) {
    const fileIdx = args.indexOf('--file') !== -1 ? args.indexOf('--file') : args.indexOf('-f');
    const filePath = args[fileIdx + 1];
    if (!filePath) {
      console.error('Error: --file requires a file path');
      process.exit(1);
    }
    try {
      const jsonStr = fs.readFileSync(filePath, 'utf8');
      const design = JSON.parse(jsonStr);
      const obj = designer.createDesignObject(design);
      const validation = designer.validateDesignObject(obj);
      if (!validation.valid) {
        console.error('Validation errors:', validation.errors.join(', '));
        process.exit(1);
      }
      const results = ddlGen.generateAllEngines(obj);
      for (const engine of translator.ENGINES) {
        console.log(`\n── ${translator.ENGINE_LABELS[engine]} ──`);
        console.log(results[engine].join('\n'));
      }
    } catch (err) {
      console.error('Error:', err.message);
      process.exit(1);
    }
    return;
  }

  // Default: print help
  console.log(`
Schema Builder v1.0.0 — Multi-engine database schema designer

Usage:
  node index.js --serve              Start web server
  node index.js --json '<json>'      Generate DDL from JSON design
  node index.js --file design.json   Generate DDL from JSON file
  node index.js --help               Show this help

Examples:
  node index.js --json '{"objectType":"TABLE","name":"users","columns":[{"name":"id","type":"SERIAL","primaryKey":true},{"name":"email","type":"VARCHAR","length":255,"nullable":false}]}'
  `);
}

// ─── Express server ────────────────────────────────────────────────────
function startServer() {
  const express = require('express');
  const app = express();
  const port = process.env.PORT || config.server.port || 4005;

  app.use(express.json({ limit: '5mb' }));
  app.use('/static', express.static(path.join(__dirname, 'public')));
  app.use('/', require('./lib/routes'));

  app.listen(port, config.server.host || '0.0.0.0', () => {
    console.log(`Schema Builder v1.0.0 — http://localhost:${port}`);
    console.log(`Supports engines: ${translator.ENGINES.join(', ')}`);
  });
}

// ─── Entry ─────────────────────────────────────────────────────────────
if (require.main === module) {
  runCLI();
} else {
  module.exports = {
    router: require('./lib/routes'),
    designer,
    ddlGen,
    translator,
    builder,
    templates
  };
}
