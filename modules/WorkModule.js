import { escapeHtml as esc } from '../text-utils.mjs';
import { WORK_SECTIONS, WORK_NAV, WORK_ACTORS, WORK_SCOPES, argentinaDate, workOverview, activeProjectCandidates, followupPriority } from '../work-utils.mjs';
import { planningDialog } from './PlanningStore.js';
import { WorkStore } from './WorkStore.js';
import { MaintenanceView } from './MaintenanceView.js';
import { RetainerView } from './RetainerView.js';
import { pendingRetainers, relinkProject } from '../retainer-utils.mjs';
import { isProductModuleEnabled } from '../product-features.mjs';
const field=(label,name,value='',type='text',extra='')=>`<label>${label}<input class="text-input" name="${name}" value="${esc(value)}" type="${type}" ${extra}></label>`;
const opt=(value,label,current)=>`<option value="${esc(value)}" ${String(current)===String(value)?'selected':''}>${esc(label)}</option>`;
const btn=(action,label,id='',extra='')=>`<button type="button" class="btn btn-secondary" data-work-action="${action}" data-id="${esc(id)}" ${extra}>${label}</button>`;
const stamp=()=>new Date().toISOString();
export class WorkModule {
    constructor(app) {
        this.app=app;this.maintenance=new MaintenanceView(this);this.retainers=new RetainerView(this);this.area='personal';this.store=new WorkStore(app);this.clientId='';this.clientTab='summary';this.archived=false;this.status='open';this.query='';this.error='';this.lastPersonalSectionId=null;
        for(const id of Object.keys(WORK_NAV)) {
            const section=document.getElementById(id);
            section.addEventListener('click',e=>{const b=e.target.closest('[data-work-action]');if(b)void this.action(b.dataset.workAction,b.dataset.id).catch(err=>app.showMessage({title:'No se pudo completar',message:err.message,tone:'warning'}));});
            section.addEventListener('change',e=>{if(e.target.name==='work-archive'){this.archived=e.target.value==='archived';this.clientId='';this.render();}if(e.target.name==='work-status'){this.status=e.target.value;this.render();}});
            section.addEventListener('input',e=>{if(e.target.name==='work-search'){this.query=e.target.value;this.renderClientsList();}});
        }
        this.workspacePicker=document.createElement('div');this.workspacePicker.className='workspace-picker';this.workspacePicker.setAttribute('role','group');this.workspacePicker.setAttribute('aria-label','Espacio de LifeCycle');
        this.workspacePicker.innerHTML='<button type="button" data-workspace-choice="personal" class="is-active" aria-pressed="true">Personal</button><button type="button" id="workspace-switch" data-workspace-choice="work" aria-pressed="false">Trabajo</button>';
        this.switchButton=this.workspacePicker.querySelector('#workspace-switch');
        const header=document.getElementById('privacy-lock-btn')?.parentElement;
        header?.prepend(this.workspacePicker);
        this.workspacePicker.addEventListener('click',event=>{const choice=event.target.closest('[data-workspace-choice]');if(choice&&choice.dataset.workspaceChoice!==this.area)this.switchWorkspace();});
        document.getElementById('projects-section')?.addEventListener('click',e=>{const b=e.target.closest('[data-work-action="retainer-open"]');if(b)void this.action('retainer-open',b.dataset.id).catch(err=>app.showToast?.(err.message,{tone:'warning'}));});
        window.addEventListener('lifecycle:auth-ready',()=>{this.store.reset();this.clientId='';this.error='';this.lastPersonalSectionId=null;void this.refresh(true);});
        window.addEventListener('focus',()=>{if(this.area==='work'&&app.auth?.readyUserId&&!document.getElementById('planning-dialog'))void this.refresh();});
        document.addEventListener('visibilitychange',()=>{if(!document.hidden&&this.area==='work'&&app.auth?.readyUserId&&!document.getElementById('planning-dialog'))void this.refresh();});
        window.addEventListener('lifecycle:work-refresh',()=>void this.refresh(true));
    }
    isWork(id) {return WORK_SECTIONS.includes(id);}
    visible(id) {return this.isWork(id)===(this.area==='work');}
    switchWorkspace() {
        const toWork=this.area!=='work';
        const available=Object.keys(this.app.customTrackers.getAppModules()).filter(id=>
            this.isWork(id)===toWork && isProductModuleEnabled(id) && this.app.customTrackers.isModuleVisible(id));
        const preferred=toWork?'work-summary-section':this.lastPersonalSectionId||'hoy-section';
        const targets=[...new Set([preferred,...(toWork?[]:['hoy-section','higiene-section']),...available])].filter(id=>available.includes(id));
        for(const target of targets)if(this.app.activateSection(target))return true;
        this.app.openProfileTab('modulos');
        this.app.showToast?.(`Activá al menos un módulo de ${toWork?'Trabajo':'LifeCycle'} para entrar a ese espacio.`,{tone:'warning'});
        return false;
    }
    enter(id) {
        if(!this.isWork(id))this.lastPersonalSectionId=id;
        this.area=this.isWork(id)?'work':'personal';document.body.dataset.workspace=this.area;
        this.workspacePicker.querySelectorAll('[data-workspace-choice]').forEach(button=>{const active=button.dataset.workspaceChoice===this.area;button.classList.toggle('is-active',active);button.setAttribute('aria-pressed',String(active));button.removeAttribute('id');if(!active){button.id='workspace-switch';button.setAttribute('aria-label',this.area==='work'?'Abrir Personal':'Abrir Trabajo');this.switchButton=button;}else button.removeAttribute('aria-label');});
        const brand=document.querySelector('.adaptive-nav-brand span');if(brand)brand.textContent='LifeCycle';
        const product=document.querySelector('.app-header-product');if(product)product.textContent=this.area==='work'?'Trabajo':'Personal';
        this.app.adaptiveNavigation?.refresh();
        if(this.area==='work'&&this.app.auth?.readyUserId)void this.refresh();
    }
    reset() {this.store.reset();this.clientId='';this.error='';this.lastPersonalSectionId=null;this.render();}
    async refresh(force=false) {try{await this.store.load(force);this.error='';this.render();}catch(e){this.error=e.message;this.render();}}
    get projects() {return this.app.projects?.projects||[];}
    get allProjects() {return [...this.projects,...(this.app.projects?.history||[])];}
    project(id) {return this.allProjects.find(p=>String(p.id)===String(id));}
    projectName(id) {const p=this.project(id);return p?.project||p?.name||'Proyecto histórico o no disponible';}
    heading(title,subtitle,actions='') {return `<header class="planning-heading"><div><h2>${title}</h2><p>${subtitle}</p></div><div class="planning-actions">${actions}</div></header>`;}
    render() {
        let data;try{data=this.store.value;}catch{}
        for(const id of Object.keys(WORK_NAV)) {
            const root=document.querySelector('#'+id+' .work-content');if(!root)continue;
            if(!data){root.innerHTML=this.heading(WORK_NAV[id].label,'Clientes, proyectos y próximos pasos.')+`<div class="card planning-empty" role="status">${esc(this.error||'Sincronizando Trabajo…')}${btn('retry','Reintentar')}</div>`;continue;}
            root.innerHTML=(this.error?`<p role="status" class="work-warning">${esc(this.error)} ${btn('retry','Reintentar')}</p>`:'')+(id==='work-summary-section'?this.summary(data):id==='work-clients-section'?this.clients(data):this.followups(data));
        }
        this.app.reminders?.renderList();
    }
    summary(data) {
        const o=workOverview(data,this.projects), candidates=activeProjectCandidates(this.projects,data.links), bills=pendingRetainers(data,argentinaDate());
        return this.heading('Trabajo','Qué requiere tu atención y qué estás esperando.',btn('settings','Configurar avisos')+btn('client','Nuevo cliente'))+
            `<div class="work-metrics">${[['Para resolver',o.mine.length],['Esperando respuesta',o.waiting.length],['Entregas próximas',o.deliveries.length],['Cobros pendientes',o.balances.length+bills.length]].map(([label,n])=>`<article class="card"><span>${label}</span><strong>${n}</strong></article>`).join('')}</div>`+
            (candidates.length?`<div class="card planning-card"><h3>Vinculá tus proyectos activos</h3><p>${candidates.length} proyectos sin cliente asociado. Vas a poder revisar cada vínculo antes de guardar.</p>${btn('preview','Revisar asociación inicial')}</div>`:'')+
            `<div class="work-columns"><section><h3>Acciones para revisar</h3>${this.followupList(o.due,data)||'<p>No hay acciones para revisar hoy.</p>'}</section><section><h3>Entregas y cobros</h3>${o.deliveries.map(p=>`<article class="card planning-card"><h4>${esc(p.project)}</h4><p>Entrega: ${esc(new Date(p.deadline).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'}))}</p>${btn('project','Abrir proyecto',String(p.id))}</article>`).join('')||'<p>Sin entregas vinculadas en los próximos siete días.</p>'}${this.retainers.pending(data)}${o.balances.map(x=>`<article class="card planning-card"><h4>${esc(x.project.client)} · ${esc(x.project.project)}</h4><p>Saldo pendiente: ${this.app.formatFinancialAmount(x.remaining)}</p>${btn('project','Ver cobros',String(x.project.id))}</article>`).join('')}</section></div>`+
            `<p class="fw-note">El resumen cuenta clientes activos vinculados. Archivar un cliente detiene sus avisos; sus proyectos, deudas y movimientos se conservan en Proyectos y Finanzas.</p>`;
    }
    clients(data) {
        const client=data.clients.find(c=>c.id===this.clientId);
        if(client)return this.detail(client,data);
        return this.heading('Clientes','Recordatorios, mantenimiento mensual y proyectos de cada cliente.',btn('client','Nuevo cliente')+btn('preview','Revisar vínculos de proyectos'))+
            `<div class="work-filters"><label>Ver<select name="work-archive">${opt('active','Activos',this.archived?'archived':'active')}${opt('archived','Archivados',this.archived?'archived':'active')}</select></label><label>Buscar cliente<input class="text-input" name="work-search" type="search" value="${esc(this.query)}"></label></div><div data-work-clients-list>${this.clientCards(data)}</div>`;
    }
    clientInitials(c) {return c.name.trim().split(/\s+/).slice(0,2).map(word=>[...word][0]||'').join('').toLocaleUpperCase();}
    matchingClients(data) {return data.clients.filter(c=>c.archived===this.archived&&c.name.toLocaleLowerCase().includes(this.query.toLocaleLowerCase()));}
    clientCards(data) {return `<div class="work-grid">${this.matchingClients(data).map(c=>`<article class="card planning-card work-client-card"><div class="work-client-card-heading"><span class="work-client-avatar" aria-hidden="true">${esc(this.clientInitials(c))}</span><div><h3>${esc(c.name)}</h3><p>${esc(c.contact||'Sin contacto anotado')}</p></div></div><p>${data.links.filter(l=>l.clientId===c.id).length} proyectos · ${data.followups.filter(f=>f.clientId===c.id&&f.status==='open'&&!f.maintenance?.archived).length} pendientes / recordatorios</p>${btn('detail','Abrir ficha',c.id)}</article>`).join('')||'<p>No hay clientes en esta vista.</p>'}</div>`;}
    clientDirectoryRows(data) {return this.matchingClients(data).map(c=>`<button type="button" class="work-client-directory-row ${c.id===this.clientId?'is-active':''}" data-work-action="detail" data-id="${esc(c.id)}" ${c.id===this.clientId?'aria-current="true"':''}><span class="work-client-avatar" aria-hidden="true">${esc(this.clientInitials(c))}</span><span><strong>${esc(c.name)}</strong><small>${data.links.filter(l=>l.clientId===c.id).length} proyectos</small></span><i class="ph ph-caret-right" aria-hidden="true"></i></button>`).join('')||'<p class="planning-hint">No hay clientes con ese nombre.</p>';}
    renderClientsList(){try{const data=this.store.value;const list=document.querySelector('[data-work-clients-list]');if(list)list.innerHTML=this.clientCards(data);const directory=document.querySelector('[data-client-directory-list]');if(directory)directory.innerHTML=this.clientDirectoryRows(data);}catch{}}
    detail(c,data) {
        const links=data.links.filter(l=>l.clientId===c.id), notes=data.notes.filter(n=>n.clientId===c.id).slice().reverse();
        const tabs=[['summary','Resumen'],['reminders','Tarjetas y avisos'],['retainers','Mantenimiento'],['projects','Proyectos'],['history','Historial']];
        const show=tab=>this.clientTab==='summary'||this.clientTab===tab?'':' hidden';
        return `<div class="work-client-layout"><aside class="work-client-directory" aria-label="Cambiar de cliente"><label class="work-client-search">Buscar cliente<input type="search" name="work-search" class="text-input" value="${esc(this.query)}"></label><div data-client-directory-list>${this.clientDirectoryRows(data)}</div></aside><div class="work-client-body">`+this.heading(`<span class="work-client-title"><span class="work-client-avatar" aria-hidden="true">${esc(this.clientInitials(c))}</span><span>${esc(c.name)}</span></span>`,c.archived?'Cliente archivado · historial conservado':esc(c.contact||'Cliente activo'),btn('back','Todos los clientes')+btn('client','Editar ficha',c.id)+btn('archive',c.archived?'Reactivar':'Archivar',c.id))+
            (c.context?`<p class="work-text work-client-context">${esc(c.context)}</p>`:'')+
            `<nav class="work-client-tabs" aria-label="Secciones de la ficha">${tabs.map(([id,label])=>`<button type="button" data-work-action="client-tab" data-id="${id}" aria-pressed="${this.clientTab===id}">${label}</button>`).join('')}</nav>`+
            `<div class="client-reminders${show('reminders')}">${this.maintenance.section(c,data)}</div><div class="client-retainers${show('retainers')}">${this.retainers.section(c)}</div><section class="client-projects${show('projects')}"><header class="planning-heading"><h3>Proyectos de ${esc(c.name)}</h3>${btn('link','Vincular un proyecto a este cliente',c.id,c.archived?'disabled':'')}</header><p>Cada proyecto pertenece a un solo cliente. Cambiar o quitar un vínculo requiere una selección explícita.</p><div class="work-grid">${links.map(l=>`<article class="card planning-card"><h4>${esc(this.projectName(l.projectId))}</h4><p>${this.projects.some(p=>String(p.id)===l.projectId)?'Activo':'Histórico / no disponible'}</p><div class="planning-actions">${btn('project','Abrir proyecto',l.projectId)}${btn('tasks','Ver tareas',l.projectId)}${btn('relink','Cambiar cliente / desvincular',l.projectId)}</div></article>`).join('')||'<p>Sin proyectos vinculados. Los recordatorios y mantenimientos pueden pertenecer sólo al cliente.</p>'}</div></section>`+
            `<details class="client-secondary${this.clientTab==='summary'||this.clientTab==='history'?'':' hidden'}" ${this.clientTab==='history'?'open':''}><summary>Pendientes puntuales, notas e historial</summary><p>Un pendiente puntual es una acción o respuesta por resolver una sola vez. Las notas guardan contexto y acuerdos; no generan cobros.</p><div class="planning-actions">${btn('followup','Anotar pendiente puntual',c.id,c.archived?'disabled':'')}${btn('note','Anotar nota / acuerdo',c.id,c.archived?'disabled':'')}</div><h3>Pendientes puntuales</h3>${this.followupList(data.followups.filter(f=>f.clientId===c.id&&!f.maintenance),data)||'<p>Sin pendientes puntuales.</p>'}<h3>Notas y acuerdos</h3>${notes.map(n=>`<article class="card planning-card"><small>${({note:'Nota',pending:'Pendiente',agreement:'Acuerdo registrado manualmente'})[n.kind]} · ${esc(n.updatedAt?.slice(0,10)||'')}</small><p class="work-text">${esc(n.body)}</p>${btn('edit-note','Editar nota',n.id)}${btn('delete-note','Eliminar nota',n.id)}</article>`).join('')||'<p>Sin notas.</p>'}${btn('delete-client','Eliminar ficha vacía',c.id,links.length||notes.length||data.followups.some(f=>f.clientId===c.id)||(c.retainers||[]).length?'disabled':'')}</details></div></div>`;
    }
    followups(data) {return this.heading('Seguimientos','Pendientes puntuales y recordatorios de todos tus clientes. «Quién debe actuar» indica si te toca a vos o estás esperando una respuesta.',btn('followup','Anotar pendiente puntual','',!data.clients.some(c=>!c.archived)?'disabled':''))+
        `<label class="planning-filter">Estado<select name="work-status">${opt('open','Abiertos',this.status)}${opt('completed','Completados',this.status)}${opt('cancelled','Cancelados',this.status)}${opt('all','Todos',this.status)}</select></label>`+
        (this.followupList(data.followups.filter(f=>(this.status==='all'||f.status===this.status)&&!f.maintenance?.archived&&!data.clients.find(c=>c.id===f.clientId)?.archived),data)||'<p>No hay seguimientos en esta vista.</p>');}
    followupList(list,data) {
        const day=argentinaDate();
        return [...list].sort((a,b)=>(a.status==='open'?0:1)-(b.status==='open'?0:1)||(followupPriority(a,day)==='high'?0:1)-(followupPriority(b,day)==='high'?0:1)||(a.reviewOn||'9999').localeCompare(b.reviewOn||'9999')).map(f=>f.maintenance?this.maintenance.card(f,data):`<article class="card planning-card work-followup" data-work-followup="${f.id}"><small>${esc(data.clients.find(c=>c.id===f.clientId)?.name||'')} · ${WORK_ACTORS[f.actor]}${f.priority==='high'?' · Prioridad alta':''}</small><h4>${esc(f.title)}</h4><p>${f.status==='open'?'Abierto':f.status==='completed'?'Completado':'Cancelado'} · Revisar: ${esc(f.reviewOn||'sin fecha')}${f.promisedOn?' · Prometido: '+esc(f.promisedOn):''}</p>${f.projectId?`<p>${esc(this.projectName(f.projectId))}</p>`:''}<p>${f.reminderEnabled&&f.status==='open'?'Aviso diario '+esc(f.reminderTime)+' desde la revisión, hasta resolver':'Sin aviso individual'}</p><div class="planning-actions">${btn('edit-followup','Editar',f.id)}${btn('detail','Cliente',f.clientId)}${f.status==='open'?btn('complete','Completar',f.id)+btn('cancel','Cancelar seguimiento',f.id):btn('reopen','Reabrir',f.id)}</div></article>`).join('');
    }
    async action(action,id) {
        if(action==='client-tab'){if(['summary','reminders','retainers','projects','history'].includes(id)){this.clientTab=id;this.render();}return;}
        if(action.startsWith('retainer-')){await this.retainers.action(action,id);return;}
        if(action.startsWith('maintenance-')){await this.maintenance.action(action,id);return;}
        if(action==='retry'){await this.refresh(true);return;}
        if(action==='back'){this.clientId='';this.render();return;}
        if(action==='detail'){if(this.clientId!==id)this.clientTab='summary';this.clientId=id;this.app.activateSection('work-clients-section');this.render();if(typeof window!=='undefined')window.scrollTo({top:0,behavior:'instant'});return;}
        if(action==='project') {this.app.activateSection('projects-section');const p=this.project(id);if(!p)await this.app.showMessage({title:'Proyecto no disponible',message:'El vínculo se conserva. El proyecto puede estar en otro respaldo o haber sido eliminado.',tone:'info'});else {if(!this.projects.includes(p))document.getElementById('btnOpenHistory')?.click();document.querySelector(`[data-project-id="${CSS.escape(id)}"], [data-history-project-id="${CSS.escape(id)}"]`)?.scrollIntoView({block:'center'});}return;}
        if(action==='tasks'){const t=this.app.tareas;t.currentCategory='Freelance';t.activeProjectId=id;this.app.activateSection('tareas-section');return;}
        const data=this.store.value, revision=data.revision,owner=this.app.auth?.readyUserId,generation=this.app.auth?.syncGeneration;
        const save=(next=data)=>{if(owner!==this.app.auth?.readyUserId||generation!==this.app.auth?.syncGeneration)throw new Error('La sesión cambió. Volvé a abrir la acción.');return this.store.save(next,revision);};
        if(action==='settings') {
            const s=data.settings;
            planningDialog(this.app,'Avisos de Trabajo',`<label><input type="checkbox" name="dailyEnabled" ${s.dailyEnabled?'checked':''}> Recibir resumen diario si hay pendientes, recordatorios o cobros por confirmar</label>${field('Hora Argentina','dailyTime',s.dailyTime,'time','required')}<p>Los avisos individuales se configuran en cada recordatorio, pendiente o mantenimiento mensual. Ambos son opcionales y dejan de enviarse al resolver o archivar.</p>`,async f=>{data.settings.dailyEnabled=f.has('dailyEnabled');data.settings.dailyTime=f.get('dailyTime');await save();});
        } else if(action==='client') {
            const c=data.clients.find(c=>c.id===id),newId=c?.id||crypto.randomUUID();
            planningDialog(this.app,c?'Editar cliente':'Nuevo cliente',`${field('Nombre','name',c?.name||'','text','required maxlength="120"')}${field('Contacto / referencia (opcional)','contact',c?.contact||'','text','maxlength="300"')}<label>Contexto<textarea class="text-input" name="context" maxlength="2000">${esc(c?.context||'')}</textarea></label><p>Podés tener varios proyectos por cliente. Los nombres iguales no se fusionan.</p>`,async f=>{const item={...c,id:newId,name:f.get('name').trim(),contact:f.get('contact').trim(),context:f.get('context').trim(),archived:c?.archived||false,updatedAt:stamp()};if(c)data.clients=data.clients.map(x=>x.id===c.id?item:x);else data.clients=[...data.clients.filter(x=>x.id!==newId),item];await save();this.clientId=item.id;this.app.activateSection('work-clients-section');this.render();});
        } else if(action==='archive'||action==='delete-client') {
            const c=data.clients.find(x=>x.id===id);if(!c)return;
            if(action==='delete-client'&&(data.links.some(l=>l.clientId===id)||data.followups.some(f=>f.clientId===id)||data.notes.some(n=>n.clientId===id)||(c.retainers||[]).length))throw new Error('La ficha tiene historial. Usá Archivar para conservarlo.');
            if(!await this.app.confirmAction({title:action==='archive'?(c.archived?'Reactivar cliente':'Archivar cliente'):'Eliminar ficha vacía',message:action==='archive'?'Se conservan proyectos, cobros, notas y seguimientos. Al archivar se detienen sus avisos; al reactivar pueden reanudarse.':'Se elimina sólo esta ficha vacía.',confirmLabel:action==='archive'?(c.archived?'Reactivar':'Archivar'):'Eliminar',tone:'warning'}))return;
            if(action==='archive')c.archived=!c.archived;else {data.clients=data.clients.filter(x=>x.id!==id);this.clientId='';}await save();
        } else if(action==='followup'||action==='edit-followup') {
            const old=action==='edit-followup'?data.followups.find(f=>f.id===id):null, clientId=old?.clientId||id||data.clients.find(c=>!c.archived)?.id,newId=old?.id||crypto.randomUUID();
            if(!clientId)throw new Error('Agregá un cliente primero.');
            const html=`<label>Cliente<select class="text-input" name="clientId">${data.clients.filter(c=>!c.archived||c.id===old?.clientId).map(c=>opt(c.id,c.name,clientId)).join('')}</select></label>${field('Qué falta hacer o qué respuesta esperás','title',old?.title||'','text','required maxlength="300"')}<label>Quién debe actuar<select class="text-input" name="actor">${Object.entries(WORK_ACTORS).map(([k,v])=>opt(k,v,old?.actor||'me')).join('')}</select></label><label>Proyecto (opcional)<select class="text-input" name="projectId"></select></label><label>Prioridad<select class="text-input" name="priority">${opt('normal','Normal',old?.priority||'normal')}${opt('high','Alta',old?.priority||'normal')}</select></label>${field('Volver a revisar el','reviewOn',old?.reviewOn||argentinaDate(),'date')}${field('Fecha prometida (opcional)','promisedOn',old?.promisedOn||'','date')}<label><input type="checkbox" name="reminderEnabled" ${old?.reminderEnabled?'checked':''}> Recordarme todos los días desde la revisión hasta resolverlo</label>${field('Hora Argentina','reminderTime',old?.reminderTime||'15:00','time','required')}`;
            const layer=planningDialog(this.app,old?'Editar pendiente puntual':'Nuevo pendiente puntual',html,async f=>{if(f.has('reminderEnabled')&&!f.get('reviewOn'))throw new Error('Elegí desde qué fecha querés recibir el aviso.');const item={...old,...Object.fromEntries(f),id:newId,reminderEnabled:f.has('reminderEnabled'),status:old?.status||'open',updatedAt:stamp()};if(old)data.followups=data.followups.map(x=>x.id===old.id?item:x);else data.followups=[...data.followups.filter(x=>x.id!==newId),item];await save();});
            const update=()=>{const c=layer.querySelector('[name=clientId]').value;layer.querySelector('[name=projectId]').innerHTML=opt('','Sin proyecto','')+data.links.filter(l=>l.clientId===c).map(l=>opt(l.projectId,this.projectName(l.projectId),old?.projectId)).join('');};update();layer.querySelector('[name=clientId]').addEventListener('change',update);
        } else if(['complete','cancel','reopen'].includes(action)) {
            const f=data.followups.find(x=>x.id===id);if(!f)return;
            if(action==='cancel'&&!await this.app.confirmAction({title:'Cancelar seguimiento',message:'Se conserva en el historial y deja de enviar avisos.',confirmLabel:'Cancelar seguimiento',tone:'warning'}))return;
            f.status=action==='complete'?'completed':action==='cancel'?'cancelled':'open';f.updatedAt=stamp();await save();
        } else if(action==='note'||action==='edit-note') {
            const n=action==='edit-note'?data.notes.find(x=>x.id===id):null, clientId=n?.clientId||id,newId=n?.id||crypto.randomUUID();
            planningDialog(this.app,n?'Editar nota':'Nota / acuerdo',`<label>Tipo<select class="text-input" name="kind">${[['note','Nota'],['pending','Pendiente'],['agreement','Acuerdo registrado']].map(([k,v])=>opt(k,v,n?.kind||'note')).join('')}</select></label><label>Texto<textarea class="text-input" name="body" required maxlength="4000">${esc(n?.body||'')}</textarea></label><p>Este registro manual no cambia entregas, aceptación ni cobros.</p>`,async f=>{const item={...n,id:newId,clientId,kind:f.get('kind'),body:f.get('body').trim(),updatedAt:stamp()};if(n)data.notes=data.notes.map(x=>x.id===n.id?item:x);else data.notes=[...data.notes.filter(x=>x.id!==newId),item];await save();});
        } else if(action==='delete-note') {
            if(await this.app.confirmAction({title:'Eliminar nota',message:'El texto se eliminará de esta ficha. No cambia proyectos ni movimientos.',confirmLabel:'Eliminar nota',tone:'danger'})){data.notes=data.notes.filter(n=>n.id!==id);await save();}
        } else if(action==='link') {
            const client=data.clients.find(c=>c.id===id&&!c.archived);if(!client)throw new Error('Elegí un cliente activo.');
            const candidates=activeProjectCandidates(this.allProjects,data.links);
            if(!candidates.length){await this.app.showMessage({title:'Sin proyectos sin vincular',message:'Para corregir un vínculo existente usá «Cambiar cliente / desvincular» en el proyecto, o «Revisar vínculos de proyectos» en la lista de clientes.'});return;}
            planningDialog(this.app,'Vincular proyectos a '+client.name,`<p>Cliente: <strong>${esc(client.name)}</strong>. Marcá únicamente sus proyectos; ninguno viene seleccionado.</p>${candidates.map(p=>`<label class="lifecycle-checkbox-label"><input class="lifecycle-checkbox" type="checkbox" name="projectId" value="${esc(p.projectId)}">${esc(p.project)}${p.name?' · '+esc(p.name):''}</label>`).join('')}`,async f=>{const selected=f.getAll('projectId'),next=structuredClone(data);if(!selected.length)throw new Error('Marcá al menos un proyecto o cancelá.');for(const p of selected){if(!candidates.some(x=>x.projectId===p))throw new Error('Proyecto no disponible.');next.links.push({clientId:id,projectId:p});}await save(next);});
        } else if(action==='preview'||action==='relink') {
            const candidates=action==='relink'?[{projectId:id,project:this.projectName(id)}]:this.allProjects.map(p=>({projectId:String(p.id),project:p.project,name:p.client}));
            if(!candidates.length)throw new Error('Todavía no hay proyectos. Creá uno en Proyectos.');
            const targets=data.clients.filter(c=>!c.archived);
            planningDialog(this.app,'Revisar cliente de cada proyecto',`<p>Se muestra el vínculo actual de cada proyecto. Sólo se guardan los que cambies.</p><p>Al cambiar o quitar un vínculo, sus recordatorios, notas y mantenimientos permanecen en el cliente original, pero dejan de apuntar a ese proyecto. Los cobros históricos se conservan.</p>${candidates.map((p,i)=>{const current=data.links.find(l=>l.projectId===p.projectId)?.clientId||'';const archived=data.clients.find(c=>c.id===current&&c.archived);return `<fieldset><legend>${esc(p.project)}</legend><label>Cliente de este proyecto<select class="text-input" name="target-${i}">${opt('','Sin cliente',current)}${targets.map(c=>opt(c.id,c.name,current)).join('')}${archived?opt(archived.id,archived.name+' (archivado)',current):''}</select></label></fieldset>`;}).join('')}`,async f=>{let next=structuredClone(data),count=0;for(let i=0;i<candidates.length;i++){const p=candidates[i].projectId,target=f.get('target-'+i),current=data.links.find(l=>l.projectId===p)?.clientId||'';if(current===target)continue;next=relinkProject(next,p,target);count++;}if(!count)throw new Error('No cambiaste ningún vínculo. Podés cancelar.');await save(next);});
        }
    }
}
