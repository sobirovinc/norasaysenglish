/**
 * Custom on-screen keyboard for mobile spelling shooter.
 */
(function initShooterKeyboard() {
    const ROWS = [
        'qwertyuiop'.split(''),
        'asdfghjkl'.split(''),
        'zxcvbnm'.split(''),
    ];

    function isMobileLayout() {
        return window.matchMedia('(max-width: 640px)').matches;
    }

    function buildKeyboard() {
        const keyboard = document.getElementById('shooterKeyboard');
        if (!keyboard || keyboard.dataset.built === 'true') {
            return keyboard;
        }

        keyboard.innerHTML = '';
        ROWS.forEach((row) => {
            const rowEl = document.createElement('div');
            rowEl.className = 'shooter-keyboard-row';
            row.forEach((letter) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'shooter-key';
                btn.dataset.letter = letter;
                btn.textContent = letter.toUpperCase();
                btn.setAttribute('aria-label', `Letter ${letter}`);
                rowEl.appendChild(btn);
            });
            keyboard.appendChild(rowEl);
        });

        keyboard.dataset.built = 'true';
        return keyboard;
    }

    function flashKey(button) {
        button.classList.add('is-pressed');
        window.setTimeout(() => button.classList.remove('is-pressed'), 90);
    }

    function bindKeyboard(getScene) {
        if (!isMobileLayout()) {
            return;
        }

        const keyboard = buildKeyboard();
        if (!keyboard || keyboard.dataset.bound === 'true') {
            return;
        }

        keyboard.dataset.bound = 'true';
        keyboard.querySelectorAll('.shooter-key').forEach((button) => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                const scene = getScene();
                if (!scene || scene.isPaused || scene.isGameOver || scene.hasWon) {
                    return;
                }

                const letter = button.dataset.letter;
                if (letter) {
                    if (window.ShooterAudio) {
                        ShooterAudio.unlock();
                    }
                    scene.dismissIntroHint();
                    scene.handleLetter(letter);
                    flashKey(button);
                    if (navigator.vibrate) {
                        navigator.vibrate(8);
                    }
                }
            });
        });
    }

    window.initShooterKeyboard = bindKeyboard;
    window.isShooterMobileLayout = isMobileLayout;
})();
