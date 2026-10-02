import { EMPTY_GAME } from "./database.js";

function createGameId() {
    const bytes = crypto.getRandomValues(new Uint8Array(3));
    return `KCP-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase()}`;
}

export function createNewGame() {
    return {
        ...EMPTY_GAME(),
        gameId: createGameId(),
        createdAt: new Date().toISOString(),
    };
}

export function canStartGame(gameState) {
    return gameState.players.length >= 2;
}

export function nextRoundNumber(gameState) {
    return gameState.rounds.length + 1;
}

export function appendRound(gameState, round, scores) {
    return { ...gameState, rounds: [...gameState.rounds, round], scores };
}

export function resetGameState() {
    return EMPTY_GAME();
}
