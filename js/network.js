
export class NeuralNetwork {
    constructor(inputCount, hiddenCount, outputCount, weights = null) {
        this.inputCount = inputCount;
        this.hiddenCount = hiddenCount;
        this.outputCount = outputCount;

        this.weights = weights
            ? [...weights]
            : Array.from(
                { length: this.getWeightCount() },
                () => Math.random() * 2 - 1
            );
    }

    getWeightCount() {
        return (
            this.inputCount * this.hiddenCount +
            this.hiddenCount +
            this.hiddenCount * this.outputCount +
            this.outputCount
        );
    }

    activate(inputs) {
        if (inputs.length !== this.inputCount) {
            throw new Error("Incorrect neural network input size.");
        }

        const hidden = [];
        let index = 0;

        for (let h = 0; h < this.hiddenCount; h++) {
            let sum = 0;

            for (let i = 0; i < this.inputCount; i++) {
                sum += inputs[i] * this.weights[index++];
            }

            sum += this.weights[
                this.inputCount * this.hiddenCount + h
            ];

            hidden.push(Math.tanh(sum));
        }

        const outputs = [];

        const outputStart =
            this.inputCount * this.hiddenCount +
            this.hiddenCount;

        index = outputStart;

        for (let o = 0; o < this.outputCount; o++) {
            let sum = 0;

            for (let h = 0; h < this.hiddenCount; h++) {
                sum += hidden[h] * this.weights[index++];
            }

            sum += this.weights[
                outputStart +
                this.hiddenCount * this.outputCount +
                o
            ];

            outputs.push(Math.tanh(sum));
        }

        return outputs;
    }

    copy() {
        return new NeuralNetwork(
            this.inputCount,
            this.hiddenCount,
            this.outputCount,
            this.weights
        );
    }

    toJSON() {
        return {
            inputCount: this.inputCount,
            hiddenCount: this.hiddenCount,
            outputCount: this.outputCount,
            weights: [...this.weights]
        };
    }

    static fromJSON(data) {
        return new NeuralNetwork(
            data.inputCount,
            data.hiddenCount,
            data.outputCount,
            data.weights
        );
    }
}
