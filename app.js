const $ = id => document.getElementById(id);
const API = 'https://api.frankfurter.dev/v2';
const majors = ['EUR', 'GBP', 'JPY', 'CAD', 'CHF', 'AUD'];
const names = {USD:'US Dollar',EUR:'Euro',GBP:'British Pound',JPY:'Japanese Yen',CAD:'Canadian Dollar',CHF:'Swiss Franc',AUD:'Australian Dollar'};
const symbols = {EUR:'€',GBP:'£',JPY:'¥',CAD:'C$',CHF:'Fr',AUD:'A$',USD:'$'};
let days = 30, generation = 0, historyGeneration = 0, latestRate = null, currencies = [], controller;
const fmt = (n, digits=4) => Number(n).toLocaleString('en-US',{maximumFractionDigits:digits,minimumFractionDigits:digits});
const dateString = d => d.toISOString().slice(0,10);
async function get(path, signal) { const r = await fetch(API + path,{signal}); if(!r.ok) throw Error('Rate service unavailable'); return r.json(); }
function conversion() {
  const amount = $('amount').valueAsNumber;
  if(!Number.isFinite(amount) || amount<0){ $('result').textContent='—'; $('amount').setCustomValidity('Enter an amount of zero or more.'); return; }
  $('amount').setCustomValidity('');
  $('result').textContent = latestRate === null ? '—' : fmt(amount * latestRate, new Intl.NumberFormat('en',{style:'currency',currency:$('to').value}).resolvedOptions().maximumFractionDigits);
}
function showChange(el, current, previous, suffix='') {
  if(!previous){el.textContent='—';el.className='change';return;}
  const pct = (current/previous-1)*100;
  el.textContent = `${pct>=0?'+':''}${fmt(pct,2)}%${suffix}`;
  el.className = 'change ' + (pct>=0?'up':'down');
}
async function loadCurrencies() {
  try { currencies = await get('/currencies');
    for(const id of ['from','to']){const selected=$(id).value;$(id).replaceChildren(...currencies.map(c=>{const o=document.createElement('option');o.value=c.iso_code;o.textContent=c.iso_code;o.title=c.name;names[c.iso_code]=c.name;return o;}));$(id).value=selected;}
  } catch { /* The major-currency defaults remain usable if metadata is unavailable. */ }
}
async function loadChart() {
  const request=++historyGeneration, from=$('from').value, to=$('to').value;
  $('pair').textContent=`${from} / ${to}`;$('range-label').textContent=`PAST ${days} DAYS`;
  $('chart').replaceChildren();$('chart-empty').hidden=false;$('chart-empty').style.display='grid';$('chart-empty').textContent='Loading market history…';$('change').textContent='Loading history';
  try {
    const start=new Date();start.setUTCDate(start.getUTCDate()-days);
    let rows;
    if(from===to){rows=[{date:dateString(start),rate:1},{date:dateString(new Date()),rate:1}];}
    else rows=await get(`/rates?base=${from}&quotes=${to}&from=${dateString(start)}&to=${dateString(new Date())}`);
    if(request!==historyGeneration)return;
    rows=rows.filter(x=>Number.isFinite(x.rate)).sort((a,b)=>a.date.localeCompare(b.date));
    if(rows.length<2)throw Error('History unavailable for this currency pair.');
    $('chart-empty').style.display='none';
    const values=rows.map(r=>r.rate), min=Math.min(...values),max=Math.max(...values),padding=(max-min)*.18 || max*.003 || .003,lo=min-padding,hi=max+padding;
    const points=rows.map((r,i)=>[12+i/(rows.length-1)*690,240-(r.rate-lo)/(hi-lo)*220]);
    const path=points.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
    let svg='<defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#c3f86c" stop-opacity=".22"/><stop offset="100%" stop-color="#c3f86c" stop-opacity="0"/></linearGradient></defs>';
    for(let i=0;i<5;i++){const y=20+i*55;svg+=`<line x1="12" y1="${y}" x2="702" y2="${y}" stroke="#2a3536" stroke-dasharray="3 5"/><text x="722" y="${y+4}" fill="#8e9d9f" font-size="13" font-family="sans-serif">${fmt(hi-(hi-lo)*i/4,max>20?2:4)}</text>`;}
    svg+=`<path d="${path} L702,260 L12,260 Z" fill="url(#fill)"/><path d="${path}" stroke="#c3f86c" stroke-width="3" fill="none" stroke-linejoin="round"/><circle cx="${points.at(-1)[0]}" cy="${points.at(-1)[1]}" r="5" fill="#c3f86c"/>`;
    $('chart').innerHTML=svg;$('chart').setAttribute('aria-label',`${from} to ${to} reference rate from ${rows[0].date} to ${rows.at(-1).date}, ranging from ${min} to ${max}`);
    $('start-date').textContent=rows[0].date;$('end-date').textContent=rows.at(-1).date;
    showChange($('change'),rows.at(-1).rate,rows[0].rate,' this period');
  } catch(e){if(request!==historyGeneration)return;$('chart-empty').textContent='History unavailable. Try another pair or refresh.';$('change').textContent='—';$('start-date').textContent='—';$('end-date').textContent='—';}
}
async function refresh() {
  const request=++generation;controller?.abort();controller=new AbortController();
  latestRate=null;conversion();$('chart-rate').textContent='—';$('rate').textContent='Fetching the latest rate…';$('refresh').disabled=true;$('error').hidden=true;$('feed').textContent='Refreshing data';$('feed').className='feed';
  const from=$('from').value,to=$('to').value;
  loadChart();
  try {
    const targets=[...new Set([...majors,to])].filter(c=>c!==from);
    const rows=await get(`/rates?base=${from}&quotes=${targets.join(',')}`,controller.signal);
    if(request!==generation)return;
    const pair=from===to?{rate:1,date:dateString(new Date())}:rows.find(r=>r.quote===to);
    if(!pair)throw Error('This currency pair is unavailable. Try another pair.');
    latestRate=pair.rate;conversion();$('chart-rate').textContent=fmt(pair.rate);$('rate').textContent=`1 ${from} = ${fmt(pair.rate,6)} ${to}`;
    $('updated').textContent=`Rate date: ${pair.date} · Auto-refresh every 5 minutes.`;$('feed').textContent='Reference feed connected';$('feed').className='feed ready';
    $('board-base').textContent=`Per 1 ${from}`;
    const last=new Date(pair.date+'T00:00:00Z');last.setUTCDate(last.getUTCDate()-7);
    let history=[];try{history=await get(`/rates?base=${from}&quotes=${majors.filter(c=>c!==from).join(',')}&from=${dateString(last)}&to=${pair.date}`,controller.signal);}catch{}
    if(request!==generation)return;
    $('board').replaceChildren();$('ticker').replaceChildren();
    for(const code of majors.filter(c=>c!==from)){
      const r=rows.find(r=>r.quote===code);if(!r)continue;
      const past=history.filter(h=>h.quote===code&&h.date<r.date).sort((a,b)=>a.date.localeCompare(b.date)).at(-1);
      const tr=document.createElement('tr');
      const td=document.createElement('td');const currency=document.createElement('div');currency.className='currency';
      const icon=document.createElement('span');icon.className='currency-icon';icon.textContent=symbols[code]||code;
      const title=document.createElement('div');title.textContent=code;const subtitle=document.createElement('div');subtitle.className='currency-name';subtitle.textContent=names[code]||code;title.append(subtitle);currency.append(icon,title);td.append(currency);tr.append(td);
      const rate=document.createElement('td');rate.className='number';rate.textContent=fmt(r.rate);const change=document.createElement('td');const badge=document.createElement('span');showChange(badge,r.rate,past?.rate);change.append(badge);const date=document.createElement('td');date.className='muted';date.textContent=r.date;tr.append(rate,change,date);$('board').append(tr);
      if($('ticker').children.length<4){const item=document.createElement('div');item.className='ticker-item';const top=document.createElement('div');top.className='ticker-top';const label=document.createElement('span');label.textContent=`${from} / ${code}`;const move=document.createElement('span');showChange(move,r.rate,past?.rate);top.append(label,move);const value=document.createElement('strong');value.textContent=fmt(r.rate);item.append(top,value);$('ticker').append(item);}
    }
  }catch(e){if(request!==generation||e.name==='AbortError')return;$('error').textContent=e.message==='Rate service unavailable'?'Could not connect to the rate service. Check your connection and refresh.':e.message;$('error').hidden=false;$('feed').textContent='Feed unavailable';$('rate').textContent='Rate unavailable';$('board').innerHTML='<tr><td colspan="4">Rates unavailable. Refresh to try again.</td></tr>';$('ticker').textContent='Market data unavailable';}
  finally{if(request===generation)$('refresh').disabled=false;}
}
$('amount').addEventListener('input',conversion);
for(const id of ['from','to'])$(id).addEventListener('change',refresh);
$('swap').addEventListener('click',()=>{const from=$('from').value;$('from').value=$('to').value;$('to').value=from;refresh();});
$('refresh').addEventListener('click',refresh);
document.querySelectorAll('[data-days]').forEach(b=>b.addEventListener('click',()=>{days=Number(b.dataset.days);document.querySelectorAll('[data-days]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});loadChart();}));
function clock(){ $('clock').textContent=new Date().toLocaleTimeString('en-US',{timeZone:'UTC',hour12:false})+' UTC';}clock();setInterval(clock,1000);
loadCurrencies().then(refresh);setInterval(()=>{if(!document.hidden)refresh();},300000);
