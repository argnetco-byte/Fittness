// Calendar dates use local noon to stay stable across daylight-saving changes.
export function localDay(date){return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');}
export function weekDays(anchor=new Date(),offset=0){
 const start=new Date(anchor.getFullYear(),anchor.getMonth(),anchor.getDate(),12);
 start.setDate(start.getDate()-(start.getDay()+6)%7+offset*7);
 return Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);return localDay(d);});
}
export function weekSummary(workouts,days){
 const rows=workouts.filter(w=>w.date>=days[0]&&w.date<=days[6]);
 return {minutes:rows.reduce((n,w)=>n+w.minutes,0),distance:rows.reduce((n,w)=>n+(w.distance??0),0),strength:rows.filter(w=>w.category==='Strength').length,tennis:rows.filter(w=>w.category==='Tennis').length,sessions:rows.length,missingDistance:rows.filter(w=>w.distance===null).length};
}
