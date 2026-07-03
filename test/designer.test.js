const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  createColumn, createConstraint, createIndex,
  createTable, createView, createFunction, createProcedure,
  createTrigger, createRole, createSchema,
  createDesignObject, validateTable, validateDesignObject,
  CONSTRAINT_TYPES
} = require('../lib/designer');

describe('createColumn', () => {
  it('creates column with defaults', () => {
    const col = createColumn();
    assert.strictEqual(col.name, '');
    assert.strictEqual(col.type, 'INTEGER');
    assert.strictEqual(col.nullable, true);
    assert.strictEqual(col.primaryKey, false);
    assert.strictEqual(col.autoIncrement, false);
  });

  it('creates column with overrides', () => {
    const col = createColumn({ name: 'id', type: 'SERIAL', primaryKey: true });
    assert.strictEqual(col.name, 'id');
    assert.strictEqual(col.type, 'SERIAL');
    assert.strictEqual(col.primaryKey, true);
  });
});

describe('createConstraint', () => {
  it('throws for invalid type', () => {
    assert.throws(() => createConstraint({ type: 'INVALID' }), /Invalid constraint type/);
  });

  it('creates FOREIGN KEY constraint', () => {
    const c = createConstraint({
      type: 'FOREIGN KEY', columns: ['user_id'],
      refTable: 'users', refColumns: ['id'], onDelete: 'CASCADE'
    });
    assert.strictEqual(c.type, 'FOREIGN KEY');
    assert.deepStrictEqual(c.columns, ['user_id']);
    assert.strictEqual(c.refTable, 'users');
  });
});

describe('createDesignObject', () => {
  it('creates TABLE from spec', () => {
    const t = createDesignObject({
      objectType: 'TABLE', name: 'test',
      columns: [{ name: 'id', type: 'INTEGER', primaryKey: true }]
    });
    assert.strictEqual(t.objectType, 'TABLE');
    assert.strictEqual(t.name, 'test');
    assert.strictEqual(t.columns.length, 1);
  });

  it('throws for unknown type', () => {
    assert.throws(() => createDesignObject({ objectType: 'UNKNOWN' }), /Unknown object type/);
  });

  it('infers FK constraints from column properties', () => {
    const t = createDesignObject({
      objectType: 'TABLE', name: 'orders',
      columns: [
        { name: 'id', type: 'INTEGER', primaryKey: true },
        { name: 'user_id', type: 'INTEGER', foreignKey: true, refTable: 'users', refColumn: 'id' }
      ]
    });
    assert.strictEqual(t.constraints.length, 1);
    assert.strictEqual(t.constraints[0].type, 'FOREIGN KEY');
  });
});

describe('validateTable', () => {
  it('returns errors for missing name', () => {
    const r = validateTable(createTable({ columns: [{ name: 'id', type: 'INTEGER' }] }));
    assert.strictEqual(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('name')));
  });

  it('returns errors for no columns', () => {
    const r = validateTable(createTable({ name: 't' }));
    assert.strictEqual(r.valid, false);
  });

  it('detects duplicate column names', () => {
    const r = validateTable(createTable({
      name: 't',
      columns: [{ name: 'id', type: 'INTEGER' }, { name: 'id', type: 'VARCHAR' }]
    }));
    assert.strictEqual(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('Duplicate')));
  });

  it('detects missing PK columns', () => {
    const r = validateTable(createTable({
      name: 't',
      columns: [{ name: 'id', type: 'INTEGER' }],
      primaryKeyColumns: ['missing_col']
    }));
    assert.strictEqual(r.valid, false);
  });

  it('passes for valid table', () => {
    const r = validateTable(createTable({
      name: 'users', columns: [{ name: 'id', type: 'INTEGER', primaryKey: true }]
    }));
    assert.strictEqual(r.valid, true);
  });
});

describe('validateDesignObject', () => {
  it('validates all object types require name', () => {
    assert.strictEqual(validateDesignObject(createSchema({})).valid, false);
    assert.strictEqual(validateDesignObject(createRole({})).valid, false);
    assert.strictEqual(validateDesignObject(createFunction({})).valid, false);
    assert.strictEqual(validateDesignObject(createProcedure({})).valid, false);
    assert.strictEqual(validateDesignObject(createTrigger({})).valid, false);
  });

  it('validates trigger requires tableName', () => {
    assert.strictEqual(validateDesignObject(createTrigger({ name: 't' })).valid, false);
  });

  it('passes for valid VIEW', () => {
    assert.strictEqual(validateDesignObject(createView({ name: 'v' })).valid, true);
  });
});

describe('createIndex', () => {
  it('defaults to btree method', () => {
    const idx = createIndex({ columns: ['col1'] });
    assert.strictEqual(idx.method, 'btree');
  });
});

describe('createFunction', () => {
  it('defaults to plpgsql language', () => {
    const f = createFunction({ name: 'fn' });
    assert.strictEqual(f.language, 'plpgsql');
  });
});

describe('CONSTRAINT_TYPES', () => {
  it('includes all constraint types', () => {
    assert.deepStrictEqual(CONSTRAINT_TYPES, ['PRIMARY KEY', 'UNIQUE', 'FOREIGN KEY', 'CHECK', 'EXCLUDE']);
  });
});
