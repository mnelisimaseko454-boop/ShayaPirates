// Shaya Pirates - FINAL FIXED - Tiered Cap + 10 Active + 14 Days + 15% Upkeep + 100 Starter + Supabase
const express=require('express'); const fs=require('fs'); const path=require('path');
const app=express(); app.use(express.json()); app.use(express.static(__dirname));
let supabase=null;
try{
  const {createClient}=require('@supabase/supabase-js');
  if(process.env.SUPABASE_URL && process.env.SUPABASE_KEY){
    supabase=createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    console.log('✅ Supabase connected');
  } else console.log('⚠️ No Supabase keys - using local file only');
}catch(e){ console.log('Supabase lib missing', e.message); }
const FILE=path.join(__dirname,'pirates.json');
let users=new Map(); let txs=[];
function loadLocalFile(){ try{ if(fs.existsSync(FILE)){ const d=JSON.parse(fs.readFileSync(FILE,'utf8')); users=new Map(Object.entries(d.users||{})); txs=d.txs||[]; } }catch(e){} }
function saveLocalFile(){ try{ fs.writeFileSync(FILE, JSON.stringify({users:Object.fromEntries(users), txs})); }catch(e){} }
loadLocalFile(); setInterval(saveLocalFile, 10000);

// ===== PROFIT ENGINE - TIERED CAP (FIXED) =====
const MAX_ACTIVE = 10;
const PIRATE_LIFE_DAYS = 14;
const UPKEEP = 0.15; // you keep 15%, user keeps 85%
const STARTER_BONUS = 100;
// Tiered cap: small = generous 200%, mid = 160%, big = 130% = you never lose on whales
function getMaxPayout(price){
  if(price >= 10000) return 1.30;
  if(price >= 1000) return 1.60;
  return 2.0;
}
const SHOP={
  deckhand:{name:'Deckhand',price:10,daily:2,emoji:'🧔'},
  powder:{name:'Powder Monkey',price:25,daily:5,emoji:'🏴‍☠️'},
  buccaneer:{name:'Buccaneer',price:50,daily:11,emoji:'🦜'},
  swash:{name:'Swashbuckler',price:100,daily:22,emoji:'⚔️'},
  corsair:{name:'Corsair Raider',price:250,daily:60,emoji:'🏴‍☠️'},
  gunner:{name:'Master Gunner',price:500,daily:120,emoji:'💣'},
  navigator:{name:'Sea Navigator',price:1000,daily:250,emoji:'🧭'},
  quarter:{name:'Quartermaster',price:2500,daily:650,emoji:'⚓'},
  mate:{name:'First Mate',price:5000,daily:1350,emoji:'⚔️'},
  captain:{name:'Ship Captain',price:10000,daily:2800,emoji:'👑'},
  dread:{name:'Dread Commodore',price:25000,daily:7500,emoji:'💀'},
  king:{name:'Pirate King',price:50000,daily:16000,emoji:'👑'}
};
const WD_MIN={GRAM:10000,TRX:10000,'USDT (BEP20)':10000,'USDT (TRC20)':120000,'USDT (TON)':10000,'USDT (Solana)':20000,DOGE:15000,LTC:10000};
function profitWithdrawFee(amount){ let fee=Math.floor(amount*0.05); if(amount<50000) fee+=100; return fee; }
function netDaily(s){ return Math.floor(s.daily * (1-UPKEEP) * 100)/100; }
async function saveToSupabase(u){
  if(!supabase) return;
  try{
    await supabase.from('pirate_users').upsert({
      id:String(u.id), name:u.name||'Captain', avatar:u.avatar||'',
      balance:u.balance||0, pending:u.pending||0, crew:u.crew||[],
      total_looted:u.totalLooted||0, daily_income:u.dailyIncome||0,
      partners:u.partners||0, partner_income:u.partnerIncome||0,
      referred_by:u.referredBy||'', partner_bonus_paid:!!u.partnerBonusPaid,
      last_collect:u.lastCollect||0, last_collect_attempt:u.lastCollectAttempt||0,
      updated_at:new Date().toISOString()
    });
  }catch(e){ console.log('Supabase save fail', e.message); }
}
async function loadFromSupabase(id){
  if(!supabase) return null;
  try{
    const {data}=await supabase.from('pirate_users').select('*').eq('id', String(id)).single();
    if(!data) return null;
    return {id:data.id, name:data.name, avatar:data.avatar, balance:data.balance, pending:data.pending, crew:data.crew||[], totalLooted:data.total_looted, dailyIncome:data.daily_income, partners:data.partners, partnerIncome:data.partner_income, referredBy:data.referred_by, partnerBonusPaid:data.partner_bonus_paid, lastCollect:data.last_collect, lastCollectAttempt:data.last_collect_attempt, tx:[], hasDeposited:false, totalInvested:0, totalMined:0};
  }catch(e){ return null; }
}
async function saveTxToSupabase(t){
  if(!supabase) return;
  try{ await supabase.from('pirate_txs').upsert({id:String(t.id), user_id:String(t.user_id), name:t.name||'', method:t.method||'', wallet:t.wallet||'', txid:t.txId||'', amount:t.amount||0, fee:t.fee||0, net:t.net||0, status:t.status||'pending'}); }catch(e){}
}
function newUser(id,name,avatar){
  return {id:String(id), name:name||'Captain', avatar:avatar||'', balance:STARTER_BONUS, crew:[], totalLooted:0, dailyIncome:0, partners:0, partnerIncome:0, tx:[{date:new Date().toISOString().slice(0,10), method:'Welcome Bonus', amount:'+'+STARTER_BONUS+' Gold', status:'✅'}], referredBy:'', lastCollect:Date.now(), pending:0, partnerBonusPaid:false, lastCollectAttempt:0, refMonth:{}, starterClaimed:true, hasDeposited:false, totalInvested:0, totalMined:0};
}
async function getUser(id,name,avatar){
  id=String(id);
  if(users.has(id)){ let u=users.get(id); if(name) u.name=name; if(avatar) u.avatar=avatar; if(u.hasDeposited===undefined) u.hasDeposited=false; if(!u.refMonth) u.refMonth={}; return u; }
  let u = await loadFromSupabase(id);
  if(!u){ u = newUser(id,name,avatar); users.set(id,u); saveLocalFile(); saveToSupabase(u); return u; }
  else { if(name) u.name=name; if(avatar) u.avatar=avatar; }
  if(!u.tx) u.tx=[]; if(!u.refMonth) u.refMonth={};
  if(u.hasDeposited===undefined) u.hasDeposited=false;
  if(!u.starterClaimed && u.balance===0 && u.tx.length===0){
    u.balance=STARTER_BONUS; u.starterClaimed=true;
    u.tx.unshift({date:new Date().toISOString().slice(0,10), method:'Welcome Bonus', amount:'+'+STARTER_BONUS+' Gold', status:'✅'});
  }
  users.set(id,u); saveLocalFile(); return u;
}
function upd(u){ users.set(String(u.id),u); saveLocalFile(); saveToSupabase(u); return u; }
let botModule=null; try{ botModule=require('./bot.js'); }catch(e){}
app.get('/api/pirate/user/:id', async (req,res)=>{
  const u=await getUser(req.params.id);
  const now=Date.now();
  u.crew=(u.crew||[]).filter(c=>c.expiresAt>now);
  u.dailyIncome=u.crew.reduce((a,c)=>a+netDaily({daily:c.daily})*c.count,0);
  let minedGross=0;
  u.crew.forEach(c=>{
    let gross=Math.floor(((Date.now()-(u.lastCollect||Date.now()))/86400000)*c.daily*c.count);
    let maxPay=c.maxPay|| (SHOP[c.id]?.price||0)*getMaxPayout(SHOP[c.id]?.price||0);
    let remaining=maxPay-(c.mined||0);
    if(gross>remaining) gross=Math.max(0,remaining);
    minedGross+=gross;
  });
  let minedNet=Math.floor(minedGross*(1-UPKEEP));
  res.json({...u, pending:(u.pending||0)+minedNet, activeCount:u.crew.reduce((a,c)=>a+c.count,0), maxActive:MAX_ACTIVE});
});
app.post('/api/pirate/set-ref', async (req,res)=>{
  const u=await getUser(req.body.user_id);
  if(req.body.ref && String(req.body.ref)!==String(u.id) && !u.referredBy){
    u.referredBy=String(req.body.ref);
    const ref=await getUser(req.body.ref); ref.partners=(ref.partners||0)+1; upd(ref); upd(u);
  }
  res.json({success:true});
});
app.post('/api/pirate/hire', async (req,res)=>{
  const u=await getUser(req.body.user_id, req.body.name, req.body.avatar);
  const s=SHOP[req.body.pirateId]; if(!s) return res.json({msg:'Not found'});
  u.crew=(u.crew||[]).filter(c=>c.expiresAt>Date.now());
  const activeCount=u.crew.reduce((a,c)=>a+c.count,0);
  if(activeCount>=MAX_ACTIVE) return res.json({msg:'⚓ Crew Full! 10 / 10 Active Pirates. Wait for one to expire (14 days) then hire again.'});
  if(u.balance < s.price) return res.json({msg:'Need '+s.price+' Gold. Balance: '+u.balance+' Gold. Deposit first.'});
  u.balance-=s.price; u.totalInvested=(u.totalInvested||0)+s.price;
  const expiresAt=Date.now()+PIRATE_LIFE_DAYS*24*60*60*1000; const expires=new Date(expiresAt).toISOString().slice(0,10);
  const maxPay=s.price*getMaxPayout(s.price);
  const ex=u.crew.find(c=>c.id===req.body.pirateId);
  if(ex){ ex.count++; ex.expires=expires; ex.expiresAt=expiresAt; ex.mined=ex.mined||0; if(!ex.maxPay) ex.maxPay=maxPay; }
  else u.crew.push({id:req.body.pirateId,name:s.name,daily:s.daily,emoji:s.emoji,count:1,expires,expiresAt,mined:0,maxPay});
  u.dailyIncome=u.crew.reduce((a,c)=>a+netDaily({daily:c.daily})*c.count,0);
  u.tx.unshift({date:new Date().toISOString().slice(0,10),method:'Hire '+s.name,amount:'-'+s.price+' Gold',status:'✅'});
  if(u.referredBy){
    const ref=await getUser(u.referredBy);
    const monthKey=new Date().toISOString().slice(0,7);
    ref.refMonth=ref.refMonth||{}; ref.refMonth[monthKey]=ref.refMonth[monthKey]||{};
    const earned=ref.refMonth[monthKey][u.id]||0;
    if(earned<5000){
      let comm=Math.floor(s.price*0.10); if(earned+comm>5000) comm=5000-earned;
      ref.pending=(ref.pending||0)+comm; ref.partnerIncome=(ref.partnerIncome||0)+comm;
      ref.refMonth[monthKey][u.id]=earned+comm;
      if(!u.partnerBonusPaid){ ref.pending+=25; ref.partnerIncome+=25; u.partnerBonusPaid=true; }
      upd(ref);
    }
  }
  upd(u); res.json({msg:'✅ Hired '+s.name+'! +'+netDaily(s)+'/day net (15% upkeep) for 14 days. Max loot '+maxPay+' Gold ('+Math.round(getMaxPayout(s.price)*100)+'% cap). Active: '+(activeCount+1)+' / 10'});
});
app.post('/api/pirate/collect', async (req,res)=>{
  const u=await getUser(req.body.user_id);
  if(Date.now()-(u.lastCollectAttempt||0) < 3600000) return res.json({msg:'⏳ Wait 1 hour between COLLECTs.'});
  u.lastCollectAttempt=Date.now();
  const now=Date.now();
  u.crew=(u.crew||[]).filter(c=>c.expiresAt>now);
  let minedGross=0;
  u.crew.forEach(c=>{
    let gross=Math.floor(((Date.now()-(u.lastCollect||Date.now()))/86400000)*c.daily*c.count);
    let maxPay=c.maxPay|| (SHOP[c.id]?.price||0)*getMaxPayout(SHOP[c.id]?.price||0);
    let remaining=maxPay-(c.mined||0);
    if(gross>remaining) gross=Math.max(0,remaining);
    c.mined=(c.mined||0)+gross; minedGross+=gross;
  });
  let minedNet=Math.floor(minedGross*(1-UPKEEP));
  const total=(u.pending||0)+minedNet;
  if(!total || total<1) return res.json({msg:'No loot yet. Pending: '+(total||0)+' Gold'});
  u.balance+=total; u.totalLooted+=total; u.totalMined=(u.totalMined||0)+total; u.pending=0; u.lastCollect=Date.now();
  u.dailyIncome=u.crew.reduce((a,c)=>a+netDaily({daily:c.daily})*c.count,0);
  u.tx.unshift({date:new Date().toISOString().slice(0,10),method:'Collect Loot (15% upkeep)',amount:'+'+total+' Gold',status:'✅'}); upd(u);
  res.json({msg:'💰 Collected +'+total+' Gold net → My Balance! (15% upkeep)'});
});
app.post('/api/pirate/withdraw', async (req,res)=>{
  const u=await getUser(req.body.user_id, req.body.name, req.body.avatar);
  const min=WD_MIN[req.body.method]||10000;
  if(!u.hasDeposited) return res.json({msg:'🔒 Withdraw locked. Deposit at least once to unlock withdraw. Starter 100 Gold is for trying, not cashing out.'});
  if(u.balance < req.body.amount) return res.json({msg:'Not enough. Balance: '+u.balance+' Gold'});
  if(req.body.amount < min) return res.json({msg:'Min for '+req.body.method+' is '+min+' Gold'});
  const fee=profitWithdrawFee(req.body.amount); const net=req.body.amount-fee;
  u.balance-=req.body.amount; const txId='#'+Math.floor(100000+Math.random()*900000);
  const t={id:txId,user_id:u.id,name:u.name,method:req.body.method,wallet:req.body.wallet,amount:req.body.amount,fee,net,usd:(net/10000).toFixed(2),status:'pending',created_at:new Date().toISOString(),avatar:u.avatar||''};
  txs.push(t); u.tx.unshift({date:new Date().toISOString().slice(0,10),method:'Withdraw '+req.body.method,amount:'-'+req.body.amount+' Gold (Fee '+fee+')',status:'⏳ Pending'}); upd(u); saveLocalFile(); saveTxToSupabase(t);
  if(botModule) botModule.notifyAdminWithdraw(t).catch(()=>{});
  res.json({success:true, msg:'✅ Withdraw requested! '+net+' Gold (~$'+t.usd+') - Fee '+fee+' Gold - ID '+txId});
});
app.post('/api/pirate/approve-withdraw', async (req,res)=>{
  const t=txs.find(x=>x.id===req.body.txId); if(!t) return res.json({success:false,error:'Not found'});
  if(t.status!=='pending') return res.json({success:false,error:'Already '+t.status});
  t.status='paid'; saveLocalFile(); saveTxToSupabase(t); res.json({success:true,tx:t});
});
app.post('/api/pirate/decline-withdraw', async (req,res)=>{
  const t=txs.find(x=>x.id===req.body.txId); if(!t) return res.json({success:false,error:'Not found'});
  if(t.status!=='pending') return res.json({success:false,error:'Already '+t.status});
  t.status='declined'; const u=await getUser(t.user_id); u.balance+=t.amount;
  u.tx.unshift({date:new Date().toISOString().slice(0,10),method:'Withdraw Declined - Refund',amount:'+'+t.amount+' Gold',status:'✅'}); upd(u); saveLocalFile(); saveTxToSupabase(t); res.json({success:true,tx:t});
});
app.post('/api/pirate/deposit-request', async (req,res)=>{
  const {user_id,name,method,txId,amountGold}=req.body;
  if(!txId) return res.json({success:false,error:'Paste TxID first'});
  if(txs.find(t=>t.txId===txId)) return res.json({success:false,error:'TxID already used!'});
  const u=await getUser(user_id,name);
  const t={id:'#DEP'+Date.now(),txId,user_id:u.id,name:u.name,method,amount:Number(amountGold),status:'pending_deposit',created_at:new Date().toISOString()};
  txs.push(t); saveLocalFile(); saveTxToSupabase(t);
  if(botModule) botModule.notifyAdminDeposit(t).catch(()=>{});
  res.json({success:true,msg:'Deposit request sent to admin! Wait for approval.'});
});
app.post('/api/pirate/approve-deposit', async (req,res)=>{
  const t=txs.find(x=>x.id===req.body.txId); if(!t) return res.json({success:false,error:'Not found'});
  if(t.status!=='pending_deposit') return res.json({success:false,error:'Already '+t.status});
  t.status='paid'; const u=await getUser(t.user_id); u.balance+=t.amount; u.hasDeposited=true;
  u.tx.unshift({date:new Date().toISOString().slice(0,10),method:'Deposit '+t.method,amount:'+'+t.amount+' Gold',status:'✅'}); upd(u); saveLocalFile(); saveTxToSupabase(t); res.json({success:true,tx:t});
});
app.get('/api/pirate/admin/txs',(req,res)=>{ res.json(txs.slice().reverse()); });
const PORT=process.env.PORT||3000; app.listen(PORT,()=>console.log('Shaya Pirates FINAL Tiered Cap 10/14/15% running',PORT));
