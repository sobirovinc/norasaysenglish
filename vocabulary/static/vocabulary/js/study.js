/**
 * Unit vocabulary study — list mode and flashcards.
 */
(function initStudyPage() {
    const root = document.getElementById('studyRoot');
    if (!root) {
        return;
    }

    const MODE_KEY = 'nse-study-mode';
    const dataEl = document.getElementById('studyWordsData');
    let allWords = [];

    try {
        allWords = JSON.parse(dataEl?.textContent || '[]');
    } catch (error) {
        allWords = [];
    }

    const els = {
        search: document.getElementById('studySearch'),
        modeButtons: root.querySelectorAll('[data-study-mode]'),
        listPanel: document.getElementById('studyListPanel'),
        listGrid: document.getElementById('studyListGrid'),
        listCards: root.querySelectorAll('.vocab-card[data-word-id]'),
        listEmpty: document.getElementById('studyListEmpty'),
        flashPanel: document.getElementById('studyFlashPanel'),
        flashCard: document.getElementById('studyFlashCard'),
        flashUzbek: document.getElementById('studyFlashUzbek'),
        flashEnglish: document.getElementById('studyFlashEnglish'),
        flashEnglishContainer: document.getElementById('studyFlashEnglishContainer'),
        flashReveal: document.getElementById('studyFlashReveal'),
        flashSpeak: document.getElementById('studyFlashSpeak'),
        flashPrev: document.getElementById('studyFlashPrev'),
        flashNext: document.getElementById('studyFlashNext'),
        flashShuffle: document.getElementById('studyFlashShuffle'),
        flashProgress: document.getElementById('studyFlashProgress'),
        countLabel: document.getElementById('studyCountLabel'),
    };

    let filteredWords = [...allWords];
    let flashIndex = 0;
    let flashRevealed = false;
    let activeMode = sessionStorage.getItem(MODE_KEY) || 'list';

    function normalizeQuery(value) {
        return String(value || '').trim().toLowerCase();
    }

    function filterWords() {
        const query = normalizeQuery(els.search?.value);
        if (!query) {
            filteredWords = [...allWords];
            return;
        }

        filteredWords = allWords.filter((word) => (
            word.uzbek.toLowerCase().includes(query)
            || word.english.toLowerCase().includes(query)
        ));
    }

    function updateCountLabel() {
        if (!els.countLabel) {
            return;
        }

        const total = allWords.length;
        const shown = filteredWords.length;
        if (shown === total) {
            els.countLabel.textContent = `${total} Word${total === 1 ? '' : 's'}`;
        } else {
            els.countLabel.textContent = `${shown} of ${total} Words`;
        }
    }

    function setMode(mode) {
        activeMode = mode === 'flashcards' ? 'flashcards' : 'list';
        sessionStorage.setItem(MODE_KEY, activeMode);

        els.modeButtons.forEach((button) => {
            const isActive = button.dataset.studyMode === activeMode;
            button.classList.toggle('is-active', isActive);
            button.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        if (els.listPanel) {
            els.listPanel.hidden = activeMode !== 'list';
        }
        if (els.flashPanel) {
            els.flashPanel.hidden = activeMode !== 'flashcards';
        }

        if (activeMode === 'flashcards') {
            flashIndex = Math.min(flashIndex, Math.max(0, filteredWords.length - 1));
            renderFlashcard();
        } else {
            renderList();
        }
    }

    function renderList() {
        if (!els.listGrid || !els.listCards.length) {
            return;
        }

        const visibleIds = new Set(filteredWords.map((word) => String(word.id)));

        els.listCards.forEach((card) => {
            card.hidden = !visibleIds.has(card.dataset.wordId);
        });

        if (els.listEmpty) {
            els.listEmpty.hidden = filteredWords.length > 0;
        }
        updateCountLabel();
    }

    function renderFlashcard() {
        if (!els.flashCard) {
            return;
        }

        const word = filteredWords[flashIndex];
        flashRevealed = false;

        if (!word) {
            els.flashUzbek.textContent = 'No matches';
            els.flashEnglish.textContent = '';
            els.flashEnglishContainer.hidden = true;
            els.flashReveal.hidden = true;
            els.flashSpeak.hidden = true;
            els.flashProgress.textContent = 'Card 0 of 0';
            els.flashPrev.disabled = true;
            els.flashNext.disabled = true;
            updateCountLabel();
            return;
        }

        els.flashUzbek.textContent = word.uzbek;
        els.flashEnglish.textContent = word.english;
        els.flashEnglishContainer.hidden = true;
        els.flashReveal.hidden = false;
        els.flashSpeak.hidden = true;
        els.flashCard.classList.remove('is-revealed');
        els.flashProgress.textContent = `Card ${flashIndex + 1} of ${filteredWords.length}`;
        els.flashPrev.disabled = flashIndex <= 0;
        els.flashNext.disabled = flashIndex >= filteredWords.length - 1;
        updateCountLabel();
    }

    function revealFlashcard() {
        const word = filteredWords[flashIndex];
        if (!word || flashRevealed) {
            return;
        }

        flashRevealed = true;
        els.flashEnglishContainer.hidden = false;
        els.flashReveal.hidden = true;
        els.flashSpeak.hidden = false;
        els.flashCard.classList.add('is-revealed');
    }

    function shuffleFilteredWords() {
        if (filteredWords.length <= 1) {
            return;
        }

        for (let i = filteredWords.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [filteredWords[i], filteredWords[j]] = [filteredWords[j], filteredWords[i]];
        }

        flashIndex = 0;
        renderFlashcard();
    }

    function onSearchInput() {
        filterWords();
        flashIndex = 0;
        if (activeMode === 'list') {
            renderList();
        } else {
            renderFlashcard();
        }
    }

    els.modeButtons.forEach((button) => {
        button.addEventListener('click', () => {
            setMode(button.dataset.studyMode);
        });
    });

    els.search?.addEventListener('input', onSearchInput);

    root.querySelectorAll('[data-speak-word]').forEach((button) => {
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            window.VocabSpeech?.speakEnglish(button.dataset.speakWord);
        });
    });

    els.flashCard?.addEventListener('click', () => {
        if (!flashRevealed) {
            revealFlashcard();
        }
    });

    els.flashReveal?.addEventListener('click', (event) => {
        event.stopPropagation();
        revealFlashcard();
    });

    els.flashSpeak?.addEventListener('click', (event) => {
        event.stopPropagation();
        const word = filteredWords[flashIndex];
        if (word) {
            window.VocabSpeech?.speakEnglish(word.english);
        }
    });

    els.flashPrev?.addEventListener('click', () => {
        if (flashIndex > 0) {
            flashIndex -= 1;
            renderFlashcard();
        }
    });

    els.flashNext?.addEventListener('click', () => {
        if (flashIndex < filteredWords.length - 1) {
            flashIndex += 1;
            renderFlashcard();
        }
    });

    els.flashShuffle?.addEventListener('click', () => {
        shuffleFilteredWords();
    });

    filterWords();
    setMode(activeMode);
})();
