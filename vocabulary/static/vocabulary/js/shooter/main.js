/**
 * Boot Phaser and wire HTML overlay controls.
 */
(function initShooter() {
    const root = document.getElementById('shooterRoot');
    if (!root) {
        return;
    }

    const unitId = root.dataset.unitId || null;
    const wordsApiUrl = root.dataset.wordsApiUrl || '';
    const homeUrl = root.dataset.homeUrl || '/';
    const unitIntroUrl = root.dataset.unitIntroUrl || '/';

    if (window.ShooterAudio) {
        ShooterAudio.init({
            laser: root.dataset.soundLaser || '',
            explosion: root.dataset.soundExplosion || '',
            wordFall: root.dataset.soundWordFall || '',
            wrong: root.dataset.soundWrong || '',
            gameOver: root.dataset.soundGameOver || '',
        });
    }

    let game = null;

    function updateMuteButton() {
        if (!window.ShooterAudio) {
            return;
        }

        const muted = ShooterAudio.isMuted();
        [document.getElementById('shooterMuteBtn'), document.getElementById('shooterMuteBtnMobile')].forEach((muteBtn) => {
            if (!muteBtn) {
                return;
            }
            muteBtn.setAttribute('aria-pressed', String(muted));
            muteBtn.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
            muteBtn.querySelector('.icon-sound-on')?.toggleAttribute('hidden', muted);
            muteBtn.querySelector('.icon-sound-off')?.toggleAttribute('hidden', !muted);
        });
    }

    function toggleMute() {
        unlockAudio();
        ShooterAudio?.setMuted(!ShooterAudio.isMuted());
        updateMuteButton();
    }

    function unlockAudio() {
        ShooterAudio?.unlock();
    }

    function isMobileLayout() {
        return window.matchMedia('(max-width: 640px)').matches;
    }

    function getKeyboardHeight() {
        const keyboard = document.getElementById('shooterKeyboard');
        if (!keyboard || keyboard.hidden) {
            return 0;
        }
        return keyboard.offsetHeight || 0;
    }

    function getCanvasSize() {
        const stage = document.getElementById('shooterStage');
        if (isMobileLayout() && stage) {
            return {
                width: Math.max(320, stage.clientWidth),
                height: Math.max(280, stage.clientHeight),
            };
        }

        const width = stage ? stage.clientWidth : Math.min(900, window.innerWidth);
        const height = stage ? stage.clientHeight : Math.min(620, window.innerHeight - 160);
        return {
            width: Math.max(320, width),
            height: Math.max(360, height),
        };
    }

    function getScene() {
        if (!game) {
            return null;
        }
        return game.scene.getScene('GameScene');
    }

    function resizeGame() {
        if (!game) {
            return;
        }
        const { width, height } = getCanvasSize();
        game.scale.resize(width, height);
        getScene()?.onResize();
    }

    function setPauseMenuOpen(open) {
        const menu = document.getElementById('shooterPauseMenu');
        const pauseBtn = document.getElementById('shooterPauseBtn');
        if (!menu) {
            return;
        }

        menu.hidden = !open;
        if (pauseBtn) {
            pauseBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        }

        if (open) {
            getScene()?.setPaused(true);
        } else {
            getScene()?.setPaused(false);
        }
    }

    function setupMobileChrome() {
        const keyboard = document.getElementById('shooterKeyboard');
        if (!isMobileLayout() || !keyboard) {
            return;
        }

        keyboard.hidden = false;
    }

    async function bootGame() {
        if (game) {
            game.destroy(true);
            game = null;
        }

        setupMobileChrome();

        const words = await loadShooterWords(unitId, wordsApiUrl);
        const { width, height } = getCanvasSize();

        game = new Phaser.Game({
            type: Phaser.AUTO,
            parent: 'shooterGame',
            width,
            height,
            backgroundColor: '#0f1a2e',
            scale: {
                mode: Phaser.Scale.FIT,
                autoCenter: Phaser.Scale.CENTER_BOTH,
            },
            scene: [GameScene],
        });

        game.scene.start('GameScene', {
            unitId,
            wordsApiUrl,
            homeUrl,
            unitIntroUrl,
            words,
        });

        if (typeof initShooterKeyboard === 'function') {
            initShooterKeyboard(getScene);
        }

        window.requestAnimationFrame(resizeGame);
    }

    document.getElementById('shooterRestartBtn')?.addEventListener('click', () => {
        const activeScene = getScene();
        if (activeScene) {
            activeScene.restartGame();
        } else {
            bootGame();
        }
    });

    document.getElementById('shooterContinueBtn')?.addEventListener('click', () => {
        getScene()?.continueAfterGameOver();
    });

    document.getElementById('shooterMuteBtn')?.addEventListener('click', toggleMute);
    document.getElementById('shooterMuteBtnMobile')?.addEventListener('click', toggleMute);

    document.getElementById('shooterPauseBtn')?.addEventListener('click', () => {
        setPauseMenuOpen(true);
    });

    document.getElementById('shooterPauseBtnDesktop')?.addEventListener('click', () => {
        setPauseMenuOpen(true);
    });

    document.getElementById('shooterResumeBtn')?.addEventListener('click', () => {
        setPauseMenuOpen(false);
    });

    document.getElementById('shooterPauseMenu')?.addEventListener('click', (event) => {
        if (event.target.id === 'shooterPauseMenu') {
            setPauseMenuOpen(false);
        }
    });

    window.addEventListener('resize', resizeGame);

    document.getElementById('shooterStage')?.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    updateMuteButton();
    bootGame();
})();
