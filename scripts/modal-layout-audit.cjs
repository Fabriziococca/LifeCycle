// Local fake-cloud audit only: no account credentials or production data are used.
// Run after npm run build:browser, with LIFECYCLE_PLAYWRIGHT_MODULE if needed.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),express=require('express');
const {chromium}=require(process.env.LIFECYCLE_PLAYWRIGHT_MODULE || 'playwright');
const {installFakeCloud}=require('./qa-cloud.cjs');
const root=path.resolve(__dirname,'..'), report=[];
const server=express().use(express.static(root)).listen(0,'127.0.0.1');
async function seed(page,stress){
 await page.evaluate(async stress=>{
  if(!location.hostname.match(/^(localhost|127\.0\.0\.1)$/))throw Error('Local fixtures only');
  const a=window.lifecycle_controller, f=a.finanzas,p=a.projects;
  const {buildFinanceAccount,financeWorkspace,buildFinanceBudget}=await import('/finance-workspace-utils.mjs');
  const {normalizeFinanceRecurringRules}=await import('/finance-recurring-utils.mjs');
  const {buildProjectTemplate,normalizeProjectTemplateRegistry}=await import('/project-template-utils.mjs');
  const money=stress?9876543.21:12345.67;
  const name=stress?'IntegracionesDeSistemasYAutomatizacionesEmpresarialesSinEspaciosAdicionales':'Cliente QA con una denominación comercial extensa';
  const date=a.finanzas.workspaceView.month+'-10';
  p.projects=[{id:'qa-modal-project',client:name,project:'Implementación de integraciones, automatizaciones y soporte de procesos',source:'workana',clientSource:'linkedin',accepted:'2026-09-15T12:30:00-03:00',deadline:'2027-10-31T22:30:00-03:00',days:30,budgetGross:money,budgetNet:money*.8,feeType:'20',manualPercent:20,timeSpent:43200000,partialReleases:[{id:'qa-partial',date,percent:25,netAmount:money*.2,grossAmount:money*.25}],summary:'Contexto del proyecto y responsabilidades. '+name,phases:'Fase 1: Diagnóstico y planificación\nFase 2: Implementación y validación\nReferencia: https://example.com/'+name,isArbitration:true}];
  p.history=[{...p.projects[0],id:'qa-history-modal',isPaid:true,isDelivered:true,deliveredDate:'2026-09-23',deliveredAt:'2026-09-23T12:00:00Z'}];
  p.templateRegistry=normalizeProjectTemplateRegistry({version:1,templates:[buildProjectTemplate(p.projects[0],{id:'qa-modal-template',name,includeBudget:true})]});
  f.data={...f.data,entries:[{id:'qa-modal-income',description:name+' — Mantenimiento e integraciones',category:'freelance',amount:money,date}],expenses:[{id:'qa-modal-expense',description:name+' — Equipamiento para soporte',category:'servicios',amount:money/3,date}],workspace:{...financeWorkspace(f.data),accounts:[],budgets:[],transfers:[]}};
  f.data.recurringRules=normalizeFinanceRecurringRules(['income','expense'].map(type=>({id:'qa-recurring-'+type,type,name,category:type==='income'?'freelance':'servicios',description:name,amount:money,currency:stress?'ARS':'USD',intervalMonths:1,anchorDay:10,nextDueDate:date,active:true})));
  f.data.workspace.accounts=[buildFinanceAccount({name:'Cuenta operativa en dólares para cobros internacionales',currency:'USD',kind:'bank',opening:'1000'}),buildFinanceAccount({name:'Cuenta de gastos y conversiones en pesos argentinos',currency:'ARS',kind:'wallet',opening:'500000'}),buildFinanceAccount({name:'Tarjeta para compras y servicios profesionales',currency:'USD',kind:'credit',opening:'0',limit:'20000',closingDay:1,dueDay:10})];
  f.data.workspace.budgets=[buildFinanceBudget({category:'Servicios y mantenimiento profesional',month:f.workspaceView.month,currency:'ARS',amount:'1234567.89'},f.data.workspace)];
  localStorage.setItem('lemon_usdt_ars_rate','1600');localStorage.setItem('lemon_usdt_ars_time',String(Date.now()));localStorage.setItem('lemon_usdt_ars_source','criptoya-lemon');
  a.setFinancialAmountsHidden(false);a.setPreferredCurrency(stress?'ARS':'USD');p.saveData();p.saveTemplateData();p.render();f.saveData();f.render();await a.auth.flushPendingKeySync(true);window.qaModalSnapshot=JSON.stringify({projects:p.projects,history:p.history,templates:p.templateRegistry,finance:f.data});
 },stress);
}
async function inspect(page,selector){return page.locator(selector).evaluate(root=>{
 const panel=root.querySelector('.modal-content')||root, outer=panel.getBoundingClientRect(),issues=[];
 const visible=e=>e.checkVisibility()&&e.getBoundingClientRect().width>1&&e.getBoundingClientRect().height>1;
 const hScroll=e=>{for(let n=e;n&&n!==panel;n=n.parentElement){const s=getComputedStyle(n);if(['auto','scroll','hidden','clip'].includes(s.overflowX)&&n.scrollWidth>n.clientWidth+2)return true;}return false;};
 if(outer.left<-2||outer.right>innerWidth+2)issues.push({kind:'dialog-outside-viewport',left:outer.left,right:outer.right});
 for(const el of panel.querySelectorAll('input,select,textarea,button,h2,h3,h4,strong,p,label,small,span')){
  if(!visible(el)||hScroll(el)||el.closest('option,svg,canvas'))continue;
  const r=el.getBoundingClientRect();
  if(r.left<outer.left-3||r.right>outer.right+3)issues.push({kind:'element-outside-dialog',tag:el.tagName,id:el.id,cls:String(el.className).slice(0,60),text:el.textContent.trim().slice(0,65),extra:Math.max(outer.left-r.left,r.right-outer.right)});
 }
 for(const row of panel.querySelectorAll('div,header,footer')){
  if(!visible(row)||hScroll(row))continue;const s=getComputedStyle(row);
  if(!['flex','grid'].includes(s.display)||(s.display==='flex'&&s.flexDirection!=='row'))continue;
  const children=[...row.children].filter(e=>visible(e)&&!e.matches('input,select,textarea,svg'));
  for(const child of children){
   if(child.querySelector('input,select,textarea,table')||hScroll(child))continue;
   const box=child.getBoundingClientRect(),walker=document.createTreeWalker(child,NodeFilter.SHOW_TEXT);let n;
   while(n=walker.nextNode()){if(!n.textContent.trim()||!visible(n.parentElement)||hScroll(n.parentElement))continue;const range=document.createRange();range.selectNodeContents(n);if([...range.getClientRects()].some(r=>r.left<box.left-3||r.right>box.right+3)){
    issues.push({kind:'text-outside-cell',row:row.className||row.id,tag:child.tagName,cls:child.className,id:child.id,text:n.textContent.trim().slice(0,70)});break;
   }}
  }
 }
 const textWalker=document.createTreeWalker(panel,NodeFilter.SHOW_TEXT);let textNode;while(textNode=textWalker.nextNode()){const parent=textNode.parentElement;if(!textNode.textContent.trim()||!visible(parent)||parent.closest('input,select,textarea,option,svg')||hScroll(parent))continue;const range=document.createRange();range.selectNodeContents(textNode);if([...range.getClientRects()].some(r=>r.left<outer.left-3||r.right>outer.right+3))issues.push({kind:'text-outside-dialog',tag:parent.tagName,cls:parent.className,text:textNode.textContent.trim().slice(0,70)});}
 return issues.filter((v,i,all)=>all.findIndex(x=>JSON.stringify(x)===JSON.stringify(v))===i).slice(0,45);
});}
(async()=>{
 await fs.mkdir(path.join(root,'.tmp-sb/modal-audit'),{recursive:true});const b=await chromium.launch({headless:true,channel:'chrome'});
 try{for(const width of [1440,390])for(const theme of ['dark','light']){
  const c=await b.newContext({viewport:{width,height:width<500?844:1000},serviceWorkers:'block'}),page=await c.newPage();page.setDefaultTimeout(8000);const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
  await c.addInitScript(()=>{const registration={active:{},addEventListener(){},pushManager:{getSubscription:async()=>null}};Object.defineProperty(navigator,'serviceWorker',{value:{register:async()=>registration,ready:Promise.resolve(registration),getRegistration:async()=>registration,addEventListener(){}}});});
  await c.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',r=>r.fulfill({contentType:'application/javascript',body:`(${installFakeCloud.toString()})();`}));
  await c.route('**/api/**',r=>r.fulfill({json:r.request().url().endsWith('/api/config')?{supabaseUrl:'https://qa.invalid',supabaseAnonKey:'qa',registrationEnabled:false}:{devices:[],events:[],deliveries:[],entries:[],available:true,success:true}}));
  await page.goto(`http://localhost:${server.address().port}/`,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.lifecycle_controller?.auth?.readyUserId);await page.evaluate(t=>window.lifecycle_controller.theme.apply(t),theme);await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important}'});await page.evaluate(()=>document.fonts.ready);
  for(const stress of [false,true]){
   await seed(page,stress);
   const check=async(label,selector,open)=>{
    try{
     await page.evaluate(()=>{document.querySelectorAll('.modal:not(.hidden)').forEach(el=>el.classList.add('hidden'));document.querySelectorAll('dialog[open]').forEach(el=>el.close());document.body.classList.remove('modal-open');});
     await open();await page.locator(selector).waitFor({state:'visible'});
     const issues=await inspect(page,selector);report.push({width,theme,stress,label,issues});
     if(issues.length || (stress && ['templates','plan','finance-confirm-original'].includes(label)))await page.screenshot({path:path.join(root,`.tmp-sb/modal-audit/${width}-${theme}-${stress?'stress':'normal'}-${label}.png`),animations:'disabled'});
    }catch(e){report.push({width,theme,stress,label,error:e.message.split('\n')[0]});}
   };
   const projectCases=[['partial','projects-partial-release-modal','openPartialReleaseModal'],['details','projects-details-modal','openDetailsModal'],['edit-project','projects-edit-modal','openEditModal'],['arbitration','projects-resolve-arbitration-modal','openResolveArbitrationModal'],['status','projects-status-note-modal','openStatusNoteModal'],['plan','projects-plan-modal','openPlanModal']];
   for(const [label,id,method] of projectCases)await check(label,'#'+id,()=>page.evaluate(m=>window.lifecycle_controller.projects[m]('qa-modal-project'),method));
   await check('plan-phases','#projects-plan-modal',async()=>{await page.evaluate(()=>window.lifecycle_controller.projects.openPlanModal('qa-modal-project'));await page.locator('#proj-plan-tab-phases').click();});
   await check('plan-edit','#projects-plan-modal',async()=>{await page.evaluate(()=>window.lifecycle_controller.projects.openPlanModal('qa-modal-project'));await page.locator('#proj-plan-modal-edit').click();});
   await check('templates','#project-templates-modal',()=>page.evaluate(()=>window.lifecycle_controller.projects.openProjectTemplatesModal()));
   await check('history-past-income','#projects-history-modal',async()=>{await page.evaluate(()=>{document.getElementById('projects-history-modal').classList.remove('hidden');window.lifecycle_controller.projects.renderMonthlyHistory('all');});await page.locator('#proj-btnToggleAddPastIncome').click();});
   const actions=['new-movement','edit-movement','new-account','new-card','edit-account','new-budget','edit-budget','transfer','confirm-original','confirm-usd','receipt'];
   for(const action of actions)await check('finance-'+action,'#fw-dialog',()=>page.evaluate(action=>{
    const f=window.lifecycle_controller.finanzas.workspaceView,ws=f.workspace;
    const id=['edit-movement','confirm-original','receipt'].includes(action)?f.movements.find(m=>m.editable&&m.type==='expense').key:action==='edit-account'?ws.accounts[0].id:action==='edit-budget'?ws.budgets[0].id:undefined;
    f.open(action,id,null);
   },action));
   await check('finance-conversion','#fw-dialog',async()=>{await page.evaluate(()=>{const f=window.lifecycle_controller.finanzas.workspaceView;f.open('transfer');const to=f.dialog.querySelector('[name=toId]');to.value=f.workspace.accounts.find(a=>a.currency==='ARS').id;to.dispatchEvent(new Event('change',{bubbles:true}));});});
   await check('recurring','#finance-recurring-modal',()=>page.evaluate(()=>window.lifecycle_controller.finanzas.openFinanceRecurringModal()));
   await check('income-registration','#finanzas-log-modal',()=>page.evaluate(()=>window.lifecycle_controller.finanzas.openFinanceRecurringRegistration('qa-recurring-income')));
   await check('expense-registration','#finanzas-expense-modal',()=>page.evaluate(()=>window.lifecycle_controller.finanzas.openFinanceRecurringRegistration('qa-recurring-expense')));
   await check('income-year','#finanzas-year-details-modal',()=>page.evaluate(()=>{const f=window.lifecycle_controller.finanzas;f.populateYearsSelector();f.renderAnnualBreakdown();document.getElementById('finanzas-year-details-modal').classList.remove('hidden');}));
   await check('expense-year','#finanzas-expense-year-details-modal',()=>page.evaluate(()=>{const f=window.lifecycle_controller.finanzas;f.populateExpenseYearsSelector();f.renderExpenseAnnualBreakdown();document.getElementById('finanzas-expense-year-details-modal').classList.remove('hidden');}));
   await check('receipt','#financial-receipt-dialog',()=>page.evaluate(async()=>{const {requestFinancialReceipt}=await import('/modules/FinancialReceiptDialog.js');void requestFinancialReceipt(window.lifecycle_controller,{title:'Confirmar cobro parcial del proyecto',description:window.lifecycle_controller.finanzas.data.entries[0].description,amountUsd:98765.43,date:'2026-10-10'});}));
   const modelUnchanged=await page.evaluate(()=>{const a=window.lifecycle_controller;return window.qaModalSnapshot===JSON.stringify({projects:a.projects.projects,history:a.projects.history,templates:a.projects.templateRegistry,finance:a.finanzas.data});});if(!modelUnchanged)throw Error('Opening audit dialogs changed business data');
  }
  assert.deepEqual(pageErrors,[],'The dialog audit must not cause browser exceptions');
  await c.close();console.log(JSON.stringify({width,theme,checked:report.filter(r=>r.width===width&&r.theme===theme).length,issues:report.filter(r=>r.width===width&&r.theme===theme&&(r.error||r.issues.length)).map(r=>({label:r.label,stress:r.stress,error:r.error,issues:r.issues?.length}))}));
 }
  assert.deepEqual(report.filter(r=>r.error || r.issues.length),[],'Dialogs must keep controls and text within their panels');
 }finally{await b.close();server.close();await fs.writeFile(path.join(root,'.tmp-sb/modal-audit/report.json'),JSON.stringify(report,null,2));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
