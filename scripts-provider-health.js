require('dotenv').config();
const { runHealthChecks } = require('./lib/providers/health-check');

(async () => {
  console.log('Provider health check');
  console.log('='.repeat(72));
  const results = await runHealthChecks();
  for (const r of results) {
    const latency = r.latencyMs != null ? ` ${r.latencyMs}ms` : '';
    console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${String(r.name).padEnd(22)} ${r.status}${latency}${r.error ? ` — ${r.error}` : ''}`);
  }
  console.log('='.repeat(72));
  const ok = results.filter(r => r.ok).length;
  console.log(`Reachable: ${ok}/${results.length}`);
  process.exitCode = ok ? 0 : 1;
})();
