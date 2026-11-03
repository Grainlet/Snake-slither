
import { CONFIG } from "./game.js";
import { GeneticAlgorithm } from "./genetic.js";
import { Fitness } from "./rewards.js";

const INPUT_COUNT = 24;
const OUTPUT_COUNT = 3;

const ARENA_SIZE = 1000;
const EPISODE_TIME = 30;
const STEP_TIME = 1 / 30;

const FOOD_COUNT = 100;
const SENSOR_DISTANCE = 260;
const SENSOR_STEP = 30;
const TRAINING_TURN_SPEED = 2.6;
const MAX_TURN_STEPS = 8;

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

function randomFood() {
    return {
        x: (Math.random() * 2 - 1) * (ARENA_SIZE - 60),
        y: (Math.random() * 2 - 1) * (ARENA_SIZE - 60),
        type: Math.floor(Math.random() * 3),
        phase: Math.random() * TAU
    };
}

class TrainingSnake {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.angle = 0;

        this.length = CONFIG.startLength;
        this.score = 0;

        this.path = [];
        this.body = [];

        this.lastAction = 1;
        this.turnSteps = 0;

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

    update(dt, action) {
        this.lastAction = action;

        if (action === 0) {
            this.angle -= TRAINING_TURN_SPEED * dt;
        } else if (action === 2) {
            this.angle += TRAINING_TURN_SPEED * dt;
        }

        this.angle = wrapAngle(this.angle);

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

    getInputs(food) {
        const inputs = [];

        for (let i = 0; i < 8; i++) {
            const rayAngle = this.angle + (i / 8) * TAU;
            let dangerDistance = SENSOR_DISTANCE;

            for (
                let distance = SENSOR_STEP;
                distance <= SENSOR_DISTANCE;
                distance += SENSOR_STEP
            ) {
                const x = this.x + Math.cos(rayAngle) * distance;
                const y = this.y + Math.sin(rayAngle) * distance;

                if (
                    Math.abs(x) >= ARENA_SIZE ||
                    Math.abs(y) >= ARENA_SIZE
                ) {
                    dangerDistance = distance;
                    break;
                }

                let hitBody = false;

                for (let j = 5; j < this.body.length; j += 3) {
                    const segment = this.body[j];

                    if (
                        distanceSquared(
                            x,
                            y,
                            segment.x,
                            segment.y
                        ) < 22 * 22
                    ) {
                        dangerDistance = distance;
                        hitBody = true;
                        break;
                    }
                }

                if (hitBody) break;
            }

            inputs.push(1 - dangerDistance / SENSOR_DISTANCE);
        }

        const foodSensors = Array(8).fill(0);

        for (const orb of food) {
            const dx = orb.x - this.x;
            const dy = orb.y - this.y;
            const distance = Math.hypot(dx, dy);

            if (distance === 0) continue;

            const angle = wrapAngle(
                Math.atan2(dy, dx) - this.angle
            );

            const sector = (
                Math.round((angle / TAU) * 8) + 8
            ) % 8;

            const value = 1 - clamp(distance / 600, 0, 1);

            foodSensors[sector] = Math.max(
                foodSensors[sector],
                value
            );
        }

        inputs.push(...foodSensors);

        inputs.push(Math.sin(this.angle));
        inputs.push(Math.cos(this.angle));

        inputs.push(this.x / ARENA_SIZE);
        inputs.push(this.y / ARENA_SIZE);

        inputs.push(clamp(this.length / 60, 0, 1));
        inputs.push(clamp(this.score / 1000, 0, 1));

        inputs.push(this.lastAction - 1);
        inputs.push(1);

        return inputs;
    }

    isDead() {
        if (
            Math.abs(this.x) >= ARENA_SIZE ||
            Math.abs(this.y) >= ARENA_SIZE
        ) {
            return true;
        }

        for (let i = 5; i < this.body.length; i += 2) {
            const segment = this.body[i];

            if (
                distanceSquared(
                    this.x,
                    this.y,
                    segment.x,
                    segment.y
                ) < 20 * 20
            ) {
                return true;
            }
        }

        return false;
    }
}

export class Episode {
    constructor(network) {
        this.network = network;
        this.snake = new TrainingSnake();
        this.fitness = new Fitness();

        this.food = Array.from(
            { length: FOOD_COUNT },
            randomFood
        );

        this.trainingArena = true;
        this.arenaSize = ARENA_SIZE;

        this.steps = 0;
        this.done = false;
        this.time = 0;
    }

    update() {
        if (this.done) return;

        const inputs = this.snake.getInputs(this.food);
        const outputs = this.network.activate(inputs);

        const turnThreshold = 0.12;
        const leftPreference = outputs[0] - outputs[1];
        const rightPreference = outputs[2] - outputs[1];
        let action = 1;

        if (
            leftPreference > turnThreshold &&
            leftPreference > rightPreference
        ) {
            action = 0;
        } else if (
            rightPreference > turnThreshold &&
            rightPreference > leftPreference
        ) {
            action = 2;
        }

        if (action === 1 || action !== this.snake.lastAction) {
            this.snake.turnSteps = 0;
        } else {
            this.snake.turnSteps++;
            if (this.snake.turnSteps >= MAX_TURN_STEPS) {
                action = 1;
                this.snake.turnSteps = 0;
            }
        }

        this.snake.update(STEP_TIME, action);

        this.fitness.update(STEP_TIME);

        this.time += STEP_TIME;
        this.steps++;

        const collectionRadius =
            CONFIG.snakeRadius + CONFIG.orbSize / 2 + 5;

        const collectionRadiusSq = collectionRadius ** 2;

        for (const orb of this.food) {
            orb.phase = (orb.phase + STEP_TIME * 2) % TAU;
        }

        const remainingFood = [];

        for (const orb of this.food) {
            if (
                distanceSquared(
                    this.snake.x,
                    this.snake.y,
                    orb.x,
                    orb.y
                ) < collectionRadiusSq
            ) {
                this.snake.length += CONFIG.orbGrowth;
                this.snake.score += CONFIG.orbScore;

                this.fitness.collectOrb();
                this.fitness.length = this.snake.length;

                remainingFood.push(randomFood());
            } else {
                remainingFood.push(orb);
            }
        }

        this.food = remainingFood;

        if (this.snake.isDead()) {
            this.fitness.die();
            this.done = true;
            return;
        }

        if (this.snake.length >= 60) {
            this.fitness.win();
            this.done = true;
            return;
        }

        if (this.time >= EPISODE_TIME) {
            this.done = true;
        }
    }

    getResult() {
        return this.fitness.calculate();
    }
}

export class TrainingSession {
    constructor(options = {}) {
        this.options = {
            populationSize: options.populationSize ?? 40,
            stepsPerFrame: options.stepsPerFrame ?? 8,
            maxGenerations: options.maxGenerations ?? Infinity
        };

        this.onGeneration =
            options.onGeneration ?? (() => {});
        this.onEpisode = options.onEpisode ?? (() => {});

        this.algorithm = new GeneticAlgorithm({
            populationSize: this.options.populationSize,
            inputCount: INPUT_COUNT,
            hiddenCount: 16,
            outputCount: OUTPUT_COUNT,
            mutationRate: 0.08,
            mutationStrength: 0.3,
            eliteCount: 4
        });

        this.generation = 1;
        this.currentIndex = 0;
        this.currentEpisode = null;

        this.running = true;

        this.createEpisode();
    }

    createEpisode() {
        const individual =
            this.algorithm.population[this.currentIndex];

        this.currentEpisode = new Episode(individual.network);
        this.onEpisode({
            generation: this.generation,
            episode: this.currentIndex + 1,
            populationSize: this.algorithm.population.length
        });
    }

    update() {
        if (!this.running) return;

        for (
            let i = 0;
            i < this.options.stepsPerFrame;
            i++
        ) {
            if (!this.currentEpisode) break;

            this.currentEpisode.update();

            if (this.currentEpisode.done) {
                this.completeEpisode();
            }

            if (!this.running) break;
        }
    }

    completeEpisode() {
        const individual =
            this.algorithm.population[this.currentIndex];

        individual.fitness = this.currentEpisode.getResult();

        this.currentIndex++;

        if (
            this.currentIndex >=
            this.algorithm.population.length
        ) {
            this.completeGeneration();
            return;
        }

        this.createEpisode();
    }

    completeGeneration() {
        this.algorithm.rankPopulation();
        this.algorithm.saveToStorage();

        if (
            this.generation >=
            this.options.maxGenerations
        ) {
            this.stop();
            return;
        }

        this.algorithm.nextGeneration();

        this.generation++;
        this.currentIndex = 0;

        this.onGeneration({
            generation: this.generation
        });

        this.createEpisode();
    }

    stop() {
        this.running = false;
        this.currentEpisode = null;
    }

    getChampion() {
        return this.algorithm.bestNetwork
            ? this.algorithm.bestNetwork.copy()
            : null;
    }
}

export function startTraining(options = {}) {
    return new TrainingSession(options);
}

export function loadChampion() {
    const algorithm = new GeneticAlgorithm({
        inputCount: INPUT_COUNT,
        hiddenCount: 16,
        outputCount: OUTPUT_COUNT
    });

    if (!algorithm.loadFromStorage()) {
        return null;
    }

    return algorithm.bestNetwork;
}
