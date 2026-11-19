import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WorkStore } from '../modules/WorkStore.js';
import { createBackupPayload, parseAndValidateBackupText } from '../backup-utils.mjs';
import { WORK_KEY } from '../work-utils.mjs';

const root = fileURLToPath(new URL('../',import.meta.url));
const { Client } = createRequire(import.meta.url)(process.env.LIFECYCLE_RECOVERY_PG_MODULE || 'pg');
const bin = process.env.LIFECYCLE_POSTGRES_BIN || '';
const run = promisify(execFile);
const pgTool = (name,args) => run(path.join(bin,name+(process.platform==='win32'?'.exe':'')),args,{windowsHide:true});
// On Windows the server can inherit pg_ctl's pipes and keep execFile waiting
// after the controller itself has already reported readiness.
function control(args) {
    return new Promise((resolve,reject) => {
        const executable = path.join(bin,process.platform==='win32'?'pg_ctl.exe':'pg_ctl');
        const processHandle = spawn(executable,args,{windowsHide:true,stdio:'ignore'});
        processHandle.once('error',reject);
        processHandle.once('exit',code=>code===0?resolve():reject(new Error('pg_ctl exited '+code)));
    });
}
const tempRoot = await fs.realpath(os.tmpdir());
const scratch = await fs.mkdtemp(path.join(tempRoot,'lifecycle-recovery-'));
const dataDir = path.join(scratch,'data');
const migrationsDir = path.join(root,'supabase','migrations');
const migrations = (await fs.readdir(migrationsDir)).filter(name=>name.endsWith('.sql')).sort();
const password = randomBytes(32).toString('hex');
const owner = randomUUID(), peer = randomUUID(), connections = [];
const digest = data => createHash('sha256').update(data).digest('hex');
let started = false, port;

async function connect(database) {
    const client = new Client({host:'127.0.0.1',port,user:'postgres',password,database,connectionTimeoutMillis:8000});
    await client.connect(); connections.push(client); return client;
}

async function build(db) {
    await db.query(await fs.readFile(new URL('recovery-provider-fixture.sql',import.meta.url),'utf8'));
    await db.query(await fs.readFile(path.join(root,'supabase/recovery/before_migrations.sql'),'utf8'));
    for (const name of migrations) {
        try { await db.query(await fs.readFile(path.join(migrationsDir,name),'utf8')); }
        catch (error) { throw new Error(name+': '+error.message,{cause:error}); }
    }
    await db.query('insert into auth.users values ($1),($2)',[owner,peer]);
    await db.query("insert into private.lifecycle_access_profiles(user_id,access_tier) values ($1,'owner')",[owner]);
}

async function identity(db, id) {
    await db.query('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
    await db.query('set role authenticated');
}

// Use the same snapshot and transactional restore as the browser. This adapter
// only transports the three WorkStore RPCs over the disposable SQL connection.
function storeFor(db) {
    const queries = {
        get_work_state: ['select public.get_work_state() as v',()=>[]],
        work_backup_snapshot: ['select public.work_backup_snapshot() as v',()=>[]],
        save_work_state: ['select public.save_work_state($1,$2,$3,$4) as v',
            p=>[p.p_state,p.p_expected_revision,p.p_updates,p.p_delete_keys]]
    };
    const auth = { user:{id:owner}, readyUserId:owner, syncGeneration:1,
        flushPendingKeySync:async()=>true, checkAndSyncData:async()=>true,
        supabase:{rpc:async(name,params)=>{
            const [sql,args]=queries[name];
            try { return {data:(await db.query(sql,args(params))).rows[0].v}; }
            catch(error) { return {error}; }
        }}
    };
    return new WorkStore({auth});
}

async function exercise(source,target) {
    const storagePath=owner+'/study/fixture.png';
    const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6pDL0AAAAASUVORK5CYII=','base64');
    const records = {
        tareas_list: [{id:randomUUID(),text:'Tarea sintética',category:'Personal'}],
        health_blood_tests:[{id:'qa-study',date:'2026-11-19',storagePath,fileName:'fixture.png',isCloudFile:true}],
        finanzasData:{entries:[{id:'usd',amount:20,nativeCurrency:'USD',nativeAmountMinor:2000,exchangeRate:1}],
            expenses:[{id:'ars',amount:5,nativeCurrency:'ARS',nativeAmountMinor:500000,exchangeRate:1000}]}
    };
    globalThis.localStorage={setItem(){},removeItem(){}};
    await identity(source,owner);
    const work=storeFor(source);
    const blank=await work.load();
    const clientId=randomUUID();
    await work.save({...blank,clients:[{id:clientId,name:'Cliente sintético',contact:'',context:'',archived:false}]});
    const updates=Object.fromEntries(Object.entries(records).map(([k,v])=>[k,JSON.stringify(v)]));
    await source.query('select public.merge_user_data_keys($1,$2)',[{...updates,__expected_task_list:null},[]]);
    const objectSQL='insert into storage.objects(bucket_id,name,owner) values ($1,$2,$3)';
    await source.query(objectSQL,['blood-tests',storagePath,owner]);
    const sourceFile=path.join(scratch,'source-blob'), backupFile=path.join(scratch,'attachment-backup');
    await fs.writeFile(sourceFile,image); await fs.copyFile(sourceFile,backupFile);
    const snapshot=await work.backupSnapshot();
    const exported=createBackupPayload(key=>snapshot[key]??null);
    const backupPath=path.join(scratch,'LifeCycle_Backup.json');
    await fs.writeFile(backupPath,JSON.stringify(exported));
    const backupText=await fs.readFile(backupPath,'utf8');
    assert.ok(!backupText.includes(image.toString('base64')));
    const plan=parseAndValidateBackupText(backupText);
    await identity(target,owner);
    const recovered=storeFor(target);
    await recovered.load();
    assert.equal(recovered.value.clients.length,0);
    await recovered.restore(plan);
    const after=await recovered.backupSnapshot();
    for (const [key,value] of Object.entries(records)) assert.deepEqual(JSON.parse(after[key]),value);
    assert.deepEqual(JSON.parse(after[WORK_KEY]).clients,JSON.parse(snapshot[WORK_KEY]).clients);
    const visibility='select name from storage.objects where bucket_id=$1 and name=$2';
    const object=['blood-tests',storagePath];
    assert.equal((await target.query(visibility,object)).rowCount,0);
    // Storage bytes have their own backup. Restore the blob and original owner-prefixed key.
    const restoredFile=path.join(scratch,'restored-blob');
    await fs.copyFile(backupFile,restoredFile);
    assert.equal(digest(await fs.readFile(restoredFile)),digest(image));
    await target.query(objectSQL,[...object,owner]);
    assert.equal((await target.query(visibility,object)).rowCount,1);
    // A stale restore must roll back Trabajo and Personal together.
    const oldState=recovered.value;
    await assert.rejects(target.query('select public.save_work_state($1,$2,$3,$4)',[
        {...oldState,revision:oldState.revision+1,clients:[{...oldState.clients[0],name:'Rejected'}]},
        oldState.revision,{tareas_list:'[]',__expected_task_list:null},[]
    ]),e=>e.code==='40001');
    assert.deepEqual(await recovered.backupSnapshot(),after);
    await identity(target,peer);
    assert.equal((await target.query(visibility,object)).rowCount,0);
    const peerSnapshot=(await target.query('select public.work_backup_snapshot() as v')).rows[0].v;
    assert.deepEqual(peerSnapshot.work.clients,[]);
    assert.equal(peerSnapshot.personal?.tareas_list,undefined);
    assert.equal((await target.query('select count(*)::int n from public.user_data where user_id=$1',[owner])).rows[0].n,0);
}

try {
    const pwfile=path.join(scratch,'init-password');
    await fs.writeFile(pwfile,password,{mode:0o600});
    await pgTool('initdb',['-D',dataDir,'-U','postgres','--auth=scram-sha-256','--pwfile='+pwfile,'--encoding=UTF8','--locale=C']);
    await fs.unlink(pwfile);
    const socket=createServer();
    await new Promise((resolve,reject)=>socket.once('error',reject).listen(0,'127.0.0.1',resolve));
    port=socket.address().port;
    await new Promise(resolve=>socket.close(resolve));
    await control(['-D',dataDir,'-l',path.join(scratch,'postgres.log'),'-o',`-p ${port} -h 127.0.0.1 -c wal_level=logical`,'-w','start']);
    started=true;
    const admin=await connect('postgres');
    await admin.query('create role anon; create role authenticated; create role service_role bypassrls;');
    await admin.query('create database lifecycle_source'); await admin.query('create database lifecycle_restore');
    const source=await connect('lifecycle_source'), target=await connect('lifecycle_restore');
    await build(source); await build(target);
    const catalogSql=await fs.readFile(path.join(root,'supabase/verification/recovery_catalog.sql'),'utf8');
    const catalog=(await target.query(catalogSql)).rows;
    assert.deepEqual((await source.query(catalogSql)).rows,catalog);
    if(process.argv[2]) await fs.writeFile(process.argv[2],JSON.stringify(catalog,null,2));
    await exercise(source,target);
    const version=(await admin.query('show server_version')).rows[0].server_version;
    console.log(JSON.stringify({postgres:version,migrationsPerDatabase:migrations.length,rebuiltDatabases:2,
        usdAndArs:true,tasks:true,client:true,attachmentBytesAndReference:true,ownerIsolation:true,atomicRollback:true}));
} finally {
    await Promise.allSettled(connections.map(client=>client.end()));
    if (started) await control(['-D',dataDir,'-m','fast','-w','stop']);
    const resolved=await fs.realpath(scratch);
    if (path.dirname(resolved)===tempRoot && path.basename(resolved).startsWith('lifecycle-recovery-')) {
        await fs.rm(resolved,{recursive:true,force:true});
    }
}
