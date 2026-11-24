// Shaya Pirates PROFITABLE - Pirates expire 30 days, ROI 108-130%, 5% withdraw fee
const express=require('express'); const fs=require('fs'); const path=require('path');
const app=express(); app.use(express.json()); app.use(express.static(__dirname));
let supabase=null; try{ const {createClient}=require('@supabase/supabase-js'); if(process.env.SUPABASE_URL&&process.env.SUPABASE_KEY) supabase=createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY); }catch(e){}
const FILE=path.join(__dirname,'pirates.json'); let users=new Map(); let txs=[];
function load(){ try{ if(fs.existsSync(FILE)){ const d=JSON.parse(fs.readFileSync(FILE,'utf8')); users=new Map(Object.entries(d.users||{})); txs=d.txs||[]; } }catch(e){} }
function save(){ try{ fs.writeFileSync(FILE, JSON.stringify({users:Object.fromEntries(users), txs})); }catch(e){} }
load(); setInterval(save,10000);
const SHOP={deck:{name:'Deck Hand',price:5000,daily:180,emoji:'🏴‍☠️'},gunner:{name:'Gunner',price:10000,daily:380,emoji:'💣'},mate:{name:'First Mate',price:25000,daily:1000,emoji:'⚔️'},captain:{name:'Pirate Captain',price:60000,daily:2500,emoji:'👑'},legend:{name:'Legend of Seas',price:150000,daily:6500,emoji:'💎'}};
const WD_MIN={GRAM:10000,TRX:10000,'USDT (BEP20)':10000,'USDT (TRC20)':120000,'USDT (TON)':10000,'USDT (Solana)':20000,DOGE:15000,LTC:10000};
function getUser(id,name){ id=String(id); if(!users.has(id)){ users.set(id,{id,name:name||'Captain',balance:0,crew:[],totalLooted:0,dailyIncome:0,partners:0,partnerIncome:0,tx:[],referredBy:'',lastCollect:Date.now(),pending:0,partnerBonusPaid:false}); save(); } return users.get(id); }
function calcPending(u){
 const now=Date.now(); let active=[];
 for(let c of (u.crew||[])){ if(c.expiresAt > now) active.push(c); }
 u.crew=active; u.dailyIncome=active.reduce((a,c)=>a+c.daily*c.count,0);
 const hours=(now-(u.lastCollect||now))/3600000;
 const mined=Math.floor(hours/24 * u.dailyIncome);
 return (u.pending||0)+mined;
}
function upd(u){ users.set(String(u.id),u); save(); if(supabase) supabase.from('pirate_users').upsert({id:String(u.id),name:u.name,balance:u.balance,crew:u.crew,total_looted:u.totalLooted}).then(()=>{}); return u; }
let botModule=null; try{ botModule=require('./bot.js'); }catch(e){ console.log('bot.js not in same process'); }

app.get('/api/pirate/user/:id',(req,res)=>{ const u=getUser(req.params.id); const mined=Math.floor(((Date.now()-(u.lastCollect||Date.now()))/86400000)*(u.dailyIncome||0)); const totalPending=(u.pending||0)+mined; res.json({...u, pending:totalPending}); });
app.post('/api/pirate/set-ref',(req,res)=>{ const u=getUser(req.body.user_id); if(req.body.ref && String(req.body.ref)!==String(u.id) && !u.referredBy){ u.referredBy=String(req.body.ref); const ref=getUser(req.body.ref); ref.partners=(ref.partners||0)+1; upd(ref); upd(u); } res.json({success:true}); });
app.post('/api/pirate/hire',(req,res)=>{
 const u=getUser(req.body.user_id, req.body.name); const s=SHOP[req.body.pirateId]; if(!s) return res.json({msg:'Not found'});
 if(u.balance < s.price) return res.json({msg:'Need '+s.price+' Gold. Balance: '+u.balance+' Gold. Deposit first.'});
 u.balance-=s.price; const expiresAt=Date.now()+30*24*60*60*1000; const expires=new Date(expiresAt).toISOString().slice(0,10);
 const ex=u.crew.find(c=>c.id===req.body.pirateId); if(ex){ ex.count++; ex.expires=expires; ex.expiresAt=expiresAt; } else u.crew.push({id:req.body.pirateId,name:s.name,daily:s.daily,emoji:s.emoji,count:1,expires,expiresAt});
 u.dailyIncome=u.crew.reduce((a,c)=>a+c.daily*c.count,0);
 u.tx.unshift({date:new Date().toISOString().slice(0,10),method:'Hire '+s.name,amount:'-'+s.price+' Gold',status:'✅'});
 if(u.referredBy){ const ref=getUser(u.referredBy); const comm=Math.floor(s.price*0.10); ref.pending=(ref.pending||0)+comm; ref.partnerIncome=(ref.partnerIncome||0)+comm; if(!u.partnerBonusPaid){ ref.pending+=25; ref.partnerIncome+=25; u.partnerBonusPaid=true; } upd(ref); }
 upd(u); res.json({msg:'✅ Hired '+s.name+'! +'+s.daily+'/day for 30 days. Expires '+expires});
});
app.post('/api/pirate/collect',(req,res)=>{
 const u=getUser(req.body.user_id); const mined=Math.floor(((Date.now()-(u.lastCollect||Date.now()))/86400000)*(u.dailyIncome||0)); const total=(u.pending||0)+mined;
 if(!total || total<10) return res.json({msg:'No loot yet. Pirates mine daily. Pending: '+(total||0)+' Gold'});
 u.balance+=total; u.totalLooted+=total; u.pending=0; u.lastCollect=Date.now();
 u.tx.unshift({date:new Date().toISOString().slice(0,10),method:'Collect Loot',amount:'+'+total+' Gold',status:'✅'}); upd(u); res.json({msg:'💰 Collected +'+total+' Gold → My Balance!'});
});
app.post('/api/pirate/withdraw',(req,res)=>{
 const u=getUser(req.body.user_id, req.body.name); const min=WD_MIN[req.body.method]||10000;
 if(u.balance < req.body.amount) return res.json({msg:'Not enough. Balance: '+u.balance+' Gold'});
 if(req.body.amount < min) return res.json({msg:'Min for '+req.body.method+' is '+min+' Gold'});
 const fee=Math.floor(req.body.amount*0.05); const net=req.body.amount-fee;
 u.balance-=req.body.amount; const txId='#'+Math.floor(100000+Math.random()*900000);
 const t={id:txId,user_id:u.id,name:u.name,method:req.body.method,wallet:req.body.wallet,amount:req.body.amount,fee,net,usd:(net/10000).toFixed(2),status:'pending',created_at:new Date().toISOString()};
 txs.push(t); u.tx.unshift({date:new Date().toISOString().slice(0,10),method:'Withdraw '+req.body.method,amount:'-'+req.body.amount+' Gold (Fee '+fee+')',status:'⏳ Pending'}); upd(u); save();
 if(botModule) botModule.notifyAdminWithdraw(t).catch(()=>{});
 console.log('WITHDRAW',t); res.json({success:true, msg:'✅ Withdraw requested! '+net+' Gold (~$'+t.usd+') via '+req.body.method+' - Fee '+fee+' Gold - ID '+txId});
});
app.post('/api/pirate/approve-withdraw',(req,res)=>{ const t=txs.find(x=>x.id===req.body.txId); if(!t) return res.json({success:false, error:'Not found'}); if(t.status!=='pending') return res.json({success:false, error:'Already '+t.status}); t.status='paid'; save(); res.json({success:true, tx:t}); });
app.post('/api/pirate/decline-withdraw',(req,res)=>{
 const t=txs.find(x=>x.id===req.body.txId); if(!t) return res.json({success:false, error:'Not found'}); if(t.status!=='pending') return res.json({success:false, error:'Already '+t.status});
 t.status='declined'; const u=getUser(t.user_id); u.balance+=t.amount; u.tx.unshift({date:new Date().toISOString().slice(0,10),method:'Withdraw Declined - Refund',amount:'+'+t.amount+' Gold',status:'✅'}); upd(u); save(); res.json({success:true, tx:t});
});
app.post('/api/pirate/deposit-request',(req,res)=>{
 const {user_id, name, method, txId, amountGold} = req.body;
 if(!txId) return res.json({success:false, error:'Paste TxID first'});
 if(txs.find(t=>t.txId===txId)) return res.json({success:false, error:'TxID already used!'});
 const u=getUser(user_id, name);
 const t={id:'#DEP'+Date.now(), txId, user_id:u.id, name:u.name, method, amount:Number(amountGold), status:'pending_deposit', created_at:new Date().toISOString()};
 txs.push(t); save();
 if(botModule) botModule.notifyAdminDeposit(t).catch(()=>{});
 res.json({success:true, msg:'Deposit request sent to admin! Wait for approval. Admin will check TxID on blockchain.'});
});
app.post('/api/pirate/approve-deposit',(req,res)=>{
 const t=txs.find(x=>x.id===req.body.txId); if(!t) return res.json({success:false, error:'Not found'}); if(t.status!=='pending_deposit') return res.json({success:false, error:'Already '+t.status});
 t.status='paid'; const u=getUser(t.user_id); u.balance+=t.amount; u.tx.unshift({date:new Date().toISOString().slice(0,10),method:'Deposit '+t.method,amount:'+'+t.amount+' Gold',status:'✅'}); upd(u); save(); res.json({success:true, tx:t});
});
app.get('/api/pirate/admin/txs',(req,res)=>{ res.json(txs.slice().reverse()); });
app.get('/api/pirate/admin/stats',(req,res)=>{ let totalFees=0,totalPaid=0; for(let t of txs){ if(t.status==='paid'){ totalPaid+=t.net||0; totalFees+=t.fee||0; } } res.json({users:users.size, pendingWithdraws:txs.filter(t=>t.status==='pending').length, totalFees, totalPaid}); });
const PORT=process.env.PORT||3000; app.listen(PORT,()=>console.log('Shaya Pirates running',PORT));
