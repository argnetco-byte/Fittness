import {randomUUID} from 'node:crypto';
import {parseRows,validateWorkout,fingerprint} from './workouts.mjs';
export class SyncError extends Error {constructor(message,status=400){super(message);this.status=status;}}
// Atomic, non-expiring lock. A crashed or uncertain write fails closed rather than
// permitting a second append. Do not automatically expire or steal this lock.
export async function saveWorkout({workout,read,append,ensureHeader,store}){
 let w;try{w=validateWorkout(workout);}catch(e){throw new SyncError(e.message,400);}
 const existing=parseRows(await read()).workouts;
 const same=existing.find(x=>x.id===w.id);
 if(same){if(fingerprint(same)!==fingerprint(w))throw new SyncError('Save ID already belongs to a different workout.',409);return {duplicate:true};}
 const owner=randomUUID();
 const {modified}=await store.setJSON('sheet-write-lock',{owner,id:w.id,started:new Date().toISOString()},{onlyIfNew:true});
 if(!modified)throw new SyncError('A save is in progress or needs review. Refresh before retrying. If this persists, contact the site owner.',409);
 // Independently verify ownership: SDK conditional writes can report modified
 // for a non-412 service failure. Never append based on that flag alone.
 const lock=await store.get('sheet-write-lock',{type:'json'});
 if(lock?.owner!==owner)throw new SyncError('Save coordination could not be confirmed. Refresh before retrying.',503);
 let safeToUnlock=true;
 try{
  const rows=await read(),current=parseRows(rows).workouts;
  const byId=current.find(x=>x.id===w.id);
  if(byId&&fingerprint(byId)!==fingerprint(w))throw new SyncError('Save ID already belongs to a different workout.',409);
  if(byId||current.some(x=>fingerprint(x)===fingerprint(w)))return {duplicate:true};
  if(!rows[0][8])await ensureHeader();
  safeToUnlock=false; // Any error after append starts may mean Google committed it.
  await append([w.date,w.type,w.minutes,w.distance??'',w.distance>0?Number((w.minutes/w.distance).toFixed(2)):'','','Stride',w.notes,w.id]);
  safeToUnlock=true;
  return {duplicate:false};
 }finally{if(safeToUnlock)await store.delete('sheet-write-lock');}
}
