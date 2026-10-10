import {goalProgress,dailyTotals,fingerprint} from './lib/workouts.mjs';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localDate=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const today=localDate(new Date());let workouts=[],goals=[],token='',expires=0,clientId='',loaded=false,busy=false,generation=0,pending=null;
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
 catch(e){if(epoch===generation)message(e.message,true);}finally{busy=false;controls();}
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
$('period').onchange=render;$('metric').onchange=render;
function render(){
 $('count').textContent=loaded?workouts.length:'—';$('minutes').textContent=loaded?fmt(workouts.reduce((n,w)=>n+w.minutes,0)):'—';$('distance').textContent=loaded?fmt(workouts.reduce((n,w)=>n+(w.distance||0),0)):'—';$('completed').textContent=loaded?goals.filter(g=>goalProgress(g,workouts)>=g.target).length:'—';
 $('goals').innerHTML=goals.map(g=>{const n=goalProgress(g,workouts),unit={sessions:'sessions',minutes:'minutes',distance:'miles'}[g.metric];return `<div class="goal"><div class="row"><strong>${esc(g.name)}</strong><button class="secondary" data-goal="${esc(g.id)}">Delete</button></div><progress max="${Number(g.target)}" value="${Math.min(n,g.target)}" aria-label="${esc(g.name)} progress"></progress><div class="row"><small>${loaded?fmt(n):'Connect to see progress'} / ${Number(g.target)} ${unit}</small><small>${loaded?Math.min(100,Math.round(n/g.target*100))+'%':'—'}</small></div><p><small>${esc(g.type)} · ${esc(g.start)} to ${esc(g.end)}</small></p></div>`;}).join('')||'<p class="muted">Create a goal to track your next milestone.</p>';
 $('history').innerHTML=[...workouts].sort((a,b)=>b.date.localeCompare(a.date)).map(w=>`<tr><td>${esc(w.date)}</td><td>${esc(w.type)}</td><td>${fmt(w.minutes)}</td><td>${fmt(w.distance)}</td><td>${fmt(w.pace)}</td><td>${fmt(w.calories)}</td><td>${esc(w.source)}</td><td>${esc(w.notes)}</td></tr>`).join('');
 $('empty').hidden=loaded&&workouts.length>0;$('empty').textContent=loaded?'No workouts in Exercise Log yet.':'Connect Google to load your workouts.';
 if(!loaded){$('chart').textContent='Connect Google to see your activity.';return;}
 const period=Number($('period').value),metric=$('metric').value;
 const days=Array.from({length:period},(_,i)=>{const d=new Date();d.setDate(d.getDate()-period+1+i);return localDate(d);});
 const totals=dailyTotals(workouts,days,metric),max=Math.max(1,...totals),width=700/period;
 $('chart').innerHTML=`<svg viewBox="0 0 700 240" role="img" aria-label="${esc(days.map((d,i)=>d+': '+totals[i]+' '+metric).join(', '))}"><line x1="0" y1="190" x2="700" y2="190" stroke="#46516a"/>${totals.map((n,i)=>{const h=n/max*140,x=i*width+width*.15;return `<rect x="${x}" y="${190-h}" width="${width*.7}" height="${h}" rx="3" fill="#b9f568"><title>${days[i]}: ${fmt(n)} ${metric}</title></rect>${period===7?`<text x="${x+width*.35}" y="${180-h}" text-anchor="middle" fill="#eef2fa" font-size="15">${fmt(n)}</text>`:''}${period===7||i%5===0?`<text x="${x+width*.35}" y="220" text-anchor="middle" fill="#aab4c9" font-size="13">${days[i].slice(5)}</text>`:''}`;}).join('')}</svg>`;
}
render();
try{const response=await fetch('/.netlify/functions/config',{cache:'no-store'});if(!response.ok)throw new Error();const config=await response.json();clientId=config.clientId;$('connection').textContent=clientId?'Connect Google to start':'Google connection needs site-owner setup.';if(!clientId)message('Google connection is not configured yet.',true);}catch{message('Connection setup could not load. Try refreshing the page.',true);}
setInterval(()=>{if(token&&!connected()){clearConnection();message('Google connection expired. Reconnect to continue.',true);}controls();},1000);controls();
