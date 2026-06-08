/**
 * Unit vocabulary study — list mode + flip flashcards with Know / Need Practice flow.
 * Includes:
 * - Working mode switching
 * - Working search
 * - Force reveal before grading
 * - Pagination (10 words/page)
 * - Swipe tutorial
 * - Safer initialization
 */

(function initStudyPage() {
    const root = document.getElementById('studyRoot');
    if (!root) return;

    const MODE_KEY = 'nse-study-mode';
    const DRAG_THRESHOLD = 90;
    const WORDS_PER_PAGE = 10;

    let allWords = [];

    try {
        allWords = JSON.parse(
            document.getElementById('studyWordsData')?.textContent || '[]'
        );
    } catch (err) {
        console.error('Failed to load study data', err);
        allWords = [];
    }

    const els = {
        toolbar: document.getElementById('studyToolbar'),
        search: document.getElementById('studySearch'),
        modeButtons: root.querySelectorAll('[data-study-mode]'),
        countLabel: document.getElementById('studyCountLabel'),

        listPanel: document.getElementById('studyListPanel'),
        listGrid: document.getElementById('studyListGrid'),
        listCards: root.querySelectorAll('.vocab-card[data-word-id]'),
        listEmpty: document.getElementById('studyListEmpty'),

        flashPanel: document.getElementById('studyFlashPanel'),
        cardContainer: document.getElementById('cardContainer'),
        interactiveCard: document.getElementById('interactiveCard'),
        cardFrontText: document.getElementById('cardFrontText'),
        cardBackEnText: document.getElementById('cardBackEnText'),
        cardAudioBtn: document.getElementById('cardAudioBtn'),

        flashCounter: document.getElementById('flashCardCounter'),
        flashPercent: document.getElementById('flashPercent'),
        flashProgressBar: document.getElementById('flashProgressBar'),

        statKnown: document.getElementById('statKnownCount'),
        statReview: document.getElementById('statReviewCount'),

        flashActions: document.getElementById('flashActions'),
        actionKnowBtn: document.getElementById('actionKnowBtn'),
        actionReviewBtn: document.getElementById('actionReviewBtn'),
        flashShuffle: document.getElementById('studyFlashShuffle'),

        summaryPanel: document.getElementById('studySummaryPanel'),
        sumKnown: document.getElementById('sumKnown'),
        sumReview: document.getElementById('sumReview'),
        sumMastery: document.getElementById('sumMastery'),
        btnRestart: document.getElementById('btnRestartSession'),

        gameLinks: document.getElementById('studyGameLinks'),

        pageIndicator: document.getElementById('studyPageIndicator'),
        pagePrev: document.getElementById('pagePrev'),
        pageNext: document.getElementById('pageNext'),

        tutorial: document.getElementById('flashcardTutorial'),
    };

    let filteredWords = [...allWords];

    let deck = [];
    let deckInitSize = 0;

    let knownCount = 0;
    let reviewCount = 0;

    let activeMode =
        sessionStorage.getItem(MODE_KEY) || 'list';

    let isFlipped = false;
    let isAnimating = false;

    let currentPage = 1;
    let totalPages = 1;

    function shuffle(arr) {
        const copy = [...arr];

        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }

        return copy;
    }

    function filterWords() {
        const q =
            (els.search?.value || '')
                .trim()
                .toLowerCase();

        filteredWords = q
            ? allWords.filter(word =>
                  word.uzbek.toLowerCase().includes(q) ||
                  word.english.toLowerCase().includes(q)
              )
            : [...allWords];

        currentPage = 1;
    }

    function updateCountLabel() {
        if (!els.countLabel) return;

        const total = allWords.length;
        const shown = filteredWords.length;

        els.countLabel.textContent =
            shown === total
                ? `${total} Words`
                : `${shown} of ${total} Words`;
    }

    function setMode(mode) {
        activeMode = mode;

        if (mode !== 'summary') {
            sessionStorage.setItem(MODE_KEY, mode);
        }

        if (els.toolbar) {
            els.toolbar.hidden = mode === 'summary';
        }

        if (els.gameLinks) {
            els.gameLinks.hidden = mode === 'summary';
        }

        if (els.listPanel) {
            els.listPanel.hidden = mode !== 'list';
        }

        if (els.flashPanel) {
            els.flashPanel.hidden = mode !== 'flashcards';
        }

        if (els.summaryPanel) {
            els.summaryPanel.hidden = mode !== 'summary';
        }

        els.modeButtons.forEach(btn => {
            const active =
                btn.dataset.studyMode === mode;

            btn.classList.toggle(
                'is-active',
                active
            );

            btn.setAttribute(
                'aria-selected',
                active ? 'true' : 'false'
            );
        });

        if (mode === 'list') {
            renderList();
        }

        if (mode === 'flashcards') {
            initDeck();
            showSwipeTutorial();
        }

        if (mode === 'summary') {
            renderSummary();
        }
    }

    function renderList() {
        if (!els.listCards.length) return;

        totalPages = Math.max(
            1,
            Math.ceil(
                filteredWords.length / WORDS_PER_PAGE
            )
        );

        if (currentPage > totalPages) {
            currentPage = totalPages;
        }

        const start =
            (currentPage - 1) * WORDS_PER_PAGE;

        const end = start + WORDS_PER_PAGE;

        const visibleIds = new Set(
            filteredWords
                .slice(start, end)
                .map(word => String(word.id))
        );

        els.listCards.forEach(card => {
            card.hidden =
                !visibleIds.has(card.dataset.wordId);
        });

        if (els.listEmpty) {
            els.listEmpty.hidden =
                filteredWords.length > 0;
        }

        if (els.pageIndicator) {
            els.pageIndicator.textContent =
                `${currentPage}/${totalPages}`;
        }

        updateCountLabel();
    }

    function initDeck() {
        deck = [...filteredWords];

        deckInitSize = deck.length;

        knownCount = 0;
        reviewCount = 0;

        isFlipped = false;
        isAnimating = false;

        updateMetrics();

        if (!deck.length) {
            showEmptyCard();
            return;
        }

        displayCard();
    }

    function displayCard() {
        const word = deck[0];

        if (!word) {
            showEmptyCard();
            return;
        }

        els.interactiveCard?.classList.remove(
            'flipped',
            'swipe-left',
            'swipe-right'
        );

        isFlipped = false;

        if (els.cardFrontText) {
            els.cardFrontText.textContent =
                word.uzbek;
        }

        if (els.cardBackEnText) {
            els.cardBackEnText.textContent =
                word.english;
        }

        if (els.flashActions) {
            els.flashActions.hidden = false;
        }
    }

    function showEmptyCard() {
        if (els.cardFrontText) {
            els.cardFrontText.textContent =
                'No matching words';
        }

        if (els.cardBackEnText) {
            els.cardBackEnText.textContent = '';
        }

        if (els.flashActions) {
            els.flashActions.hidden = true;
        }
    }

    function flipCard() {
        if (isAnimating) return;

        isFlipped = !isFlipped;

        els.interactiveCard?.classList.toggle(
            'flipped',
            isFlipped
        );

        if (isFlipped) {
            window.VocabSpeech?.speakEnglish(
                deck[0]?.english
            );
        }
    }

    function updateMetrics() {
        const remaining = deck.length;

        const progress =
            deckInitSize > 0
                ? Math.round(
                      (knownCount /
                          deckInitSize) *
                          100
                  )
                : 0;

        if (els.statKnown) {
            els.statKnown.textContent =
                knownCount;
        }

        if (els.statReview) {
            els.statReview.textContent =
                reviewCount;
        }

        if (els.flashCounter) {
            els.flashCounter.textContent =
                `Remaining: ${remaining} / ${deckInitSize}`;
        }

        if (els.flashPercent) {
            els.flashPercent.textContent =
                `${progress}%`;
        }

        if (els.flashProgressBar) {
            els.flashProgressBar.style.width =
                `${progress}%`;
        }
    }

    function processAction(direction) {
        if (isAnimating) return;

        if (!deck.length) return;

        if (!isFlipped) {
            flipCard();
            return;
        }

        isAnimating = true;

        const currentWord = deck[0];

        els.interactiveCard?.classList.add(
            direction === 'right'
                ? 'swipe-right'
                : 'swipe-left'
        );

        if (direction === 'right') {
            knownCount++;
            deck.shift();
        } else {
            reviewCount++;

            deck.shift();

            const reinsertIndex =
                Math.min(3, deck.length);

            deck.splice(
                reinsertIndex,
                0,
                currentWord
            );
        }

        updateMetrics();

        setTimeout(() => {
            isAnimating = false;

            if (!deck.length) {
                setMode('summary');
                return;
            }

            displayCard();
        }, 380);
    }

    function renderSummary() {
        if (els.sumKnown) {
            els.sumKnown.textContent =
                knownCount;
        }

        if (els.sumReview) {
            els.sumReview.textContent =
                reviewCount;
        }

        const score =
            deckInitSize > 0
                ? Math.round(
                      (knownCount /
                          deckInitSize) *
                          100
                  )
                : 0;

        if (els.sumMastery) {
            els.sumMastery.textContent =
                `${score}%`;
        }
    }

    function showSwipeTutorial() {
        if (!els.tutorial) return;

        if (
            localStorage.getItem(
                'nse-swipe-tutorial'
            )
        ) {
            return;
        }

        els.tutorial.classList.add('show');

        setTimeout(() => {
            els.tutorial?.classList.remove(
                'show'
            );

            localStorage.setItem(
                'nse-swipe-tutorial',
                '1'
            );
        }, 4000);
    }

    function setupSwipe() {
        if (!els.interactiveCard) return;

        let startX = 0;
        let startY = 0;
        let moveX = 0;
        let dragging = false;

        function onStart(x, y) {
            if (isAnimating) return;

            startX = x;
            startY = y;

            moveX = 0;
            dragging = true;

            els.interactiveCard.style.transition =
                'none';
        }

        function onMove(x, y) {
            if (!dragging) return;

            moveX = x - startX;

            const moveY = y - startY;

            if (
                Math.abs(moveX) >
                Math.abs(moveY)
            ) {
                const rotate =
                    moveX * 0.08;

                const flip =
                    isFlipped
                        ? ' rotateY(180deg)'
                        : '';

                els.interactiveCard.style.transform =
                    `translate3d(${moveX}px,0,0) rotate(${rotate}deg)${flip}`;
            }
        }

        function onEnd() {
            if (!dragging) return;

            dragging = false;

            els.interactiveCard.style.transition =
                '';

            els.interactiveCard.style.transform =
                '';

            if (moveX > DRAG_THRESHOLD) {
                processAction('right');
            } else if (
                moveX < -DRAG_THRESHOLD
            ) {
                processAction('left');
            }

            moveX = 0;
        }

        els.interactiveCard.addEventListener(
            'touchstart',
            e =>
                onStart(
                    e.touches[0].clientX,
                    e.touches[0].clientY
                ),
            { passive: true }
        );

        els.interactiveCard.addEventListener(
            'touchmove',
            e =>
                onMove(
                    e.touches[0].clientX,
                    e.touches[0].clientY
                ),
            { passive: true }
        );

        els.interactiveCard.addEventListener(
            'touchend',
            onEnd
        );

        els.interactiveCard.addEventListener(
            'mousedown',
            e => {
                if (
                    e.target.closest(
                        '#cardAudioBtn'
                    )
                ) {
                    return;
                }

                onStart(
                    e.clientX,
                    e.clientY
                );
            }
        );

        window.addEventListener(
            'mousemove',
            e =>
                onMove(
                    e.clientX,
                    e.clientY
                )
        );

        window.addEventListener(
            'mouseup',
            onEnd
        );
    }

    function setupKeyboard() {
        document.addEventListener(
            'keydown',
            e => {
                if (
                    activeMode !==
                    'flashcards'
                ) {
                    return;
                }

                if (
                    e.target.matches(
                        'input, textarea, select'
                    )
                ) {
                    return;
                }

                if (
                    e.key === ' ' ||
                    e.key === 'Enter'
                ) {
                    e.preventDefault();
                    flipCard();
                }

                if (
                    e.key === 'ArrowRight'
                ) {
                    e.preventDefault();
                    processAction('right');
                }

                if (
                    e.key === 'ArrowLeft'
                ) {
                    e.preventDefault();
                    processAction('left');
                }
            }
        );
    }

    els.modeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            setMode(btn.dataset.studyMode);
        });
    });

    els.search?.addEventListener(
        'input',
        () => {
            filterWords();

            if (activeMode === 'list') {
                renderList();
            } else if (
                activeMode ===
                'flashcards'
            ) {
                initDeck();
            }
        }
    );

    root
        .querySelectorAll('[data-speak-word]')
        .forEach(btn => {
            btn.addEventListener(
                'click',
                e => {
                    e.stopPropagation();

                    window.VocabSpeech?.speakEnglish(
                        btn.dataset
                            .speakWord
                    );
                }
            );
        });

    els.interactiveCard?.addEventListener(
        'click',
        e => {
            if (
                e.target.closest(
                    '#cardAudioBtn'
                )
            ) {
                return;
            }

            flipCard();
        }
    );

    els.cardAudioBtn?.addEventListener(
        'click',
        e => {
            e.stopPropagation();

            window.VocabSpeech?.speakEnglish(
                deck[0]?.english
            );
        }
    );

    els.actionKnowBtn?.addEventListener(
        'click',
        () => processAction('right')
    );

    els.actionReviewBtn?.addEventListener(
        'click',
        () => processAction('left')
    );

    els.flashShuffle?.addEventListener(
        'click',
        () => {
            filteredWords =
                shuffle(filteredWords);

            initDeck();
        }
    );

    els.btnRestart?.addEventListener(
        'click',
        () => {
            setMode('flashcards');
        }
    );

    els.pagePrev?.addEventListener(
        'click',
        () => {
            if (currentPage > 1) {
                currentPage--;
                renderList();
            }
        }
    );

    els.pageNext?.addEventListener(
        'click',
        () => {
            if (
                currentPage <
                totalPages
            ) {
                currentPage++;
                renderList();
            }
        }
    );

    setupSwipe();
    setupKeyboard();

    filterWords();
    setMode(activeMode);
})();