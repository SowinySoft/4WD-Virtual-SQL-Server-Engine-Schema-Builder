/**
 * templates.js — Starter code templates for views, functions, procedures, triggers
 * 
 * Provides engine-specific boilerplate templates when creating new objects.
 * Users can start from a template and customize.
 */

'use strict';

const T = require('./translator');

// ─── View templates ────────────────────────────────────────────────────
const VIEW_TEMPLATES = {
  postgresql: `SELECT
  t.*
FROM ${T.quoteIdent('your_table', 'postgresql')} t
WHERE 1=1`,

  mysql: `SELECT
  t.*
FROM ${T.quoteIdent('your_table', 'mysql')} t
WHERE 1=1`,

  sqlite: `SELECT
  t.*
FROM your_table t
WHERE 1=1`,

  mssql: `SELECT
  t.*
FROM ${T.quoteIdent('your_table', 'mssql')} t
WHERE 1=1`
};

// ─── Function templates ────────────────────────────────────────────────
const FUNCTION_TEMPLATES = {
  postgresql: `DECLARE
  result_var INTEGER;
BEGIN
  -- Function logic here
  result_var := 0;
  
  RETURN result_var;
END;`,

  mysql: `BEGIN
  DECLARE result_var INT DEFAULT 0;
  
  -- Function logic here
  SET result_var = 0;
  
  RETURN result_var;
END;`,

  sqlite: `-- SQLite does not support CREATE FUNCTION`,
  
  mssql: `BEGIN
  DECLARE @result_var INT = 0;
  
  -- Function logic here
  SET @result_var = 0;
  
  RETURN @result_var;
END;`
};

// ─── Procedure templates ───────────────────────────────────────────────
const PROCEDURE_TEMPLATES = {
  postgresql: `DECLARE
  v_count INTEGER;
BEGIN
  -- Procedure logic here
  SELECT COUNT(*) INTO v_count FROM your_table;
  
  RAISE NOTICE 'Count: %', v_count;
END;`,

  mysql: `BEGIN
  DECLARE v_count INT DEFAULT 0;
  
  -- Procedure logic here
  SELECT COUNT(*) INTO v_count FROM your_table;
  
  SELECT v_count AS result;
END;`,

  sqlite: `-- SQLite does not support CREATE PROCEDURE`,

  mssql: `BEGIN
  DECLARE @v_count INT = 0;
  
  -- Procedure logic here
  SELECT @v_count = COUNT(*) FROM your_table;
  
  SELECT @v_count AS result;
END;`
};

// ─── Trigger templates ─────────────────────────────────────────────────
const TRIGGER_TEMPLATES = {
  postgresql: `-- Trigger function must be created separately
BEGIN
  -- Trigger logic — NEW and OLD records available
  -- NEW contains the new row (INSERT/UPDATE)
  -- OLD contains the old row (UPDATE/DELETE)
  
  IF TG_OP = 'INSERT' THEN
    -- Handle insert
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle update
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Handle delete
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;`,

  mysql: `BEGIN
  -- Trigger logic — NEW and OLD records available
  -- NEW.col_name for new values (INSERT/UPDATE)
  -- OLD.col_name for old values (UPDATE/DELETE)
  
  IF (NEW.status IS NULL) THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Status cannot be NULL';
  END IF;
END;`,

  sqlite: `  -- Trigger logic — NEW and OLD records available
  -- NEW.col_name for new values (INSERT/UPDATE)
  -- OLD.col_name for old values (UPDATE/DELETE)
  SELECT CASE
    WHEN NEW.value < 0 THEN RAISE(ABORT, 'Value cannot be negative')
  END;`,

  mssql: `BEGIN
  -- Trigger logic — INSERTED and DELETED tables available
  -- INSERTED contains new rows (INSERT/UPDATE)
  -- DELETED contains old rows (UPDATE/DELETE)
  
  IF EXISTS (SELECT 1 FROM INSERTED WHERE status IS NULL)
  BEGIN
    RAISERROR('Status cannot be NULL', 16, 1);
    ROLLBACK TRANSACTION;
    RETURN;
  END
END;`
};

// ─── Template accessor ─────────────────────────────────────────────────
const TEMPLATE_MAP = {
  VIEW: VIEW_TEMPLATES,
  FUNCTION: FUNCTION_TEMPLATES,
  PROCEDURE: PROCEDURE_TEMPLATES,
  TRIGGER: TRIGGER_TEMPLATES
};

function getTemplate(objectType, engine) {
  const typeTemplates = TEMPLATE_MAP[objectType];
  if (!typeTemplates) return '';
  return typeTemplates[engine] || typeTemplates.postgresql;
}

function getAllTemplates(objectType) {
  const typeTemplates = TEMPLATE_MAP[objectType];
  if (!typeTemplates) return {};
  return { ...typeTemplates };
}

module.exports = {
  getTemplate,
  getAllTemplates,
  VIEW_TEMPLATES,
  FUNCTION_TEMPLATES,
  PROCEDURE_TEMPLATES,
  TRIGGER_TEMPLATES,
  TEMPLATE_MAP
};
