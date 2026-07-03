const { describe, it } = require('node:test');
const assert = require('node:assert');
const T = require('../lib/translator');

describe('ENGINES', () => {
  it('includes four engines', () => {
    assert.deepStrictEqual(T.ENGINES, ['postgresql', 'mysql', 'sqlite', 'mssql']);
  });
});

describe('quoteIdent', () => {
  it('quotes for PostgreSQL', () => {
    assert.strictEqual(T.quoteIdent('users', 'postgresql'), '"users"');
  });
  it('quotes for MySQL', () => {
    assert.strictEqual(T.quoteIdent('users', 'mysql'), '`users`');
  });
  it('quotes for SQLite', () => {
    assert.strictEqual(T.quoteIdent('users', 'sqlite'), '"users"');
  });
  it('quotes for MSSQL', () => {
    assert.strictEqual(T.quoteIdent('users', 'mssql'), '[users]');
  });
  it('returns empty for empty name', () => {
    assert.strictEqual(T.quoteIdent('', 'postgresql'), '');
  });
});

describe('resolveColumnType', () => {
  it('maps SERIAL per engine', () => {
    assert.strictEqual(T.resolveColumnType({ type: 'SERIAL' }, 'postgresql'), 'SERIAL');
    assert.strictEqual(T.resolveColumnType({ type: 'SERIAL' }, 'mysql'), 'INT AUTO_INCREMENT');
    assert.strictEqual(T.resolveColumnType({ type: 'SERIAL' }, 'sqlite'), 'INTEGER');
    assert.strictEqual(T.resolveColumnType({ type: 'SERIAL' }, 'mssql'), 'INT IDENTITY(1,1)');
  });

  it('handles VARCHAR with length', () => {
    assert.strictEqual(T.resolveColumnType({ type: 'VARCHAR', length: 100 }, 'postgresql'), 'VARCHAR(100)');
    assert.strictEqual(T.resolveColumnType({ type: 'VARCHAR', length: 100 }, 'mysql'), 'VARCHAR(100)');
    assert.strictEqual(T.resolveColumnType({ type: 'VARCHAR', length: 100 }, 'sqlite'), 'TEXT');
    assert.strictEqual(T.resolveColumnType({ type: 'VARCHAR', length: 100 }, 'mssql'), 'NVARCHAR(100)');
  });

  it('handles NUMERIC with precision/scale', () => {
    assert.strictEqual(T.resolveColumnType({ type: 'NUMERIC', precision: 10, scale: 2 }, 'postgresql'), 'NUMERIC(10,2)');
    assert.strictEqual(T.resolveColumnType({ type: 'NUMERIC', precision: 10, scale: 2 }, 'mysql'), 'DECIMAL(10,2)');
    assert.strictEqual(T.resolveColumnType({ type: 'DECIMAL', precision: 8, scale: 3 }, 'postgresql'), 'DECIMAL(8,3)');
  });

  it('maps UUID per engine', () => {
    assert.strictEqual(T.resolveColumnType({ type: 'UUID' }, 'postgresql'), 'UUID');
    assert.strictEqual(T.resolveColumnType({ type: 'UUID' }, 'mysql'), 'CHAR(36)');
    assert.strictEqual(T.resolveColumnType({ type: 'UUID' }, 'sqlite'), 'TEXT');
    assert.strictEqual(T.resolveColumnType({ type: 'UUID' }, 'mssql'), 'UNIQUEIDENTIFIER');
  });

  it('passes through unknown types', () => {
    assert.strictEqual(T.resolveColumnType({ type: 'HSTORE' }, 'postgresql'), 'HSTORE');
  });
});

describe('translateDefaultValue', () => {
  it('translates NOW() per engine', () => {
    assert.strictEqual(T.translateDefaultValue('NOW()', 'postgresql'), 'NOW()');
    assert.strictEqual(T.translateDefaultValue('NOW()', 'mysql'), 'CURRENT_TIMESTAMP');
    assert.strictEqual(T.translateDefaultValue('NOW()', 'mssql'), 'GETDATE()');
  });

  it('passes through numeric literals', () => {
    assert.strictEqual(T.translateDefaultValue('42', 'postgresql'), '42');
    assert.strictEqual(T.translateDefaultValue('3.14', 'postgresql'), '3.14');
  });

  it('passes through string literals', () => {
    assert.strictEqual(T.translateDefaultValue("'hello'", 'postgresql'), "'hello'");
  });

  it('returns null for empty', () => {
    assert.strictEqual(T.translateDefaultValue('', 'postgresql'), null);
  });
});

describe('columnDDL', () => {
  it('generates column DDL with nullable', () => {
    const ddl = T.columnDDL({ name: 'email', type: 'VARCHAR', length: 255, nullable: false }, 'postgresql');
    assert.ok(ddl.includes('"email"'));
    assert.ok(ddl.includes('VARCHAR(255)'));
    assert.ok(ddl.includes('NOT NULL'));
  });

  it('includes auto-increment for MySQL', () => {
    const ddl = T.columnDDL({ name: 'id', type: 'INTEGER', autoIncrement: true, primaryKey: true }, 'mysql');
    assert.ok(ddl.includes('AUTO_INCREMENT'));
  });

  it('uses SERIAL type for PostgreSQL auto-increment via type', () => {
    const ddl = T.columnDDL({ name: 'id', type: 'SERIAL', primaryKey: true }, 'postgresql');
    assert.ok(ddl.includes('SERIAL'));
  });
});

describe('autoIncrementFragment', () => {
  it('returns correct fragments per engine', () => {
    assert.ok(T.autoIncrementFragment('postgresql').includes('IDENTITY'));
    assert.strictEqual(T.autoIncrementFragment('mysql'), 'AUTO_INCREMENT');
    assert.strictEqual(T.autoIncrementFragment('sqlite'), 'AUTOINCREMENT');
    assert.strictEqual(T.autoIncrementFragment('mssql'), 'IDENTITY(1,1)');
  });
});
