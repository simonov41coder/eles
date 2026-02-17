const mineflayer = require('mineflayer');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

// --- CONFIGURATION ---
const CONFIG = {
  host: 'play.kampungeles.id',
  port: 25565,
  username: 'Theo_not_bald',
  password: 'atk.exe',
  version: '1.20.1',
  lobbyItem: 'nether_star',
  realmItem: 'lime_dye',
  tpaTarget: 'simonov41',
  confirmItem: 'lime_stained_glass_pane',
  balanceInterval: 1800000 
};

let bot;
let botStatus = "Offline";
let currentBalance = "0 Shards";
let webLogs = [];
let reconnectTimer;
let botEnabled = true; // THE MASTER TOGGLE

function addLog(type, message) {
  const time = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Jakarta' });
  const cleanMsg = message.replace(/§[0-9a-fk-or]/g, '').trim();
  let color = "#f8fafc"; 
  if (type === 'SYSTEM') color = "#fbbf24";
  if (type === 'CHAT') color = "#4ade80";
  if (type === 'ECONOMY') color = "#2dd4bf";
  if (type === 'ERROR') color = "#f87171";

  webLogs.unshift(`<span style="color: ${color}">[${time}] [${type}] ${cleanMsg}</span>`);
  if (webLogs.length > 150) webLogs.pop();
  console.log(`[${time}] [${type}] ${cleanMsg}`);
}

// --- BOT CORE ---
function createBot() {
  if (!botEnabled) return; // Don't start if disabled
  if (reconnectTimer) clearTimeout(reconnectTimer);

  botStatus = "Connecting...";
  bot = mineflayer.createBot({
    host: CONFIG.host,
    port: CONFIG.port,
    username: CONFIG.username,
    version: CONFIG.version,
    auth: 'offline'
  });

  bot.on('message', (json) => {
    const msg = json.toString();
    const cleanMsg = msg.replace(/§[0-9a-fk-or]/g, '');
    const lowerMsg = cleanMsg.toLowerCase();
    if (cleanMsg.includes('❤') || cleanMsg.includes('⌚') || cleanMsg.includes('|')) return;

    if (lowerMsg.includes('current balance') && lowerMsg.includes('shard')) {
      const match = cleanMsg.match(/[\d,.]+[kmbKMB]?/); 
      if (match) {
        currentBalance = `${match[0]} Shards`;
        addLog('ECONOMY', `Wealth: ${currentBalance}`);
      }
    } else {
      const isPlayerChat = cleanMsg.includes(':') || cleanMsg.includes('»') || cleanMsg.includes('->');
      if (isPlayerChat || lowerMsg.includes('welcome')) addLog('CHAT', cleanMsg);
    }
  });

  bot.once('spawn', () => {
    botStatus = "Authenticating...";
    addLog('SYSTEM', 'Spawned. Logging in...');
    setTimeout(() => {
      if(bot) bot.chat(`/login ${CONFIG.password}`);
    }, 5000);
  });

  bot.on('end', (reason) => {
    if (botEnabled) {
      botStatus = "Offline (Reconnecting)";
      addLog('ERROR', `Disconnected: ${reason}`);
      reconnectTimer = setTimeout(createBot, 15000);
    } else {
      botStatus = "PAUSED (User Login)";
      addLog('SYSTEM', 'Bot remained offline for manual user login.');
    }
  });

  bot.on('error', (err) => addLog('ERROR', err.message));

  bot.on('windowOpen', async (window) => {
    const confirmSlot = window.slots.find(i => i && i.name === CONFIG.confirmItem);
    if (confirmSlot) {
      addLog('SYSTEM', 'Auto-confirming TPA GUI...');
      await new Promise(r => setTimeout(r, 1200));
      if(bot) bot.clickWindow(confirmSlot.slot, 0, 0);
    }
  });
}

// --- WATCHDOG ---
setInterval(() => {
  if (!bot || !bot.entity || !botEnabled) return;
  const hotbar = bot.inventory.slots.slice(36, 45);
  const star = hotbar.find(i => i && i.name.includes(CONFIG.lobbyItem));
  if (star) {
    addLog('SYSTEM', 'Lobby detected. Re-joining realm...');
    handleLobbyJoin(star);
  }
}, 10000);

async function handleLobbyJoin(starItem) {
  try {
    const slot = bot.inventory.slots.indexOf(starItem) - 36;
    bot.setQuickBarSlot(slot);
    bot.activateItem();
    bot.once('windowOpen', async (window) => {
      await new Promise(r => setTimeout(r, 2000));
      const realm = window.slots.find(i => i && i.name.includes(CONFIG.realmItem));
      if (realm) {
        await bot.clickWindow(realm.slot, 0, 0);
        setTimeout(() => { if(bot) bot.chat('/afk'); }, 8000);
      }
    });
  } catch (e) {}
}

createBot();

// --- DASHBOARD ---
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Theo_not_bald Control</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { background: #020617; color: #f8fafc; font-family: sans-serif; padding: 20px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
          .card { background: #1e293b; padding: 15px; border-radius: 12px; border: 1px solid #334155; }
          .val { font-size: 1.1rem; font-weight: bold; margin-top: 5px; color: #3b82f6; }
          #logs { background: #000; height: 50vh; overflow-y: auto; padding: 15px; border-radius: 12px; font-family: monospace; font-size: 12px; border: 1px solid #334155; }
          .controls { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 20px; }
          input { grid-column: span 2; padding: 12px; border-radius: 8px; background: #0f172a; color: white; border: 1px solid #334155; }
          button { padding: 12px; border-radius: 8px; border: none; font-weight: bold; cursor: pointer; color: white; }
          .btn-blue { background: #3b82f6; }
          .btn-red { background: #ef4444; }
          .btn-green { background: #10b981; }
          .btn-purple { background: #8b5cf6; }
        </style>
      </head>
      <body>
        <div class="grid">
          <div class="card"><div>Status</div><div class="val" id="st">${botStatus}</div></div>
          <div class="card"><div>Wealth</div><div class="val" id="bl" style="color:#10b981">${currentBalance}</div></div>
        </div>
        <div id="logs">${webLogs.join('<br>')}</div>
        <div class="controls">
          <input type="text" id="m" placeholder="Chat/Command..." onkeypress="if(event.key==='Enter')send()">
          <button class="btn-blue" onclick="send()">Send Chat</button>
          <button id="pwr" class="btn-red" onclick="togglePower()">SHUTDOWN BOT</button>
          <button class="btn-purple" onclick="fetch('/tpa')">TPA to Simon</button>
          <button class="btn-green" onclick="fetch('/force-bal')">Check Wealth</button>
        </div>
        <script>
          let enabled = true;
          function send(){
            const i = document.getElementById('m');
            fetch('/chat?msg='+encodeURIComponent(i.value));
            i.value='';
          }
          function togglePower(){
            enabled = !enabled;
            const btn = document.getElementById('pwr');
            btn.innerText = enabled ? "SHUTDOWN BOT" : "START BOT";
            btn.className = enabled ? "btn-red" : "btn-green";
            fetch('/toggle?state=' + enabled);
          }
          setInterval(()=> {
            fetch('/data').then(r=>r.json()).then(d=>{
              document.getElementById('st').innerText = d.status;
              document.getElementById('bl').innerText = d.balance;
              document.getElementById('logs').innerHTML = d.logs.join('<br>');
            });
          }, 2000);
        </script>
      </body>
    </html>
  `);
});

app.get('/data', (req, res) => res.json({ status: botStatus, balance: currentBalance, logs: webLogs }));
app.get('/toggle', (req, res) => {
  botEnabled = req.query.state === 'true';
  if (!botEnabled) {
    botStatus = "PAUSED (User Login)";
    if (bot) bot.quit();
    bot = null;
    addLog('SYSTEM', 'Powering down... You can now login safely.');
  } else {
    addLog('SYSTEM', 'Powering up... Bot starting.');
    createBot();
  }
  res.sendStatus(200);
});
app.get('/chat', (req, res) => { if(bot) bot.chat(req.query.msg); res.sendStatus(200); });
app.get('/tpa', (req, res) => { if(bot) bot.chat('/tpa ' + CONFIG.tpaTarget); res.sendStatus(200); });
app.get('/force-bal', (req, res) => { if(bot) bot.chat('/shard balance'); res.sendStatus(200); });

app.listen(PORT);

