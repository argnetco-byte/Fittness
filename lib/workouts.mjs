export const HEADERS=['Date','Exercise','Duration (min)','Distance (mi)','Pace (min/mi)','Calories Burned','Source','Notes'];
export function dateKey(value){
 const s=String(value||'').trim();
 let parts=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
 if(!parts){const m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);if(m)parts=[s,m[3],m[1],m[2]];}
 if(!parts)return null;
 const [y,m,d]=parts.slice(1).map(Number), dt=new Date(Date.UTC(y,m-1,d));
 if(dt.getUTCFullYear()!==y||dt.getUTCMonth()!==m-1||dt.getUTCDate()!==d)return null;
 return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
export function category(type){
 const s=String(type).toLowerCase();
 if(/tennis/.test(s))return 'Tennis';
 if(/walk/.test(s))return 'Walking';
 if(/bike|cycl/.test(s))return 'Cycling';
 if(/weight|strength/.test(s))return 'Strength';
 if(/run/.test(s))return 'Running';
 if(/yoga/.test(s))return 'Yoga';
 return 'Other';
}
const optional=n=>n==null||n===''?null:Number.isFinite(Number(n))?Number(n):null;
export function parseRows(rows){
 if(!rows.length||HEADERS.some((h,i)=>rows[0][i]!==h))throw new Error('Exercise Log columns changed. Restore the expected headers before syncing.');
 if(rows[0][8]&&rows[0][8]!=='Stride ID')throw new Error('Column I is already in use. Reserve it as Stride ID before saving.');
 let skipped=0;
 const workouts=rows.slice(1).flatMap((r,i)=>{
  if(!r.some(v=>v!==null&&v!==''))return [];
  const date=dateKey(r[0]),minutes=optional(r[2]);
  if(!date||!r[1]||minutes===null||minutes<=0){skipped++;return [];}
  return [{id:r[8]||`sheet-row-${i+2}`,date,type:String(r[1]),category:category(r[1]),minutes,distance:optional(r[3]),pace:optional(r[4]),calories:optional(r[5]),source:String(r[6]||''),notes:String(r[7]||'')}];
 });
 return {workouts,skipped};
}
export function validateWorkout(w){
 if(!w||!/^[-a-zA-Z0-9]{16,80}$/.test(w.id||''))throw new Error('Invalid save ID.');
 if(!dateKey(w.date)||dateKey(w.date)!==w.date)throw new Error('Use a valid workout date.');
 if(!['Running','Walking','Cycling','Strength','Tennis','Yoga','Other'].includes(w.type))throw new Error('Choose a workout type.');
 if(typeof w.minutes!=='number'||!Number.isFinite(w.minutes)||w.minutes<=0||w.minutes>1440)throw new Error('Duration must be between 0 and 1440 minutes.');
 if(w.distance!==null&&(typeof w.distance!=='number'||!Number.isFinite(w.distance)||w.distance<0||w.distance>1000))throw new Error('Enter a valid distance in miles or leave it blank.');
 if(typeof w.notes!=='string'||w.notes.length>500)throw new Error('Notes must be 500 characters or fewer.');
 return {...w,notes:w.notes.trim()};
}
export function fingerprint(w){return JSON.stringify([w.date,w.category||category(w.type),w.minutes,w.distance,String(w.notes||'').trim()]);}
export function goalProgress(goal,workouts){return workouts.filter(w=>w.date>=goal.start&&w.date<=goal.end&&(goal.type==='All'||w.category===goal.type)).reduce((n,w)=>n+(goal.metric==='sessions'?1:Number(w[goal.metric]||0)),0);}
export function dailyTotals(workouts,dates,metric){return dates.map(date=>workouts.filter(w=>w.date===date).reduce((n,w)=>n+(Number(w[metric])||0),0));}
