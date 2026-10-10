import test from 'node:test';
import assert from 'node:assert/strict';
import workouts from '../netlify/functions/workouts.mjs';
import config from '../netlify/functions/config.mjs';
test('HTTP endpoint requires bearer authorization, rejects other origins and methods',async()=>{
 const unauth=await workouts(new Request('https://stride.test/.netlify/functions/workouts'));assert.equal(unauth.status,401);assert.equal(unauth.headers.get('cache-control'),'no-store');
 const origin=await workouts(new Request('https://stride.test/.netlify/functions/workouts',{headers:{origin:'https://other.test',Authorization:'Bearer anything'}}));assert.equal(origin.status,403);
 const method=await workouts(new Request('https://stride.test/.netlify/functions/workouts',{method:'DELETE'}));assert.equal(method.status,405);
});
test('public config contains only client ID and prevents caching',async()=>{
 const r=await config();assert.equal(r.headers.get('cache-control'),'no-store');assert.deepEqual(Object.keys(await r.json()).sort(),['clientId','configured']);
});
