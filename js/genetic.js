
import { NeuralNetwork } from "./network.js";

export class GeneticAlgorithm {
    constructor(options = {}) {
        this.populationSize = options.populationSize ?? 100;
        this.inputCount = options.inputCount ?? 24;
        this.hiddenCount = options.hiddenCount ?? 16;
        this.outputCount = options.outputCount ?? 3;

        this.mutationRate = options.mutationRate ?? 0.08;
        this.mutationStrength = options.mutationStrength ?? 0.3;
        this.eliteCount = options.eliteCount ?? 5;

        this.generation = 0;
        this.bestFitness = 0;
        this.bestNetwork = null;
        this.population = [];

        this.createPopulation();
    }

    createPopulation() {
        this.population = Array.from(
            { length: this.populationSize },
            () => ({
                network: new NeuralNetwork(
                    this.inputCount,
                    this.hiddenCount,
                    this.outputCount
                ),
                fitness: 0
            })
        );
    }

    rankPopulation() {
        this.population.sort((a, b) => b.fitness - a.fitness);

        const champion = this.population[0];

        if (champion && champion.fitness > this.bestFitness) {
            this.bestFitness = champion.fitness;
            this.bestNetwork = champion.network.copy();
        }

        return champion;
    }

    selectParent() {
        let winner = null;

        for (let i = 0; i < 4; i++) {
            const candidate = this.population[
                Math.floor(Math.random() * this.population.length)
            ];

            if (!winner || candidate.fitness > winner.fitness) {
                winner = candidate;
            }
        }

        return winner.network;
    }

    crossover(parentA, parentB) {
        const weights = parentA.weights.map((weight, index) => (
            Math.random() < 0.5
                ? weight
                : parentB.weights[index]
        ));

        return new NeuralNetwork(
            this.inputCount,
            this.hiddenCount,
            this.outputCount,
            weights
        );
    }

    mutate(network) {
        for (let i = 0; i < network.weights.length; i++) {
            if (Math.random() < this.mutationRate) {
                network.weights[i] += (
                    Math.random() * 2 - 1
                ) * this.mutationStrength;

                network.weights[i] = Math.max(
                    -3,
                    Math.min(3, network.weights[i])
                );
            }
        }

        return network;
    }

    nextGeneration() {
        this.rankPopulation();

        const next = [];

        const eliteCount = Math.min(
            this.eliteCount,
            this.populationSize
        );

        for (let i = 0; i < eliteCount; i++) {
            next.push({
                network: this.population[i].network.copy(),
                fitness: 0
            });
        }

        while (next.length < this.populationSize) {
            const parentA = this.selectParent();
            const parentB = this.selectParent();

            const child = this.crossover(parentA, parentB);
            this.mutate(child);

            next.push({
                network: child,
                fitness: 0
            });
        }

        this.population = next;
        this.generation++;

        return this.population;
    }

    save() {
        return {
            generation: this.generation,
            bestFitness: this.bestFitness,
            bestNetwork: this.bestNetwork
                ? this.bestNetwork.toJSON()
                : null
        };
    }

    load(data) {
        this.generation = data.generation ?? 0;
        this.bestFitness = data.bestFitness ?? 0;

        this.bestNetwork = data.bestNetwork
            ? NeuralNetwork.fromJSON(data.bestNetwork)
            : null;
    }

    saveToStorage(key = "survive-the-snake-ai") {
        localStorage.setItem(key, JSON.stringify(this.save()));
    }

    loadFromStorage(key = "survive-the-snake-ai") {
        const saved = localStorage.getItem(key);

        if (!saved) return false;

        try {
            this.load(JSON.parse(saved));
            return true;
        } catch {
            return false;
        }
    }
}
