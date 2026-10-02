const DB_NAME = "KaChuPuLDB";
const DB_VERSION = 1;
const STORE = "app";
const GAME_KEY = "currentGame";
const BACKUP_HANDLE_KEY = "csvDirectoryHandle";

let db;

export const EMPTY_GAME = () => ({
    gameId: "",
    createdAt: "",
    players: [],
    rounds: [],
    scores: {},
    gameEnded: false,
});

export async function openDatabase() {
    if (db) return db;
    db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            if (!event.target.result.objectStoreNames.contains(STORE)) {
                event.target.result.createObjectStore(STORE);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    return db;
}

function put(key, value) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () =>
            reject(tx.error || new Error("IndexedDB transaction aborted."));
    });
}

function get(key) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const request = tx.objectStore(STORE).get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function saveGame(gameState) {
    await put(GAME_KEY, gameState);
}

export async function loadGame() {
    return (await get(GAME_KEY)) || EMPTY_GAME();
}

export async function saveBackupHandle(handle) {
    if (handle) await put(BACKUP_HANDLE_KEY, handle);
}

export async function loadBackupHandle() {
    try {
        const handle = await get(BACKUP_HANDLE_KEY);
        return handle?.kind === "directory" ? handle : null;
    } catch {
        return null;
    }
}
