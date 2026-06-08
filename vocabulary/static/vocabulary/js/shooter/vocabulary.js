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
 * Shooter uses the first word only — e.g. "depend on" → "depend".
 */
function toShooterEnglish(raw) {
    const text = String(raw).trim().toLowerCase();
    return text.split(/\s+/)[0] || '';
}

function normalizeWords(words) {
    return words.map((word, index) => ({
        id: index,
        uzbek: String(word.uzbek || word.uzbek_word).trim(),
        english: toShooterEnglish(word.english || word.english_word),
    })).filter((word) => word.uzbek && word.english);
}

window.toShooterEnglish = toShooterEnglish;

window.loadShooterWords = loadShooterWords;
