/**
 * builder.js — Execute generated DDL against target database servers
 * 
 * Connects to PostgreSQL, MySQL, SQLite, or MSSQL and executes
 * generated DDL statements. Supports dry-run mode for preview.
 */

'use strict';

const { execSync } = require('child_process');
const path = require('path');

// ─── Supported engines ─────────────────────────────────────────────────
const ENGINES = ['postgresql', 'mysql', 'sqlite', 'mssql'];

// ─── Build configuration ───────────────────────────────────────────────
function normalizeConfig(cfg = {}) {
  const c = { ...cfg };
  if (!c.engine) c.engine = 'postgresql';
  if (!c.host) c.host = c.engine === 'sqlite' ? '' : 'localhost';
  if (!c.port) {
    const ports = { postgresql: 5432, mysql: 3306, sqlite: 0, mssql: 1433 };
    c.port = ports[c.engine] || 5432;
  }
  if (!c.database) c.database = ':memory:';
  if (!c.user) c.user = 'root';
  if (!c.password) c.password = '';
  return c;
}

// ─── SSL helper ────────────────────────────────────────────────────────
function getPgSsl(config) {
  // 1. Explicit env var overrides everything — "required", "no-verify", or "false" to disable
  if (process.env.DB_SSL) {
    const v = process.env.DB_SSL.toLowerCase();
    if (v === 'false' || v === '0' || v === 'disable') return undefined;
    return { rejectUnauthorized: v !== 'no-verify' && v !== 'allow' };
  }
  // 2. Explicit target-level ssl option
  if (config && config.ssl === false) return undefined;
  if (config && config.ssl) return config.ssl === true ? { rejectUnauthorized: false } : config.ssl;
  // 3. DATABASE_URL implies cloud (Neon, etc.) — always needs SSL
  if (process.env.DATABASE_URL) return { rejectUnauthorized: false };
  // 4. Non-localhost hosts typically require SSL
  if (config && config.host && !['localhost', '127.0.0.1', '::1'].includes(config.host)) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

// ─── PostgreSQL builder ────────────────────────────────────────────────
async function buildPostgreSQL(stmts, config) {
  const { Pool } = require('pg');
  const pool = new Pool({
    host: config.host || 'localhost',
    port: config.port || 5432,
    database: config.database || 'postgres',
    user: config.user || 'postgres',
    password: config.password || '',
    ssl: getPgSsl(config)
  });

  const results = [];
  for (const stmt of stmts) {
    if (!stmt.trim() || stmt.trim().startsWith('--')) {
      results.push({ statement: stmt, status: 'skipped', detail: 'comment' });
      continue;
    }
    try {
      await pool.query(stmt);
      results.push({ statement: stmt, status: 'success' });
    } catch (err) {
      results.push({ statement: stmt, status: 'error', detail: err.message });
    }
  }
  await pool.end();
  return results;
}

// ─── MySQL builder ─────────────────────────────────────────────────────
async function buildMySQL(stmts, config) {
  const mysql = require('mysql2/promise');
  const conn = await mysql.createConnection({
    host: config.host || 'localhost',
    port: config.port || 3306,
    database: config.database || 'mysql',
    user: config.user || 'root',
    password: config.password || '',
    multipleStatements: false
  });

  const results = [];
  for (const stmt of stmts) {
    if (!stmt.trim() || stmt.trim().startsWith('--')) {
      results.push({ statement: stmt, status: 'skipped', detail: 'comment' });
      continue;
    }
    try {
      await conn.execute(stmt);
      results.push({ statement: stmt, status: 'success' });
    } catch (err) {
      results.push({ statement: stmt, status: 'error', detail: err.message });
    }
  }
  await conn.end();
  return results;
}

// ─── SQLite builder ────────────────────────────────────────────────────
async function buildSQLite(stmts, config) {
  let db;
  try {
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();
    const dbPath = config.database && config.database !== ':memory:' 
      ? config.database : undefined;
    
    if (dbPath) {
      const fs = require('fs');
      if (fs.existsSync(dbPath)) {
        const buffer = fs.readFileSync(dbPath);
        db = new SQL.Database(buffer);
      } else {
        db = new SQL.Database();
      }
    } else {
      db = new SQL.Database();
    }

    db.run('PRAGMA foreign_keys=ON');
  } catch (err) {
    return [{ statement: 'open', status: 'error', detail: `Failed to open SQLite: ${err.message}` }];
  }

  const results = [];
  for (const stmt of stmts) {
    if (!stmt.trim() || stmt.trim().startsWith('--')) {
      results.push({ statement: stmt, status: 'skipped', detail: 'comment' });
      continue;
    }
    try {
      db.run(stmt);
      results.push({ statement: stmt, status: 'success' });
    } catch (err) {
      results.push({ statement: stmt, status: 'error', detail: err.message });
    }
  }

  // Save to file if path specified
  if (config.database && config.database !== ':memory:') {
    const fs = require('fs');
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(config.database, buffer);
  }

  db.close();
  return results;
}

// ─── MSSQL builder ─────────────────────────────────────────────────────
async function buildMSSQL(stmts, config) {
  try {
    const sql = require('mssql');
    const pool = new sql.ConnectionPool({
      server: config.host || 'localhost',
      port: config.port || 1433,
      database: config.database || 'master',
      user: config.user || 'sa',
      password: config.password || '',
      options: {
        encrypt: false,
        trustServerCertificate: true
      }
    });
    await pool.connect();

    const results = [];
    for (const stmt of stmts) {
      if (!stmt.trim() || stmt.trim().startsWith('--')) {
        results.push({ statement: stmt, status: 'skipped', detail: 'comment' });
        continue;
      }
      try {
        await pool.request().query(stmt);
        results.push({ statement: stmt, status: 'success' });
      } catch (err) {
        results.push({ statement: stmt, status: 'error', detail: err.message });
      }
    }
    await pool.close();
    return results;
  } catch (err) {
    return [{ statement: 'connect', status: 'error', detail: `MSSQL connection failed: ${err.message}` }];
  }
}

// ─── Builder factory ───────────────────────────────────────────────────
const BUILDERS = {
  postgresql: buildPostgreSQL,
  mysql: buildMySQL,
  sqlite: buildSQLite,
  mssql: buildMSSQL
};

async function build(stmts, config) {
  const cfg = normalizeConfig(config);
  const builder = BUILDERS[cfg.engine];
  if (!builder) {
    throw new Error(`Unsupported engine "${cfg.engine}". Supported: ${ENGINES.join(', ')}`);
  }

  if (cfg.dryRun) {
    return stmts.map(stmt => ({
      statement: stmt,
      status: 'dry-run',
      detail: 'Not executed (dry-run mode)'
    }));
  }

  return builder(stmts, cfg);
}

// ─── EXPLAIN query execution plan ───────────────────────────
async function explainQuery(sql, config, analyze = false) {
  const cfg = normalizeConfig(config);
  const engine = cfg.engine;
  const isSelect = /^\s*SELECT\b/i.test(sql.trim());

  let explainSql;
  if (engine === 'postgresql') {
    explainSql = analyze
      ? `EXPLAIN (ANALYZE, COSTS, VERBOSE, FORMAT TEXT)\n${sql}`
      : `EXPLAIN (COSTS, VERBOSE, FORMAT TEXT)\n${sql}`;
  } else if (engine === 'mysql') {
    explainSql = analyze
      ? `EXPLAIN ANALYZE ${sql}`
      : `EXPLAIN FORMAT=JSON ${sql}`;
  } else if (engine === 'sqlite') {
    explainSql = analyze
      ? `EXPLAIN ${sql}`  // SQLite has no ANALYZE option
      : `EXPLAIN ${sql}`;
  } else if (engine === 'mssql') {
    if (isSelect) {
      explainSql = analyze
        ? `SET STATISTICS PROFILE ON;\n${sql}\nSET STATISTICS PROFILE OFF;`
        : `SET SHOWPLAN_TEXT ON;\n${sql}\nSET SHOWPLAN_TEXT OFF;`;
    } else {
      explainSql = `SET SHOWPLAN_TEXT ON;\n${sql}\nSET SHOWPLAN_TEXT OFF;`;
    }
  }

  const results = [];

  if (engine === 'postgresql') {
    const { Pool } = require('pg');
    const pool = new Pool({
      host: cfg.host, port: cfg.port,
      database: cfg.database,
      user: cfg.user, password: cfg.password,
      ssl: getPgSsl(cfg)
    });
    try {
      const res = await pool.query(explainSql);
      results.push({
        sql, explainSql,
        columns: res.fields.map(f => f.name),
        rows: res.rows.map(r => Object.values(r)),
        rowCount: res.rows.length
      });
    } catch (err) {
      results.push({ sql, explainSql, error: err.message });
    }
    await pool.end();

  } else if (engine === 'mysql') {
    const mysql = require('mysql2/promise');
    const conn = await mysql.createConnection({
      host: cfg.host, port: cfg.port,
      database: cfg.database,
      user: cfg.user, password: cfg.password,
      multipleStatements: false
    });
    try {
      const [rows, fields] = await conn.execute(explainSql);
      const cols = fields ? fields.map(f => f.name) : Object.keys(rows[0] || {});
      results.push({
        sql, explainSql,
        columns: cols,
        rows: rows.map(r => Object.values(r)),
        rowCount: rows.length
      });
    } catch (err) {
      results.push({ sql, explainSql, error: err.message });
    }
    await conn.end();

  } else if (engine === 'sqlite') {
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    try {
      // For SQLite we run the DDL first (in-memory) then EXPLAIN
      if (!isSelect) {
        const ddlStmts = sql.split(';').filter(s => s.trim());
        for (const stmt of ddlStmts) {
          try { db.run(stmt + ';'); } catch (_) {}
        }
        // Then explain on a simple select from the created table
        const tableMatch = sql.match(/CREATE\s+TABLE\s+(?:\S+\.)?(\w+)/i);
        if (tableMatch) {
          explainSql = `EXPLAIN QUERY PLAN SELECT * FROM "${tableMatch[1]}" LIMIT 0`;
        }
      }
      const stmt = db.prepare(explainSql);
      const cols = stmt.getColumnNames();
      const rows = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      results.push({
        sql, explainSql,
        columns: cols,
        rows: rows.map(r => Object.values(r)),
        rowCount: rows.length
      });
    } catch (err) {
      results.push({ sql, explainSql, error: err.message });
    }
    db.close();

  } else if (engine === 'mssql') {
    const sql = require('mssql');
    const pool = new sql.ConnectionPool({
      server: cfg.host, port: cfg.port,
      database: cfg.database,
      user: cfg.user, password: cfg.password,
      options: { encrypt: false, trustServerCertificate: true }
    });
    try {
      await pool.connect();
      // MSSQL explain via SET SHOWPLAN_TEXT returns rows as resultsets
      const request = pool.request();
      const result = await request.query(explainSql);

      if (result.recordsets && result.recordsets.length > 0) {
        for (const rs of result.recordsets) {
          if (rs.length > 0) {
            const cols = Object.keys(rs[0]);
            results.push({
              sql, explainSql,
              columns: cols,
              rows: rs.map(r => Object.values(r)),
              rowCount: rs.length
            });
          }
        }
      } else if (result.recordset) {
        const cols = Object.keys(result.recordset[0] || {});
        results.push({
          sql, explainSql,
          columns: cols,
          rows: result.recordset.map(r => Object.values(r)),
          rowCount: result.recordset.length
        });
      }
    } catch (err) {
      results.push({ sql, explainSql, error: err.message });
    }
    await pool.close();
  }

  return results;
}

// ─── Schema introspection ────────────────────────────────
async function introspectTables(config) {
  const cfg = normalizeConfig(config);
  const engine = cfg.engine;

  if (engine === 'postgresql') {
    const { Pool } = require('pg');
    const pool = new Pool({
      host: cfg.host, port: cfg.port,
      database: cfg.database,
      user: cfg.user, password: cfg.password,
      ssl: getPgSsl(cfg)
    });
    try {
      // Get all tables with columns
      const colRes = await pool.query(`
        SELECT c.table_schema, c.table_name, c.column_name, c.data_type,
               c.is_nullable, c.column_default, c.character_maximum_length,
               c.ordinal_position,
               CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END AS is_pk
        FROM information_schema.columns c
        LEFT JOIN (
          SELECT ku.table_schema, ku.table_name, ku.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage ku
            ON tc.constraint_name = ku.constraint_name
            AND tc.table_schema = ku.table_schema
          WHERE tc.constraint_type = 'PRIMARY KEY'
        ) pk ON pk.table_schema = c.table_schema
            AND pk.table_name = c.table_name
            AND pk.column_name = c.column_name
        WHERE c.table_schema NOT IN ('pg_catalog','information_schema')
        ORDER BY c.table_schema, c.table_name, c.ordinal_position
      `);

      // Get foreign keys
      const fkRes = await pool.query(`
        SELECT
          tc.table_schema, tc.table_name,
          kcu.column_name,
          ccu.table_schema AS ref_schema,
          ccu.table_name AS ref_table,
          ccu.column_name AS ref_column,
          rc.update_rule, rc.delete_rule
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        JOIN information_schema.referential_constraints rc
          ON rc.constraint_name = tc.constraint_name
          AND rc.constraint_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema NOT IN ('pg_catalog','information_schema')
      `);

      // Group by schema → table
      const schemaMap = {};
      for (const row of colRes.rows) {
        const s = row.table_schema;
        const t = row.table_name;
        if (!schemaMap[s]) schemaMap[s] = {};
        if (!schemaMap[s][t]) schemaMap[s][t] = { columns: [], fks: [] };
        schemaMap[s][t].columns.push({
          name: row.column_name,
          type: row.data_type,
          nullable: row.is_nullable === 'YES',
          default: row.column_default,
          maxLength: row.character_maximum_length,
          isPk: row.is_pk
        });
      }

      // Attach FKs
      for (const row of fkRes.rows) {
        const s = row.table_schema;
        const t = row.table_name;
        if (schemaMap[s] && schemaMap[s][t]) {
          schemaMap[s][t].fks.push({
            column: row.column_name,
            refSchema: row.ref_schema,
            refTable: row.ref_table,
            refColumn: row.ref_column,
            onDelete: row.delete_rule,
            onUpdate: row.update_rule
          });
        }
      }

      // Convert to sorted array
      const result = [];
      const sortedSchemas = Object.keys(schemaMap).sort();
      for (const s of sortedSchemas) {
        const tables = [];
        const sortedTables = Object.keys(schemaMap[s]).sort();
        for (const t of sortedTables) {
          tables.push({
            name: t,
            columns: schemaMap[s][t].columns,
            foreignKeys: schemaMap[s][t].fks
          });
        }
        result.push({ schema: s, tables });
      }

      await pool.end();
      return result;
    } catch (err) {
      await pool.end();
      throw err;
    }
  }

  if (engine === 'mysql') {
    const mysql = require('mysql2/promise');
    const conn = await mysql.createConnection({
      host: cfg.host, port: cfg.port,
      database: cfg.database,
      user: cfg.user, password: cfg.password
    });
    try {
      // MySQL: use information_schema but exclude system databases
      const [rows] = await conn.execute(`
        SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE,
               IS_NULLABLE, COLUMN_DEFAULT, CHARACTER_MAXIMUM_LENGTH,
               ORDINAL_POSITION,
               COLUMN_KEY
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA NOT IN ('mysql','information_schema','performance_schema','sys')
        ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION
      `);

      // Get FKs
      const [fkRows] = await conn.execute(`
        SELECT kcu.TABLE_SCHEMA, kcu.TABLE_NAME, kcu.COLUMN_NAME,
               kcu.REFERENCED_TABLE_SCHEMA, kcu.REFERENCED_TABLE_NAME, kcu.REFERENCED_COLUMN_NAME,
               rc.UPDATE_RULE, rc.DELETE_RULE
        FROM information_schema.KEY_COLUMN_USAGE kcu
        JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
          ON rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
          AND rc.CONSTRAINT_SCHEMA = kcu.TABLE_SCHEMA
        WHERE kcu.REFERENCED_TABLE_NAME IS NOT NULL
          AND kcu.TABLE_SCHEMA NOT IN ('mysql','information_schema','performance_schema','sys')
      `);

      const schemaMap = {};
      for (const row of rows) {
        const s = row.TABLE_SCHEMA;
        const t = row.TABLE_NAME;
        if (!schemaMap[s]) schemaMap[s] = {};
        if (!schemaMap[s][t]) schemaMap[s][t] = { columns: [], fks: [] };
        schemaMap[s][t].columns.push({
          name: row.COLUMN_NAME,
          type: row.DATA_TYPE,
          nullable: row.IS_NULLABLE === 'YES',
          default: row.COLUMN_DEFAULT,
          maxLength: row.CHARACTER_MAXIMUM_LENGTH,
          isPk: row.COLUMN_KEY === 'PRI'
        });
      }

      for (const row of fkRows) {
        const s = row.TABLE_SCHEMA;
        const t = row.TABLE_NAME;
        if (schemaMap[s] && schemaMap[s][t]) {
          schemaMap[s][t].fks.push({
            column: row.COLUMN_NAME,
            refSchema: row.REFERENCED_TABLE_SCHEMA,
            refTable: row.REFERENCED_TABLE_NAME,
            refColumn: row.REFERENCED_COLUMN_NAME,
            onDelete: row.DELETE_RULE,
            onUpdate: row.UPDATE_RULE
          });
        }
      }

      const result = [];
      for (const s of Object.keys(schemaMap).sort()) {
        const tables = [];
        for (const t of Object.keys(schemaMap[s]).sort()) {
          tables.push({ name: t, columns: schemaMap[s][t].columns, foreignKeys: schemaMap[s][t].fks });
        }
        result.push({ schema: s, tables });
      }

      await conn.end();
      return result;
    } catch (err) {
      await conn.end();
      throw err;
    }
  }

  if (engine === 'sqlite') {
    // SQLite introspection via sql.js
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();
    const fs = require('fs');
    let db;
    if (cfg.database && cfg.database !== ':memory:' && fs.existsSync(cfg.database)) {
      const buffer = fs.readFileSync(cfg.database);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }

    try {
      // SQLite: get list of tables
      const tableStmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
      const tables = [];
      while (tableStmt.step()) {
        const row = tableStmt.getAsObject();
        const tName = row.name;
        // Get columns via PRAGMA
        const pragma = db.exec(`PRAGMA table_info("${tName}")`);
        const columns = (pragma[0]?.values || []).map(v => ({
          name: v[1],
          type: v[2] || 'TEXT',
          nullable: !v[3],
          default: v[4],
          maxLength: null,
          isPk: !!v[5]
        }));
        // Get FKs via PRAGMA
        const fkPragma = db.exec(`PRAGMA foreign_key_list("${tName}")`);
        const fks = (fkPragma[0]?.values || []).map(v => ({
          column: v[3],
          refSchema: null,
          refTable: v[2],
          refColumn: v[4],
          onDelete: v[5]?.toUpperCase() || 'NO ACTION',
          onUpdate: v[6]?.toUpperCase() || 'NO ACTION'
        }));
        tables.push({ name: tName, columns, foreignKeys: fks });
      }
      tableStmt.free();

      const result = [{ schema: 'main', tables }];
      db.close();
      return result;
    } catch (err) {
      db.close();
      throw err;
    }
  }

  if (engine === 'mssql') {
    const sql = require('mssql');
    const pool = new sql.ConnectionPool({
      server: cfg.host, port: cfg.port,
      database: cfg.database,
      user: cfg.user, password: cfg.password,
      options: { encrypt: false, trustServerCertificate: true }
    });
    try {
      await pool.connect();
      const colResult = await pool.request().query(`
        SELECT c.TABLE_SCHEMA, c.TABLE_NAME, c.COLUMN_NAME, c.DATA_TYPE,
               c.IS_NULLABLE, c.COLUMN_DEFAULT, c.CHARACTER_MAXIMUM_LENGTH,
               c.ORDINAL_POSITION,
               CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS IS_PK
        FROM information_schema.COLUMNS c
        LEFT JOIN (
          SELECT ku.TABLE_SCHEMA, ku.TABLE_NAME, ku.COLUMN_NAME
          FROM information_schema.TABLE_CONSTRAINTS tc
          JOIN information_schema.KEY_COLUMN_USAGE ku
            ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
          WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
        ) pk ON pk.TABLE_SCHEMA = c.TABLE_SCHEMA
            AND pk.TABLE_NAME = c.TABLE_NAME
            AND pk.COLUMN_NAME = c.COLUMN_NAME
        WHERE c.TABLE_SCHEMA NOT IN ('sys')
        ORDER BY c.TABLE_SCHEMA, c.TABLE_NAME, c.ORDINAL_POSITION
      `);

      const schemaMap = {};
      for (const row of colResult.recordset) {
        const s = row.TABLE_SCHEMA;
        const t = row.TABLE_NAME;
        if (!schemaMap[s]) schemaMap[s] = {};
        if (!schemaMap[s][t]) schemaMap[s][t] = { columns: [], fks: [] };
        schemaMap[s][t].columns.push({
          name: row.COLUMN_NAME,
          type: row.DATA_TYPE,
          nullable: row.IS_NULLABLE === 'YES',
          default: row.COLUMN_DEFAULT,
          maxLength: row.CHARACTER_MAXIMUM_LENGTH,
          isPk: !!row.IS_PK
        });
      }

      const fkResult = await pool.request().query(`
        SELECT
          fks.TABLE_SCHEMA, fks.TABLE_NAME, fks.COLUMN_NAME,
          fks.REFERENCED_TABLE_SCHEMA, fks.REFERENCED_TABLE_NAME, fks.REFERENCED_COLUMN_NAME,
          rc.UPDATE_RULE, rc.DELETE_RULE
        FROM information_schema.REFERENTIAL_CONSTRAINTS rc
        JOIN information_schema.KEY_COLUMN_USAGE fks
          ON fks.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
          AND fks.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
        WHERE fks.TABLE_SCHEMA NOT IN ('sys')
      `);

      for (const row of fkResult.recordset || []) {
        const s = row.TABLE_SCHEMA;
        const t = row.TABLE_NAME;
        if (schemaMap[s] && schemaMap[s][t]) {
          schemaMap[s][t].fks.push({
            column: row.COLUMN_NAME,
            refSchema: row.REFERENCED_TABLE_SCHEMA,
            refTable: row.REFERENCED_TABLE_NAME,
            refColumn: row.REFERENCED_COLUMN_NAME,
            onDelete: row.DELETE_RULE,
            onUpdate: row.UPDATE_RULE
          });
        }
      }

      const result = [];
      for (const s of Object.keys(schemaMap).sort()) {
        const tables = [];
        for (const t of Object.keys(schemaMap[s]).sort()) {
          tables.push({ name: t, columns: schemaMap[s][t].columns, foreignKeys: schemaMap[s][t].fks });
        }
        result.push({ schema: s, tables });
      }

      await pool.close();
      return result;
    } catch (err) {
      await pool.close();
      throw err;
    }
  }

  throw new Error(`Introspection not supported for engine "${engine}"`);
}

// ─── Direct SQL Execution (not EXPLAIN) ───────────────────
async function executeQuery(sql, config) {
  const cfg = normalizeConfig(config);
  const engine = cfg.engine;
  const isSelect = /^\s*SELECT\b/i.test(sql.trim());
  const isDml = /^\s*(INSERT|UPDATE|DELETE)\b/i.test(sql.trim());

  if (engine === 'postgresql') {
    const { Pool } = require('pg');
    const pool = new Pool({
      host: cfg.host, port: cfg.port,
      database: cfg.database,
      user: cfg.user, password: cfg.password,
      ssl: getPgSsl(cfg)
    });
    try {
      if (isSelect) {
        const res = await pool.query(sql);
        await pool.end();
        return {
          columns: res.fields.map(f => f.name),
          rows: res.rows.map(r => Object.values(r)),
          rowCount: res.rows.length,
          queryType: 'SELECT'
        };
      } else {
        const res = await pool.query(sql);
        await pool.end();
        return {
          affectedRows: res.rowCount || 0,
          message: isDml
            ? `${sql.trim().split(/\s+/)[0].toUpperCase()} completed — ${res.rowCount || 0} row(s) affected`
            : 'Query executed successfully',
          queryType: sql.trim().split(/\s+/)[0].toUpperCase()
        };
      }
    } catch (err) {
      await pool.end().catch(() => {});
      return { error: err.message };
    }

  } else if (engine === 'mysql') {
    const mysql = require('mysql2/promise');
    const conn = await mysql.createConnection({
      host: cfg.host, port: cfg.port,
      database: cfg.database,
      user: cfg.user, password: cfg.password,
      multipleStatements: false
    });
    try {
      if (isSelect) {
        const [rows, fields] = await conn.execute(sql);
        await conn.end();
        return {
          columns: fields ? fields.map(f => f.name) : Object.keys(rows[0] || {}),
          rows: rows.map(r => Object.values(r)),
          rowCount: rows.length,
          queryType: 'SELECT'
        };
      } else {
        const [result] = await conn.execute(sql);
        await conn.end();
        return {
          affectedRows: result.affectedRows || 0,
          message: isDml
            ? `${sql.trim().split(/\s+/)[0].toUpperCase()} completed — ${result.affectedRows || 0} row(s) affected`
            : 'Query executed successfully',
          queryType: sql.trim().split(/\s+/)[0].toUpperCase()
        };
      }
    } catch (err) {
      await conn.end().catch(() => {});
      return { error: err.message };
    }

  } else if (engine === 'sqlite') {
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    try {
      if (isSelect) {
        const stmt = db.prepare(sql);
        const cols = stmt.getColumnNames();
        const rows = [];
        while (stmt.step()) {
          rows.push(stmt.getAsObject());
        }
        stmt.free();
        db.close();
        return {
          columns: cols,
          rows: rows.map(r => Object.values(r)),
          rowCount: rows.length,
          queryType: 'SELECT'
        };
      } else {
        db.run(sql);
        const changes = db.getRowsModified();
        db.close();
        return {
          affectedRows: changes,
          message: isDml
            ? `${sql.trim().split(/\s+/)[0].toUpperCase()} completed — ${changes} row(s) affected`
            : 'Query executed successfully',
          queryType: sql.trim().split(/\s+/)[0].toUpperCase()
        };
      }
    } catch (err) {
      db.close();
      return { error: err.message };
    }

  } else if (engine === 'mssql') {
    const mssql = require('mssql');
    const pool = new mssql.ConnectionPool({
      server: cfg.host, port: cfg.port,
      database: cfg.database,
      user: cfg.user, password: cfg.password,
      options: { encrypt: false, trustServerCertificate: true }
    });
    try {
      await pool.connect();
      const request = pool.request();
      if (isSelect) {
        const result = await request.query(sql);
        await pool.close();
        if (result.recordset && result.recordset.length > 0) {
          const cols = Object.keys(result.recordset[0]);
          return {
            columns: cols,
            rows: result.recordset.map(r => Object.values(r)),
            rowCount: result.recordset.length,
            queryType: 'SELECT'
          };
        }
        return { columns: [], rows: [], rowCount: 0, queryType: 'SELECT' };
      } else {
        const result = await request.query(sql);
        await pool.close();
        return {
          affectedRows: result.rowsAffected?.[0] || 0,
          message: isDml
            ? `${sql.trim().split(/\s+/)[0].toUpperCase()} completed — ${result.rowsAffected?.[0] || 0} row(s) affected`
            : 'Query executed successfully',
          queryType: sql.trim().split(/\s+/)[0].toUpperCase()
        };
      }
    } catch (err) {
      await pool.close().catch(() => {});
      return { error: err.message };
    }
  }

  throw new Error(`Execution not supported for engine "${engine}"`);
}

module.exports = {
  build,
  explainQuery,
  executeQuery,
  introspectTables,
  ENGINES,
  normalizeConfig
};
