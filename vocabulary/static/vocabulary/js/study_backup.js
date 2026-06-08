/**
 * Unit vocabulary study — list mode + flip flashcards with Know / Need Practice flow.
 */
(function initStudyPage() {
    const root = document.getElementById('studyRoot');
    if (!root) return;

    const MODE_KEY = 'nse-study-mode';
    const DRAG_THRESHOLD = 90;

    // ── Parse word data ───────────────────────────────────────────────────────
    let allWords = [];
    try {
        allWords = JSON.parse(document.getElementById('studyWordsData')?.textContent || '[]');
    } catch (_) {
        allWords = [];
    }

    // ── DOM refs ──────────────────────────────────────────────────────────────
    const els = {
        toolbar:          document.getElementById('studyToolbar'),
        search:           document.getElementById('studySearch'),
        modeButtons:      root.querySelectorAll('[data-study-mode]'),
        countLabel:       document.getElementById('studyCountLabel'),

        // List panel
        listPanel:        document.getElementById('studyListPanel'),
        listGrid:         document.getElementById('studyListGrid'),
        listCards:        root.querySelectorAll('.vocab-card[data-word-id]'),
        listEmpty:        document.getElementById('studyListEmpty'),

        // Flashcard panel
        flashPanel:       document.getElementById('studyFlashPanel'),
        cardContainer:    document.getElementById('cardContainer'),
        interactiveCard:  document.getElementById('interactiveCard'),
        cardFrontText:    document.getElementById('cardFrontText'),
        cardBackEnText:   document.getElementById('cardBackEnText'),
        cardAudioBtn:     document.getElementById('cardAudioBtn'),
        flashCounter:     document.getElementById('flashCardCounter'),
        flashPercent:     document.getElementById('flashPercent'),
        flashProgressBar: document.getElementById('flashProgressBar'),
        statKnown:        document.getElementById('statKnownCount'),
        statReview:       document.getElementById('statReviewCount'),
        flashActions:     document.getElementById('flashActions'),
        actionKnowBtn:    document.getElementById('actionKnowBtn'),
        actionReviewBtn:  document.getElementById('actionReviewBtn'),
        flashShuffle:     document.getElementById('studyFlashShuffle'),

        // Summary panel
        summaryPanel:     document.getElementById('studySummaryPanel'),
        sumKnown:         document.getElementById('sumKnown'),
        sumReview:        document.getElementById('sumReview'),
        sumMastery:       document.getElementById('sumMastery'),
        btnRestart:       document.getElementById('btnRestartSession'),

        // Game nav
        gameLinks:        document.getElementById('studyGameLinks'),
    };

    // ── App state ─────────────────────────────────────────────────────────────
    let filteredWords  = [...allWords];
    let deck           = [];          // working deck (cards removed when "Known", reinserted when "Review")
    let deckInitSize   = 0;
    let knownCount     = 0;
    let reviewCount    = 0;
    let activeMode     = sessionStorage.getItem(MODE_KEY) || 'list';
    let isFlipped      = false;
    let isAnimating    = false;

    // ── Utility ───────────────────────────────────────────────────────────────
    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function filterWords() {
        const q = (els.search?.value || '').trim().toLowerCase();
        filteredWords = q
            ? allWords.filter(w =>
                w.uzbek.toLowerCase().includes(q) ||
                w.english.toLowerCase().includes(q)
              )
            : [...allWords];
    }

    function updateCountLabel() {
        if (!els.countLabel) return;
        const total = allWords.length;
        const shown = filteredWords.length;
        els.countLabel.textContent = shown === total
            ? `${total} Word${total === 1 ? '' : 's'}`
            : `${shown} of ${total} Words`;
    }

    // ── Mode switching ────────────────────────────────────────────────────────
    function setMode(mode) {
        activeMode = mode;
        if (mode !== 'summary') sessionStorage.setItem(MODE_KEY, mode);

        const showToolbar   = mode !== 'summary';
        const showGameLinks = mode !== 'summary';

        if (els.toolbar)   els.toolbar.hidden   = !showToolbar;
        if (els.gameLinks) els.gameLinks.hidden  = !showGameLinks;

        els.listPanel.hidden    = mode !== 'list';
        els.flashPanel.hidden   = mode !== 'flashcards';
        els.summaryPanel.hidden = mode !== 'summary';

        els.modeButtons.forEach(btn => {
            const active = btn.dataset.studyMode === mode;
            btn.classList.toggle('is-active', active);
            btn.setAttribute('aria-selected', active ? 'true' : 'false');
        });

        if (mode === 'list') {
            renderList();
        } else if (mode === 'flashcards') {
            initDeck();
        } else if (mode === 'summary') {
            renderSummary();
        }
    }

    // ── List mode ─────────────────────────────────────────────────────────────
    function renderList() {
        if (!els.listGrid || !els.listCards.length) return;
        const visibleIds = new Set(filteredWords.map(w => String(w.id)));
        els.listCards.forEach(card => {
            card.hidden = !visibleIds.has(card.dataset.wordId);
        });
        if (els.listEmpty) els.listEmpty.hidden = filteredWords.length > 0;
        updateCountLabel();
    }

    // ── Flashcard: deck management ────────────────────────────────────────────
    function initDeck() {
        deck         = [...filteredWords];
        deckInitSize = deck.length;
        knownCount   = 0;
        reviewCount  = 0;
        isFlipped    = false;
        isAnimating  = false;

        updateMetrics();
        if (deck.length === 0) {
            showEmptyCard();
            return;
        }
        displayCard();
    }

    function displayCard() {
        const card = els.interactiveCard;
        card.classList.remove('flipped', 'swipe-left', 'swipe-right');
        isFlipped = false;

        const word = deck[0];
        if (!word) { showEmptyCard(); return; }

        els.cardFrontText.textContent  = word.uzbek;
        els.cardBackEnText.textContent = word.english;

        if (els.flashActions) els.flashActions.hidden = false;
    }

    function showEmptyCard() {
        els.cardFrontText.textContent  = 'No matches';
        els.cardBackEnText.textContent = '';
        if (els.flashActions) els.flashActions.hidden = true;
        if (els.flashCounter) els.flashCounter.textContent = 'Card 0 of 0';
        if (els.flashPercent) els.flashPercent.textContent = '0%';
        if (els.flashProgressBar) els.flashProgressBar.style.width = '0%';
    }

    function flipCard() {
        if (isAnimating) return;
        isFlipped = !isFlipped;
        els.interactiveCard.classList.toggle('flipped', isFlipped);
        if (isFlipped) {
            window.VocabSpeech?.speakEnglish(deck[0]?.english);
        }
    }

    function updateMetrics() {
        if (!deckInitSize) return;
        const remaining       = deck.length;
        const progressPercent = Math.min(Math.round((knownCount / deckInitSize) * 100), 100);

        if (els.statKnown)        els.statKnown.textContent        = knownCount;
        if (els.statReview)       els.statReview.textContent       = reviewCount;
        if (els.flashCounter)     els.flashCounter.textContent     = `Remaining: ${remaining} / ${deckInitSize}`;
        if (els.flashPercent)     els.flashPercent.textContent     = `${progressPercent}%`;
        if (els.flashProgressBar) els.flashProgressBar.style.width = `${progressPercent}%`;
        updateCountLabel();
    }

    // ── Swipe action: direction = 'right' (known) | 'left' (review) ──────────
    function processAction(direction) {
        if (isAnimating || deck.length === 0) return;
        isAnimating = true;

        const word = deck[0];
        const animClass = direction === 'right' ? 'swipe-right' : 'swipe-left';
        els.interactiveCard.classList.add(animClass);

        if (direction === 'right') {
            knownCount++;
            deck.shift();
        } else {
            reviewCount++;
            deck.shift();
            // Reinsert 3 cards later so the learner sees it again soon
            const reinsert = Math.min(3, deck.length);
            deck.splice(reinsert, 0, word);
        }

        updateMetrics();

        setTimeout(() => {
            isAnimating = false;
            if (deck.length === 0) {
                setMode('summary');
            } else {
                displayCard();
            }
        }, 380);
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    function renderSummary() {
        if (els.sumKnown)   els.sumKnown.textContent   = knownCount;
        if (els.sumReview)  els.sumReview.textContent  = reviewCount;
        const baseline = knownCount + reviewCount;
        const score    = baseline > 0 ? Math.round((knownCount / baseline) * 100) : 0;
        if (els.sumMastery) els.sumMastery.textContent = `${score}%`;
    }

    // ── Swipe / drag gestures ─────────────────────────────────────────────────
    function setupSwipe() {
        let startX = 0, startY = 0, moveX = 0;
        let dragging = false;

        function onStart(x, y) {
            if (isAnimating) return;
            startX = x; startY = y; moveX = 0; dragging = true;
            els.interactiveCard.style.transition = 'none';
        }

        function onMove(x, y) {
            if (!dragging || isAnimating) return;
            moveX = x - startX;
            const deltaY = y - startY;
            if (Math.abs(moveX) > Math.abs(deltaY)) {
                const rotate = moveX * 0.08;
                const flipSuffix = isFlipped ? ' rotateY(180deg)' : '';
                els.interactiveCard.style.transform =
                    `translate3d(${moveX}px, 0, 0) rotate(${rotate}deg)${flipSuffix}`;
            }
        }

        function onEnd() {
            if (!dragging) return;
            dragging = false;
            els.interactiveCard.style.transition = '';
            els.interactiveCard.style.transform  = '';

            if (moveX > DRAG_THRESHOLD) {
                processAction('right');
            } else if (moveX < -DRAG_THRESHOLD) {
                processAction('left');
            }
            moveX = 0;
        }

        // Touch
        els.interactiveCard.addEventListener('touchstart',
            e => onStart(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
        els.interactiveCard.addEventListener('touchmove',
            e => onMove(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
        els.interactiveCard.addEventListener('touchend', onEnd);

        // Mouse
        els.interactiveCard.addEventListener('mousedown', e => {
            if (e.target.closest('#cardAudioBtn')) return;
            onStart(e.clientX, e.clientY);
        });
        window.addEventListener('mousemove', e => onMove(e.clientX, e.clientY));
        window.addEventListener('mouseup', onEnd);
    }

    // ── Keyboard shortcuts (flashcard mode) ──────────────────────────────────
    function setupKeyboard() {
        document.addEventListener('keydown', e => {
            if (activeMode !== 'flashcards') return;
            if (e.target.matches('input, textarea, select')) return;

            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                if (!isFlipped) flipCard();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                processAction('right');
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                processAction('left');
            }
        });
    }

    // ── Event bindings ────────────────────────────────────────────────────────
    els.modeButtons.forEach(btn => {
        btn.addEventListener('click', () => setMode(btn.dataset.studyMode));
    });

    els.search?.addEventListener('input', () => {
        filterWords();
        if (activeMode === 'list') renderList();
        else if (activeMode === 'flashcards') initDeck();
    });

    // List: speak buttons
    root.querySelectorAll('[data-speak-word]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            window.VocabSpeech?.speakEnglish(btn.dataset.speakWord);
        });
    });

    // Card flip on click (not on audio button)
    els.interactiveCard?.addEventListener('click', e => {
        if (e.target.closest('#cardAudioBtn')) return;
        if (!isAnimating) flipCard();
    });

    els.cardAudioBtn?.addEventListener('click', e => {
        e.stopPropagation();
        window.VocabSpeech?.speakEnglish(deck[0]?.english);
    });

    els.actionKnowBtn?.addEventListener('click',   () => processAction('right'));
    els.actionReviewBtn?.addEventListener('click', () => processAction('left'));

    els.flashShuffle?.addEventListener('click', () => {
        shuffle(filteredWords);
        initDeck();
    });

    els.btnRestart?.addEventListener('click', () => setMode('flashcards'));

    setupSwipe();
    setupKeyboard();

    // ── Boot ──────────────────────────────────────────────────────────────────
    filterWords();
    setMode(activeMode);
})();
