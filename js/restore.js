import { readCsvFile } from "./backup.js";

export async function restoreFromPicker() {
    if (!window.showOpenFilePicker)
        throw new Error(
            "File selection is not supported here. Use the latest Chrome or Edge.",
        );
    const [fileHandle] = await window.showOpenFilePicker({
        id: "kachupul-restore-file",
        multiple: false,
        types: [
            {
                description: "KaChuPuL CSV Backup",
                accept: { "text/csv": [".csv"] },
            },
        ],
    });
    if (!fileHandle) return null;
    const file = await fileHandle.getFile();
    const gameState = await readCsvFile(file);
    let parent = null;
    try {
        parent = fileHandle.getParent ? await fileHandle.getParent() : null;
    } catch {
        /* optional */
    }
    return { gameState, fileHandle, parent };
}
