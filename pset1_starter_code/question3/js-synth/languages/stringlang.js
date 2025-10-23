import { synthesize, isHole, makeHole, score,
     rvError, isError, isBadResult } from '../src/synlib.js';


function substrBody(startA, startB, endA, endB, idx, input) {
    for (let i = 0; i < idx + 1; i++) {
        let pattern = new RegExp("(" + startA.source + ")" + "(" + startB.source + ")");
        let start = input.match(pattern);
        if (start == null) {
            return "";
        }
        let startIdx = start.index + start[1].length;
        input = input.substring(startIdx);

        pattern = new RegExp("(" + endA.source + ")" + "(" + endB.source + ")");
        let end = input.match(pattern);
        if (end == null) {
            return "";
        }
        let endIdx = end.index + end[1].length;
        if (i == idx) {
            return input.substring(0, endIdx);
        } else {
            input = input.substring(endIdx);
        }
    }
    return input.substring(start, end);
}

let regexpChoices = [/\(/, /\)/, /[a-zA-Z]/, /[0-9]/, /\s|^|$/, new RegExp("")];

let strlanguage = [    
    {
        name: "reg",
        kind: "fun",
        parametric: true,
        type:"RegExp",
        paramInit: function () {
            let choices = regexpChoices;
            return choices[Math.floor(Math.random() * choices.length)];
        },
        paramMorph: function (param) {
            let choices = regexpChoices;
            return choices[Math.floor(Math.random() * choices.length)];
        },
        imp: function (param) {
            return function () {                
                return param;
            }
        }
    }
    ,{
        name: "substring",
        kind: "fun",
        type: "RegExp -> RegExp -> RegExp -> RegExp -> int -> string -> string",
        imp: function (startA, startB, endA, endB, idx, input) {
            if (typeof (input) != 'string') {
                return rvError(5);
            }
            if (!(startA instanceof RegExp)) {
                return rvError(0);
            }
            if (!(startB instanceof RegExp)) {
                return rvError(1);
            }
            if (!(endA instanceof RegExp)) {
                return rvError(2);
            }
            if (!(endB instanceof RegExp)) {
                return rvError(3);
            }
            if (typeof (idx) != 'number') {
                return rvError(4);
            }
            return substrBody(startA, startB, endA, endB, idx, input);
        }
    },
    {
        name: "concat",
        kind: "fun",
        type: "string -> string -> string",
        imp: function (a, b) {
            if (typeof (a) != 'string') {
                return rvError(0);
            }
            if (typeof (b) != 'string') {
                return rvError(1);
            }
            return a + b;
        }
        
    },
    {
        name: "N",
        kind: "int",
        range: [0, 5]
    }

];

function stringScore(examples, outputs) {
    function singleOutput(target, output) {
        if (typeof (output) != "string") {
            return 1;
        }
        let minL = Math.min(target.length, output.length);
        let maxL = Math.max(target.length, output.length);
        let error = 0;
        for (let i = 0; i < minL; ++i) {
            if (target[i] != output[i]) {
                error += 1;
            }
        }
        error += maxL - minL;
        return 0.7*error / maxL;
    }
    let output = 0;
    for (let idx in outputs) {
        output += singleOutput(examples[idx].out, outputs[idx]);
    }
    return output / outputs.length;
}


function lcsScore(example, output) {
    if (typeof (output) != "string") {
        return 1;
    }
    let table = [];
    for (let i = 0; i <= example.length; ++i) {
        table.push({});
    }
    function lcs(i, j) {
        if(i==example.length || j == output.length) {return 0;}
        if (j in table[i]) { return table[i][j]; }
        if (example[i] == output[j]) {
            let rv = lcs(i + 1, j + 1);
            table[i][j] = 1 + rv;
            return 1 + rv;
        } else {
            if (Math.abs(i - j) > 5) {
                return 0;
            }
            let rv1 = lcs(i + 1, j);
            let rv2 = lcs(i, j + 1);
            let rv = Math.max(rv1, rv2);
            table[i][j] = rv;
            return rv;
        }
    }
    let rv = lcs(0, 0);
    return 1 - (rv / Math.max(example.length, output.length));
}

function fancyStringScore(examples, outputs) {    
    let output = 0;
    for (let idx in outputs) {
        output += lcsScore(examples[idx].out, outputs[idx]);
    }
    return output / outputs.length;
}


const problems = {

    "parenthesis": {
        intypes: [{ kind: "input", name: "x", type: "string" }, { kind: "output", type: "string" }],
        io: [{ in: { x: "(hello) world" }, out: "hello" },
        { in: { x: "this is (the) word" }, out: "the" },
            { in: { x: "a (good) example" }, out: "good" },
            { in: { x: "a good (example)" }, out: "example" }],
        depth: 3
    },
    "outer-parenthesis": {
        intypes: [{ kind: "input", name: "x", type: "string" }, { kind: "output", type: "string" }],
        io: [{ in: { x: "(hello) world" }, out: "(hello)" },
        { in: { x: "this is (the) word" }, out: "(the)" },
        { in: { x: "a (good) example" }, out: "(good)" }],
        depth: 3
    },
    "numbers": {
        intypes: [{ kind: "input", name: "x", type: "string" }, { kind: "output", type: "string" }],
        io: [{ in: { x: "(hello) world 57" }, out: "57" },
        { in: { x: "this is (the) word 33" }, out: "33" },
        { in: { x: "a (good) example 22" }, out: "22" }],
        depth: 3
    },
    "combined": {
        intypes: [{ kind: "input", name: "x", type: "string" }, {kind:"output", type:"string"}],
        io: [{ in: { x: "(hello) world 57" }, out: "hello57" },
        { in: { x: "this is (the) word 33" }, out: "the33" },
        { in: { x: "a (good) example 22" }, out: "good22" }],
        depth: 3
    }

}


function runOne(p, verbose) {
    let problem = problems[p];
    if (verbose) { console.log("Problem ", p); }
    let sol = synthesize(problem.intypes, problem.io, strlanguage, fancyStringScore, 0.001, problem.depth, 100000);
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

function run() {
    runOne("combined");
}




// Export for Node.js (CommonJS)
export { strlanguage as language,  fancyStringScore as scoring, run, runAll, runOne };