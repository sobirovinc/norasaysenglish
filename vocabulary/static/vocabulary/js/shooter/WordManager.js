/**
 * Manages spawn pool and enforces unique first letters among active enemies.
 */
class WordManager {
    constructor(words) {
        this.allWords = words.map((word) => ({
            ...word,
            english: word.english.toLowerCase(),
        }));
        this.completedIds = new Set();
    }

    get remainingWords() {
        return this.allWords.filter((word) => !this.completedIds.has(word.id));
    }

    isComplete() {
        return this.completedIds.size >= this.allWords.length;
    }

    markCompleted(wordId) {
        this.completedIds.add(wordId);
    }

    getActiveFirstLetters(activeEnemies) {
        return new Set(
            activeEnemies.map((enemy) => enemy.english[0].toLowerCase()),
        );
    }

    getSpawnCandidates(activeEnemies) {
        const usedLetters = this.getActiveFirstLetters(activeEnemies);
        const onScreenIds = new Set(activeEnemies.map((enemy) => enemy.wordId));

        return this.remainingWords.filter((word) => {
            const first = word.english[0].toLowerCase();
            return !usedLetters.has(first) && !onScreenIds.has(word.id);
        });
    }

    nextSpawnable(activeEnemies) {
        const candidates = this.getSpawnCandidates(activeEnemies);
        if (!candidates.length) {
            return null;
        }
        const index = Math.floor(Math.random() * candidates.length);
        return candidates[index];
    }

    findTargetByLetter(letter, activeEnemies, activeTarget) {
        const ch = letter.toLowerCase();

        if (
            activeTarget
            && !activeTarget.isDestroyed
            && activeTarget.typedLength < activeTarget.english.length
        ) {
            return activeTarget;
        }

        return activeEnemies.find((enemy) => {
            if (enemy.isDestroyed) {
                return false;
            }
            const next = enemy.english[enemy.typedLength];
            return next && next.toLowerCase() === ch;
        }) || null;
    }
}

window.WordManager = WordManager;
