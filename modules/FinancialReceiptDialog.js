import { escapeHtml as esc } from '../text-utils.mjs';
import { buildFinanceReceipt, financeWorkspace } from '../finance-workspace-utils.mjs';
import { suggestedReceiptRate } from '../finance-currency-utils.mjs';
import { getLocalISODate } from '../utils.js';

// Capture the currency explicitly when receiving a new project payment. The
// project remains denominated in USD; its actual receipt is preserved alongside.
export function requestFinancialReceipt(app, { title, description, amountUsd, date }) {
    if (document.getElementById('financial-receipt-dialog')) return Promise.resolve(null);
    const owner = app.auth?.readyUserId, previous = document.activeElement;
    const dialog = document.createElement('dialog'); dialog.id='financial-receipt-dialog'; dialog.className='fw-dialog';
    const rate=suggestedReceiptRate(date,getLocalISODate(),app.getCachedExchangeRate?.());
    const money = new Intl.NumberFormat('es-AR',{style:'currency',currency:'USD'}).format(amountUsd);
    dialog.innerHTML=`<form><div class="fw-heading"><h2>${esc(title)}</h2><button type="button" data-close aria-label="Cerrar">✕</button></div>
        <p>${esc(description)}</p><p>${esc(date)} · Neto del proyecto: ${app.financialAmountsHidden ? '••••••' : esc(money)}</p>
        <div class="fw-form-grid"><label>Moneda en que recibiste el cobro<select name="currency"><option value="USD">USD</option><option value="ARS">ARS</option></select></label>
        <label>Cotización del cobro: ARS por 1 USD<input name="rate" type="number" min="0.000001" max="1000000" step="any" value="${rate||''}"></label>
        <p class="fw-note">En USD la cotización es opcional: permite ver el histórico en ARS. Usá la de este cobro; no se actualizará con el dólar de mañana. En ARS es necesaria para calcular lo recibido.</p>
        <p data-receipt-preview aria-live="polite"></p>
        <label>Cuenta donde lo recibiste (opcional)<select name="accountId"></select></label></div><p role="alert"></p>
        <div class="fw-actions"><button type="button" class="btn-secondary" data-close>Cancelar</button><button type="submit" class="btn-primary">Confirmar cobro</button></div></form>`;
    const accounts=financeWorkspace(app.finanzas?.data||{}).accounts;
    const preview=()=>{
        const code=dialog.querySelector('[name=currency]').value,rate=Number(dialog.querySelector('[name=rate]').value);
        const amount=code==='USD'?amountUsd:rate>0?amountUsd*rate:null;
        dialog.querySelector('[data-receipt-preview]').textContent=app.financialAmountsHidden?'Importe oculto':amount===null?'Indicá la cotización para ver el importe en ARS.':`Importe a registrar: ${code} ${new Intl.NumberFormat('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(amount)}${code==='ARS'?' (neto USD × cotización del cobro)':''}`;
    };
    const update=()=>{
        const code=dialog.querySelector('[name=currency]').value;
        dialog.querySelector('[name=rate]').required=code==='ARS';
        dialog.querySelector('[name=accountId]').innerHTML='<option value="">Sin cuenta asignada</option>'+accounts.filter(a=>!a.archived&&a.currency===code).map(a=>`<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('');
        preview();
    };
    update(); dialog.querySelector('[name=currency]').addEventListener('change',update);
    dialog.querySelector('[name=rate]').addEventListener('input',preview);
    return new Promise(resolve=>{
        let result=null;
        dialog.addEventListener('close',()=>{dialog.remove();if(previous?.isConnected)previous.focus();resolve(result);},{once:true});
        dialog.addEventListener('click',e=>{if(e.target===dialog||e.target.closest('[data-close]'))dialog.close();});
        dialog.querySelector('form').addEventListener('submit',e=>{
            e.preventDefault();
            try {
                if(!owner||owner!==app.auth?.readyUserId)throw new Error('La sesión cambió. Volvé a ingresar.');
                const input=Object.fromEntries(new FormData(e.target));
                const nativeAmount=input.currency==='ARS'?amountUsd*Number(input.rate):amountUsd;
                result=buildFinanceReceipt({...input,amount:nativeAmount.toFixed(2)}, {key:'income:project-receipt',date,amount:amountUsd,type:'income'},financeWorkspace(app.finanzas?.data||{}));
                delete result.key; dialog.close();
            } catch(error) { dialog.querySelector('[role=alert]').textContent=error.message; }
        });
        document.body.append(dialog);dialog.showModal();
    });
}
