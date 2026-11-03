
import { Renderer } from "./render.js";

export const CONFIG = {
    orbCount: 650,
    orbSpawnRadius: 1550,
    orbDespawnRadius: 2300,

    orbSize: 36,
    orbGrowth: 0.35,
    orbScore: 10,

    segmentSpacing: 12,
    snakeRadius: 16,

    startSpeed: 95,
    maxSpeed: 150,
    turnSpeed: 4.8,

    startLength: 2,
    maxSpeedLength: 60
};

const TAU = Math.PI * 2;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function wrapAngle(angle) {
    return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function distanceSquared(x1, y1, x2, y2) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return dx * dx + dy * dy;
}

class Snake {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.angle = 0;

        this.length = CONFIG.startLength;
        this.score = 0;
        this.radius = CONFIG.snakeRadius;

        this.path = [];
        this.body = [];

        for (let i = 0; i < 200; i++) {
            this.path.push({
                x: -i * 2,
                y: 0
            });
        }
    }

    get speed() {
        const progress = clamp(
            (this.length - CONFIG.startLength) /
            (CONFIG.maxSpeedLength - CONFIG.startLength),
            0,
            1
        );

        return CONFIG.startSpeed +
            (CONFIG.maxSpeed - CONFIG.startSpeed) * progress;
    }

    update(dt, targetAngle) {
        if (targetAngle !== null) {
            const difference = wrapAngle(targetAngle - this.angle);
            const maxTurn = CONFIG.turnSpeed * dt;

            this.angle += clamp(
                difference,
                -maxTurn,
                maxTurn
            );
        }

        this.x += Math.cos(this.angle) * this.speed * dt;
        this.y += Math.sin(this.angle) * this.speed * dt;

        this.path.unshift({
            x: this.x,
            y: this.y
        });

        const maxPoints = Math.ceil(
            this.length * CONFIG.segmentSpacing + 500
        );

        if (this.path.length > maxPoints) {
            this.path.length = maxPoints;
        }

        this.updateBody();
    }

    updateBody() {
        const body = [];
        let travelled = 0;
        let targetDistance = CONFIG.segmentSpacing;

        const maxSegments = Math.floor(this.length);

        for (let i = 0; i < this.path.length - 1; i++) {
            const p1 = this.path[i];
            const p2 = this.path[i + 1];

            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const segmentDistance = Math.hypot(dx, dy);

            if (segmentDistance === 0) continue;

            while (
                travelled + segmentDistance >= targetDistance &&
                body.length < maxSegments
            ) {
                const ratio =
                    (targetDistance - travelled) / segmentDistance;

                body.push({
                    x: p1.x + dx * ratio,
                    y: p1.y + dy * ratio,
                    angle: Math.atan2(dy, dx)
                });

                targetDistance += CONFIG.segmentSpacing;
            }

            travelled += segmentDistance;

            if (body.length >= maxSegments) break;
        }

        this.body = body;
    }
}

class Orb {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.type = Math.floor(Math.random() * 3);
        this.phase = Math.random() * TAU;
    }

    update(dt) {
        this.phase = (this.phase + dt * 2) % TAU;
    }
}

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new Renderer(canvas);

        this.snake = new Snake();
        this.orbs = [];

        this.paused = false;
        this.keys = new Set();

        this.bindControls();
        this.spawnOrbs(CONFIG.orbCount);
    }

    bindControls() {
        this.onKeyDown = event => {
            const key = event.key.toLowerCase();

            if (["w", "a", "s", "d"].includes(key)) {
                event.preventDefault();
                this.keys.add(key);
            }
        };

        this.onKeyUp = event => {
            this.keys.delete(event.key.toLowerCase());
        };

        window.addEventListener("keydown", this.onKeyDown);
        window.addEventListener("keyup", this.onKeyUp);
    }

    getDirection() {
        let dx = 0;
        let dy = 0;

        if (this.keys.has("w")) dy--;
        if (this.keys.has("s")) dy++;
        if (this.keys.has("a")) dx--;
        if (this.keys.has("d")) dx++;

        if (dx === 0 && dy === 0) {
            return null;
        }

        return Math.atan2(dy, dx);
    }

    spawnOrbs(amount) {
        for (let i = 0; i < amount; i++) {
            const angle = Math.random() * TAU;
            const radius = 200 + Math.random() * CONFIG.orbSpawnRadius;

            this.orbs.push(new Orb(
                this.snake.x + Math.cos(angle) * radius,
                this.snake.y + Math.sin(angle) * radius
            ));
        }
    }

    update(dt) {
        if (this.paused) return;

        dt = Math.min(dt, 1 / 30);

        this.snake.update(dt, this.getDirection());

        const remaining = [];

        const collectionRadius =
            this.snake.radius + CONFIG.orbSize / 2 + 5;

        const collectionRadiusSq = collectionRadius ** 2;
        const despawnRadiusSq = CONFIG.orbDespawnRadius ** 2;

        for (const orb of this.orbs) {
            orb.update(dt);

            const distSq = distanceSquared(
                this.snake.x,
                this.snake.y,
                orb.x,
                orb.y
            );

            if (distSq < collectionRadiusSq) {
                this.snake.length += CONFIG.orbGrowth;
                this.snake.score += CONFIG.orbScore;
            } else if (distSq < despawnRadiusSq) {
                remaining.push(orb);
            }
        }

        this.orbs = remaining;

        if (this.orbs.length < CONFIG.orbCount) {
            this.spawnOrbs(Math.min(
                35,
                CONFIG.orbCount - this.orbs.length
            ));
        }
    }

    draw(dt = 1 / 60) {
        this.renderer.render(this, dt);
    }

    resize() {
        this.renderer.resize();
    }

    destroy() {
        window.removeEventListener("keydown", this.onKeyDown);
        window.removeEventListener("keyup", this.onKeyUp);
    }
}
