import test from 'node:test';
import assert from 'node:assert/strict';
import {weekDays,weekSummary} from '../lib/dashboard.mjs';
import {parseRows,HEADERS,goalProgress,dailyTotals} from '../lib/workouts.mjs';
test('Monday–Sunday boundaries include Sunday and cross years',()=>{
 assert.deepEqual(weekDays(new Date(2026,9,18,23)),['2026-10-12','2026-10-13','2026-10-14','2026-10-15','2026-10-16','2026-10-17','2026-10-18']);
 assert.equal(weekDays(new Date(2026,9,19))[0],'2026-10-19');
 assert.equal(weekDays(new Date(2027,0,1))[0],'2026-12-28');
 assert.equal(weekDays(new Date(2026,9,15),-1)[0],'2026-10-05');
});
test('calendar days remain consecutive over daylight-saving boundaries',()=>{
 assert.deepEqual(weekDays(new Date(2026,10,1)).slice(-2),['2026-10-31','2026-11-01']);
 assert.equal(weekDays(new Date(2026,2,8))[6],'2026-03-08');
});
test('weekly cards use normalized Sheet categories and exclude adjacent weeks',()=>{
 const rows=parseRows([HEADERS,['10/12/2026','Walk',20,1],['10/13/2026','Circuit weights - chest',30],['10/18/2026','Tennis — 3 sets',90],['10/19/2026','Walk',60,3]]).workouts;
 assert.deepEqual(weekSummary(rows,weekDays(new Date(2026,9,15))),{minutes:140,distance:1,strength:1,tennis:1,sessions:3,missingDistance:2});
 assert.deepEqual(dailyTotals(rows,weekDays(new Date(2026,9,15)),'minutes'),[20,30,0,0,0,0,90]);
 assert.equal(goalProgress({start:'2026-10-12',end:'2026-10-19',type:'All',metric:'minutes'},rows),200);
 assert.deepEqual(weekSummary([],weekDays()),{minutes:0,distance:0,strength:0,tennis:0,sessions:0,missingDistance:0});
});
