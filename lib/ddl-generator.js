/**
 * ddl-generator.js — Generate engine-specific DDL from design objects
 * 
 * Takes a design object (Table, View, Function, Procedure, Trigger, Role, Schema)
 * and produces DDL statements for PostgreSQL, MySQL, SQLite, and MSSQL.
 */

'use strict';

const T = require('./translator');

// ─── Schema DDL ────────────────────────────────────────────────────────
function generateSchemaDDL(schema, engine) {
  const stmts = [];
  const name = T.quoteIdent(schema.name, engine);

  if (engine === 'postgresql' || engine === 'mysql') {
    let sql = `CREATE SCHEMA ${name}`;
    if (schema.owner && engine === 'postgresql') {
      sql += ` AUTHORIZATION ${T.quoteIdent(schema.owner, engine)}`;
    }
    stmts.push(sql + ';');
  } else if (engine === 'sqlite') {
    stmts.push(`-- SQLite does not support CREATE SCHEMA; using ${schema.name} as database file`);
  } else if (engine === 'mssql') {
    let sql = `CREATE SCHEMA ${name}`;
    if (schema.owner) sql += ` AUTHORIZATION ${T.quoteIdent(schema.owner, engine)}`;
    stmts.push(sql + ';');
  }

  if (schema.comment && (engine === 'postgresql' || engine === 'mssql')) {
    stmts.push(`COMMENT ON SCHEMA ${name} IS ${T.quoteString(schema.comment)};`);
  }
  return stmts;
}

// ─── Table DDL ─────────────────────────────────────────────────────────
function generateTableDDL(table, engine) {
  const stmts = [];
  const tblName = T.quoteIdent(table.name, engine);
  const schemaPrefix = (engine === 'postgresql' || engine === 'mssql') 
    ? `${T.quoteIdent(table.schema || 'public', engine)}.` : '';
  const fullName = schemaPrefix + tblName;

  // ── CREATE TABLE ──
  const lines = [];
  lines.push(`CREATE TABLE ${fullName} (`);

  // Columns
  // Collect composite PK columns so we don't double-emit PRIMARY KEY
  const compositePkCols = new Set();
  for (const c of table.constraints || []) {
    if (c.type === 'PRIMARY KEY' && c.columns) {
      c.columns.forEach(n => compositePkCols.add(n));
    }
  }
  const colDefs = table.columns.map(col => `  ${T.columnDDL(col, engine, { skipPrimaryKey: compositePkCols.has(col.name) })}`);
  lines.push(colDefs.join(',\n'));

  // Constraints
  for (const c of table.constraints || []) {
    const cDef = constraintDDL(c, table.name, engine);
    if (cDef) lines.push(',\n  ' + cDef);
  }

  lines.push(')');

  // Table options
  if (table.comment && engine === 'mysql') {
    lines.push(` ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT=${T.quoteString(table.comment)}`);
  }

  stmts.push(lines.join('') + ';');

  // ── Comments (PG/MSSQL) ──
  if (table.comment && (engine === 'postgresql' || engine === 'mssql')) {
    stmts.push(`COMMENT ON TABLE ${fullName} IS ${T.quoteString(table.comment)};`);
  }

  // ── Column comments (PG) ──
  if (engine === 'postgresql') {
    for (const col of table.columns) {
      if (col.comment) {
        stmts.push(`COMMENT ON COLUMN ${fullName}.${T.quoteIdent(col.name, engine)} IS ${T.quoteString(col.comment)};`);
      }
    }
  }

  // ── Indexes ──
  for (const idx of table.indexes || []) {
    const idxDDL = generateIndexDDL(idx, fullName, table.name, engine);
    if (idxDDL) stmts.push(idxDDL);
  }

  return stmts;
}

// ─── Constraint DDL ───────────────────────────────────────────────────
function constraintDDL(c, tableName, engine) {
  const cName = c.name ? `CONSTRAINT ${T.quoteIdent(c.name, engine)} ` : '';

  switch (c.type) {
    case 'PRIMARY KEY': {
      const cols = c.columns.map(col => T.quoteIdent(col, engine)).join(', ');
      return `${cName}PRIMARY KEY (${cols})`;
    }
    case 'UNIQUE': {
      const cols = c.columns.map(col => T.quoteIdent(col, engine)).join(', ');
      let sql = `${cName}UNIQUE (${cols})`;
      if (engine === 'postgresql' && c.deferrable) {
        sql += ` DEFERRABLE${c.initiallyDeferred ? ' INITIALLY DEFERRED' : ' INITIALLY IMMEDIATE'}`;
      }
      return sql;
    }
    case 'FOREIGN KEY': {
      const cols = c.columns.map(col => T.quoteIdent(col, engine)).join(', ');
      const refCols = (c.refColumns || []).map(col => T.quoteIdent(col, engine)).join(', ');
      let sql = `${cName}FOREIGN KEY (${cols}) REFERENCES ${T.quoteIdent(c.refTable, engine)} (${refCols})`;
      if (c.onDelete) sql += ` ON DELETE ${c.onDelete}`;
      if (c.onUpdate) sql += ` ON UPDATE ${c.onUpdate}`;
      if (engine === 'postgresql' && c.deferrable) {
        sql += ` DEFERRABLE${c.initiallyDeferred ? ' INITIALLY DEFERRED' : ' INITIALLY IMMEDIATE'}`;
      }
      return sql;
    }
    case 'CHECK': {
      if (!c.checkExpression) return null;
      return `${cName}CHECK (${c.checkExpression})`;
    }
    default:
      return null;
  }
}

// ─── Index DDL ─────────────────────────────────────────────────────────
function generateIndexDDL(idx, fullTableName, tableName, engine) {
  if (!idx.columns || idx.columns.length === 0) return null;
  const idxName = idx.name || `idx_${tableName}_${idx.columns.join('_')}`;
  const cols = idx.columns.map(col => T.quoteIdent(col, engine)).join(', ');
  const unique = idx.unique ? 'UNIQUE ' : '';

  let sql = `CREATE ${unique}INDEX ${T.quoteIdent(idxName, engine)} ON ${fullTableName} `;

  if (engine === 'postgresql' && idx.method && idx.method !== 'btree') {
    sql += `USING ${idx.method} `;
  }

  sql += `(${cols})`;

  if (idx.where && engine === 'postgresql') {
    sql += ` WHERE ${idx.where}`;
  }

  if (idx.include && idx.include.length > 0 && engine === 'postgresql') {
    sql += ` INCLUDE (${idx.include.map(c => T.quoteIdent(c, engine)).join(', ')})`;
  }

  return sql + ';';
}

// ─── View DDL ──────────────────────────────────────────────────────────
function generateViewDDL(view, engine) {
  const stmts = [];
  const schemaPrefix = (engine === 'postgresql' || engine === 'mssql')
    ? `${T.quoteIdent(view.schema || 'public', engine)}.` : '';
  const fullName = schemaPrefix + T.quoteIdent(view.name, engine);

  if (view.materialized && engine === 'postgresql') {
    stmts.push(`CREATE MATERIALIZED VIEW ${fullName} AS`);
    stmts.push(view.selectQuery + ';');
    if (view.withData) {
      stmts.push(`REFRESH MATERIALIZED VIEW ${fullName};`);
    }
  } else {
    let sql = `CREATE ${view.materialized && engine === 'mssql' ? 'MATERIALIZED VIEW AS ' : ''}VIEW ${fullName} AS\n`;
    sql += view.selectQuery;
    if (view.checkOption) {
      sql += `\nWITH ${view.checkOption} CHECK OPTION`;
    }
    stmts.push(sql + ';');
  }

  if (view.comment) {
    if (engine === 'postgresql') {
      stmts.push(`COMMENT ON VIEW ${fullName} IS ${T.quoteString(view.comment)};`);
    } else if (engine === 'mssql') {
      stmts.push(`EXEC sp_addextendedproperty @name=N'MS_Description', @value=${T.quoteString(view.comment)}, @level0type=N'SCHEMA', @level0name=${T.quoteString(view.schema || 'dbo')}, @level1type=N'VIEW', @level1name=${T.quoteString(view.name)};`);
    }
  }
  return stmts;
}

// ─── Function DDL ──────────────────────────────────────────────────────
function generateFunctionDDL(func, engine) {
  if (engine === 'mysql') return generateMySQLRoutineDDL(func, 'FUNCTION');
  if (engine === 'mssql') return generateMSSQLRoutineDDL(func, 'FUNCTION');
  if (engine === 'sqlite') return [`-- SQLite does not support CREATE FUNCTION`];

  // PostgreSQL
  const stmts = [];
  const fullName = `${T.quoteIdent(func.schema || 'public', 'postgresql')}.${T.quoteIdent(func.name, 'postgresql')}`;
  const params = (func.params || []).map(p => {
    let pDef = '';
    if (p.mode && p.mode !== 'IN') pDef += `${p.mode} `;
    pDef += `${T.quoteIdent(p.name, 'postgresql')} ${p.type}`;
    if (p.defaultValue) pDef += ` DEFAULT ${p.defaultValue}`;
    return pDef;
  }).join(', ');

  const returns = func.returnType || 'void';
  const lang = func.language || 'plpgsql';
  const volatility = func.volatility || 'VOLATILE';

  let sql = `CREATE OR REPLACE FUNCTION ${fullName}(${params})\n`;
  sql += `  RETURNS ${returns}\n`;
  sql += `  LANGUAGE ${lang}\n`;
  sql += `  ${volatility}\n`;
  if (func.strict) sql += `  STRICT\n`;
  if (func.securityDefiner) sql += `  SECURITY DEFINER\n`;
  sql += `AS $$\n`;
  sql += (func.body || 'BEGIN\n  RETURN NULL;\nEND;\n');
  sql += `$$;`;

  stmts.push(sql);
  return stmts;
}

function generateMySQLRoutineDDL(func, type) {
  const stmts = [];
  const params = (func.params || []).map(p => {
    let pDef = `${T.quoteIdent(p.name, 'mysql')} ${p.type}`;
    if (p.defaultValue) pDef += ` DEFAULT ${p.defaultValue}`;
    return pDef;
  }).join(', ');

  let sql = `CREATE ${type} ${T.quoteIdent(func.name, 'mysql')}(${params})\n`;
  if (type === 'FUNCTION') sql += `  RETURNS ${func.returnType || 'INT'}\n`;
  sql += `  LANGUAGE ${func.language === 'plpgsql' ? 'SQL' : func.language}\n`;
  sql += `  DETERMINISTIC\n`;
  sql += func.body ? func.body : 'BEGIN\n  RETURN NULL;\nEND\n';
  sql += ';';

  stmts.push(sql);
  return stmts;
}

function generateMSSQLRoutineDDL(func, type) {
  const stmts = [];
  const schemaPrefix = func.schema ? `${T.quoteIdent(func.schema, 'mssql')}.` : '';
  const fullName = schemaPrefix + T.quoteIdent(func.name, 'mssql');
  const params = (func.params || []).map(p => {
    let pDef = `${T.quoteIdent(p.name, 'mssql')} ${p.type}`;
    if (p.defaultValue) pDef += ` = ${p.defaultValue}`;
    return `  ${pDef}`;
  }).join(',\n');

  let sql = `CREATE ${type} ${fullName}\n(\n${params}\n)\n`;
  if (type === 'FUNCTION') {
    sql += `  RETURNS ${func.returnType || 'INT'}\n`;
  }
  sql += `AS\nBEGIN\n`;
  sql += func.body || '  RETURN NULL;\n';
  sql += `END;`;

  stmts.push(sql);
  return stmts;
}

// ─── Procedure DDL ─────────────────────────────────────────────────────
function generateProcedureDDL(proc, engine) {
  if (engine === 'postgresql') {
    const stmts = [];
    const fullName = `${T.quoteIdent(proc.schema || 'public', 'postgresql')}.${T.quoteIdent(proc.name, 'postgresql')}`;
    const params = (proc.params || []).map(p => {
      let pDef = '';
      if (p.mode && p.mode !== 'IN') pDef += `${p.mode} `;
      pDef += `${T.quoteIdent(p.name, 'postgresql')} ${p.type}`;
      if (p.defaultValue) pDef += ` DEFAULT ${p.defaultValue}`;
      return pDef;
    }).join(', ');

    let sql = `CREATE OR REPLACE PROCEDURE ${fullName}(${params})\n`;
    sql += `  LANGUAGE ${proc.language || 'plpgsql'}\n`;
    if (proc.securityDefiner) sql += `  SECURITY DEFINER\n`;
    sql += `AS $$\n`;
    sql += proc.body || 'BEGIN\nEND;\n';
    sql += `$$;`;
    stmts.push(sql);
    return stmts;
  }

  if (engine === 'mysql') return generateMySQLRoutineDDL(proc, 'PROCEDURE');
  if (engine === 'mssql') return generateMSSQLRoutineDDL(proc, 'PROCEDURE');
  if (engine === 'sqlite') return [`-- SQLite does not support CREATE PROCEDURE`];
  return [];
}

// ─── Trigger DDL ───────────────────────────────────────────────────────
function generateTriggerDDL(trig, engine) {
  const stmts = [];
  const trigName = T.quoteIdent(trig.name, engine);
  const tblName = T.quoteIdent(trig.tableName, engine);

  if (engine === 'postgresql') {
    // PG: CREATE TRIGGER ... EXECUTE FUNCTION
    let sql = `CREATE TRIGGER ${trigName}\n`;
    sql += `  ${trig.timing || 'BEFORE'} ${trig.event || 'INSERT'} ON ${tblName}\n`;
    sql += `  FOR EACH ${trig.forEach || 'ROW'}\n`;
    if (trig.condition) sql += `  WHEN (${trig.condition})\n`;
    sql += `  EXECUTE FUNCTION ${trig.funcName || trig.name}_func(${(trig.funcArgs || []).join(', ')});`;
    stmts.push(sql);
  } else if (engine === 'mysql') {
    let sql = `CREATE TRIGGER ${trigName}\n`;
    sql += `  ${trig.timing || 'BEFORE'} ${trig.event || 'INSERT'} ON ${tblName}\n`;
    sql += `  FOR EACH ${trig.forEach || 'ROW'}\n`;
    sql += trig.body || 'BEGIN\nEND\n';
    stmts.push(sql + ';');
  } else if (engine === 'mssql') {
    let sql = `CREATE TRIGGER ${trigName} ON ${tblName}\n`;
    sql += `  ${trig.timing === 'INSTEAD OF' ? 'INSTEAD OF' : 'AFTER'} ${trig.event || 'INSERT'}\n`;
    sql += `AS\n`;
    sql += trig.body || 'BEGIN\n  -- trigger body\nEND;';
    stmts.push(sql);
  } else if (engine === 'sqlite') {
    let sql = `CREATE TRIGGER ${trigName}\n`;
    sql += `  ${trig.timing || 'BEFORE'} ${trig.event || 'INSERT'} ON ${tblName}\n`;
    sql += `  FOR EACH ${trig.forEach || 'ROW'}\n`;
    if (trig.condition) sql += `  WHEN ${trig.condition}\n`;
    sql += `BEGIN\n`;
    sql += trig.body || '  -- trigger body\n';
    sql += `END;`;
    stmts.push(sql);
  }

  return stmts;
}

// ─── Role DDL ──────────────────────────────────────────────────────────
function generateRoleDDL(role, engine) {
  const stmts = [];

  if (engine === 'sqlite') {
    stmts.push('-- SQLite does not support CREATE ROLE');
    return stmts;
  }

  if (engine === 'mysql') {
    let sql = `CREATE ROLE ${T.quoteIdent(role.name, engine)}`;
    stmts.push(sql + ';');
    if (role.password) {
      stmts.push(`ALTER USER ${T.quoteIdent(role.name, engine)} IDENTIFIED BY ${T.quoteString(role.password)};`);
    }
    return stmts;
  }

  // PostgreSQL / MSSQL
  if (engine === 'postgresql') {
    let sql = `CREATE ROLE ${T.quoteIdent(role.name, engine)}`;
    const opts = [];
    if (role.superuser) opts.push('SUPERUSER');
    if (role.createDb) opts.push('CREATEDB');
    if (role.createRole) opts.push('CREATEROLE');
    if (!role.inherit) opts.push('NOINHERIT');
    if (role.login) opts.push('LOGIN');
    if (role.replication) opts.push('REPLICATION');
    if (role.bypassRls) opts.push('BYPASSRLS');
    if (role.connectionLimit > 0) opts.push(`CONNECTION LIMIT ${role.connectionLimit}`);
    if (role.password) opts.push(`PASSWORD ${T.quoteString(role.password)}`);
    if (role.validUntil) opts.push(`VALID UNTIL ${T.quoteString(role.validUntil)}`);
    if (opts.length > 0) sql += `\n  WITH ${opts.join('\n  ')}`;
    stmts.push(sql + ';');

    // Role membership
    for (const parentRole of role.inRoles || []) {
      stmts.push(`GRANT ${T.quoteIdent(parentRole, engine)} TO ${T.quoteIdent(role.name, engine)};`);
    }
  } else if (engine === 'mssql') {
    let sql = `CREATE ROLE ${T.quoteIdent(role.name, engine)}`;
    stmts.push(sql + ';');
    if (role.password) {
      stmts.push(`CREATE LOGIN ${T.quoteIdent(role.name, engine)} WITH PASSWORD = ${T.quoteString(role.password)};`);
      stmts.push(`CREATE USER ${T.quoteIdent(role.name, engine)} FOR LOGIN ${T.quoteIdent(role.name, engine)};`);
    }
  }

  return stmts;
}

// ─── Master generator ──────────────────────────────────────────────────
function generateDDL(designObj, engine) {
  switch (designObj.objectType) {
    case 'SCHEMA':   return generateSchemaDDL(designObj, engine);
    case 'TABLE':    return generateTableDDL(designObj, engine);
    case 'VIEW':     return generateViewDDL(designObj, engine);
    case 'FUNCTION': return generateFunctionDDL(designObj, engine);
    case 'PROCEDURE': return generateProcedureDDL(designObj, engine);
    case 'TRIGGER':  return generateTriggerDDL(designObj, engine);
    case 'ROLE':     return generateRoleDDL(designObj, engine);
    default:
      return [`-- Unsupported object type: ${designObj.objectType}`];
  }
}

function generateAllEngines(designObj) {
  const result = {};
  for (const engine of T.ENGINES) {
    result[engine] = generateDDL(designObj, engine);
  }
  return result;
}

module.exports = {
  generateDDL,
  generateAllEngines,
  generateTableDDL,
  generateViewDDL,
  generateFunctionDDL,
  generateProcedureDDL,
  generateTriggerDDL,
  generateRoleDDL,
  generateSchemaDDL,
  generateIndexDDL
};
