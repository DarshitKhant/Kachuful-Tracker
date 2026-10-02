import {
    openDatabase,
    loadGame,
    saveGame,
    loadBackupHandle,
    saveBackupHandle,
    EMPTY_GAME,
} from "./database.js";
import {
    createNewGame,
    canStartGame,
    appendRound,
    resetGameState,
} from "./game.js";
import { addPlayer, removePlayer, ensurePlayerScores } from "./players.js";
import { createRound, applyRoundScores } from "./scoring.js";
import { CSV_FILE_NAME, generateBackup, syncExistingBackup } from "./backup.js";
import { restoreFromPicker } from "./restore.js";
import {
    $,
    showSection,
    showSettings,
    setStatus,
    toast,
    renderSetup,
    renderRoundInputs,
    getRoundInput,
    renderScoreboard,
    updateBackupPathUi,
} from "./ui.js";

let gameState = EMPTY_GAME();
let backupHandle = null;
let syncTimer = null;
let syncBusy = false;
let suppressAutoSync = false;

async function init() {
    try {
        await openDatabase();
        gameState = ensurePlayerScores(await loadGame());
        backupHandle = await loadBackupHandle();
        bindEvents();
        renderAll();
        startAutoSync();
        if (
            gameState.players.length >= 2 &&
            !gameState.gameEnded &&
            gameState.rounds.length >= 0 &&
            gameState.gameId
        )
            showPlaySection();
    } catch (error) {
        setStatus(
            "setupStatus",
            `Unable to initialize local storage: ${error.message}`,
            "err",
        );
    }
}

function bindEvents() {
    $("settingsBtn").addEventListener("click", () => {
        updateBackupPathUi(backupHandle);
        showSettings(true);
    });
    $("closeSettingsBtn").addEventListener("click", () => showSettings(false));
    $("settingsModal").addEventListener("click", (event) => {
        if (event.target.hasAttribute("data-close-settings"))
            showSettings(false);
    });
    $("newGameBtn").addEventListener("click", startNewGame);
    $("playerForm").addEventListener("submit", handleAddPlayer);
    $("playerList").addEventListener("click", handleRemovePlayer);
    $("startBtn").addEventListener("click", startGame);
    $("submitRoundBtn").addEventListener("click", submitRound);
    $("syncNowBtn").addEventListener("click", () => syncBackup(true));
    $("endGameBtn").addEventListener("click", endGame);
    $("selectBackupBtn").addEventListener("click", selectBackupPath);
    $("generateBackupBtn").addEventListener("click", generateBackupFile);
    $("restoreBackupBtn").addEventListener("click", restoreBackup);
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") showSettings(false);
    });
}

function renderAll() {
    renderSetup(gameState, Boolean(backupHandle));
    renderRoundInputs(gameState);
    renderScoreboard(gameState);
    updateBackupPathUi(backupHandle);
    $("gameMeta").textContent = gameState.gameId
        ? `${gameState.gameId} · ${new Date(gameState.createdAt).toLocaleString()}`
        : "No active game";
}

function showPlaySection() {
    showSection("playSection");
    renderRoundInputs(gameState);
    renderScoreboard(gameState);
}

async function startNewGame() {
    if (
        gameState.rounds.length &&
        !confirm(
            "Start a new game? The current game will remain saved locally until you reset it.",
        )
    )
        return;
    gameState = createNewGame();
    await saveGame(gameState);
    renderAll();
    showSection("setupSection");
    toast("New game created.", "ok");
}

async function handleAddPlayer(event) {
    event.preventDefault();
    try {
        gameState = addPlayer(gameState, $("playerName").value);
        await saveGame(gameState);
        $("playerName").value = "";
        renderSetup(gameState, Boolean(backupHandle));
        $("playerName").focus();
    } catch (error) {
        toast(error.message, "err");
    }
}

async function handleRemovePlayer(event) {
    const button = event.target.closest("[data-remove-player]");
    if (!button) return;
    const player = button.dataset.removePlayer;
    if (!confirm(`Remove ${player} from this game?`)) return;
    gameState = removePlayer(gameState, player);
    await saveGame(gameState);
    renderSetup(gameState, Boolean(backupHandle));
    toast("Player removed.", "ok");
}

async function startGame() {
    if (!canStartGame(gameState)) {
        toast("At least 2 players are required.", "warn");
        return;
    }
    gameState = ensurePlayerScores({ ...gameState, gameEnded: false });
    await saveGame(gameState);
    showPlaySection();
    toast("Game started.", "ok");
    if (backupHandle) await syncBackup(true);
    else
        setStatus(
            "syncStatus",
            "Game saved locally. Select a backup path and generate the CSV file from Settings.",
            "warn",
        );
}

async function submitRound() {
    try {
        const round = createRound(gameState.players, (player) => ({
            bid: getRoundInput(player, "bid").value,
            totPair: getRoundInput(player, "pair").value,
            pen: getRoundInput(player, "pen").value,
        }));
        gameState = appendRound(
            gameState,
            round,
            applyRoundScores(gameState.scores, round, gameState.players),
        );
        await saveGame(gameState);
        renderRoundInputs(gameState);
        renderScoreboard(gameState);
        toast(`Round ${gameState.rounds.length} saved.`, "ok");
        await syncBackup(true);
    } catch (error) {
        toast(error.message, "err");
    }
}

async function selectBackupPath() {
    try {
        if (!window.showDirectoryPicker)
            throw new Error(
                "Folder selection is not supported here. Use the latest Chrome or Edge.",
            );
        const directory = await window.showDirectoryPicker({
            id: "kachupul-backup-location",
            mode: "readwrite",
        });
        let permission = "granted";
        if (directory.queryPermission)
            permission = await directory.queryPermission({ mode: "readwrite" });
        if (permission !== "granted" && directory.requestPermission)
            permission = await directory.requestPermission({
                mode: "readwrite",
            });
        if (permission !== "granted")
            throw new Error(
                "Write permission was not granted for this folder.",
            );
        backupHandle = directory;
        await saveBackupHandle(backupHandle);
        updateBackupPathUi(backupHandle);
        renderSetup(gameState, true);
        setStatus(
            "settingsStatus",
            "✓ Backup path selected. Click Generate Backup File to create the CSV.",
            "ok",
        );
    } catch (error) {
        if (error.name !== "AbortError")
            setStatus(
                "settingsStatus",
                `Unable to access selected folder: ${error.message}`,
                "err",
            );
    }
}

async function generateBackupFile() {
    try {
        setStatus("settingsStatus", "Creating backup file…", "warn");
        if (!backupHandle) throw new Error("Select a backup path first.");
        await generateBackup(backupHandle, gameState);
        setStatus(
            "settingsStatus",
            `✓ Backup file created successfully: ${CSV_FILE_NAME}`,
            "ok",
        );
        setStatus(
            "syncStatus",
            `✓ Backup file created: ${CSV_FILE_NAME}`,
            "ok",
        );
        renderSetup(gameState, true);
        toast("Backup file created successfully.", "ok");
    } catch (error) {
        setStatus(
            "settingsStatus",
            `Unable to create backup file. ${error.message}`,
            "err",
        );
        toast("Unable to create backup file.", "err");
    }
}

async function restoreBackup() {
    try {
        const result = await restoreFromPicker();
        if (!result) return;
        gameState = ensurePlayerScores(result.gameState);
        await saveGame(gameState);
        if (result.parent) {
            backupHandle = result.parent;
            await saveBackupHandle(backupHandle);
        }
        renderAll();
        showSettings(false);
        if (gameState.players.length >= 2) showPlaySection();
        setStatus(
            "syncStatus",
            `✓ Backup restored: ${result.fileHandle.name}`,
            "ok",
        );
        toast("Backup restored successfully.", "ok");
    } catch (error) {
        if (error.name !== "AbortError") {
            setStatus("settingsStatus", error.message, "err");
            toast("Invalid or unreadable backup file.", "err");
        }
    }
}

async function syncBackup(force = false) {
    if (syncBusy || (!force && suppressAutoSync) || !backupHandle) return false;
    syncBusy = true;
    try {
        if (force) setStatus("syncStatus", "Syncing backup…", "warn");
        await syncExistingBackup(backupHandle, gameState);
        setStatus(
            "syncStatus",
            `✓ Backup synced successfully: ${CSV_FILE_NAME} · ${new Date().toLocaleTimeString()}`,
            "ok",
        );
        $("backupBadge").textContent = "Backup synced";
        $("backupBadge").className = "sync-badge ok";
        return true;
    } catch (error) {
        setStatus("syncStatus", `✕ ${error.message}`, "warn");
        $("backupBadge").textContent = "Backup needs attention";
        $("backupBadge").className = "sync-badge warn";
        return false;
    } finally {
        syncBusy = false;
    }
}

function startAutoSync() {
    clearInterval(syncTimer);
    syncTimer = setInterval(() => syncBackup(false), 2000);
}

async function endGame() {
    if (
        !confirm(
            "End and reset the game? The final state will be synced to the existing backup first.",
        )
    )
        return;
    suppressAutoSync = true;
    try {
        if (backupHandle) await syncBackup(true);
        gameState = { ...gameState, gameEnded: true };
        await saveGame(gameState);
        gameState = resetGameState();
        await saveGame(gameState);
        renderAll();
        showSection("setupSection");
        toast("Game ended and reset.", "ok");
    } finally {
        suppressAutoSync = false;
    }
}

init();
