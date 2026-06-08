/**
 * Tracks score, mistakes, fallen words, and continue economy.
 */
class ScoreManager {
    constructor() {
        this.score = 0;
        this.mistakes = 0;
        this.fallenWords = 0;
        this.maxMistakes = 5;
        this.maxFallen = 3;
        this.pointsPerChar = 2;
        this.continueCost = 50;
        this.wordsDestroyed = 0;
    }

    addCorrectChar() {
        this.score += this.pointsPerChar;
    }

    addMistake() {
        this.mistakes += 1;
    }

    addFallen() {
        this.fallenWords += 1;
    }

    addDestroyedWord() {
        this.wordsDestroyed += 1;
    }

    isGameOver() {
        return this.mistakes >= this.maxMistakes || this.fallenWords >= this.maxFallen;
    }

    canContinue() {
        return this.score >= this.continueCost;
    }

    continueGame() {
        if (!this.canContinue()) {
            return false;
        }
        this.score -= this.continueCost;
        this.mistakes = 0;
        this.fallenWords = 0;
        return true;
    }

    reset() {
        this.score = 0;
        this.mistakes = 0;
        this.fallenWords = 0;
        this.wordsDestroyed = 0;
    }
}

window.ScoreManager = ScoreManager;
