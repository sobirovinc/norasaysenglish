/**
 * Parse English sentences into word tokens and build playable state.
 */
const WordOrderSentenceParser = {
    SKIP_FOR_REVEAL: new Set([
        'a', 'an', 'the', 'to', 'in', 'on', 'at', 'for', 'of', 'with', 'and', 'or', 'but', 'is', 'am', 'are',
    ]),

    normalize(text) {
        return String(text).trim().toLowerCase();
    },

    tokenize(english) {
        const tokens = [];
        const pattern = /(\S+)/g;
        let match;

        while ((match = pattern.exec(english)) !== null) {
            let word = match[1];
            let punctuation = '';

            while (word.length > 1 && /[.,!?;:]$/.test(word)) {
                punctuation = word.slice(-1) + punctuation;
                word = word.slice(0, -1);
            }

            if (!word) {
                continue;
            }

            tokens.push({
                text: word,
                lower: this.normalize(word),
                punctuation,
                placed: false,
                revealed: false,
            });
        }

        return tokens;
    },

    maxRevealCount(tokenCount) {
        if (tokenCount <= 2) {
            return 0;
        }
        return Math.min(Math.floor(tokenCount * 0.5), tokenCount - 2);
    },

    selectRevealIndices(tokens, requestedCount) {
        const maxAllowed = this.maxRevealCount(tokens.length);
        const count = Math.min(requestedCount, maxAllowed);
        if (count <= 0) {
            return new Set();
        }

        const indices = tokens.map((_, index) => index);
        const meaningful = indices.filter((index) => !this.SKIP_FOR_REVEAL.has(tokens[index].lower));
        const filler = indices.filter((index) => this.SKIP_FOR_REVEAL.has(tokens[index].lower));
        const ordered = [...meaningful, ...filler];

        return new Set(ordered.slice(0, count));
    },

    buildBank(tokens, revealIndices) {
        const bank = [];
        let bankId = 0;

        tokens.forEach((token, index) => {
            if (revealIndices.has(index)) {
                token.placed = true;
                token.revealed = true;
                return;
            }

            bank.push({
                id: `bank-${bankId}`,
                text: token.text,
                lower: token.lower,
                tokenIndex: index,
                used: false,
            });
            bankId += 1;
        });

        return WordOrderRoundPlanner.shuffle(bank);
    },

    buildSentenceState(sentence, difficulty) {
        const tokens = this.tokenize(sentence.english);
        const revealIndices = this.selectRevealIndices(tokens, difficulty.revealCount);
        const bank = this.buildBank(tokens, revealIndices);
        const progressIndex = tokens.findIndex((token) => !token.placed);

        return {
            raw: sentence,
            tokens,
            bank,
            progressIndex: progressIndex === -1 ? tokens.length : progressIndex,
            translationVisible: false,
            answerRevealed: false,
            nextWordHintId: null,
        };
    },

    getCompletedEnglish(state) {
        return state.tokens
            .map((token) => token.text + token.punctuation)
            .join(' ');
    },

    getNextExpectedToken(state) {
        return state.tokens[state.progressIndex] || null;
    },

    remainingBankCount(state) {
        return state.bank.filter((item) => !item.used).length;
    },
};

window.WordOrderSentenceParser = WordOrderSentenceParser;
