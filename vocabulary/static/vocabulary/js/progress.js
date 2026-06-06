/**
 * Local progress: stars, scores, and continue-playing state.
 */
const GameProgress = {
    storageKey: 'nse-game-progress',

    load() {
        try {
            return JSON.parse(localStorage.getItem(this.storageKey)) || { units: {}, lastUnitId: null };
        } catch (error) {
            return { units: {}, lastUnitId: null };
        }
    },

    save(data) {
        localStorage.setItem(this.storageKey, JSON.stringify(data));
    },

    getUnit(unitId) {
        const data = this.load();
        return data.units[String(unitId)] || null;
    },

    calculateStars(state) {
        if (state.lives >= 3) {
            return 3;
        }
        if (state.lives >= 1) {
            return 2;
        }
        return 1;
    },

    recordVictory(unitId, state) {
        const data = this.load();
        const key = String(unitId);
        const stars = this.calculateStars(state);
        const existing = data.units[key] || {};

        data.units[key] = {
            stars: Math.max(existing.stars || 0, stars),
            bestScore: Math.max(existing.bestScore || 0, state.score),
            completed: true,
            completedAt: new Date().toISOString(),
        };
        data.lastUnitId = Number(unitId);
        this.save(data);
        return data.units[key];
    },

    setLastUnit(unitId, meta = {}) {
        const data = this.load();
        data.lastUnitId = Number(unitId);
        if (meta.title) {
            data.lastUnitTitle = meta.title;
        }
        if (meta.introUrl) {
            data.lastUnitIntroUrl = meta.introUrl;
        }
        this.save(data);
    },

    renderStars(container, stars, maxStars = 3) {
        if (!container) {
            return;
        }
        container.innerHTML = '';
        for (let index = 0; index < maxStars; index += 1) {
            const star = document.createElement('span');
            star.className = index < stars ? 'star is-earned' : 'star';
            star.textContent = '★';
            star.setAttribute('aria-hidden', 'true');
            container.appendChild(star);
        }
    },
};
