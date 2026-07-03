/**
 * designer.js — Core design object models
 * 
 * Defines the schema design primitives: Column, Constraint, Index, Table,
 * View, Function, Procedure, Trigger, Role, and Schema objects.
 * All are plain JS objects with factory functions for consistency.
 */

'use strict';

// ─── Column ────────────────────────────────────────────────────────────
function createColumn(spec = {}) {
  return {
    name: spec.name || '',
    type: spec.type || 'INTEGER',
    length: spec.length || null,       // for VARCHAR(n), NVARCHAR(n)
    precision: spec.precision || null,  // for NUMERIC(p,s)
    scale: spec.scale || null,
    nullable: spec.nullable !== undefined ? spec.nullable : true,
    defaultValue: spec.defaultValue || null,
    autoIncrement: spec.autoIncrement || false,
    primaryKey: spec.primaryKey || false,
    unique: spec.unique || false,
    comment: spec.comment || null,
    generated: spec.generated || null,  // 'ALWAYS' | 'BY DEFAULT' | null
    generatedExpression: spec.generatedExpression || null,
    collation: spec.collation || null,
    identity: spec.identity || false,   // MSSQL IDENTITY
    rowGuid: spec.rowGuid || false,     // MSSQL ROWGUIDCOL
    // Extended metadata
    engineTypes: spec.engineTypes || {} // per-engine type overrides
  };
}

// ─── Constraint ────────────────────────────────────────────────────────
const CONSTRAINT_TYPES = ['PRIMARY KEY', 'UNIQUE', 'FOREIGN KEY', 'CHECK', 'EXCLUDE'];

function createConstraint(spec = {}) {
  const c = {
    name: spec.name || '',
    type: spec.type || 'PRIMARY KEY',
    columns: spec.columns || [],            // column names for PK/UK/FK
    deferrable: spec.deferrable || false,
    initiallyDeferred: spec.initiallyDeferred || false,
    // Foreign key
    refTable: spec.refTable || null,
    refColumns: spec.refColumns || [],
    onDelete: spec.onDelete || null,        // 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION'
    onUpdate: spec.onUpdate || null,
    // Check
    checkExpression: spec.checkExpression || null,
    // Exclude
    excludeUsing: spec.excludeUsing || null,
    excludePredicate: spec.excludePredicate || null,
    comment: spec.comment || null
  };
  if (!CONSTRAINT_TYPES.includes(c.type)) {
    throw new Error(`Invalid constraint type "${c.type}". Must be one of: ${CONSTRAINT_TYPES.join(', ')}`);
  }
  return c;
}

// ─── Index ─────────────────────────────────────────────────────────────
function createIndex(spec = {}) {
  return {
    name: spec.name || '',
    columns: spec.columns || [],
    unique: spec.unique || false,
    method: spec.method || 'btree',  // btree, hash, gist, gin, brin
    where: spec.where || null,       // partial index predicate
    include: spec.include || [],     // INCLUDE columns (PG)
    comment: spec.comment || null,
    tablespace: spec.tablespace || null
  };
}

// ─── Table ─────────────────────────────────────────────────────────────
function createTable(spec = {}) {
  // Infer FK constraints from column properties, if not already provided
  let constraints = (spec.constraints || []).map(createConstraint);
  if (spec.columns && !spec.constraints) {
    for (const col of spec.columns) {
      if (col.foreignKey && col.refTable && col.refColumn) {
        constraints.push({
          type: 'FOREIGN KEY',
          name: '',
          columns: [col.name],
          refTable: col.refTable,
          refColumns: [col.refColumn],
          onDelete: col.onDelete || null,
          onUpdate: col.onUpdate || null
        });
      }
    }
  }
  return {
    objectType: 'TABLE',
    name: spec.name || '',
    schema: spec.schema || 'public',
    columns: (spec.columns || []).map(createColumn),
    constraints,
    indexes: (spec.indexes || []).map(createIndex),
    primaryKeyColumns: spec.primaryKeyColumns || [],
    engine: spec.engine || 'postgresql',
    comment: spec.comment || null,
    withOids: spec.withOids || false,
    tablespace: spec.tablespace || null,
    partitionBy: spec.partitionBy || null, // 'RANGE' | 'LIST' | 'HASH'
    partitionColumns: spec.partitionColumns || [],
    inherits: spec.inherits || null       // table inheritance (PG)
  };
}

// ─── View ──────────────────────────────────────────────────────────────
function createView(spec = {}) {
  return {
    objectType: 'VIEW',
    name: spec.name || '',
    schema: spec.schema || 'public',
    selectQuery: spec.selectQuery || spec.body || spec.viewDefinition || '',
    columns: (spec.columns || []).map(createColumn),
    materialized: spec.materialized || false,
    withData: spec.withData !== undefined ? spec.withData : true,
    comment: spec.comment || null,
    checkOption: spec.checkOption || null // 'LOCAL' | 'CASCADED'
  };
}

// ─── Function ──────────────────────────────────────────────────────────
function createFunction(spec = {}) {
  return {
    objectType: 'FUNCTION',
    name: spec.name || '',
    schema: spec.schema || 'public',
    language: spec.language || 'plpgsql',  // plpgsql, sql, plv8, etc.
    returnType: spec.returnType || 'void',
    params: (spec.params || []).map(p => ({
      name: p.name || '',
      type: p.type || 'INTEGER',
      mode: p.mode || 'IN',           // IN, OUT, INOUT, VARIADIC
      defaultValue: p.defaultValue || null
    })),
    body: spec.body || '',
    volatility: spec.volatility || 'VOLATILE', // IMMUTABLE, STABLE, VOLATILE
    strict: spec.strict !== undefined ? spec.strict : false,
    securityDefiner: spec.securityDefiner || false,
    comment: spec.comment || null
  };
}

// ─── Procedure ─────────────────────────────────────────────────────────
function createProcedure(spec = {}) {
  return {
    objectType: 'PROCEDURE',
    name: spec.name || '',
    schema: spec.schema || 'public',
    language: spec.language || 'plpgsql',
    params: (spec.params || []).map(p => ({
      name: p.name || '',
      type: p.type || 'INTEGER',
      mode: p.mode || 'IN',
      defaultValue: p.defaultValue || null
    })),
    body: spec.body || '',
    securityDefiner: spec.securityDefiner || false,
    comment: spec.comment || null
  };
}

// ─── Trigger ───────────────────────────────────────────────────────────
function createTrigger(spec = {}) {
  return {
    objectType: 'TRIGGER',
    name: spec.name || '',
    schema: spec.schema || 'public',
    tableName: spec.tableName || '',
    timing: spec.timing || 'BEFORE',      // BEFORE, AFTER, INSTEAD OF
    event: spec.event || 'INSERT',         // INSERT, UPDATE, DELETE, TRUNCATE
    forEach: spec.forEach || 'ROW',        // ROW, STATEMENT
    condition: spec.condition || null,      // WHEN condition
    body: spec.body || '',
    funcName: spec.funcName || '',          // PG calls a function
    funcArgs: spec.funcArgs || [],
    comment: spec.comment || null
  };
}

// ─── Role ──────────────────────────────────────────────────────────────
function createRole(spec = {}) {
  return {
    objectType: 'ROLE',
    name: spec.name || '',
    superuser: spec.superuser || false,
    createDb: spec.createDb || false,
    createRole: spec.createRole || false,
    inherit: spec.inherit !== undefined ? spec.inherit : true,
    login: spec.login || false,
    replication: spec.replication || false,
    bypassRls: spec.bypassRls || false,
    connectionLimit: spec.connectionLimit || -1,
    password: spec.password || null,
    validUntil: spec.validUntil || null,
    inRoles: spec.inRoles || [],          // member of roles
    roleMembers: spec.roleMembers || [],  // this role has these members
    comment: spec.comment || null
  };
}

// ─── Schema ────────────────────────────────────────────────────────────
function createSchema(spec = {}) {
  return {
    objectType: 'SCHEMA',
    name: spec.name || '',
    owner: spec.owner || null,
    comment: spec.comment || null
  };
}

// ─── Factory by type ───────────────────────────────────────────────────
const FACTORY_MAP = {
  SCHEMA: createSchema,
  TABLE: createTable,
  VIEW: createView,
  FUNCTION: createFunction,
  PROCEDURE: createProcedure,
  TRIGGER: createTrigger,
  ROLE: createRole
};

function createDesignObject(spec = {}) {
  const factory = FACTORY_MAP[spec.objectType];
  if (!factory) {
    throw new Error(`Unknown object type "${spec.objectType}". Supported: ${Object.keys(FACTORY_MAP).join(', ')}`);
  }
  return factory(spec);
}

// ─── Validation ───────────────────────────────────────────────────────
function validateTable(table) {
  const errors = [];
  if (!table.name) errors.push('Table name is required');
  if (!table.columns || table.columns.length === 0) {
    errors.push('Table must have at least one column');
  }
  // Check for duplicate column names
  const names = table.columns.map(c => c.name.toLowerCase());
  const dups = names.filter((n, i) => names.indexOf(n) !== i);
  if (dups.length > 0) errors.push(`Duplicate column names: ${[...new Set(dups)].join(', ')}`);

  // Check PK columns exist
  const colNames = new Set(names);
  for (const pkCol of (table.primaryKeyColumns || [])) {
    if (!colNames.has(pkCol.toLowerCase())) {
      errors.push(`Primary key column "${pkCol}" not found in columns`);
    }
  }
  return { valid: errors.length === 0, errors };
}

function validateDesignObject(obj) {
  if (obj.objectType === 'TABLE') return validateTable(obj);
  if (obj.objectType === 'SCHEMA' && !obj.name) return { valid: false, errors: ['Schema name is required'] };
  if (obj.objectType === 'VIEW' && !obj.name) return { valid: false, errors: ['View name is required'] };
  if (obj.objectType === 'ROLE' && !obj.name) return { valid: false, errors: ['Role name is required'] };
  if ((obj.objectType === 'FUNCTION' || obj.objectType === 'PROCEDURE') && !obj.name) {
    return { valid: false, errors: [`${obj.objectType} name is required`] };
  }
  if (obj.objectType === 'TRIGGER' && !obj.name) {
    return { valid: false, errors: ['Trigger name is required'] };
  }
  if (obj.objectType === 'TRIGGER' && !obj.tableName) {
    return { valid: false, errors: ['Trigger table name is required'] };
  }
  return { valid: true, errors: [] };
}

// ─── Serialization ────────────────────────────────────────────────────
function toJSON(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function fromJSON(json) {
  return createDesignObject(json);
}

module.exports = {
  // Factories
  createColumn,
  createConstraint,
  createIndex,
  createTable,
  createView,
  createFunction,
  createProcedure,
  createTrigger,
  createRole,
  createSchema,
  createDesignObject,
  // Validation
  validateTable,
  validateDesignObject,
  // Serialization
  toJSON,
  fromJSON,
  // Constants
  CONSTRAINT_TYPES
};
