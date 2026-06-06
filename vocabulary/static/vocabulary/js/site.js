document.addEventListener('DOMContentLoaded', () => {
    initContinueCard();
    initUnitStars();
});

function initContinueCard() {
    const card = document.getElementById('continueCard');
    if (!card || typeof GameProgress === 'undefined') {
        return;
    }

    const data = GameProgress.load();
    if (!data.lastUnitId || !data.lastUnitIntroUrl) {
        card.hidden = true;
        return;
    }

    card.href = data.lastUnitIntroUrl;
    const titleEl = document.getElementById('continueUnitTitle');
    if (titleEl) {
        titleEl.textContent = data.lastUnitTitle || 'Continue learning';
    }
    card.hidden = false;
}

function initUnitStars() {
    if (typeof GameProgress === 'undefined') {
        return;
    }

    document.querySelectorAll('[data-unit-id]').forEach((card) => {
        const unitId = card.dataset.unitId;
        const starsEl = card.querySelector('[data-unit-stars]');
        const progress = GameProgress.getUnit(unitId);

        if (!progress) {
            return;
        }

        GameProgress.renderStars(starsEl, progress.stars || 0);
        card.classList.add('is-completed');

        const scoreEl = card.querySelector('[data-unit-best]');
        if (scoreEl && progress.bestScore) {
            scoreEl.textContent = `Best: ${progress.bestScore}`;
            scoreEl.hidden = false;
        }
    });
}
