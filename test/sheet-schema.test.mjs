import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureIdColumn} from '../lib/sheet-schema.mjs';
test('eight-column Exercise Log gets one ID column on its own tab',async()=>{
 const calls=[];await ensureIdColumn(async(path,options)=>{calls.push({path,options});return {sheets:[{properties:{sheetId:3,title:'Other',gridProperties:{columnCount:8}}},{properties:{sheetId:12,title:'Exercise Log',gridProperties:{columnCount:8}}}]};});
 assert.equal(calls.length,2);assert.equal(calls[1].path,':batchUpdate');
 assert.deepEqual(JSON.parse(calls[1].options.body),{requests:[{appendDimension:{sheetId:12,dimension:'COLUMNS',length:1}}]});
});
test('existing ID column does not expand grid; missing tab fails before write',async()=>{
 let calls=0;await ensureIdColumn(async()=>{calls++;return {sheets:[{properties:{sheetId:12,title:'Exercise Log',gridProperties:{columnCount:9}}}]};});assert.equal(calls,1);
 await assert.rejects(ensureIdColumn(async()=>({sheets:[]})),/grid could not be found/);
});
