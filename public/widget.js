const socket = io();

const timerText = document.getElementById("timerText");
const delayValue = document.getElementById("delayValue");
const minimumValue = document.getElementById("minimumValue");
const leaderboard = document.getElementById("leaderboard");
const emptyText = document.getElementById("emptyText");
const totalParticipants = document.getElementById("totalParticipants");

let currentPlayers = {};
let winnerShown = false;

socket.on("state", ({ players, timer }) => {

  currentPlayers = players;

  minimumValue.textContent =
    `${timer.minimum} 🪙`;

  delayValue.textContent =
    `${timer.delay}S`;

  timerText.classList.remove("snipe-mode");

  if (timer.status === "snipe") {

    timerText.textContent =
      `SNIPE DELAY ${timer.snipeTime}`;

    timerText.classList.add("snipe-mode");

    winnerShown = false;

  }

  else if (timer.status === "finished") {

    timerText.textContent = "FINISHED";

    if (!winnerShown) {

      winnerShown = true;

      showEndAnimation();

    }

  }

  else {

    timerText.textContent =
      formatTime(timer.time);

    winnerShown = false;

    const oldWinner =
      document.querySelector(".winner-overlay");

    if (oldWinner) oldWinner.remove();

  }

  renderLeaderboard(players);

});

/* ========================= */
/* LEADERBOARD */
/* ========================= */

function renderLeaderboard(players) {

  const sorted =
    Object.values(players)
    .sort((a, b) => b.coins - a.coins)
    .slice(0, 3);

  leaderboard.innerHTML = "";

  totalParticipants.textContent =
    Object.keys(players).length;

  emptyText.style.display =
    sorted.length ? "none" : "block";

  sorted.forEach((p, i) => {

    const div =
      document.createElement("div");

    div.className =
      `bid-card rank-${i + 1}`;

    div.innerHTML = `
      <div class="rank-badge">
        ${i + 1}
      </div>

      <img
        src="${p.avatar}"
        onerror="this.src='https://i.pravatar.cc/80?img=12'"
      >

      <div>

        <div class="bid-name">
          ${p.name}
        </div>

        <div class="bid-coins">
          ${p.coins} 🪙
        </div>

      </div>
    `;

    leaderboard.appendChild(div);

  });

}

/* ========================= */
/* END ANIMATION */
/* ========================= */

function showEndAnimation() {

  const sorted =
    Object.values(currentPlayers)
    .sort((a, b) => b.coins - a.coins);

  if (!sorted.length) return;

  const topScore = sorted[0].coins;

  const tiedPlayers =
    sorted.filter(p => p.coins === topScore);

  if (tiedPlayers.length > 1) {

    showTieAnimation(
      tiedPlayers,
      topScore
    );

  }

  else {

    showWinnerAnimation(sorted[0]);

  }

}

/* ========================= */
/* WINNER */
/* ========================= */

function showWinnerAnimation(winner) {

  const old =
    document.querySelector(".winner-overlay");

  if (old) old.remove();

  const overlay =
    document.createElement("div");

  overlay.className =
    "winner-overlay";

  overlay.innerHTML = `

    <div class="winner-card">

      <div class="winner-title">
        🏆 WINNER 🏆
      </div>

      <img
        class="winner-avatar"
        src="${winner.avatar}"
        onerror="this.src='https://i.pravatar.cc/120?img=12'"
      >

      <div class="winner-name">
        ${winner.name}
      </div>

      <div class="winner-coins">
        ${winner.coins} 🪙
      </div>

    </div>

  `;

  document
    .querySelector(".timer-card")
    .appendChild(overlay);

  launchConfetti(overlay);

}

/* ========================= */
/* TIE */
/* ========================= */

function showTieAnimation(players, score) {

  const old =
    document.querySelector(".winner-overlay");

  if (old) old.remove();

  const overlay =
    document.createElement("div");

  overlay.className =
    "winner-overlay";

  overlay.innerHTML = `

    <div class="winner-card">

      <div class="winner-title">
        ⚔️ TIE ⚔️
      </div>

      <div class="tie-score">
        ${score} 🪙
      </div>

      <div class="tie-players">

        ${players.map(p => `

          <div class="tie-player">

            <img
              src="${p.avatar}"
              onerror="this.src='https://i.pravatar.cc/120?img=12'"
            >

            <div class="tie-name">
              ${p.name}
            </div>

          </div>

        `).join("")}

      </div>

    </div>

  `;

  document
    .querySelector(".timer-card")
    .appendChild(overlay);

  launchConfetti(overlay);

}

/* ========================= */
/* CONFETTI */
/* ========================= */

function launchConfetti(parent) {

  const colors = [
    "#ffd000",
    "#ff3d45",
    "#00ffcc",
    "#ffffff",
    "#ff8a00"
  ];

  for (let i = 0; i < 120; i++) {

    const confetti =
      document.createElement("div");

    confetti.className =
      "confetti";

    confetti.style.left =
      Math.random() * 100 + "%";

    confetti.style.background =
      colors[
        Math.floor(
          Math.random() * colors.length
        )
      ];

    confetti.style.animationDuration =
      Math.random() * 2 + 2 + "s";

    confetti.style.animationDelay =
      Math.random() * 0.8 + "s";

    confetti.style.width =
      Math.random() * 6 + 5 + "px";

    confetti.style.height =
      Math.random() * 12 + 8 + "px";

    parent.appendChild(confetti);

    setTimeout(() => {

      confetti.remove();

    }, 5000);

  }

}

/* ========================= */
/* FORMAT TIMER */
/* ========================= */

function formatTime(seconds) {

  const min =
    Math.floor(seconds / 60);

  const sec =
    seconds % 60;

  return `
    ${min}:${String(sec).padStart(2, "0")}
  `.trim();

}