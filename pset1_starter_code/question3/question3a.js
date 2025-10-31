
let lang = [
    // See annotated reference language in js-synth/languages/simplmaplang.js
    // A few language elements are provided for you.
    // YOUR CODE HERE.
    {
        name: "ternary",
        kind: "fun",
        type: "bool->float->float->float",
        imp: function (cond, a, b) {
            return cond ? a : b;
        }
    },
    {
        name: "less",
        kind: "fun",
        type: "float->float->bool",
        imp: function (x, y) {
            return x < y;
        }
    },
    {
        name: "add",
        kind: "fun",
        type: "float->float->float",
        imp: function (x, y) {
            return x + y;
        }
    },
    {
        name: "sub",
        kind: "fun",
        type: "float->float->float",
        imp: function (x, y) {
            return x - y;
        }
    },
    {
        name: "mul",
        kind: "fun",
        type: "float->float->float",
        imp: function (x, y) {
            return x * y;
        }
    },
    {
        name: "div",
        kind: "fun",
        type: "float->float->float",
        imp: function (x, y) {
            return x / y;
        }
    },
    {
        name: "exp",
        kind: "fun",
        type: "float->float->float",
        imp: function (x, y) {
            return x ** y;
        }
    },
    {
        name: "tan",
        kind: "fun",
        type: "float->float",
        imp: function (x) {
            return Math.tan(x);
        }
    },
    {
        name: "cos",
        kind: "fun",
        type: "float->float",
        imp: function (x) {
            return Math.cos(x);
        }
    },
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