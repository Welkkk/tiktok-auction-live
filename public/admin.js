const socket = io();

let currentRole = null;

function checkKey() {
  const key = document.getElementById("accessKey").value.trim();
  socket.emit("validateKey", key);
}

socket.on("keyResult", (res) => {
  if (!res.success) {
    document.getElementById("loginError").textContent = "INVALID KEY";
    return;
  }

  currentRole = res.role;

  document.getElementById("loginPage").style.display = "none";
  document.getElementById("adminPanel").style.display = "block";

  if (res.role === "admin") {
    document.getElementById("keysTabBtn").style.display = "inline-block";
    if (res.keys) renderKeys(res.keys);
  }
});

function openKeysPanel() {
  if (currentRole !== "admin") return;
  document.getElementById("keysPanel").style.display = "block";
}

function closeKeysPanel() {
  document.getElementById("keysPanel").style.display = "none";
}

function createKey() {
  const days = Number(document.getElementById("keyDays").value);
  socket.emit("createKey", { days });
}

function deleteKey(key) {
  socket.emit("deleteKey", key);
}

socket.on("keysUpdate", (keys) => {
  renderKeys(keys);
});

function renderKeys(keys) {
  document.getElementById("keysList").innerHTML = keys.map(k => {
    const expireText = k.expiresAt
      ? new Date(k.expiresAt).toLocaleDateString()
      : "Illimitée";

    return `
      <div class="key-row">
        <span>${k.key}</span>
        <span>${expireText}</span>
        <button onclick="deleteKey('${k.key}')">🗑</button>
      </div>
    `;
  }).join("");
}

function connectLive() {
  const username = document.getElementById("usernameInput").value;
  if (!username) return;
  socket.emit("connectLive", username);
}

function disconnectLive() {
  socket.emit("disconnectLive");
}

function setSettings() {
  socket.emit("setSettings", {
    initialTime: Number(document.getElementById("initialTime").value),
    delay: Number(document.getElementById("delayTime").value),
    minimum: Number(document.getElementById("minimumEntry").value)
  });
}

function startTimer() {
  socket.emit("startTimer");
}

function pauseTimer() {
  socket.emit("pauseTimer");
}

function finishTimer() {
  socket.emit("finishTimer");
}

function restartRound() {
  socket.emit("restartRound");
}

function modifyTime(direction) {
  const amount = Number(document.getElementById("modifyAmount").value) || 0;
  socket.emit("modifyTime", { amount: amount * direction });
}

function previewTikTokAvatar() {
  const name = document.getElementById("playerName").value.trim().replace("@", "");
  const avatar = document.getElementById("previewAvatar");

  if (!name) {
    avatar.style.display = "none";
    return;
  }

  avatar.src = `https://unavatar.io/tiktok/${encodeURIComponent(name)}`;
  avatar.onerror = () => {
    avatar.src = "https://i.pravatar.cc/80?img=12";
  };

  avatar.style.display = "block";
}

function addCoins() {
  const name = document.getElementById("playerName").value.trim().replace("@", "");
  const coins = Number(document.getElementById("coinAmount").value);

  if (!name || !coins || coins <= 0) {
    alert("Mets un username et un nombre de pièces valide");
    return;
  }

  socket.emit("addCoins", {
    name,
    coins,
    avatar: `https://unavatar.io/tiktok/${encodeURIComponent(name)}`
  });

  document.getElementById("coinAmount").value = "";
}

function quickAdd(name) {
  const input = document.getElementById(`coins-${CSS.escape(name)}`);
  const value = Number(input.value);

  if (!value || value <= 0) {
    alert("Mets un nombre de pièces valide");
    return;
  }

  socket.emit("addCoins", {
    name,
    coins: value,
    avatar: `https://unavatar.io/tiktok/${encodeURIComponent(name)}`
  });

  input.value = "";
}

function forceTie(name) {
  socket.emit("forceTie", { name });
}

function autoBoost(name) {
  socket.emit("autoBoost", { name });
}

function openWidget() {
  window.open("http://localhost:3000/widget.html", "_blank");
}

function copyUrl() {
  navigator.clipboard.writeText(document.getElementById("widgetUrl").value);
  alert("URL copiée");
}

socket.on("state", ({ players, winners, live, timer }) => {
  document.getElementById("statusText").textContent =
    live.connected ? "CONNECTED" : "DISCONNECTED";

  document.getElementById("statusDot").className =
    live.connected ? "dot green-dot" : "dot red";

  const timerEl = document.getElementById("adminTimer");

  if (timer.status === "snipe") {
    timerEl.textContent = `SNIPE ${timer.snipeTime}s`;
    timerEl.style.color = "#ff3d45";
  } else if (timer.status === "finished") {
    timerEl.textContent = "FINISHED";
    timerEl.style.color = "#ffd000";
  } else {
    timerEl.textContent = formatTime(timer.time);
    timerEl.style.color = "#4ddcff";
  }

  const arr = Object.values(players).sort((a, b) => b.coins - a.coins);

  document.getElementById("participantList").innerHTML = arr.length
    ? arr.map(p => `
      <div class="admin-player-card">
        <div class="admin-player-info">
          <img src="${p.avatar}" onerror="this.src='https://i.pravatar.cc/80?img=12'">
          <div>
            <div class="admin-player-name">
              ${p.forceTie ? "🟰 " : ""}${p.autoBoost ? "⚡ " : ""}${p.name}
            </div>
            <div class="admin-player-coins">${p.coins} 🪙</div>
          </div>
        </div>

        <div class="admin-add-box">
          <input id="coins-${p.name}" type="number" placeholder="Pièces">
          <button onclick="quickAdd('${p.name}')">+</button>
          <button class="tie-btn" onclick="forceTie('${p.name}')">=</button>
          <button class="boost-btn" onclick="autoBoost('${p.name}')">⚡</button>
        </div>
      </div>
    `).join("")
    : "No participants yet.";

  document.getElementById("winnerList").innerHTML = winners.length
    ? winners.map(w => `
      <div class="admin-player-card">
        <div class="admin-player-info">
          <img src="${w.avatar}" onerror="this.src='https://i.pravatar.cc/80?img=12'">
          <div>
            <div class="admin-player-name">${w.name}</div>
            <div class="admin-player-coins">${w.coins} 🪙</div>
          </div>
        </div>
      </div>
    `).join("")
    : "No winners yet.";

  document.getElementById("adminParticipants").textContent = arr.length;
  document.getElementById("adminCoins").textContent =
    arr.reduce((s, p) => s + p.coins, 0);
  document.getElementById("totalWinners").textContent = winners.length;
});

function formatTime(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}