#!/usr/bin/env node
'use strict';

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4005;
const ROOT = __dirname;

app.use(express.json({ limit: '10mb' }));
app.use('/static', express.static(path.join(ROOT, 'public')));
app.use('/', require('./lib/routes'));

if (require.main === module) {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`4WD Virtual SQL Server Engine Schema Builder v1.0.0`);
    console.log(`  Server: http://localhost:${PORT}`);
    console.log(`  API:    http://localhost:${PORT}/api/design/engines`);
  });
  server.on('error', (err) => {
    console.error(`Failed to start: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { app };
