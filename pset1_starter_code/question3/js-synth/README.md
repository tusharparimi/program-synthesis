# js-synth

A JavaScript library for program synthesis from domain-specific languages (DSLs). This library provides a framework for defining custom languages and synthesizing programs that satisfy given specifications through examples and type constraints.

## Overview

js-synth is designed to support synthesis from domain-specific languages by providing:

- **Language Definition Framework**: Define custom DSLs with functions, constants, and parametric elements
- **Type System**: Support for primitive types, type variables, and function types
- **Synthesis Engine**: Core synthesis algorithm that explores program space
- **Parallel Search**: Distributed synthesis across multiple servers
- **Error Handling**: Robust error propagation and scoring mechanisms

## Core Concepts

### Language Elements

A language is defined as an array of language elements, each with the following structure:

```javascript
{
    name: "functionName",
    kind: "fun",           // "fun", "int", or "lambda"
    type: Tp("typeSignature"),
    nargs: numberOfArguments,
    imp: function(arg1, arg2, ...) {
        // Implementation logic
        // Return value, rvError(n), or badResult
    }    
}
```

### Error Handling

Functions should return:
- Regular values for successful computations
- `rvError(n)` if the failure can be attributed to argument `n`
- `badResult` if some sub-computation produced a bad result


## Language Examples

The library includes three example languages demonstrating different synthesis patterns:


### 1. Simple Map Language (`languages/simplmaplang.js`)
A functional programming language focused on list operations:
- **Map**: `map(list, function)`
- **Reduce**: `reduce(list, function, initial)`
- **Filter**: `filter(list, predicate)`
- **Compose**: `compose(function1, function2)`

### 2. String Language (`languages/stringlang.js`)
A string manipulation language using regular expressions:
- **Regex**: `reg()` - parametric regular expressions
- **Substring**: `substring(startA, startB, endA, endB, index, input)`
- **Replace**: `replace(pattern, replacement, input)`


### 3. CSG Language (`languages/csglang.js`)
A constructive solid geometry language for creating and manipulating 2D shapes:
- **Circle**: `circle(x, y, radius)`
- **Rectangle**: `rect(x, y, width, height)`
- **Union**: `union(shape1, shape2)`
- **Difference**: `dif(shape1, shape2)`
- **Loop**: `loop(shape, n, dx, dy)`

## Setting Up a Custom Language

To create your own domain-specific language:

1. **Import the synthesis library**:
   ```javascript
   import { synthesize, isHole, makeHole, score, rvError, isError, isBadResult, Tp } from './synlib.js';
   ```

2. **Define language elements**:
   ```javascript
   let myLanguage = [
       {
           name: "myFunction",
           kind: "fun",
           type: Tp("int->int->int"),
           nargs: 2,
           imp: function(a, b) {
               if (typeof a !== 'number' || typeof b !== 'number') {
                   return rvError(0); // Error in first argument
               }
               return a + b;
           }
       }
   ];
   ```

3. **Define test problems**:
   ```javascript
   let testproblems = {
       "example1": {
           intypes: ["int", "int"],
           io: [[[1, 2], 3], [[5, 3], 8]],
           depth: 3
       }
   };
   ```

## Parallel Search Setup

The library supports distributed synthesis across multiple servers for improved performance.

### Server Setup

1. **Start synthesis servers**:
   ```bash
   node syn-server.js [port]
   ```

2. **Configure parallel client**:
   ```javascript
   import { parallelSolve } from './parallel-client.js';
   
   const servers = ['http://localhost:3000', 'http://localhost:3001'];
   const result = await parallelSolve(problem, servers, language, config);
   ```

### Example Parallel Testers

- **`testers/simplmap-tester.js`**: Basic server-based testing
- **`testers/simplmap-parallel-tester.js`**: Parallel synthesis across multiple servers

## Usage Examples

### Basic Synthesis

```javascript
import { synthesize } from './synlib.js';
import { maplanguage } from './languages/simplmaplang.js';

const problem = {
    intypes: ["list[int]"],
    io: [[[1, 2, 3], [2, 4, 6]], [[0, 1, 2], [0, 2, 4]]],
    depth: 3
};

const result = synthesize(problem, maplanguage, {
    threshold: 0.001,
    bound: 3,
    N: 10000
});
```

### Server-Based Synthesis

```javascript
const body = {
    inputspec: problem.intypes,
    examples: problem.io,
    threshold: 0.001,
    bound: problem.depth,
    N: 10000,
    config: {language: "simplmap"}
};

const response = await fetch('http://localhost:3000/synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
});
```

## Project Structure

```
js-synth/
├── synlib.js                 # Core synthesis library
├── syn-server.js            # HTTP synthesis server
├── parallel-client.js       # Parallel synthesis client
├── multilang-server.js      # Multi-language server
├── languages/               # Example DSL definitions
│   ├── csglang.js          # Constructive solid geometry
│   ├── simplmaplang.js     # Functional list operations
│   └── stringlang.js       # String manipulation
├── testers/                 # Example testers
│   ├── simplmap-tester.js  # Basic server tester
│   ├── simplmap-parallel-tester.js  # Parallel tester
│   └── simplmap-server.js  # Language-specific server
└── performance-eval.js      # Performance evaluation tools
```

## Installation

```bash
npm install
```

## Dependencies

- `express`: HTTP server framework
- `node-fetch`: HTTP client for server communication

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

This library is designed to be extensible. To add new languages or improve the synthesis engine:

1. Study the existing language examples in the `languages/` directory
2. Follow the established patterns for language definition
3. Add appropriate test cases
4. Consider adding parallel search support for performance-critical applications

For more advanced usage, examine the tester files to understand how to integrate with the synthesis servers and parallel search infrastructure. 