/**
 * Unit vocabulary study — list + flashcards.
 */
(function initStudyPage() {
    'use strict';

    const root = document.getElementById('studyRoot');
    if (!root) return;

    const MODE_KEY       = 'nse-study-mode';
    const DRAG_THRESHOLD = 90;
    const PAGE_SIZE      = 12;   // 3-col grid → 12 is symmetric

    // ── Word data ─────────────────────────────────────────────────────────────
    let allWords = [];
    try {
        allWords = JSON.parse(
            document.getElementById('studyWordsData')?.textContent || '[]'
        );
    } catch (e) { allWords = []; }

    // ── DOM ───────────────────────────────────────────────────────────────────
    const el  = id => document.getElementById(id);
    const els = {
        countLabel:       el('studyCountLabel'),
        pageLabel:        el('studyPageLabel'),
        toolbar:          el('studyToolbar'),
        search:           el('studySearch'),
        modeButtons:      root.querySelectorAll('[data-study-mode]'),

        listPanel:        el('studyListPanel'),
        listGrid:         el('studyListGrid'),
        listCards:        root.querySelectorAll('.vocab-card[data-word-id]'),
        listEmpty:        el('studyListEmpty'),
        pagination:       el('studyPagination'),
        pagePrev:         el('pagePrev'),
        pageNext:         el('pageNext'),
        pageDots:         el('pageDots'),

        flashPanel:       el('studyFlashPanel'),
        interactiveCard:  el('interactiveCard'),
        cardFrontText:    el('cardFrontText'),
        cardBackEnText:   el('cardBackEnText'),
        cardAudioBtn:     el('cardAudioBtn'),
        flashCounter:     el('flashCardCounter'),
        flashPercent:     el('flashPercent'),
        flashProgressBar: el('flashProgressBar'),
        statKnown:        el('statKnownCount'),
        statReview:       el('statReviewCount'),
        flashActions:     el('flashActions'),
        actionKnowBtn:    el('actionKnowBtn'),
        actionReviewBtn:  el('actionReviewBtn'),
        flashShuffle:     el('studyFlashShuffle'),
        swipeHintLeft:    el('swipeHintLeft'),
        swipeHintRight:   el('swipeHintRight'),

        summaryPanel:     el('studySummaryPanel'),
        sumKnown:         el('sumKnown'),
        sumReview:        el('sumReview'),
        sumMastery:       el('sumMastery'),
        btnRestart:       el('btnRestartSession'),

        gameLinks:        el('studyGameLinks'),
        muteBtn:          el('muteButton'),
    };

    // ── State ─────────────────────────────────────────────────────────────────
    let filteredWords = [...allWords];
    let activeMode    = sessionStorage.getItem(MODE_KEY) || 'list';
    let currentPage   = 0;
    let deck          = [];
    let deckInitSize  = 0;
    let knownCount    = 0;
    let reviewCount   = 0;
    let isFlipped     = false;
    let isAnimating   = false;
    let isMuted       = localStorage.getItem('nse-muted') === '1';

    // ── Mute ─────────────────────────────────────────────────────────────────
    function applyMute() {
        if (!els.muteBtn) return;
        const iconOn  = els.muteBtn.querySelector('.icon-sound-on');
        const iconOff = els.muteBtn.querySelector('.icon-sound-off');
        if (iconOn)  iconOn.hidden  = isMuted;
        if (iconOff) iconOff.hidden = !isMuted;
        els.muteBtn.setAttribute('aria-pressed', isMuted ? 'true' : 'false');
    }

    els.muteBtn?.addEventListener('click', () => {
        isMuted = !isMuted;
        localStorage.setItem('nse-muted', isMuted ? '1' : '0');
        applyMute();
    });

    applyMute();

    function speak(word) {
        if (!word || isMuted) return;
        window.VocabSpeech?.speakEnglish(word);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function totalPages() {
        return Math.max(1, Math.ceil(filteredWords.length / PAGE_SIZE));
    }

    // ── Search ────────────────────────────────────────────────────────────────
    function filterWords() {
        const q = (els.search?.value || '').trim().toLowerCase();
        filteredWords = q
            ? allWords.filter(w =>
                w.uzbek.toLowerCase().includes(q) ||
                w.english.toLowerCase().includes(q))
            : [...allWords];
        currentPage = 0;
    }

    // ── Header meta ───────────────────────────────────────────────────────────
    function updateHeaderMeta() {
        const total = allWords.length;
        const shown = filteredWords.length;

        if (els.countLabel) {
            els.countLabel.textContent = shown === total
                ? `${total} Word${total === 1 ? '' : 's'}`
                : `${shown} of ${total} Words`;
        }

        if (activeMode === 'list') {
            const tp = totalPages();
            if (els.pageLabel) {
                els.pageLabel.textContent = tp > 1 ? `${currentPage + 1} / ${tp}` : '';
                els.pageLabel.hidden = tp <= 1;
            }
        } else {
            if (els.pageLabel) els.pageLabel.hidden = true;
        }
    }

    // ── Mode switching ────────────────────────────────────────────────────────
    function setMode(mode) {
        activeMode = mode;
        if (mode !== 'summary') sessionStorage.setItem(MODE_KEY, mode);

        const isSummary = mode === 'summary';
        const isFlash   = mode === 'flashcards';

        // Hide toolbar entirely in summary; hide search in flashcards
        if (els.toolbar)   els.toolbar.hidden = isSummary;
        if (els.search)    els.search.hidden  = isFlash || isSummary;
        if (els.gameLinks) els.gameLinks.hidden = isSummary;

        // Toggle body class for flashcard lock-scroll
        document.body.classList.toggle('flashcard-mode', isFlash);

        els.listPanel.hidden    = mode !== 'list';
        els.flashPanel.hidden   = isFlash ? false : true;
        els.summaryPanel.hidden = mode !== 'summary';

        els.modeButtons.forEach(btn => {
            const active = btn.dataset.studyMode === mode;
            btn.classList.toggle('is-active', active);
            btn.setAttribute('aria-selected', active ? 'true' : 'false');
        });

        if (mode === 'list')        { filterWords(); renderList(); }
        else if (isFlash)           { initDeck(); }
        else if (mode === 'summary') { renderSummary(); }

        updateHeaderMeta();
    }

    // ── List mode ─────────────────────────────────────────────────────────────
    function renderList() {
        const start   = currentPage * PAGE_SIZE;
        const pageIds = new Set(
            filteredWords.slice(start, start + PAGE_SIZE).map(w => String(w.id))
        );

        els.listCards.forEach(card => {
            card.hidden = !pageIds.has(card.dataset.wordId);
        });

        if (els.listEmpty) els.listEmpty.hidden = filteredWords.length > 0;

        const tp = totalPages();
        if (els.pagination) els.pagination.hidden = tp <= 1;
        if (els.pagePrev)   els.pagePrev.disabled  = currentPage === 0;
        if (els.pageNext)   els.pageNext.disabled  = currentPage >= tp - 1;

        if (els.pageDots) {
            els.pageDots.innerHTML = '';
            for (let i = 0; i < tp; i++) {
                const dot = document.createElement('button');
                dot.type = 'button';
                dot.className = 'page-dot' + (i === currentPage ? ' is-active' : '');
                dot.setAttribute('aria-label', `Page ${i + 1}`);
                dot.dataset.page = i;
                els.pageDots.appendChild(dot);
            }
        }

        updateHeaderMeta();
    }

    // ── Flashcard deck ────────────────────────────────────────────────────────
    function initDeck() {
        deck         = [...filteredWords];
        deckInitSize = deck.length;
        knownCount   = 0;
        reviewCount  = 0;
        isFlipped    = false;
        isAnimating  = false;

        updateMetrics();
        if (!deck.length) { showEmptyCard(); return; }
        displayCard();
        setTimeout(playSwipeHint, 700);
    }

    function displayCard() {
        const card = els.interactiveCard;
        card.classList.remove('flipped', 'swipe-left', 'swipe-right');
        card.style.transform  = '';
        card.style.transition = '';
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
        if (els.flashActions)     els.flashActions.hidden = true;
        if (els.flashCounter)     els.flashCounter.textContent = 'Card 0 of 0';
        if (els.flashPercent)     els.flashPercent.textContent = '0%';
        if (els.flashProgressBar) els.flashProgressBar.style.width = '0%';
    }

    function flipCard() {
        if (isAnimating) return;
        isFlipped = !isFlipped;
        els.interactiveCard.classList.toggle('flipped', isFlipped);
        if (isFlipped) speak(deck[0]?.english);
    }

    function updateMetrics() {
        const remaining = deck.length;
        const pct = deckInitSize > 0
            ? Math.min(Math.round((knownCount / deckInitSize) * 100), 100) : 0;

        if (els.statKnown)        els.statKnown.textContent        = knownCount;
        if (els.statReview)       els.statReview.textContent       = reviewCount;
        if (els.flashCounter)     els.flashCounter.textContent     = `Remaining: ${remaining} / ${deckInitSize}`;
        if (els.flashPercent)     els.flashPercent.textContent     = `${pct}%`;
        if (els.flashProgressBar) els.flashProgressBar.style.width = `${pct}%`;
    }

    // ── Process Know / Review — NO forced flip, acts immediately ─────────────
    function processAction(direction) {
        if (isAnimating || deck.length === 0) return;
        isAnimating = true;
        hideOverlays();

        const word = deck[0];
        els.interactiveCard.classList.add(
            direction === 'right' ? 'swipe-right' : 'swipe-left'
        );

        if (direction === 'right') {
            knownCount++;
            deck.shift();
        } else {
            reviewCount++;
            deck.shift();
            deck.splice(Math.min(3, deck.length), 0, word);
        }

        updateMetrics();

        setTimeout(() => {
            isAnimating = false;
            deck.length === 0 ? setMode('summary') : displayCard();
        }, 380);
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    function renderSummary() {
        if (els.sumKnown)  els.sumKnown.textContent  = knownCount;
        if (els.sumReview) els.sumReview.textContent = reviewCount;
        const score = deckInitSize > 0
            ? Math.round((knownCount / deckInitSize) * 100) : 0;
        if (els.sumMastery) els.sumMastery.textContent = `${score}%`;
        document.body.classList.remove('flashcard-mode');
    }

    // ── Swipe hint animation ──────────────────────────────────────────────────
    function playSwipeHint() {
        if (sessionStorage.getItem('nse-swipe-hint') || deck.length === 0) return;
        sessionStorage.setItem('nse-swipe-hint', '1');

        const card = els.interactiveCard;
        const HALF = 60;
        const T    = 'transform 0.35s ease-in-out';

        // Double rAF so the browser has painted before we apply the transform
        function step(fn) { requestAnimationFrame(() => requestAnimationFrame(fn)); }

        // 1. Ensure we start at rest with no transition
        card.style.transition = 'none';
        card.style.transform  = 'translate3d(0,0,0) rotate(0deg)';

        // 2. Drift left
        step(() => {
            card.style.transition = T;
            card.style.transform  = `translate3d(-${HALF}px,0,0) rotate(-5deg)`;
            showOverlay('left', 0.65);
        });

        // 3. Snap back to centre
        setTimeout(() => {
            step(() => {
                card.style.transform = 'translate3d(0,0,0) rotate(0deg)';
                hideOverlays();
            });
        }, 480);

        // 4. Drift right
        setTimeout(() => {
            step(() => {
                card.style.transform = `translate3d(${HALF}px,0,0) rotate(5deg)`;
                showOverlay('right', 0.65);
            });
        }, 900);

        // 5. Snap back and clean up
        setTimeout(() => {
            step(() => {
                card.style.transform = 'translate3d(0,0,0) rotate(0deg)';
                hideOverlays();
                setTimeout(() => {
                    card.style.transition = '';
                    card.style.transform  = '';
                }, 400);
            });
        }, 1380);
    }

    function showOverlay(dir, opacity) {
        if (dir === 'left'  && els.swipeHintLeft)  els.swipeHintLeft.style.opacity  = opacity;
        if (dir === 'right' && els.swipeHintRight) els.swipeHintRight.style.opacity = opacity;
    }

    function hideOverlays() {
        if (els.swipeHintLeft)  els.swipeHintLeft.style.opacity  = '0';
        if (els.swipeHintRight) els.swipeHintRight.style.opacity = '0';
    }

    // ── Drag / swipe ──────────────────────────────────────────────────────────
    function setupSwipe() {
        let startX = 0, startY = 0, moveX = 0, dragging = false;

        function onStart(x, y) {
            if (isAnimating) return;
            startX = x; startY = y; moveX = 0; dragging = true;
            els.interactiveCard.style.transition = 'none';
        }

        function onMove(x, y) {
            if (!dragging || isAnimating) return;
            moveX = x - startX;
            const dy = y - startY;
            if (Math.abs(moveX) > Math.abs(dy)) {
                const rot        = moveX * 0.08;
                const flipSuffix = isFlipped ? ' rotateY(180deg)' : '';
                els.interactiveCard.style.transform =
                    `translate3d(${moveX}px,0,0) rotate(${rot}deg)${flipSuffix}`;
                const pct = Math.min(Math.abs(moveX) / DRAG_THRESHOLD, 1);
                if (moveX < 0) { showOverlay('left',  pct * 0.9); showOverlay('right', 0); }
                else            { showOverlay('right', pct * 0.9); showOverlay('left',  0); }
            }
        }

        function onEnd() {
            if (!dragging) return;
            dragging = false;
            els.interactiveCard.style.transition = '';
            els.interactiveCard.style.transform  = '';
            hideOverlays();

            if      (moveX >  DRAG_THRESHOLD) processAction('right');
            else if (moveX < -DRAG_THRESHOLD) processAction('left');
            moveX = 0;
        }

        const c = els.interactiveCard;
        c.addEventListener('touchstart', e => onStart(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
        c.addEventListener('touchmove',  e => onMove(e.touches[0].clientX,  e.touches[0].clientY), { passive: true });
        c.addEventListener('touchend',   onEnd);
        c.addEventListener('mousedown',  e => { if (!e.target.closest('#cardAudioBtn')) onStart(e.clientX, e.clientY); });
        window.addEventListener('mousemove', e => onMove(e.clientX, e.clientY));
        window.addEventListener('mouseup', onEnd);
    }

    // ── Keyboard ──────────────────────────────────────────────────────────────
    function setupKeyboard() {
        document.addEventListener('keydown', e => {
            if (activeMode !== 'flashcards') return;
            if (e.target.matches('input, textarea, select')) return;
            if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flipCard(); }
            else if (e.key === 'ArrowRight') { e.preventDefault(); processAction('right'); }
            else if (e.key === 'ArrowLeft')  { e.preventDefault(); processAction('left'); }
        });
    }

    // ── Events ────────────────────────────────────────────────────────────────
    els.modeButtons.forEach(btn =>
        btn.addEventListener('click', () => setMode(btn.dataset.studyMode))
    );

    els.search?.addEventListener('input', () => {
        filterWords();
        if (activeMode === 'list') renderList();
        else if (activeMode === 'flashcards') initDeck();
        updateHeaderMeta();
    });

    els.pagePrev?.addEventListener('click', () => {
        if (currentPage > 0) { currentPage--; renderList(); }
    });
    els.pageNext?.addEventListener('click', () => {
        if (currentPage < totalPages() - 1) { currentPage++; renderList(); }
    });
    els.pageDots?.addEventListener('click', e => {
        const dot = e.target.closest('.page-dot');
        if (dot) { currentPage = parseInt(dot.dataset.page, 10); renderList(); }
    });

    root.querySelectorAll('[data-speak-word]').forEach(btn =>
        btn.addEventListener('click', e => {
            e.stopPropagation();
            speak(btn.dataset.speakWord);
        })
    );

    els.interactiveCard?.addEventListener('click', e => {
        if (e.target.closest('#cardAudioBtn')) return;
        if (!isAnimating) flipCard();
    });

    els.cardAudioBtn?.addEventListener('click', e => {
        e.stopPropagation();
        speak(deck[0]?.english);
    });

    els.actionKnowBtn?.addEventListener('click',   () => processAction('right'));
    els.actionReviewBtn?.addEventListener('click', () => processAction('left'));
    els.flashShuffle?.addEventListener('click', () => { shuffle(filteredWords); initDeck(); });
    els.btnRestart?.addEventListener('click', () => setMode('flashcards'));

    setupSwipe();
    setupKeyboard();

    // ── Boot ──────────────────────────────────────────────────────────────────
    setMode(activeMode);
})();
