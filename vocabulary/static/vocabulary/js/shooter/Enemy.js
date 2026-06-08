/**
 * Falling enemy with Uzbek label and English spelling progress.
 */
class Enemy {
    static MIN_SPEED = 0.48;
    static MAX_SPEED = 2.4;
    static BASE_SPEED = 0.52;
    static PIXELS_PER_SECOND = 32;

    constructor(scene, word, x, y) {
        this.scene = scene;
        this.wordId = word.id;
        this.uzbek = word.uzbek;
        this.english = word.english.toLowerCase();
        this.typedLength = 0;
        this.speed = Enemy.BASE_SPEED;
        this.isDestroyed = false;
        this.flashTimer = null;
        this.floatY = y;

        const compact = Boolean(scene.isMobileLayout);
        const width = Math.max(
            compact ? 84 : 108,
            this.english.length * 14 + (compact ? 16 : 36),
        );
        const height = compact ? 34 : 46;
        const uzbekY = compact ? -6 : -8;
        const progressY = compact ? 8 : 10;

        this.container = scene.add.container(x, y);
        this.bg = scene.add.rectangle(0, 0, width, height, 0x172554, 0.9);
        this.bg.setStrokeStyle(1, 0x60a5fa, 0.45);

        this.uzbekText = scene.add.text(0, uzbekY, this.uzbek, {
            fontFamily: 'Nunito, Arial, sans-serif',
            fontSize: '13px',
            color: '#e0f2fe',
            fontStyle: 'bold',
        }).setOrigin(0.5);

        this.progressText = scene.add.text(0, progressY, '', {
            fontFamily: 'Consolas, monospace',
            fontSize: '12px',
            color: '#6b7c93',
        }).setOrigin(0.5);

        this.container.add([this.bg, this.uzbekText, this.progressText]);
        this.updateProgressDisplay();
    }

    get y() {
        return this.floatY;
    }

    set y(value) {
        this.floatY = value;
        this.container.y = value;
    }

    get x() {
        return this.container.x;
    }

    updateProgressDisplay() {
        const parts = [];
        for (let i = 0; i < this.english.length; i += 1) {
            parts.push(i < this.typedLength ? this.english[i] : '●');
        }
        this.progressText.setText(parts.join(' '));

        if (this.typedLength === 0) {
            this.progressText.setColor('#6b7c93');
        } else {
            this.progressText.setColor('#4ade80');
        }
    }

    typeLetter() {
        this.typedLength += 1;
        this.updateProgressDisplay();
    }

    slowDown() {
        this.speed = Phaser.Math.Clamp(this.speed * 0.95, Enemy.MIN_SPEED, Enemy.MAX_SPEED);
    }

    speedUp() {
        this.speed = Phaser.Math.Clamp(this.speed * 1.1, Enemy.MIN_SPEED, Enemy.MAX_SPEED);
    }

    update(delta) {
        if (this.isDestroyed) {
            return;
        }

        const dt = Math.min(delta, 48) / 1000;
        this.floatY += this.speed * Enemy.PIXELS_PER_SECOND * dt;
        this.container.y = this.floatY;
    }

    flashWrong() {
        this.clearFlash();
        this.uzbekText.setTint(0xff6b6b);
        this.progressText.setTint(0xff6b6b);
        this.bg.setFillStyle(0x7f1d1d, 0.95);
        this.flashTimer = this.scene.time.delayedCall(1000, () => {
            if (!this.isDestroyed) {
                this.uzbekText.clearTint();
                this.progressText.clearTint();
                this.bg.setFillStyle(0x172554, 0.9);
            }
        });
    }

    pulseCorrect() {
        this.clearFlash();
        this.bg.setFillStyle(0x1a4d35, 0.95);
        this.scene.tweens.add({
            targets: this.container,
            y: this.floatY - 4,
            duration: 80,
            yoyo: true,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                if (!this.isDestroyed) {
                    this.container.y = this.floatY;
                    this.bg.setFillStyle(0x172554, 0.9);
                }
            },
        });
    }

    clearFlash() {
        if (this.flashTimer) {
            this.flashTimer.remove(false);
            this.flashTimer = null;
        }
    }

    destroyQuietly() {
        if (this.isDestroyed) {
            return;
        }
        this.isDestroyed = true;
        this.clearFlash();
        this.container.destroy(true);
    }
}

window.Enemy = Enemy;
