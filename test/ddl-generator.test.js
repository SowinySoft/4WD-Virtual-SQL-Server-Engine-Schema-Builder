const { describe, it } = require('node:test');
const assert = require('node:assert');
const ddlGen = require('../lib/ddl-generator');
const designer = require('../lib/designer');

describe('generateSchemaDDL', () => {
  it('generates CREATE SCHEMA for postgresql', () => {
    const stmts = ddlGen.generateDDL({ objectType: 'SCHEMA', name: 'test' }, 'postgresql');
    assert.ok(stmts.some(s => s.includes('CREATE SCHEMA')));
  });

  it('notes SQLite limitation', () => {
    const stmts = ddlGen.generateDDL({ objectType: 'SCHEMA', name: 'test' }, 'sqlite');
    assert.ok(stmts.some(s => s.includes('SQLite does not support')));
  });
});

describe('generateTableDDL', () => {
  const table = designer.createTable({
    name: 'users', schema: 'public',
    columns: [
      { name: 'id', type: 'SERIAL', primaryKey: true },
      { name: 'email', type: 'VARCHAR', length: 255, nullable: false },
      { name: 'score', type: 'INTEGER', nullable: true, defaultValue: '0' },
      { name: 'created_at', type: 'TIMESTAMP', defaultValue: 'NOW()' }
    ],
    constraints: [
      { type: 'UNIQUE', name: 'uq_users_email', columns: ['email'] }
    ]
  });

  it('generates PostgreSQL DDL', () => {
    const stmts = ddlGen.generateDDL(table, 'postgresql');
    const sql = stmts.join('\n');
    assert.ok(sql.includes('CREATE TABLE'));
    assert.ok(sql.includes('"public"."users"'));
    assert.ok(sql.includes('SERIAL'));
    assert.ok(sql.includes('NOT NULL'));
    assert.ok(sql.includes('PRIMARY KEY'));
    assert.ok(sql.includes('CONSTRAINT "uq_users_email"'));
    assert.ok(sql.includes('UNIQUE'));
  });

  it('generates MySQL DDL', () => {
    const stmts = ddlGen.generateDDL(table, 'mysql');
    const sql = stmts.join('\n');
    assert.ok(sql.includes('CREATE TABLE'));
    assert.ok(sql.includes('`users`'));
    assert.ok(sql.includes('INT AUTO_INCREMENT'));
    assert.ok(sql.includes('VARCHAR(255)'));
  });

  it('generates SQLite DDL', () => {
    const stmts = ddlGen.generateDDL(table, 'sqlite');
    const sql = stmts.join('\n');
    assert.ok(sql.includes('CREATE TABLE'));
    assert.ok(sql.includes('INTEGER'));
    assert.ok(sql.includes('TEXT'));
  });

  it('generates MSSQL DDL', () => {
    const stmts = ddlGen.generateDDL(table, 'mssql');
    const sql = stmts.join('\n');
    assert.ok(sql.includes('CREATE TABLE'));
    assert.ok(sql.includes('[public].[users]'));
    assert.ok(sql.includes('IDENTITY(1,1)'));
    assert.ok(sql.includes('NVARCHAR(255)'));
  });
});

describe('generateViewDDL', () => {
  const view = designer.createView({
    name: 'active_users',
    selectQuery: 'SELECT * FROM users WHERE active = 1'
  });

  it('generates CREATE VIEW for PostgreSQL', () => {
    const stmts = ddlGen.generateDDL(view, 'postgresql');
    assert.ok(stmts.some(s => s.includes('CREATE VIEW')));
    assert.ok(stmts.some(s => s.includes('active_users')));
  });

  it('generates for MySQL', () => {
    const stmts = ddlGen.generateDDL(view, 'mysql');
    assert.ok(stmts.some(s => s.includes('CREATE VIEW')));
  });
});

describe('generateFunctionDDL', () => {
  const func = designer.createFunction({
    name: 'get_count', returnType: 'INTEGER', language: 'plpgsql',
    params: [{ name: 'p_id', type: 'INTEGER' }],
    body: 'BEGIN RETURN 1; END;'
  });

  it('generates PostgreSQL function', () => {
    const stmts = ddlGen.generateDDL(func, 'postgresql');
    const sql = stmts.join('\n');
    assert.ok(sql.includes('CREATE OR REPLACE FUNCTION'));
    assert.ok(sql.includes('RETURNS INTEGER'));
  });

  it('returns comment for SQLite', () => {
    const stmts = ddlGen.generateDDL(func, 'sqlite');
    assert.ok(stmts.some(s => s.includes('does not support')));
  });
});

describe('generateProcedureDDL', () => {
  const proc = designer.createProcedure({
    name: 'update_stats',
    params: [{ name: 'val', type: 'INTEGER' }],
    body: 'BEGIN UPDATE stats SET count = count + 1; END;'
  });

  it('generates PostgreSQL procedure', () => {
    const stmts = ddlGen.generateDDL(proc, 'postgresql');
    assert.ok(stmts.some(s => s.includes('CREATE OR REPLACE PROCEDURE')));
  });

  it('returns comment for SQLite', () => {
    const stmts = ddlGen.generateDDL(proc, 'sqlite');
    assert.ok(stmts.some(s => s.includes('does not support')));
  });
});

describe('generateTriggerDDL', () => {
  const trig = designer.createTrigger({
    name: 'check_status', tableName: 'users',
    timing: 'BEFORE', event: 'INSERT',
    body: 'BEGIN IF NEW.status IS NULL THEN RAISE EXCEPTION; END IF; END;'
  });

  it('generates PostgreSQL trigger', () => {
    const stmts = ddlGen.generateDDL(trig, 'postgresql');
    assert.ok(stmts.some(s => s.includes('CREATE TRIGGER')));
    assert.ok(stmts.some(s => s.includes('EXECUTE FUNCTION')));
  });

  it('generates MySQL trigger', () => {
    const stmts = ddlGen.generateDDL(trig, 'mysql');
    assert.ok(stmts.some(s => s.includes('CREATE TRIGGER')));
  });

  it('generates SQLite trigger', () => {
    const stmts = ddlGen.generateDDL(trig, 'sqlite');
    assert.ok(stmts.some(s => s.includes('CREATE TRIGGER')));
  });

  it('generates MSSQL trigger', () => {
    const stmts = ddlGen.generateDDL(trig, 'mssql');
    assert.ok(stmts.some(s => s.includes('CREATE TRIGGER')));
    assert.ok(stmts.some(s => s.includes('AFTER')));
  });
});

describe('generateRoleDDL', () => {
  const role = designer.createRole({
    name: 'app_user', login: true, password: 'secret'
  });

  it('generates PostgreSQL role', () => {
    const stmts = ddlGen.generateDDL(role, 'postgresql');
    assert.ok(stmts.some(s => s.includes('CREATE ROLE')));
    assert.ok(stmts.some(s => s.includes('LOGIN')));
  });

  it('returns comment for SQLite', () => {
    const stmts = ddlGen.generateDDL(role, 'sqlite');
    assert.ok(stmts.some(s => s.includes('does not support')));
  });
});

describe('generateIndexDDL', () => {
  it('generates CREATE INDEX for PostgreSQL', () => {
    const stmts = ddlGen.generateIndexDDL(
      { name: 'idx_email', columns: ['email'], unique: true },
      '"users"', 'users', 'postgresql'
    );
    assert.ok(stmts.includes('CREATE UNIQUE INDEX'));
  });
});

describe('generateAllEngines', () => {
  it('returns DDL for all 4 engines', () => {
    const table = designer.createTable({
      name: 'items',
      columns: [{ name: 'id', type: 'INTEGER', primaryKey: true }]
    });
    const result = ddlGen.generateAllEngines(table);
    assert.ok(result.postgresql);
    assert.ok(result.mysql);
    assert.ok(result.sqlite);
    assert.ok(result.mssql);
  });
});
