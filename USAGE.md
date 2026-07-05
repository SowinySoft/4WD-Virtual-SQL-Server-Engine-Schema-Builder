# VSSE Schema Builder — Usage Guide

## Start / Stop

```powershell
# Start server (port 4005)
node server.js

# Or via CLI
node index.js --serve

# Health check
curl http://localhost:4005/health
# → {"status":"ok","service":"4wd-vsse-schema-builder","version":"1.0.0"}
```

Open **http://localhost:4005** in your browser.

---

## 5 Tabs — What Each Does

| Tab | What | When to use |
|-----|------|-------------|
| **Designer** | Create/edit tables, views, schemas, functions, procedures, triggers, roles. Generate DDL for all 4 engines at once. | Designing a schema from scratch |
| **SQL** | Free-form code editor, import/export SQL, template boilerplate. | Editing raw DDL, pasting existing SQL |
| **QBE** | Visual query builder — drag tables, set joins/conditions/sorting. | Building SELECT queries without writing SQL |
| **ER** | Entity-relationship diagram (SVG) with zoom/pan/export. | Visualizing schema relationships |
| **Templates** | Boilerplate VIEW/FUNCTION/PROC/TRIGGER × 4 engines. | Quick-start for stored code |

---

## Designer — Quick Walkthrough

1. Click **New Table** (or View/Schema/etc.)
2. Fill object name + schema (default: `public`)
3. **Add columns**: name, type, length, checkboxes (PK/UK/NN/AI/Comment)
4. **Add FK**: scroll to REFERENCES panel at bottom → pick column → pick ref table → set ON DELETE/ON UPDATE
5. Click **Generate DDL** → see PostgreSQL, MySQL, SQLite, MSSQL output side by side
6. Click **Validate** to check for errors (duplicate names, missing PK, etc.)

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+N` | New table |
| `Ctrl+S` | Generate DDL |
| `Ctrl+Z` | Undo (localStorage versioned) |
| `Delete` | Remove selected column |

---

## QBE — Visual Query Builder

1. **Left panel**: available tables grouped by schema
2. **Drag** a table onto the canvas → column chips appear
3. **Drag another** → auto-join detected if FK names match (visual line drawn)
4. Click column chips to toggle SELECT inclusion
5. Use **WHERE / GROUP BY / HAVING / ORDER BY** sections below canvas:
   - Pick a field from the dropdown, enter value, pick operator
6. **Keyword chips**: toggle DISTINCT, UNION, ALL, etc.
7. Click **Generate** → SQL appears in the results panel
8. **Syntax badge** (green/red) validates the generated SQL

---

## Import SQL (SQL tab → Import sub-tab)

Paste any CREATE TABLE/VIEW statement and click **Import**. VSSE auto-detects the engine:

```sql
-- PostgreSQL detected from SERIAL, "quoting"
CREATE TABLE "users" ("id" SERIAL PRIMARY KEY, "email" TEXT);

-- MySQL detected from ENGINE=InnoDB, backticks
CREATE TABLE users (id INT AUTO_INCREMENT PRIMARY KEY) ENGINE=InnoDB;

-- MSSQL detected from brackets, IDENTITY
CREATE TABLE [users] ([id] INT IDENTITY(1,1) PRIMARY KEY);
```

The designer is populated automatically — then click **Generate** for any target engine.

---

## ER Diagram — Working with It

- **Zoom**: mouse wheel
- **Pan**: click + drag on empty area
- **Export**: click Export SVG button
- Tables show: name, columns with PK/UK/NN icons, FK lines

---

## API Endpoints (no browser needed)

```powershell
# List engines + type mappings
curl http://localhost:4005/api/design/engines

# Generate DDL — POST a design object:
curl -X POST http://localhost:4005/api/design/generate `
  -H "Content-Type: application/json" `
  -d '{"type":"TABLE","name":"orders","schema":"sales","columns":[
    {"name":"id","type":"SERIAL","primaryKey":true},
    {"name":"total","type":"NUMERIC","precision":10,"scale":2,"nullable":false}
  ]}'

# Validate a design object (same payload shape)
curl -X POST http://localhost:4005/api/design/validate -H "Content-Type: application/json" -d "{...}"

# Build a QBE query
curl -X POST http://localhost:4005/api/design/query-build -H "Content-Type: application/json" `
  -d '{"engine":"postgresql","tables":["users"],"select":["id","email"],"where":[{"field":"status","operator":"=","value":"active"}],"limit":50}'

# Get boilerplate template
curl http://localhost:4005/api/design/templates/FUNCTION/postgresql

# Build + optionally deploy (dry-run by default)
curl -X POST http://localhost:4005/api/design/build -H "Content-Type: application/json" `
  -d '{"type":"TABLE","name":"users","columns":[{"name":"id","type":"SERIAL","primaryKey":true}],"dryRun":true}'
```

---

## Engine Tips

| Engine | Auto-increment | Quote style | Notes |
|--------|---------------|-------------|-------|
| PostgreSQL | `SERIAL` / `IDENTITY` | `"double quotes"` | Supports schemas, sequences |
| MySQL | `AUTO_INCREMENT` | `` `backticks` `` | `ENGINE=InnoDB` default |
| SQLite | `AUTOINCREMENT` | `"double quotes"` | Limited ALTER TABLE |
| MSSQL | `IDENTITY(1,1)` | `[brackets]` | Materialized = indexed view |

---

## Offline-First Principle

All design-layer operations (Generate, Validate, QBE, Templates) work **with zero database connectivity** — no DB drivers loaded. Only the Build/Execute/Explain routes require a live database, and only when `dryRun: false`.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Port 4005 in use | Set `$env:PORT=4006; node server.js` |
| Still stuck? | `Ctrl+Shift+R` hard refresh browser cache |
| `safeFetch` error logged | Check browser console (F12) for red error entries |
| DDL missing schema prefix | Use `schema:"sales"` in your design object — FK references auto-qualify |
