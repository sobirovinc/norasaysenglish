/**
 * Loads CMS-driven game events and plays optional sound/GIF assets.
 * Uses Web Audio API with preloaded buffers so sounds play instantly
 * on first trigger rather than waiting for a network fetch.
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
        this.audioUnlocked = false;
        this.muteStorageKey = 'nse-game-muted';

        // Web Audio API
        this.ctx = null;
        this.buffers = {};   // sound_url → AudioBuffer
        this.activeNodes = [];
    }

    isPageVisible() {
        return document.visibilityState === 'visible';
    }

    isAudible() {
        return !this.muted && this.isPageVisible();
    }

    // ── AudioContext ──────────────────────────────────────────────────────────
    _getCtx() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        return this.ctx;
    }

    // ── Load & preload ────────────────────────────────────────────────────────
    async loadEvents() {
        const response = await fetch('/api/game-events/');
        if (!response.ok) throw new Error('Failed to load game events.');

        const payload = await response.json();
        this.events = payload.events || payload;
        if (payload.config) {
            this.config = { ...this.config, ...payload.config };
        }

        this.muted = localStorage.getItem(this.muteStorageKey) === 'true';

        // Kick off background preload of all event sounds immediately.
        // By the time the player makes their first move, buffers are ready.
        this._preloadAllSounds();
    }

    _preloadAllSounds() {
        // Create a temporary ctx for decoding (may be suspended before user gesture,
        // but decodeAudioData works regardless of ctx state).
        if (!this.ctx) {
            try {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            } catch (_) { return; }
        }

        const seen = new Set();
        for (const event of Object.values(this.events)) {
            if (event.sound_url && !seen.has(event.sound_url)) {
                seen.add(event.sound_url);
                this._preloadBuffer(event.sound_url);
            }
        }
    }

    async _preloadBuffer(url) {
        try {
            const res = await fetch(url);
            if (!res.ok) return;
            const arrayBuf = await res.arrayBuffer();
            const audioBuf = await this.ctx.decodeAudioData(arrayBuf);
            this.buffers[url] = audioBuf;
        } catch (_) {
            // Silently ignore missing/corrupt audio
        }
    }

    // ── Public API ────────────────────────────────────────────────────────────
    getEvent(eventType) {
        return this.events[eventType] || null;
    }

    setMuted(isMuted) {
        this.muted = isMuted;
        localStorage.setItem(this.muteStorageKey, String(isMuted));
        if (isMuted) this.stopSound();
    }

    isMuted() {
        return this.muted;
    }

    unlockAudio() {
        if (this.audioUnlocked) return;
        this.audioUnlocked = true;
        this._getCtx();   // resume context on first user gesture
    }

    /** Show title/message and attempt optional media for a game event. */
    showGameEvent(eventType, { titleEl, messageEl, gifEl, bannerEl, skipSound = false } = {}) {
        const event = this.getEvent(eventType);
        if (!event) return { title: '', message: '' };

        const title   = event.title   || '';
        const message = event.message || '';

        if (titleEl)   titleEl.textContent   = title;
        if (messageEl) messageEl.textContent = message;

        if (bannerEl) {
            const hasContent = Boolean(title || message);
            bannerEl.classList.toggle('is-empty', !hasContent);
            const heading = bannerEl.querySelector('[data-event-title]');
            const body    = bannerEl.querySelector('[data-event-message]');
            if (heading) heading.textContent = title;
            if (body)    body.textContent    = message;
        }

        this.playEventSound(eventType, { skipSound });
        if (gifEl) this.showEventGif(gifEl, eventType);

        return { title, message };
    }

    playEventSound(eventType, { skipSound = false } = {}) {
        if (skipSound || !this.isAudible() || !this.audioUnlocked) return;

        const event = this.getEvent(eventType);
        if (!event || !event.sound_url) return;

        const url = event.sound_url;
        const buf = this.buffers[url];

        if (buf && this.ctx) {
            // Buffer is ready → play instantly via Web Audio
            this._playBuffer(buf);
        } else {
            // Buffer still loading (very first play, slow connection) → HTML Audio fallback
            this._playFallback(url);
        }
    }

    _playBuffer(buf) {
        const ctx = this._getCtx();
        const source = ctx.createBufferSource();
        source.buffer = buf;
        source.connect(ctx.destination);

        this.activeNodes.push(source);
        source.onended = () => {
            this.activeNodes = this.activeNodes.filter(n => n !== source);
        };
        source.start(0);
    }

    _playFallback(url) {
        const audio = new Audio(url);
        audio.play().catch(() => {});
    }

    showEventGif(container, eventType) {
        if (!container) return;

        const event = this.getEvent(eventType);
        container.hidden = true;
        container.removeAttribute('src');

        if (!event || !event.gif_url) return;

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
        this.activeNodes.forEach(source => {
            try { source.stop(); } catch (_) {}
        });
        this.activeNodes = [];
    }

    stopAllAudio() {
        this.stopSound();
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
    }
}
