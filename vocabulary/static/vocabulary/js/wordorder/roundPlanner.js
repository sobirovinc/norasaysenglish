/**
 * Split unit sentences into rounds of up to 10.
 * If the final chunk would be fewer than 5, merge it into the previous round.
 */
const WordOrderRoundPlanner = {
    shuffle(items) {
        const copy = [...items];
        for (let index = copy.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(Math.random() * (index + 1));
            [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
        }
        return copy;
    },

    planRounds(sentences) {
        if (!sentences.length) {
            return [];
        }

        const rounds = [];
        let index = 0;

        while (index < sentences.length) {
            const remaining = sentences.length - index;

            if (remaining <= 10) {
                if (remaining < 5 && rounds.length > 0) {
                    rounds[rounds.length - 1].push(...sentences.slice(index));
                } else {
                    rounds.push(sentences.slice(index));
                }
                break;
            }

            rounds.push(sentences.slice(index, index + 10));
            index += 10;
        }

        return rounds;
    },

    totalRounds(sentences) {
        return this.planRounds(sentences).length;
    },
};

window.WordOrderRoundPlanner = WordOrderRoundPlanner;
