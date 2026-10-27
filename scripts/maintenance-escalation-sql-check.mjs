import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {PGlite} from '../.tmp-sb/pglite/node_modules/@electric-sql/pglite/dist/index.js';
const db=new PGlite();
try {
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema private;
 create table public.work_followups(user_id text not null,record jsonb not null);
 alter table public.work_followups enable row level security;
 create policy own on public.work_followups to authenticated using(user_id=current_setting('request.jwt.claim.sub')) with check(user_id=current_setting('request.jwt.claim.sub'));
 grant select,insert,update on public.work_followups to authenticated;
 set request.jwt.claim.sub='qa-a';`);
 await db.exec(await readFile(new URL('../supabase/migrations/20261027162607_client_reminder_escalation.sql',import.meta.url),'utf8'));
 await db.exec('set role authenticated');
 const insert=record=>db.query('insert into public.work_followups values($1,$2)',['qa-a',record]);
 await insert({title:'legacy'});await insert({maintenance:{escalationDays:4,repeatUntilDone:true}});
 for(const escalationDays of [null,0,-1,1.5,'4',3651])await assert.rejects(insert({maintenance:{escalationDays,repeatUntilDone:true}}),/Invalid maintenance escalation/);
 await assert.rejects(insert({maintenance:{escalationDays:4,repeatUntilDone:false}}),/Invalid maintenance escalation/);
 await assert.rejects(db.query('insert into public.work_followups values($1,$2)',['qa-b',{}]),/row-level security/);
 await db.exec("set request.jwt.claim.sub='qa-b'");assert.equal((await db.query('select * from public.work_followups')).rows.length,0);
 await assert.rejects(db.exec('select private.guard_client_maintenance_escalation()'),/permission denied/);
 console.log('Escalation SQL: valid/invalid metadata, legacy compatibility, ownership and private trigger permissions passed.');
}finally{await db.close();}
