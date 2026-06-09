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
 * Returns the english word as-is (lowercase/trimmed).
 * Words with spaces, hyphens, or slashes are NOT usable in the shooter
 * and will be filtered out by normalizeWords below.
 */
function toShooterEnglish(raw) {
    return String(raw).trim().toLowerCase();
}

/**
 * A word is typeable if it contains only plain letters (and digits).
 * Anything with a space ("dream on"), hyphen ("to-do"), slash ("and/or"),
 * or other punctuation is excluded from the shooter deck.
 */
function isTypeableWord(str) {
    return /^[a-z0-9]+$/i.test(str);
}

function normalizeWords(words) {
    return words.map((word, index) => ({
        id: index,
        uzbek: String(word.uzbek || word.uzbek_word).trim(),
        english: toShooterEnglish(word.english || word.english_word),
    })).filter((word) => word.uzbek && word.english && isTypeableWord(word.english));
}

window.toShooterEnglish = toShooterEnglish;

window.loadShooterWords = loadShooterWords;