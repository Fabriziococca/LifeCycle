function installFakeCloud() {
    const user = { id: '11111111-1111-4111-8111-111111111111', email: 'qa@example.invalid' };
    const cloudDocument = JSON.parse(sessionStorage.getItem('qa-cloud-document') || '{}');
    window.qaCloudDocument = () => structuredClone(cloudDocument);
    let revision = 1;
    let work=JSON.parse(sessionStorage.getItem('qa-work')||'null')||{version:1,revision:0,clients:[],links:[],followups:[],notes:[],settings:{dailyEnabled:false,dailyTime:'15:00',financeScopes:{}}};
    const listeners = new Set();
    window.qaSyncMetrics = { writes: 0, realtimeEvents: 0, fullReads: 0, revisionReads: 0, transcriptionReads: 0 };
    window.qaAuthListeners = [];
    window.qaReconfirmSession = () => window.qaAuthListeners.forEach(callback => callback('SIGNED_IN', { user }));
    const tables = { transcription_folders: [], transcription_sessions: [], transcription_documents: [] };
    class Query {
        constructor(table) { this.table = table; this.one = false; }
        select(columns) { this.columns = columns; return this; } eq() { return this; } order() { return this; }
        limit() { return this; } in() { return this; } is() { return this; }
        range() { return this; }
        abortSignal() { return this; }
        single() { this.one = true; return this; }
        maybeSingle() { this.one = true; return this; }
        insert(value) { this.value = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...value }; (tables[this.table] ||= []).push(this.value); return this; }
        then(resolve) {
            if (this.table.startsWith('transcription_')) window.qaSyncMetrics.transcriptionReads++;
            if (this.table === 'user_data') {
                window.qaSyncMetrics[this.columns === 'revision' ? 'revisionReads' : 'fullReads'] += 1;
            }
            const data = this.table === 'user_data' ? { user_id: user.id, data: structuredClone(cloudDocument), updated_at: '2026-09-05T00:00:00Z', revision }
                : this.one ? this.value || null : tables[this.table] || [];
            return Promise.resolve({ data, error: null }).then(resolve);
        }
    }
    window.supabase = { createClient: () => ({
        auth: {
            getSession: async () => ({ data: { session: sessionStorage.getItem('qa-signed-out') ? null : { user, access_token: 'qa-session' } } }),
            onAuthStateChange: callback => { window.qaAuthListeners.push(callback); return { data: { subscription: { unsubscribe() {} } } }; },
            signOut: async () => {
                sessionStorage.setItem('qa-signed-out', '1');
                window.qaAuthListeners.forEach(callback => callback('SIGNED_OUT', null));
                return { error: null };
            },
            signInWithPassword: async ({ password }) => {
                if (password !== 'qa-account-password') return { data: null, error: { message: 'Invalid login credentials' } };
                sessionStorage.removeItem('qa-signed-out');
                window.qaAuthListeners.forEach(callback => callback('SIGNED_IN', { user }));
                return { data: { user }, error: null };
            }
        },
        from: table => new Query(table),
        rpc: async (name, parameters) => {
            if(name==='get_work_state')return {data:structuredClone(work),error:null};
            if(name==='work_backup_snapshot')return {data:{work:structuredClone(work),personal:structuredClone(cloudDocument)},error:null};
            if(name==='save_work_state') {
                if(parameters.p_expected_revision!==work.revision) {
                    if(JSON.stringify(work)===JSON.stringify(parameters.p_state))return {data:structuredClone(work),error:null};
                    return {data:null,error:{code:'40001',message:'revision conflict'}};
                }
                work=structuredClone(parameters.p_state);sessionStorage.setItem('qa-work',JSON.stringify(work));
                if(parameters.p_updates){Object.assign(cloudDocument,parameters.p_updates);(parameters.p_delete_keys||[]).forEach(k=>delete cloudDocument[k]);sessionStorage.setItem('qa-cloud-document',JSON.stringify(cloudDocument));revision++;}
                return {data:structuredClone(work),error:null};
            }
            if (name === 'save_lifecycle_planning') {
                const key=parameters.p_key, current=cloudDocument[key] ? (typeof cloudDocument[key]==='string'?JSON.parse(cloudDocument[key]):cloudDocument[key]) : {revision:0};
                if(JSON.stringify(current)===JSON.stringify(parameters.p_value)) return {data:{workspace:structuredClone(current),documentRevision:revision},error:null};
                if(current.revision!==parameters.p_expected_revision && JSON.stringify(current)!==JSON.stringify(parameters.p_value))return {data:null,error:{code:'40001',message:'revision conflict'}};
                cloudDocument[key]=structuredClone(parameters.p_value);revision++;
                sessionStorage.setItem('qa-cloud-document',JSON.stringify(cloudDocument));window.qaSyncMetrics.writes++;
                return {data:{workspace:structuredClone(cloudDocument[key]),documentRevision:revision},error:null};
            }
            if (name === 'merge_user_data_keys' || name === 'merge_user_data_at_revision') {
                if(name==='merge_user_data_at_revision'&&parameters.p_expected_revision!==revision)return {data:null,error:{code:'40001',message:'Cloud revision conflict'}};
                const previous = JSON.stringify(cloudDocument);
                (parameters.p_delete_keys || []).forEach(key => delete cloudDocument[key]);
                Object.assign(cloudDocument, parameters.p_updates || {});
                sessionStorage.setItem('qa-cloud-document', JSON.stringify(cloudDocument));
                if (previous !== JSON.stringify(cloudDocument)) revision += 1;
                window.qaSyncMetrics.writes += 1;
                const payload = { new: { data: structuredClone(cloudDocument), revision } };
                // Deliberately model the OLD database: even a no-op emits a full
                // row. The client must not depend on the server guard to converge.
                setTimeout(() => listeners.forEach(listener => {
                    window.qaSyncMetrics.realtimeEvents += 1;
                    listener(payload);
                }), 20);
                if(name==='merge_user_data_at_revision')return {data:{revision,updated_at:new Date().toISOString()},error:null};
            }
            return { data: name === 'get_my_resource_policy' ? { tier: 'owner', unlimited: true, limits: {} } : new Date().toISOString(), error: null };
        },
        channel: () => ({ on(event, filter, callback) { this.callback = callback; return this; }, subscribe() { listeners.add(this.callback); return this; }, unsubscribe() { listeners.delete(this.callback); } }),
        removeChannel(channel) { channel.unsubscribe(); }
    }) };
}
module.exports = { installFakeCloud };
