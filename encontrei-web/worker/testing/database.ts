import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

export function createTestDatabase() {
  const sqlite = new DatabaseSync(':memory:');
  for (const name of readdirSync('migrations').filter((file) => file.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(`migrations/${name}`, 'utf8'));
  }
  sqlite.exec(readFileSync('scripts/seed-dev.sql', 'utf8'));
  sqlite.exec(`UPDATE opportunity_snapshot SET breakdown_json = '[{"factor":"tide","normalizedValue":0.8,"contribution":24,"maxContribution":30,"explanation":"Maré prevista."}]';`);
  function prepare(sql: string, values: SQLInputValue[] = []) {
    const statement = sqlite.prepare(sql);
    const run = async () => ({ success: true, meta: statement.run(...values) });
    return {
      bind: (...parameters: SQLInputValue[]) => prepare(sql, parameters),
      first: async () => statement.get(...values) ?? null,
      all: async () => ({ results: statement.all(...values), success: true }),
      run,
    };
  }
  const database = {
    prepare,
    batch: async (statements: Array<{ run: () => Promise<unknown> }>) => {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  } as unknown as D1Database;
  return { sqlite, database };
}
