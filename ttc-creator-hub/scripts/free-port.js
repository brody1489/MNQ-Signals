'use strict';
/**
 * Windows: kill whatever is LISTENING on PORT (default 3333).
 * Fixes EADDRINUSE and "401 but .env is correct" when an old node.exe still holds the port.
 */
const { execSync } = require('child_process');

const port = String(process.argv[2] || process.env.PORT || '3333').trim();

if (process.platform !== 'win32') {
  try {
    execSync(`lsof -ti:${port} | xargs -r kill -9`, { shell: true, stdio: 'inherit' });
  } catch {
    console.log('(nothing on port ' + port + ' or lsof unavailable)');
  }
  process.exit(0);
}

try {
  const out = execSync('netstat -ano', { encoding: 'utf8' });
  const pids = new Set();
  for (const line of out.split('\n')) {
    if (!line.includes('LISTENING')) continue;
    if (!line.includes(':' + port)) continue;
    const m = line.trim().match(/\s(\d+)\s*$/);
    if (m) pids.add(m[1]);
  }
  if (pids.size === 0) {
    console.log('No LISTENING process found on port ' + port + ' (already free).');
    process.exit(0);
  }
  for (const pid of pids) {
    console.log('Stopping PID ' + pid + ' (was using port ' + port + ')');
    execSync('taskkill /F /PID ' + pid, { stdio: 'inherit' });
  }
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
