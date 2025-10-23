import fetch from 'node-fetch';
import { deserializeState } from './src/synlib.js';
import zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);

// Helper: send a POST to /synthesize and return the parsed result
async function postSynthesize(server, body, language) {
    const jsonBody = JSON.stringify(body);
    const compressedBody = await gzip(jsonBody);    
    const response = await fetch(`${server}/synthesize`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Content-Encoding': 'gzip',
            'Content-Length': compressedBody.length
        },
        body: compressedBody
    });
    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Server error from ${server}: ${err}`);
    }
    return deserializeState(await response.json(), language);
}

// Helper: merge states 
function mergeStates(results) {
    
    let best = results[0];
    
    // Merge all others into best
    for (let r of results) {
        if (r !== best && r.state && typeof best.state.merge === 'function') {
            best.state.merge(r.state, (best.state.beamsize || 10));
        }
    }
    return best.state;
}

// Main function
export async function parallelSolve(problem, servers, language, config = {}) {
    // Prepare the body for each server
    const baseBody = {
        inputspec: problem.intypes,
        examples: problem.io,
        threshold: 0.001,
        bound: problem.depth,
        N: 10000,
        config: { ...config }
    };
    let round = 0;
    let mergedState = null;
    while (true) {        
        // For the first round, no initialState; for later rounds, use mergedState
        const bodies = servers.map(() => ({ ...baseBody, config: { ...baseBody.config } }));
        if (mergedState) {
            for (let b of bodies) b.config.initialState = mergedState;
        }
        // Send all requests in parallel
        const results = await Promise.all(
            servers.map((server, i) => postSynthesize(server, bodies[i], language))
        );
        // Print a summary of the results.
        console.log(results.map(r => r.toString()).join('\n'));
        // Check for any correct
        for (let r of results) {
            if (r.status && r.status === 'CORRECT') {
                return r;
            }
        }
        
        // If all incorrect, merge states and try again
        if (results.every(r => r.status === 'INCORRECT' && r.state)) {
            // Merge all states
            mergedState = mergeStates(results);
            round++;
            if (round > 15) throw new Error('Too many rounds, giving up.');
        } else {
            console.log("NO MERGING", round); 
            // If any result is missing state, or not INCORRECT, stop
            throw new Error('No correct result and cannot merge states.');
        }
        
    }
} 