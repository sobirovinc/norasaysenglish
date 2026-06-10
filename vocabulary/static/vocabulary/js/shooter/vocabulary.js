/**
 * Word list loader — hardcoded fallback, ready for Django API.
 */
const SHOOTER_FALLBACK_WORDS = [
    { uzbek: 'olma', english: 'apple' },
    { uzbek: 'kitob', english: 'book' },
    { uzbek: 'qizil', english: 'red' },
    { uzbek: 'suv', english: 'water' },
    { uzbek: 'uy', english: 'house' },
];

async function loadShooterWords(unitId, apiUrl) {
    if (unitId && apiUrl) {
        try {
            const response = await fetch(apiUrl);
            if (response.ok) {
                const words = await response.json();
                if (words.length) {
                    return normalizeWords(words);
                }
            }
        } catch (error) {
            // Fall back to demo list below.
        }
    }
    return normalizeWords(SHOOTER_FALLBACK_WORDS);
}

/**
 * Filter out multi-word / hyphenated entries entirely.
 * 'dream on', 'to-do list', 'believe in' → excluded.
 * Single clean words like 'apple', 'ceremony' → included.
 */
function isShooterEligible(raw) {
    const text = String(raw).trim().toLowerCase();
    // Exclude if it contains a space or hyphen → multi-word phrase
    return !/[\s-]/.test(text) && text.length > 0;
}

function toShooterEnglish(raw) {
    return String(raw).trim().toLowerCase();
}

function normalizeWords(words) {
    return words
        .filter((word) => isShooterEligible(word.english || word.english_word))
        .map((word, index) => ({
            id: index,
            uzbek: String(word.uzbek || word.uzbek_word).trim(),
            english: toShooterEnglish(word.english || word.english_word),
        }))
        .filter((word) => word.uzbek && word.english);
}

window.toShooterEnglish = toShooterEnglish;

window.loadShooterWords = loadShooterWords;
