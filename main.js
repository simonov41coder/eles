const mineflayer = require('mineflayer');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

// --- MULTI-ACCOUNT CONFIG ---
// Add as many accounts as you want here
const ACCOUNTS = [
  { username: 'Theo_not_bald', password: 'atk.exe', enabled: true },
  { username: 'uraaa_1945', password: 'ussr45', enabled: true}
  // { username: 'Second_Account', password: 'password123', enabled: true }
];

const SETTINGS = {
  host: 'play.kampungeles.id',
  port: 25565,
  version: '1.20.1',
  lobbyItem: 'nether_star',
  realmItem: 'lime_dye',
  confirmItem: 'lime_stained_glass_pane',
  tpaTarget: 'simonov41'
};

const bots = {}; // Stores active mineflayer instances
const botData = {}; // Stores status, balance, and logs for each bot

// --- INITIALIZE DATA ---
ACCOUNTS.forEach(acc => {
  botData[acc.username] = {
    status: "Initializing",
    balance: "0 Shards",
    logs: [],
    enabled: acc.enabled
  };
});

function addLog(user, type, message) {
  const time = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Jakarta' });
  const cleanMsg = message.replace(/§[0-9a-fk-or]/g, '').trim();
  let color = "#f8fafc"; 
  if (type === 'SYSTEM') color = "#fbbf24";
  if (type === 'CHAT') color = "#4ade80";
  if (type === 'ECONOMY') color = "#2dd4bf";
  if (type === 'ERROR') color = "#f87171";

  const entry = `<span style="color: ${color}">[${time}] [${type}] ${cleanMsg}</span>`;
  botData[user].logs.unshift(entry);
  if (botData[user].logs.length > 100) botData[user].logs.pop();
  console.log(`[${user}] [${type}] ${cleanMsg}`);
}

// --- BOT LOGIC FUNCTION ---
function startBot(account) {
  const user = account.username;
  if (!botData[user].enabled) return;

  addLog(user, 'SYSTEM', 'Starting bot...');
  const bot = mineflayer.createBot({
    host: SETTINGS.host,
    port: SETTINGS.port,
    username: user,
    version: SETTINGS.version,
    auth: 'offline'
  });

  bots[user] = bot;

  bot.on('message', (json) => {
    const msg = json.toString();
    const cleanMsg = msg.replace(/§[0-9a-fk-or]/g, '');
    if (cleanMsg.includes('❤') || cleanMsg.includes('⌚') || cleanMsg.includes('|')) return;

    const isChat = cleanMsg.includes(':') || cleanMsg.includes('»') || cleanMsg.includes('->');
    if (isChat || cleanMsg.toLowerCase().includes('welcome')) {
        addLog(user, 'CHAT', cleanMsg);
    }
  });

  bot.once('spawn', () => {
    botData[user].status = "Logging in...";
    setTimeout(() => {
      if (bots[user]) bots[user].chat(`/login ${account.password}`);
    }, 5000);
    
    // Scoreboard Tracker
    setInterval(() => {
      if (!bots[user] || !bots[user].scoreboards) return;
      const sb = bots[user].scoreboards['sidebar'] || Object.values(bots[user].scoreboards)[0];
      if (!sb) return;
      const lines = Object.values(sb.itemsMap).sort((a, b) => b.score - a.score);
      if (lines[3]) {
        botData[user].balance = lines[3].displayName.toString().replace(/§[0-9a-fk-or]/g, '').trim();
      }
    }, 3000);
  });

  bot.on('end', (reason) => {
    if (botData[user].enabled) {
      botData[user].status = "Offline (Retrying)";
      setTimeout(() => startBot(account), 15000);
    } else {
      botData[user].status = "PAUSED";
    }
  });

  bot.on('windowOpen', async (window) => {
    const confirm = window.slots.find(i => i && i.name === SETTINGS.confirmItem);
    if (confirm) {
      await new Promise(r => setTimeout(r, 1200));
      if (bots[user]) bots[user].clickWindow(confirm.slot, 0, 0);
      addLog(user, 'SYSTEM', 'Auto-confirmed GUI.');
    }
  });

  // Lobby Watchdog
  setInterval(() => {
    if (!bots[user] || !bots[user].entity || !botData[user].enabled) return;
    const star = bots[user].inventory.slots.slice(36, 45).find(i => i && i.name.includes(SETTINGS.lobbyItem));
    if (star) {
      botData[user].status = "In Lobby";
      const slot = bots[user].inventory.slots.indexOf(star) - 36;
      bots[user].setQuickBarSlot(slot);
      bots[user].activateItem();
      bots[user].once('windowOpen', async (win) => {
        await new Promise(r => setTimeout(r, 2000));
        const realm = win.slots.find(i => i && i.name.includes(SETTINGS.realmItem));
        if (realm) {
          await bots[user].clickWindow(realm.slot, 0, 0);
          setTimeout(() => { if(bots[user]) bots[user].chat('/afk'); }, 8000);
        }
      });
    } else {
      botData[user].status = "In-Game";
    }
  }, 10000);
}

// Start all enabled accounts
ACCOUNTS.forEach(acc => startBot(acc));

// --- DASHBOARD ---
app.get('/', (req, res) => {
  let botCards = "";
  ACCOUNTS.forEach(acc => {
    const user = acc.username;
    botCards += `
      <div class="card">
        <div class="label">${user}</div>
        <div class="val" id="st-${user}">${botData[user].status}</div>
        <div class="val" id="bl-${user}" style="color:#10b981">${botData[user].balance}</div>
        <div class="controls">
            <button class="btn-red" onclick="toggle('${user}')">Toggle Power</button>
            <button class="btn-purple" onclick="tpa('${user}')">TPA</button>
        </div>
        <div class="log-box" id="log-${user}">${botData[user].logs.join('<br>')}</div>
      </div>
    `;
  });

  res.send(`
    <html>
      <head>
        <title>Theo Multi-Bot</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { background: #020617; color: #f8fafc; font-family: sans-serif; padding: 10px; }
          .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px; }
          .card { background: #1e293b; padding: 15px; border-radius: 12px; border: 1px solid #334155; }
          .label { color: #94a3b8; font-size: 14px; font-weight: bold; border-bottom: 1px solid #334155; padding-bottom: 5px; margin-bottom: 10px; }
          .val { font-size: 1rem; font-weight: bold; }
          .log-box { background: #000; height: 200px; overflow-y: auto; font-family: monospace; font-size: 11px; margin-top: 10px; padding: 10px; border-radius: 8px; }
          .controls { display: flex; gap: 5px; margin-top: 10px; }
          button { flex: 1; padding: 8px; border-radius: 5px; border: none; color: white; font-weight: bold; cursor: pointer; font-size: 12px; }
          .btn-red { background: #ef4444; }
          .btn-purple { background: #8b5cf6; }
        </style>
      </head>
      <body>
        <div class="grid">${botCards}</div>
        <script>
          function toggle(u) { fetch('/toggle?user=' + u); }
          function tpa(u) { fetch('/tpa?user=' + u); }
          setInterval(() => {
            fetch('/data').then(r => r.json()).then(data => {
              for (const user in data) {
                document.getElementById('st-' + user).innerText = data[user].status;
                document.getElementById('bl-' + user).innerText = data[user].balance;
                document.getElementById('log-' + user).innerHTML = data[user].logs.join('<br>');
              }
            });
          }, 2000);
        </script>
      </body>
    </html>
  `);
});

app.get('/data', (req, res) => res.json(botData));
app.get('/toggle', (req, res) => {
  const user = req.query.user;
  botData[user].enabled = !botData[user].enabled;
  if (!botData[user].enabled) {
    if (bots[user]) bots[user].quit();
    delete bots[user];
    botData[user].status = "PAUSED";
  } else {
    const acc = ACCOUNTS.find(a => a.username === user);
    startBot(acc);
  }
  res.sendStatus(200);
});
app.get('/tpa', (req, res) => {
  const user = req.query.user;
  if (bots[user]) bots[user].chat('/tpa ' + SETTINGS.tpaTarget);
  res.sendStatus(200);
});

app.listen(PORT);

