'use strict';

const assert = require('assert');
const jobs = require('./systems/jobs');

async function main() {
  const order = [];
  const first = jobs.enqueue('test', async () => {
    order.push('first-start');
    await new Promise(r => setTimeout(r, 40));
    order.push('first-end');
    return 'ok';
  }, { concurrency: 1, maxQueue: 2, maxRuntimeMs: 1000 });

  const second = jobs.enqueue('test', async () => {
    order.push('second');
    return 'ok2';
  }, { concurrency: 1, maxQueue: 2, maxRuntimeMs: 1000 });

  const [a,b] = await Promise.all([jobs.wait(first.id), jobs.wait(second.id)]);
  assert.strictEqual(a.status, 'completed');
  assert.strictEqual(b.status, 'completed');
  assert.deepStrictEqual(order, ['first-start', 'first-end', 'second']);

  const stats = jobs.stats();
  assert.ok(stats.completed >= 2);

  console.log('✅ Job manager/media pipeline tests passed');
}

main().catch(error => {
  console.error('❌', error);
  process.exitCode = 1;
});
