/**
 * DOM rendering, animations, and input for the Word Order game.
 * Card scene mirrors vocabulary study flashcards (#interactiveCard).
 */
class WordOrderUI {
    constructor(root, game) {
        this.root = root;
        this.game = game;
        this.pendingRoundIndex = 0;
        this.elements = this.collectElements();
        this.autoAdvanceTimer = null;
        this._swipeDragging = false;
        this._swipeStartX = 0;
        this._swipeStartY = 0;
        this._swipeMoveX = 0;
        this._isAnimating = false;
        this.SWIPE_THRESHOLD = 90;
        this.bindEvents();
        this.bindGameEvents();
    }

    collectElements() {
        return {
            difficultyScreen: document.getElementById('woDifficultyScreen'),
            gameScreen: document.getElementById('woGameScreen'),
            loading: document.getElementById('woLoading'),
            emptyState: document.getElementById('woEmptyState'),
            difficultyButtons: this.root.querySelectorAll('[data-difficulty]'),
            roundLabel: document.getElementById('woRoundLabel'),
            progressFill: document.getElementById('woProgressFill'),
            progressPercent: document.getElementById('woProgressPercent'),
            lives: document.getElementById('woLives'),
            score: document.getElementById('woScore'),
            timer: document.getElementById('woTimer'),
            timerWrap: document.getElementById('woTimerWrap'),
            mastery: document.getElementById('woMastery'),
            cardStage: document.getElementById('woCardStage'),
            card: document.getElementById('woSentenceCard'),
            sentenceArea: document.getElementById('woSentenceArea'),
            wordBank: document.getElementById('woWordBank'),
            translationHint: document.getElementById('woTranslationHint'),
            swipeHintLeft: document.getElementById('woSwipeHintLeft'),
            swipeHintRight: document.getElementById('woSwipeHintRight'),
            hintButtons: this.root.querySelectorAll('[data-hint]'),
            speakEnglishBtn: document.getElementById('woSpeakEnglish'),
            nextSentenceBtn: document.getElementById('woNextSentence'),
            completedEnglish: document.getElementById('woCompletedEnglish'),
            completedUzbek: document.getElementById('woCompletedUzbek'),
            muteButton: document.getElementById('woMuteButton'),
            roundCompleteModal: document.getElementById('woRoundCompleteModal'),
            gameOverModal: document.getElementById('woGameOverModal'),
            unitCompleteModal: document.getElementById('woUnitCompleteModal'),
            hintToggle: document.getElementById('woHintToggle'),
            hintDropdown: document.getElementById('woHintDropdown'),
        };
    }

    bindEvents() {
        this.elements.hintToggle?.addEventListener('click', () => {
            const open = !this.elements.hintDropdown.hidden;
            this.elements.hintDropdown.hidden = open;
            this.elements.hintToggle.setAttribute('aria-expanded', String(!open));
        });
        document.addEventListener('click', (event) => {
            if (!this.elements.hintToggle?.contains(event.target)
                && !this.elements.hintDropdown?.contains(event.target)) {
                if (this.elements.hintDropdown) {
                    this.elements.hintDropdown.hidden = true;
                }
                this.elements.hintToggle?.setAttribute('aria-expanded', 'false');
            }
        });

        this.elements.difficultyButtons.forEach((button) => {
            button.addEventListener('click', () => {
                WordOrderAudio.unlock();
                this.startGame(button.dataset.difficulty);
            });
        });

        this.elements.hintButtons.forEach((button) => {
            button.addEventListener('click', () => {
                const result = this.game.useHint(button.dataset.hint);
                if (result?.type === 'insufficient') {
                    this.flashMessage('Not enough points for that hint.');
                }
                if (this.elements.hintDropdown) {
                    this.elements.hintDropdown.hidden = true;
                }
                this.elements.hintToggle?.setAttribute('aria-expanded', 'false');
            });
        });

        this.elements.nextSentenceBtn?.addEventListener('click', (event) => {
            event.stopPropagation();
            this.slideAndAdvance('left');
        });
        this.elements.speakEnglishBtn?.addEventListener('click', (event) => {
            event.stopPropagation();
            if (this.game.currentSentence) {
                VocabSpeech.speakEnglish(this.game.currentSentence.raw.english);
            }
        });

        this.root.querySelectorAll('[data-action="retry-round"]').forEach((button) => {
            button.addEventListener('click', () => {
                this.closeModals();
                this.game.retryRound();
            });
        });
        this.root.querySelectorAll('[data-action="next-round"]').forEach((button) => {
            button.addEventListener('click', () => {
                this.closeModals();
                this.pendingRoundIndex = this.game.currentRoundIndex + 1;
                this.showDifficultyPicker();
            });
        });
        this.root.querySelectorAll('[data-action="home"]').forEach((button) => {
            button.addEventListener('click', () => {
                window.location.href = this.root.dataset.homeUrl;
            });
        });

        this.elements.muteButton?.addEventListener('click', () => this.toggleMute());
        this.setupSwipe();
    }

    bindGameEvents() {
        this.game.on('sentenceLoaded', (payload) => this.renderSentence(payload));
        this.game.on('wordCorrect', (payload) => this.onWordCorrect(payload));
        this.game.on('wordWrong', (payload) => this.onWordWrong(payload));
        this.game.on('wordAutoPlaced', () => this.onWordAutoPlaced());
        this.game.on('lifeLost', () => this.onLifeLost());
        this.game.on('scoreChanged', (payload) => this.updateScore(payload.score));
        this.game.on('timerTick', (payload) => this.updateTimer(payload.remaining));
        this.game.on('sentenceComplete', (payload) => this.onSentenceComplete(payload));
        this.game.on('hintNextWord', (payload) => this.highlightHintWord(payload.bankId));
        this.game.on('hintTranslation', (payload) => this.showTranslation(payload.text));
        this.game.on('hintRevealAnswer', () => {
            this.renderSentenceArea(this.game.currentSentence);
            this.renderWordBank(this.game.currentSentence);
        });
        this.game.on('timerExpired', () => {
            WordOrderAudio.play('timer_expired');
            this.elements.card?.classList.add('is-timed-out');
            this.renderSentenceArea(this.game.currentSentence);
        });
        this.game.on('roundComplete', (stats) => this.showRoundComplete(stats));
        this.game.on('gameOver', (stats) => this.showGameOver(stats));
        this.game.on('unitComplete', (stats) => this.showUnitComplete(stats));
    }

    async init() {
        this.showLoading(true);
        try {
            const count = await this.game.loadSentences();
            this.showLoading(false);
            if (!count) {
                this.elements.emptyState.hidden = false;
                this.elements.difficultyScreen.hidden = true;
                return;
            }
            this.elements.emptyState.hidden = true;
            this.elements.difficultyScreen.hidden = false;
            this.updateRoundLabel(1, this.game.totalRounds);
        } catch (error) {
            this.showLoading(false);
            this.elements.emptyState.hidden = false;
            this.elements.emptyState.querySelector('p').textContent = 'Could not load sentences. Please try again.';
        }
    }

    showLoading(isLoading) {
        this.elements.loading.hidden = !isLoading;
    }

    startGame(difficultyId) {
        this.game.setDifficulty(difficultyId);
        this.elements.difficultyScreen.hidden = true;
        this.elements.gameScreen.hidden = false;
        document.body.classList.add('wo-playing');
        this.updateMuteButton();
        this.game.startRound(this.pendingRoundIndex);
        this.pendingRoundIndex = 0;
    }

    showDifficultyPicker() {
        this.elements.gameScreen.hidden = true;
        this.elements.difficultyScreen.hidden = false;
        document.body.classList.remove('wo-playing');
    }

    canSwipeCard() {
        if (this.game.difficulty?.autoAdvance || this._isAnimating) {
            return false;
        }
        if (!this.game.awaitingAdvance) {
            return false;
        }
        const state = this.game.currentSentence;
        return Boolean(
            state?.answerRevealed
            || this.game.timedOutThisSentence
            || state?.tokens.every((token) => token.placed),
        );
    }

    renderSentence(payload) {
        const { state, showSwipeHint, difficulty } = payload;
        this.clearAutoAdvance();
        this.resetCardVisuals();
        this.renderSentenceArea(state);
        this.renderWordBank(state);
        this.updateHud();
        this.updateProgress();
        this.elements.translationHint.hidden = !state.translationVisible;
        if (state.translationVisible) {
            this.elements.translationHint.textContent = state.raw.uzbek;
        }
        if (this.elements.hintToggle) {
            this.elements.hintToggle.hidden = difficulty.id === 'challenge';
        }
        this.elements.timerWrap.hidden = !difficulty.timerSeconds;

        if (showSwipeHint && !difficulty.autoAdvance) {
            window.setTimeout(() => this.playSwipeHint(), 700);
        }
    }

    renderSentenceArea(state) {
        const container = this.elements.sentenceArea;
        container.innerHTML = '';

        state.tokens.forEach((token) => {
            const slot = document.createElement('span');
            slot.className = 'wo-slot';
            slot.dataset.lower = token.lower;

            if (token.placed) {
                slot.classList.add('is-filled');
                slot.textContent = token.text + token.punctuation;
            } else {
                slot.classList.add('is-empty');
                slot.textContent = '____';
            }

            container.appendChild(slot);
        });

        this.elements.completedEnglish.textContent = WordOrderSentenceParser.getCompletedEnglish(state);
        this.elements.completedUzbek.textContent = state.raw.uzbek;
    }

    renderWordBank(state) {
        const bank = this.elements.wordBank;
        bank.innerHTML = '';

        state.bank.forEach((item) => {
            if (item.used) {
                return;
            }

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'wo-word-block';
            button.dataset.bankId = item.id;
            button.textContent = item.text;

            if (state.nextWordHintId === item.id) {
                button.classList.add('is-hinted');
            }

            button.addEventListener('click', () => {
                WordOrderAudio.unlock();
                this.game.selectWord(item.id);
            });

            bank.appendChild(button);
        });
    }

    onWordCorrect(payload) {
        WordOrderAudio.play('correct_word');
        this.updateScore(this.game.score);
        this.updateHud();

        const bankButton = this.elements.wordBank.querySelector(`[data-bank-id="${payload.bankItem.id}"]`);
        const targetSlot = this.elements.sentenceArea.querySelector('.wo-slot.is-empty');

        if (bankButton) {
            bankButton.classList.add('is-removing');
        }

        if (bankButton && targetSlot) {
            this.animateWordFly(bankButton, targetSlot, payload.token.text + payload.token.punctuation, () => {
                targetSlot.classList.remove('is-empty');
                targetSlot.classList.add('is-filled');
                targetSlot.textContent = payload.token.text + payload.token.punctuation;
                bankButton.remove();
            });
        } else {
            this.renderSentenceArea(this.game.currentSentence);
            this.renderWordBank(this.game.currentSentence);
        }
    }

    onWordWrong(payload) {
        WordOrderAudio.play('wrong_word');
        const bankButton = this.elements.wordBank.querySelector(`[data-bank-id="${payload.bankItem.id}"]`);
        if (bankButton) {
            bankButton.classList.add('is-wrong');
            window.setTimeout(() => bankButton.classList.remove('is-wrong'), 450);
        }
    }

    // onWordAutoPlaced() {
    //     WordOrderAudio.play('correct_word');
    //     this.updateScore(this.game.score);
    //     this.renderSentenceArea(this.game.currentSentence);
    //     this.renderWordBank(this.game.currentSentence);
    //     this.elements.card?.classList.add('is-success-pulse');
    //     window.setTimeout(() => this.elements.card?.classList.remove('is-success-pulse'), 520);
    // }

    onWordAutoPlaced(payload) {
        WordOrderAudio.play('correct_word');
        this.updateScore(this.game.score);

        const bankButton = this.elements.wordBank.querySelector(`[data-bank-id="${payload.bankItem.id}"]`);
        const targetSlot = this.elements.sentenceArea.querySelector('.wo-slot.is-empty');

        if (bankButton && targetSlot) {
            this.animateWordFly(bankButton, targetSlot, payload.token.text + payload.token.punctuation, () => {
                targetSlot.classList.remove('is-empty');
                targetSlot.classList.add('is-filled');
                targetSlot.textContent = payload.token.text + payload.token.punctuation;
                bankButton.remove();
                this.elements.card?.classList.add('is-success-pulse');
                window.setTimeout(() => this.elements.card?.classList.remove('is-success-pulse'), 500);
            });
        } else {
            this.renderSentenceArea(this.game.currentSentence);
            this.renderWordBank(this.game.currentSentence);
        }
    }

    onLifeLost() {
        WordOrderAudio.play('life_lost');
        this.updateLives();
        this.elements.lives?.classList.add('is-shake');
        window.setTimeout(() => this.elements.lives?.classList.remove('is-shake'), 450);
    }

    onSentenceComplete(payload) {
        if (this.game.timedOutThisSentence) {
            this.updateMastery();
            return;
        }

        WordOrderAudio.play('sentence_complete');
        this.updateMastery();
        this.renderSentenceArea(payload.state);
        this.renderWordBank(payload.state);

        if (payload.autoAdvance) {
            this.elements.card?.classList.add('is-challenge-flash');
            window.setTimeout(() => {
                this.elements.card?.classList.remove('is-challenge-flash');
            }, WordOrderConfig.CHALLENGE_FLASH_MS);
            this.autoAdvanceTimer = window.setTimeout(
                () => this.slideAndAdvance('left'),
                WordOrderConfig.AUTO_ADVANCE_MS,
            );
            return;
        }

        this.elements.card?.classList.add('flipped');
        this.game.pauseTimer();
    }

    goToNextSentence() {
        this.game.advanceSentence();
        this.game.resumeTimer();
    }

    clearAutoAdvance() {
        if (this.autoAdvanceTimer) {
            window.clearTimeout(this.autoAdvanceTimer);
            this.autoAdvanceTimer = null;
        }
    }

    resetCardVisuals() {
        const card = this.elements.card;
        if (!card) {
            return;
        }

        card.classList.remove(
            'flipped',
            'swipe-left',
            'swipe-right',
            'is-success-pulse',
            'is-challenge-flash',
            'is-timed-out',
        );
        card.style.transform = '';
        card.style.transition = '';
        card.style.opacity = '';
        this.hideSwipeOverlays();
        this._isAnimating = false;
    }

    animateWordFly(sourceEl, targetEl, text, onDone) {
        const sourceRect = sourceEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();
        const flyer = document.createElement('span');
        flyer.className = 'wo-word-flyer';
        flyer.textContent = text;
        flyer.style.left = `${sourceRect.left}px`;
        flyer.style.top = `${sourceRect.top}px`;
        flyer.style.width = `${sourceRect.width}px`;
        document.body.appendChild(flyer);

        requestAnimationFrame(() => {
            flyer.style.transform = `translate(${targetRect.left - sourceRect.left}px, ${targetRect.top - sourceRect.top}px)`;
            flyer.style.width = `${targetRect.width}px`;
        });

        window.setTimeout(() => {
            flyer.remove();
            onDone();
        }, 620);
    }

    highlightHintWord(bankId) {
        this.renderWordBank(this.game.currentSentence);
        this.elements.wordBank.querySelector(`[data-bank-id="${bankId}"]`)?.classList.add('is-hinted');
    }

    showTranslation(text) {
        this.elements.translationHint.hidden = false;
        this.elements.translationHint.textContent = text;
    }

    showSwipeOverlay(direction, opacity) {
        if (direction === 'left' && this.elements.swipeHintLeft) {
            this.elements.swipeHintLeft.style.opacity = String(opacity);
        }
        if (direction === 'right' && this.elements.swipeHintRight) {
            this.elements.swipeHintRight.style.opacity = String(opacity);
        }
    }

    hideSwipeOverlays() {
        if (this.elements.swipeHintLeft) {
            this.elements.swipeHintLeft.style.opacity = '0';
        }
        if (this.elements.swipeHintRight) {
            this.elements.swipeHintRight.style.opacity = '0';
        }
    }

    playSwipeHint() {
        if (sessionStorage.getItem('nse-wo-swipe-hint')) {
            return;
        }
        sessionStorage.setItem('nse-wo-swipe-hint', '1');

        const card = this.elements.card;
        if (!card) {
            return;
        }

        const HALF = 60;
        const transition = 'transform 0.35s ease-in-out';
        const step = (fn) => requestAnimationFrame(() => requestAnimationFrame(fn));

        card.style.transition = 'none';
        card.style.transform = 'translate3d(0,0,0) rotate(0deg)';

        step(() => {
            card.style.transition = transition;
            card.style.transform = `translate3d(-${HALF}px,0,0) rotate(-5deg)`;
            this.showSwipeOverlay('left', 0.65);
        });

        window.setTimeout(() => {
            step(() => {
                card.style.transform = 'translate3d(0,0,0) rotate(0deg)';
                this.hideSwipeOverlays();
            });
        }, 480);

        window.setTimeout(() => {
            step(() => {
                card.style.transform = `translate3d(${HALF}px,0,0) rotate(5deg)`;
                this.showSwipeOverlay('right', 0.65);
            });
        }, 900);

        window.setTimeout(() => {
            step(() => {
                card.style.transform = 'translate3d(0,0,0) rotate(0deg)';
                this.hideSwipeOverlays();
                window.setTimeout(() => {
                    card.style.transition = '';
                    card.style.transform = '';
                }, 400);
            });
        }, 1380);
    }

    setupSwipe() {
        const card = this.elements.card;
        if (!card) {
            return;
        }

        const flipSuffix = () => (card.classList.contains('flipped') ? ' rotateY(180deg)' : '');

        const onStart = (x, y, target) => {
            if (target?.closest('#woSpeakEnglish, #woNextSentence, .wo-word-block, .wo-hint-row')) {
                return;
            }
            if (!this.canSwipeCard()) {
                return;
            }
            this._swipeDragging = true;
            this._swipeStartX = x;
            this._swipeStartY = y;
            this._swipeMoveX = 0;
            card.style.transition = 'none';
        };

        const onMove = (x, y) => {
            if (!this._swipeDragging || this._isAnimating) {
                return;
            }

            const dx = x - this._swipeStartX;
            const dy = y - this._swipeStartY;
            if (Math.abs(dx) <= Math.abs(dy) && Math.abs(dx) < 12) {
                return;
            }

            this._swipeMoveX = dx;
            const rot = dx * 0.08;
            card.style.transform = `translate3d(${dx}px,0,0) rotate(${rot}deg)${flipSuffix()}`;

            const ratio = Math.min(Math.abs(dx) / this.SWIPE_THRESHOLD, 1) * 0.9;
            if (dx < 0) {
                this.showSwipeOverlay('left', ratio);
                this.showSwipeOverlay('right', 0);
            } else if (dx > 0) {
                this.showSwipeOverlay('right', ratio);
                this.showSwipeOverlay('left', 0);
            } else {
                this.hideSwipeOverlays();
            }
        };

        const onEnd = () => {
            if (!this._swipeDragging) {
                return;
            }
            this._swipeDragging = false;
            card.style.transition = '';
            card.style.transform = flipSuffix() ? 'rotateY(180deg)' : '';
            this.hideSwipeOverlays();

            const dx = this._swipeMoveX;
            this._swipeMoveX = 0;

            if (!this.canSwipeCard()) {
                return;
            }

            if (dx < -this.SWIPE_THRESHOLD) {
                this.slideAndAdvance('left');
            } else if (dx > this.SWIPE_THRESHOLD) {
                this.game.markReviewLater();
                this.flashMessage('Added to review queue.');
                this.slideAndAdvance('right');
            }
        };

        card.addEventListener('touchstart', (event) => {
            onStart(event.touches[0].clientX, event.touches[0].clientY, event.target);
        }, { passive: true });
        card.addEventListener('touchmove', (event) => {
            onMove(event.touches[0].clientX, event.touches[0].clientY);
        }, { passive: true });
        card.addEventListener('touchend', onEnd);

        card.addEventListener('mousedown', (event) => {
            onStart(event.clientX, event.clientY, event.target);
        });
        window.addEventListener('mousemove', (event) => onMove(event.clientX, event.clientY));
        window.addEventListener('mouseup', onEnd);
    }

    slideAndAdvance(direction) {
        if (!this.canSwipeCard() && !this.game.timedOutThisSentence) {
            if (this.game.awaitingAdvance) {
                this.clearAutoAdvance();
                this.goToNextSentence();
            }
            return;
        }

        const card = this.elements.card;
        if (!card || this._isAnimating) {
            return;
        }

        this.clearAutoAdvance();
        this._isAnimating = true;
        this.hideSwipeOverlays();
        card.classList.add(direction === 'left' ? 'swipe-left' : 'swipe-right');

        window.setTimeout(() => {
            this.goToNextSentence();
            this.resetCardVisuals();
        }, 380);
    }

    updateHud() {
        this.updateLives();
        this.updateScore(this.game.score);
        this.updateMastery();
    }

    updateLives() {
        if (!this.elements.lives) {
            return;
        }
        const hearts = '❤️'.repeat(Math.max(0, this.game.lives));
        const empty = '🖤'.repeat(Math.max(0, WordOrderConfig.LIVES_PER_ROUND - this.game.lives));
        this.elements.lives.textContent = hearts + empty;
    }

    updateScore(score) {
        if (this.elements.score) {
            this.elements.score.textContent = String(score);
        }
    }

    updateTimer(remaining) {
        if (!this.elements.timer) {
            return;
        }
        this.elements.timer.textContent = String(Math.max(0, remaining));
        this.elements.timerWrap?.classList.toggle('is-low', remaining <= 10 && remaining > 0);
        this.elements.timerWrap?.classList.toggle('is-critical', remaining <= 5);
    }

    updateMastery() {
        if (this.elements.mastery) {
            this.elements.mastery.textContent = `${this.game.getRoundMastery()}%`;
        }
    }

    updateProgress() {
        const total = this.game.roundSentences.length;
        const percent = total ? Math.round((this.game.sentenceIndex / total) * 100) : 0;

        if (this.elements.progressFill) {
            this.elements.progressFill.style.width = `${percent}%`;
        }
        if (this.elements.progressPercent) {
            this.elements.progressPercent.textContent = `${percent}%`;
        }
        this.updateRoundLabel(this.game.currentRoundIndex + 1, this.game.totalRounds);
    }

    updateRoundLabel(current, total) {
        if (this.elements.roundLabel) {
            this.elements.roundLabel.textContent = `Round ${current} / ${total}`;
        }
    }

    fillModalStats(modal, stats) {
        modal.querySelectorAll('[data-stat]').forEach((node) => {
            const key = node.dataset.stat;
            if (!(key in stats)) {
                return;
            }
            node.textContent = key === 'mastery' ? `${stats[key]}%` : String(stats[key]);
        });
    }

    showRoundComplete(stats) {
        WordOrderAudio.play('round_complete');
        this.fillModalStats(this.elements.roundCompleteModal, stats);
        this.elements.roundCompleteModal.querySelector('[data-action="next-round"]').hidden = !stats.hasNextRound;
        this.openModal(this.elements.roundCompleteModal);
    }

    showGameOver(stats) {
        WordOrderAudio.play('round_failed');
        this.fillModalStats(this.elements.gameOverModal, stats);
        this.openModal(this.elements.gameOverModal);
    }

    showUnitComplete(stats) {
        WordOrderAudio.play('unit_complete');
        this.fillModalStats(this.elements.unitCompleteModal, stats);
        this.openModal(this.elements.unitCompleteModal);
    }

    openModal(modal) {
        this.closeModals();
        modal.hidden = false;
        document.body.classList.add('modal-open');
    }

    closeModals() {
        [this.elements.roundCompleteModal, this.elements.gameOverModal, this.elements.unitCompleteModal]
            .forEach((modal) => {
                if (modal) {
                    modal.hidden = true;
                }
            });
        document.body.classList.remove('modal-open');
    }

    toggleMute() {
        WordOrderAudio.setMuted(!WordOrderAudio.isMuted());
        this.updateMuteButton();
    }

    updateMuteButton() {
        const button = this.elements.muteButton;
        if (!button) {
            return;
        }
        const muted = WordOrderAudio.isMuted();
        button.setAttribute('aria-pressed', String(muted));
        button.querySelector('.icon-sound-on')?.toggleAttribute('hidden', muted);
        button.querySelector('.icon-sound-off')?.toggleAttribute('hidden', !muted);
    }

    flashMessage(text) {
        const banner = document.getElementById('woMessage');
        if (!banner) {
            return;
        }
        banner.textContent = text;
        window.setTimeout(() => {
            banner.textContent = '';
        }, 1800);
    }
}

window.WordOrderUI = WordOrderUI;
