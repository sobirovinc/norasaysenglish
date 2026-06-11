/**
 * Word Order game sound effects.
 */
const WordOrderAudio = {
    urls: {},
    muted: false,
    unlocked: false,
    muteKey: 'nse-game-muted',
    active: [],

    init(config) {
        this.urls = config || {};
        this.muted = localStorage.getItem(this.muteKey) === 'true';

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.stopAll();
            }
        });
    },

    unlock() {
        this.unlocked = true;
    },

    canPlay() {
        return this.unlocked && !this.muted && !document.hidden;
    },

    play(name) {
        const url = this.urls[name];
        if (!url || !this.canPlay()) {
            return null;
        }

        const audio = new Audio(url);
        const volumes = {
            correct_word: 0.55,
            wrong_word: 0.65,
            life_lost: 0.75,
            round_complete: 0.8,
            round_failed: 0.8,
            timer_expired: 0.7,
            unit_complete: 0.85,
            sentence_complete: 0.7,
        };
        audio.volume = volumes[name] ?? 0.7;

        this.active.push(audio);
        const cleanup = () => {
            this.active = this.active.filter((item) => item !== audio);
        };
        audio.addEventListener('ended', cleanup);
        audio.addEventListener('error', cleanup);
        audio.play().catch(cleanup);
        return audio;
    },

    stopAll() {
        this.active.forEach((audio) => {
            audio.pause();
            audio.currentTime = 0;
        });
        this.active = [];
    },

    setMuted(isMuted) {
        this.muted = isMuted;
        localStorage.setItem(this.muteKey, String(isMuted));
        if (isMuted) {
            this.stopAll();
        }
    },

    isMuted() {
        return this.muted;
    },
};

window.WordOrderAudio = WordOrderAudio;
