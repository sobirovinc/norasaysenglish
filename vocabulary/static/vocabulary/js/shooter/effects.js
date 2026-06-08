/**
 * DOM-layer visual effects (ship, laser, explosion) over the Phaser canvas.
 */
const ShooterEffects = {
    getShip() {
        return document.getElementById('playerShip');
    },

    getStage() {
        return document.getElementById('shooterStage');
    },

    canvasToScreen(scene, canvasX, canvasY) {
        const canvas = scene.game.canvas;
        const rect = canvas.getBoundingClientRect();
        const scaleX = rect.width / scene.scale.width;
        const scaleY = rect.height / scene.scale.height;
        return {
            x: rect.left + canvasX * scaleX,
            y: rect.top + canvasY * scaleY,
        };
    },

    moveShipTo(scene, canvasX) {
        const ship = this.getShip();
        if (!ship) {
            return;
        }

        const shipOffset = scene.isMobileLayout ? 28 : 48;
        const pos = this.canvasToScreen(scene, canvasX, scene.scale.height - shipOffset);
        ship.style.left = `${pos.x}px`;
        ship.style.top = `${pos.y}px`;
    },

    shipOrigin(scene) {
        const ship = this.getShip();
        if (!ship) {
            const shipOffset = scene.isMobileLayout ? 28 : 48;
            return this.canvasToScreen(scene, scene.scale.width / 2, scene.scale.height - shipOffset);
        }

        const rect = ship.getBoundingClientRect();
        return {
            x: rect.left + rect.width * 0.5,
            y: rect.top + rect.height * 0.35,
        };
    },

    spawnLaser(scene, enemy) {
        const start = this.shipOrigin(scene);
        const end = this.canvasToScreen(scene, enemy.x, enemy.y);

        const beam = document.createElement('div');
        beam.className = 'shooter-laser';
        document.body.appendChild(beam);

        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        beam.style.left = `${start.x}px`;
        beam.style.top = `${start.y}px`;
        beam.style.width = '0px';
        beam.style.transform = `rotate(${angle}deg)`;

        requestAnimationFrame(() => {
            beam.style.width = `${length}px`;
        });

        if (window.ShooterAudio) {
            ShooterAudio.play('laser');
        }

        window.setTimeout(() => beam.remove(), 320);
    },

    spawnExplosion(scene, enemy) {
        const pos = this.canvasToScreen(scene, enemy.x, enemy.y);
        const boom = document.createElement('div');
        boom.className = 'shooter-explosion';
        boom.style.left = `${pos.x}px`;
        boom.style.top = `${pos.y}px`;
        document.body.appendChild(boom);

        if (window.ShooterAudio) {
            ShooterAudio.play('explosion');
        }

        window.setTimeout(() => boom.remove(), 650);
    },
};

window.ShooterEffects = ShooterEffects;
