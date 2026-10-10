import test from 'node:test';
import assert from 'node:assert/strict';
import {HEADERS,parseRows,dateKey,category,validateWorkout,goalProgress,dailyTotals} from '../lib/workouts.mjs';
import {saveWorkout} from '../lib/sync.mjs';
const workout={id:'12345678-1234-1234-1234-123456789abc',date:'2026-10-01',type:'Walking',minutes:15,distance:null,notes:''};
function fixture(rows=[HEADERS],appendFailure=false){
 let locked=false,appends=0,lock=null;const data=structuredClone(rows);
 return {read:async()=>structuredClone(data),ensureHeader:async()=>{data[0][8]='Stride ID';},append:async row=>{appends++;data.push(row);if(appendFailure)throw new Error('Lost response');},store:{setJSON:async(key,value)=>{if(locked)return {modified:false};locked=true;lock=value;return {modified:true};},get:async()=>lock,delete:async()=>{locked=false;}},get locked(){return locked;},get appends(){return appends;},data};
}
test('parses US dates, keeps missing distances unknown, classifies actual Sheet exercise labels',()=>{
 const {workouts}=parseRows([HEADERS,['9/30/2026','Tennis — 3 sets','120',null,null,'950','Estimated',''],['10/1/2026','Circuit weights - chest and shoulders','30']]);
 assert.equal(workouts[0].date,'2026-09-30');assert.equal(workouts[0].distance,null);assert.equal(workouts[0].category,'Tennis');assert.equal(workouts[1].category,'Strength');assert.equal(dateKey('2/30/2026'),null);assert.equal(category('Stationary bike'),'Cycling');
});
test('goal and chart totals use category and date window, count unknown distance as no recorded miles',()=>{
 const ws=parseRows([HEADERS,['10/1/2026','Walk','15','0.5'],['10/2/2026','Walk','12'],['9/29/2026','Walk','10','0.4']]).workouts;
 assert.equal(goalProgress({start:'2026-10-01',end:'2026-10-02',type:'Walking',metric:'distance'},ws),.5);
 assert.deepEqual(dailyTotals(ws,['2026-10-01','2026-10-02'],'minutes'),[15,12]);
});
test('saves once and retries by stable ID without another append',async()=>{
 const f=fixture();assert.deepEqual(await saveWorkout({...f,workout}),{duplicate:false});assert.deepEqual(await saveWorkout({...f,workout}),{duplicate:true});assert.equal(f.appends,1);assert.equal(f.data[0][8],'Stride ID');assert.equal(f.data[1][3],'');assert.equal(f.locked,false);
});
test('recognizes existing legacy Sheet workout without ID',async()=>{
 const f=fixture([HEADERS,['10/1/2026','Walk','15',null,null,'59','Estimated','']]);
 assert.deepEqual(await saveWorkout({...f,workout}),{duplicate:true});assert.equal(f.appends,0);
});
test('simultaneous submissions cannot append duplicate rows',async()=>{
 const f=fixture();const results=await Promise.allSettled([saveWorkout({...f,workout}),saveWorkout({...f,workout:{...workout,id:'another-valid-save-1234'}})]);assert.equal(f.appends,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
});
test('uncertain append holds lock; confirmed ID retry reads success without appending',async()=>{
 const f=fixture([HEADERS],true);await assert.rejects(saveWorkout({...f,workout}));assert.equal(f.locked,true);assert.deepEqual(await saveWorkout({...f,workout}),{duplicate:true});assert.equal(f.appends,1);await assert.rejects(saveWorkout({...f,workout:{...workout,id:'different-valid-id-1234',minutes:20}}),/save is in progress/);
});
test('reusing an ID for changed data fails',async()=>{
 const f=fixture();await saveWorkout({...f,workout});await assert.rejects(saveWorkout({...f,workout:{...workout,minutes:25}}),/different workout/);
});
test('validation and schema checks reject invalid data before writing',()=>{
 assert.throws(()=>validateWorkout({...workout,distance:-1}));assert.throws(()=>validateWorkout({...workout,date:'2026-02-30'}));assert.throws(()=>parseRows([['Date','wrong']]));assert.throws(()=>parseRows([[...HEADERS,'Existing notes']]));
});
test('formulas remain literal RAW input and distinct notes can identify separate sessions',async()=>{
 const f=fixture();await saveWorkout({...f,workout:{...workout,notes:'=IMPORTXML("example","x")'}});assert.equal(f.data[1][7],'=IMPORTXML("example","x")');
 await saveWorkout({...f,workout:{...workout,id:'second-valid-id-1234',notes:'second session'}});assert.equal(f.appends,2);
});

test('false-positive lock acquisition never permits a write',async()=>{
 const f=fixture();f.store.setJSON=async()=>({modified:true});f.store.get=async()=>({owner:'another-owner'});
 await assert.rejects(saveWorkout({...f,workout}),/coordination could not be confirmed/);assert.equal(f.appends,0);
});
