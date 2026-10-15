import {weekDays,weekSummary} from './lib/dashboard.mjs';
import {goalProgress,dailyTotals,fingerprint} from './lib/workouts.mjs';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localDate=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const today=localDate(new Date());let workouts=[],goals=[],token='',expires=0,clientId='',loaded=false,busy=false,generation=0,pending=null;
let weekOffset=0;
const fmt=v=>v===null||v===undefined?'—':Number(v.toFixed(2)).toLocaleString();
function message(s,error=false){$('message').textContent=s;$('message').classList.toggle('error',error);}
function persistGoals(){try{localStorage.setItem('stride-goals-v2',JSON.stringify(goals));}catch{message('Browser storage is unavailable. Goals will not survive closing this page.',true);}}
try{
 const saved=JSON.parse(localStorage.getItem('stride-goals-v2'));
 if(Array.isArray(saved))goals=saved;
 else{const old=JSON.parse(localStorage.getItem('stride-fitness-v1'));if(old){goals=(old.goals||[]).map(g=>({...g,target:g.metric==='distance'?Number((g.target/1.609344).toFixed(4)):g.target,name:g.metric==='distance'?String(g.name).replace(/\bkm\b/gi,'miles'):g.name}));persistGoals();}}
 const legacy=JSON.parse(localStorage.getItem('stride-fitness-v1'));
 if(legacy?.workouts?.length){$('legacy').hidden=false;$('legacyRows').innerHTML=legacy.workouts.map(w=>`<p>${esc(w.date)} · ${esc(w.type)} · ${esc(w.minutes)} min · ${esc(w.distance)} km</p>`).join('');}
}catch{}
$('workoutForm').elements.date.value=today;$('workoutForm').elements.date.max=today;$('goalForm').elements.start.value=today;
const end=new Date();end.setDate(end.getDate()+30);$('goalForm').elements.end.value=localDate(end);
function connected(){return Boolean(token)&&Date.now()<expires;}
function controls(){const ok=connected();$('refresh').disabled=!ok||busy;$('disconnect').disabled=!token;$('connect').disabled=!clientId||busy||!window.google?.accounts?.oauth2;$('workoutFields').disabled=!ok||!loaded||busy;}
function clearConnection(){generation++;token='';expires=0;loaded=false;workouts=[];$('connection').textContent='Disconnected';controls();render();}
async function api(method='GET',body){
 if(!connected()){clearConnection();throw new Error('Reconnect Google to continue.');}
 const response=await fetch('/.netlify/functions/workouts',{method,headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store'});
 const data=await response.json();if(!response.ok){if(response.status===401)clearConnection();throw new Error(data.error||'Sync failed.');}return data;
}
async function load(){
 const epoch=generation;busy=true;controls();message('Loading Exercise Log…');
 try{const data=await api();if(epoch!==generation)return;workouts=data.workouts;loaded=true;$('connection').textContent=`Connected · refreshed ${new Date().toLocaleTimeString()}`;render();message(data.skipped?`Loaded ${workouts.length} workouts. ${data.skipped} invalid row(s) were skipped.`:`Loaded ${workouts.length} workouts.`);}
 catch(e){if(epoch===generation){if(loaded)$('connection').textContent='Refresh failed · showing previously loaded workouts';message(e.message,true);}}finally{busy=false;controls();}
}
$('connect').onclick=()=>{
 if(!window.google?.accounts?.oauth2){message('Google authorization is still loading. Try again.',true);return;}
 google.accounts.oauth2.initTokenClient({client_id:clientId,scope:'https://www.googleapis.com/auth/spreadsheets',include_granted_scopes:false,callback:r=>{
  if(r.error||!r.access_token){message('Google connection was not authorized.',true);return;}
  if(!google.accounts.oauth2.hasGrantedAllScopes(r,'https://www.googleapis.com/auth/spreadsheets')){message('Allow Sheets access to sync.',true);return;}
  generation++;token=r.access_token;expires=Date.now()+Number(r.expires_in)*1000-30000;loaded=false;workouts=[];render();load();
 },error_callback:()=>message('Google sign-in closed or could not open. Try Connect Google again.',true)}).requestAccessToken({prompt:'select_account'});
};
$('disconnect').onclick=()=>{clearConnection();message('Disconnected. Workout data cleared from this page.');};$('refresh').onclick=load;
$('goalForm').onsubmit=e=>{e.preventDefault();const f=e.target.elements;if(f.end.value<f.start.value){message('End date must be on or after the start date.',true);return;}goals.push({id:crypto.randomUUID(),name:f.name.value.trim()||'Fitness goal',metric:f.metric.value,type:f.type.value,start:f.start.value,end:f.end.value,target:Number(f.target.value)});persistGoals();f.name.value='';f.target.value='';render();};
$('workoutForm').onsubmit=async e=>{
 e.preventDefault();if(busy||!loaded)return;const f=e.target.elements;
 const w={date:f.date.value,type:f.type.value,minutes:Number(f.minutes.value),distance:f.distance.value===''?null:Number(f.distance.value),notes:f.notes.value.trim()};
 if(!pending||fingerprint(pending)!==fingerprint(w))pending={...w,id:crypto.randomUUID()};
 const epoch=generation;busy=true;controls();message('Saving workout…');
 try{const result=await api('POST',pending);if(epoch!==generation)return;pending=null;f.minutes.value='';f.distance.value='';f.notes.value='';const data=await api();if(epoch!==generation)return;workouts=data.workouts;render();message(result.duplicate?'This workout is already in the Sheet. No duplicate was added.':'Workout saved to Exercise Log.');}
 catch(e){if(epoch===generation)message(e.message,true);}finally{busy=false;controls();}
};
$('goals').onclick=e=>{const b=e.target.closest('[data-goal]');if(b&&confirm('Delete this goal?')){goals=goals.filter(g=>g.id!==b.dataset.goal);persistGoals();render();}};
$('previousWeek').onclick=()=>{weekOffset--;render();};
$('nextWeek').onclick=()=>{if(weekOffset<0)weekOffset++;render();};
$('currentWeek').onclick=()=>{weekOffset=0;render();};
$('period').onchange=render;$('metric').onchange=render;
function render(){
 const selectedDays=weekDays(new Date(),weekOffset),summary=weekSummary(workouts,selectedDays);
 const displayDate=d=>new Date(d+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
 $('weekTitle').textContent=weekOffset===0?'This week':'Weekly progress';
 $('weekRange').textContent=displayDate(selectedDays[0])+' – '+displayDate(selectedDays[6]);
 $('nextWeek').disabled=weekOffset===0;$('currentWeek').disabled=weekOffset===0;
 for(const id of ['minutes','distance','strength','tennis'])$(id).textContent=loaded?fmt(summary[id]):'—';
 $('count').textContent=loaded?summary.sessions:'—';
 $('distanceNote').textContent=loaded&&summary.missingDistance?summary.missingDistance+' workouts have no recorded distance':'Recorded distances only';
 $('completed').textContent=loaded?goals.filter(g=>goalProgress(g,workouts)>=g.target).length:'—';
 $('goals').innerHTML=goals.map(g=>{const n=goalProgress(g,workouts),unit={sessions:'sessions',minutes:'minutes',distance:'miles'}[g.metric];return `<div class="goal"><div class="row"><strong>${esc(g.name)}</strong><button class="secondary" data-goal="${esc(g.id)}">Delete</button></div><progress max="${Number(g.target)}" value="${Math.min(n,g.target)}" aria-label="${esc(g.name)} progress"></progress><div class="row"><small>${loaded?fmt(n):'Connect to see progress'} / ${Number(g.target)} ${unit}</small><small>${loaded?Math.min(100,Math.round(n/g.target*100))+'%':'—'}</small></div><p><small>${esc(g.type)} · ${esc(g.start)} to ${esc(g.end)}</small></p></div>`;}).join('')||'<p class="muted">Create a goal to track your next milestone.</p>';
 $('history').innerHTML=[...workouts].sort((a,b)=>b.date.localeCompare(a.date)).map(w=>`<tr><td>${esc(w.date)}</td><td>${esc(w.type)}</td><td>${fmt(w.minutes)}</td><td>${fmt(w.distance)}</td><td>${fmt(w.pace)}</td><td>${fmt(w.calories)}</td><td>${esc(w.source)}</td><td>${esc(w.notes)}</td></tr>`).join('');
 $('historyCards').innerHTML=[...workouts].sort((a,b)=>b.date.localeCompare(a.date)).map(w=>`<article class="workout-card"><div class="row"><strong>${esc(w.type)}</strong><time datetime="${esc(w.date)}">${esc(w.date)}</time></div><p>${fmt(w.minutes)} min · ${w.distance===null?'Distance not recorded':fmt(w.distance)+' miles'}</p><details><summary>Workout details</summary><dl><dt>Pace</dt><dd>${fmt(w.pace)} min/mi</dd><dt>Calories</dt><dd>${fmt(w.calories)}</dd><dt>Source</dt><dd>${esc(w.source)||'—'}</dd><dt>Notes</dt><dd>${esc(w.notes)||'—'}</dd></dl></details></article>`).join('');
 $('empty').hidden=loaded&&workouts.length>0;$('empty').textContent=loaded?'No workouts in Exercise Log yet.':'Connect Google to load your workouts.';
 if(!loaded){$('chartRange').textContent='';$('chart').textContent='Connect Google to see your activity.';return;}
 const period=Number($('period').value),metric=$('metric').value;
 const days=period===7?selectedDays:Array.from({length:period},(_,i)=>{const d=new Date();d.setDate(d.getDate()-period+1+i);return localDate(d);});
 $('chartRange').textContent=displayDate(days[0])+' – '+displayDate(days[days.length-1]);
 const totals=dailyTotals(workouts,days,metric),max=Math.max(1,...totals);
 $('chart').innerHTML=`<div class="bar-chart" role="img" aria-label="${esc(days.map((d,i)=>d+': '+fmt(totals[i])+' '+metric).join(', '))}">${totals.map((n,i)=>{
 const level=Math.max(0,Math.min(100,Math.round(n/max*100)));
 const label=new Date(days[i]+'T12:00:00').toLocaleDateString(undefined,{weekday:'short'});
 return `<div class="bar-column"><span class="bar-value">${period===7?fmt(n):''}</span><div class="bar-track"><div class="bar-fill level-${level}"></div></div><span class="bar-label">${period===7?label:(i%5===0?days[i].slice(5):'')}</span></div>`;
 }).join('')}</div><details class="chart-data"><summary>View daily values</summary><ul>${days.map((d,i)=>`<li>${d}: ${fmt(totals[i])} ${metric}</li>`).join('')}</ul></details>`;

}
render();
try{const response=await fetch('/.netlify/functions/config',{cache:'no-store'});if(!response.ok)throw new Error();const config=await response.json();clientId=config.clientId;$('connection').textContent=clientId?'Connect Google to start':'Google connection needs site-owner setup.';if(!clientId)message('Google connection is not configured yet.',true);}catch{message('Connection setup could not load. Try refreshing the page.',true);}
setInterval(()=>{if(token&&!connected()){clearConnection();message('Google connection expired. Reconnect to continue.',true);}controls();},1000);controls();
