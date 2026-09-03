const { listBackups } = require('./lib/storage/backup');
console.log(listBackups().join('\n') || 'No backups');
