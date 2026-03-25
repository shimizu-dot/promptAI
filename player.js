const GOAL = 30;
let playerCount = 1;
let positions = [0];
let currentPlayer = 0;
let turn = 0;
let finished = false;
let lastDice = [0];
let isRolling = false;
let cellEvents = {};
let finishOrder = [];

const EVENT_CONFIG = [
  { key: "backToStart", label: "振出し", short: "振", className: "event-start" },
  { key: "forward3", label: "3マス進む", short: "+3", className: "event-plus" },
  { key: "backward4", label: "4マス戻る", short: "-4", className: "event-minus" },
  { key: "reroll", label: "サイコロ", short: "再", className: "event-reroll" }
];

const board = document.getElementById("board");
const playerCountEl = document.getElementById("playerCount");
const applyPlayersBtn = document.getElementById("applyPlayersBtn");
const rollBtn = document.getElementById("rollBtn");
const restartBtn = document.getElementById("restartBtn");
const currentPlayerEl = document.getElementById("currentPlayer");
const positionEl = document.getElementById("position");
const diceEl = document.getElementById("dice");
const diceImageEl = document.getElementById("diceImage");
const messageEl = document.getElementById("message");
const logs = document.getElementById("logs");
const resultEl = document.getElementById("result");

function setRollingLock(locked) {
  rollBtn.disabled = locked;
  restartBtn.disabled = locked;
  applyPlayersBtn.disabled = locked;
  playerCountEl.disabled = locked;
}

function syncDiceTravelDistance() {
  const container = diceImageEl.parentElement;
  if (!container) return;
  const travel = Math.max(0, container.clientWidth - diceImageEl.clientWidth);
  diceImageEl.style.setProperty("--dice-travel", `${travel}px`);
}

function playDiceRollAnimation() {
  syncDiceTravelDistance();
  diceImageEl.classList.remove("rolling");
  void diceImageEl.offsetWidth;
  diceImageEl.classList.add("rolling");
}

function waitForDiceRollAnimation(durationMs = 1800) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    diceImageEl.addEventListener("animationend", finish, { once: true });
    setTimeout(finish, durationMs + 120);
  });
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function movePlayerStepByStep(playerIndex, steps) {
  let moved = 0;
  const playerLabel = `P${playerIndex + 1}`;

  for (let i = 0; i < steps; i++) {
    if (positions[playerIndex] >= GOAL) {
      break;
    }
    await wait(320);
    positions[playerIndex] += 1;
    moved += 1;
    renderPlayers();
    setMessage(
      `${playerLabel} が ${moved}/${steps} マス進行中...（現在 ${positions[playerIndex]} マス目）`
    );
  }

  return moved;
}

async function movePlayerBackStepByStep(playerIndex, steps) {
  let moved = 0;
  const playerLabel = `P${playerIndex + 1}`;

  for (let i = 0; i < steps; i++) {
    if (positions[playerIndex] <= 0) {
      break;
    }
    await wait(320);
    positions[playerIndex] -= 1;
    moved += 1;
    renderPlayers();
    setMessage(
      `${playerLabel} が ${moved}/${steps} マス戻り中...（現在 ${positions[playerIndex]} マス目）`
    );
  }

  return moved;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function generateRandomEvents() {
  const candidates = Array.from({ length: GOAL - 1 }, (_, i) => i + 1);
  shuffle(candidates);

  const events = {};
  EVENT_CONFIG.forEach((event, index) => {
    events[candidates[index]] = event.key;
  });
  cellEvents = events;
}

async function applyCellEvent(playerIndex) {
  const step = positions[playerIndex];
  const eventKey = cellEvents[step];
  if (!eventKey) return { extraTurn: false, triggered: false };

  const playerLabel = `P${playerIndex + 1}`;

  if (eventKey === "backToStart") {
    const backSteps = positions[playerIndex];
    if (backSteps > 0) {
      await movePlayerBackStepByStep(playerIndex, backSteps);
    }
    addLog(`${turn}ターン目: ${playerLabel} がイベント[振出し]でスタートに戻った`);
    setMessage(`${playerLabel} はイベント[振出し]でスタートに戻る！`);
    return { extraTurn: false, triggered: true };
  }

  if (eventKey === "forward3") {
    const moved = await movePlayerStepByStep(playerIndex, 3);
    addLog(`${turn}ターン目: ${playerLabel} がイベント[3マス進む]で ${moved} マス進んだ`);
    setMessage(`${playerLabel} はイベント[3マス進む]！`);
    return { extraTurn: false, triggered: true };
  }

  if (eventKey === "backward4") {
    const moved = await movePlayerBackStepByStep(playerIndex, 4);
    addLog(`${turn}ターン目: ${playerLabel} がイベント[4マス戻る]で ${moved} マス戻った`);
    setMessage(`${playerLabel} はイベント[4マス戻る]！`);
    return { extraTurn: false, triggered: true };
  }

  if (eventKey === "reroll") {
    addLog(`${turn}ターン目: ${playerLabel} がイベント[サイコロ]でもう1回振る`);
    setMessage(`${playerLabel} はイベント[サイコロ]！ もう1回振れます。`);
    return { extraTurn: true, triggered: true };
  }

  return { extraTurn: false, triggered: false };
}

function createBoard() {
  board.innerHTML = "";
  for (let i = 0; i <= GOAL; i++) {
    const cell = document.createElement("div");
    cell.className = "cell";
    if (i === 0) cell.classList.add("start");
    if (i === GOAL) cell.classList.add("goal");
    cell.dataset.step = String(i);

    const label = document.createElement("span");
    if (i === 0) {
      label.textContent = "START";
    } else if (i === GOAL) {
      label.textContent = "GOAL";
    } else {
      label.textContent = `${i}`;
    }
    cell.appendChild(label);

    const eventKey = cellEvents[i];
    if (eventKey) {
      const eventMeta = EVENT_CONFIG.find((event) => event.key === eventKey);
      if (eventMeta) {
        cell.classList.add("event-cell", eventMeta.className);
        const eventLabel = document.createElement("small");
        eventLabel.className = "event-label";
        eventLabel.textContent = eventMeta.short;
        eventLabel.title = eventMeta.label;
        cell.appendChild(eventLabel);
      }
    }

    board.appendChild(cell);
  }
}

function renderPlayers() {
  const oldGroups = board.querySelectorAll(".players");
  oldGroups.forEach((group) => group.remove());

  for (let i = 0; i < playerCount; i++) {
    const target = board.querySelector(`[data-step="${positions[i]}"]`);
    if (!target) continue;

    let group = target.querySelector(".players");
    if (!group) {
      group = document.createElement("div");
      group.className = "players";
      target.appendChild(group);
    }
    const player = document.createElement("div");
    player.className = `player player-${i + 1}`;
    player.textContent = `P${i + 1}`;
    group.appendChild(player);
  }

  positionEl.textContent = positions.map((pos, index) => `P${index + 1}: ${pos}`).join(" / ");
  updateTurnDisplay();
}

function diceSvg(face) {
  const points = {
    1: [[50, 50]],
    2: [[30, 30], [70, 70]],
    3: [[30, 30], [50, 50], [70, 70]],
    4: [[30, 30], [70, 30], [30, 70], [70, 70]],
    5: [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]],
    6: [[30, 28], [70, 28], [30, 50], [70, 50], [30, 72], [70, 72]]
  };

  const dots = points[face]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="8" fill="#15314f"/>`)
    .join("");

  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <rect x="6" y="6" width="88" height="88" rx="16" fill="#ffffff" stroke="#b8d2eb" stroke-width="4"/>
      ${dots}
    </svg>`
  )}`;
}

function setDiceDisplay(dice, playerIndex = currentPlayer, animate = true) {
  if (!dice) {
    diceEl.textContent = Array.from({ length: playerCount }, (_, index) => `P${index + 1}: -`).join(" / ");
    diceImageEl.removeAttribute("src");
    diceImageEl.alt = "サイコロ画像";
    diceImageEl.classList.remove("rolling");
    return;
  }
  lastDice[playerIndex] = dice;
  diceEl.textContent = lastDice.map((value, index) => `P${index + 1}: ${value || "-"}`).join(" / ");
  diceImageEl.src = diceSvg(dice);
  diceImageEl.alt = `P${playerIndex + 1}のサイコロ${dice}`;
  if (animate) {
    playDiceRollAnimation();
  }
}

function addLog(text) {
  const p = document.createElement("p");
  p.textContent = text;
  logs.prepend(p);
}

function setMessage(text) {
  messageEl.textContent = text;
}

function isPlayerFinished(playerIndex) {
  return finishOrder.includes(playerIndex);
}

function formatRanking() {
  return finishOrder.map((playerIndex, rank) => `${rank + 1}位:P${playerIndex + 1}`).join(" / ");
}

function medalByRank(rank) {
  if (rank === 0) return "🥇";
  if (rank === 1) return "🥈";
  if (rank === 2) return "🥉";
  return "🏅";
}

function formatRankingHtml() {
  return finishOrder
    .map((playerIndex, rank) => {
      const medal = medalByRank(rank);
      return `<span class="rank-chip rank-${rank + 1}">${rank + 1}位${medal} P${playerIndex + 1}</span>`;
    })
    .join("");
}

function updateResultDisplay(finalized = false) {
  if (!resultEl) return;
  if (finishOrder.length === 0) {
    resultEl.innerHTML = '<span class="rank-empty">順位: -</span>';
    return;
  }
  const title = finalized ? "最終順位" : "現在順位";
  resultEl.innerHTML = `<span class="rank-title">${title}</span><div class="rank-list">${formatRankingHtml()}</div>`;
}

function registerGoal(playerIndex) {
  if (isPlayerFinished(playerIndex)) return;
  finishOrder.push(playerIndex);
  addLog(`${turn}ターン目: P${playerIndex + 1} が ${finishOrder.length}位でゴール！`);
  updateResultDisplay(finishOrder.length === playerCount);
}

function getNextActivePlayer(fromIndex) {
  for (let offset = 1; offset <= playerCount; offset++) {
    const candidate = (fromIndex + offset) % playerCount;
    if (!isPlayerFinished(candidate)) {
      return candidate;
    }
  }
  return -1;
}

function finalizeGame() {
  finished = true;
  setRollingLock(false);
  rollBtn.disabled = true;
  currentPlayerEl.textContent = "-";
  updateResultDisplay(true);
  setMessage(`全員ゴール！ ${formatRanking()} で順位が確定しました。`);
  updateTurnDisplay();
}

function updateTurnDisplay() {
  if (finished) {
    rollBtn.textContent = "順位確定";
    return;
  }
  if (isPlayerFinished(currentPlayer)) {
    const nextPlayer = getNextActivePlayer(currentPlayer);
    if (nextPlayer !== -1) {
      currentPlayer = nextPlayer;
    }
  }
  currentPlayerEl.textContent = `P${currentPlayer + 1}`;
  rollBtn.textContent = `P${currentPlayer + 1}がサイコロを振る`;
}

async function rollDice() {
  if (finished || isRolling) return;
  if (isPlayerFinished(currentPlayer)) {
    const nextPlayer = getNextActivePlayer(currentPlayer);
    if (nextPlayer === -1) {
      finalizeGame();
      return;
    }
    currentPlayer = nextPlayer;
  }
  isRolling = true;
  setRollingLock(true);
  rollBtn.textContent = "サイコロ転がり中...";

  const rollingPlayer = currentPlayer;
  const previewTimer = setInterval(() => {
    const previewDice = Math.floor(Math.random() * 6) + 1;
    diceImageEl.src = diceSvg(previewDice);
    diceImageEl.alt = `P${rollingPlayer + 1}のサイコロ`;
  }, 100);

  playDiceRollAnimation();
  await waitForDiceRollAnimation();
  clearInterval(previewTimer);

  const dice = Math.floor(Math.random() * 6) + 1;
  setDiceDisplay(dice, rollingPlayer, false);
  setMessage(`P${rollingPlayer + 1}の出目は${dice}。コマを進めます...`);
  await wait(400);
  turn += 1;

  const playerLabel = `P${rollingPlayer + 1}`;
  const moved = await movePlayerStepByStep(rollingPlayer, dice);
  const next = positions[rollingPlayer];

  if (next >= GOAL) {
    registerGoal(rollingPlayer);
    renderPlayers();
    if (finishOrder.length >= playerCount) {
      finalizeGame();
      isRolling = false;
      return;
    }
    const nextPlayer = getNextActivePlayer(rollingPlayer);
    currentPlayer = nextPlayer === -1 ? rollingPlayer : nextPlayer;
    setMessage(
      `${playerLabel}が${finishOrder.length}位でゴール！ 次はP${currentPlayer + 1}の番です。`
    );
    setRollingLock(false);
    isRolling = false;
    return;
  }

  addLog(`${turn}ターン目: ${playerLabel} が ${dice} を出して ${moved} マス進み ${next} マス目へ移動`);
  const eventResult = await applyCellEvent(rollingPlayer);

  if (positions[rollingPlayer] >= GOAL) {
    registerGoal(rollingPlayer);
    renderPlayers();
    if (finishOrder.length >= playerCount) {
      finalizeGame();
      isRolling = false;
      return;
    }
    const nextPlayer = getNextActivePlayer(rollingPlayer);
    currentPlayer = nextPlayer === -1 ? rollingPlayer : nextPlayer;
    setMessage(
      `${playerLabel}が${finishOrder.length}位でゴール！ 次はP${currentPlayer + 1}の番です。`
    );
    setRollingLock(false);
    isRolling = false;
    return;
  }

  if (eventResult.extraTurn && !isPlayerFinished(rollingPlayer)) {
    currentPlayer = rollingPlayer;
    renderPlayers();
    setRollingLock(false);
    isRolling = false;
    return;
  }

  const nextPlayer = getNextActivePlayer(rollingPlayer);
  if (nextPlayer === -1) {
    finalizeGame();
    isRolling = false;
    return;
  }
  currentPlayer = nextPlayer;
  renderPlayers();
  setMessage(
    `${turn}ターン目: ${playerLabel} は ${positions[rollingPlayer]} マス目。次はP${currentPlayer + 1}の番です。`
  );
  setRollingLock(false);
  isRolling = false;
}

function restart(showLog = true) {
  generateRandomEvents();
  createBoard();
  positions = Array(playerCount).fill(0);
  lastDice = Array(playerCount).fill(0);
  finishOrder = [];
  currentPlayer = 0;
  turn = 0;
  finished = false;
  setDiceDisplay(0);
  logs.innerHTML = "";
  setMessage("サイコロを振ってスタート！");
  updateResultDisplay(false);
  setRollingLock(false);
  renderPlayers();
  if (showLog) {
    addLog(`${playerCount}人でゲームをリスタートしました`);
  }
  const eventSummary = Object.entries(cellEvents)
    .map(([step, key]) => {
      const eventMeta = EVENT_CONFIG.find((event) => event.key === key);
      return `${step}:${eventMeta ? eventMeta.label : key}`;
    })
    .join(" / ");
  addLog(`イベント配置: ${eventSummary}`);
}

function applyPlayerCount() {
  playerCount = Math.min(4, Math.max(1, Number(playerCountEl.value) || 1));
  restart(false);
  addLog(`プレイヤー人数を${playerCount}人に変更しました`);
}

rollBtn.addEventListener("click", rollDice);
restartBtn.addEventListener("click", restart);
applyPlayersBtn.addEventListener("click", applyPlayerCount);
diceImageEl.addEventListener("animationend", () => {
  diceImageEl.classList.remove("rolling");
});

restart(false);
syncDiceTravelDistance();
window.addEventListener("resize", syncDiceTravelDistance);
