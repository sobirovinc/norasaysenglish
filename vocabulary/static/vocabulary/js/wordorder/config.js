/**
 * Word Order game constants and difficulty presets.
 */
const WordOrderConfig = {
    POINTS_PER_WORD: 2,
    LIVES_PER_ROUND: 3,
    WRONG_CLICKS_PER_LIFE: 3,
    AUTO_ADVANCE_MS: 900,
    TIMER_EXPIRED_MS: 1600,
    CHALLENGE_FLASH_MS: 700,

    HINT_COSTS: {
        nextWord: 10,
        translation: 30,
        revealAnswer: 50,
    },

    MASTERY: {
        perfect: 100,
        hint: 70,
        reviewLater: 50,
        revealAnswer: 20,
        timedOut: 0,
    },

    DIFFICULTIES: {
        guided: {
            id: 'guided',
            label: 'Guided',
            labelUz: 'Yordamli',
            description: '3 words revealed · No timer · ×1 score',
            revealCount: 3,
            timerSeconds: 0,
            multiplier: 1,
            autoAdvance: false,
            flipCard: true,
        },
        independent: {
            id: 'independent',
            label: 'Independent',
            labelUz: 'Mustaqil',
            description: '1 word revealed · 60s timer · ×1.5 score',
            revealCount: 1,
            timerSeconds: 60,
            multiplier: 1.5,
            autoAdvance: false,
            flipCard: true,
        },
        challenge: {
            id: 'challenge',
            label: 'Challenge',
            labelUz: 'Qiyin',
            description: 'No hints shown · 45s timer · ×2 score',
            revealCount: 0,
            timerSeconds: 45,
            multiplier: 2,
            autoAdvance: true,
            flipCard: false,
        },
    },
};

window.WordOrderConfig = WordOrderConfig;
