// Shaya Pirates Bot - Admin Approve / Decline + Auto Payment Channel Post
const TelegramBot = require('node-telegram-bot-api');
const TOKEN = process.env.PIRATES_BOT_TOKEN;
const APP_URL = process.env.PIRATES_APP_URL || 'https://shaya-pirates.onrender.com';
const ADMIN_ID = process.env.PIRATES_ADMIN_ID;
const PAYMENT_CHANNEL = process.env.PIRATES_PAYMENT_CHANNEL || '@ShayaPiratesPayment';
const API = process.env.PIRATES_APP_URL || 'http://localhost:3000';
if(!TOKEN){ console.log('Missing PIRATES_BOT_TOKEN'); process.exit(1); }
const bot = new TelegramBot(TOKEN, {polling:true});
console.log('Shaya Pirates Bot running...');

bot.onText(/\/start(?:\s+ref_(.+))?/, async (msg, m)=>{
  const ref = m[1]; const userId = msg.from.id;
  if(ref && String(ref)!==String(userId)){ try{ await fetch(API+'/api/pirate/set-ref',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id:userId, ref})}); }catch(e){} }
  await bot.sendMessage(msg.chat.id,
`Ahoy, Captain ${msg.from.first_name}! 🏴‍☠️☠️

Welcome aboard the Shaya Pirates fleet! Build your legendary crew, gather golden doubloons, and conquer the high seas!

💰 My Balance = Gold to buy pirates
💰 COLLECT = Gold your pirates mined - tap to move to Balance
📈 Daily Income = What your pirates earn in 24h
⏳ Pirates work 30 days, then retire - re-hire to keep earning

👥 Partners: Earn 10% + 25 Gold bonus
🪙 10,000 Gold = $1.00
💸 Withdraw Min: 10,000 Gold ($1) - Fee 5%

Tap below to launch the Mini App! ⚓`,{
    reply_markup:{inline_keyboard:[
      [{text:'🏴‍☠️ Play Shaya Pirates Mini App', web_app:{url:APP_URL+'?start='+userId+(ref?'&ref='+ref:'')}}],
      [{text:'💳 Payment Channel', url:'https://t.me/'+PAYMENT_CHANNEL.replace('@','')}],
      [{text:'📖 How It Works', callback_data:'how'}]
    ]}
  });
});
bot.onText(/\/payment/, (msg)=> bot.sendMessage(msg.chat.id, '💳 All payments posted here:\nhttps://t.me/'+PAYMENT_CHANNEL.replace('@','')));
bot.onText(/\/balance/, async (msg)=>{
  try{ const r=await fetch(API+'/api/pirate/user/'+msg.from.id); const u=await r.json(); bot.sendMessage(msg.chat.id, `🏴‍☠️ Your Treasure:\n\n🪙 My Balance: ${u.balance} Gold\n💰 COLLECT Pending: ${u.pending} Gold\n📈 Daily Income: +${u.dailyIncome} Gold/day\n🏴‍☠️ Crew: ${(u.crew||[]).length} pirates`); }catch(e){ bot.sendMessage(msg.chat.id,'Open Mini App to see balance'); }
});
bot.on('callback_query', async (q)=>{
  const data=q.data; const chatId=q.message.chat.id;
  if(data==='how'){ await bot.answerCallbackQuery(q.id); return bot.sendMessage(chatId, `📖 HOW IT WORKS:\n\n1️⃣ Deposit Gold (Crypto)\n2️⃣ Buy a Pirate - it mines Gold every day for 30 days\n3️⃣ Tap COLLECT - mined Gold moves to My Balance\n4️⃣ Use My Balance to buy more pirates OR Withdraw\n5️⃣ Invite friends = 10% + 25 Gold\n\n⚠️ Pirates expire in 30 days.\n💸 Withdraw fee 5%.\n🔍 Deposit proof = TxID on blockchain, NOT screenshot.`); }
  if(data.startsWith('approve_wd_')){
    if(String(q.from.id)!==String(ADMIN_ID)) return bot.answerCallbackQuery(q.id,{text:'Admin only!',show_alert:true});
    const txId=data.replace('approve_wd_',''); await bot.answerCallbackQuery(q.id,{text:'Approving...'});
    try{
      const r=await fetch(API+'/api/pirate/approve-withdraw',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({txId})}); const d=await r.json();
      if(!d.success) return bot.sendMessage(chatId,'❌ '+(d.error||'Failed'));
      const tx=d.tx;
      await bot.editMessageText(`✅ APPROVED - ${tx.id}\n@${tx.name} - ${tx.amount} Gold via ${tx.method}\nPaid: ${tx.net} Gold (~$${tx.usd})\nWallet: ${tx.wallet}`,{chat_id:chatId,message_id:q.message.message_id});
      try{ await bot.sendMessage(tx.user_id, `✅ WITHDRAWAL PAID! 🏴‍☠️\n\n💰 ${tx.net} Gold (~$${tx.usd}) via ${tx.method}\n🆔 ${tx.id}\n\nCheck your wallet! Posted in ${PAYMENT_CHANNEL}`); }catch(e){}
      await bot.sendMessage(PAYMENT_CHANNEL, `✅ Withdrawal Completed! 🏴‍☠️\n@${tx.name}\n\n💰 Amount: ${tx.net} Gold (~$${tx.usd} USD)\n💳 Currency: ${tx.method}\n📍 Destination Wallet:\n${tx.wallet}\n🆔 Transaction ID: ${tx.id}\n\nYour booty has been successfully transferred to your wallet!`);
      await bot.sendMessage(chatId, `✅ Posted to ${PAYMENT_CHANNEL}`);
    }catch(e){ bot.sendMessage(chatId,'Error: '+e.message); } return;
  }
  if(data.startsWith('decline_wd_')){
    if(String(q.from.id)!==String(ADMIN_ID)) return bot.answerCallbackQuery(q.id,{text:'Admin only!',show_alert:true});
    const txId=data.replace('decline_wd_',''); await bot.answerCallbackQuery(q.id,{text:'Declining...'});
    try{
      const r=await fetch(API+'/api/pirate/decline-withdraw',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({txId})}); const d=await r.json();
      if(!d.success) return bot.sendMessage(chatId,'❌ '+(d.error||'Failed'));
      await bot.editMessageText(`❌ DECLINED - ${txId}\nRefunded to user.`,{chat_id:chatId,message_id:q.message.message_id});
      try{ await bot.sendMessage(d.tx.user_id, `❌ Withdrawal Declined\n\nYour ${d.tx.amount} Gold was refunded to My Balance.`); }catch(e){}
    }catch(e){ bot.sendMessage(chatId,'Error: '+e.message); } return;
  }
  if(data.startsWith('approve_dep_')){
    if(String(q.from.id)!==String(ADMIN_ID)) return bot.answerCallbackQuery(q.id,{text:'Admin only!',show_alert:true});
    const txId=data.replace('approve_dep_',''); await bot.answerCallbackQuery(q.id,{text:'Approving deposit...'});
    try{
      const r=await fetch(API+'/api/pirate/approve-deposit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({txId})}); const d=await r.json();
      if(!d.success) return bot.sendMessage(chatId,'❌ '+(d.error||'Failed'));
      await bot.editMessageText(`✅ DEPOSIT APPROVED - ${txId}\n+${d.tx.amount} Gold to @${d.tx.name}`,{chat_id:chatId,message_id:q.message.message_id});
      try{ await bot.sendMessage(d.tx.user_id, `✅ DEPOSIT APPROVED! 💰\n\n+${d.tx.amount} Gold added to My Balance!\nYou can now hire pirates! 🏴‍☠️`); }catch(e){}
    }catch(e){ bot.sendMessage(chatId,'Error: '+e.message); } return;
  }
});
async function notifyAdminWithdraw(tx){
  if(!ADMIN_ID) return;
  await bot.sendMessage(ADMIN_ID, `🚨 NEW WITHDRAW REQUEST\n\n👤 @${tx.name} (ID: ${tx.user_id})\n💰 Amount: ${tx.amount} Gold\n💸 Fee: ${tx.fee} Gold (Your profit)\n💰 Net to pay: ${tx.net} Gold (~$${tx.usd})\n💳 Method: ${tx.method}\n📍 Wallet: ${tx.wallet}\n🆔 ID: ${tx.id}\n\n⚠️ YOU send crypto FIRST, then tap Approve!`,{reply_markup:{inline_keyboard:[[{text:'✅ I SENT CRYPTO - APPROVE',callback_data:'approve_wd_'+tx.id}],[{text:'❌ DECLINE - REFUND',callback_data:'decline_wd_'+tx.id}]]}});
}
async function notifyAdminDeposit(tx){
  if(!ADMIN_ID) return;
  await bot.sendMessage(ADMIN_ID, `💰 NEW DEPOSIT REQUEST\n\n👤 @${tx.name} (ID: ${tx.user_id})\n🪙 Gold: ${tx.amount}\n💳 Method: ${tx.method}\n🔗 TxID: ${tx.txId}\n🆔 ID: ${tx.id}\n\n🔍 CHECK:\nTRC20: tronscan.org -> paste TxID\nBEP20: bscscan.com -> paste TxID\nTON: tonviewer.com -> paste TxID\n\nIf To = YOUR wallet + SUCCESS, tap Approve!`,{reply_markup:{inline_keyboard:[[{text:'✅ VERIFIED - APPROVE DEPOSIT',callback_data:'approve_dep_'+tx.id}],[{text:'❌ FAKE - DECLINE',callback_data:'decline_wd_'+tx.id}]]}});
}
module.exports={bot, notifyAdminWithdraw, notifyAdminDeposit};
