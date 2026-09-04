'use strict';
const assert=require('assert');
const xp=require('./systems/xp');
const subs=require('./systems/subscriptions');
(async()=>{
  assert.strictEqual(xp.calculateLevel(0).level,1);
  assert.strictEqual(xp.calculateLevel(100).level,2);
  const a=await xp.add('audit-xp-user',25,'test'); assert(a.xp>=25);
  const sub=await subs.set('audit-sub-user','ultra',1,{test:true}); assert.strictEqual(sub.details.dailyReward,50);
  const c1=await subs.claimDaily('audit-sub-user'); assert.strictEqual(c1.ok,true); assert.strictEqual(c1.amount,50);
  const c2=await subs.claimDaily('audit-sub-user'); assert.strictEqual(c2.ok,false);
  await subs.cancel('audit-sub-user');
  console.log('XP/subscription tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
