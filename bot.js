// Shaya Pirates Bot - Telegram - FINAL
const TelegramBot = require('node-telegram-bot-api');
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const PAYMENT_CHANNEL = process.env.PAYMENT_CHANNEL || '@ShayaPiratesPayment';
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://shaya-pirates.onrender.com';
if(!BOT_TOKEN){ console.log('⚠️ No BOT_TOKEN - bot.js disabled'); module.exports={notifyAdminWithdraw:async()=>{}, notifyAdminDeposit:async()=>{}}; return; }
const bot = new TelegramBot(BOT_TOKEN, {polling:true});
console.log('🏴‍☠️ Shaya Pirates Bot running');
bot.onText(/\/start(?:\s+(.*))?/, async (msg, match)=>{
  const chatId = msg.chat.id;
  const ref = match[1] || '';
  let refParam = '';
  if(ref && ref.startsWith('ref_')){ refParam = '?start='+ref; }
  const name = msg.from.first_name || 'Captain';
  await bot.sendMessage(chatId, `🏴‍☠️ Ahoy ${name}! Welcome to Shaya Pirates!\n\n🎁 YOU GOT 100 GOLD FREE - Starter Bonus!\n\n🪙 Hire pirates → They mine Gold daily\n💰 COLLECT Gold → Withdraw to GRAM / TRX / USDT\n👥 Invite friends → Earn 10%\n\nYour 100 Gold is already in your balance. Deposit more to hire your first pirate!`, {
    reply_markup:{ inline_keyboard:[
      [{text:'🏴‍☠️ PLAY SHAYA PIRATES - CLAIM 100 GOLD', web_app:{url: WEBAPP_URL + refParam}}],
      [{text:'💰 Deposit', callback_data:'deposit'}, {text:'💸 Withdraw', callback_data:'withdraw'}],
      [{text:'👥 Partners', callback_data:'partners'}, {text:'📢 Payment Channel', url:'https://t.me/'+PAYMENT_CHANNEL.replace('@','')}]
    ]}
  });
});
bot.on('callback_query', async (q)=>{
  const chatId = q.message.chat.id;
  if(q.data==='deposit') await bot.sendMessage(chatId, '💰 Deposit: Open app → Deposit → Send crypto to admin wallet → Paste TxID. 10,000 Gold = $1');
  if(q.data==='withdraw') await bot.sendMessage(chatId, '💸 Withdraw: Open app → Withdraw → Choose method → Min 10,000 Gold ($1), TRC20 Min 120,000 Gold. Fee 5%.');
  if(q.data==='partners') await bot.sendMessage(chatId, '👥 Partners: Open app → Partners → Copy link → Share. Earn 10% + 25 Gold per friend.');
  bot.answerCallbackQuery(q.id);
});
async function notifyAdminWithdraw(t){
  if(!ADMIN_ID) return;
  await bot.sendMessage(ADMIN_ID, `💸 NEW WITHDRAW\n\n👤 ${t.name} (ID: ${t.user_id})\n🪙 ${t.amount} Gold → Net ${t.net} Gold (~$${t.usd})\n💳 ${t.method}\n🏦 ${t.wallet}\n🧾 Fee: ${t.fee} Gold\n🆔 ${t.id}`, {
    reply_markup:{ inline_keyboard:[
      [{text:'✅ APPROVE + POST TO CHANNEL', callback_data:'approve_wd_'+t.id}],
      [{text:'❌ DECLINE + REFUND', callback_data:'decline_wd_'+t.id}]
    ]}
  });
}
async function notifyAdminDeposit(t){
  if(!ADMIN_ID) return;
  await bot.sendMessage(ADMIN_ID, `💰 NEW DEPOSIT REQUEST\n\n👤 ${t.name} (ID: ${t.user_id})\n🪙 ${t.amount} Gold\n💳 ${t.method}\n🔗 TxID: ${t.txId}\n🆔 ${t.id}`, {
    reply_markup:{ inline_keyboard:[
      [{text:'✅ APPROVE DEPOSIT', callback_data:'approve_dep_'+t.id}],
      [{text:'❌ DECLINE', callback_data:'decline_dep_'+t.id}]
    ]}
  });
}
bot.on('callback_query', async (q)=>{
  const data = q.data || '';
  if(!data.startsWith('approve_') && !data.startsWith('decline_')) return;
  const id = data.replace('approve_wd_','').replace('decline_wd_','').replace('approve_dep_','').replace('decline_dep_','');
  const base = process.env.RENDER_URL || WEBAPP_URL;
  try{
    if(data.startsWith('approve_wd_')){
      const r = await fetch(base + '/api/pirate/approve-withdraw', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({txId:id})});
      const d = await r.json();
      if(d.success){
        await bot.sendMessage(q.message.chat.id, `✅ Approved ${id}. Now pay user manually from your wallet, then post to channel.`);
        await bot.sendMessage(PAYMENT_CHANNEL, `💸 PAID! 🏴‍☠️\n\n👤 ${d.tx.name}\n🪙 ${d.tx.net} Gold (~$${d.tx.usd})\n💳 ${d.tx.method}\n🆔 ${d.tx.id}\n\n#ShayaPirates #Paid`);
        try{ await bot.sendMessage(d.tx.user_id, `✅ Your withdraw ${id} was APPROVED! ${d.tx.net} Gold (~$${d.tx.usd}) via ${d.tx.method} - Check your wallet!`); }catch(e){}
      } else await bot.sendMessage(q.message.chat.id, 'Error: '+(d.error||'failed'));
    }
    if(data.startsWith('decline_wd_')){
      const r = await fetch(base + '/api/pirate/decline-withdraw', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({txId:id})});
      const d = await r.json();
      await bot.sendMessage(q.message.chat.id, d.success ? `❌ Declined ${id} + refunded.` : 'Error: '+(d.error||'failed'));
    }
    if(data.startsWith('approve_dep_')){
      const r = await fetch(base + '/api/pirate/approve-deposit', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({txId:id})});
      const d = await r.json();
      await bot.sendMessage(q.message.chat.id, d.success ? `✅ Deposit ${id} approved. User got ${d.tx.amount} Gold.` : 'Error: '+(d.error||'failed'));
      if(d.success){ try{ await bot.sendMessage(d.tx.user_id, `✅ Deposit approved! +${d.tx.amount} Gold added to your balance!`); }catch(e){} }
    }
  }catch(e){ await bot.sendMessage(q.message.chat.id, 'Bot error: '+e.message); }
  bot.answerCallbackQuery(q.id);
});
module.exports={notifyAdminWithdraw, notifyAdminDeposit, bot};
