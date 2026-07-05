const { describe, it, mock } = require('node:test');
const assert = require('node:assert');
const builder = require('../lib/builder');

describe('normalizeConfig', () => {
  it('fills defaults for postgresql', () => {
    const cfg = builder.normalizeConfig({ engine: 'postgresql' });
    assert.strictEqual(cfg.engine, 'postgresql');
    assert.strictEqual(cfg.host, 'localhost');
    assert.strictEqual(cfg.port, 5432);
    assert.strictEqual(cfg.database, ':memory:');
  });

  it('fills defaults for mysql', () => {
    const cfg = builder.normalizeConfig({ engine: 'mysql' });
    assert.strictEqual(cfg.port, 3306);
  });

  it('fills defaults for sqlite', () => {
    const cfg = builder.normalizeConfig({ engine: 'sqlite' });
    assert.strictEqual(cfg.port, 0);
    assert.strictEqual(cfg.host, '');
  });

  it('fills defaults for mssql', () => {
    const cfg = builder.normalizeConfig({ engine: 'mssql' });
    assert.strictEqual(cfg.port, 1433);
  });

  it('preserves provided values', () => {
    const cfg = builder.normalizeConfig({ engine: 'postgresql', host: 'pg.example.com', port: 6543 });
    assert.strictEqual(cfg.host, 'pg.example.com');
    assert.strictEqual(cfg.port, 6543);
  });
});

describe('build (dry-run)', () => {
  it('returns dry-run status for all statements', async () => {
    const results = await builder.build(['CREATE TABLE test (id INT);', '-- comment'], {
      engine: 'postgresql', dryRun: true
    });
    assert.strictEqual(results.length, 2);
    assert.strictEqual(results[0].status, 'dry-run');
    assert.strictEqual(results[1].status, 'dry-run');
  });

  it('throws for unsupported engine', async () => {
    await assert.rejects(
      () => builder.build(['SELECT 1'], { engine: 'oracle', dryRun: true }),
      /Unsupported engine/
    );
  });
});

describe('ENGINES', () => {
  it('exports four engines', () => {
    assert.deepStrictEqual(builder.ENGINES, ['postgresql', 'mysql', 'sqlite', 'mssql']);
  });
});
