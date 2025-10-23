import { parallelSolve } from '../parallel-client.js';
import { testproblems, language as maplanguage } from '../languages/simplmaplang.js';

const serversArg = process.argv[2] || 'http://localhost:2400';
const servers = serversArg.split(',');

async function main() {
    for (const [name, problem] of Object.entries(testproblems)) {
        process.stdout.write(`Parallel testing ${name}... \n`);
        try {
            const result = await parallelSolve(problem, servers, maplanguage, {language: "simplmap"});
            console.log('done. Status:', result.status, 'Score:', result.score);
        } catch (err) {
            console.error('FAILED:', err.message);
        }
    }
}

main(); 