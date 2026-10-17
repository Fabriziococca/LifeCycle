import { escapeHtml as esc } from '../text-utils.mjs';
import { WORK_SECTIONS, WORK_NAV, WORK_ACTORS, WORK_SCOPES, argentinaDate, workOverview, activeProjectCandidates } from '../work-utils.mjs';
import { planningDialog } from './PlanningStore.js';
import { WorkStore } from './WorkStore.js';
import { isProductModuleEnabled } from '../product-features.mjs';
const field=(label,name,value='',type='text',extra='')=>`<label>${label}<input class="text-input" name="${name}" value="${esc(value)}" type="${type}" ${extra}></label>`;
const opt=(value,label,current)=>`<option value="${esc(value)}" ${String(current)===String(value)?'selected':''}>${esc(label)}</option>`;
const btn=(action,label,id='',extra='')=>`<button type="button" class="btn btn-secondary" data-work-action="${action}" data-id="${esc(id)}" ${extra}>${label}</button>`;
const stamp=()=>new Date().toISOString();
export class WorkModule {
    constructor(app) {
        this.app=app;this.area='personal';this.store=new WorkStore(app);this.clientId='';this.archived=false;this.status='open';this.query='';this.error='';this.lastPersonalSectionId=null;
        for(const id of Object.keys(WORK_NAV)) {
            const section=document.getElementById(id);
            section.addEventListener('click',e=>{const b=e.target.closest('[data-work-action]');if(b)void this.action(b.dataset.workAction,b.dataset.id).catch(err=>app.showMessage({title:'No se pudo completar',message:err.message,tone:'warning'}));});
            section.addEventListener('change',e=>{if(e.target.name==='work-archive'){this.archived=e.target.value==='archived';this.clientId='';this.render();}if(e.target.name==='work-status'){this.status=e.target.value;this.render();}});
            section.addEventListener('input',e=>{if(e.target.name==='work-search'){this.query=e.target.value;this.renderClientsList();}});
        }
        this.switchButton=document.createElement('button');this.switchButton.id='workspace-switch';this.switchButton.className='btn btn-secondary';this.switchButton.innerHTML='<i class="ph ph-briefcase"></i><span>Trabajo</span>';
        const header=document.getElementById('privacy-lock-btn')?.parentElement;
        header?.prepend(this.switchButton);
        this.switchButton.addEventListener('click',()=>this.switchWorkspace());
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
        const targets=[...new Set([preferred,...available])].filter(id=>available.includes(id));
        for(const target of targets)if(this.app.activateSection(target))return true;
        this.app.openProfileTab('modulos');
        this.app.showToast?.(`Activá al menos un módulo de ${toWork?'Trabajo':'LifeCycle'} para entrar a ese espacio.`,{tone:'warning'});
        return false;
    }
    enter(id) {
        if(!this.isWork(id))this.lastPersonalSectionId=id;
        this.area=this.isWork(id)?'work':'personal';document.body.dataset.workspace=this.area;
        this.switchButton.innerHTML=this.area==='work'?'<i class="ph ph-arrow-left"></i><span>LifeCycle</span>':'<i class="ph ph-briefcase"></i><span>Trabajo</span>';
        this.switchButton.setAttribute('aria-label',this.area==='work'?'Volver a LifeCycle':'Abrir Trabajo');
        const brand=document.querySelector('.adaptive-nav-brand span');if(brand)brand.textContent=this.area==='work'?'Trabajo':'LifeCycle';
        const product=document.querySelector('.app-header-product');if(product)product.textContent=this.area==='work'?'Trabajo':'LifeCycle';
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
    }
    summary(data) {
        const o=workOverview(data,this.projects), candidates=activeProjectCandidates(this.projects,data.links);
        return this.heading('Trabajo','Qué requiere tu atención y qué estás esperando.',btn('settings','Configurar avisos')+btn('client','Nuevo cliente'))+
            `<div class="work-metrics">${[['Para resolver',o.mine.length],['Esperando respuesta',o.waiting.length],['Entregas próximas',o.deliveries.length],['Cobros pendientes',o.balances.length]].map(([label,n])=>`<article class="card"><span>${label}</span><strong>${n}</strong></article>`).join('')}</div>`+
            (candidates.length?`<div class="card planning-card"><h3>Vinculá tus proyectos activos</h3><p>${candidates.length} proyectos sin cliente asociado. Vas a poder revisar cada vínculo antes de guardar.</p>${btn('preview','Revisar asociación inicial')}</div>`:'')+
            `<div class="work-columns"><section><h3>Acciones para revisar</h3>${this.followupList(o.due,data)||'<p>No hay acciones para revisar hoy.</p>'}</section><section><h3>Entregas y cobros</h3>${o.deliveries.map(p=>`<article class="card planning-card"><h4>${esc(p.project)}</h4><p>Entrega: ${esc(new Date(p.deadline).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'}))}</p>${btn('project','Abrir proyecto',String(p.id))}</article>`).join('')||'<p>Sin entregas vinculadas en los próximos siete días.</p>'}${o.balances.map(x=>`<article class="card planning-card"><h4>${esc(x.project.client)} · ${esc(x.project.project)}</h4><p>Saldo pendiente: ${this.app.formatFinancialAmount(x.remaining)}</p>${btn('project','Ver cobros',String(x.project.id))}</article>`).join('')}</section></div>`+
            `<p class="fw-note">El resumen cuenta clientes activos vinculados. Archivar un cliente detiene sus avisos; sus proyectos, deudas y movimientos se conservan en Proyectos y Finanzas.</p>`;
    }
    clients(data) {
        const client=data.clients.find(c=>c.id===this.clientId);
        if(client)return this.detail(client,data);
        return this.heading('Clientes','Una ficha por relación, con todos sus proyectos e historial.',btn('client','Nuevo cliente')+btn('preview','Vincular proyectos activos'))+
            `<div class="work-filters"><label>Ver<select name="work-archive">${opt('active','Activos',this.archived?'archived':'active')}${opt('archived','Archivados',this.archived?'archived':'active')}</select></label><label>Buscar cliente<input class="text-input" name="work-search" type="search" value="${esc(this.query)}"></label></div><div data-work-clients-list>${this.clientCards(data)}</div>`;
    }
    clientCards(data) {return `<div class="work-grid">${data.clients.filter(c=>c.archived===this.archived&&c.name.toLocaleLowerCase().includes(this.query.toLocaleLowerCase())).map(c=>`<article class="card planning-card"><h3>${esc(c.name)}</h3><p>${esc(c.contact||'Sin contacto anotado')}</p><p>${data.links.filter(l=>l.clientId===c.id).length} proyectos · ${data.followups.filter(f=>f.clientId===c.id&&f.status==='open').length} seguimientos abiertos</p>${btn('detail','Abrir ficha',c.id)}</article>`).join('')||'<p>No hay clientes en esta vista.</p>'}</div>`;}
    renderClientsList(){const list=document.querySelector('[data-work-clients-list]');if(list)try{list.innerHTML=this.clientCards(this.store.value);}catch{}}
    detail(c,data) {
        const links=data.links.filter(l=>l.clientId===c.id), notes=data.notes.filter(n=>n.clientId===c.id).slice().reverse();
        return this.heading(esc(c.name),c.archived?'Cliente archivado · historial conservado':esc(c.contact||'Cliente activo'),btn('back','Todos los clientes')+btn('client','Editar ficha',c.id)+btn('archive',c.archived?'Reactivar':'Archivar',c.id))+
            `<p class="work-text">${esc(c.context||'Sin contexto anotado.')}</p><div class="planning-actions">${btn('followup','Nuevo seguimiento',c.id,c.archived?'disabled':'')}${btn('note','Anotar nota / acuerdo',c.id,c.archived?'disabled':'')}${btn('link','Vincular proyecto',c.id,c.archived?'disabled':'')}${btn('delete-client','Eliminar ficha vacía',c.id,links.length||notes.length||data.followups.some(f=>f.clientId===c.id)?'disabled':'')}</div>`+
            `<div class="work-columns"><section><h3>Próximos pasos e historial</h3>${this.followupList(data.followups.filter(f=>f.clientId===c.id),data)||'<p>Sin seguimientos.</p>'}<h3>Notas y acuerdos</h3>${notes.map(n=>`<article class="card planning-card"><small>${({note:'Nota',pending:'Pendiente',agreement:'Acuerdo registrado manualmente'})[n.kind]} · ${esc(n.updatedAt?.slice(0,10)||'')}</small><p class="work-text">${esc(n.body)}</p>${btn('edit-note','Editar nota',n.id)}${btn('delete-note','Eliminar nota',n.id)}</article>`).join('')||'<p>Sin notas. Registrar un acuerdo no confirma pagos ni aceptación de una entrega.</p>'}</section><section><h3>Proyectos</h3>${links.map(l=>`<article class="card planning-card"><h4>${esc(this.projectName(l.projectId))}</h4><p>${this.projects.some(p=>String(p.id)===l.projectId)?'Activo':'Histórico / no disponible'}</p><div class="planning-actions">${btn('project','Abrir proyecto',l.projectId)}${btn('tasks','Ver tareas',l.projectId)}</div></article>`).join('')||'<p>Sin proyectos vinculados. Podés registrar seguimientos sin proyecto.</p>'}</section></div>`;
    }
    followups(data) {return this.heading('Seguimientos','Acción, responsable y fecha de revisión. La fecha prometida se conserva por separado.',btn('followup','Nuevo seguimiento','',!data.clients.some(c=>!c.archived)?'disabled':''))+
        `<label class="planning-filter">Estado<select name="work-status">${opt('open','Abiertos',this.status)}${opt('completed','Completados',this.status)}${opt('cancelled','Cancelados',this.status)}${opt('all','Todos',this.status)}</select></label>`+
        (this.followupList(data.followups.filter(f=>(this.status==='all'||f.status===this.status)&&!data.clients.find(c=>c.id===f.clientId)?.archived),data)||'<p>No hay seguimientos en esta vista.</p>');}
    followupList(list,data) {
        return [...list].sort((a,b)=>(a.status==='open'?0:1)-(b.status==='open'?0:1)||(a.priority==='high'?0:1)-(b.priority==='high'?0:1)||(a.reviewOn||'9999').localeCompare(b.reviewOn||'9999')).map(f=>`<article class="card planning-card work-followup" data-work-followup="${f.id}"><small>${esc(data.clients.find(c=>c.id===f.clientId)?.name||'')} · ${WORK_ACTORS[f.actor]}${f.priority==='high'?' · Prioridad alta':''}</small><h4>${esc(f.title)}</h4><p>${f.status==='open'?'Abierto':f.status==='completed'?'Completado':'Cancelado'} · Revisar: ${esc(f.reviewOn||'sin fecha')}${f.promisedOn?' · Prometido: '+esc(f.promisedOn):''}</p>${f.projectId?`<p>${esc(this.projectName(f.projectId))}</p>`:''}<p>${f.reminderEnabled&&f.status==='open'?'Aviso diario '+esc(f.reminderTime)+' desde la revisión, hasta resolver':'Sin aviso individual'}</p><div class="planning-actions">${btn('edit-followup','Editar',f.id)}${btn('detail','Cliente',f.clientId)}${f.status==='open'?btn('complete','Completar',f.id)+btn('cancel','Cancelar seguimiento',f.id):btn('reopen','Reabrir',f.id)}</div></article>`).join('');
    }
    async action(action,id) {
        if(action==='retry'){await this.refresh(true);return;}
        if(action==='back'){this.clientId='';this.render();return;}
        if(action==='detail'){this.clientId=id;this.app.activateSection('work-clients-section');this.render();return;}
        if(action==='project') {this.app.activateSection('projects-section');const p=this.project(id);if(!p)await this.app.showMessage({title:'Proyecto no disponible',message:'El vínculo se conserva. El proyecto puede estar en otro respaldo o haber sido eliminado.',tone:'info'});else {if(!this.projects.includes(p))document.getElementById('btnOpenHistory')?.click();document.querySelector(`[data-project-id="${CSS.escape(id)}"], [data-history-project-id="${CSS.escape(id)}"]`)?.scrollIntoView({block:'center'});}return;}
        if(action==='tasks'){const t=this.app.tareas;t.currentCategory='Freelance';t.activeProjectId=id;this.app.activateSection('tareas-section');return;}
        const data=this.store.value, revision=data.revision,owner=this.app.auth?.readyUserId,generation=this.app.auth?.syncGeneration;
        const save=(next=data)=>{if(owner!==this.app.auth?.readyUserId||generation!==this.app.auth?.syncGeneration)throw new Error('La sesión cambió. Volvé a abrir la acción.');return this.store.save(next,revision);};
        if(action==='settings') {
            const s=data.settings;
            planningDialog(this.app,'Avisos de Trabajo',`<label><input type="checkbox" name="dailyEnabled" ${s.dailyEnabled?'checked':''}> Recibir resumen diario si hay seguimientos para revisar</label>${field('Hora Argentina','dailyTime',s.dailyTime,'time','required')}<p>Los avisos individuales se configuran en cada seguimiento. Ambos son opcionales y dejan de enviarse al resolver o archivar.</p>`,async f=>{data.settings.dailyEnabled=f.has('dailyEnabled');data.settings.dailyTime=f.get('dailyTime');await save();});
        } else if(action==='client') {
            const c=data.clients.find(c=>c.id===id),newId=c?.id||crypto.randomUUID();
            planningDialog(this.app,c?'Editar cliente':'Nuevo cliente',`${field('Nombre','name',c?.name||'','text','required maxlength="120"')}${field('Contacto / referencia (opcional)','contact',c?.contact||'','text','maxlength="300"')}<label>Contexto<textarea class="text-input" name="context" maxlength="2000">${esc(c?.context||'')}</textarea></label><p>Podés tener varios proyectos por cliente. Los nombres iguales no se fusionan.</p>`,async f=>{const item={...c,id:newId,name:f.get('name').trim(),contact:f.get('contact').trim(),context:f.get('context').trim(),archived:c?.archived||false,updatedAt:stamp()};if(c)data.clients=data.clients.map(x=>x.id===c.id?item:x);else data.clients=[...data.clients.filter(x=>x.id!==newId),item];await save();this.clientId=item.id;this.app.activateSection('work-clients-section');this.render();});
        } else if(action==='archive'||action==='delete-client') {
            const c=data.clients.find(x=>x.id===id);if(!c)return;
            if(action==='delete-client'&&(data.links.some(l=>l.clientId===id)||data.followups.some(f=>f.clientId===id)||data.notes.some(n=>n.clientId===id)))throw new Error('La ficha tiene historial. Usá Archivar para conservarlo.');
            if(!await this.app.confirmAction({title:action==='archive'?(c.archived?'Reactivar cliente':'Archivar cliente'):'Eliminar ficha vacía',message:action==='archive'?'Se conservan proyectos, cobros, notas y seguimientos. Al archivar se detienen sus avisos; al reactivar pueden reanudarse.':'Se elimina sólo esta ficha vacía.',confirmLabel:action==='archive'?(c.archived?'Reactivar':'Archivar'):'Eliminar',tone:'warning'}))return;
            if(action==='archive')c.archived=!c.archived;else {data.clients=data.clients.filter(x=>x.id!==id);this.clientId='';}await save();
        } else if(action==='followup'||action==='edit-followup') {
            const old=action==='edit-followup'?data.followups.find(f=>f.id===id):null, clientId=old?.clientId||id||data.clients.find(c=>!c.archived)?.id,newId=old?.id||crypto.randomUUID();
            if(!clientId)throw new Error('Agregá un cliente primero.');
            const html=`<label>Cliente<select class="text-input" name="clientId">${data.clients.filter(c=>!c.archived||c.id===old?.clientId).map(c=>opt(c.id,c.name,clientId)).join('')}</select></label>${field('Próximo paso / compromiso','title',old?.title||'','text','required maxlength="300"')}<label>Quién debe actuar<select class="text-input" name="actor">${Object.entries(WORK_ACTORS).map(([k,v])=>opt(k,v,old?.actor||'me')).join('')}</select></label><label>Proyecto (opcional)<select class="text-input" name="projectId"></select></label><label>Prioridad<select class="text-input" name="priority">${opt('normal','Normal',old?.priority||'normal')}${opt('high','Alta',old?.priority||'normal')}</select></label>${field('Revisar desde','reviewOn',old?.reviewOn||argentinaDate(),'date')}${field('Fecha prometida (opcional)','promisedOn',old?.promisedOn||'','date')}<label><input type="checkbox" name="reminderEnabled" ${old?.reminderEnabled?'checked':''}> Aviso diario individual desde la fecha de revisión</label>${field('Hora Argentina','reminderTime',old?.reminderTime||'15:00','time','required')}`;
            const layer=planningDialog(this.app,old?'Editar seguimiento':'Nuevo seguimiento',html,async f=>{if(f.has('reminderEnabled')&&!f.get('reviewOn'))throw new Error('Elegí desde qué fecha querés recibir el aviso.');const item={...old,...Object.fromEntries(f),id:newId,reminderEnabled:f.has('reminderEnabled'),status:old?.status||'open',updatedAt:stamp()};if(old)data.followups=data.followups.map(x=>x.id===old.id?item:x);else data.followups=[...data.followups.filter(x=>x.id!==newId),item];await save();});
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
        } else if(action==='preview'||action==='link') {
            const candidates=activeProjectCandidates(this.projects,data.links);if(!candidates.length){await this.app.showMessage({title:'Sin proyectos pendientes',message:'Todos los proyectos activos ya están vinculados, o todavía no hay proyectos activos.',tone:'info'});return;}
            const targets=data.clients.filter(c=>!c.archived);
            planningDialog(this.app,'Revisar vínculos de proyectos activos',`<p>Elegí qué vincular. Cada opción «Nuevo cliente» crea una ficha independiente; no se fusionan por nombre.</p>${candidates.map((p,i)=>`<fieldset><legend>${esc(p.project)}</legend><label>Cliente<select class="text-input" name="target-${i}">${opt('','No vincular','')}${!id?opt('new','Nuevo cliente',''):''}${targets.map(c=>opt(c.id,c.name,id||'')).join('')}</select></label>${!id?field('Nombre si creás un cliente','name-'+i,p.name,'text','maxlength="120"'):''}</fieldset>`).join('')}`,async f=>{const next=structuredClone(data);let count=0;for(let i=0;i<candidates.length;i++){let target=f.get('target-'+i);if(!target)continue;if(target==='new'){const name=f.get('name-'+i).trim();if(!name)throw new Error('Completá el nombre de cada cliente nuevo seleccionado.');target=crypto.randomUUID();next.clients.push({id:target,name,contact:'',context:'',archived:false,updatedAt:stamp()});}next.links.push({clientId:target,projectId:candidates[i].projectId});count++;}if(!count)throw new Error('Elegí al menos un proyecto para vincular.');await save(next);});
        }
    }
}
