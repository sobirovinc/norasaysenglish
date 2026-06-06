/**
 * Loads CMS-driven game events and plays optional sound/GIF assets with safe fallbacks.
 */
class GameEventPresenter {
    constructor() {
        this.events = {};
        this.config = {
            life_cost: 50,
            correct_score: 10,
            round_pause_ms: 2200,
        };
        this.muted = false;
        this.activeAudio = null;
        this.sharedAudio = null;
        this.audioUnlocked = false;
        this.muteStorageKey = 'nse-game-muted';
    }

    isPageVisible() {
        return document.visibilityState === 'visible';
    }

    isAudible() {
        return !this.muted && this.isPageVisible();
    }

    async loadEvents() {
        const response = await fetch('/api/game-events/');
        if (!response.ok) {
            throw new Error('Failed to load game events.');
        }

        const payload = await response.json();
        this.events = payload.events || payload;
        if (payload.config) {
            this.config = { ...this.config, ...payload.config };
        }

        this.muted = localStorage.getItem(this.muteStorageKey) === 'true';
    }

    getEvent(eventType) {
        return this.events[eventType] || null;
    }

    setMuted(isMuted) {
        this.muted = isMuted;
        localStorage.setItem(this.muteStorageKey, String(isMuted));
        if (isMuted) {
            this.stopSound();
        }
    }

    isMuted() {
        return this.muted;
    }

    /** Show title/message and attempt optional media for a game event. */
    showGameEvent(eventType, { titleEl, messageEl, gifEl, bannerEl, skipSound = false } = {}) {
        const event = this.getEvent(eventType);
        if (!event) {
            return { title: '', message: '' };
        }

        const title = event.title || '';
        const message = event.message || '';

        if (titleEl) {
            titleEl.textContent = title;
        }
        if (messageEl) {
            messageEl.textContent = message;
        }
        if (bannerEl) {
            const hasContent = Boolean(title || message);
            bannerEl.classList.toggle('is-empty', !hasContent);
            const heading = bannerEl.querySelector('[data-event-title]');
            const body = bannerEl.querySelector('[data-event-message]');
            if (heading) {
                heading.textContent = title;
            }
            if (body) {
                body.textContent = message;
            }
        }

        this.playEventSound(eventType, { skipSound });
        if (gifEl) {
            this.showEventGif(gifEl, eventType);
        }

        return { title, message };
    }

    unlockAudio() {
        if (this.audioUnlocked) {
            return;
        }

        this.audioUnlocked = true;
        if (!this.sharedAudio) {
            this.sharedAudio = new Audio();
        }
    }

    playEventSound(eventType, { skipSound = false } = {}) {
        if (skipSound || !this.isAudible()) {
            return;
        }

        const event = this.getEvent(eventType);
        if (!event || !event.sound_url) {
            return;
        }

        if (!this.sharedAudio) {
            this.sharedAudio = new Audio();
        }

        const audio = this.sharedAudio;
        audio.pause();
        audio.src = event.sound_url;
        audio.currentTime = 0;
        audio.onerror = () => {
            this.activeAudio = null;
        };
        this.activeAudio = audio;
        audio.play().catch(() => {
            this.activeAudio = null;
        });
    }

    showEventGif(container, eventType) {
        if (!container) {
            return;
        }

        const event = this.getEvent(eventType);
        container.hidden = true;
        container.removeAttribute('src');

        if (!event || !event.gif_url) {
            return;
        }

        container.onerror = () => {
            container.hidden = true;
            container.removeAttribute('src');
        };
        container.onload = () => {
            container.hidden = false;
        };
        container.src = event.gif_url;
    }

    stopSound() {
        if (this.sharedAudio) {
            this.sharedAudio.pause();
            this.sharedAudio.currentTime = 0;
        }
        this.activeAudio = null;
    }

    stopAllAudio() {
        this.stopSound();
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
    }
}
