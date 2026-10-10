import test from 'node:test';
import assert from 'node:assert/strict';
import workouts from '../netlify/functions/workouts.mjs';
import config from '../netlify/functions/config.mjs';
test('Google rejection exposes operation and reason without logging credentials',async()=>{
 const originalFetch=globalThis.fetch,originalError=console.error;const logs=[];
 try{
  globalThis.fetch=async()=>Response.json({error:{message:'Requested writing within range but tried writing outside it.'}},{status:400});
  console.error=(...args)=>logs.push(args);
  const r=await workouts(new Request('https://stride.test/.netlify/functions/workouts',{headers:{Authorization:'Bearer secret-test-token'}}));
  assert.equal(r.status,400);assert.match((await r.json()).error,/read workouts \(400\).*outside it/);
  assert.ok(!JSON.stringify(logs).includes('secret-test-token'));
 }finally{globalThis.fetch=originalFetch;console.error=originalError;}
});
test('HTTP endpoint requires bearer authorization, rejects other origins and methods',async()=>{
 const unauth=await workouts(new Request('https://stride.test/.netlify/functions/workouts'));assert.equal(unauth.status,401);assert.equal(unauth.headers.get('cache-control'),'no-store');
 const origin=await workouts(new Request('https://stride.test/.netlify/functions/workouts',{headers:{origin:'https://other.test',Authorization:'Bearer anything'}}));assert.equal(origin.status,403);
 const method=await workouts(new Request('https://stride.test/.netlify/functions/workouts',{method:'DELETE'}));assert.equal(method.status,405);
});
test('public config contains only client ID and prevents caching',async()=>{
 const r=await config();assert.equal(r.headers.get('cache-control'),'no-store');assert.deepEqual(Object.keys(await r.json()).sort(),['clientId','configured']);
});
