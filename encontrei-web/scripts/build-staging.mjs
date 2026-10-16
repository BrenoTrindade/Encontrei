import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

for (const [entry, args] of [
  ['typescript/bin/tsc', ['-b']],
  ['vite/bin/vite.js', ['build']],
]) {
  const result = spawnSync(process.execPath, [join(process.cwd(), 'node_modules', entry), ...args], {
    stdio: 'inherit', env: { ...process.env, CLOUDFLARE_ENV: 'staging' },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
