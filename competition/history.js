'use strict';

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '.سجل المسابقات.json');
const EMPTY = { version: '1.31.0', users: {} };

function clone(v) { return JSON.parse(JSON.stringify(v)); }
function read() {
  try {
    const raw = fs.readFileSync(FILE, 'utf8').trim();
    return raw ? JSON.parse(raw) : clone(EMPTY);
  } catch (error) {
    if (error.code === 'ENOENT') return clone(EMPTY);
    throw error;
  }
}
function write(data) {
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, FILE);
}
function save(userId, record) {
  const data = read();
  data.version = '1.31.0';
  data.users ||= {};
  const key = String(userId);
  data.users[key] ||= [];
  data.users[key].push(record);
  if (data.users[key].length > 100) data.users[key] = data.users[key].slice(-100);
  write(data);
  return record;
}
function latest(userId) {
  const data = read();
  const list = data.users?.[String(userId)] || [];
  return list.length ? list[list.length - 1] : null;
}
module.exports = { FILE, read, save, latest };
