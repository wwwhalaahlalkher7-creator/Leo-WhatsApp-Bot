const { backup } = require('./lib/storage/backup');
console.log(JSON.stringify(backup('manual'), null, 2));
