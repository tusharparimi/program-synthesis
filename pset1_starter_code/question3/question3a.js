
let lang = [
    // See annotated reference language in js-synth/languages/simplmaplang.js
    // A few language elements are provided for you.
    // YOUR CODE HERE.
    {
        name: "sin",
        kind: "fun",
        type: "float->float",
        imp: function (x) {
            return Math.sin(x);
        }
    },
    {
        name: "N",
        kind: "int",
        range: [0, 5]
    },
    {
        name: "i2f", // convert int to float – this can be implemented as the identity function
        kind: "fun",
        type: "int->float",
        imp: function (x) {
            return x;
        }
    },
]


export { lang };