/**
 * Core rules engine for the Word Order game.
 */
class WordOrderGame {
    constructor(options) {
        this.unitId = options.unitId;
        this.apiUrl = options.apiUrl;
        this.difficulty = null;
        this.allSentences = [];
        this.rounds = [];
        this.currentRoundIndex = 0;
        this.roundSentences = [];
        this.sentenceIndex = 0;
        this.lives = WordOrderConfig.LIVES_PER_ROUND;
        this.score = 0;
        this.wrongClicks = 0;
        this.correctWords = 0;
        this.mistakes = 0;
        this.sentenceResults = [];
        this.requeueTracker = new Map();
        this.listeners = {};
        this.timerId = null;
        this.timerRemaining = 0;
        this.currentSentence = null;
        this.awaitingAdvance = false;
        this.hintsUsedThisSentence = false;
        this.reviewLaterThisSentence = false;
        this.revealAnswerThisSentence = false;
        this.timedOutThisSentence = false;
        this.showSwipeHint = true;
        this.isPaused = false;
    }

    on(eventName, handler) {
        if (!this.listeners[eventName]) {
            this.listeners[eventName] = [];
        }
        this.listeners[eventName].push(handler);
    }

    emit(eventName, payload) {
        (this.listeners[eventName] || []).forEach((handler) => handler(payload));
    }

    async loadSentences() {
        const response = await fetch(this.apiUrl);
        if (!response.ok) {
            throw new Error('Could not load sentences.');
        }

        this.allSentences = await response.json();
        const shuffled = WordOrderRoundPlanner.shuffle(this.allSentences);
        this.rounds = WordOrderRoundPlanner.planRounds(shuffled);
        return this.allSentences.length;
    }

    get totalRounds() {
        return this.rounds.length;
    }

    setDifficulty(difficultyId) {
        this.difficulty = WordOrderConfig.DIFFICULTIES[difficultyId];
        if (!this.difficulty) {
            throw new Error(`Unknown difficulty: ${difficultyId}`);
        }
    }

    startRound(roundIndex = 0) {
        if (!this.difficulty || !this.rounds.length) {
            return;
        }

        this.currentRoundIndex = roundIndex;
        this.roundSentences = this.rounds[roundIndex].map((sentence) => ({ ...sentence }));
        this.sentenceIndex = 0;
        this.lives = WordOrderConfig.LIVES_PER_ROUND;
        this.score = 0;
        this.wrongClicks = 0;
        this.correctWords = 0;
        this.mistakes = 0;
        this.sentenceResults = [];
        this.requeueTracker = new Map();
        this.showSwipeHint = true;
        this.isPaused = false;
        this.loadCurrentSentence();
    }

    loadCurrentSentence() {
        this.stopTimer();

        if (this.sentenceIndex >= this.roundSentences.length) {
            const stats = this.getRoundStats();
            if (stats.hasNextRound) {
                this.emit('roundComplete', stats);
            } else {
                this.emit('unitComplete', stats);
            }
            return;
        }

        const sentence = this.roundSentences[this.sentenceIndex];
        this.currentSentence = WordOrderSentenceParser.buildSentenceState(sentence, this.difficulty);
        this.hintsUsedThisSentence = false;
        this.reviewLaterThisSentence = false;
        this.revealAnswerThisSentence = false;
        this.timedOutThisSentence = false;
        this.awaitingAdvance = false;

        if (this.difficulty.timerSeconds > 0) {
            this.timerRemaining = this.difficulty.timerSeconds;
            this.startTimer();
        }

        this.emit('sentenceLoaded', {
            state: this.currentSentence,
            showSwipeHint: this.showSwipeHint,
            difficulty: this.difficulty,
        });
        this.showSwipeHint = false;

        if (WordOrderSentenceParser.remainingBankCount(this.currentSentence) === 1) {
            window.requestAnimationFrame(() => this.autoPlaceFinalWord());
        }
    }

    startTimer() {
        this.stopTimer();
        this.emit('timerTick', { remaining: this.timerRemaining });

        this.timerId = window.setInterval(() => {
            if (this.isPaused || this.awaitingAdvance) {
                return;
            }

            this.timerRemaining -= 1;
            this.emit('timerTick', { remaining: this.timerRemaining });

            if (this.timerRemaining <= 0) {
                this.handleTimerExpired();
            }
        }, 1000);
    }

    stopTimer() {
        if (this.timerId) {
            window.clearInterval(this.timerId);
            this.timerId = null;
        }
    }

    pauseTimer() {
        this.isPaused = true;
    }

    resumeTimer() {
        this.isPaused = false;
    }

    selectWord(bankId) {
        if (!this.currentSentence || this.awaitingAdvance || this.revealAnswerThisSentence) {
            return null;
        }

        const bankItem = this.currentSentence.bank.find((item) => item.id === bankId && !item.used);
        if (!bankItem) {
            return null;
        }

        const expected = WordOrderSentenceParser.getNextExpectedToken(this.currentSentence);
        if (!expected) {
            return null;
        }

        if (bankItem.lower === expected.lower) {
            return this.handleCorrectWord(bankItem, expected);
        }

        return this.handleWrongWord(bankItem);
    }

    handleCorrectWord(bankItem, expectedToken) {
        bankItem.used = true;
        expectedToken.placed = true;
        this.currentSentence.progressIndex += 1;
        this.correctWords += 1;

        const points = Math.round(WordOrderConfig.POINTS_PER_WORD * this.difficulty.multiplier);
        this.score += points;

        const remaining = WordOrderSentenceParser.remainingBankCount(this.currentSentence);
        const result = {
            type: 'correct',
            bankItem,
            token: expectedToken,
            points,
            remaining,
        };

        this.emit('wordCorrect', result);

        if (remaining === 1) {
            window.requestAnimationFrame(() => this.autoPlaceFinalWord());
        } else if (remaining === 0) {
            this.completeSentence();
        }

        return result;
    }

    handleWrongWord(bankItem) {
        this.wrongClicks += 1;
        this.mistakes += 1;

        const result = {
            type: 'wrong',
            bankItem,
            wrongClicks: this.wrongClicks,
        };

        this.emit('wordWrong', result);

        if (this.wrongClicks >= WordOrderConfig.WRONG_CLICKS_PER_LIFE) {
            this.wrongClicks = 0;
            this.lives -= 1;
            this.emit('lifeLost', { lives: this.lives });

            if (this.lives <= 0) {
                this.stopTimer();
                this.emit('gameOver', this.getRoundStats());
            }
        }

        return result;
    }

    autoPlaceFinalWord() {
        if (!this.currentSentence || this.awaitingAdvance) {
            return null;
        }

        const remainingItems = this.currentSentence.bank.filter((item) => !item.used);
        if (remainingItems.length !== 1) {
            return null;
        }

        const bankItem = remainingItems[0];
        const expected = WordOrderSentenceParser.getNextExpectedToken(this.currentSentence);
        if (!expected || bankItem.lower !== expected.lower) {
            return null;
        }

        bankItem.used = true;
        expected.placed = true;
        this.currentSentence.progressIndex += 1;
        this.correctWords += 1;

        const points = Math.round(WordOrderConfig.POINTS_PER_WORD * this.difficulty.multiplier);
        this.score += points;

        const result = {
            type: 'auto',
            bankItem,
            token: expected,
            points,
        };

        this.emit('wordAutoPlaced', result);
        this.completeSentence();
        return result;
    }

    completeSentence() {
        this.stopTimer();
        this.awaitingAdvance = true;

        this.emit('sentenceComplete', {
            mastery: this.computeMastery(),
            state: this.currentSentence,
            autoAdvance: this.difficulty.autoAdvance,
            flipCard: this.difficulty.flipCard,
        });
    }

    computeMastery() {
        if (this.timedOutThisSentence) {
            return WordOrderConfig.MASTERY.timedOut;
        }
        if (this.revealAnswerThisSentence) {
            return WordOrderConfig.MASTERY.revealAnswer;
        }
        if (this.reviewLaterThisSentence) {
            return WordOrderConfig.MASTERY.reviewLater;
        }
        if (this.hintsUsedThisSentence) {
            return WordOrderConfig.MASTERY.hint;
        }
        return WordOrderConfig.MASTERY.perfect;
    }

    getRoundMastery() {
        if (!this.sentenceResults.length) {
            return 0;
        }
        const total = this.sentenceResults.reduce((sum, value) => sum + value, 0);
        return Math.round(total / this.sentenceResults.length);
    }

    getRoundStats() {
        return {
            score: this.score,
            mastery: this.getRoundMastery(),
            correctWords: this.correctWords,
            mistakes: this.mistakes,
            lives: this.lives,
            roundIndex: this.currentRoundIndex,
            totalRounds: this.totalRounds,
            hasNextRound: this.currentRoundIndex < this.totalRounds - 1,
        };
    }

    advanceSentence() {
        if (!this.awaitingAdvance) {
            return;
        }

        this.sentenceResults.push(this.computeMastery());
        this.awaitingAdvance = false;
        this.sentenceIndex += 1;
        this.loadCurrentSentence();
    }

    markReviewLater() {
        if (!this.awaitingAdvance || !this.currentSentence) {
            return;
        }

        this.reviewLaterThisSentence = true;
        this.scheduleReview(this.currentSentence.raw);
        this.emit('reviewMarked', { sentence: this.currentSentence.raw });
    }

    scheduleReview(sentence) {
        const sentenceId = sentence.id;
        if (this.requeueTracker.get(sentenceId)) {
            return;
        }

        this.requeueTracker.set(sentenceId, true);
        const insertAt = Math.min(this.sentenceIndex + 2, this.roundSentences.length);
        this.roundSentences.splice(insertAt, 0, { ...sentence });
        this.emit('reviewScheduled', { sentence });
    }

    spendPoints(cost) {
        if (this.score < cost) {
            return false;
        }
        this.score -= cost;
        this.emit('scoreChanged', { score: this.score });
        return true;
    }

    useHint(hintType) {
        if (!this.currentSentence || this.awaitingAdvance || this.revealAnswerThisSentence) {
            return null;
        }

        const cost = WordOrderConfig.HINT_COSTS[hintType];
        if (!cost || !this.spendPoints(cost)) {
            return { type: 'insufficient' };
        }

        this.hintsUsedThisSentence = true;

        if (hintType === 'nextWord') {
            const expected = WordOrderSentenceParser.getNextExpectedToken(this.currentSentence);
            const match = this.currentSentence.bank.find(
                (item) => !item.used && item.lower === expected.lower,
            );
            this.currentSentence.nextWordHintId = match ? match.id : null;
            this.emit('hintNextWord', { bankId: this.currentSentence.nextWordHintId });
            return { type: 'nextWord', bankId: this.currentSentence.nextWordHintId };
        }

        if (hintType === 'translation') {
            this.currentSentence.translationVisible = true;
            this.emit('hintTranslation', { text: this.currentSentence.raw.uzbek });
            return { type: 'translation', text: this.currentSentence.raw.uzbek };
        }

        if (hintType === 'revealAnswer') {
            this.revealAnswerThisSentence = true;
            this.revealFullAnswer();
            this.scheduleReview(this.currentSentence.raw);
            this.emit('hintRevealAnswer', { state: this.currentSentence });
            this.completeSentence();
            return { type: 'revealAnswer' };
        }

        return null;
    }

    revealFullAnswer() {
        this.currentSentence.tokens.forEach((token) => {
            token.placed = true;
        });
        this.currentSentence.bank.forEach((item) => {
            item.used = true;
        });
        this.currentSentence.progressIndex = this.currentSentence.tokens.length;
        this.currentSentence.answerRevealed = true;
    }

    handleTimerExpired() {
        if (this.awaitingAdvance || !this.currentSentence) {
            return;
        }

        this.stopTimer();
        this.timedOutThisSentence = true;
        this.revealFullAnswer();
        this.scheduleReview(this.currentSentence.raw);
        this.emit('timerExpired', { state: this.currentSentence });

        window.setTimeout(() => {
            this.awaitingAdvance = true;
            this.sentenceResults.push(this.computeMastery());
            window.setTimeout(() => {
                this.awaitingAdvance = false;
                this.sentenceIndex += 1;
                this.loadCurrentSentence();
            }, WordOrderConfig.TIMER_EXPIRED_MS);
        }, 400);
    }

    retryRound() {
        this.startRound(this.currentRoundIndex);
    }

    startNextRound() {
        if (this.currentRoundIndex >= this.totalRounds - 1) {
            this.emit('unitComplete', this.getRoundStats());
            return;
        }
        this.startRound(this.currentRoundIndex + 1);
    }
}

window.WordOrderGame = WordOrderGame;
