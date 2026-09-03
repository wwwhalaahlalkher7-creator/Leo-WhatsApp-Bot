const { restore } = require('./lib/storage/backup');
const name = process.argv[2];
if (!name) throw new Error('Usage: npm run data:restore -- <backup-name>');
console.log(JSON.stringify(restore(name), null, 2));
