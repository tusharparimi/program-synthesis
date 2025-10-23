import { lang } from './question3a.js';
import { synthesize } from './js-synth/src/synlib.js';
import { generateProblems, generateVisualizationData } from './gen_data.js';
import fs from 'fs';
import path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const problemsPath = path.join(__dirname, 'problems.json');


function sigmoid(x) {
    return 1 / (1 + Math.exp(-x));
}

function mean_squared_error(expected, actual) {
    let total_error = 0;
    for (let i = 0; i < expected.length; ++i) {
        total_error += Math.pow(expected[i] - actual[i], 2);
    }
    return total_error / expected.length;
}

function loss(examples, outputs) {
    let expected = examples.map(example => example.out);
    let actual = outputs;

    if (expected.length != actual.length) {
        throw new Error("Examples and outputs must have the same length");
    }

    let mse = mean_squared_error(expected, actual);

    let expected_mean = expected.reduce((acc, val) => acc + val, 0) / expected.length;
    let naive_mse = mean_squared_error(expected, expected.map(_ => expected_mean));

    // scale the mse, switch to log space so it's less sensitive to huge numbers, then use sigmoid to get a score between 0 and 1
    let error = sigmoid(Math.log(mse / naive_mse));

    error = isNaN(error) ? 1 : error;

    return error;
 }



function runOne(name, problem, N, threshold, config) {
    let sol = synthesize(problem.intypes, problem.io, lang, loss, threshold, problem.depth, N, config);
    console.log(name, sol.toString());
    return sol;
}


function runAll(problems, N, threshold, exportResults, config) {
    let sols = {};
    let visualizationData = [];
    
    for (let p in problems) {
        let rv = runOne(p, problems[p], N, threshold, config);
        sols[p] = rv;
        
        if (exportResults) {
            // Generate visualization data for this problem
            const problemDef = p;
            const vizData = generateVisualizationData(p, problemDef, rv, problems[p].io);
            visualizationData.push(vizData);
        }
    }
    
    if (exportResults && visualizationData.length > 0) {
        // Export all results to JSON
        const outputPath = path.join(__dirname, 'synthesis_results.json');
        fs.writeFileSync(outputPath, JSON.stringify(visualizationData, null, 2));
        console.log(`Synthesis results exported to synthesis_results.json`);
    }
    
    return sols;
}

function runExperiments(problems, N, threshold) {
    let aggregated = {};
    function addToAggregated(result) {
        for (let name in result) {
            if (aggregated[name] === undefined) {
                aggregated[name] = [];
            }
            aggregated[name].push(result[name]);
        }
    }
    for (let i = 0; i < repetitions; i++) {
        let res = runAll(problems, N, threshold, false, {});
        addToAggregated(res);
    }
    function printAggregateStats(aggregated) {
        console.log("\nExperiment results:");
        for (let name in aggregated) {
            let values = aggregated[name];
            let cost = values.reduce((a, b) => b.cost + a, 0);
            let corrects = values.reduce((a, b) => (b.status == "CORRECT" ? 1 : 0) + a, 0);
            let avgCost = cost / values.length;
            let fracCorrect = corrects / values.length;
            let avgScore = values.reduce((a, b) => b.score + a, 0) / values.length;
            let harmonicAvgScore = values.length / values.reduce((a, b) => 1 / b.score + a, 0);
            console.log(`${name}: harmonicAvgLoss = ${harmonicAvgScore.toExponential(2)}, avgLoss = ${avgScore.toExponential(2)}, avgCost = ${avgCost}, fracCorrect = ${fracCorrect}`);
        }
    }
    printAggregateStats(aggregated);
}


const mode = process.argv[2] || "view";

const N = 5e4; // search budget (number of steps)
const threshold = 1e-8; // threshold for correctness
const repetitions = 5; // number of times to run the synthesis algorithm in "benchmark" mode

if (mode == "view") {
    // run the synthesis algorithm and record the results for visualization
    let problems = JSON.parse(fs.readFileSync(problemsPath, 'utf8'));
    runAll(problems, N, threshold, true, {});
} else if (mode == "benchmark") {
    // run the synthesis algorithm and record the results for benchmarking
    let problems = JSON.parse(fs.readFileSync(problemsPath, 'utf8'));
    runExperiments(problems, N, threshold);
} else if (mode == "generate") {
    throw new Error("Careful! This will overwrite the problems.json file with new problems");
    let problems = generateProblems();
    fs.writeFileSync(problemsPath, JSON.stringify(problems, null, 2));
    console.log('Generated problems saved to problems.json');
} else {
    throw new Error("Invalid mode");
}
