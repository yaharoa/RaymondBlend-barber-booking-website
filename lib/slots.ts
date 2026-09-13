import {BOOKING_WINDOW_DAYS,CLOSE_HOUR,OPEN_HOUR,SLOT_MINUTES,SHOP_TIMEZONE} from "./config";
export function slots(){const a:string[]=[];for(let m=OPEN_HOUR*60;m<CLOSE_HOUR*60;m+=SLOT_MINUTES)a.push(`${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}:00`);return a}
export function today(){const p=new Intl.DateTimeFormat("en-CA",{timeZone:SHOP_TIMEZONE,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const x=Object.fromEntries(p.map(v=>[v.type,v.value]));return `${x.year}-${x.month}-${x.day}`}
export function addDays(s:string,n:number){const d=new Date(s+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
export function maxDate(){return addDays(today(),Math.max(0,BOOKING_WINDOW_DAYS-1))}
