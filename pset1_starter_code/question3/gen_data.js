import { runOrLocalize } from './js-synth/src/synlib.js';

const MIN_INPUT = -10; // minimum input value
const MAX_INPUT = 10; // maximum input value
const NUM_SAMPLES = 30; // number of input-output pairs to generate

// Problem definitions with their corresponding JavaScript functions
const intypes = [{ kind: "input", name: "x", type: "float" }, { kind: "output", type: "float" }];
const problemDefinitions = {
    "f(x) = x": {
        intypes: intypes,
        func: (x) => x,
        depth: 4
    },
    "f(x) = 5 * x + 10": {
        intypes: intypes,
        func: (x) => 5 * x + 10,
        depth: 4
    },
    "f(x) = 5 / x^2": {
        intypes: intypes,
        func: (x) => 5 / (x * x),
        depth: 6
    },
    "f(x) = (sin(x))^3": {
        intypes: intypes,
        func: (x) => Math.sin(x) * Math.sin(x) * Math.sin(x),
        depth: 6
    },
    "f(x) = if(lt(x, 0), 0, x)": {
        intypes: intypes,
        func: (x) => x < 0 ? 0 : x,
        depth: 6
    },
    "f(x) = if(lt(x, 0), 3 * x ^ 2, x * sin(x))": {
        intypes: intypes,
        func: (x) => x < 0 ? 3 * x * x : x * Math.sin(x),
        depth: 6
    },
    "f(x) = 2 * sin(x) + sin(2 * x)": {
        intypes: intypes,
        func: (x) => 2 * Math.sin(x) + Math.sin(2 * x) + x,
        depth: 6
    },
    "f(x) = 4 * x^2 - 5 * x + 4": {
        intypes: intypes,
        func: (x) => 4 * x * x - 5 * x + 4,
        depth: 6
    },
    "f(x) = sin(2 * x^2)/cos(x^2)": { 
        intypes: intypes,
        func: (x) => Math.sin(2 * x * x) / Math.cos(x * x),
        depth: 6
    },
    "f(x) = if(lt(x, 1), (2-x), sin(x))": {
        intypes: intypes,
        func: (x) => x < 1 ? 2 - x : Math.sin(x),
        depth: 6
    },
    "f(x) = 4 * (sin(x))^3 + x": {
        intypes: intypes,
        func: (x) => 4 * Math.sin(x) * Math.sin(x) * Math.sin(x) + x,
        depth: 6
    },
};

// Function to generate random input within the specified range
function generateRandomInput() {
    return Math.random() * (MAX_INPUT - MIN_INPUT) + MIN_INPUT;
}

// Function to generate input-output pairs for a problem
function generateIOPairs(problemDef) {
    const ioPairs = [];
    const maxAttempts = NUM_SAMPLES * 100; // Prevent infinite loops
    let attempts = 0;
    
    while (ioPairs.length < NUM_SAMPLES && attempts < maxAttempts) {
        const x = generateRandomInput();
        const output = problemDef.func(x);
        
        // Only accept points with y-values in the reasonable range
        if (output >= -50 && output <= 50 && !isNaN(output) && isFinite(output)) {
            ioPairs.push({
                in: { x: x },
                out: output
            });
        }
        attempts++;
    }
    
    if (ioPairs.length < NUM_SAMPLES) {
        console.warn(`Warning: Only generated ${ioPairs.length}/${NUM_SAMPLES} valid points for ${problemDef.name || 'unknown problem'}`);
    }
    
    return ioPairs;
}

// Generate all problems
function generateProblems() {
    const problems = {};
    
    for (const [name, problemDef] of Object.entries(problemDefinitions)) {
        problems[name] = {
            intypes: problemDef.intypes,
            io: generateIOPairs(problemDef),
            depth: problemDef.depth
        };
    }
    
    return problems;
}

const actualFunctions = Object.fromEntries(
    Object.entries(problemDefinitions).map(([name, def]) => [name, def.func])
);

// Function to generate visualization data from synthesis results
function generateVisualizationData(problemName, problemDefinition, result, examples, xRange = [-10, 10], numPoints = 500) {
    const vizData = {
        problemName: problemName,
        problemDefinition: problemDefinition,
        status: result.status,
        score: result.score,
        cost: result.cost,
        synthesizedExpression: result.prog ? result.prog.toString() : "NO_PROGRAM_FOUND",
        originalExamples: examples,
        synthesizedPredictions: [],
        continuousCurve: [],
        actualFunctionCurve: []
    };

    if (result.prog) {
        // Generate predictions for original examples
        try {
            const predictions = runOrLocalize(examples.map(ex => ({ in: ex.in, out: null })), result.prog, 10);
            vizData.synthesizedPredictions = examples.map((ex, i) => ({
                x: ex.in.x,
                y: predictions[i]
            }));
        } catch (e) {
            console.warn("Failed to generate predictions for original examples:", e);
        }

        // Generate continuous curve data
        try {
            const step = (xRange[1] - xRange[0]) / numPoints;
            const curveInputs = [];
            for (let i = 0; i <= numPoints; i++) {
                const x = xRange[0] + i * step;
                curveInputs.push({ in: { x: x }, out: null });
            }
            
            const curveOutputs = runOrLocalize(curveInputs, result.prog, 10);
            vizData.continuousCurve = curveInputs.map((input, i) => ({
                x: input.in.x,
                y: typeof curveOutputs[i] === 'number' && !isNaN(curveOutputs[i]) && isFinite(curveOutputs[i]) ? curveOutputs[i] : null
            })).filter(point => point.y !== null);
        } catch (e) {
            console.warn("Failed to generate continuous curve:", e);
        }
    }

    // Generate actual function curve
    if (actualFunctions[problemName]) {
        try {
            const step = (xRange[1] - xRange[0]) / numPoints;
            for (let i = 0; i <= numPoints; i++) {
                const x = xRange[0] + i * step;
                const y = actualFunctions[problemName](x);
                if (typeof y === 'number' && !isNaN(y) && isFinite(y)) {
                    vizData.actualFunctionCurve.push({ x: x, y: y });
                }
            }
        } catch (e) {
            console.warn("Failed to generate actual function curve:", e);
        }
    }

    return vizData;
}


export { generateProblems, problemDefinitions, MIN_INPUT, MAX_INPUT, NUM_SAMPLES, generateVisualizationData };