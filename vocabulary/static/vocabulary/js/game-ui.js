/**
 * DOM layer: board rendering, modals, and wiring game logic to CMS-driven events.
 */
class MatchingGameUI {
    constructor(root) {
        this.root = root;
        this.unitId = root.dataset.unitId;
        this.homeUrl = root.dataset.homeUrl || '/';
        this.events = new GameEventPresenter();
        this.config = {
            roundSize: Number(root.dataset.roundSize) || 10,
            roundSeconds: Number(root.dataset.roundSeconds) || 60,
            roundBonus: Number(root.dataset.roundBonus) || 25,
            correctScore: 10,
            lifeCost: 50,
            roundPauseMs: 2200,
        };

        this.uzbekWords = document.getElementById('uzbekWords');
        this.englishWords = document.getElementById('englishWords');
        this.lives = document.getElementById('lives');
        this.score = document.getElementById('score');
        this.time = document.getElementById('time');
        this.message = document.getElementById('message');
        this.roundLabel = document.getElementById('roundLabel');
        this.progressPercent = document.getElementById('progressPercent');
        this.progressFill = document.getElementById('progressFill');
        this.eventBanner = document.getElementById('eventBanner');
        this.muteButton = document.getElementById('muteButton');

        this.roundModal = document.getElementById('roundModal');
        this.roundModalTitle = document.getElementById('roundModalTitle');
        this.roundModalMessage = document.getElementById('roundModalMessage');
        this.roundModalGif = document.getElementById('roundModalGif');

        this.gameOverModal = document.getElementById('gameOverModal');
        this.gameOverTitle = document.getElementById('gameOverTitle');
        this.gameOverMessage = document.getElementById('gameOverMessage');
        this.gameOverGif = document.getElementById('gameOverGif');
        this.gameOverScoreBig = document.getElementById('gameOverScoreBig');
        this.gameOverCorrect = document.getElementById('gameOverCorrect');
        this.gameOverIncorrect = document.getElementById('gameOverIncorrect');
        this.playAgainBtn = document.getElementById('playAgainBtn');
        this.continueBtn = document.getElementById('continueBtn');
        this.continueHint = document.getElementById('continueHint');

        this.victoryModal = document.getElementById('victoryModal');
        this.victoryTitle = document.getElementById('victoryTitle');
        this.victoryMessage = document.getElementById('victoryMessage');
        this.victoryGif = document.getElementById('victoryGif');
        this.victoryScoreBig = document.getElementById('victoryScoreBig');
        this.victoryCorrect = document.getElementById('victoryCorrect');
        this.victoryTime = document.getElementById('victoryTime');
        this.replayUnitBtn = document.getElementById('replayUnitBtn');

        this.timerExpiredModal = document.getElementById('timerExpiredModal');
        this.timerExpiredTitle = document.getElementById('timerExpiredTitle');
        this.timerExpiredMessage = document.getElementById('timerExpiredMessage');
        this.timerExpiredGif = document.getElementById('timerExpiredGif');
        this.retryRoundBtn = document.getElementById('retryRoundBtn');

        this.timerId = null;
        this.roundTransitionTimeoutId = null;
        this.timerWasRunning = false;
        this.words = [];
        this.game = null;

        this.bindControls();
        this.bindPageVisibility();
    }

    bindPageVisibility() {
        this.onVisibilityChange = () => {
            if (document.hidden) {
                this.pauseForBackground();
            } else {
                this.resumeFromBackground();
            }
        };

        document.addEventListener('visibilitychange', this.onVisibilityChange);
        window.addEventListener('pagehide', () => this.pauseForBackground());
    }

    bindControls() {
        this.playAgainBtn.addEventListener('click', () => this.start());
        this.replayUnitBtn.addEventListener('click', () => this.start());
        this.victoryHomeBtn = document.getElementById('victoryHomeBtn');
        if (this.victoryHomeBtn) {
            this.victoryHomeBtn.addEventListener('click', () => this.stopVictoryMedia());
        }
        this.retryRoundBtn.addEventListener('click', () => this.retryRound());
        this.continueBtn.addEventListener('click', () => this.purchaseLife());
        this.muteButton.addEventListener('click', () => {
            this.events.unlockAudio();
            this.toggleMute();
        });
    }

    async init() {
        this.showLoading(true);
        try {
            await this.loadGameEvents();
            const wordsResponse = await fetch(`/api/unit/${this.unitId}/words/`);

            if (!wordsResponse.ok) {
                throw new Error('Failed to load vocabulary.');
            }

            this.words = await wordsResponse.json();
            this.updateMuteButton();
            this.renderLives(3, 3);

            if (!this.words.length) {
                this.showMessage('No vocabulary words have been added to this unit yet.', 'danger');
                return;
            }

            this.start();
        } catch (error) {
            this.showMessage('Unable to start the game. Please refresh and try again.', 'danger');
        } finally {
            this.showLoading(false);
        }
    }

    showLoading(isLoading) {
        const overlay = document.getElementById('gameLoading');
        if (overlay) {
            overlay.hidden = !isLoading;
        }
    }

    async loadGameEvents() {
        try {
            await this.events.loadEvents();
        } catch (error) {
            this.events.events = {};
        }

        this.config.correctScore = this.events.config.correct_score || this.config.correctScore;
        this.config.lifeCost = this.events.config.life_cost || this.config.lifeCost;
        this.config.roundPauseMs = this.events.config.round_pause_ms || this.config.roundPauseMs;
    }

    start() {
        this.stopVictoryMedia();
        clearInterval(this.timerId);
        this.clearRoundTransitionTimeout();
        this.hideAllModals();
        if (typeof GameProgress !== 'undefined') {
            GameProgress.setLastUnit(this.unitId, {
                title: this.root.dataset.unitTitle,
                introUrl: this.root.dataset.introUrl,
            });
        }

        this.game = new MatchingGame(this.words, this.config, this.callbacks());
        this.game.loadRound(0);
    }

    stopVictoryMedia() {
        this.events.stopAllAudio();
        if (this.victoryGif) {
            this.victoryGif.hidden = true;
            this.victoryGif.removeAttribute('src');
        }
    }

    callbacks() {
        return {
            onRoundLoaded: (state) => this.handleRoundLoaded(state),
            onSelectionChange: (uzbekId, englishId) => this.updateSelection(uzbekId, englishId),
            onCorrect: (id, englishWord, state) => this.handleCorrect(id, englishWord, state),
            onIncorrect: (uzbekId, englishId, state) => this.handleIncorrect(uzbekId, englishId, state),
            onLifeLost: (state) => this.handleLifeLost(state),
            onNoLivesRemaining: (state) => this.showGameOverModal(state),
            onRoundComplete: (state) => this.handleRoundComplete(state),
            onTimerExpired: (state) => this.showTimerExpiredModal(state),
            onRoundRetry: (state) => this.handleRoundRetry(state),
            onUnitComplete: (state) => this.showVictoryModal(state),
            onTick: (state) => this.updateStats(state),
        };
    }

    handleRoundLoaded(state) {
        this.renderBoard(state.currentRoundWords);
        this.updateStats(state);
        this.updateProgress(state);
        this.enableBoard();
        this.showMessage('', '');
        this.hideEventBanner();
        this.startRoundTimer();
    }

    renderBoard(words) {
        this.uzbekWords.innerHTML = '';
        this.englishWords.innerHTML = '';

        const shuffledEnglish = this.shuffle([...words]);
        this.uzbekWords.style.setProperty('--round-count', words.length);
        this.englishWords.style.setProperty('--round-count', words.length);

        words.forEach((word) => {
            this.uzbekWords.appendChild(this.createWordButton('uzbek', word.id, word.uzbek));
        });

        shuffledEnglish.forEach((word) => {
            this.englishWords.appendChild(this.createWordButton('english', word.id, word.english));
        });
    }

    createWordButton(side, id, text) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'word-button';
        button.dataset.side = side;
        button.dataset.id = id;
        button.textContent = text;
        button.addEventListener('click', () => {
            if (document.hidden) {
                return;
            }
            this.events.unlockAudio();
            this.game.selectWord(side, id);
        });
        return button;
    }

    startRoundTimer() {
        if (document.hidden) {
            this.timerWasRunning = true;
            return;
        }

        clearInterval(this.timerId);
        this.timerId = setInterval(() => this.game.tick(), 1000);
        this.timerWasRunning = true;
    }

    stopRoundTimer() {
        clearInterval(this.timerId);
        this.timerId = null;
    }

    clearRoundTransitionTimeout() {
        if (this.roundTransitionTimeoutId) {
            clearTimeout(this.roundTransitionTimeoutId);
            this.roundTransitionTimeoutId = null;
        }
    }

    scheduleRoundAdvance() {
        this.clearRoundTransitionTimeout();
        this.roundTransitionTimeoutId = setTimeout(() => {
            this.roundTransitionTimeoutId = null;
            if (document.hidden) {
                return;
            }
            this.hideModal(this.roundModal);
            this.game.advanceAfterRound();
        }, this.config.roundPauseMs);
    }

    shouldRunTimer() {
        return this.game
            && !this.game.isFinished
            && !this.game.isRoundTransitioning
            && !this.game.isRoundFailed;
    }

    isModalOpen() {
        return [
            this.roundModal,
            this.gameOverModal,
            this.victoryModal,
            this.timerExpiredModal,
        ].some((modal) => modal && !modal.hidden);
    }

    pauseForBackground() {
        this.timerWasRunning = this.timerId !== null;
        this.stopRoundTimer();
        this.clearRoundTransitionTimeout();
        this.events.stopAllAudio();

        if (this.game && this.shouldRunTimer()) {
            this.disableBoard();
        }
    }

    resumeFromBackground() {
        if (!this.game) {
            return;
        }

        if (this.shouldRunTimer() && !this.isModalOpen()) {
            this.enableBoard();
            if (this.timerWasRunning) {
                this.startRoundTimer();
            }
        }

        if (this.game.isRoundTransitioning && !this.roundTransitionTimeoutId) {
            this.scheduleRoundAdvance();
        }
    }

    handleCorrect(id, englishWord, state) {
        this.updateStats(state);
        this.events.showGameEvent('correct_match', { bannerEl: this.eventBanner });
        this.speakEnglish(englishWord);

        this.buttonsForId(id).forEach((button) => {
            button.classList.remove('selected');
            button.classList.add('correct');
            setTimeout(() => button.classList.add('matched'), 160);
        });
    }

    handleIncorrect(uzbekId, englishId, state) {
        this.updateStats(state);
        this.events.showGameEvent('incorrect_match', { bannerEl: this.eventBanner });

        [uzbekId, englishId].forEach((id) => {
            this.buttonsForId(id).forEach((button) => {
                button.classList.remove('selected');
                button.classList.add('shake');
                setTimeout(() => button.classList.remove('shake'), 260);
            });
        });
    }

    handleLifeLost(state) {
        this.updateStats(state);
        this.events.showGameEvent('life_lost', { bannerEl: this.eventBanner });
    }

    handleRoundComplete(state) {
        this.stopRoundTimer();
        this.updateStats(state);
        this.updateProgress(state);
        this.disableBoard();
        this.showRoundCompleteModal(state);

        this.scheduleRoundAdvance();
    }

    showTimerExpiredModal(state) {
        this.stopRoundTimer();
        this.updateStats(state);
        this.disableBoard();
        this.events.showGameEvent('timer_expired', {
            titleEl: this.timerExpiredTitle,
            messageEl: this.timerExpiredMessage,
            gifEl: this.timerExpiredGif,
            bannerEl: this.eventBanner,
        });
        this.populateStats(this.timerExpiredModal, state);
        this.showModal(this.timerExpiredModal);
    }

    handleRoundRetry(state) {
        this.hideModal(this.timerExpiredModal);
        this.renderBoard(state.currentRoundWords);
        this.updateStats(state);
        this.enableBoard();
        this.hideEventBanner();
        this.startRoundTimer();
    }

    showRoundCompleteModal(state) {
        this.events.showGameEvent('round_completed', {
            titleEl: this.roundModalTitle,
            messageEl: this.roundModalMessage,
            gifEl: this.roundModalGif,
        });
        this.showModal(this.roundModal);
    }

    showGameOverModal(state) {
        this.stopRoundTimer();
        this.updateStats(state);
        this.disableBoard();
        this.events.showGameEvent('no_lives_remaining', {
            titleEl: this.gameOverTitle,
            messageEl: this.gameOverMessage,
            gifEl: this.gameOverGif,
        });
        this.populateStats(this.gameOverModal, state);
        this.updateContinueButton(state);
        this.showModal(this.gameOverModal);
    }

    showVictoryModal(state) {
        this.stopRoundTimer();
        this.updateStats(state);
        this.updateProgress({
            ...state,
            completedRounds: state.totalRounds,
            progressPercent: 100,
        });
        this.disableBoard();
        this.events.showGameEvent('unit_completed', {
            titleEl: this.victoryTitle,
            messageEl: this.victoryMessage,
            gifEl: this.victoryGif,
        });
        this.populateStats(this.victoryModal, state);
        if (this.victoryTime) {
            this.victoryTime.textContent = this.formatElapsed(state.elapsedSeconds);
        }

        if (typeof GameProgress !== 'undefined') {
            const result = GameProgress.recordVictory(this.unitId, state);
            GameProgress.renderStars(document.getElementById('victoryStars'), result.stars);
        }

        const nextUnitBtn = document.getElementById('nextUnitBtn');
        if (nextUnitBtn) {
            const nextUrl = this.root.dataset.nextUnitUrl;
            if (nextUrl) {
                nextUnitBtn.href = nextUrl;
                nextUnitBtn.hidden = false;
            } else {
                nextUnitBtn.hidden = true;
            }
        }

        this.showModal(this.victoryModal);
    }

    purchaseLife() {
        if (!this.game.purchaseLife()) {
            this.updateContinueButton(this.game.getState());
            return;
        }

        this.events.showGameEvent('continue_game', { bannerEl: this.eventBanner });
        this.hideModal(this.gameOverModal);
        this.updateStats(this.game.getState());
        this.enableBoard();
        this.startRoundTimer();
    }

    updateContinueButton(state) {
        const canContinue = state.canPurchaseLife;
        this.continueBtn.disabled = !canContinue;
        this.continueHint.hidden = canContinue;
        this.continueHint.textContent = `You need ${state.lifeCost} points to buy another life.`;
        this.continueBtn.textContent = canContinue
            ? `Continue Using Score (-${state.lifeCost})`
            : 'Continue Using Score';
    }

    populateStats(modal, state) {
        const scoreEl = modal.querySelector('[data-stat="score"]');
        const roundsEl = modal.querySelector('[data-stat="rounds"]');
        const correctEl = modal.querySelector('[data-stat="correct"]');
        const incorrectEl = modal.querySelector('[data-stat="incorrect"]');

        if (scoreEl) {
            scoreEl.textContent = state.score;
        }
        if (roundsEl) {
            roundsEl.textContent = state.completedRounds;
        }
        if (correctEl) {
            correctEl.textContent = state.correctMatches;
        }
        if (incorrectEl) {
            incorrectEl.textContent = state.incorrectMatches;
        }

        if (modal === this.gameOverModal) {
            if (this.gameOverScoreBig) {
                this.gameOverScoreBig.textContent = state.score;
            }
            if (this.gameOverCorrect) {
                this.gameOverCorrect.textContent = state.correctMatches;
            }
            if (this.gameOverIncorrect) {
                this.gameOverIncorrect.textContent = state.incorrectMatches;
            }
        }
        if (modal === this.victoryModal) {
            if (this.victoryScoreBig) {
                this.victoryScoreBig.textContent = state.score;
            }
            if (this.victoryCorrect) {
                this.victoryCorrect.textContent = state.correctMatches;
            }
        }
    }

    retryRound() {
        this.game.retryRound();
    }

    updateSelection(uzbekId, englishId) {
        document.querySelectorAll('.word-button').forEach((button) => {
            const id = Number(button.dataset.id);
            const isSelected = (button.dataset.side === 'uzbek' && id === uzbekId)
                || (button.dataset.side === 'english' && id === englishId);
            button.classList.toggle('selected', isSelected);
        });
    }

    updateStats(state) {
        this.renderLives(state.lives, state.maxLives);
        this.score.textContent = state.score;
        this.time.textContent = state.remainingSeconds;
    }

    renderLives(currentLives, maxLives) {
        const lives = Math.max(currentLives, 0);
        this.lives.innerHTML = '';

        for (let index = 0; index < maxLives; index += 1) {
            const heart = document.createElement('span');
            heart.className = index < lives ? 'life-icon is-full' : 'life-icon is-empty';
            heart.setAttribute('aria-hidden', 'true');
            heart.textContent = '♥';
            this.lives.appendChild(heart);
        }

        const livesStat = this.lives.closest('.stat-lives');
        if (livesStat) {
            livesStat.setAttribute('aria-label', `Lives: ${lives} of ${maxLives}`);
        }
    }

    updateProgress(state) {
        this.roundLabel.textContent = `Round ${state.currentRoundNumber} / ${state.totalRounds}`;
        this.progressPercent.textContent = `${state.progressPercent}%`;
        this.progressFill.style.width = `${state.progressPercent}%`;
    }

    enableBoard() {
        document.querySelectorAll('.word-button').forEach((button) => {
            button.disabled = false;
        });
    }

    disableBoard() {
        document.querySelectorAll('.word-button').forEach((button) => {
            button.disabled = true;
        });
    }

    showModal(modal) {
        if (!modal) {
            return;
        }
        modal.hidden = false;
        document.body.classList.add('modal-open');
    }

    hideModal(modal) {
        if (!modal) {
            return;
        }
        modal.hidden = true;
        if (!this.isModalOpen()) {
            document.body.classList.remove('modal-open');
        }
    }

    hideAllModals() {
        [
            this.roundModal,
            this.gameOverModal,
            this.victoryModal,
            this.timerExpiredModal,
        ].forEach((modal) => this.hideModal(modal));
        document.body.classList.remove('modal-open');
    }

    hideEventBanner() {
        if (!this.eventBanner) {
            return;
        }

        this.eventBanner.classList.add('is-empty');
        const heading = this.eventBanner.querySelector('[data-event-title]');
        const body = this.eventBanner.querySelector('[data-event-message]');
        if (heading) {
            heading.textContent = '';
        }
        if (body) {
            body.textContent = '';
        }
    }

    buttonsForId(id) {
        return document.querySelectorAll(`.word-button[data-id="${id}"]`);
    }

    showMessage(text, type) {
        this.message.textContent = text;
        this.message.className = `message ${type}`.trim();
    }

    toggleMute() {
        this.events.setMuted(!this.events.isMuted());
        this.updateMuteButton();
    }

    updateMuteButton() {
        const muted = this.events.isMuted();
        this.muteButton.setAttribute('aria-pressed', String(muted));
        this.muteButton.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');

        const soundOn = this.muteButton.querySelector('.icon-sound-on');
        const soundOff = this.muteButton.querySelector('.icon-sound-off');
        if (soundOn) {
            soundOn.hidden = muted;
        }
        if (soundOff) {
            soundOff.hidden = !muted;
        }
    }

    speakEnglish(word) {
        if (document.hidden || this.events.isMuted() || !('speechSynthesis' in window)) {
            return;
        }

        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'en-US';
        window.speechSynthesis.speak(utterance);
    }

    formatElapsed(totalSeconds) {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${String(seconds).padStart(2, '0')}`;
    }

    shuffle(items) {
        for (let index = items.length - 1; index > 0; index -= 1) {
            const randomIndex = Math.floor(Math.random() * (index + 1));
            [items[index], items[randomIndex]] = [items[randomIndex], items[index]];
        }
        return items;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const root = document.querySelector('.game');
    if (root) {
        new MatchingGameUI(root).init();
    }
});
