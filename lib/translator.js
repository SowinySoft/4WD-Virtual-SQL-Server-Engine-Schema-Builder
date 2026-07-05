/**
 * translator.js — Engine dialect rules for DDL generation
 * 
 * Maps abstract schema design objects to engine-specific DDL.
 * Covers PostgreSQL, MySQL, SQLite, and MSSQL.
 * Leverages the same type mapping knowledge as sql-executor's ENGINE_DIALECT_MAP.
 */

'use strict';

// ─── Engine type maps ──────────────────────────────────────────────────
// Maps a canonical type name to each engine's equivalent

const ENGINE_TYPE_MAP = {
  // Integer types
  SERIAL:         { postgresql: 'SERIAL', mysql: 'INT AUTO_INCREMENT', sqlite: 'INTEGER', mssql: 'INT IDENTITY(1,1)' },
  BIGSERIAL:      { postgresql: 'BIGSERIAL', mysql: 'BIGINT AUTO_INCREMENT', sqlite: 'INTEGER', mssql: 'BIGINT IDENTITY(1,1)' },
  INTEGER:        { postgresql: 'INTEGER', mysql: 'INT', sqlite: 'INTEGER', mssql: 'INT' },
  BIGINT:         { postgresql: 'BIGINT', mysql: 'BIGINT', sqlite: 'INTEGER', mssql: 'BIGINT' },
  SMALLINT:       { postgresql: 'SMALLINT', mysql: 'SMALLINT', sqlite: 'INTEGER', mssql: 'SMALLINT' },
  TINYINT:        { postgresql: 'SMALLINT', mysql: 'TINYINT', sqlite: 'INTEGER', mssql: 'TINYINT' },

  // Text types
  VARCHAR:        { postgresql: 'VARCHAR', mysql: 'VARCHAR', sqlite: 'TEXT', mssql: 'NVARCHAR' },
  NVARCHAR:       { postgresql: 'VARCHAR', mysql: 'VARCHAR', sqlite: 'TEXT', mssql: 'NVARCHAR' },
  CHAR:           { postgresql: 'CHAR', mysql: 'CHAR', sqlite: 'TEXT', mssql: 'NCHAR' },
  NCHAR:          { postgresql: 'CHAR', mysql: 'CHAR', sqlite: 'TEXT', mssql: 'NCHAR' },
  TEXT:           { postgresql: 'TEXT', mysql: 'TEXT', sqlite: 'TEXT', mssql: 'NVARCHAR(MAX)' },
  CLOB:           { postgresql: 'TEXT', mysql: 'LONGTEXT', sqlite: 'TEXT', mssql: 'NVARCHAR(MAX)' },

  // Numeric types
  NUMERIC:        { postgresql: 'NUMERIC', mysql: 'DECIMAL', sqlite: 'REAL', mssql: 'DECIMAL' },
  DECIMAL:        { postgresql: 'DECIMAL', mysql: 'DECIMAL', sqlite: 'REAL', mssql: 'DECIMAL' },
  REAL:           { postgresql: 'REAL', mysql: 'FLOAT', sqlite: 'REAL', mssql: 'REAL' },
  DOUBLE:         { postgresql: 'DOUBLE PRECISION', mysql: 'DOUBLE', sqlite: 'REAL', mssql: 'FLOAT' },
  FLOAT:          { postgresql: 'REAL', mysql: 'FLOAT', sqlite: 'REAL', mssql: 'FLOAT(53)' },
  MONEY:          { postgresql: 'NUMERIC(19,4)', mysql: 'DECIMAL(19,4)', sqlite: 'REAL', mssql: 'MONEY' },

  // Boolean
  BOOLEAN:        { postgresql: 'BOOLEAN', mysql: 'TINYINT(1)', sqlite: 'INTEGER', mssql: 'BIT' },

  // Date/Time types
  DATE:           { postgresql: 'DATE', mysql: 'DATE', sqlite: 'TEXT', mssql: 'DATE' },
  TIME:           { postgresql: 'TIME', mysql: 'TIME', sqlite: 'TEXT', mssql: 'TIME' },
  TIMESTAMP:      { postgresql: 'TIMESTAMP', mysql: 'DATETIME', sqlite: 'TEXT', mssql: 'DATETIME2' },
  TIMESTAMPTZ:    { postgresql: 'TIMESTAMPTZ', mysql: 'TIMESTAMP', sqlite: 'TEXT', mssql: 'DATETIMEOFFSET' },
  INTERVAL:       { postgresql: 'INTERVAL', mysql: 'VARCHAR(50)', sqlite: 'TEXT', mssql: 'NVARCHAR(50)' },

  // Binary
  BYTEA:          { postgresql: 'BYTEA', mysql: 'BLOB', sqlite: 'BLOB', mssql: 'VARBINARY(MAX)' },
  BLOB:           { postgresql: 'BYTEA', mysql: 'BLOB', sqlite: 'BLOB', mssql: 'VARBINARY(MAX)' },
  LONGBLOB:       { postgresql: 'BYTEA', mysql: 'LONGBLOB', sqlite: 'BLOB', mssql: 'VARBINARY(MAX)' },

  // JSON
  JSON:           { postgresql: 'JSON', mysql: 'JSON', sqlite: 'TEXT', mssql: 'NVARCHAR(MAX)' },
  JSONB:          { postgresql: 'JSONB', mysql: 'JSON', sqlite: 'TEXT', mssql: 'NVARCHAR(MAX)' },

  // UUID / GUID
  UUID:           { postgresql: 'UUID', mysql: 'CHAR(36)', sqlite: 'TEXT', mssql: 'UNIQUEIDENTIFIER' },

  // Network
  INET:           { postgresql: 'INET', mysql: 'VARCHAR(45)', sqlite: 'TEXT', mssql: 'NVARCHAR(45)' },
  CIDR:           { postgresql: 'CIDR', mysql: 'VARCHAR(45)', sqlite: 'TEXT', mssql: 'NVARCHAR(45)' }
};

// ─── Default value translations ────────────────────────────────────────
const ENGINE_DEFAULT_MAP = {
  'NOW()':      { postgresql: 'NOW()', mysql: 'CURRENT_TIMESTAMP', sqlite: "CURRENT_TIMESTAMP", mssql: 'GETDATE()' },
  'CURRENT_DATE': { postgresql: 'CURRENT_DATE', mysql: 'CURRENT_DATE', sqlite: "CURRENT_DATE", mssql: 'CAST(GETDATE() AS DATE)' },
  'CURRENT_TIME': { postgresql: 'CURRENT_TIME', mysql: 'CURRENT_TIME', sqlite: "CURRENT_TIME", mssql: 'CAST(GETDATE() AS TIME)' },
  'TRUE':       { postgresql: 'TRUE', mysql: '1', sqlite: '1', mssql: '1' },
  'FALSE':      { postgresql: 'FALSE', mysql: '0', sqlite: '0', mssql: '0' },
  'NULL':       { postgresql: 'NULL', mysql: 'NULL', sqlite: 'NULL', mssql: 'NULL' },
  'GEN_RANDOM_UUID': { postgresql: 'gen_random_uuid()', mysql: '(UUID())', sqlite: "(lower(hex(randomblob(16))))", mssql: 'NEWID()' },
  'UUID':       { postgresql: 'gen_random_uuid()', mysql: '(UUID())', sqlite: "(lower(hex(randomblob(16))))", mssql: 'NEWID()' }
};

function translateDefaultValue(defaultVal, engine) {
  if (!defaultVal) return null;
  const upper = defaultVal.toUpperCase().trim();
  // Check known patterns
  if (ENGINE_DEFAULT_MAP[upper]) return ENGINE_DEFAULT_MAP[upper][engine] || defaultVal;
  // NEXT VALUE FOR sequence
  if (upper.startsWith('NEXT VALUE FOR') || upper.startsWith('NEXTVAL')) {
    if (engine === 'postgresql') return defaultVal.replace(/^nextval/i, "nextval");
    if (engine === 'mssql') return defaultVal.replace(/^nextval/i, "NEXT VALUE FOR");
    return defaultVal; // others will skip auto-increment
  }
  // Numeric literal
  if (/^-?\d+(\.\d+)?$/.test(defaultVal)) return defaultVal;
  // String literal
  if (/^'.*'$/.test(defaultVal)) return defaultVal;
  // Other expression — pass through quoted
  return defaultVal;
}

// ─── Quote identifiers ────────────────────────────────────────────────
function quoteIdent(name, engine) {
  if (!name) return '';
  const quotes = { postgresql: '"', mysql: '`', sqlite: '"', mssql: '[' };
  const q = quotes[engine] || '"';
  if (engine === 'mssql') return '[' + name.replace(/]/g, ']]') + ']';
  if (engine === 'mysql') return '`' + name.replace(/`/g, '``') + '`';
  return `${q}${name.replace(/"/g, '""')}${q}`;
}

function quoteString(val) {
  if (val === null || val === undefined) return 'NULL';
  return `'${val.replace(/'/g, "''")}'`;
}

// ─── Column type resolution ───────────────────────────────────────────
function resolveColumnType(col, engine) {
  let baseType = col.type.toUpperCase().trim();
  
  // Handle parameterized types
  if (baseType === 'VARCHAR' || baseType === 'NVARCHAR' || baseType === 'CHAR' || baseType === 'NCHAR') {
    const engineType = ENGINE_TYPE_MAP[baseType]?.[engine] || baseType;
    const len = col.length || 255;
    // SQLite TEXT doesn't take length
    if (engine === 'sqlite') return 'TEXT';
    // MSSQL NVARCHAR/NCHAR
    if (engine === 'mssql') {
      if (baseType === 'VARCHAR' || baseType === 'NVARCHAR') return `NVARCHAR(${len})`;
      return `NCHAR(${len})`;
    }
    return `${engineType}(${len})`;
  }

  if (baseType === 'NUMERIC' || baseType === 'DECIMAL') {
    const engineType = ENGINE_TYPE_MAP[baseType]?.[engine] || baseType;
    if (engine === 'sqlite') return 'REAL';
    const p = col.precision || 10;
    const s = col.scale || 2;
    return `${engineType}(${p},${s})`;
  }

  // Look up in type map
  const mapped = ENGINE_TYPE_MAP[baseType]?.[engine];
  if (mapped) return mapped;

  // Direct type passthrough (e.g., engine-specific types like HSTORE, GEOMETRY)
  return col.type;
}

// ─── Auto-increment DDL fragment ──────────────────────────────────────
function autoIncrementFragment(engine) {
  switch (engine) {
    case 'postgresql': return 'GENERATED BY DEFAULT AS IDENTITY';
    case 'mysql': return 'AUTO_INCREMENT';
    case 'sqlite': return 'AUTOINCREMENT';
    case 'mssql': return 'IDENTITY(1,1)';
    default: return '';
  }
}

// ─── Default value DDL ─────────────────────────────────────────────────
function defaultValueDDL(col, engine) {
  if (!col.defaultValue && !col.autoIncrement) return '';
  if (col.autoIncrement && engine !== 'postgresql') return ''; // handled by type
  const dv = translateDefaultValue(col.defaultValue, engine);
  if (!dv) return '';
  return ` DEFAULT ${dv}`;
}

// ─── Nullable DDL ─────────────────────────────────────────────────────
function nullableDDL(col, engine) {
  if (col.primaryKey) return ' NOT NULL';
  if (col.nullable) return ' NULL';
  return ' NOT NULL';
}

// ─── Column DDL ───────────────────────────────────────────────────────
function columnDDL(col, engine, opts) {
  const parts = [];
  parts.push(quoteIdent(col.name, engine));
  parts.push(resolveColumnType(col, engine));

  // Auto-increment (for MySQL/SQLite inline, PG uses type SERIAL or IDENTITY)
  if (col.autoIncrement) {
    const ai = autoIncrementFragment(engine);
    if (ai) parts.push(ai);
  }

  parts.push(nullableDDL(col, engine));

  // Add PRIMARY KEY keyword unless suppressed (composite PK already has constraint)
  if (col.primaryKey && !opts?.skipPrimaryKey) {
    parts.push('PRIMARY KEY');
  }

  if (col.defaultValue) {
    const dv = defaultValueDDL(col, engine);
    if (dv) parts.push(dv.trim());
  }

  if (col.unique && !col.primaryKey) {
    parts.push('UNIQUE');
  }

  if (col.comment && engine === 'mysql') {
    parts.push(`COMMENT ${quoteString(col.comment)}`);
  }

  return parts.join(' ');
}

// ─── Engine names ─────────────────────────────────────────────────────
const ENGINES = ['postgresql', 'mysql', 'sqlite', 'mssql'];
const ENGINE_LABELS = {
  postgresql: 'PostgreSQL',
  mysql: 'MySQL',
  sqlite: 'SQLite',
  mssql: 'MSSQL'
};

module.exports = {
  ENGINES,
  ENGINE_LABELS,
  ENGINE_TYPE_MAP,
  translateDefaultValue,
  quoteIdent,
  quoteString,
  resolveColumnType,
  columnDDL,
  autoIncrementFragment,
  defaultValueDDL,
  nullableDDL
};
