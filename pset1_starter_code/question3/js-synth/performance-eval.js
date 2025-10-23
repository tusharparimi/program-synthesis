/**
 * Performance Evaluation Script for js-synth
 * 
 * This script runs comprehensive performance evaluations across all three
 * domain-specific languages (Simple Map, String, and CSG) to measure synthesis
 * success rates and computational costs.
 * 
 * USAGE:
 *   node performance-eval.js [number_of_runs]
 * 
 * PARAMETERS:
 *   number_of_runs (optional): Number of experimental runs per language (default: 30)
 * 
 * WHAT IT DOES:
 *   Runs synthesis experiments on all problems in each language, and collects performance 
 *   metrics for each problem and outputs aggregate statistics.
 */

// Import the synlib module
import { runAll as runAllSimpl } from './languages/simplmaplang.js';
import { runAll as runAllString } from './languages/stringlang.js';
import { runAll as runAllCsg } from './languages/csglang.js';

const Nruns = process.argv[2] ? parseInt(process.argv[2], 10) : 30;

function runExperiments() {
    let aggregated = {};
    function addToAggregated(result) {
        for (let name in result) {
            if (aggregated[name] === undefined) {
                aggregated[name] = [];
            }
            aggregated[name].push(result[name]);
        }
    }
    for (let i = 0; i < Nruns; i++) {
        let simpRes = runAllSimpl();
        let strlRes = runAllString();
        let csgRes = runAllCsg();
        addToAggregated(simpRes);
        addToAggregated(strlRes);
        addToAggregated(csgRes);
    }
    function printAggregateStats(aggregated) {
        for (let name in aggregated) {
            let values = aggregated[name];
            let cost = values.reduce((a, b) => b.cost + a, 0);
            let corrects = values.reduce((a, b) => (b.status == "CORRECT" ? 1 : 0) + a, 0);
            let avgCost = cost / values.length;
            let fracCorrect = corrects / values.length;
            console.log(`${name}: avgCost = ${avgCost}, fracCorrect = ${fracCorrect}`);
        }

        console.log("experiment = {");
        for (let name in aggregated) {
            let values = aggregated[name];
            let sorted = values.map((a) => a.cost).sort((a, b) => a - b);
            console.log(`  "${name}": [${sorted}],`);
        }
        console.log("};")
    }
    printAggregateStats(aggregated);
}

runExperiments();