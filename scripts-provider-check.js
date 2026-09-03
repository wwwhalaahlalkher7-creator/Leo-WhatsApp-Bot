const { ai } = require('./lib/providers');

(async () => {
  console.log('AI provider smoke test');
  try {
    const result = await ai.chat('Reply with exactly: OK');
    console.log(`PASS: ${result.provider}`);
    console.log(result.text);
  } catch (error) {
    console.error('FAIL:', error.message);
    if (error.failures) console.error(error.failures.join('\n'));
    process.exitCode = 1;
  }
})();
