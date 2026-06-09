/**
 * Spelling shooter sound effects — Web Audio API with preloaded buffers.
 * Eliminates the fetch/decode lag of new Audio() on every play call.
 */
const ShooterAudio = {
    urls: {},
    buffers: {},       // name → AudioBuffer (decoded, ready to play instantly)
    muted: false,
    unlocked: false,
    muteKey: 'nse-game-muted',
    ctx: null,         // single shared AudioContext
    activeNodes: [],

    init(config) {
        this.urls = config || {};
        this.muted = localStorage.getItem(this.muteKey) === 'true';

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.stopAll();
        });

        // Preload all files as soon as init is called.
        // Decoding happens in the background — by the time the player
        // fires the first laser, buffers are already warm.
        this._preloadAll();
    },

    // Create (or resume) the AudioContext. Must be called from a user gesture.
    _getCtx() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        return this.ctx;
    },

    // Fetch + decode every URL into a buffer. Runs silently in the background.
    async _preloadAll() {
        for (const [name, url] of Object.entries(this.urls)) {
            if (!url) continue;
            this._preload(name, url);
        }
    },

    async _preload(name, url) {
        try {
            const res = await fetch(url);
            if (!res.ok) return;
            const arrayBuf = await res.arrayBuffer();
            // We need a ctx to decode — create one quietly if needed.
            // It may be suspended (before user gesture) but decodeAudioData works anyway.
            if (!this.ctx) {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            }
            const audioBuf = await this.ctx.decodeAudioData(arrayBuf);
            this.buffers[name] = audioBuf;
        } catch (_) {
            // Silently ignore missing/broken audio files
        }
    },

    unlock() {
        this.unlocked = true;
        this._getCtx();   // resume the context on first user gesture
    },

    canPlay() {
        return this.unlocked && !this.muted && !document.hidden;
    },

    play(name) {
        if (!this.canPlay()) return null;

        const buf = this.buffers[name];

        // Buffer already decoded → zero-lag play
        if (buf && this.ctx) {
            return this._playBuffer(name, buf);
        }

        // Buffer not ready yet (still downloading) → fall back to HTML Audio
        const url = this.urls[name];
        if (!url) return null;
        return this._playFallback(name, url);
    },

    _playBuffer(name, buf) {
        const ctx = this._getCtx();
        const volumes = { laser: 0.5, explosion: 0.75, wordFall: 0.7, wrong: 0.65, gameOver: 0.8 };

        const gainNode = ctx.createGain();
        gainNode.gain.value = volumes[name] ?? 0.7;
        gainNode.connect(ctx.destination);

        const source = ctx.createBufferSource();
        source.buffer = buf;
        source.connect(gainNode);

        const node = { source, gainNode };
        this.activeNodes.push(node);
        source.onended = () => {
            this.activeNodes = this.activeNodes.filter(n => n !== node);
        };
        source.start(0);
        return source;
    },

    _playFallback(name, url) {
        const volumes = { laser: 0.5, explosion: 0.75, wordFall: 0.7, wrong: 0.65, gameOver: 0.8 };
        const audio = new Audio(url);
        audio.volume = volumes[name] ?? 0.7;
        audio.play().catch(() => {});
        return audio;
    },

    stopAll() {
        this.activeNodes.forEach(({ source }) => {
            try { source.stop(); } catch (_) {}
        });
        this.activeNodes = [];
    },

    setMuted(isMuted) {
        this.muted = isMuted;
        localStorage.setItem(this.muteKey, String(isMuted));
        if (isMuted) this.stopAll();
    },

    isMuted() {
        return this.muted;
    },
};

window.ShooterAudio = ShooterAudio;
