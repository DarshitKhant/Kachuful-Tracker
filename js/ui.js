import { escapeHtml, formatDateTime, safeId } from "./utils.js";

export function $(id) {
    return document.getElementById(id);
}

export function showSection(id) {
    document
        .querySelectorAll(".section")
        .forEach((section) => section.classList.remove("active"));
    $(id).classList.add("active");
}

export function showSettings(show) {
    const modal = $("settingsModal");
    modal.classList.toggle("show", show);
    modal.setAttribute("aria-hidden", String(!show));
    if (show) setTimeout(() => $("selectBackupBtn")?.focus(), 0);
}

export function setStatus(elementId, message, type = "") {
    const element = $(elementId);
    if (!element) return;
    element.textContent = message;
    element.className = `status${type ? ` ${type}` : ""}`;
}

export function toast(message, type = "ok") {
    const region = $("toastRegion");
    const item = document.createElement("div");
    item.className = `toast ${type}`;
    item.textContent = message;
    region.appendChild(item);
    setTimeout(() => item.remove(), 3200);
}

export function renderSetup(gameState, backupConnected) {
    $("gameMeta").textContent = gameState.gameId
        ? `${gameState.gameId} · ${formatDateTime(gameState.createdAt)}`
        : "No active game";
    $("playerCountBadge").textContent =
        `${gameState.players.length} player${gameState.players.length === 1 ? "" : "s"}`;
    const list = $("playerList");
    list.innerHTML = "";
    gameState.players.forEach((player) => {
        const item = document.createElement("li");
        item.className = "player-item";
        item.innerHTML = `<span class="player-item-name">${escapeHtml(player)}</span><button class="remove-player" type="button" data-remove-player="${escapeHtml(player)}">Remove</button>`;
        list.appendChild(item);
    });
    $("startBtn").hidden = gameState.players.length < 2;
    $("setupStatus").textContent = gameState.players.length
        ? gameState.players.length < 2
            ? "Add one more player to start."
            : "Ready to start. Your game is saved locally."
        : "No active game. Create a new game or restore a CSV backup.";
    $("backupBadge").textContent = backupConnected
        ? "Backup path connected"
        : "Backup not connected";
}

export function renderRoundInputs(gameState) {
    $("roundNumber").textContent = gameState.rounds.length + 1;
    const container = $("roundInputs");
    container.innerHTML = "";
    for (const player of gameState.players) {
        const row = document.createElement("div");
        row.className = "round-row";
        row.innerHTML = `
      <div class="round-player" title="${escapeHtml(player)}">${escapeHtml(player)}</div>
      <label class="field-label">Bid<input class="score-input" type="number" min="0" step="1" inputmode="numeric" id="bid_${safeId(player)}"></label>
      <label class="field-label">totPair<input class="score-input" type="number" min="0" step="1" inputmode="numeric" id="pair_${safeId(player)}"></label>
      <label class="field-label">Pen<input class="score-input" type="number" min="0" step="1" inputmode="numeric" value="0" id="pen_${safeId(player)}"></label>`;
        container.appendChild(row);
    }
}

export function getRoundInput(player, prefix) {
    return $(prefix + "_" + safeId(player));
}

function scoreClass(score) {
    if (score > 0) return "score-positive";
    if (score < 0) return "score-negative";
    return "score-neutral";
}

export function renderScoreboard(gameState) {
    const header = $("scoreHeader");
    const body = $("scoreBody");
    header.innerHTML =
        "<th>Round</th>" +
        gameState.players
            .map((player) => `<th>${escapeHtml(player)}</th>`)
            .join("");
    body.innerHTML = "";
    gameState.rounds.forEach((round, index) => {
        const row = document.createElement("tr");
        row.innerHTML = `<td><strong>${index + 1}</strong></td>`;
        gameState.players.forEach((player) => {
            const points = round.points[player] ?? 0;
            const sign = points > 0 ? "+" : "";
            row.innerHTML += `<td><span class="${scoreClass(points)}">${sign}${points}</span><span class="round-detail">B ${round.bids[player] ?? 0} · P ${round.totPair[player] ?? 0} · Pen ${round.pen[player] ?? 0}</span></td>`;
        });
        body.appendChild(row);
    });
    const totalRow = document.createElement("tr");
    totalRow.className = "score-total";
    totalRow.innerHTML =
        `<td>TOTAL</td>` +
        gameState.players
            .map((player) => {
                const score = gameState.scores[player] ?? 0;
                return `<td class="${scoreClass(score)}">${score}</td>`;
            })
            .join("");
    body.appendChild(totalRow);
}

export function updateBackupPathUi(handle) {
    const name = $("fileName");
    if (handle) {
        name.textContent = `✓ Backup folder selected: ${handle.name || "selected folder"}`;
        name.style.color = "var(--success)";
    } else {
        name.textContent = "No backup path selected.";
        name.style.color = "";
    }
}
