import { CONFIG } from "./game.js";
import { GeneticAlgorithm } from "./genetic.js";
import { Renderer } from "./render.js";

const TAU = Math.PI * 2;
const ARENA = 1000;
const STEP = 1 / 30;
const FOOD_COUNT = 120;
const INPUTS = 12;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const food = () => ({ x: (Math.random() * 2 - 1) * (ARENA - 55), y: (Math.random() * 2 - 1) * (ARENA - 55), type: Math.floor(Math.random() * 3), phase: Math.random() * TAU });

class Snake {
    constructor(x, y, angle, skin, startingLength = 2) {
        Object.assign(this, { x, y, angle, skin, length: startingLength, score: 0, radius: CONFIG.snakeRadius, path: [], body: [] });
        for (let i = 0; i < 240; i++) this.path.push({ x: x - Math.cos(angle) * i * 2, y: y - Math.sin(angle) * i * 2 });
    }
    get speed() { return CONFIG.startSpeed + (CONFIG.maxSpeed - CONFIG.startSpeed) * clamp((this.length - 2) / 58, 0, 1); }
    update(action) {
        const turnRate = this.skin === "enemy" ? 2.8 : 3.4;
        if (action === 0) this.angle -= turnRate * STEP;
        if (action === 2) this.angle += turnRate * STEP;
        this.angle = wrap(this.angle);
        this.x += Math.cos(this.angle) * this.speed * STEP;
        this.y += Math.sin(this.angle) * this.speed * STEP;
        this.path.unshift({ x: this.x, y: this.y });
        this.path.length = Math.min(this.path.length, Math.ceil(this.length * CONFIG.segmentSpacing + 500));
        const body = []; let travelled = 0; let target = CONFIG.segmentSpacing;
        for (let i = 0; i < this.path.length - 1 && body.length < Math.floor(this.length); i++) {
            const a = this.path[i], b = this.path[i + 1], dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy);
            if (!distance) continue;
            while (travelled + distance >= target && body.length < Math.floor(this.length)) {
                const ratio = (target - travelled) / distance;
                body.push({ x: a.x + dx * ratio, y: a.y + dy * ratio, angle: Math.atan2(dy, dx) }); target += CONFIG.segmentSpacing;
            }
            travelled += distance;
        }
        this.body = body;
    }
}

function brainInputs(enemy, target, orbs) {
    const relative = wrap(Math.atan2(target.y - enemy.y, target.x - enemy.x) - enemy.angle);
    const nearest = orbs.reduce((a, b) => dist2(enemy, a) < dist2(enemy, b) ? a : b, orbs[0]);
    const foodAngle = wrap(Math.atan2(nearest.y - enemy.y, nearest.x - enemy.x) - enemy.angle);
    return [Math.sin(relative), Math.cos(relative), clamp(Math.hypot(target.x - enemy.x, target.y - enemy.y) / ARENA, 0, 1), Math.sin(foodAngle), Math.cos(foodAngle), enemy.x / ARENA, enemy.y / ARENA, target.x / ARENA, target.y / ARENA, clamp(enemy.length / 60, 0, 1), Math.sin(enemy.angle), Math.cos(enemy.angle)];
}
function action(network, snake, target, orbs) {
    if (!network) { const a = wrap(Math.atan2(target.y - snake.y, target.x - snake.x) - snake.angle); return a < -0.15 ? 0 : a > 0.15 ? 2 : 1; }
    const result = network.activate(brainInputs(snake, target, orbs));
    return result[0] > result[1] && result[0] > result[2] ? 0 : result[2] > result[1] ? 2 : 1;
}
function eat(snake, orbs) {
    for (let i = 0; i < orbs.length; i++) {
        orbs[i].phase = (orbs[i].phase + STEP * 2) % TAU;
        if (dist2(snake, orbs[i]) < 42 ** 2) { snake.length += CONFIG.orbGrowth; snake.score += CONFIG.orbScore; orbs[i] = food(); return 1; }
    }
    return 0;
}
function bodyHit(head, snake) { return snake.body.slice(2).some(part => dist2(head, part) < 24 ** 2); }

export class ArenaGame {
    constructor(canvas, network = null, autoPlayer = false) {
        this.renderer = new Renderer(canvas);
        this.network = network;
        this.autoPlayer = autoPlayer;
        this.trainingArena = true;
        this.arenaSize = ARENA;
        this.keys = new Set();
        this.status = "";
        this.gameOver = false;
        this.result = null;
        this.onGameOver = null;
        this.reset();
        this.down = e => {
            const k = e.key.toLowerCase();
            if (["w", "a", "s", "d"].includes(k)) {
                e.preventDefault();
                this.keys.add(k);
            }
        };
        this.up = e => this.keys.delete(e.key.toLowerCase());
        window.addEventListener("keydown", this.down);
        window.addEventListener("keyup", this.up);
    }
    reset(status = "") {
        this.status = status;
        this.gameOver = false;
        this.result = null;
        this.snake = new Snake(120, 0, Math.PI, "player", 4);
        this.enemy = new Snake(-120, 0, 0, "enemy", 4);
        this.enemies = [this.enemy];
        this.food = Array.from({ length: FOOD_COUNT }, food);
    }
    update() {
        if (this.gameOver) return;
        let playerAction = action(null, this.snake, this.enemy, this.food);
        if (!this.autoPlayer) {
            let dx = 0;
            let dy = 0;
            if (this.keys.has("w")) dy--;
            if (this.keys.has("s")) dy++;
            if (this.keys.has("a")) dx--;
            if (this.keys.has("d")) dx++;
            if (dx || dy) {
                const difference = wrap(Math.atan2(dy, dx) - this.snake.angle);
                playerAction = difference < -0.08 ? 0 : difference > 0.08 ? 2 : 1;
            } else {
                playerAction = 1;
            }
        }
        this.snake.update(playerAction);
        this.enemy.update(action(this.network, this.enemy, this.snake, this.food));
        eat(this.snake, this.food);
        eat(this.enemy, this.food);
        const playerDead = Math.abs(this.snake.x) >= ARENA || Math.abs(this.snake.y) >= ARENA || bodyHit(this.snake, this.enemy);
        const enemyDead = Math.abs(this.enemy.x) >= ARENA || Math.abs(this.enemy.y) >= ARENA || bodyHit(this.enemy, this.snake);
        if (playerDead || enemyDead) {
            this.gameOver = true;
            this.result = playerDead ? "defeat" : "victory";
            this.status = playerDead ? "ENEMY ENGULFED YOU" : "YOU OUTMANEUVERED THE ENEMY";
            if (this.onGameOver) this.onGameOver(this.result);
        }
    }
    resize() { this.renderer.resize(); }
    draw(dt) { this.renderer.render(this, dt); }
    destroy() {
        window.removeEventListener("keydown", this.down);
        window.removeEventListener("keyup", this.up);
    }
}

class Episode {
    constructor(network) {
        this.network = network; this.enemy = new Snake(-300, 0, 0, "enemy"); this.target = new Snake(300, 0, Math.PI, "player"); this.snake = this.enemy; this.enemies = [this.target]; this.food = Array.from({ length: FOOD_COUNT }, food); this.trainingArena = true; this.arenaSize = ARENA; this.done = false; this.steps = 0; this.fitness = 0;
    }
    update() {
        if (this.done) return;
        const before = Math.hypot(this.target.x - this.enemy.x, this.target.y - this.enemy.y);
        this.target.update(action(null, this.target, this.enemy, this.food)); this.enemy.update(action(this.network, this.enemy, this.target, this.food));
        this.fitness += eat(this.enemy, this.food) * 15; eat(this.target, this.food);
        const after = Math.hypot(this.target.x - this.enemy.x, this.target.y - this.enemy.y); this.fitness += clamp((before - after) * 0.03, -1, 1) + 0.02;
        if (bodyHit(this.target, this.enemy)) { this.fitness += 300; this.done = true; }
        if (bodyHit(this.enemy, this.target) || Math.abs(this.enemy.x) >= ARENA || Math.abs(this.enemy.y) >= ARENA || this.steps++ >= 900) this.done = true;
    }
}

export class EnemyTrainer {
    constructor(onProgress) {
        this.algorithm = new GeneticAlgorithm({ populationSize: 32, inputCount: INPUTS, hiddenCount: 18, outputCount: 3, eliteCount: 4, mutationRate: 0.1, mutationStrength: 0.25 }); this.generation = 1; this.index = 0; this.onProgress = onProgress; this.running = true; this.currentEpisode = new Episode(this.algorithm.population[0].network); this.report();
    }
    report() { this.onProgress({ generation: this.generation, episode: this.index + 1, population: this.algorithm.population.length }); }
    update() {
        for (let i = 0; this.running && i < 35; i++) { this.currentEpisode.update(); if (!this.currentEpisode.done) continue; this.algorithm.population[this.index].fitness = this.currentEpisode.fitness; this.index++; if (this.index === this.algorithm.population.length) { this.algorithm.rankPopulation(); this.algorithm.saveToStorage("snake-arena-enemy-ai"); this.algorithm.nextGeneration(); this.generation++; this.index = 0; } this.currentEpisode = new Episode(this.algorithm.population[this.index].network); this.report(); }
    }
    stop() { this.running = false; }
}
export function loadEnemyChampion() { const algorithm = new GeneticAlgorithm({ inputCount: INPUTS, hiddenCount: 18, outputCount: 3 }); return algorithm.loadFromStorage("snake-arena-enemy-ai") ? algorithm.bestNetwork : null; }
