import { synthesize, isHole, makeHole, score, rvError, isError, isBadResult } from '../src/synlib.js';


function unionHelper(sh1, sh2) {
    if (sh1 == "none") {
        return sh2;
    }
    if (sh2 == "none") {
        return sh1;
    }
    if (sh1 == "inner" || sh2 == "inner") {
        return "inner";
    }
    return "point";
}

function shapeEval(pt, shape) {
    let sh = shape;
    if (sh.kind === 'circle') {
        let dx = pt.x - sh.x;
        let dy = pt.y - sh.y;
        if (dx * dx + dy * dy == sh.r * sh.r) {
            return "curve";
        }
        if (dx * dx + dy * dy < sh.r * sh.r) {
            return "inner";
        }
        return "none";
    } else if (sh.kind === 'rect') {
        if (pt.x == sh.x && pt.y == sh.y) { return "ULcorner"; }
        if (pt.x == sh.x + sh.w && pt.y == sh.y) { return "URcorner"; }
        if (pt.x == sh.x && pt.y == sh.y + sh.h) { return "LLcorner"; }
        if (pt.x == sh.x + sh.w && pt.y == sh.y + sh.h) { return "LRcorner"; }

        if (pt.x == sh.x && pt.y > sh.y && pt.y < sh.y + sh.h) { return "Vedge"; }
        if (pt.x == sh.x + sh.w && pt.y > sh.y && pt.y < sh.y + sh.h) { return "Vedge"; }
        if (pt.y == sh.y && pt.x > sh.x && pt.x < sh.x + sh.w) { return "Hedge"; }
        if (pt.y == sh.y + sh.h && pt.x > sh.x && pt.x < sh.x + sh.w) { return "Hedge"; }
        if (pt.x > sh.x && pt.x < sh.x + sh.w && pt.y > sh.y && pt.y < sh.y + sh.h) { return "inner"; }
        return "none";
    } else if (sh.kind === 'union') {
        let sh1 = shapeEval(pt, sh.sh1);
        let sh2 = shapeEval(pt, sh.sh2);
        return unionHelper(sh1, sh2);              
    } else if (sh.kind === 'dif') {
        let sh1 = shapeEval(pt, sh.sh1);
        let sh2 = shapeEval(pt, sh.sh2);
        if (sh1 == "none") {
            return "none";
        }
        if (sh2 == "none") {
            return sh1;
        }
        if (sh2 == "inner") {
            return "none";
        }
        if (sh1 == "inner") {
            return sh2;
        }
        return "point";
    } else if (sh.kind === 'loop') {
        let rv = "none";
        for (let i = 0; i < sh.n; i++) {
            let newPt = { x: pt.x - i * sh.dx, y: pt.y - i * sh.dy };
            let res = shapeEval(newPt, sh.sh);
            rv = unionHelper(rv, res);
        }
        return rv;
    }

}


let csglanguage = [
    {
        name: "circle",
        kind: "fun",
        parametric: false,
        type: "int->int->int->shape",        
        imp: function (x,y,r) {
            return {kind:'circle', x: x, y: y, r: r};
        },       
    },
    {
        name: "rect",
        kind: "fun",
        parametric: false,
        type: "int->int->int->int->shape",
        imp: function (x, y, w, h) {
            return { kind: 'rect', x: x, y: y, w: w, h: h };
        },
    },
    {
        name: "union",
        kind: "fun",
        parametric: false,
        type: "shape->shape->shape",
        imp: function (sh1, sh2) {
            return { kind: 'union', sh1: sh1, sh2: sh2 };
        },
    },
    {
        name: "dif",
        kind: "fun",
        parametric: false,
        type: "shape->shape->shape",
        imp: function (sh1, sh2) {
            return { kind: 'dif', sh1: sh1, sh2: sh2 };
        },
    },
    {
        name: "loop", 
        kind: "fun",
        parametric: false,
        type: "shape->int->int->int->shape",
        imp: function (sh, dx, dy, n) {
            return { kind: 'loop', sh: sh, dx:dx, dy:dy, n: n };
        },
    },
    {
        name: "eval",
        kind: "fun",
        parametric: false,
        type: "pt->shape->feature",
        imp: shapeEval,
    },

    {
        name: "N",
        kind: "int",
        range: [0, 5]
    }

];



let l = {
    circle: function (x, y, r) { return csglanguage[0].imp(x, y, r) }
    , rect: function (x, y, w, h) { return csglanguage[1].imp(x, y, w, h) }
    , union: function (sh1, sh2) { return csglanguage[2].imp(sh1, sh2) }
    , dif: function (sh1, sh2) { return csglanguage[3].imp(sh1, sh2) }
    , loop: function (sh, dx, dy, n) { return csglanguage[4].imp(sh, dx, dy, n) }
    , eval: function (pt, shape) { return csglanguage[5].imp(pt, shape) }
    , N: function (n) {
        return n;
    }
}



const problems = {

    "circleRect": {
        intypes: [{ kind: "input", name: "x", type: "pt" }, { kind: "output", type: "feature" }],
        prog: l.union(l.circle(3, 3, 1), l.rect(3, 2, 3, 2)),
        io: [{ in: { x: {x:2, y:3} } },
            { in: { x: { x: 3, y: 3 } } },
            { in: { x: { x: 6, y: 3 } } },
            { in: { x: { x: 6, y: 4 } } },
            { in: { x: { x: 6, y: 2 } } },
            { in: { x: { x: 4, y: 2 } } },
            { in: { x: { x: 2, y: 2 } } }],
        depth: 3
    },

    "circleLoop": {
        intypes: [{ kind: "input", name: "x", type: "pt" }, { kind: "output", type: "feature" }],
        prog: l.loop(l.circle(3, 3, 1), 1, 0, 4),
        io: [{ in: { x: { x: 1, y: 2 } } },
            { in: { x: { x: 2, y: 3 } } },
        { in: { x: { x: 3, y: 2 } } },
        { in: { x: { x: 4, y: 2 } } },
        { in: { x: { x: 5, y: 2 } } },
        { in: { x: { x: 7, y: 3 } } },
        { in: { x: { x: 7, y: 4 } } },
        { in: { x: { x: 5, y: 4 } } }],
        depth: 3
    },
    "loopDif": {
        intypes: [{ kind: "input", name: "x", type: "pt" }, { kind: "output", type: "feature" }],
        prog: l.dif(l.loop(l.circle(3, 3, 1), 1, 0, 4),
            l.rect(3, 3, 3, 2)),
        io: [
            { in: { x: { x: 1, y: 2 } } },
            { in: { x: { x: 2, y: 3 } } },
        { in: { x: { x: 3, y: 3 } } },
        { in: { x: { x: 4, y: 2 } } },
        { in: { x: { x: 5, y: 2 } } },
        { in: { x: { x: 7, y: 3 } } },
        { in: { x: { x: 7, y: 4 } } },
        { in: { x: { x: 5, y: 4 } } },
        { in: { x: { x: 4, y: 3 } } }
        ],
        depth: 4
    }


}


function runOne(p, verbose) {
    let problem = problems[p];
    if (verbose) { console.log("Problem ", p); }
    for (let idx in problem.io) {
        let inpt = problem.io[idx].in.x;
        let out = l.eval(inpt, problem.prog);
        problem.io[idx].out = out;
    }
    let sol = synthesize(problem.intypes, problem.io, csglanguage, score, 0.001, problem.depth, 150000);
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
    runOne("loopDif", true);
}




// Export for Node.js (CommonJS)
export { csglanguage as language, score as scoring, run, runAll };



