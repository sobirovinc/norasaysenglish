/**
 * Main Phaser scene — spelling shooter gameplay.
 */
class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
        this.enemies = [];
        this.activeTarget = null;
        this.isPaused = false;
        this.isGameOver = false;
        this.hasWon = false;
        this.bottomMargin = 48;
        this.maxEnemies = 6;
        this.isMobileLayout = window.matchMedia('(max-width: 640px)').matches;
        this.introHintDismissed = false;
        this.defaultHint = this.isMobileLayout
            ? 'Tap the letters below to spell each word.'
            : 'Type the English spelling — no clicking required. Focus on accuracy, not speed.';
    }

    init(data) {
        this.unitId = data.unitId;
        this.wordsApiUrl = data.wordsApiUrl;
        this.homeUrl = data.homeUrl;
        this.unitIntroUrl = data.unitIntroUrl;
        this.words = data.words || [];
    }

    create() {
        this.scoreManager = new ScoreManager();
        this.wordManager = new WordManager(this.words);

        this.cameras.main.setBackgroundColor('#0f1a2e');
        this.createHud();
        this.bindKeyboard();

        const hint = document.getElementById('shooterHint');
        if (hint) {
            hint.textContent = this.defaultHint;
        }

        if (!this.words.length) {
            this.setChromeVisible(false);
            this.showOverlay('empty');
            return;
        }

        for (let i = 0; i < 2; i += 1) {
            this.spawnEnemy();
        }
        this.updateHud();
        this.onResize();
    }

    createHud() {
        this.hudScore = this.add.text(16, 12, '', {
            fontFamily: 'Nunito, Arial, sans-serif',
            fontSize: '20px',
            color: '#ffffff',
            fontStyle: 'bold',
        }).setScrollFactor(0).setDepth(100);

        this.hudStats = this.add.text(16, 38, '', {
            fontFamily: 'Nunito, Arial, sans-serif',
            fontSize: '14px',
            color: '#a8b8d0',
        }).setScrollFactor(0).setDepth(100);

        this.hudTitle = this.add.text(this.scale.width - 16, 12, 'Spelling Shooter', {
            fontFamily: 'Nunito, Arial, sans-serif',
            fontSize: '14px',
            color: '#6b8cae',
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);

        this.statsBar = document.getElementById('shooterStatsBar');

        if (this.isMobileLayout) {
            this.hudScore.setFontSize('17px');
            this.hudStats.setFontSize('11px');
            this.hudTitle.setVisible(false);
            this.bottomMargin = 44;
        } else {
            this.hudScore.setVisible(false);
            this.hudStats.setVisible(false);
            this.hudTitle.setVisible(false);
        }

        this.mobileToast = document.getElementById('shooterMobileToast');
        if (this.mobileToast && this.isMobileLayout) {
            this.mobileToast.textContent = this.defaultHint;
            this.mobileToast.classList.add('is-visible');
        }
    }

    updateHud() {
        const sm = this.scoreManager;
        const scoreText = `Score: ${sm.score}`;
        const statsText = (
            `Mistakes: ${sm.mistakes}/${sm.maxMistakes}  ·  `
            + `Fallen: ${sm.fallenWords}/${sm.maxFallen}  ·  `
            + `Done: ${sm.wordsDestroyed}/${this.words.length}`
        );

        if (this.isMobileLayout) {
            this.hudScore.setText(scoreText);
            this.hudStats.setText(statsText);
            return;
        }

        const scoreEl = document.getElementById('shooterStatScore');
        const mistakesEl = document.getElementById('shooterStatMistakes');
        const fallenEl = document.getElementById('shooterStatFallen');
        const doneEl = document.getElementById('shooterStatDone');

        if (scoreEl) {
            scoreEl.textContent = scoreText;
        }
        if (mistakesEl) {
            mistakesEl.textContent = `Mistakes: ${sm.mistakes}/${sm.maxMistakes}`;
        }
        if (fallenEl) {
            fallenEl.textContent = `Fallen: ${sm.fallenWords}/${sm.maxFallen}`;
        }
        if (doneEl) {
            doneEl.textContent = `Done: ${sm.wordsDestroyed}/${this.words.length}`;
        }
    }

    bindKeyboard() {
        if (!this.isMobileLayout) {
            this.inputHandler = (event) => {
                if (this.isPaused || this.isGameOver || this.hasWon) {
                    return;
                }

                if (event.repeat) {
                    return;
                }

                const key = event.key;
                if (!key || key.length !== 1 || !/^[a-zA-Z]$/.test(key)) {
                    return;
                }

                event.preventDefault();
                ShooterAudio.unlock();
                this.handleLetter(key.toLowerCase());
            };

            window.addEventListener('keydown', this.inputHandler);
        }
    }

    dismissIntroHint() {
        if (!this.isMobileLayout || this.introHintDismissed) {
            return;
        }

        this.introHintDismissed = true;
        if (this.mobileToast) {
            this.mobileToast.textContent = '';
            this.mobileToast.classList.remove('is-visible');
        }
    }

    handleLetter(letter) {
        this.dismissIntroHint();

        const target = this.wordManager.findTargetByLetter(
            letter,
            this.enemies,
            this.activeTarget,
        );

        if (!target) {
            return;
        }

        this.activeTarget = target;
        const expected = target.english[target.typedLength];

        if (letter === expected) {
            this.handleCorrect(target);
        } else {
            this.handleWrong(target);
        }
    }

    handleCorrect(target) {
        target.typeLetter();
        this.scoreManager.addCorrectChar();
        target.slowDown();
        target.pulseCorrect();
        ShooterEffects.spawnLaser(this, target);
        ShooterEffects.moveShipTo(this, target.x);
        this.updateHud();

        if (target.typedLength >= target.english.length) {
            this.completeEnemy(target);
        }
    }

    handleWrong(target) {
        this.scoreManager.addMistake();
        target.speedUp();
        target.flashWrong();
        ShooterAudio.play('wrong');
        this.flashHint('Mistake! Keep typing the same word.');
        this.updateHud();
        this.checkEndState();
    }

    completeEnemy(target) {
        this.activeTarget = null;
        this.scoreManager.addDestroyedWord();
        this.wordManager.markCompleted(target.wordId);

        const index = this.enemies.indexOf(target);
        if (index >= 0) {
            this.enemies.splice(index, 1);
        }

        ShooterEffects.spawnExplosion(this, target);
        target.destroyQuietly();

        this.enemies.forEach((enemy) => enemy.slowDown());
        this.updateHud();

        if (this.wordManager.isComplete()) {
            this.triggerVictory();
        }
    }

    spawnEnemy() {
        if (this.enemies.length >= this.maxEnemies) {
            return;
        }

        const word = this.wordManager.nextSpawnable(this.enemies);
        if (!word) {
            return;
        }

        const padding = this.isMobileLayout ? 56 : 80;
        const x = Phaser.Math.Between(padding, Math.max(padding + 1, this.scale.width - padding));
        const enemy = new Enemy(this, word, x, -50);
        this.enemies.push(enemy);
    }

    shouldSpawn() {
        if (this.wordManager.isComplete()) {
            return false;
        }
        if (this.enemies.length >= this.maxEnemies) {
            return false;
        }
        if (!this.wordManager.nextSpawnable(this.enemies)) {
            return false;
        }

        if (!this.enemies.length) {
            return true;
        }

        const highestY = Math.min(...this.enemies.map((enemy) => enemy.y));
        const threshold = this.scale.height * 0.10;
        return highestY >= threshold;
    }

    update(time, delta) {
        if (this.isPaused || this.isGameOver || this.hasWon || !this.words.length) {
            return;
        }

        const trackTarget = this.activeTarget
            || this.enemies.find((enemy) => !enemy.isDestroyed)
            || null;
        if (trackTarget) {
            ShooterEffects.moveShipTo(this, trackTarget.x);
        }

        for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
            const enemy = this.enemies[i];
            enemy.update(delta);

            if (enemy.y >= this.scale.height - this.bottomMargin) {
                this.enemies.splice(i, 1);
                this.scoreManager.addFallen();
                if (this.activeTarget === enemy) {
                    this.activeTarget = null;
                }
                enemy.destroyQuietly();
                ShooterAudio.play('wordFall');
                this.flashHint('Word reached the bottom!');
                this.updateHud();
                this.checkEndState();
            }
        }

        if (this.shouldSpawn()) {
            this.spawnEnemy();
        }
    }

    checkEndState() {
        if (this.scoreManager.isGameOver()) {
            this.triggerGameOver();
        }
    }

    triggerGameOver() {
        this.isGameOver = true;
        this.isPaused = true;
        ShooterAudio.play('gameOver');
        this.showOverlay('gameover');
    }

    triggerVictory() {
        this.hasWon = true;
        this.isPaused = true;
        ShooterAudio.play('gameOver');  // reuse — swap for a win sound if you add one
        this.showVictoryModal();
    }

    showVictoryModal() {
        const modal = document.getElementById('shooterVictoryModal');
        if (!modal) { this.showOverlay('victory'); return; }

        const sm = this.scoreManager;

        // Populate stats
        const scoreEl    = document.getElementById('shooterVictoryScore');
        const wordsEl    = document.getElementById('shooterVictoryWords');
        const mistakesEl = document.getElementById('shooterVictoryMistakes');
        const starsEl    = document.getElementById('shooterVictoryStars');

        if (scoreEl)    scoreEl.textContent    = sm.score;
        if (wordsEl)    wordsEl.textContent     = sm.wordsDestroyed;
        if (mistakesEl) mistakesEl.textContent  = sm.mistakes;

        // Stars: 3 = no mistakes, 2 = ≤3 mistakes, 1 = more
        if (starsEl) {
            const earned = sm.mistakes === 0 ? 3 : sm.mistakes <= 3 ? 2 : 1;
            starsEl.innerHTML = [1,2,3].map(n =>
                `<span class="star ${n <= earned ? 'is-earned' : ''}">★</span>`
            ).join('');
        }

        // Replay button
        const replayBtn = document.getElementById('shooterVictoryReplay');
        if (replayBtn) {
            replayBtn.onclick = () => {
                modal.hidden = true;
                this.restartGame();
            };
        }

        this.setChromeVisible(false);
        modal.hidden = false;
    }

    flashHint(message) {
        const hint = this.isMobileLayout
            ? this.mobileToast
            : document.getElementById('shooterHint');
        if (!hint) {
            return;
        }

        hint.textContent = message;
        if (this.isMobileLayout) {
            hint.classList.add('is-visible');
        }

        this.time.delayedCall(900, () => {
            if (!this.isGameOver && !this.hasWon && hint === this.mobileToast) {
                hint.classList.remove('is-visible');
                hint.textContent = '';
                return;
            }

            if (!this.isGameOver && !this.hasWon) {
                hint.textContent = this.defaultHint;
            }
        });
    }

    setPaused(paused) {
        this.isPaused = paused;
    }

    setChromeVisible(visible) {
        const pauseBtn = document.getElementById('shooterPauseBtn');
        const keyboard = document.getElementById('shooterKeyboard');
        const muteBtnMobile = document.getElementById('shooterMuteBtnMobile');
        if (pauseBtn) {
            pauseBtn.hidden = !visible;
        }
        if (muteBtnMobile) {
            muteBtnMobile.hidden = !visible;
        }
        if (keyboard && this.isMobileLayout) {
            keyboard.hidden = !visible;
        }
        if (this.mobileToast && this.isMobileLayout) {
            if (!visible || this.introHintDismissed) {
                this.mobileToast.classList.remove('is-visible');
            } else {
                this.mobileToast.classList.add('is-visible');
            }
        }
    }

    showOverlay(type) {
        const overlay = document.getElementById('shooterOverlay');
        if (!overlay) {
            return;
        }

        overlay.dataset.state = type;
        overlay.hidden = false;
        this.setChromeVisible(false);

        const titleEl = document.getElementById('shooterOverlayTitle');
        const scoreEl = document.getElementById('shooterOverlayScore');
        const messageEl = document.getElementById('shooterOverlayMessage');
        const continueBtn = document.getElementById('shooterContinueBtn');
        const restartBtn = document.getElementById('shooterRestartBtn');

        if (titleEl) {
            const titles = {
                gameover: 'Game Over',
                victory: 'Unit Complete!',
                empty: 'No Words',
            };
            titleEl.textContent = titles[type] || 'Game Over';
        }

        if (scoreEl) {
            scoreEl.textContent = this.scoreManager.score;
        }

        if (messageEl) {
            const messages = {
                gameover: 'Too many mistakes or fallen words.',
                victory: 'You spelled every word in this unit!',
                empty: 'No words available for this unit.',
            };
            messageEl.textContent = messages[type] || '';
        }

        if (continueBtn) {
            const canContinue = type === 'gameover' && this.scoreManager.canContinue();
            continueBtn.hidden = type !== 'gameover';
            continueBtn.disabled = !canContinue;
            const hint = document.getElementById('shooterContinueHint');
            if (hint) {
                hint.hidden = canContinue || type !== 'gameover';
                hint.textContent = `You need ${this.scoreManager.continueCost} points to continue.`;
            }
        }

        if (restartBtn) {
            restartBtn.hidden = type === 'empty';
        }
    }

    hideOverlay() {
        const overlay = document.getElementById('shooterOverlay');
        if (overlay) {
            overlay.hidden = true;
        }
        if (!this.isGameOver && !this.hasWon) {
            this.setChromeVisible(true);
        }
    }

    onResize() {
        const trackTarget = this.activeTarget
            || this.enemies.find((enemy) => !enemy.isDestroyed)
            || null;
        if (trackTarget) {
            ShooterEffects.moveShipTo(this, trackTarget.x);
        } else {
            ShooterEffects.moveShipTo(this, this.scale.width / 2);
        }
    }

    restartGame() {
        this.enemies.forEach((enemy) => enemy.destroyQuietly());
        this.enemies = [];
        this.activeTarget = null;
        this.isPaused = false;
        this.isGameOver = false;
        this.hasWon = false;
        this.scoreManager.reset();
        this.wordManager = new WordManager(this.words);
        this.introHintDismissed = false;
        this.hideOverlay();
        for (let i = 0; i < 2; i += 1) {
            this.spawnEnemy();
        }
        this.updateHud();
        this.onResize();
        if (this.mobileToast && this.isMobileLayout) {
            this.mobileToast.textContent = this.defaultHint;
            this.mobileToast.classList.add('is-visible');
        }
    }

    continueAfterGameOver() {
        if (!this.scoreManager.continueGame()) {
            this.showOverlay('gameover');
            return;
        }

        this.isGameOver = false;
        this.isPaused = false;
        this.activeTarget = null;
        this.hideOverlay();
        this.updateHud();
        if (this.shouldSpawn()) {
            this.spawnEnemy();
        }
        this.flashHint('Continued! Keep spelling.');
    }

    shutdown() {
        if (this.inputHandler) {
            window.removeEventListener('keydown', this.inputHandler);
        }
    }
}

window.GameScene = GameScene;
