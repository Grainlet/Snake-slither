
export class Fitness {
    constructor() {
        this.survivalTime = 0;
        this.orbsCollected = 0;
        this.length = 2;
        this.won = false;
        this.died = false;
    }

    update(dt) {
        if (!this.died) {
            this.survivalTime += dt;
        }
    }

    collectOrb() {
        this.orbsCollected++;
        this.length += 0.35;
    }

    win() {
        this.won = true;
    }

    die() {
        this.died = true;
    }

    calculate() {
        return (
            this.survivalTime * 0.5 +
            this.orbsCollected * 5 +
            (this.length - 2) * 2 +
            (this.won ? 1000 : 0)
        );
    }

    reset() {
        this.survivalTime = 0;
        this.orbsCollected = 0;
        this.length = 2;
        this.won = false;
        this.died = false;
    }
}
