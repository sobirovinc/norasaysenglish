/**
 * Boot the Word Order game page.
 */
document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('wordOrderRoot');
    if (!root) {
        return;
    }

    WordOrderAudio.init({
        correct_word: root.dataset.soundCorrect,
        wrong_word: root.dataset.soundWrong,
        life_lost: root.dataset.soundLifeLost,
        round_complete: root.dataset.soundRoundComplete,
        round_failed: root.dataset.soundRoundFailed,
        timer_expired: root.dataset.soundTimerExpired,
        unit_complete: root.dataset.soundUnitComplete,
        sentence_complete: root.dataset.soundSentenceComplete,
    });

    const game = new WordOrderGame({
        unitId: root.dataset.unitId,
        apiUrl: root.dataset.sentencesApiUrl,
    });

    const ui = new WordOrderUI(root, game);
    ui.init();
});
