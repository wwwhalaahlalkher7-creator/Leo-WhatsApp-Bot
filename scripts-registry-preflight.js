'use strict';
const fs=require('fs'),path=require('path');
const root=__dirname, dir=path.join(root,'commands');
function walk(d){let a=[];if(!fs.existsSync(d))return a;for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())a.push(...walk(p));else if(e.isFile()&&e.name.endsWith('.js'))a.push(p)}return a}
const owners=new Map(), errors=[];
function add(v,file,kind){if(!v)return;const k=v.toLowerCase(),p=owners.get(k);if(p&&p.file!==file)errors.push(`Duplicate command name/alias "${v}": ${p.file} (${p.kind}) vs ${file} (${kind})`);else if(!p)owners.set(k,{file,kind})}
for(const f of walk(dir)){const rel=path.relative(root,f),s=fs.readFileSync(f,'utf8');if(!/registry/i.test(path.basename(f)))continue;let m;const nr=/\bname\s*:\s*['"`]([^'"`]+)['"`]/g;while(m=nr.exec(s))add(m[1],rel,'name');for(const key of ['aliases','localizedAliases']){const ar=new RegExp(key+'\\s*:\\s*\\[([^\\]]*)\\]','g');let b;while(b=ar.exec(s)){const ir=/['"`]([^'"`]+)['"`]/g;let x;while(x=ir.exec(b[1]))add(x[1],rel,key)}}}
if(errors.length){console.error('REGISTRY PREFLIGHT FAILED');errors.forEach(e=>console.error(' - '+e));process.exit(1)}
console.log(`Registry preflight OK: ${owners.size} unique names/aliases checked.`);
