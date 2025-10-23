import { synthesize, numscore } from '../src/synlib.js';

/**
 * 
 * A language is a list of language elements, which can be a "fun", an "int", or "lambda".
 * 
 */
let maplanguage = [
    {
        // name of the primitive ("multiply and add")
        name: "mad",
        // indicates that this is a function primitive
        kind: "fun",
        // type signature of the primitive. Any identifier ("int", "float", "foo", "bar", etc.) can
        // be used as a base type; base types don't need to be previously defined.
        type: "int->int->int->int",
        // implementation of the primitive. Throwing an error will cause the overall synthesis process to fail,
        // so instead return a bad result.
        imp: function (c, a, b) {
            return c * a + b;
        }
    },
    {
        name: "N",
        // "int" is a special keyword indicating that this primitive is an integer constant
        kind: "int",
        // range of values (0 to 5 inclusive)
        range: [0, 5]
    },
    {
        name: "map",
        kind: "fun",
        // Greek letters in the type signature are generic type variables that can be instantiated to any concrete type.
        type: "list[\\alpha]->(\\alpha->\\beta)->list[\\beta]",
        imp: function (lst, f) {
            let rv = lst.map(f);
            return rv;
        }
    }
    ,
    {
        name: "reduce",
        kind: "fun",
        type: "list[\\alpha]->(\\alpha->\\beta->\\beta)->\\beta->\\beta",
        imp: function (lst, f, init) {
            let acc = init;
            for (let elem of lst) {
                let skolem = f(elem);
                acc = skolem(acc);
            }
            return acc;
        }
    }
    ,
    {
        name: "lambda1",
        // "lambda" is a special keyword indicating that this primitive is a lambda (anonymous function) expression, needed
        // for languages that have higher-order functions.
        kind: "lambda",
    }
]

let problems = {
    "mapincrement": {
        intypes: [{ kind: "input", name: "x", type: "list[int]" }, { kind: "output", type: "list[int]" }],
        io: [{ in: { x: [1, 2, 3] }, out: [2, 3, 4] },
            { in: { x: [5, 6, 9] }, out: [6, 7, 10] }],
        depth: 4
    },
    "reducebasic": {
        intypes: [{ kind: "input", name: "x", type: "list[int]" }, { kind: "output", type: "int" }],
        io: [{ in: { x: [1, 2, 3] }, out: 6 },
        { in: { x: [5, 6, 9] }, out: 20 },
            { in: { x: [7, 0, 0] }, out: 7 }],
        depth: 4
    },
    "2dreduce": {
        intypes: [{ kind: "input", name: "x", type: "list[list[int]]" }, { kind: "output", type: "list[int]" }],
        io:[{ in: { x: [[1, 2], [3, 4]] }, out: [3, 7] },
        { in: { x: [[5, 6], [9, 10]] }, out: [11, 19] },
            { in: { x: [[7, 0], [1, 2, 3], [2, 3]] }, out: [7, 6, 5] }],
        depth:6
    },
    "prodreduce": {
        intypes: [{ kind: "input", name: "x", type: "list[int]" }, { kind: "output", type: "int" }],
        io:[{ in: { x: [1, 2, 3] }, out: 6 },
            { in: { x: [5, 2, 3] }, out: 30 },
            { in: { x: [7, 0, 0] }, out: 0 }],
        depth: 4
    }
};

function runOne(p, verbose, N, config) {
    N = N || 100000
    let problem = problems[p];
    if (verbose) { console.log("Problem ", p); }
    let sol = synthesize(problem.intypes, problem.io, maplanguage, numscore, 0.001, problem.depth, N, config);
    console.log(p, sol.toString());;
    if (verbose) {
        for (let i = 0; i < problems[p].io.length; ++i) {
            console.log("Input: ", problems[p].io[i].in.x);
            console.log("Output:", sol.prog.eval(3, problems[p].io[i].in, []));
            console.log("Target:", problems[p].io[i].out);
        }
    }    
    return sol;
}

function runAll(verbose) {
    let sols = {};
    for (let p in problems) {
        let rv = runOne(p, verbose);
        sols[p] = rv;
    }
    return sols;
}

// Export for Node.js (CommonJS)
export { maplanguage as language, numscore as scoring, problems as testproblems, runAll, runOne };