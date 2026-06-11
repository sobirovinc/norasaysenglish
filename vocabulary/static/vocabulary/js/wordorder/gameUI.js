/**
 * DOM rendering, animations, and input for the Word Order game.
 */
class WordOrderUI {
    constructor(root, game) {
        this.root = root;
        this.game = game;
        this.pendingRoundIndex = 0;
        this.elements = this.collectElements();
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.autoAdvanceTimer = null;
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
            cardInner: document.getElementById('woCardInner'),
            cardFront: document.getElementById('woCardFront'),
            cardBack: document.getElementById('woCardBack'),
            sentenceArea: document.getElementById('woSentenceArea'),
            wordBank: document.getElementById('woWordBank'),
            translationHint: document.getElementById('woTranslationHint'),
            swipeHint: document.getElementById('woSwipeHint'),
            hintPanel: document.getElementById('woHintPanel'),
            hintButtons: this.root.querySelectorAll('[data-hint]'),
            completionActions: document.getElementById('woCompletionActions'),
            speakEnglishBtn: document.getElementById('woSpeakEnglish'),
            speakUzbekBtn: document.getElementById('woSpeakUzbek'),
            reviewLaterBtn: document.getElementById('woReviewLater'),
            nextSentenceBtn: document.getElementById('woNextSentence'),
            completedEnglish: document.getElementById('woCompletedEnglish'),
            completedUzbek: document.getElementById('woCompletedUzbek'),
            muteButton: document.getElementById('woMuteButton'),
            roundCompleteModal: document.getElementById('woRoundCompleteModal'),
            gameOverModal: document.getElementById('woGameOverModal'),
            unitCompleteModal: document.getElementById('woUnitCompleteModal'),
        };
    }

    bindEvents() {
        this.elements.difficultyButtons.forEach((button) => {
            button.addEventListener('click', () => {
                WordOrderAudio.unlock();
                const difficultyId = button.dataset.difficulty;
                this.startGame(difficultyId);
            });
        });

        this.elements.hintButtons.forEach((button) => {
            button.addEventListener('click', () => {
                const hintType = button.dataset.hint;
                const result = this.game.useHint(hintType);
                if (result?.type === 'insufficient') {
                    this.flashMessage('Not enough points for that hint.');
                }
            });
        });

        this.elements.nextSentenceBtn?.addEventListener('click', () => this.goToNextSentence());
        this.elements.reviewLaterBtn?.addEventListener('click', () => {
            this.game.markReviewLater();
            this.flashMessage('Added to review queue.');
        });
        this.elements.speakEnglishBtn?.addEventListener('click', () => {
            if (this.game.currentSentence) {
                VocabSpeech.speakEnglish(this.game.currentSentence.raw.english);
            }
        });
        this.elements.speakUzbekBtn?.addEventListener('click', () => {
            if (this.game.currentSentence) {
                VocabSpeech.speakUzbek(this.game.currentSentence.raw.uzbek);
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

        if (this.elements.card) {
            this.elements.card.addEventListener('touchstart', (event) => this.onTouchStart(event), { passive: true });
            this.elements.card.addEventListener('touchend', (event) => this.onTouchEnd(event));
        }
    }

    bindGameEvents() {
        this.game.on('sentenceLoaded', (payload) => this.renderSentence(payload));
        this.game.on('wordCorrect', (payload) => this.onWordCorrect(payload));
        this.game.on('wordWrong', (payload) => this.onWordWrong(payload));
        this.game.on('wordAutoPlaced', (payload) => this.onWordAutoPlaced(payload));
        this.game.on('lifeLost', (payload) => this.onLifeLost(payload));
        this.game.on('scoreChanged', (payload) => this.updateScore(payload.score));
        this.game.on('timerTick', (payload) => this.updateTimer(payload.remaining));
        this.game.on('sentenceComplete', (payload) => this.onSentenceComplete(payload));
        this.game.on('hintNextWord', (payload) => this.highlightHintWord(payload.bankId));
        this.game.on('hintTranslation', (payload) => this.showTranslation(payload.text));
        this.game.on('hintRevealAnswer', () => this.renderSentenceArea(this.game.currentSentence));
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
        this.elements.completionActions.hidden = true;
        this.elements.hintPanel.hidden = difficulty.id === 'challenge';
        this.elements.timerWrap.hidden = !difficulty.timerSeconds;
        this.elements.swipeHint.hidden = !showSwipeHint || difficulty.autoAdvance;
        if (showSwipeHint && !difficulty.autoAdvance) {
            this.elements.swipeHint.classList.add('is-visible');
        } else {
            this.elements.swipeHint.classList.remove('is-visible');
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

    onWordAutoPlaced(payload) {
        WordOrderAudio.play('correct_word');
        this.updateScore(this.game.score);
        this.renderSentenceArea(this.game.currentSentence);
        this.renderWordBank(this.game.currentSentence);
        this.elements.card?.classList.add('is-success-pulse');
        window.setTimeout(() => this.elements.card?.classList.remove('is-success-pulse'), 500);
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
            this.autoAdvanceTimer = window.setTimeout(() => this.goToNextSentence(true), WordOrderConfig.AUTO_ADVANCE_MS);
            return;
        }

        this.elements.card?.classList.add('is-flipped');
        this.elements.completionActions.hidden = false;
        this.game.pauseTimer();
    }

    goToNextSentence(fromAuto = false) {
        if (!fromAuto && !this.game.awaitingAdvance) {
            return;
        }

        this.clearAutoAdvance();
        this.elements.card?.classList.add('is-sliding-out');
        window.setTimeout(() => {
            this.game.advanceSentence();
            this.elements.card?.classList.remove('is-sliding-out');
            this.elements.card?.classList.add('is-sliding-in');
            window.setTimeout(() => this.elements.card?.classList.remove('is-sliding-in'), 320);
            this.game.resumeTimer();
        }, 260);
    }

    clearAutoAdvance() {
        if (this.autoAdvanceTimer) {
            window.clearTimeout(this.autoAdvanceTimer);
            this.autoAdvanceTimer = null;
        }
    }

    resetCardVisuals() {
        this.elements.card?.classList.remove(
            'is-flipped',
            'is-success-pulse',
            'is-challenge-flash',
            'is-timed-out',
            'is-sliding-out',
            'is-sliding-in',
        );
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

        sourceEl.style.visibility = 'hidden';

        requestAnimationFrame(() => {
            flyer.style.transform = `translate(${targetRect.left - sourceRect.left}px, ${targetRect.top - sourceRect.top}px)`;
            flyer.style.width = `${targetRect.width}px`;
        });

        window.setTimeout(() => {
            flyer.remove();
            onDone();
        }, 340);
    }

    highlightHintWord(bankId) {
        this.renderWordBank(this.game.currentSentence);
        const button = this.elements.wordBank.querySelector(`[data-bank-id="${bankId}"]`);
        button?.classList.add('is-hinted');
    }

    showTranslation(text) {
        this.elements.translationHint.hidden = false;
        this.elements.translationHint.textContent = text;
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
        const current = Math.min(this.game.sentenceIndex + 1, total);
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

    onTouchStart(event) {
        const touch = event.changedTouches[0];
        this.touchStartX = touch.clientX;
        this.touchStartY = touch.clientY;
    }

    onTouchEnd(event) {
        if (!this.game.awaitingAdvance || this.game.difficulty?.autoAdvance) {
            return;
        }

        const touch = event.changedTouches[0];
        const deltaX = touch.clientX - this.touchStartX;
        const deltaY = touch.clientY - this.touchStartY;

        if (Math.abs(deltaX) < 60 || Math.abs(deltaY) > 80) {
            return;
        }

        if (deltaX > 0) {
            this.goToNextSentence();
        } else {
            this.game.markReviewLater();
            this.flashMessage('Added to review queue.');
        }
    }
}

window.WordOrderUI = WordOrderUI;
