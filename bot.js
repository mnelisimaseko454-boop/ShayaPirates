// Shaya Pirates Bot - Telegram - FINAL - Menu Below Payments
const TelegramBot = require('node-telegram-bot-api');
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const PAYMENT_CHANNEL = process.env.PAYMENT_CHANNEL || '@ShayaPiratesPayment';
const SUPPORT_USERNAME = process.env.SUPPORT_USERNAME || 'ShayaPiratesSupport';
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://shaya-pirates.onrender.com';
if(!BOT_TOKEN){ console.log('⚠️ No BOT_TOKEN - bot.js disabled'); module.exports={notifyAdminWithdraw:async()=>{}, notifyAdminDeposit:async()=>{}}; return; }
const bot = new TelegramBot(BOT_TOKEN, {polling:true});
console.log('🏴‍☠️ Shaya Pirates Bot running');
bot.setMyCommands([
  {command:'start', description:'🏴‍☠️ Play Shaya Pirates'},
  {command:'play', description:'🎮 Open Mini App'},
  {command:'balance', description:'🪙 Check My Balance'},
  {command:'crew', description:'🏴‍☠️ My Crew'},
  {command:'deposit', description:'💰 How to Deposit'},
  {command:'withdraw', description:'💸 How to Withdraw'},
  {command:'partners', description:'👥 Partners - Earn 10%'},
  {command:'guide', description:'🦜 Captain Guide'},
  {command:'support', description:'🆘 Support'},
  {command:'payments', description:'📢 Payment Proofs Channel'},
]).catch(()=>{});
function mainKeyboard(refParam){
  return { reply_markup:{ inline_keyboard:[
    [{text:'🏴‍☠️ PLAY SHAYA PIRATES - CLAIM 100 GOLD', web_app:{url: WEBAPP_URL + (refParam||'')}}],
    [{text:'💰 Deposit', callback_data:'deposit'}, {text:'💸 Withdraw', callback_data:'withdraw'}],
    [{text:'👥 Partners', callback_data:'partners'}, {text:'📢 Payment Channel', url:'https://t.me/'+PAYMENT_CHANNEL.replace('@','')}],
    [{text:'🪙 My Balance', callback_data:'balance'}, {text:'🏴‍☠️ My Crew', callback_data:'crew'}],
    [{text:'🦜 Captain\'s Guide', callback_data:'guide'}, {text:'🆘 Support', callback_data:'support'}],
    [{text:'🔄 Refresh Menu', callback_data:'refresh'}],
  ]}};
}
function webAppKeyboard(){ return { reply_markup:{ inline_keyboard:[ [{text:'🏴‍☠️ OPEN APP', web_app:{url: WEBAPP_URL}}], [{text:'⬅️ Back to Menu', callback_data:'menu'}] ]}}; }
async function getBalanceText(userId){
  try{
    const base = process.env.RENDER_URL || WEBAPP_URL;
    const r = await fetch(base + '/api/pirate/user/'+userId); const u = await r.json();
    const active = (u.crew||[]).reduce((a,c)=>a+c.count,0);
    return `🪙 **My Balance**\n\n💰 Balance: ${Math.floor(u.balance||0).toLocaleString()} Gold\n📦 Pending: ${Math.floor(u.pending||0).toLocaleString()} Gold\n📈 Daily: +${Math.floor(u.dailyIncome||0).toLocaleString()} Gold/day\n🏴‍☠️ Active Crew: ${active} / 10\n🏆 Total Looted: ${Math.floor(u.totalLooted||0).toLocaleString()} Gold\n👥 Partners: ${u.partners||0} • Partner Income: ${Math.floor(u.partnerIncome||0).toLocaleString()} Gold\n\nStarter 100 Gold already included. Withdraw unlocks after first deposit.`;
  }catch(e){ return 'Open the app to see your balance.'; }
}
async function getCrewText(userId){
  try{
    const base = process.env.RENDER_URL || WEBAPP_URL;
    const r = await fetch(base + '/api/pirate/user/'+userId); const u = await r.json();
    if(!(u.crew||[]).length) return '🏴‍☠️ **My Crew**\n\nNo crew yet. Open app → Hire your first pirate!\n\nMax 10 Active Pirates • 14 days • Tiered Cap';
    let lines = u.crew.map(c=>`• ${c.emoji||'🏴‍☠️'} ${c.name} x${c.count} — +${Math.floor(c.daily*0.85*c.count)} net/day • Expires: ${c.expires}`).join('\n');
    return `🏴‍☠️ **My Crew — ${(u.crew||[]).reduce((a,c)=>a+c.count,0)} / 10**\n\n${lines}\n\nCollect in app to move loot → Balance.`;
  }catch(e){ return 'Open the app to see your crew.'; }
}
bot.onText(/\/start(?:\s+(.*))?/, async (msg, match)=>{
  const chatId = msg.chat.id; const ref = match[1] || ''; let refParam = '';
  if(ref && ref.startsWith('ref_')){ refParam = '?start='+ref; }
  const name = msg.from.first_name || 'Captain';
  await bot.sendMessage(chatId, `🏴‍☠️ Ahoy ${name}! Welcome to Shaya Pirates!\n\n🎁 YOU GOT 100 GOLD FREE - Starter Bonus!\n\n🪙 Hire up to 10 pirates → They mine for 14 days\n📺 Watch short ad → COLLECT → Withdraw\n👥 Invite friends → Earn 10%\n\nYour 100 Gold is already in your balance.`, mainKeyboard(refParam));
});
bot.onText(/\/play/, async (msg)=>{ await bot.sendMessage(msg.chat.id, '🎮 Tap to open Shaya Pirates:', webAppKeyboard()); });
bot.onText(/\/balance/, async (msg)=>{ await bot.sendMessage(msg.chat.id, await getBalanceText(msg.from.id), {parse_mode:'Markdown', ...webAppKeyboard()}); });
bot.onText(/\/crew/, async (msg)=>{ await bot.sendMessage(msg.chat.id, await getCrewText(msg.from.id), {parse_mode:'Markdown', ...webAppKeyboard()}); });
bot.onText(/\/deposit/, async (msg)=>{ await bot.sendMessage(msg.chat.id, '💰 **Deposit:**\n\n1. Open app → Deposit\n2. Send crypto to admin wallet\n3. Paste TxID in app\n4. Admin approves → Gold added\n\n10,000 Gold = $1.00', {parse_mode:'Markdown', ...webAppKeyboard()}); });
bot.onText(/\/withdraw/, async (msg)=>{ await bot.sendMessage(msg.chat.id, '💸 **Withdraw:**\n\nOpen app → Withdraw → Choose GRAM / TRX / USDT\nMin 10,000 Gold ($1) • TRC20 Min 120,000 Gold\nFee: 5% + 100 Gold on small\n\n🔒 Withdraw unlocks after first deposit.', {parse_mode:'Markdown', ...webAppKeyboard()}); });
bot.onText(/\/partners/, async (msg)=>{ const link = `https://t.me/ShayaPiratesBot?start=ref_${msg.from.id}`; await bot.sendMessage(msg.chat.id, `👥 **Partners — Earn 10%**\n\nYour link:\n\`${link}\`\n\n• 10% of every pirate your friend buys\n• +25 Gold when they hire first pirate\n• Capped 5,000 Gold / friend / month`, {parse_mode:'Markdown', ...webAppKeyboard()}); });
bot.onText(/\/guide/, async (msg)=>{ await bot.sendMessage(msg.chat.id, '🦜 **Captain\'s Guide**\n\n1. Claim 100 Gold free\n2. Deposit to unlock withdraw\n3. Hire up to 10 pirates (14 days each)\n4. Watch short ad → COLLECT\n5. Invite friends for 10%\n6. Withdraw at 10,000 Gold ($1)\n\nSmall pirates cap 200%, Big pirates cap 130% — re-hire to keep earning!', {parse_mode:'Markdown', ...webAppKeyboard()}); });
bot.onText(/\/support/, async (msg)=>{ await bot.sendMessage(msg.chat.id, `🆘 **Support**\n\nMessage: @${SUPPORT_USERNAME}\nInclude: Your Telegram ID (${msg.from.id}) + Screenshot + TxID if deposit/withdraw issue.`, {reply_markup:{inline_keyboard:[[{text:'🆘 Message Support', url:'https://t.me/'+SUPPORT_USERNAME}],[{text:'🏴‍☠️ Back to Menu', callback_data:'menu'}]]}}); });
bot.onText(/\/payments/, async (msg)=>{ await bot.sendMessage(msg.chat.id, `📢 **Payment Proofs**\n\nAll paid withdrawals are posted here:\n${PAYMENT_CHANNEL}\n\nJoin to see real payouts!`, {reply_markup:{inline_keyboard:[[{text:'📢 Join Payment Channel', url:'https://t.me/'+PAYMENT_CHANNEL.replace('@','')}]]}}); });
bot.onText(/\/menu/, async (msg)=>{ await bot.sendMessage(msg.chat.id, '🏴‍☠️ **Shaya Pirates Menu** — Choose below:', mainKeyboard('')); });
bot.on('callback_query', async (q)=>{
  const chatId = q.message.chat.id; const data = q.data || '';
  try{
    if(data==='menu'){ await bot.sendMessage(chatId, '🏴‍☠️ **Shaya Pirates Menu** — Choose below:', mainKeyboard('')); }
    if(data==='refresh'){ await bot.sendMessage(chatId, '🔄 Menu refreshed! Your 100 Gold + crew are safe.', mainKeyboard('')); }
    if(data==='deposit') await bot.sendMessage(chatId, '💰 Deposit: Open app → Deposit → Send crypto → Paste TxID. 10,000 Gold = $1', webAppKeyboard());
    if(data==='withdraw') await bot.sendMessage(chatId, '💸 Withdraw: Open app → Withdraw → Min 10,000 Gold ($1), TRC20 Min 120,000 Gold. Fee 5% + 100. Unlocks after first deposit.', webAppKeyboard());
    if(data==='partners'){ const link = `https://t.me/ShayaPiratesBot?start=ref_${q.from.id}`; await bot.sendMessage(chatId, `👥 Partners — Earn 10%\n\nYour link:\n${link}\n\n• 10% of every pirate friend buys\n• +25 Gold on first hire`, webAppKeyboard()); }
    if(data==='balance') await bot.sendMessage(chatId, await getBalanceText(q.from.id), {parse_mode:'Markdown', ...webAppKeyboard()});
    if(data==='crew') await bot.sendMessage(chatId, await getCrewText(q.from.id), {parse_mode:'Markdown', ...webAppKeyboard()});
    if(data==='guide') await bot.sendMessage(chatId, '🦜 Captain\'s Guide\n\n1. Claim 100 Gold\n2. Deposit to unlock withdraw\n3. Hire up to 10 pirates (14 days)\n4. Watch ad → COLLECT\n5. Invite friends 10%\n6. Withdraw at 10,000 Gold', webAppKeyboard());
    if(data==='support') await bot.sendMessage(chatId, `🆘 Support: @${SUPPORT_USERNAME}\nSend your ID: ${q.from.id} + screenshot`, {reply_markup:{inline_keyboard:[[{text:'🆘 Message Support', url:'https://t.me/'+SUPPORT_USERNAME}],[{text:'🏴‍☠️ Back to Menu', callback_data:'menu'}]]}});
    if(data.startsWith('approve_') || data.startsWith('decline_')){
      const id = data.replace('approve_wd_','').replace('decline_wd_','').replace('approve_dep_','').replace('decline_dep_','');
      const base = process.env.RENDER_URL || WEBAPP_URL;
      if(data.startsWith('approve_wd_')){
        const r = await fetch(base + '/api/pirate/approve-withdraw', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({txId:id})});
        const d = await r.json();
        if(d.success){
          await bot.sendMessage(chatId, `✅ Approved ${id}. Now pay user manually, then post to channel.`);
          await bot.sendMessage(PAYMENT_CHANNEL, `💸 PAID! 🏴‍☠️\n\n👤 ${d.tx.name}\n🪙 ${d.tx.net} Gold (~$${d.tx.usd})\n💳 ${d.tx.method}\n🆔 ${d.tx.id}\n\n#ShayaPirates #Paid`);
          try{ await bot.sendMessage(d.tx.user_id, `✅ Your withdraw ${id} was APPROVED! ${d.tx.net} Gold (~$${d.tx.usd}) via ${d.tx.method} - Check your wallet!`); }catch(e){}
        } else await bot.sendMessage(chatId, 'Error: '+(d.error||'failed'));
      }
      if(data.startsWith('decline_wd_')){
        const r = await fetch(base + '/api/pirate/decline-withdraw', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({txId:id})});
        const d = await r.json();
        await bot.sendMessage(chatId, d.success ? `❌ Declined ${id} + refunded.` : 'Error: '+(d.error||'failed'));
      }
      if(data.startsWith('approve_dep_')){
        const r = await fetch(base + '/api/pirate/approve-deposit', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({txId:id})});
        const d = await r.json();
        await bot.sendMessage(chatId, d.success ? `✅ Deposit ${id} approved. User got ${d.tx.amount} Gold + withdraw unlocked.` : 'Error: '+(d.error||'failed'));
        if(d.success){ try{ await bot.sendMessage(d.tx.user_id, `✅ Deposit approved! +${d.tx.amount} Gold added! Withdraw now unlocked!`); }catch(e){} }
      }
    }
  }catch(e){ await bot.sendMessage(chatId, 'Bot error: '+e.message); }
  bot.answerCallbackQuery(q.id);
});
async function notifyAdminWithdraw(t){
  if(!ADMIN_ID) return;
  await bot.sendMessage(ADMIN_ID, `💸 NEW WITHDRAW\n\n👤 ${t.name} (ID: ${t.user_id})\n🪙 ${t.amount} Gold → Net ${t.net} Gold (~$${t.usd})\n💳 ${t.method}\n🏦 ${t.wallet}\n🧾 Fee: ${t.fee} Gold\n🆔 ${t.id}`, { reply_markup:{ inline_keyboard:[ [{text:'✅ APPROVE + POST TO CHANNEL', callback_data:'approve_wd_'+t.id}], [{text:'❌ DECLINE + REFUND', callback_data:'decline_wd_'+t.id}] ] }});
}
async function notifyAdminDeposit(t){
  if(!ADMIN_ID) return;
  await bot.sendMessage(ADMIN_ID, `💰 NEW DEPOSIT REQUEST\n\n👤 ${t.name} (ID: ${t.user_id})\n🪙 ${t.amount} Gold\n💳 ${t.method}\n🔗 TxID: ${t.txId}\n🆔 ${t.id}`, { reply_markup:{ inline_keyboard:[ [{text:'✅ APPROVE DEPOSIT', callback_data:'approve_dep_'+t.id}], [{text:'❌ DECLINE', callback_data:'decline_dep_'+t.id}] ] }});
}
module.exports={notifyAdminWithdraw, notifyAdminDeposit, bot};
