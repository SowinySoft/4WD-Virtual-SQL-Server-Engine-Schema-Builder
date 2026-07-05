param([int]$Part=0)
$path = "D:\4WD Virtual SQL Server Engine Schema Builder\public\index.html"
if ($Part -eq 0 -or $Part -eq 1) {
@"
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>4WD Virtual SQL Server Engine — Schema Builder</title>
<link rel="stylesheet" href="/static/fonts/fonts.css">
<style>
:root {
  --void: #04080f; --bg: #080e1a; --surface: #0d1525; --card: #111c30;
  --border: #1a2d4a; --text: #e8f0fe; --text-muted: #7a9cc8; --text-dim: #3a5070;
  --accent: #00d4ff; --accent-hover: #66e5ff; --green: #00e676; --red: #ff3d57;
  --orange: #ff6b2b; --gold: #f0a500; --purple: #9c6cff; --cyan: #00d4ff;
  --font: 'JetBrains Mono','IBM Plex Mono','Cascadia Code','Fira Code',monospace;
  --font-heading: 'Inter','Rajdhani',sans-serif;
  --radius: 6px; --shadow: 0 2px 12px rgba(0,0,0,0.5);
  --glow-cyan: 0 0 16px rgba(0,212,255,0.3); --glow-green: 0 0 16px rgba(0,230,118,0.2);
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: var(--font); background: var(--void); color: var(--text); font-size: 13px; line-height: 1.5; overflow: hidden; height: 100vh; }
body::before { content: ''; position: fixed; inset: 0; background-image: linear-gradient(rgba(0,212,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.025) 1px, transparent 1px); background-size: 36px 36px; pointer-events: none; z-index: 0; }
.app { position: relative; z-index: 1; display: flex; flex-direction: column; height: 100vh; }
.header { display: flex; align-items: center; gap: 12px; padding: 8px 16px; background: var(--surface); border-bottom: 1px solid var(--border); flex-shrink: 0; flex-wrap: wrap; }
.header h1 { font-size: 16px; font-weight: 700; color: var(--accent); white-space: nowrap; font-family: var(--font-heading); letter-spacing: 1px; text-shadow: 0 0 20px rgba(0,212,255,0.3); }
.header select, .header input { background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius); padding: 4px 8px; font-family: var(--font); font-size: 12px; }
.header select:focus, .header input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 8px rgba(0,212,255,0.2); }
.header label { color: var(--text-muted); font-size: 11px; white-space: nowrap; }
.header .actions { margin-left: auto; display: flex; gap: 8px; align-items: center; }
.btn { padding: 5px 14px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); color: var(--text); font-family: var(--font); font-size: 12px; cursor: pointer; transition: all 0.15s; }
.btn:hover { border-color: var(--accent); color: var(--accent-hover); box-shadow: var(--glow-cyan); }
.btn-primary { background: rgba(0,212,255,0.15); border-color: var(--accent); color: var(--accent); }
.btn-primary:hover { background: rgba(0,212,255,0.25); border-color: var(--accent-hover); color: #fff; box-shadow: var(--glow-cyan); }
.btn-success { background: rgba(0,230,118,0.15); border-color: var(--green); color: var(--green); }
.btn-success:hover { background: rgba(0,230,118,0.25); box-shadow: var(--glow-green); }
.btn-danger { border-color: var(--red); color: var(--red); }
.btn-danger:hover { background: rgba(255,61,87,0.2); color: var(--red); border-color: var(--red); box-shadow: 0 0 12px rgba(255,61,87,0.3); }
.btn-small { padding: 3px 10px; font-size: 11px; }
.workspace { display: flex; flex: 1; overflow: hidden; }
.tree-panel { width: 260px; min-width: 200px; display: flex; flex-direction: column; background: var(--surface); border-right: 1px solid var(--border); overflow: hidden; flex-shrink: 0; }
.tree-header { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
.tree-header span { font-size: 12px; font-weight: 700; color: var(--accent); font-family: var(--font-heading); letter-spacing: 0.5px; }
.tree-header .btn { margin-left: auto; font-size: 10px; padding: 2px 8px; }
.tree-search { padding: 4px 8px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
.tree-search input { width: 100%; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius); padding: 3px 8px; font-family: var(--font); font-size: 11px; }
.tree-search input:focus { outline: none; border-color: var(--accent); }
.tree-scroll { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 4px 0; }
.tree-empty { padding: 20px 12px; color: var(--text-muted); font-size: 11px; text-align: center; }
.tree-node { user-select: none; }
.tree-row { display: flex; align-items: center; gap: 4px; padding: 3px 8px; cursor: pointer; border-radius: 3px; margin: 0 4px; font-size: 12px; white-space: nowrap; }
.tree-row:hover { background: rgba(0,212,255,0.08); }
.tree-row.selected { background: rgba(0,212,255,0.12); color: var(--accent); }
.tree-row .tree-arrow { display: inline-flex; align-items: center; justify-content: center; width: 14px; height: 14px; font-size: 8px; color: var(--text-muted); transition: transform 0.15s; flex-shrink: 0; }
.tree-row .tree-arrow.collapsed { transform: rotate(-90deg); }
.tree-row .tree-icon { font-size: 14px; flex-shrink: 0; width: 20px; text-align: center; }
.tree-row .tree-label { overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0; }
.tree-row .tree-badge { font-size: 9px; color: var(--text-muted); background: var(--bg); padding: 0 5px; border-radius: 6px; flex-shrink: 0; }
.tree-children.hidden { display: none; }
.content-area { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
.content-area .main { flex: 1; display: flex; overflow: hidden; }
.designer-panel { width: 55%; min-width: 450px; display: flex; flex-direction: column; border-right: 1px solid var(--border); overflow: hidden; }
.designer-toolbar { display: flex; align-items: center; gap: 8px; padding: 6px 12px; background: var(--surface); border-bottom: 1px solid var(--border); flex-shrink: 0; }
.designer-toolbar span { color: var(--text-muted); font-size: 11px; }
.designer-content { flex: 1; overflow: auto; padding: 12px; }
.grid-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.grid-table th { text-align: left; padding: 6px 8px; background: var(--bg); border-bottom: 2px solid var(--border); color: var(--text-muted); font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; position: sticky; top: 0; z-index: 1; }
.grid-table td { padding: 3px 4px; border-bottom: 1px solid var(--border); vertical-align: middle; }
.grid-table tr:hover td { background: rgba(0,212,255,0.04); }
.grid-table input, .grid-table select { width: 100%; background: transparent; border: none; color: var(--text); font-family: var(--font); font-size: 12px; padding: 4px 6px; border-radius: 3px; }
.grid-table input:focus, .grid-table select:focus { outline: none; background: rgba(0,212,255,0.08); }
.grid-table input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; accent-color: var(--accent); }
.grid-table .col-actions { text-align: center; }
.grid-table .col-actions button { background: none; border: none; color: var(--red); cursor: pointer; font-size: 14px; padding: 2px 4px; opacity: 0.6; }
.grid-table .col-actions button:hover { opacity: 1; }
.grid-table .move-btn { color: var(--text-muted); font-size: 14px; cursor: pointer; padding: 0 4px; opacity: 0.5; }
.grid-table .move-btn:hover { opacity: 1; color: var(--accent); }
.grid-table .col-order { width: 30px; text-align: center; color: var(--text-muted); font-size: 11px; }
.fk-ref-group { display: inline-flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.fk-input { width: 100px; padding: 2px 6px; font-size: 11px; border: 1px solid var(--border); border-radius: 3px; background: var(--bg); color: var(--text); }
.fk-input:focus { border-color: var(--accent); outline: none; }
.code-area { flex: 1; display: flex; flex-direction: column; }
.code-area textarea { flex: 1; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px; font-family: var(--font); font-size: 12px; resize: none; tab-size: 2; line-height: 1.6; }
.code-area textarea:focus { outline: none; border-color: var(--accent); }
.code-area .template-bar { display: flex; gap: 6px; padding: 6px 0; flex-wrap: wrap; }
.schema-form { padding: 12px; }
.schema-form .field { margin-bottom: 10px; }
.schema-form label { display: block; color: var(--text-muted); font-size: 11px; margin-bottom: 3px; }
.schema-form input, .schema-form textarea { width: 100%; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius); padding: 6px 10px; font-family: var(--font); font-size: 12px; }
.schema-form input:focus, .schema-form textarea:focus { outline: none; border-color: var(--accent); }
.preview-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.preview-tabs { display: flex; background: var(--surface); border-bottom: 1px solid var(--border); flex-shrink: 0; }
.preview-tabs button { padding: 7px 16px; background: none; border: none; color: var(--text-muted); font-family: var(--font-heading); font-size: 12px; cursor: pointer; border-bottom: 2px solid transparent; }
.preview-tabs button.active { color: var(--accent); border-bottom-color: var(--accent); }
.preview-tabs button:hover { color: var(--text); }
.preview-content { flex: 1; overflow: auto; position: relative; }
.sql-grid { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; height: 100%; }
.sql-pane { padding: 0; border: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
.sql-pane h3 { flex-shrink: 0; padding: 8px 10px 6px; margin: 0; font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; background: var(--surface); border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 1; }
.sql-pane h3 .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
.sql-pane pre { flex: 1; overflow: auto; margin: 0; padding: 10px; font-family: var(--font); font-size: 11px; white-space: pre-wrap; word-break: break-all; color: var(--text); line-height: 1.5; }
.build-output { padding: 12px; overflow: auto; height: 100%; }
.explain-output { padding: 12px; overflow: auto; height: 100%; }
.explain-output .explain-header { font-size: 12px; margin-bottom: 8px; color: var(--text-muted); }
.explain-output .explain-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
.explain-output .explain-table th { text-align: left; padding: 4px 8px; background: var(--surface); border-bottom: 1px solid var(--border); color: var(--text-muted); font-weight: 500; }
.explain-output .explain-table td { padding: 3px 8px; border-bottom: 1px solid var(--border); color: var(--text); }
.explain-output .explain-error { color: var(--red); font-size: 12px; padding: 12px; background: rgba(255,80,80,0.1); border-radius: var(--radius); }
.build-config { padding: 8px 12px; background: var(--surface); border-top: 1px solid var(--border); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; flex-shrink: 0; }
.build-config label { color: var(--text-muted); font-size: 11px; white-space: nowrap; }
.build-config select, .build-config input { background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius); padding: 3px 6px; font-family: var(--font); font-size: 11px; max-width: 120px; }
.build-config input[type="checkbox"] { accent-color: var(--accent); width: 14px; height: 14px; }
.build-output .result-entry { padding: 4px 0; border-bottom: 1px solid var(--border); font-size: 11px; }
.build-output .result-entry .status { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 10px; margin-right: 6px; }
.status-success { background: rgba(0,230,118,0.15); color: var(--green); border: 1px solid rgba(0,230,118,0.2); }
.status-error { background: rgba(255,61,87,0.15); color: var(--red); border: 1px solid rgba(255,61,87,0.2); }
.status-skipped { background: rgba(122,156,200,0.1); color: var(--text-muted); border: 1px solid rgba(122,156,200,0.1); }
.status-dry-run { background: rgba(255,107,43,0.15); color: var(--orange); border: 1px solid rgba(255,107,43,0.2); }
.build-output .stmt-text { color: var(--text-muted); font-size: 10px; white-space: pre-wrap; word-break: break-all; max-height: 30px; overflow: hidden; cursor: pointer; }
.build-output .stmt-text:hover { color: var(--text); max-height: none; }
.build-output .detail-error { color: var(--red); font-size: 10px; margin-top: 2px; }
.toast { position: fixed; bottom: 20px; right: 20px; padding: 10px 18px; border-radius: var(--radius); background: var(--card); border: 1px solid var(--border); color: var(--text); font-size: 12px; z-index: 9999; box-shadow: 0 4px 24px rgba(0,0,0,0.6); max-width: 400px; display: none; }
.toast.show { display: block; }
.toast.error { border-color: var(--red); box-shadow: 0 4px 24px rgba(255,61,87,0.2); }
.toast.success { border-color: var(--green); box-shadow: 0 4px 24px rgba(0,230,118,0.15); }
.spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(0,212,255,0.15); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.6s linear infinite; vertical-align: middle; margin-right: 6px; }
@keyframes spin { to { transform: rotate(360deg); } }
.mode-toggle { display: flex; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
.mode-toggle button { padding: 4px 14px; border: none; background: transparent; color: var(--text-muted); font-size: 12px; cursor: pointer; letter-spacing: 0.5px; transition: all 0.15s; font-family: var(--font-heading); }
.mode-toggle button.active { background: rgba(0,212,255,0.2); color: var(--accent); box-shadow: inset 0 -2px 0 var(--accent); }
.mode-toggle button:hover:not(.active) { color: var(--text); background: rgba(0,212,255,0.05); }
.context-menu { position: fixed; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: 0 4px 16px rgba(0,0,0,0.4); padding: 4px 0; min-width: 180px; z-index: 9999; font-size: 12px; }
.context-item { padding: 6px 14px; cursor: pointer; display: flex; align-items: center; gap: 8px; color: var(--text); }
.context-item:hover { background: rgba(0,212,255,0.1); color: var(--accent); }
.context-item.danger { color: var(--red); }
.context-item.danger:hover { background: rgba(248,81,73,0.15); }
.context-item .ctx-icon { width: 16px; text-align: center; font-size: 12px; flex-shrink: 0; }
.context-divider { height: 1px; background: var(--border); margin: 4px 0; }
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(4,8,15,0.85); z-index: 9998; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
.modal { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: 0 8px 32px rgba(0,0,0,0.5); padding: 20px 24px; min-width: 400px; max-width: 500px; max-height: 80vh; overflow-y: auto; }
.modal h2 { font-size: 14px; margin-bottom: 16px; color: var(--accent); font-weight: 600; }
.modal .field { margin-bottom: 12px; }
.modal .field label { display: block; color: var(--text-muted); font-size: 11px; margin-bottom: 4px; }
.modal .field input, .modal .field select { width: 100%; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius); padding: 6px 10px; font-family: var(--font); font-size: 12px; }
.modal .field input:focus, .modal .field select:focus { outline: none; border-color: var(--accent); }
.modal .modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
#qbeContainer { display: none; flex-direction: column; flex: 1; overflow: hidden; }
.qbe-header { display: flex; align-items: center; gap: 8px; padding: 6px 12px; background: var(--surface); border-bottom: 1px solid var(--border); flex-shrink: 0; }
.qbe-header select, .qbe-header input { background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius); padding: 3px 6px; font-family: var(--font); font-size: 11px; }
.qbe-header .qbe-actions { margin-left: auto; display: flex; gap: 6px; }
.qbe-header .qbe-status { color: var(--text-muted); font-size: 11px; margin-left: 12px; }
.qbe-main { display: flex; flex: 1; overflow: hidden; }
.qbe-browser { width: 260px; min-width: 200px; display: flex; flex-direction: column; border-right: 1px solid var(--border); overflow: hidden; }
.qbe-panel-title { padding: 6px 10px; background: var(--surface); border-bottom: 1px solid var(--border); font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px; flex-shrink: 0; font-weight: 600; }
.qbe-panel-title .badge { background: rgba(0,212,255,0.12); color: var(--accent); padding: 1px 6px; border-radius: 10px; font-size: 10px; }
.qbe-browser-search { padding: 6px; display: flex; gap: 4px; flex-shrink: 0; }
.qbe-browser-search input { flex: 1; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius); padding: 4px 8px; font-family: var(--font); font-size: 11px; }
.qbe-browser-search input:focus { outline: none; border-color: var(--accent); }
.qbe-browser-list { flex: 1; overflow: auto; padding: 4px 0; }
.qbe-schema { cursor: pointer; }
.qbe-schema-header { padding: 4px 10px; display: flex; align-items: center; gap: 4px; color: var(--text-muted); font-size: 11px; font-weight: 500; }
.qbe-schema-header:hover { color: var(--text); }
.qbe-schema-header .arrow { transition: transform 0.15s; font-size: 9px; }
.qbe-schema-header .arrow.open { transform: rotate(90deg); }
.qbe-schema-header .scount { color: var(--text-muted); font-size: 10px; margin-left: 4px; }
.qbe-table-item { display: flex; align-items: center; gap: 4px; padding: 3px 10px 3px 20px; cursor: pointer; font-size: 11px; color: var(--text); border-radius: 3px; margin: 1px 4px; }
.qbe-table-item:hover { background: rgba(0,212,255,0.08); }
.qbe-table-item.active { background: rgba(0,212,255,0.12); color: var(--accent); }
.qbe-table-item .ticon { color: var(--accent); font-size: 12px; }
.qbe-table-item .tname { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.qbe-table-item .tadd { font-size: 10px; color: var(--green); opacity: 0.6; }
.qbe-table-item:hover .tadd { opacity: 1; }
.qbe-columns { padding-left: 28px; max-height: 0; overflow: hidden; transition: max-height 0.15s; }
.qbe-columns.open { max-height: 400px; overflow: auto; }
.qbe-col-item { padding: 2px 4px; font-size: 10px; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; gap: 4px; border-radius: 2px; }
.qbe-col-item:hover { color: var(--text); background: rgba(0,212,255,0.04); }
.qbe-col-item .col-type { color: var(--text-dim); font-size: 9px; }
.qbe-col-item .col-pk { color: var(--gold); font-size: 9px; }
.qbe-col-item .col-fk { color: var(--accent); font-size: 9px; }
.qbe-canvas { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.qbe-canvas-scroll { flex: 1; overflow: auto; padding: 8px; }
.qbe-tbl-card { border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 8px; background: var(--surface); }
.qbe-tbl-card-header { display: flex; align-items: center; gap: 6px; padding: 6px 10px; background: rgba(0,212,255,0.06); border-bottom: 1px solid var(--border); }
.qbe-tbl-card-header .tname { font-weight: 600; font-size: 12px; }
.qbe-tbl-card-header .talias { color: var(--text-muted); font-size: 11px; }
.qbe-tbl-card-header .tclose { margin-left: auto; cursor: pointer; color: var(--red); font-size: 14px; opacity: 0.6; }
.qbe-tbl-card-header .tclose:hover { opacity: 1; }
.qbe-tbl-card-header input { background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 3px; padding: 2px 6px; font-size: 11px; width: 80px; font-family: var(--font); }
.qbe-tbl-cols { padding: 4px 10px; display: flex; flex-wrap: wrap; gap: 4px; }
.qbe-tbl-cols .col-chip { padding: 2px 8px; border: 1px solid var(--border); border-radius: 12px; font-size: 10px; cursor: pointer; color: var(--text-muted); background: var(--bg); }
.qbe-tbl-cols .col-chip:hover { border-color: var(--accent); color: var(--accent); }
.qbe-tbl-cols .col-chip.selected { border-color: var(--accent); background: rgba(0,212,255,0.1); color: var(--accent); }
.qbe-tbl-cols .col-chip.col-pk { border-color: var(--gold); color: var(--gold); }
.qbe-tbl-cols .col-chip.col-fk { border-color: var(--accent); color: var(--accent); }
.qbe-join { display: flex; align-items: center; gap: 6px; padding: 6px 12px; margin: 0 0 8px 0; background: rgba(57,210,192,0.05); border: 1px dashed var(--cyan); border-radius: var(--radius); flex-wrap: wrap; }
.qbe-join select { background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 3px; padding: 2px 6px; font-size: 11px; font-family: var(--font); }
.qbe-join input { background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 3px; padding: 2px 6px; font-size: 11px; flex: 1; min-width: 150px; font-family: var(--font); }
.qbe-join .jdel { color: var(--red); cursor: pointer; font-size: 14px; opacity: 0.6; }
.qbe-join .jdel:hover { opacity: 1; }
.qbe-cond-row { display: flex; align-items: center; gap: 4px; padding: 3px 0; flex-wrap: wrap; }
.qbe-cond-row select, .qbe-cond-row input { background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 3px; padding: 2px 6px; font-size: 11px; font-family: var(--font); }
.qbe-cond-row input[type="text"] { min-width: 120px; flex: 1; }
.qbe-cond-row .cdel { color: var(--red); cursor: pointer; font-size: 14px; padding: 0 4px; opacity: 0.5; }
.qbe-cond-row .cdel:hover { opacity: 1; }
.qbe-cond-row .clogic { color: var(--text-muted); font-size: 10px; font-weight: 500; }
.qbe-section { margin-bottom: 10px; }
.qbe-section-title { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.qbe-section-title span { color: var(--text-muted); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
.qbe-section-title .btn { font-size: 9px; padding: 2px 8px; }
.qbe-keywords { width: 200px; min-width: 160px; display: flex; flex-direction: column; border-left: 1px solid var(--border); overflow: hidden; }
.qbe-keywords-scroll { flex: 1; overflow: auto; padding: 6px; }
.qbe-kw-cat { margin-bottom: 10px; }
.qbe-kw-cat-title { font-size: 10px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; padding: 0 2px; }
.qbe-kw-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.qbe-kw-chip { padding: 3px 9px; border: 1px solid var(--border); border-radius: 12px; font-size: 10px; cursor: pointer; background: var(--bg); color: var(--text-muted); transition: all 0.1s; }
.qbe-kw-chip:hover { border-color: var(--accent); color: var(--accent); background: rgba(0,212,255,0.08); }
.qbe-kw-chip.clause { border-color: var(--accent); color: var(--accent); }
.qbe-kw-chip.join { border-color: var(--cyan); color: var(--cyan); }
.qbe-kw-chip.op { border-color: var(--orange); color: var(--orange); }
.qbe-kw-chip.agg { border-color: var(--green); color: var(--green); }
.qbe-kw-chip.setop { border-color: var(--purple); color: var(--purple); }
.qbe-kw-chip.dml { border-color: var(--red); color: var(--red); }
.qbe-sql-preview { border-top: 1px solid var(--border); background: var(--surface); flex-shrink: 0; }
.qbe-sql-header { display: flex; align-items: center; gap: 8px; padding: 4px 10px; border-bottom: 1px solid var(--border); }
.qbe-sql-header span { font-size: 11px; color: var(--text-muted); font-weight: 600; letter-spacing: 0.5px; }
.qbe-sql-header .btn { font-size: 10px; padding: 2px 10px; }
.qbe-sql-body { padding: 8px 12px; max-height: 180px; overflow: auto; }
.qbe-sql-body pre { margin: 0; font-family: var(--font); font-size: 11px; white-space: pre-wrap; word-break: break-all; color: var(--text); line-height: 1.5; }
.qbe-results { border-top: 1px solid var(--border); background: var(--surface); flex-shrink: 0; max-height: 300px; overflow: auto; display: none; }
.qbe-results.show { display: block; }
.qbe-results-header { display: flex; align-items: center; gap: 8px; padding: 4px 10px; border-bottom: 1px solid var(--border); font-size: 11px; color: var(--text-muted); font-weight: 600; }
.qbe-results-header .close-btn { margin-left: auto; cursor: pointer; color: var(--text-muted); font-size: 14px; line-height: 1; padding: 0 4px; }
.qbe-results-body { padding: 4px 8px; overflow: auto; }
.qbe-results-table { width: 100%; border-collapse: collapse; font-size: 11px; }
.qbe-results-table th { text-align: left; padding: 3px 8px; background: var(--bg); border-bottom: 1px solid var(--border); color: var(--text-muted); font-weight: 500; position: sticky; top: 0; z-index: 1; }
.qbe-results-table td { padding: 2px 8px; border-bottom: 1px solid var(--border); color: var(--text); max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.qbe-results-table tr:hover td { background: rgba(255,255,255,0.03); }
.qbe-results-msg { padding: 10px 12px; font-size: 11px; border-radius: var(--radius); margin: 6px 0; }
.qbe-results-msg.success { background: rgba(0,230,118,0.1); color: var(--green); border: 1px solid rgba(0,230,118,0.15); }
.qbe-results-msg.error { background: rgba(255,61,87,0.1); color: var(--red); border: 1px solid rgba(255,61,87,0.15); }
.er-container { display: none; flex-direction: column; flex: 1; overflow: hidden; }
.er-toolbar { display: flex; align-items: center; gap: 6px; padding: 4px 12px; background: var(--surface); border-bottom: 1px solid var(--border); flex-shrink: 0; }
.er-toolbar .er-title { font-size: 11px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-right: 8px; }
.er-toolbar .btn { font-size: 10px; padding: 3px 10px; }
.er-toolbar .er-sep { width: 1px; height: 18px; background: var(--border); margin: 0 4px; }
.er-toolbar .er-status { margin-left: auto; color: var(--text-muted); font-size: 10px; }
.er-canvas-wrap { flex: 1; overflow: auto; position: relative; background: var(--bg); }
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: var(--void); }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; border: 1px solid var(--void); }
::-webkit-scrollbar-thumb:hover { background: #2a4a70; }
@media (max-width: 900px) {
  .workspace { flex-direction: column; }
  .tree-panel { width: 100%; max-height: 200px; }
  .content-area .main { flex-direction: column; }
  .designer-panel { width: 100%; min-width: unset; max-height: 50vh; border-right: none; border-bottom: 1px solid var(--border); }
  .sql-grid { grid-template-columns: 1fr; grid-template-rows: auto; }
  .qbe-main { flex-direction: column; }
  .qbe-browser { width: 100%; max-height: 200px; }
  .qbe-keywords { width: 100%; max-height: 150px; }
}
</style>
</head>
<body>
<div class="app">
  <div class="header">
    <h1>4WD Schema Builder</h1>
    <label>Type:</label>
    <select id="objType" onchange="onTypeChange()">
      <option value="TABLE">TABLE</option><option value="VIEW">VIEW</option><option value="FUNCTION">FUNCTION</option>
      <option value="PROCEDURE">PROCEDURE</option><option value="TRIGGER">TRIGGER</option>
      <option value="SCHEMA">SCHEMA</option><option value="ROLE">ROLE</option>
    </select>
    <label>Name:</label>
    <input id="objName" placeholder="object_name" value="users" oninput="onDesignChange()">
    <label>Schema:</label>
    <input id="objSchema" placeholder="public" value="public" oninput="onDesignChange()">
    <div class="mode-toggle">
      <button class="active" onclick="switchMode('designer', this)">Designer</button>
      <button onclick="switchMode('qbe', this)">Query Builder</button>
      <button onclick="switchMode('er', this)">ER Diagram</button>
    </div>
    <div class="actions">
      <button class="btn" onclick="loadSample()">Sample</button>
      <button class="btn" onclick="clearDesign()">Clear</button>
      <button class="btn" onclick="importSQL()">⬆ Import .SQL</button>
      <button class="btn btn-primary" onclick="generatePreview()">Generate SQL</button>
      <button class="btn" onclick="exportSQL()">⬇ Export .SQL</button>
      <button class="btn btn-success" onclick="buildTarget()">▶ Build</button>
      <input type="file" id="sqlFileInput" accept=".sql" style="display:none" onchange="onFileSelected(event)">
    </div>
  </div>
  <div class="workspace">
    <div class="tree-panel" id="treePanel">
      <div class="tree-header">
        <span>🗄 Browser</span>
        <button class="btn" onclick="treeAddDatabase()">+ New DB</button>
      </div>
      <div class="tree-search">
        <input id="treeSearch" placeholder="Filter nodes..." oninput="treeRender()">
      </div>
      <div class="tree-scroll" id="treeContainer">
        <div class="tree-empty">No databases yet. Click <strong>+ New DB</strong> to begin.</div>
      </div>
    </div>
    <div class="content-area">
      <div class="main">
        <div class="designer-panel">
          <div class="designer-toolbar">
            <span id="colCount">0 columns</span>
            <button class="btn" id="addColBtn" onclick="addColumn()">+ Add Column</button>
            <button class="btn" id="addConstraintBtn" onclick="addConstraint()" style="display:none">+ Constraint</button>
            <button class="btn" id="loadTemplateBtn" onclick="loadTemplate()" style="display:none">Load Template</button>
            <button class="btn" style="border-color:var(--green);color:var(--green);margin-left:auto" onclick="saveToTree()">💾 Save</button>
          </div>
          <div class="designer-content" id="designerContent"></div>
        </div>
        <div class="preview-panel">
          <div class="preview-tabs">
            <button class="active" onclick="switchPreviewTab('sql', this)">SQL Preview</button>
            <button onclick="switchPreviewTab('build', this)">Build Output</button>
            <button onclick="switchPreviewTab('explain', this)">Explain Results</button>
          </div>
          <div class="preview-content" id="previewContent">
            <div class="sql-grid" id="sqlGrid">
              <div class="sql-pane"><h3><span class="dot" style="background:#336791"></span>PostgreSQL</h3><pre id="sqlPostgresql">-- Click "Generate SQL" to preview</pre></div>
              <div class="sql-pane"><h3><span class="dot" style="background:#f29111"></span>MySQL</h3><pre id="sqlMysql">-- Click "Generate SQL" to preview</pre></div>
              <div class="sql-pane"><h3><span class="dot" style="background:#003b57"></span>SQLite</h3><pre id="sqlSqlite">-- Click "Generate SQL" to preview</pre></div>
              <div class="sql-pane"><h3><span class="dot" style="background:#cc2927"></span>MSSQL</h3><pre id="sqlMssql">-- Click "Generate SQL" to preview</pre></div>
            </div>
            <div class="build-output" id="buildOutput" style="display:none"><div id="buildResults"></div></div>
            <div class="explain-output" id="explainOutput" style="display:none"><div id="explainResults"></div></div>
          </div>
          <div class="build-config">
            <label>Target:</label>
            <select id="buildEngine"><option value="postgresql">PostgreSQL</option><option value="mysql">MySQL</option><option value="sqlite">SQLite</option><option value="mssql">MSSQL</option></select>
            <label>Host:</label><input id="buildHost" value="localhost" placeholder="host">
            <label>Port:</label><input id="buildPort" value="5432" placeholder="5432" style="width:60px">
            <label>DB:</label><input id="buildDb" value="postgres" placeholder="db" style="width:80px">
            <label>User:</label><input id="buildUser" value="postgres" placeholder="user" style="width:80px">
            <label>Pass:</label><input id="buildPass" type="password" placeholder="password" style="width:80px">
            <label><input type="checkbox" id="buildDryRun" checked> Dry-run</label>
            <label style="border-left:1px solid var(--border);padding-left:10px"><input type="checkbox" id="explainAnalyze"> Analyze</label>
            <button class="btn" onclick="runExplain()" style="margin-left:4px">⚡ Explain</button>
          </div>
        </div>
      </div>
"@ | Set-Content -LiteralPath $path
}
