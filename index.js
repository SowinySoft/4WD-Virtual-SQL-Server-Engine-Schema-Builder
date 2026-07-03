#!/usr/bin/env node

/**
 * schema-builder — CLI entry point & Express router
 * 
 * Usage:
 *   node index.js --serve              Start web server on port 3005
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
  const port = process.env.PORT || config.server.port || 3005;

  app.use(express.json({ limit: '5mb' }));
  app.use(express.static(path.join(__dirname, 'public')));

  // Health
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'schema-builder', version: '1.0.0' });
  });

  // API: List supported engines + their types
  app.get('/api/design/engines', (req, res) => {
    const engineData = {};
    for (const engine of translator.ENGINES) {
      engineData[engine] = {
        label: translator.ENGINE_LABELS[engine],
        types: config.typeMappings[engine] || []
      };
    }
    res.json({
      success: true,
      data: {
        engines: engineData,
        objectTypes: ['SCHEMA', 'TABLE', 'VIEW', 'FUNCTION', 'PROCEDURE', 'TRIGGER', 'ROLE'],
        typeCategories: config.typeCategories || {}
      }
    });
  });

  // API: Generate DDL from design object
  app.post('/api/design/generate', (req, res) => {
    try {
      const { design, engine } = req.body;
      if (!design) {
        return res.status(400).json({ success: false, error: { message: 'Missing "design" in request body' } });
      }

      const obj = designer.createDesignObject(design);
      const validation = designer.validateDesignObject(obj);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: { message: 'Validation failed', details: validation.errors }
        });
      }

      if (engine && translator.ENGINES.includes(engine)) {
        // Single engine
        const stmts = ddlGen.generateDDL(obj, engine);
        return res.json({ success: true, data: { engine, statements: stmts, sql: stmts.join('\n') } });
      }

      // All engines
      const allStmts = ddlGen.generateAllEngines(obj);
      const result = {};
      for (const eng of translator.ENGINES) {
        result[eng] = {
          label: translator.ENGINE_LABELS[eng],
          statements: allStmts[eng],
          sql: allStmts[eng].join('\n')
        };
      }
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: { message: err.message } });
    }
  });

  // API: Generate + Build (execute on target server)
  app.post('/api/design/build', async (req, res) => {
    try {
      const { design, target } = req.body;
      if (!design) {
        return res.status(400).json({ success: false, error: { message: 'Missing "design" in request body' } });
      }
      if (!target || !target.engine) {
        return res.status(400).json({ success: false, error: { message: 'Missing "target.engine" (which database to build on)' } });
      }

      const obj = designer.createDesignObject(design);
      const validation = designer.validateDesignObject(obj);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: { message: 'Validation failed', details: validation.errors }
        });
      }

      // Generate DDL
      const stmts = ddlGen.generateDDL(obj, target.engine);
      const sql = stmts.join('\n');

      // Execute
      const buildConfig = {
        engine: target.engine,
        host: target.host,
        port: target.port,
        database: target.database,
        user: target.user,
        password: target.password,
        dryRun: target.dryRun || false
      };

      const results = await builder.build(stmts, buildConfig);

      res.json({
        success: true,
        data: {
          engine: target.engine,
          sql,
          statements: stmts,
          results
        }
      });
    } catch (err) {
      res.status(500).json({ success: false, error: { message: err.message } });
    }
  });

  // API: Get code template
  app.get('/api/design/templates/:type/:engine', (req, res) => {
    const { type, engine } = req.params;
    const upperType = type.toUpperCase();
    const lowerEngine = engine.toLowerCase();

    if (!['VIEW', 'FUNCTION', 'PROCEDURE', 'TRIGGER'].includes(upperType)) {
      return res.status(400).json({ success: false, error: { message: `Unsupported type "${type}". Supported: VIEW, FUNCTION, PROCEDURE, TRIGGER` } });
    }
    if (!translator.ENGINES.includes(lowerEngine)) {
      return res.status(400).json({ success: false, error: { message: `Unsupported engine "${engine}"` } });
    }

    const tmpl = templates.getTemplate(upperType, lowerEngine);
    res.json({ success: true, data: { type: upperType, engine: lowerEngine, template: tmpl } });
  });

  // API: Explain (query execution plan)
  app.post('/api/design/explain', async (req, res) => {
    try {
      const { sql, target, analyze } = req.body;
      if (!sql) return res.status(400).json({ success: false, error: { message: 'Missing "sql" in request body' } });
      if (!target || !target.engine) {
        return res.status(400).json({ success: false, error: { message: 'Missing target.engine' } });
      }
      const results = await builder.explainQuery(sql, target, !!analyze);
      res.json({ success: true, data: { results, analyze: !!analyze, engine: target.engine } });
    } catch (err) {
      res.status(500).json({ success: false, error: { message: err.message } });
    }
  });

  // API: Execute SQL directly (not EXPLAIN)
  app.post('/api/design/execute', async (req, res) => {
    try {
      const { sql, target } = req.body;
      if (!sql) return res.status(400).json({ success: false, error: { message: 'Missing "sql" in request body' } });
      if (!target || !target.engine) {
        return res.status(400).json({ success: false, error: { message: 'Missing target.engine' } });
      }
      const result = await builder.executeQuery(sql, target);
      res.json({ success: !result.error, data: result, engine: target.engine });
    } catch (err) {
      res.status(500).json({ success: false, error: { message: err.message } });
    }
  });

  // API: Validate design object
  app.post('/api/design/validate', (req, res) => {
    try {
      const { design } = req.body;
      if (!design) {
        return res.status(400).json({ success: false, error: { message: 'Missing "design" in request body' } });
      }
      const obj = designer.createDesignObject(design);
      const validation = designer.validateDesignObject(obj);
      res.json({ success: true, data: { valid: validation.valid, errors: validation.errors } });
    } catch (err) {
      res.status(500).json({ success: false, error: { message: err.message } });
    }
  });

  // API: Schema introspection
  app.post('/api/design/schema-tables', async (req, res) => {
    try {
      const { target } = req.body;
      if (!target || !target.engine) return res.status(400).json({ success: false, error: { message: 'Missing target.engine' } });
      const tables = await builder.introspectTables(target);
      res.json({ success: true, data: { tables, engine: target.engine } });
    } catch (err) {
      res.status(500).json({ success: false, error: { message: err.message } });
    }
  });

  // API: Query Build
  app.post('/api/design/query-build', (req, res) => {
    try {
      const { qbe, engine: eng } = req.body;
      if (!qbe) return res.status(400).json({ success: false, error: { message: 'Missing qbe' } });
      if (!eng) return res.status(400).json({ success: false, error: { message: 'Missing engine' } });
      const engine = eng.toLowerCase();
      const qChar = engine === 'mysql' ? '`' : '"';
      const quote = (n) => n ? qChar + n.replace(new RegExp(qChar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), qChar + qChar) + qChar : '';
      const qual = (t, c) => (t ? quote(t) + '.' : '') + quote(c);

      const fromParts = [];
      if (qbe.tables && qbe.tables.length > 0) {
        for (const t of qbe.tables) {
          let entry = quote(t.schema) + '.' + quote(t.name);
          if (t.alias) entry += ' AS ' + quote(t.alias);
          fromParts.push(entry);
        }
      }
      if (fromParts.length === 0) return res.json({ success: true, data: { sql: '-- No tables selected', valid: true } });

      let fromSql = fromParts[0];
      const joins = qbe.joins || [];
      for (let i = 1; i < fromParts.length; i++) {
        const join = joins[i - 1];
        fromSql += join && join.type && join.condition
          ? `\n  ${join.type.toUpperCase()} JOIN ${fromParts[i]} ON ${join.condition}`
          : `\n  CROSS JOIN ${fromParts[i]}`;
      }

      const selCols = (qbe.columns && qbe.columns.length > 0)
        ? qbe.columns.map(c => {
            const qn = c.expression || (c.table ? qual(c.table, c.column) : quote(c.column));
            return c.alias ? qn + ' AS ' + quote(c.alias) : qn;
          }).join(',\n  ')
        : '  *';

      let whereSql = '';
      if (qbe.where && qbe.where.length > 0) {
        const parts = qbe.where.map((w, idx) => {
          const cond = w.expression || `${w.table ? qual(w.table, w.field) : quote(w.field)} ${w.operator || '='} ${w.value || '?'}`;
          return (idx === 0) ? `  ${cond}` : `  ${w.logic || 'AND'} ${cond}`;
        });
        whereSql = '\nWHERE ' + parts.join('\n');
      }

      let groupSql = '';
      if (qbe.groupBy && qbe.groupBy.length > 0) {
        groupSql = '\nGROUP BY ' + qbe.groupBy.map(g => g.expression || (g.table ? qual(g.table, g.column) : quote(g.column))).join(', ');
      }

      let havingSql = '';
      if (qbe.having && qbe.having.length > 0) {
        havingSql = '\nHAVING ' + qbe.having.map((h, idx) => {
          const cond = h.expression || `${h.field} ${h.operator || '>'} ${h.value || '?'}`;
          return (idx === 0) ? `  ${cond}` : `  ${h.logic || 'AND'} ${cond}`;
        }).join('\n');
      }

      let orderSql = '';
      if (qbe.orderBy && qbe.orderBy.length > 0) {
        orderSql = '\nORDER BY ' + qbe.orderBy.map(o => {
          if (o.expression) return o.expression + (o.direction ? ' ' + o.direction : '');
          return (o.table ? qual(o.table, o.column) : quote(o.column)) + ' ' + (o.direction || 'ASC');
        }).join(', ');
      }

      let limitSql = '';
      if (qbe.limit && qbe.limit > 0) {
        if (engine === 'mysql' || engine === 'sqlite') {
          limitSql = '\nLIMIT ' + qbe.limit + (qbe.offset > 0 ? ' OFFSET ' + qbe.offset : '');
        } else if (engine === 'mssql' && qbe.offset > 0) {
          limitSql = `\nOFFSET ${qbe.offset} ROWS FETCH NEXT ${qbe.limit} ROWS ONLY`;
        } else if (engine === 'mssql') {
          // handled via SELECT TOP below
        } else {
          limitSql = '\nLIMIT ' + qbe.limit + (qbe.offset > 0 ? ' OFFSET ' + qbe.offset : '');
        }
      }

      let unionSql = '';
      if (qbe.union && qbe.union.type && qbe.union.sql) {
        unionSql = `\n${qbe.union.type.toUpperCase()}\n${qbe.union.sql}`;
      }

      let sql = '';
      const qt = (qbe.queryType || 'SELECT').toUpperCase();

      if (qt === 'SELECT') {
        if (engine === 'mssql' && qbe.limit > 0 && !(qbe.offset > 0)) {
          sql = 'SELECT TOP ' + qbe.limit + '\n  ' + selCols + '\nFROM ' + fromSql;
        } else {
          sql = 'SELECT\n  ' + selCols + '\nFROM ' + fromSql;
        }
        sql += whereSql + groupSql + havingSql + orderSql + limitSql + unionSql;
      } else if (qt === 'INSERT') {
        const t = qbe.tables?.[0];
        if (!t) return res.json({ success: true, data: { sql: '-- Select a table for INSERT', valid: false } });
        const cols = (qbe.columns || []).map(c => quote(c.column)).join(', ');
        const vals = (qbe.columns || []).map(() => '?').join(', ');
        sql = `INSERT INTO ${quote(t.schema)}.${quote(t.name)} (${cols})\nVALUES (${vals})` + unionSql;
      } else if (qt === 'UPDATE') {
        const t = qbe.tables?.[0];
        if (!t) return res.json({ success: true, data: { sql: '-- Select a table for UPDATE', valid: false } });
        sql = 'UPDATE ' + quote(t.schema) + '.' + quote(t.name) + '\nSET ' + (qbe.columns || []).map(c => quote(c.column) + ' = ?').join(',\n    ') + whereSql + unionSql;
      } else if (qt === 'DELETE') {
        const t = qbe.tables?.[0];
        if (!t) return res.json({ success: true, data: { sql: '-- Select a table for DELETE', valid: false } });
        sql = 'DELETE FROM ' + quote(t.schema) + '.' + quote(t.name) + whereSql + unionSql;
      }

      res.json({ success: true, data: { sql, valid: true, engine } });
    } catch (err) {
      res.status(500).json({ success: false, error: { message: err.message } });
    }
  });

  // Catch-all: serve the web UI
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  app.listen(port, config.server.host || '0.0.0.0', () => {
    console.log(`Schema Builder v1.0.0 — http://localhost:${port}`);
    console.log(`Supports engines: ${translator.ENGINES.join(', ')}`);
  });
}

// ─── Entry ─────────────────────────────────────────────────────────────
if (require.main === module) {
  runCLI();
} else {
  // Export Express router for integration into pentagon-tools-web
  const express = require('express');
  const router = express.Router();

  router.get('/api/design/engines', (req, res) => {
    const engineData = {};
    for (const engine of translator.ENGINES) {
      engineData[engine] = {
        label: translator.ENGINE_LABELS[engine],
        types: config.typeMappings[engine] || []
      };
    }
    res.json({
      success: true,
      data: {
        engines: engineData,
        objectTypes: ['SCHEMA', 'TABLE', 'VIEW', 'FUNCTION', 'PROCEDURE', 'TRIGGER', 'ROLE'],
        typeCategories: config.typeCategories || {}
      }
    });
  });

  router.post('/api/design/generate', (req, res) => {
    try {
      const { design, engine } = req.body;
      if (!design) return res.status(400).json({ success: false, error: { message: 'Missing design' } });
      const obj = designer.createDesignObject(design);
      const validation = designer.validateDesignObject(obj);
      if (!validation.valid) {
        return res.status(400).json({ success: false, error: { message: 'Validation failed', details: validation.errors } });
      }
      if (engine && translator.ENGINES.includes(engine)) {
        const stmts = ddlGen.generateDDL(obj, engine);
        return res.json({ success: true, data: { engine, statements: stmts, sql: stmts.join('\n') } });
      }
      const allStmts = ddlGen.generateAllEngines(obj);
      const result = {};
      for (const eng of translator.ENGINES) {
        result[eng] = { label: translator.ENGINE_LABELS[eng], statements: allStmts[eng], sql: allStmts[eng].join('\n') };
      }
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: { message: err.message } });
    }
  });

  router.post('/api/design/build', async (req, res) => {
    try {
      const { design, target } = req.body;
      if (!design || !target?.engine) {
        return res.status(400).json({ success: false, error: { message: 'Missing design or target.engine' } });
      }
      const obj = designer.createDesignObject(design);
      const validation = designer.validateDesignObject(obj);
      if (!validation.valid) {
        return res.status(400).json({ success: false, error: { message: 'Validation failed', details: validation.errors } });
      }
      const stmts = ddlGen.generateDDL(obj, target.engine);
      const results = await builder.build(stmts, {
        engine: target.engine,
        host: target.host, port: target.port, database: target.database,
        user: target.user, password: target.password, dryRun: target.dryRun || false
      });
      res.json({ success: true, data: { engine: target.engine, sql: stmts.join('\n'), statements: stmts, results } });
    } catch (err) {
      res.status(500).json({ success: false, error: { message: err.message } });
    }
  });

  router.post('/api/design/explain', async (req, res) => {
    try {
      const { sql, target, analyze } = req.body;
      if (!sql) return res.status(400).json({ success: false, error: { message: 'Missing sql' } });
      if (!target?.engine) return res.status(400).json({ success: false, error: { message: 'Missing target.engine' } });
      const results = await builder.explainQuery(sql, target, !!analyze);
      res.json({ success: true, data: { results, analyze: !!analyze, engine: target.engine } });
    } catch (err) {
      res.status(500).json({ success: false, error: { message: err.message } });
    }
  });

  router.post('/api/design/execute', async (req, res) => {
    try {
      const { sql, target } = req.body;
      if (!sql) return res.status(400).json({ success: false, error: { message: 'Missing sql' } });
      if (!target?.engine) return res.status(400).json({ success: false, error: { message: 'Missing target.engine' } });
      const result = await builder.executeQuery(sql, target);
      res.json({ success: !result.error, data: result, engine: target.engine });
    } catch (err) {
      res.status(500).json({ success: false, error: { message: err.message } });
    }
  });

  router.post('/api/design/validate', (req, res) => {
    try {
      const { design } = req.body;
      if (!design) return res.status(400).json({ success: false, error: { message: 'Missing design' } });
      const obj = designer.createDesignObject(design);
      const validation = designer.validateDesignObject(obj);
      res.json({ success: true, data: { valid: validation.valid, errors: validation.errors } });
    } catch (err) {
      res.status(500).json({ success: false, error: { message: err.message } });
    }
  });

  router.get('/api/design/templates/:type/:engine', (req, res) => {
    const { type, engine } = req.params;
    const upperType = type.toUpperCase();
    const lowerEngine = engine.toLowerCase();
    if (!['VIEW', 'FUNCTION', 'PROCEDURE', 'TRIGGER'].includes(upperType)) {
      return res.status(400).json({ success: false, error: { message: `Unsupported type "${type}"` } });
    }
    if (!translator.ENGINES.includes(lowerEngine)) {
      return res.status(400).json({ success: false, error: { message: `Unsupported engine "${engine}"` } });
    }
    const tmpl = templates.getTemplate(upperType, lowerEngine);
    res.json({ success: true, data: { type: upperType, engine: lowerEngine, template: tmpl } });
  });

  // API: Schema introspection (list all tables, columns, FKs)
  router.post('/api/design/schema-tables', async (req, res) => {
    try {
      const { target } = req.body;
      if (!target || !target.engine) {
        return res.status(400).json({ success: false, error: { message: 'Missing target.engine' } });
      }
      const tables = await builder.introspectTables(target);
      res.json({ success: true, data: { tables, engine: target.engine } });
    } catch (err) {
      res.status(500).json({ success: false, error: { message: err.message } });
    }
  });

  // API: Query Build — generate SQL from QBE state
  router.post('/api/design/query-build', (req, res) => {
    try {
      const { qbe, engine: eng } = req.body;
      if (!qbe) return res.status(400).json({ success: false, error: { message: 'Missing "qbe" state' } });
      if (!eng) return res.status(400).json({ success: false, error: { message: 'Missing "engine"' } });
      const engine = eng.toLowerCase();

      // Quote character per engine
      const qChar = engine === 'mysql' ? '`' : '"';
      const quote = (name) => {
        if (!name) return '';
        const esc = name.replace(new RegExp(qChar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), qChar + qChar);
        return qChar + esc + qChar;
      };
      const qual = (t, c) => (t ? quote(t) + '.' : '') + quote(c);

      // Build FROM clause
      const fromParts = [];
      if (qbe.tables && qbe.tables.length > 0) {
        for (const t of qbe.tables) {
          let entry = quote(t.schema) + '.' + quote(t.name);
          if (t.alias) entry += ' AS ' + quote(t.alias);
          fromParts.push(entry);
        }
      } else {
        return res.json({ success: true, data: { sql: '-- No tables selected', valid: true } });
      }

      // Build JOIN clauses
      let fromSql = fromParts[0];
      const joins = qbe.joins || [];
      for (let i = 1; i < fromParts.length; i++) {
        const join = joins[i - 1];
        if (join && join.type && join.condition) {
          fromSql += `\n  ${join.type.toUpperCase()} JOIN ${fromParts[i]} ON ${join.condition}`;
        } else {
          fromSql += `\n  CROSS JOIN ${fromParts[i]}`;
        }
      }

      // Build SELECT columns
      const selCols = (qbe.columns && qbe.columns.length > 0)
        ? qbe.columns.map(c => {
            const qn = c.expression || (c.table ? qual(c.table, c.column) : quote(c.column));
            return c.alias ? qn + ' AS ' + quote(c.alias) : qn;
          }).join(',\n  ')
        : '  *';

      // Build WHERE
      let whereSql = '';
      if (qbe.where && qbe.where.length > 0) {
        const parts = qbe.where.map((w, idx) => {
          let cond;
          if (w.expression) {
            cond = w.expression;
          } else {
            const field = w.table ? qual(w.table, w.field) : quote(w.field);
            const op = w.operator || '=';
            const val = w.value || '?';
            cond = `${field} ${op} ${val}`;
          }
          return (idx === 0) ? `  ${cond}` : `  ${w.logic || 'AND'} ${cond}`;
        });
        whereSql = '\nWHERE ' + parts.join('\n');
      }

      // Build GROUP BY
      let groupSql = '';
      if (qbe.groupBy && qbe.groupBy.length > 0) {
        groupSql = '\nGROUP BY ' + qbe.groupBy.map(g => {
          if (g.expression) return g.expression;
          return g.table ? qual(g.table, g.column) : quote(g.column);
        }).join(', ');
      }

      // Build HAVING
      let havingSql = '';
      if (qbe.having && qbe.having.length > 0) {
        havingSql = '\nHAVING ' + qbe.having.map((h, idx) => {
          const cond = h.expression || `${h.field} ${h.operator || '>'} ${h.value || '?'}`;
          return (idx === 0) ? `  ${cond}` : `  ${h.logic || 'AND'} ${cond}`;
        }).join('\n');
      }

      // Build ORDER BY
      let orderSql = '';
      if (qbe.orderBy && qbe.orderBy.length > 0) {
        orderSql = '\nORDER BY ' + qbe.orderBy.map(o => {
          if (o.expression) return o.expression + (o.direction ? ' ' + o.direction : '');
          const col = o.table ? qual(o.table, o.column) : quote(o.column);
          return col + ' ' + (o.direction || 'ASC');
        }).join(', ');
      }

      // Build LIMIT / OFFSET
      let limitSql = '';
      if (qbe.limit && qbe.limit > 0) {
        if (engine === 'mysql' || engine === 'sqlite') {
          limitSql = '\nLIMIT ' + qbe.limit;
          if (qbe.offset && qbe.offset > 0) limitSql += ' OFFSET ' + qbe.offset;
        } else if (engine === 'mssql') {
          // MSSQL uses TOP or OFFSET/FETCH
          if (qbe.offset && qbe.offset > 0) {
            limitSql = `\nOFFSET ${qbe.offset} ROWS FETCH NEXT ${qbe.limit} ROWS ONLY`;
          } else {
            // Replace SELECT with SELECT TOP N
          }
        } else {
          // PostgreSQL
          limitSql = '\nLIMIT ' + qbe.limit;
          if (qbe.offset && qbe.offset > 0) limitSql += ' OFFSET ' + qbe.offset;
        }
      }

      // Build UNION
      let unionSql = '';
      if (qbe.union && qbe.union.type && qbe.union.sql) {
        unionSql = `\n${qbe.union.type.toUpperCase()}\n${qbe.union.sql}`;
      }

      // Assemble SQL
      let sql = '';
      const queryType = (qbe.queryType || 'SELECT').toUpperCase();

      if (queryType === 'SELECT') {
        let top = 'SELECT\n  ';
        if (engine === 'mssql' && qbe.limit > 0 && !(qbe.offset > 0)) {
          // For MSSQL with LIMIT but no offset, use SELECT TOP
          sql = 'SELECT TOP ' + qbe.limit + '\n  ' + selCols + '\nFROM ' + fromSql;
        } else {
          sql = 'SELECT\n  ' + selCols + '\nFROM ' + fromSql;
        }
        sql += whereSql + groupSql + havingSql + orderSql + limitSql + unionSql;
      } else if (queryType === 'INSERT') {
        const t = qbe.tables?.[0];
        if (!t) return res.json({ success: true, data: { sql: '-- SELECT a table for INSERT', valid: false } });
        const colNames = (qbe.columns || []).map(c => quote(c.column)).join(', ');
        const vals = (qbe.columns || []).map(() => '?').join(', ');
        sql = `INSERT INTO ${quote(t.schema)}.${quote(t.name)} (${colNames})\nVALUES (${vals})`;
        sql += unionSql;
      } else if (queryType === 'UPDATE') {
        const t = qbe.tables?.[0];
        if (!t) return res.json({ success: true, data: { sql: '-- SELECT a table for UPDATE', valid: false } });
        const sets = (qbe.columns || []).map(c => `  ${quote(c.column)} = ?`).join(',\n');
        sql = `UPDATE ${quote(t.schema)}.${quote(t.name)} SET\n${sets}`;
        sql += whereSql + unionSql;
      } else if (queryType === 'DELETE') {
        const t = qbe.tables?.[0];
        if (!t) return res.json({ success: true, data: { sql: '-- SELECT a table for DELETE', valid: false } });
        sql = `DELETE FROM ${quote(t.schema)}.${quote(t.name)}`;
        sql += whereSql + unionSql;
      }

      res.json({ success: true, data: { sql, valid: true, engine } });
    } catch (err) {
      res.status(500).json({ success: false, error: { message: err.message } });
    }
  });

  module.exports = { router, designer, ddlGen, translator, builder, templates };
}
