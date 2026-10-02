export function addPlayer(gameState, name) {
    const cleanName = String(name).trim();
    if (!cleanName) throw new Error("Enter a player name.");
    if (gameState.players.includes(cleanName))
        throw new Error("Player name already exists.");
    return {
        ...gameState,
        players: [...gameState.players, cleanName],
        scores: {
            ...gameState.scores,
            [cleanName]: gameState.scores[cleanName] ?? 0,
        },
    };
}

export function removePlayer(gameState, name) {
    const players = gameState.players.filter((player) => player !== name);
    const scores = { ...gameState.scores };
    delete scores[name];
    return { ...gameState, players, scores };
}

export function ensurePlayerScores(gameState) {
    const scores = { ...gameState.scores };
    for (const player of gameState.players)
        if (!(player in scores)) scores[player] = 0;
    return { ...gameState, scores };
}
