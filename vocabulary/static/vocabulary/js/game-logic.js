/**
 * Pure game rules: matching, scoring, lives, rounds, and session stats.
 */
class MatchingGame {
    constructor(words, config, callbacks) {
        this.allWords = words.map((word, index) => ({ ...word, id: index }));
        this.config = config;
        this.callbacks = callbacks;
        this.reset();
    }

    reset() {
        this.rounds = this.initializeRounds();
        this.currentRoundIndex = 0;
        this.currentRoundWords = [];
        this.lives = 3;
        this.score = 0;
        this.remainingSeconds = this.config.roundSeconds;
        this.matchedIds = new Set();
        this.selectedUzbek = null;
        this.selectedEnglish = null;
        this.isFinished = false;
        this.isRoundTransitioning = false;
        this.isRoundFailed = false;
        this.finishReason = null;
        this.correctMatches = 0;
        this.incorrectMatches = 0;
        this.elapsedSeconds = 0;
    }

    initializeRounds() {
        const rounds = [];
        for (let index = 0; index < this.allWords.length; index += this.config.roundSize) {
            rounds.push(this.allWords.slice(index, index + this.config.roundSize));
        }
        return rounds;
    }

    loadRound(roundIndex) {
        this.currentRoundIndex = roundIndex;
        this.currentRoundWords = this.rounds[roundIndex] || [];
        this.remainingSeconds = this.config.roundSeconds;
        this.matchedIds = new Set();
        this.clearSelection();
        this.isRoundTransitioning = false;
        this.isRoundFailed = false;
        this.callbacks.onRoundLoaded(this.getState());
    }

    selectWord(side, id) {
        if (this.isFinished || this.isRoundTransitioning || this.isRoundFailed || this.matchedIds.has(id)) {
            return;
        }

        if (side === 'uzbek') {
            this.selectedUzbek = id;
        } else {
            this.selectedEnglish = id;
        }

        this.callbacks.onSelectionChange(this.selectedUzbek, this.selectedEnglish);

        if (this.selectedUzbek !== null && this.selectedEnglish !== null) {
            this.checkMatch();
        }
    }

    checkMatch() {
        const uzbekId = this.selectedUzbek;
        const englishId = this.selectedEnglish;

        if (uzbekId === englishId) {
            const matchedWord = this.currentRoundWords.find((word) => word.id === englishId);
            this.score += this.config.correctScore;
            this.correctMatches += 1;
            this.matchedIds.add(uzbekId);
            this.clearSelection();
            this.callbacks.onCorrect(uzbekId, matchedWord.english, this.getState());

            if (this.matchedIds.size === this.currentRoundWords.length) {
                this.completeRound();
            }
            return;
        }

        this.incorrectMatches += 1;
        this.lives -= 1;
        this.callbacks.onIncorrect(uzbekId, englishId, this.getState());
        this.clearSelection();

        if (this.lives > 0) {
            this.callbacks.onLifeLost(this.getState());
            return;
        }

        this.isFinished = true;
        this.finishReason = 'no_lives';
        this.callbacks.onNoLivesRemaining(this.getState());
    }

    completeRound() {
        this.isRoundTransitioning = true;
        this.score += this.config.roundBonus;
        this.callbacks.onRoundComplete(this.getState());
    }

    advanceAfterRound() {
        if (this.isFinished) {
            return;
        }

        const nextRoundIndex = this.currentRoundIndex + 1;
        if (nextRoundIndex >= this.rounds.length) {
            this.isFinished = true;
            this.finishReason = 'unit_complete';
            this.callbacks.onUnitComplete(this.getState());
            return;
        }

        this.loadRound(nextRoundIndex);
    }

    tick() {
        if (this.isFinished || this.isRoundTransitioning || this.isRoundFailed) {
            return;
        }

        this.remainingSeconds -= 1;
        this.elapsedSeconds += 1;
        this.callbacks.onTick(this.getState());

        if (this.remainingSeconds <= 0) {
            this.handleTimerExpired();
        }
    }

    handleTimerExpired() {
        this.isRoundFailed = true;
        this.callbacks.onTimerExpired(this.getState());
    }

    retryRound() {
        this.isRoundFailed = false;
        this.remainingSeconds = this.config.roundSeconds;
        this.matchedIds = new Set();
        this.clearSelection();
        this.callbacks.onRoundRetry(this.getState());
    }

    canPurchaseLife() {
        return this.score >= this.config.lifeCost;
    }

    purchaseLife() {
        if (!this.canPurchaseLife()) {
            return false;
        }

        this.score -= this.config.lifeCost;
        this.lives = 1;
        this.isFinished = false;
        this.finishReason = null;
        return true;
    }

    clearSelection() {
        this.selectedUzbek = null;
        this.selectedEnglish = null;
    }

    getState() {
        const completedRounds = this.currentRoundIndex + (this.isRoundTransitioning ? 1 : 0);
        const totalRounds = this.rounds.length || 1;

        return {
            currentRoundIndex: this.currentRoundIndex,
            currentRoundNumber: this.currentRoundIndex + 1,
            currentRoundWords: this.currentRoundWords,
            totalRounds,
            completedRounds,
            progressPercent: Math.round((completedRounds / totalRounds) * 100),
            lives: this.lives,
            maxLives: 3,
            score: this.score,
            remainingSeconds: this.remainingSeconds,
            correctMatches: this.correctMatches,
            incorrectMatches: this.incorrectMatches,
            elapsedSeconds: this.elapsedSeconds,
            finishReason: this.finishReason,
            lifeCost: this.config.lifeCost,
            canPurchaseLife: this.canPurchaseLife(),
        };
    }
}
