import { ArenaGame, EnemyTrainer, loadEnemyChampion } from "./arena.js";
import { Renderer } from "./render.js";

const menu = document.getElementById("menu");
const gameScreen = document.getElementById("game-screen");
const trainingScreen = document.getElementById("training-screen");
const playButton = document.getElementById("play-button");
const trainButton = document.getElementById("train-button");
const watchButton = document.getElementById("watch-button");
const gameCanvas = document.getElementById("game-canvas");
const trainingCanvas = document.getElementById("training-canvas");
const score = document.getElementById("score");
const length = document.getElementById("length");
const counter = document.getElementById("generation-counter");
const message = document.getElementById("watch-message");

const gameOverOverlay = document.getElementById("game-over-overlay");
const victoryImg = document.getElementById("victory-img");
const defeatImg = document.getElementById("defeat-img");
const gameOverText = document.getElementById("game-over-text");
const restartButton = document.getElementById("restart-button");
const gameOverMenuButton = document.getElementById("game-over-menu-button");

let mode = "menu";
let game = null;
let trainer = null;
let trainingRenderer = null;
let previousTime = performance.now();

function hideGameOver() {
    if (gameOverOverlay) gameOverOverlay.classList.remove("active");
    if (victoryImg) victoryImg.classList.remove("visible");
    if (defeatImg) defeatImg.classList.remove("visible");
}

function showGameOver(result) {
    if (!gameOverOverlay) return;
    if (result === "victory") {
        if (victoryImg) victoryImg.classList.add("visible");
        if (defeatImg) defeatImg.classList.remove("visible");
        if (gameOverText) gameOverText.textContent = "VICTORY";
    } else {
        if (defeatImg) defeatImg.classList.add("visible");
        if (victoryImg) victoryImg.classList.remove("visible");
        if (gameOverText) gameOverText.textContent = "DEFEAT";
    }
    gameOverOverlay.classList.add("active");
}

function show(next) {
    menu.classList.toggle("active", next === "menu");
    gameScreen.classList.toggle("active", next === "game");
    trainingScreen.classList.toggle("active", next === "training");
    mode = next;
    if (next !== "game") hideGameOver();
}

function dispose() {
    hideGameOver();
    game?.destroy();
    trainer?.stop();
    game = null;
    trainer = null;
    trainingRenderer = null;
}

function startGame(network = loadEnemyChampion(), autoPlayer = false) {
    dispose();
    show("game");
    game = new ArenaGame(gameCanvas, network, autoPlayer);
    game.resize();
    game.onGameOver = result => {
        showGameOver(result);
        if (game.autoPlayer) {
            setTimeout(() => {
                if (mode === "game" && game && game.gameOver) {
                    hideGameOver();
                    game.reset();
                }
            }, 1800);
        }
    };
    message.textContent = network ? "TRAINED RED ENEMY ACTIVE" : "RED ENEMY ACTIVE — TRAIN IT FOR BETTER HUNTING";
}

function startTraining() {
    dispose();
    show("training");
    trainingRenderer = new Renderer(trainingCanvas);
    trainingRenderer.resize();
    trainer = new EnemyTrainer(progress => {
        counter.textContent = `GENERATION ${progress.generation} · ENEMY ${progress.episode}/${progress.population}`;
    });
    message.textContent = "RED SNAKE LEARNS TO GROW, HUNT, AND ENCIRCLE";
}

playButton.addEventListener("click", () => startGame());
trainButton.addEventListener("click", startTraining);
watchButton.addEventListener("click", () => {
    const champion = loadEnemyChampion();
    champion ? startGame(champion, true) : startTraining();
});

restartButton?.addEventListener("click", () => {
    hideGameOver();
    game?.reset();
});

gameOverMenuButton?.addEventListener("click", () => {
    dispose();
    show("menu");
});

window.addEventListener("keydown", event => {
    if (event.key === "Escape" && mode !== "menu") {
        dispose();
        show("menu");
        return;
    }
    if (mode === "game" && game?.gameOver) {
        if (event.key === "Enter" || event.key === " " || event.key === "r" || event.key === "R") {
            event.preventDefault();
            hideGameOver();
            game.reset();
        }
    } else if (event.key === "Enter" && mode === "menu") {
        startGame();
    }
});

window.addEventListener("resize", () => {
    game?.resize();
    trainingRenderer?.resize();
});

function loop(time) {
    const dt = Math.min((time - previousTime) / 1000, 1 / 30);
    previousTime = time;
    if (mode === "game" && game) {
        game.update();
        game.draw(dt);
        score.textContent = `YOU: ${Math.floor(game.snake.length)}`;
        length.textContent = `ENEMY: ${Math.floor(game.enemy.length)}`;
        if (game.status) message.textContent = game.status;
    }
    if (mode === "training" && trainer) {
        trainer.update();
        trainingRenderer.render(trainer.currentEpisode, dt);
    }
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
