export const CSV_FILE_NAME = "KaChuPuL_Score.csv";

function csvEscape(value) {
    const text = value == null ? "" : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function serializeGameToCsv(gameState) {
    const rows = [
        ["KaChuPuL Score Tracker"],
        ["App", "KaChuPuL Score Tracker"],
        ["Game ID", gameState.gameId],
        ["Created At", gameState.createdAt],
        [],
        ["SCORES"],
        ["Player", "Total Score"],
        ...gameState.players.map((player) => [
            player,
            gameState.scores[player] ?? 0,
        ]),
        [],
        ["ROUNDS"],
        ["Round", "Player", "Bid", "totPair", "Pen", "Points"],
        ...gameState.rounds.flatMap((round, index) =>
            gameState.players.map((player) => [
                index + 1,
                player,
                round.bids[player] ?? 0,
                round.totPair[player] ?? 0,
                round.pen[player] ?? 0,
                round.points[player] ?? 0,
            ]),
        ),
    ];
    return (
        rows.map((row) => row.map(csvEscape).join(",")).join("\r\n") + "\r\n"
    );
}

export async function getBackupFileHandle(
    directoryHandle,
    createIfMissing = false,
) {
    if (!directoryHandle) return null;
    try {
        let permission = "granted";
        if (directoryHandle.queryPermission)
            permission = await directoryHandle.queryPermission({
                mode: "readwrite",
            });
        if (permission !== "granted" && directoryHandle.requestPermission)
            permission = await directoryHandle.requestPermission({
                mode: "readwrite",
            });
        if (permission !== "granted")
            throw new Error("Write permission was not granted.");
        return await directoryHandle.getFileHandle(CSV_FILE_NAME, {
            create: createIfMissing,
        });
    } catch (error) {
        if (error?.name === "NotFoundError" && !createIfMissing) return null;
        throw new Error(
            "Backup path is unavailable. Re-select the backup path in Settings.",
        );
    }
}

export async function writeCsvToHandle(fileHandle, gameState) {
    if (!fileHandle) throw new Error("No backup file is available.");
    const writable = await fileHandle.createWritable();
    try {
        await writable.write(serializeGameToCsv(gameState));
    } finally {
        await writable.close();
    }
}

export async function generateBackup(directoryHandle, gameState) {
    const fileHandle = await getBackupFileHandle(directoryHandle, true);
    await writeCsvToHandle(fileHandle, gameState);
    return fileHandle;
}

export async function syncExistingBackup(directoryHandle, gameState) {
    const fileHandle = await getBackupFileHandle(directoryHandle, false);
    if (!fileHandle)
        throw new Error(
            "Backup file not found. Please generate the backup file from Settings.",
        );
    await writeCsvToHandle(fileHandle, gameState);
}

export function csvParse(text) {
    const rows = [];
    let row = [],
        field = "",
        quoted = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quoted) {
            if (ch === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i++;
                } else quoted = false;
            } else field += ch;
        } else if (ch === '"' && field === "") {
            quoted = true;
        } else if (ch === ",") {
            row.push(field);
            field = "";
        } else if (ch === "\n") {
            row.push(field.endsWith("\r") ? field.slice(0, -1) : field);
            rows.push(row);
            row = [];
            field = "";
        } else {
            field += ch;
        }
    }
    if (quoted)
        throw new Error("Invalid CSV: an opening quote was not closed.");
    if (field !== "" || row.length) {
        row.push(field);
        rows.push(row);
    }
    return rows;
}

export function parseCsvBackup(text) {
    const rows = csvParse(text).filter((row) =>
        row.some((cell) => cell !== ""),
    );
    if (!rows.length || rows[0][0] !== "KaChuPuL Score Tracker")
        throw new Error(
            "Invalid backup file. Please select a KaChuPuL_Score.csv backup.",
        );
    const appRow = rows.find((row) => row[0] === "App");
    if (!appRow || appRow[1] !== "KaChuPuL Score Tracker")
        throw new Error("Invalid KaChuPuL backup file.");
    const gameId =
        rows.find((row) => row[0] === "Game ID")?.[1] ||
        `KCP-${Date.now().toString(16).toUpperCase()}`;
    const createdAt =
        rows.find((row) => row[0] === "Created At")?.[1] ||
        new Date().toISOString();
    const scoreStart = rows.findIndex(
        (row) => row[0] === "Player" && row[1] === "Total Score",
    );
    const roundStart = rows.findIndex(
        (row) => row[0] === "Round" && row[1] === "Player",
    );
    if (scoreStart < 0 || roundStart < 0)
        throw new Error("Invalid backup file structure.");

    const players = [];
    const scores = {};
    for (let i = scoreStart + 1; i < roundStart - 1; i++) {
        const [player, score] = rows[i];
        if (player) {
            players.push(player);
            scores[player] = Number(score);
        }
    }
    const rounds = [];
    for (let i = roundStart + 1; i < rows.length; i++) {
        const [roundNo, player, bid, totPair, pen, points] = rows[i];
        if (!roundNo || !player) continue;
        const n = Number(roundNo);
        if (!Number.isInteger(n) || n < 1)
            throw new Error("Invalid round number in backup file.");
        while (rounds.length < n)
            rounds.push({ bids: {}, totPair: {}, pen: {}, points: {} });
        rounds[n - 1].bids[player] = Number(bid);
        rounds[n - 1].totPair[player] = Number(totPair);
        rounds[n - 1].pen[player] = Number(pen);
        rounds[n - 1].points[player] = Number(points);
        if (!players.includes(player)) players.push(player);
    }
    if (players.length < 2)
        throw new Error("Backup must contain at least two players.");
    for (const player of players) {
        if (!Number.isFinite(scores[player])) scores[player] = 0;
    }
    return { gameId, createdAt, players, rounds, scores, gameEnded: false };
}

export async function readCsvFile(file) {
    if (!file?.name?.toLowerCase().endsWith(".csv"))
        throw new Error("Please select a CSV backup file.");
    return parseCsvBackup(await file.text());
}
