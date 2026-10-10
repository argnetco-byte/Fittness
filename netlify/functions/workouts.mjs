import {getStore} from '@netlify/blobs';
import {parseRows} from '../../lib/workouts.mjs';
import {saveWorkout,SyncError} from '../../lib/sync.mjs';
import {ensureIdColumn} from '../../lib/sheet-schema.mjs';
const sheet='1PAyWq5qAPYNMYsmiV69kSh2nXmKw5IB9eB0eay4LMn4';
const root=`https://sheets.googleapis.com/v4/spreadsheets/${sheet}/values/`;
const range=encodeURIComponent("'Exercise Log'!A:I");
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','Vary':'Authorization'}});
export default async function(request){
 if(!['GET','POST'].includes(request.method))return json({error:'Method not allowed.'},405);
 const origin=request.headers.get('origin');
 if(origin&&origin!==new URL(request.url).origin)return json({error:'Origin not allowed.'},403);
 const authorization=request.headers.get('authorization');
 if(!authorization||!/^Bearer [^\s]+$/.test(authorization))return json({error:'Connect your Google account first.'},401);
 async function google(path,options={},base=root){
  const response=await fetch(base+path,{...options,headers:{Authorization:authorization,'Content-Type':'application/json'},signal:AbortSignal.timeout(15000)});
  if(!response.ok){
   const detail=await response.json().catch(()=>({}));
   const reason=typeof detail.error?.message==='string'?detail.error.message.slice(0,500):'No error details supplied.';
   const operation=options.method==='POST'?'save workout':options.method==='PUT'?'set the Stride ID header':'read workouts';
   console.error('Google Sheets request failed',{operation,status:response.status});
   if(response.status===401)throw new SyncError('Google connection expired. Reconnect to continue.',401);
   throw new SyncError(`Google Sheets could not ${operation} (${response.status}): ${reason}`,response.status>=400&&response.status<500?response.status:502);
  }
  return response.json();
 }
 const read=async()=>(await google(range+'?valueRenderOption=FORMATTED_VALUE')).values||[];
 try{
  if(request.method==='GET')return json(parseRows(await read()));
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'Use JSON.'},415);
  const text=await request.text();if(text.length>4096)return json({error:'Request too large.'},413);
  let workout;try{workout=JSON.parse(text);}catch{return json({error:'Invalid JSON.'},400);}
  const store=getStore({name:'stride-write-coordination',consistency:'strong'});
  const result=await saveWorkout({workout,read,store,
   ensureHeader:async()=>{
    await ensureIdColumn((path,options)=>google(path,options,`https://sheets.googleapis.com/v4/spreadsheets/${sheet}`));
    await google(encodeURIComponent("'Exercise Log'!I1")+'?valueInputOption=RAW',{method:'PUT',body:JSON.stringify({values:[['Stride ID']]})});
   },
   append:row=>google(range+':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS',{method:'POST',body:JSON.stringify({values:[row]})})
  });
  return json(result);
 }catch(error){return json({error:error instanceof SyncError?error.message:error.name==='AbortError'||error.name==='TimeoutError'?'Google Sheets timed out. Refresh to check whether your workout saved.':error.message?.startsWith('Exercise Log')||error.message?.startsWith('Column I')?error.message:'Sync could not complete. Refresh before retrying.'},error.status||502);}
}
