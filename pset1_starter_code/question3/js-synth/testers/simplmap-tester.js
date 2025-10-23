import fetch from 'node-fetch';
import { testproblems} from '../languages/simplmaplang.js';

const serverUrl = process.argv[2] || 'http://localhost:3000';

async function testProblem(problemName, problem) {
    const body = {
        inputspec: problem.intypes,
        examples: problem.io,                
        threshold: 0.001,
        bound: problem.depth,
        N: 10000,
        config: {language: "simplmap"}
    };
    const response = await fetch(`${serverUrl}/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Server error for ${problemName}: ${err}`);
    }
    const result = await response.json();
    return result;
}

async function main() {
        for (const [name, problem] of Object.entries(testproblems)) {
        process.stdout.write(`Testing ${name}... `);
        try {
            const result = await testProblem(name, problem);
            console.log('done. Status:', result.status, 'Score:', result.score);
        } catch (err) {
            console.error('FAILED:', err.message);
        }
    }
}

main(); 