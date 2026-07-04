# 4WD Virtual SQL Server Engine — Schema Builder (Agent Memory)

**Version**: 1.0.0 — Standalone Express web server for the Virtual SQL Server Engine pattern.

## Overview

A standalone Express server implementing the **Virtual SQL Server Engine (VSSE)** pattern — design database schemas, build QBE queries, generate DDL for 4 engines, all offline with no DB connection required. Born from the Hexagon Web Framework's Schema Builder tool as a dedicated standalone project.

## Architecture

```
4WD VSSE Schema Builder/
├── server.js                 # Express 4 server (20 lines, port 4005, mounts lib/routes.js)
├── package.json              # Deps: express, pg, mysql2, sql.js, mssql, commander
├── railway.json              # Railpack deploy config
├── AGENTS.md                 # This file
├── README.md
├── .gitignore
├── .env.example
├── index.js                  # CLI entry + module exports (~120 lines, dual-mode)
├── config/
│   ├── default.json          # Engine type mappings and categories (port 4005)
│   └── index.js              # Config loader
├── lib/
│   ├── routes.js             # Express router — all API routes (342 lines, extracted from index.js)
│   ├── designer.js           # Design object factories + validation (307 lines)
│   ├── translator.js         # Engine dialect rules / type maps (227 lines)
│   ├── ddl-generator.js      # DDL generation for 7 object types (423 lines)
│   ├── builder.js            # Build + execute + explain + introspect (880 lines)
│   └── templates.js          # Boilerplate code templates (173 lines)
├── plugins/
│   └── README.md
├── public/
│   ├── index.html            # Full SPA — Tree browser, table designer, 4-pane DDL, canvas-based QBE, ER diagram, build/explain, modals, toasts (~1500 lines)
│   └── fonts/                # Local font files (Inter, JetBrains Mono)
├── docs/
│   ├── VIRTUAL_SQL_SERVER_ENGINE_PAPER.md   # VSSE concept paper
│   └── VIRTUAL_SQL_SERVER_ENGINE_PAPER.pdf  # Printable PDF
├── scripts/
│   └── generate-paper-pdf.js # PDF generation from markdown
└── test/                     # Node --test test files
```

## API Routes

| Method | Route | Description | Offline? |
|--------|-------|-------------|----------|
| GET | `/health` | Health check — `{status, service, version}` | ✅ Yes |
| GET | `/` | Landing page | ✅ Yes |
| GET | `/api/design/engines` | List 4 engines (postgresql, mysql, sqlite, mssql) with type maps | ✅ Yes |
| POST | `/api/design/generate` | Generate DDL from design object — all 4 engines at once or single | ✅ Yes |
| POST | `/api/design/validate` | Validate design object structure (names, columns, constraints) | ✅ Yes |
| POST | `/api/design/query-build` | Build SELECT/INSERT/UPDATE/DELETE SQL from QBE state | ✅ Yes |
| GET | `/api/design/templates/:type/:engine` | Boilerplate VIEW/FUNCTION/PROCEDURE/TRIGGER templates | ✅ Yes |
| POST | `/api/design/build` | Generate DDL + optionally deploy (dryRun: true → offline) | 🟡 Dry-run |
| POST | `/api/design/execute` | Execute SQL against live database | ❌ Requires DB |
| POST | `/api/design/explain` | EXPLAIN query plan | ❌ Requires DB |
| POST | `/api/design/schema-tables` | Introspect database tables/views | ❌ Requires DB |

## The VSSE Pattern (Virtual SQL Server Engine)

### Core Principle
The design layer and execution layer are fully decoupled. The database engine is treated as a **configuration parameter** — a key in a type-map lookup table with dialect rules — not a live connection. The dry-run mode is the default control flow, not a debugging feature.

### Design Layer — Fully Offline (5 routes)
All design-layer operations run synchronously on pure JavaScript objects with zero database imports:

| Module | Lines | Function | I/O |
|--------|-------|----------|-----|
| `designer.js` | 307 | `createDesignObject()`, `validateDesignObject()` | None |
| `translator.js` | 227 | `ENGINE_TYPE_MAP` (30+ types × 4 engines), `columnDDL()`, `resolveColumnType()` | None |
| `ddl-generator.js` | 423 | `generateDDL()`, `generateAllEngines()` for TABLE/VIEW/SCHEMA/FUNCTION/PROCEDURE/TRIGGER/ROLE | None |
| `templates.js` | 173 | `getTemplate()` — hardcoded boilerplate for VIEW, FUNCTION, PROCEDURE, TRIGGER × 4 engines | None |
| `index.js` (QBE) | 150+ lines | QBE → SQL: FROM, JOINs, WHERE, GROUP BY, HAVING, ORDER BY, LIMIT, UNION | None |

### Execution Layer — Optional (3 routes + 1 hybrid)
- `builder.js` (880 lines) — The only module importing DB drivers:
  - `dryRun: true` → returns immediately with `status: 'dry-run'`, no DB call
  - `dryRun: false` → connects via `pg` / `mysql2` / `sql.js` / `mssql`
- Routes: `/api/design/execute`, `/api/design/explain`, `/api/design/schema-tables`, `/api/design/build`

### The Dry-Run First flow
```
Design Object → generateDDL() → dryRun:true → DDL text returned  [zero I/O]
                                        ↓
                               dryRun:false → pg/mysql2/sql.js/mssql  [network I/O]
```

## Git History

This is commit 1 — standalone project forked from Hexagon Web Framework v3.14.1 Schema Builder tool.

| Date | Commit | Description |
|------|--------|-------------|
| 2026-07-03 | `initial` | Fork from Hexagon Web Framework: Schema Builder as standalone VSSE project |
| 2026-07-04 | `refactor-spa` | Major refactor: extracted routes.js from index.js, refactored server.js to 20 lines, full SPA index.html (5 tabs), local fonts, added test/ dir, port 4005, type map expansion |
| 2026-07-04 | `squash-spa-v2` | Ported 12 features from Hexagon reference: tree browser (localStorage), table designer (FK/PK/UK inline), code editor (VIEW/FUNCTION/PROCEDURE/TRIGGER), 4-pane SQL grid, build/explain output, QBE canvas (tables/joins/conditions/group/order/union/keywords/results), ER diagram (SVG), modals, toasts, import/export SQL, schema/role forms, keyboard shortcuts. index.html: 633→1396 lines. |
| 2026-07-04 | `gap-analysis-port` | Gap analysis vs Hexagon reference: ported comment column + FK auto-defaults (`NO ACTION`) + debounced preview (800ms); export with header/engine detection on import via `detectEngine()`; canvas-based QBE with table browser (drag-to-add), table cards with column chips, auto-join detection by FK name, visual WHERE/GROUP/HAVING/ORDER by sections with field dropdowns, keyword chips, debounced auto-generate (1s), syntax check badge, execute with loading spinner + clear confirmation dialog. index.html: ~1500 lines. |

## Deployment (Railway)

- **Repo**: `https://github.com/SowinySoft/4WD-Virtual-SQL-Server-Engine-Schema-Builder`
- **Port**: 4005 (auto-detected from `$PORT`)
- **Config**: `railway.json` with Railpack auto-detect, `node server.js` start command
- **Health check**: `/health` → `{"status":"ok","service":"4wd-vsse-schema-builder","version":"1.0.0"}`

## Key Decisions

- **Dual-mode entry point**: `index.js` has `require.main === module` for CLI (`--serve`, `--json`, `--file`) and exports `{ router, ... }` for Express integration. `server.js` mounts the exported router — no code duplication with the CLI `--serve` path.
- **Design layer has zero DB driver dependencies**: `designer.js`, `translator.js`, `ddl-generator.js`, `templates.js` never import `pg`, `mysql2`, `sql.js`, or `mssql`. Only `builder.js` imports database drivers.
- **Dialect translation built into the generator**: `ENGINE_TYPE_MAP` in `translator.js` maps 30+ canonical types to each engine's syntax. When `generateDDL()` calls `resolveColumnType()`, the translation happens inline — no separate dialect translation step needed.
- **VSSE pattern documented**: See `docs/VIRTUAL_SQL_SERVER_ENGINE_PAPER.md` for the full concept paper describing how the Virtual SQL Server Engine pattern decouples schema design from database connectivity.

## License

**All Rights Reserved.** © SowinySoft — sowinysoft@gmail.com

No license is granted. The software is provided for viewing purposes only. All copyrights and ownership remain with the author (SowinySoft).
