'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const designer = require('./designer');
const ddlGen = require('./ddl-generator');
const translator = require('./translator');
const builder = require('./builder');
const templates = require('./templates');
const config = require('../config');

const ROOT = path.join(__dirname, '..');
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const VERSION = PKG.version;

// ─── GET /health ─────────────────────────────────────────────────────
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: '4wd-vsse-schema-builder', version: VERSION });
});

// ─── GET / — Landing page ────────────────────────────────────────────
router.get('/', (req, res) => {
  res.sendFile(path.join(ROOT, 'public', 'index.html'));
});

// ─── GET /api/design/engines — List supported engines + types ────────
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

// ─── POST /api/design/generate — Generate DDL ───────────────────────
router.post('/api/design/generate', (req, res) => {
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
      const stmts = ddlGen.generateDDL(obj, engine);
      return res.json({ success: true, data: { engine, statements: stmts, sql: stmts.join('\n') } });
    }
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

// ─── POST /api/design/build — Generate + execute ────────────────────
router.post('/api/design/build', async (req, res) => {
  try {
    const { design, target } = req.body;
    if (!design) {
      return res.status(400).json({ success: false, error: { message: 'Missing "design" in request body' } });
    }
    if (!target || !target.engine) {
      return res.status(400).json({ success: false, error: { message: 'Missing "target.engine"' } });
    }
    const obj = designer.createDesignObject(design);
    const validation = designer.validateDesignObject(obj);
    if (!validation.valid) {
      return res.status(400).json({
        success: false, error: { message: 'Validation failed', details: validation.errors }
      });
    }
    const stmts = ddlGen.generateDDL(obj, target.engine);
    const results = await builder.build(stmts, {
      engine: target.engine,
      host: target.host, port: target.port, database: target.database,
      user: target.user, password: target.password, dryRun: target.dryRun || false
    });
    res.json({
      success: true,
      data: { engine: target.engine, sql: stmts.join('\n'), statements: stmts, results }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// ─── POST /api/design/validate — Validate design object ─────────────
router.post('/api/design/validate', (req, res) => {
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

// ─── GET /api/design/templates/:type/:engine — Get code template ───
router.get('/api/design/templates/:type/:engine', (req, res) => {
  const { type, engine } = req.params;
  const upperType = type.toUpperCase();
  const lowerEngine = engine.toLowerCase();
  if (!['VIEW', 'FUNCTION', 'PROCEDURE', 'TRIGGER'].includes(upperType)) {
    return res.status(400).json({
      success: false, error: { message: `Unsupported type "${type}". Supported: VIEW, FUNCTION, PROCEDURE, TRIGGER` }
    });
  }
  if (!translator.ENGINES.includes(lowerEngine)) {
    return res.status(400).json({
      success: false, error: { message: `Unsupported engine "${engine}"` }
    });
  }
  const tmpl = templates.getTemplate(upperType, lowerEngine);
  res.json({ success: true, data: { type: upperType, engine: lowerEngine, template: tmpl } });
});

// ─── POST /api/design/explain — Query plan ──────────────────────────
router.post('/api/design/explain', async (req, res) => {
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

// ─── POST /api/design/execute — Execute SQL ─────────────────────────
router.post('/api/design/execute', async (req, res) => {
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

// ─── POST /api/design/schema-tables — DB introspection ──────────────
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

// ─── POST /api/design/query-build — QBE → SQL ──────────────────────
router.post('/api/design/query-build', (req, res) => {
  try {
    const { qbe, engine: eng } = req.body;
    if (!qbe) return res.status(400).json({ success: false, error: { message: 'Missing "qbe" state' } });
    if (!eng) return res.status(400).json({ success: false, error: { message: 'Missing "engine"' } });
    const engine = eng.toLowerCase();

    const qChar = engine === 'mysql' ? '`' : engine === 'mssql' ? '' : '"';
    const quote = (name) => {
      if (!name) return '';
      if (engine === 'mssql') return '[' + name.replace(/]/g, ']]') + ']';
      const esc = name.replace(new RegExp(qChar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), qChar + qChar);
      return qChar + esc + qChar;
    };
    const qual = (t, c) => (t ? quote(t) + '.' : '') + quote(c);

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

    const selCols = (qbe.columns && qbe.columns.length > 0)
      ? qbe.columns.map(c => {
          const qn = c.expression || (c.table ? qual(c.table, c.column) : quote(c.column));
          return c.alias ? qn + ' AS ' + quote(c.alias) : qn;
        }).join(',\n  ')
      : '  *';

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

    let groupSql = '';
    if (qbe.groupBy && qbe.groupBy.length > 0) {
      groupSql = '\nGROUP BY ' + qbe.groupBy.map(g => {
        if (typeof g === 'string') return g || '?';
        if (g.expression) return g.expression;
        const colName = g.column || g.field || '?';
        return g.table ? qual(g.table, colName) : quote(colName);
      }).join(', ');
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
        const colName = o.column || o.field || '?';
        const col = o.table ? qual(o.table, colName) : quote(colName);
        return col + ' ' + (o.direction || 'ASC');
      }).join(', ');
    }

    let limitSql = '';
    if (qbe.limit && qbe.limit > 0) {
      if (engine === 'mysql' || engine === 'sqlite') {
        limitSql = '\nLIMIT ' + qbe.limit;
        if (qbe.offset && qbe.offset > 0) limitSql += ' OFFSET ' + qbe.offset;
      } else if (engine === 'mssql') {
        if (qbe.offset && qbe.offset > 0) {
          limitSql = `\nOFFSET ${qbe.offset} ROWS FETCH NEXT ${qbe.limit} ROWS ONLY`;
        } else {
          limitSql = ''; // handled via SELECT TOP below
        }
      } else {
        limitSql = '\nLIMIT ' + qbe.limit;
        if (qbe.offset && qbe.offset > 0) limitSql += ' OFFSET ' + qbe.offset;
      }
    }

    let unionSql = '';
    if (qbe.union && qbe.union.type && qbe.union.sql) {
      unionSql = `\n${qbe.union.type.toUpperCase()}\n${qbe.union.sql}`;
    }

    let sql = '';
    const queryType = (qbe.queryType || 'SELECT').toUpperCase();

    if (queryType === 'SELECT') {
      if (engine === 'mssql' && qbe.limit > 0 && !(qbe.offset > 0)) {
        sql = 'SELECT TOP ' + qbe.limit + '\n  ' + selCols + '\nFROM ' + fromSql;
      } else {
        sql = 'SELECT\n  ' + selCols + '\nFROM ' + fromSql;
      }
      sql += whereSql + groupSql + havingSql + orderSql + limitSql + unionSql;
    } else if (queryType === 'INSERT') {
      const t = qbe.tables?.[0];
      if (!t) return res.json({ success: true, data: { sql: '-- Select a table for INSERT', valid: false } });
      const colNames = (qbe.columns || []).map(c => quote(c.column)).join(', ');
      const vals = (qbe.columns || []).map(() => '?').join(', ');
      sql = `INSERT INTO ${quote(t.schema)}.${quote(t.name)} (${colNames})\nVALUES (${vals})`;
      sql += unionSql;
    } else if (queryType === 'UPDATE') {
      const t = qbe.tables?.[0];
      if (!t) return res.json({ success: true, data: { sql: '-- Select a table for UPDATE', valid: false } });
      const sets = (qbe.columns || []).map(c => `  ${quote(c.column)} = ?`).join(',\n');
      sql = `UPDATE ${quote(t.schema)}.${quote(t.name)} SET\n${sets}`;
      sql += whereSql + unionSql;
    } else if (queryType === 'DELETE') {
      const t = qbe.tables?.[0];
      if (!t) return res.json({ success: true, data: { sql: '-- Select a table for DELETE', valid: false } });
      sql = `DELETE FROM ${quote(t.schema)}.${quote(t.name)}`;
      sql += whereSql + unionSql;
    }

    res.json({ success: true, data: { sql, valid: true, engine } });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// ─── GET * — SPA fallback ───────────────────────────────────────────
router.get('*', (req, res) => {
  res.sendFile(path.join(ROOT, 'public', 'index.html'));
});

module.exports = router;
