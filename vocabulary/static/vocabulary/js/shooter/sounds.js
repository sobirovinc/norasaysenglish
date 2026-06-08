/**
 * Spelling shooter sound effects.
 */
const ShooterAudio = {
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
            laser: 0.5,
            explosion: 0.75,
            wordFall: 0.7,
            wrong: 0.65,
            gameOver: 0.8,
        };
        audio.volume = volumes[name] ?? 0.7;

        const track = audio;
        this.active.push(track);
        const cleanup = () => {
            this.active = this.active.filter((item) => item !== track);
        };
        audio.addEventListener('ended', cleanup);
        audio.addEventListener('error', cleanup);

        audio.play().catch(() => {
            cleanup();
        });

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

window.ShooterAudio = ShooterAudio;
