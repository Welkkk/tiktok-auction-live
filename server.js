const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { WebcastPushConnection } = require("tiktok-live-connector");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const ADMIN_KEY = "ADMIN-9X7Q-VICTOR";
const KEYS_FILE = path.join(__dirname, "keys.json");

let accessKeys = [];
let players = {};
let winners = [];

let live = {
  connected: false,
  username: ""
};

let timer = {
  status: "ready",
  time: 60,
  initialTime: 60,
  delay: 30,
  snipeTime: 30,
  minimum: 0
};

let interval = null;
let tiktokConnection = null;

/* ========================= */
/* KEYS */
/* ========================= */

function loadKeys() {
  if (fs.existsSync(KEYS_FILE)) {
    accessKeys = JSON.parse(fs.readFileSync(KEYS_FILE, "utf8"));
  } else {
    accessKeys = [
      "A8V3L0Z6RT",
      "QW71MX9KPL",
      "N5T8Y2B4CX",
      "R4U9J1D7FA",
      "K2Z8Q5W1LM",
      "P7X4C9V2NB",
      "H1M8R3T6QP",
      "Y5L0D2K9ZW",
      "C7N4F8A1XQ",
      "T9B3M6P2LK",
      "V2Q8Z1R5WD",
      "F6X0N4T9KP",
      "J3L7C2M8RA",
      "W1P9K5X4TZ",
      "B8R2V6N0QM",
      "D4T7Y1K9LX",
      "M5Q0P8C3WA",
      "Z2X6R4N1TB",
      "L9K3F7V5QP",
      "P4W1M8Z2RX"
    ].map(k => ({
      key: k,
      role: "classic",
      expiresAt: null
    }));

    saveKeys();
  }
}

function saveKeys() {
  fs.writeFileSync(
    KEYS_FILE,
    JSON.stringify(accessKeys, null, 2)
  );
}

function generateKey() {
  return (
    Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase() +
    "-" +
    Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()
  );
}

function isExpired(keyObj) {
  return keyObj.expiresAt &&
    Date.now() > keyObj.expiresAt;
}

loadKeys();

/* ========================= */
/* UTILS */
/* ========================= */

function emitAll() {
  io.emit("state", {
    players,
    winners,
    live,
    timer
  });
}

function getTopPlayer() {
  return Object.values(players)
    .sort((a, b) => b.coins - a.coins)[0];
}

/* ========================= */
/* FINISH */
/* ========================= */

function finishAuction() {

  const sorted =
    Object.values(players)
    .sort((a, b) => b.coins - a.coins);

  const top = sorted[0];

  if (top) {

    for (const player of Object.values(players)) {

      if (player.forceTie) {

        player.coins = top.coins;
        player.forceTie = false;

      }

    }

  }

  timer.status = "finished";

  clearInterval(interval);

  const finalTop = getTopPlayer();

  if (finalTop) {

    winners.unshift({
      name: finalTop.name,
      coins: finalTop.coins,
      avatar: finalTop.avatar
    });

  }

  emitAll();

}

/* ========================= */
/* TIMER */
/* ========================= */

function startCountdown() {

  clearInterval(interval);

  interval = setInterval(() => {

    if (timer.status === "running") {

      timer.time--;

      if (timer.time <= 0) {

        timer.status = "snipe";
        timer.snipeTime = timer.delay;

      }

    }

    else if (timer.status === "snipe") {

      timer.snipeTime--;

      if (timer.snipeTime <= 0) {

        finishAuction();
        return;

      }

    }

    emitAll();

  }, 1000);

}

/* ========================= */
/* TIKTOK */
/* ========================= */

async function connectTikTok(username) {

  if (tiktokConnection) {

    try {
      tiktokConnection.disconnect();
    }
    catch {}

    tiktokConnection = null;

  }

  const cleanUsername =
    username.replace("@", "").trim();

  if (!cleanUsername) return;

  tiktokConnection =
    new WebcastPushConnection(cleanUsername);

  try {

    await tiktokConnection.connect();

    live.connected = true;
    live.username = cleanUsername;

    emitAll();

    tiktokConnection.on("gift", (data) => {

      const name =
        data.uniqueId ||
        data.nickname ||
        "unknown";

      const coins =
        Number(data.diamondCount || 1);

      if (!players[name]) {

        players[name] = {
          name,
          coins: 0,
          avatar:
            data.profilePictureUrl ||
            `https://unavatar.io/tiktok/${encodeURIComponent(name)}`,
          forceTie: false
        };

      }

      players[name].coins += coins;

      if (data.profilePictureUrl) {

        players[name].avatar =
          data.profilePictureUrl;

      }

      emitAll();

    });

    tiktokConnection.on("disconnected", () => {

      live.connected = false;

      emitAll();

    });

  }

  catch (err) {

    live.connected = false;
    live.username = "";

    emitAll();

    console.log(
      "TikTok connection error:",
      err.message
    );

  }

}

/* ========================= */
/* SOCKET */
/* ========================= */

io.on("connection", (socket) => {

  socket.emit("state", {
    players,
    winners,
    live,
    timer
  });

  /* ===== KEYS ===== */

  socket.on("validateKey", (key) => {

    if (key === ADMIN_KEY) {

      socket.isAuthed = true;
      socket.role = "admin";

      socket.emit("keyResult", {
        success: true,
        role: "admin",
        keys: accessKeys
      });

      return;

    }

    const found =
      accessKeys.find(k => k.key === key);

    if (!found || isExpired(found)) {

      socket.emit("keyResult", {
        success: false
      });

      return;

    }

    socket.isAuthed = true;
    socket.role = "classic";

    socket.emit("keyResult", {
      success: true,
      role: "classic"
    });

  });

  socket.on("createKey", ({ days }) => {

    if (socket.role !== "admin") return;

    const newKey = {
      key: generateKey(),
      role: "classic",
      expiresAt:
        days > 0
          ? Date.now() +
            days *
            24 *
            60 *
            60 *
            1000
          : null
    };

    accessKeys.push(newKey);

    saveKeys();

    io.emit("keysUpdate", accessKeys);

  });

  socket.on("deleteKey", (key) => {

    if (socket.role !== "admin") return;

    accessKeys =
      accessKeys.filter(k => k.key !== key);

    saveKeys();

    io.emit("keysUpdate", accessKeys);

  });

  /* ===== LIVE ===== */

  socket.on("connectLive", (username) => {
    connectTikTok(username);
  });

  socket.on("disconnectLive", () => {

    if (tiktokConnection) {

      try {
        tiktokConnection.disconnect();
      }
      catch {}

      tiktokConnection = null;

    }

    live.connected = false;
    live.username = "";

    emitAll();

  });

  /* ===== SETTINGS ===== */

  socket.on(
    "setSettings",
    ({
      initialTime,
      delay,
      minimum
    }) => {

      timer.initialTime =
        Number(initialTime) || 60;

      timer.time = timer.initialTime;

      timer.delay =
        Number(delay) || 30;

      timer.snipeTime = timer.delay;

      timer.minimum =
        Number(minimum) || 0;

      timer.status = "ready";

      clearInterval(interval);

      emitAll();

    }
  );

  /* ===== TIMER ===== */

  socket.on("startTimer", () => {

    if (
      timer.status === "running" ||
      timer.status === "snipe"
    ) return;

    timer.status = "running";

    clearInterval(interval);

    startCountdown();

    emitAll();

  });

  socket.on("pauseTimer", () => {

    if (timer.status === "paused") {

      timer.status = "running";

      startCountdown();

    }

    else if (
      timer.status === "running" ||
      timer.status === "snipe"
    ) {

      timer.status = "paused";

      clearInterval(interval);

    }

    emitAll();

  });

  socket.on("finishTimer", () => {
    finishAuction();
  });

  socket.on("restartRound", () => {

    players = {};

    timer.status = "ready";

    timer.time = timer.initialTime;
    timer.snipeTime = timer.delay;

    clearInterval(interval);

    emitAll();

  });

  /* ===== MODIFY ===== */

  socket.on("modifyTime", ({ amount }) => {

    const n = Number(amount) || 0;

    if (timer.status === "snipe") {

      timer.snipeTime =
        Math.max(0, timer.snipeTime + n);

    }

    else {

      timer.time =
        Math.max(0, timer.time + n);

    }

    emitAll();

  });

  /* ===== ADD COINS ===== */

  socket.on(
    "addCoins",
    ({
      name,
      coins,
      avatar
    }) => {

      if (!name) return;

      const cleanName =
        String(name)
          .replace("@", "")
          .trim();

      const amount =
        Number(coins);

      if (
        !cleanName ||
        !amount ||
        amount <= 0
      ) return;

      if (!players[cleanName]) {

        players[cleanName] = {
          name: cleanName,
          coins: 0,
          avatar:
            avatar ||
            `https://unavatar.io/tiktok/${encodeURIComponent(cleanName)}`,
          forceTie: false
        };

      }

      players[cleanName].coins += amount;

      if (avatar) {

        players[cleanName].avatar =
          avatar;

      }

      emitAll();

    }
  );

  /* ===== FORCE TIE ===== */

  socket.on("forceTie", ({ name }) => {

    if (!name) return;

    const cleanName =
      String(name)
        .replace("@", "")
        .trim();

    if (!players[cleanName]) return;

    players[cleanName].forceTie = true;

    emitAll();

  });

  /* ===== BOOST ===== */

  socket.on("autoBoost", ({ name }) => {

    if (!name) return;

    const cleanName =
      String(name)
        .replace("@", "")
        .trim();

    if (!players[cleanName]) return;

    const topPlayer =
      getTopPlayer();

    if (!topPlayer) return;

    const randomExtra =
      Math.floor(Math.random() * 100) + 1;

    players[cleanName].coins =
      topPlayer.coins + randomExtra;

    emitAll();

  });

});

/* ========================= */
/* START */
/* ========================= */

const PORT =
  process.env.PORT || 3000;

server.listen(PORT, () => {

  console.log(
    "Server running on port " + PORT
  );

});