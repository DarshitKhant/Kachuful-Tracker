/** KaChuPuL scoring rules. Keep this module free of DOM/storage code. */
export function calculatePoints(bid, totPair, pen) {
    return (bid <= totPair ? bid : 0) - pen;
}

export function createRound(players, readInput) {
    const round = { bids: {}, totPair: {}, pen: {}, points: {} };
    for (const player of players) {
        const values = readInput(player);
        const bid = Number(values.bid);
        const totPair = Number(values.totPair);
        const pen = Number(values.pen);
        if (
            !Number.isInteger(bid) ||
            !Number.isInteger(totPair) ||
            !Number.isInteger(pen) ||
            bid < 0 ||
            totPair < 0 ||
            pen < 0
        ) {
            throw new Error(
                "Enter valid non-negative whole numbers for Bid, totPair and Pen for every player.",
            );
        }
        round.bids[player] = bid;
        round.totPair[player] = totPair;
        round.pen[player] = pen;
        round.points[player] = calculatePoints(bid, totPair, pen);
    }
    return round;
}

export function applyRoundScores(scores, round, players) {
    const nextScores = { ...scores };
    for (const player of players)
        nextScores[player] = (nextScores[player] || 0) + round.points[player];
    return nextScores;
}
