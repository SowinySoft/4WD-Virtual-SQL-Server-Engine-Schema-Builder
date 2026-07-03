#!/usr/bin/env node
'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 4005;
const ROOT = __dirname;
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const VERSION = PKG.version;

app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: '4wd-vsse-schema-builder', version: VERSION });
});

// Static files — SPA
app.use('/static', express.static(path.join(ROOT, 'public')));

// Mount schema builder router (all /api/design/* routes)
const schemaBuilder = require('./index.js');
app.use('/', schemaBuilder.router);

// Landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(ROOT, 'public', 'index.html'));
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(ROOT, 'public', 'index.html'));
});

// Start
if (require.main === module) {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`4WD Virtual SQL Server Engine Schema Builder v${VERSION}`);
    console.log(`  Server: http://localhost:${PORT}`);
    console.log(`  API:    http://localhost:${PORT}/api/design/engines`);
  });
  server.on('error', (err) => {
    console.error(`Failed to start: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { app };
