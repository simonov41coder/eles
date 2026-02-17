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
  balanceInterval: 1800000 // Check every 30 minutes (1,800,000 ms)
};

let bot;
let botStatus = "Initializing";
let currentBalance = "Checking...";
let webLogs = [];
let reconnectTimer;
let balanceTimer;

// --- LOGGING ---
function addLog(type, message) {
  const time = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Jakarta' });
  const cleanMsg = message.replace(/§[0-9a-fk-or]/g, ''); 
  
  let formattedMsg = "";
  if (type === 'SYSTEM') formattedMsg = `<span style="color: #ffca28">[SYS] ${cleanMsg}</span>`;
  else if (type === 'CHAT') formattedMsg = `<span style="color: #00ff41">${cleanMsg}</span>`;
  else if (type === 'ERROR') formattedMsg = `<span style="color: #ff5555">[ERR] ${cleanMsg}</span>`;
  else if (type === 'ECONOMY') formattedMsg = `<span style="color: #34d399; font-weight: bold;">[ECONOMY] ${cleanMsg}</span>`;

  webLogs.unshift(`[${time}] ${formattedMsg}`);
  if (webLogs.length > 300) webLogs.pop(); 
  console.log(`[${time}] [${type}] ${cleanMsg}`); 
}

// --- BOT LOGIC ---
function createBot() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (balanceTimer) clearInterval(balanceTimer);

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
    
    // 1. CHAT FILTER
    const isChat = cleanMsg.includes(':') || cleanMsg.includes('»') || cleanMsg.includes('->') || lowerMsg.includes('welcome') || lowerMsg.includes('has joined');
    const isStatBar = cleanMsg.includes('❤') || cleanMsg.includes('⌚') || cleanMsg.includes('|');

    // 2. BALANCE CATCHER
    // If message has "shard", a number, and isn't a standard player chat (prevents players spoofing it)
    if (lowerMsg.includes('shard') && /\d/.test(lowerMsg) && !cleanMsg.includes(':') && !isStatBar) {
       currentBalance = cleanMsg.trim(); // Save the exact server text
       addLog('ECONOMY', currentBalance);
    } 
    // Otherwise, handle regular chat
    else if (isChat && !isStatBar) {
      addLog('CHAT', cleanMsg);
    }
  });

  bot.once('spawn', () => {
    botStatus = "Authenticating";
    addLog('SYSTEM', 'Bot spawned. Waiting to login...');
    
    setTimeout(() => {
      bot.chat(`/login ${CONFIG.password}`);
      addLog('SYSTEM', 'Login credentials sent.');
      startNavigation();
      startBalanceChecker();
    }, 5000);
  });

  bot.on('end', (reason) => {
    botStatus = `Offline (${reason})`;
    currentBalance = "Offline";
    addLog('ERROR', `Disconnected: ${reason}`);
    reconnectTimer = setTimeout(createBot, 30000); 
  });

  bot.on('error', (err) => addLog('ERROR', err.message));
}

function startBalanceChecker() {
  // Wait 15 seconds after login to ask for the first balance check
  setTimeout(() => checkBalance(), 15000);
  
  // Then check automatically every 30 minutes
  balanceTimer = setInterval(() => checkBalance(), CONFIG.balanceInterval);
}

function checkBalance() {
  if (bot && bot.entity) {
    bot.chat('/shard balance');
    addLog('SYSTEM', 'Requested /shard balance from server.');
  }
}

function startNavigation() {
  botStatus = "Navigating to Realm...";
  const loop = setInterval(() => {
    if (!bot || !bot.entity) return clearInterval(loop);

    const items = bot.inventory.slots.slice(36, 45);
    const selector = items.find(i => i && i.name.includes(CONFIG.lobbyItem));

    if (selector) {
      bot.setQuickBarSlot(bot.inventory.slots.indexOf(selector) - 36);
      bot.activateItem();
      addLog('SYSTEM', 'Opened Realm Selector.');
      clearInterval(loop);

      bot.once('windowOpen', async (window) => {
        await new Promise(r => setTimeout(r, 2000)); 
        const realmIcon = window.slots.find(i => i && i.name.includes(CONFIG.realmItem));
        
        if (realmIcon) {
          await bot.clickWindow(realmIcon.slot, 0, 0);
          botStatus = "Joining Realm...";
          addLog('SYSTEM', 'Clicked Lime Dye. Waiting for teleport...');
          
          setTimeout(() => {
            bot.chat('/afk');
            botStatus = "AFK in Realm";
            addLog('SYSTEM', '/afk sent successfully.');
          }, 8000);
        } else {
          addLog('ERROR', 'Could not find Lime Dye! Retrying...');
          bot.closeWindow(window);
          startNavigation();
        }
      });
    }
  }, 5000);
}

createBot();

// --- WEB DASHBOARD ---
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Theo's Vault</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { background: #0f172a; color: #e2e8f0; font-family: 'Segoe UI', sans-serif; padding: 20px; margin: 0; }
          .container { max-width: 800px; margin: 0 auto; }
          .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
          .card { background: #1e293b; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
          .card h3 { margin: 0 0 10px 0; color: #94a3b8; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
          .status { font-weight: bold; color: #3b82f6; font-size: 1.2em; }
          .balance { font-weight: bold; color: #34d399; font-size: 1.2em; }
          #logs { background: #020617; height: 50vh; overflow-y: auto; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 14px; margin-bottom: 20px; border: 1px solid #334155; }
          .chat-box { display: flex; gap: 10px; }
          input { flex: 1; padding: 15px; background: #1e293b; border: 1px solid #334155; color: white; border-radius: 8px; outline: none; }
          button { padding: 15px 25px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; }
          button:hover { background: #2563eb; }
          .btn-secondary { background: #475569; }
          .btn-secondary:hover { background: #334155; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header-grid">
            <div class="card" style="border-left: 4px solid #3b82f6;">
              <h3>🤖 Bot Status</h3>
              <div id="status" class="status">${botStatus}</div>
            </div>
            <div class="card" style="border-left: 4px solid #34d399;">
              <h3>💎 Shard Wealth</h3>
              <div id="balance" class="balance">${currentBalance}</div>
            </div>
          </div>
          
          <div id="logs">${webLogs.join('<br>')}</div>
          
          <div class="chat-box">
            <input type="text" id="msg" placeholder="Type a command or chat message..." onkeypress="if(event.key === 'Enter') send()">
            <button onclick="send()">Send</button>
            <button class="btn-secondary" onclick="fetch('/force-balance')">Update Shards</button>
          </div>
        </div>
        <script>
          function send() {
            const i = document.getElementById('msg');
            if(!i.value) return;
            fetch('/chat?msg=' + encodeURIComponent(i.value));
            i.value = '';
          }
          setInterval(() => {
            fetch('/data').then(r => r.json()).then(d => {
              document.getElementById('status').innerText = d.status;
              document.getElementById('balance').innerText = d.balance;
              document.getElementById('logs').innerHTML = d.logs.join('<br>');
            });
          }, 2000);
        </script>
      </body>
    </html>
  `);
});

app.get('/data', (req, res) => res.json({ status: botStatus, balance: currentBalance, logs: webLogs }));
app.get('/chat', (req, res) => { if (bot && bot.entity) bot.chat(req.query.msg); res.sendStatus(200); });
app.get('/force-balance', (req, res) => { checkBalance(); res.sendStatus(200); });

app.listen(PORT, () => console.log(`Dashboard active on port ${PORT}`));

