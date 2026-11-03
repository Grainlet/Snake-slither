
import { Game } from "./game.js";
import { Episode, TrainingSession, loadChampion } from "./training.js";
import { Renderer } from "./render.js";

const menu = document.getElementById("menu");
const gameScreen = document.getElementById("game-screen");
const trainingScreen = document.getElementById("training-screen");

const gameCanvas = document.getElementById("game-canvas");
const trainingCanvas = document.getElementById("training-canvas");

const playButton = document.getElementById("play-button");
const trainButton = document.getElementById("train-button");
const watchButton = document.getElementById("watch-button");

const scoreElement = document.getElementById("score");
const lengthElement = document.getElementById("length");
const pauseOverlay = document.getElementById("pause-overlay");
const generationCounter = document.getElementById("generation-counter");
const watchMessage = document.getElementById("watch-message");

let currentScreen = "menu";
let game = null;
let training = null;
let trainingRenderer = null;
let watchEpisode = null;
let watchNetwork = null;

let previousTime = 0;

function showScreen(name) {
    menu.classList.remove("active");
    gameScreen.classList.remove("active");
    trainingScreen.classList.remove("active");

    if (name === "menu") menu.classList.add("active");
    if (name === "game") gameScreen.classList.add("active");
    if (name === "training" || name === "watch") trainingScreen.classList.add("active");

    currentScreen = name;
}

function stopGame() {
    if (game) {
        game.destroy();
        game = null;
    }
}

function stopTraining() {
    if (training) {
        training.stop();
        training = null;
    }

    trainingRenderer = null;
}

function stopWatching() {
    watchEpisode = null;
    watchNetwork = null;
}

function startGame() {
    stopTraining();
    stopWatching();
    stopGame();

    showScreen("game");
    pauseOverlay.style.display = "none";

    game = new Game(gameCanvas);
    game.resize();

    previousTime = performance.now();
}

function startTraining() {
    stopGame();
    stopTraining();
    stopWatching();

    showScreen("training");

    trainingRenderer = new Renderer(trainingCanvas);
    trainingRenderer.resize();

    generationCounter.textContent = "GENERATION 1 · SNAKE 1/40";
    watchMessage.textContent = "";

    training = new TrainingSession({
        populationSize: 40,
        stepsPerFrame: 30,

        onGeneration: result => {
            generationCounter.textContent =
                `GENERATION ${result.generation}`;
        },

        onEpisode: result => {
            generationCounter.textContent =
                `GENERATION ${result.generation} · SNAKE ${result.episode}/${result.populationSize}`;
        }
    });

    previousTime = performance.now();
}

function startWatching() {
    stopGame();
    stopTraining();
    stopWatching();

    const champion = loadChampion();
    if (!champion) {
        watchMessage.textContent = "TRAIN A SNAKE FIRST";
        generationCounter.textContent = "NO SAVED AI";
        showScreen("watch");
        trainingRenderer = new Renderer(trainingCanvas);
        trainingRenderer.resize();
        return;
    }

    showScreen("watch");
    trainingRenderer = new Renderer(trainingCanvas);
    trainingRenderer.resize();
    watchNetwork = champion;
    watchEpisode = new Episode(watchNetwork.copy());
    generationCounter.textContent = "WATCHING YOUR BEST AI";
    watchMessage.textContent = "PRESS ESC TO RETURN";
    previousTime = performance.now();
}

function returnToMenu() {
    stopGame();
    stopTraining();
    stopWatching();

    pauseOverlay.style.display = "none";
    showScreen("menu");
}

function togglePause() {
    if (!game || currentScreen !== "game") return;

    game.paused = !game.paused;

    pauseOverlay.style.display = game.paused
        ? "flex"
        : "none";
}

playButton.addEventListener("click", startGame);
trainButton.addEventListener("click", startTraining);
watchButton.addEventListener("click", startWatching);

window.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        if (currentScreen === "game") {
            event.preventDefault();
            togglePause();
        } else if (currentScreen === "training" || currentScreen === "watch") {
            event.preventDefault();
            returnToMenu();
        }

        return;
    }

    if (
        currentScreen === "menu" &&
        event.key === "Enter"
    ) {
        event.preventDefault();
        startGame();
        return;
    }

    if (
        currentScreen === "game" &&
        event.key.toLowerCase() === "r"
    ) {
        event.preventDefault();
        startGame();
    }
});

window.addEventListener("resize", () => {
    if (game) game.resize();
    if (trainingRenderer) trainingRenderer.resize();
});

window.addEventListener("blur", () => {
    if (currentScreen === "game" && game && !game.paused) {
        togglePause();
    }
});

function loop(time) {
    const dt = Math.min((time - previousTime) / 1000, 1 / 30);
    previousTime = time;

    if (currentScreen === "game" && game) {
        game.update(dt);
        game.draw(dt);

        scoreElement.textContent = `SCORE: ${game.snake.score}`;
        lengthElement.textContent =
            `LENGTH: ${Math.floor(game.snake.length)}`;
    }

    if (currentScreen === "training" && training) {
        training.update();

        if (trainingRenderer && training.currentEpisode) {
            trainingRenderer.render(
                training.currentEpisode,
                dt
            );
        }
    }

    if (currentScreen === "watch" && watchEpisode) {
        for (let i = 0; i < 2; i++) {
            watchEpisode.update();
            if (watchEpisode.done) {
                watchEpisode = new Episode(watchNetwork.copy());
                break;
            }
        }

        if (trainingRenderer) {
            trainingRenderer.render(watchEpisode, dt);
        }
    }

    requestAnimationFrame(loop);
}

document.addEventListener("visibilitychange", () => {
    if (
        document.hidden &&
        currentScreen === "game" &&
        game &&
        !game.paused
    ) {
        togglePause();
    }
});

requestAnimationFrame(time => {
    previousTime = time;
    requestAnimationFrame(loop);
});
