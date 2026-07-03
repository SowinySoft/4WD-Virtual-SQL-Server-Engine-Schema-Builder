# 4WD Virtual SQL Server Engine — Schema Builder

Design database schemas and build QBE queries **without a live database connection**. Generate DDL for PostgreSQL, MySQL, SQLite, and MSSQL from a single design object — all offline. This is the core implementation of the **Virtual SQL Server Engine (VSSE)** pattern.

> Read the full concept paper: [Virtual SQL Server Engine — A New Architectural Pattern](docs/VIRTUAL_SQL_SERVER_ENGINE_PAPER.md)

---

## Quick Start

```bash
npm install
node server.js
# → http://localhost:4005
# → Health: http://localhost:4005/health
# → API:   http://localhost:4005/api/design/engines
```

## Features

| Feature | Description | Offline? |
|---------|-------------|----------|
| **DDL Generation** | Tables, views, schemas, functions, procedures, triggers, roles — engine-specific SQL | ✅ Yes |
| **QBE Query Builder** | SELECT/INSERT/UPDATE/DELETE from visual state — joins, WHERE, GROUP BY, ORDER BY, UNION | ✅ Yes |
| **Structural Validation** | Check design objects for errors before generation | ✅ Yes |
| **Multi-Engine** | PostgreSQL, MySQL, SQLite, MSSQL — design once, output for all 4 | ✅ Yes |
| **Code Templates** | Boilerplate VIEW, FUNCTION, PROCEDURE, TRIGGER for each engine | ✅ Yes |
| **Dry-Run Build** | Preview DDL without executing against a database | ✅ Yes |
| **Live Execution** | Run DDL/SQL against a real database (pg, mysql2, sqlite, mssql) | ❌ Requires DB |
| **Schema Introspection** | Read existing database schemas | ❌ Requires DB |
| **EXPLAIN Plans** | Analyze query execution plans | ❌ Requires DB |

## API

### Offline Routes (no DB required)

```bash
# List supported engines and their type mappings
curl http://localhost:4005/api/design/engines

# Generate DDL for all 4 engines from a design object
curl -X POST http://localhost:4005/api/design/generate \
  -H "Content-Type: application/json" \
  -d '{"design":{"objectType":"TABLE","name":"users","columns":[{"name":"id","type":"SERIAL","primaryKey":true},{"name":"email","type":"VARCHAR","length":255,"nullable":false}],"constraints":[{"type":"UNIQUE","columns":["email"]}]}}'

# Validate a design object
curl -X POST http://localhost:4005/api/design/validate \
  -H "Content-Type: application/json" \
  -d '{"design":{"objectType":"TABLE","name":"users","columns":[{"name":"id","type":"SERIAL"}]}}'

# Build SQL from QBE state
curl -X POST http://localhost:4005/api/design/query-build \
  -H "Content-Type: application/json" \
  -d '{"qbe":{"queryType":"SELECT","tables":[{"schema":"public","name":"users","alias":"u"}],"columns":[{"table":"u","name":"id"},{"table":"u","name":"email"}],"where":[],"orderBy":[{"column":"u.id","direction":"DESC"}],"limit":10},"engine":"postgresql"}'

# Get boilerplate templates
curl http://localhost:4005/api/design/templates/VIEW/postgresql
```

### Full Route Table

| Method | Route | Description | Offline |
|--------|-------|-------------|---------|
| `GET` | `/health` | Health check | ✅ |
| `GET` | `/api/design/engines` | List 4 engines + type mappings | ✅ |
| `POST` | `/api/design/generate` | Generate DDL from design object | ✅ |
| `POST` | `/api/design/validate` | Validate design object structure | ✅ |
| `POST` | `/api/design/query-build` | Build SQL from QBE state | ✅ |
| `GET` | `/api/design/templates/:type/:engine` | Boilerplate templates | ✅ |
| `POST` | `/api/design/build` | Generate + deploy (dryRun:true → offline) | 🟡 |
| `POST` | `/api/design/execute` | Execute SQL against live DB | ❌ |
| `POST` | `/api/design/explain` | EXPLAIN query plan | ❌ |
| `POST` | `/api/design/schema-tables` | Introspect DB tables | ❌ |

## CLI Mode

The Schema Builder also works as a command-line tool directly:

```bash
# Generate DDL from a JSON string
node index.js --json '{"objectType":"TABLE","name":"users","columns":[{"name":"id","type":"SERIAL","primaryKey":true},{"name":"email","type":"VARCHAR","length":255}]}'

# Generate DDL from a JSON file
node index.js --file design.json

# Start the standalone web server (alternative to server.js, port 3005)
node index.js --serve

# Interactive table designer
node index.js --interactive
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                   4WD VIRTUAL SQL SERVER ENGINE                     │
├───────────────────────────┬─────────────────────────────────────────┤
│   DESIGN LAYER (offline)  │   EXECUTION LAYER (optional)            │
│                           │                                         │
│   designer.js             │   builder.js                            │
│     → createDesignObject()│     → dryRun:true  → return text        │
│     → validateDesignObject│     → dryRun:false → pg/mysql2/sql.js   │
│                           │                                         │
│   translator.js           │   Routes requiring DB:                  │
│     → ENGINE_TYPE_MAP     │     POST /api/design/execute            │
│     → resolveColumnType() │     POST /api/design/explain            │
│     → columnDDL()         │     POST /api/design/schema-tables      │
│                           │                                         │
│   ddl-generator.js        │                                         │
│     → generateDDL()       │                                         │
│     → generateAllEngines()│                                         │
│                           │                                         │
│   templates.js            │                                         │
│     → getTemplate()       │                                         │
│                           │                                         │
│   index.js (QBE)          │                                         │
│     → /api/design/query-build                                       │
└───────────────────────────┴─────────────────────────────────────────┘
```

### Design Layer — Zero DB Dependencies

The design layer (`designer.js`, `translator.js`, `ddl-generator.js`, `templates.js`) imports **zero database drivers**. All operations are synchronous pure-JS: object factories, string concatenation, type-map lookups. No `pg`, `mysql2`, `sql.js`, or `mssql` is ever loaded during design operations.

### Execution Layer — Only When You Need It

Only `builder.js` (880 lines) imports database drivers. And even then, the `dryRun: true` path returns immediately before any driver is loaded:

```javascript
async function build(stmts, config) {
  if (cfg.dryRun) {
    return stmts.map(stmt => ({
      statement: stmt,
      status: 'dry-run',
      detail: 'Not executed (dry-run mode)'
    }));
    // ← Returns here. Builder never called.
  }
  return builder(stmts, cfg);  // ← Only reached when dryRun:false
}
```

## Dialect Translation

Type translation is built into the generator — no separate tool needed. The `ENGINE_TYPE_MAP` in `translator.js` maps 30+ canonical types to engine-specific syntax:

```
VARCHAR → PostgreSQL: VARCHAR  |  MySQL: VARCHAR  |  SQLite: TEXT  |  MSSQL: NVARCHAR
SERIAL  → PostgreSQL: SERIAL   |  MySQL: INT AUTO_INCREMENT  |  SQLite: INTEGER  |  MSSQL: INT IDENTITY(1,1)
```

When you specify `SERIAL` as a column type and generate for all 4 engines, the DDL output is automatically translated. This happens in `resolveColumnType()` at translation time, not as a separate post-processing step.

## The VSSE Concept

The Virtual SQL Server Engine pattern **decouples schema design from database connectivity**. The database is treated as a pluggable output target — a configuration parameter in a type-map lookup — not a required runtime dependency.

This is analogous to how a **compiler** works:

| Compiler Concept | VSSE Equivalent |
|------------------|-----------------|
| Source code | Design object / QBE state |
| Frontend | Designer.validate + DDL generator |
| Type system | ENGINE_TYPE_MAP |
| Code generation | Dialect-specific SQL output |
| `--syntax-only` | `dryRun: true` |
| Runtime execution | Live DB connection |

See [docs/VIRTUAL_SQL_SERVER_ENGINE_PAPER.md](docs/VIRTUAL_SQL_SERVER_ENGINE_PAPER.md) for the full paper.

## Deployment

### Railway

```bash
railway login
railway init
railway up -y
```

The service auto-detects Node.js via Railpack and starts with `node server.js`. Health check at `/health`.

## Project Structure

```
├── server.js           Express 4 server (port 4005)
├── index.js            CLI + Express router (dual-mode)
├── lib/
│   ├── designer.js     Object factories + validation
│   ├── translator.js   Engine dialect rules + type maps
│   ├── ddl-generator.js DDL output for 7 object types
│   ├── builder.js      Build + execute + explain + introspect
│   └── templates.js    Boilerplate code templates
├── config/             Engine type mappings
├── public/             Landing page + SPA
├── docs/               VSSE concept paper (MD + PDF)
└── scripts/            PDF generation utility
```

## License

**All Rights Reserved.** © SowinySoft — sowinysoft@gmail.com

No license is granted. The software is provided for viewing purposes only. All copyrights and ownership remain with the author (SowinySoft).
