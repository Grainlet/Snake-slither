
const ASSETS = {
    background: "assets/backgrounds/game_background.png",
    head: "assets/snake/snake_head.png",
    body: "assets/snake/snake_body.png",
    enemyHead: "assets/snake/enemy_head.png",
    enemyBody: "assets/snake/enemy_body.png",
    orbs: [
        "assets/orbs/orb1.png",
        "assets/orbs/orb2.png",
        "assets/orbs/orb3.png"
    ]
};

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const image = new Image();

        image.onload = () => resolve(image);
        image.onerror = () => reject(
            new Error(`Failed to load ${src}`)
        );

        image.src = src;
    });
}

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d", { alpha: false });

        this.width = 0;
        this.height = 0;

        this.camera = {
            x: 0,
            y: 0
        };

        this.images = null;
        this.orbVariants = [];

        this.resize();
        this.ready = this.loadAssets();
    }

    async loadAssets() {
        const [background, head, body, enemyHead, enemyBody, ...orbs] = await Promise.all([
            loadImage(ASSETS.background),
            loadImage(ASSETS.head),
            loadImage(ASSETS.body),
            loadImage(ASSETS.enemyHead),
            loadImage(ASSETS.enemyBody),
            ...ASSETS.orbs.map(loadImage)
        ]);

        this.images = {
            background,
            head,
            body,
            enemyHead,
            enemyBody,
            orbs
        };

        this.orbVariants = orbs.map(image => {
            const variants = [];

            for (let size = 30; size <= 42; size += 2) {
                const canvas = document.createElement("canvas");

                canvas.width = size;
                canvas.height = size;

                canvas.getContext("2d").drawImage(
                    image,
                    0,
                    0,
                    size,
                    size
                );

                variants.push(canvas);
            }

            return variants;
        });
    }

    resize() {
        const rect = this.canvas.getBoundingClientRect();
        const ratio = Math.min(window.devicePixelRatio || 1, 2);

        this.width = rect.width;
        this.height = rect.height;

        this.canvas.width = Math.round(this.width * ratio);
        this.canvas.height = Math.round(this.height * ratio);

        this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    setCamera(x, y, dt = 1 / 60) {
        const smoothing = 1 - Math.exp(-8 * dt);

        this.camera.x += (x - this.camera.x) * smoothing;
        this.camera.y += (y - this.camera.y) * smoothing;
    }

    toScreen(x, y) {
        return {
            x: x - this.camera.x + this.width / 2,
            y: y - this.camera.y + this.height / 2
        };
    }

    drawBackground() {
        const ctx = this.ctx;

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, this.width, this.height);

        const spacing = 177;
        const lineWidth = 13;

        const offsetX =
            ((-this.camera.x % spacing) + spacing) % spacing;

        const offsetY =
            ((-this.camera.y % spacing) + spacing) % spacing;

        ctx.fillStyle = "#f0f1f1";

        for (
            let x = offsetX - spacing;
            x < this.width + spacing;
            x += spacing
        ) {
            ctx.fillRect(x, 0, lineWidth, this.height);
        }

        for (
            let y = offsetY - spacing;
            y < this.height + spacing;
            y += spacing
        ) {
            ctx.fillRect(0, y, this.width, lineWidth);
        }
    }

    drawArenaBoundary(size) {
        const topLeft = this.toScreen(-size, -size);
        const bottomRight = this.toScreen(size, size);

        this.ctx.save();
        this.ctx.strokeStyle = "#333333";
        this.ctx.lineWidth = 5;

        this.ctx.strokeRect(
            topLeft.x,
            topLeft.y,
            bottomRight.x - topLeft.x,
            bottomRight.y - topLeft.y
        );

        this.ctx.restore();
    }

    drawOrb(orb) {
        if (!this.orbVariants.length) return;

        const pos = this.toScreen(orb.x, orb.y);

        if (
            pos.x < -50 ||
            pos.x > this.width + 50 ||
            pos.y < -50 ||
            pos.y > this.height + 50
        ) {
            return;
        }

        const pulse = 1 + Math.sin(orb.phase || 0) * 0.08;

        const index = Math.max(
            0,
            Math.min(6, Math.round((36 * pulse - 30) / 2))
        );

        const type = Math.max(
            0,
            Math.min(2, orb.type || 0)
        );

        const image = this.orbVariants[type][index];

        this.ctx.drawImage(
            image,
            pos.x - image.width / 2,
            pos.y - image.height / 2
        );
    }

    drawSnake(snake) {
        if (!this.images) return;

        const ctx = this.ctx;
        const bodyImage = snake.skin === "enemy"
            ? this.images.enemyBody
            : this.images.body;
        const headImage = snake.skin === "enemy"
            ? this.images.enemyHead
            : this.images.head;

        for (let i = snake.body.length - 1; i >= 0; i--) {
            const segment = snake.body[i];
            const pos = this.toScreen(segment.x, segment.y);

            if (
                pos.x < -50 ||
                pos.x > this.width + 50 ||
                pos.y < -50 ||
                pos.y > this.height + 50
            ) {
                continue;
            }

            ctx.save();
            ctx.translate(pos.x, pos.y);
            ctx.rotate(segment.angle || 0);

            ctx.drawImage(
                bodyImage,
                -17,
                -17,
                34,
                34
            );

            ctx.restore();
        }

        const head = this.toScreen(snake.x, snake.y);

        ctx.save();
        ctx.translate(head.x, head.y);

        ctx.rotate(snake.angle + Math.PI / 2);

        ctx.drawImage(
            headImage,
            -23,
            -23,
            46,
            46
        );

        ctx.restore();
    }

    render(game, dt = 1 / 60) {
        if (!game || !game.snake) return;

        this.setCamera(
            game.snake.x,
            game.snake.y,
            dt
        );

        this.drawBackground();

        if (game.trainingArena) {
            this.drawArenaBoundary(game.arenaSize || 1000);
        }

        const orbs = game.orbs || game.food || [];

        for (const orb of orbs) {
            this.drawOrb(orb);
        }

        this.drawSnake(game.snake);

        for (const enemy of game.enemies || []) {
            this.drawSnake(enemy);
        }
    }
}
