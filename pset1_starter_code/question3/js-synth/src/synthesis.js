import { StatsTracker } from './stats.js';
import { FunctionReplacer, FunN, pFunN, LambdaN, InputN, IntN, deBroujin, HOLE } from './exprs.js';
import { deserializeComponent, deserializeProg } from './deserialize.js';
import { componentize } from './librarylearning.js';
import { Tp, Primitive, TypeChecker } from './types.js';
import { RVError, BadResult, isBadResult, isError, badResult, rvError, log } from './util.js';

export { SynthesizerState, Result, randomProgram, runOrLocalize, smcSynth, randomAndHillClimb, randomRandom, fancyRandClone, synthesize, rvError, isError, isBadResult, score, numscore, testProg, inferNargs };

function inferNargs(typeString) {
    if (!typeString || typeof typeString !== 'string') {
        throw new Error(`inferNargs expects a string, got: ${typeof typeString}`);
    }
    // Count main function arrows (not nested in parentheses)
    let depth = 0;
    let arrowCount = 0;
    let i = 0;
    
    while (i < typeString.length) {
        if (typeString[i] === '(' || typeString[i] === '[') {
            depth++;
        } else if (typeString[i] === ')' || typeString[i] === ']') {
            depth--;
        } else if (typeString.substring(i, i + 2) === '->' && depth === 0) {
            arrowCount++;
            i++; // skip the '>'
        }
        i++;
    }
    
    return arrowCount;
}

function testProg(prog, examples, bound, config, st) {
    let out = runOrLocalize(examples, prog, bound);
    if (isBadResult(out)) {
        console.log("BAD RESULT for prog:", prog.toString());
        throw "Should never happen";
    }
    let score = config.scoreOutputs(examples, out);
    if (typeof score !== 'number' || isNaN(score) || score < 0 || score > 1.0001) {
        throw new Error(`invalid score (${score}) for program ${prog.toString()} with actual outputs ${out} and expected outputs ${examples.map(example => example.out)}`);
    }
    // console.log("DEBUG: Program:", prog.toString(), "Score:", score, "Output:", out);
    st.scoreTree(prog, (1 - score) * 100);
    return score;
}

class SynthesizerState {
    constructor(beamsize) {
        this.workList = new Array(beamsize);
        this.extraComponents = [];
        this.beamsize = beamsize;
        this.bestProgram = undefined;
        this.bestScore = 100000;
        this.st = new StatsTracker();
        this.cost = 0;
    }

    /**
     * 
     * This function merges another state into this state. If newBeamsize < this.beamsize+otherState.beamsize, 
     * then it will select from the combination the [newBeams] beams with the highest score. 
     * @param {any} otherState
     * @param {any} newBeamsize
     */
    merge(otherState, newBeamsize) {
        //Step 1, we need to merge the two workList's and pick the top [newBeamsize] beams. We need to remember
        //which ones came from this and which ones came from otherState, because if they use extraComponents, they
        //will use the same name for different components.

        let newWL = this.workList.map((e) => {
            e.origin = 1;
            return e;
        });

        newWL = newWL.concat(otherState.workList.map((e) => {
            e.origin = 2;
            return e;
        }));

        newWL.sort((a, b) => a.score - b.score);

        newWL = newWL.slice(0, newBeamsize);

        this.workList = newWL;
        this.beamsize = newBeamsize;

        //Step 2. We need to rename the extraComponents so they all have unique names.
        let newNameID = 0;
        let renameThis = {};
        for (let comp of this.extraComponents) {
            renameThis[comp.name] = { name: "__foo" + newNameID };
            newNameID++;
        }
        let renameThat = {};
        for (let comp of otherState.extraComponents) {
            renameThat[comp.name] = { name: "__foo" + newNameID };
            newNameID++;
        }
        if (newNameID > 0) {
            let thisRenamer = new FunctionReplacer(renameThis);
            let thatRenamer = new FunctionReplacer(renameThat);
            for (let candidate of newWL) {
                if (candidate.origin == 1) {
                    candidate.prog = candidate.prog.accept(thisRenamer);
                } else {
                    candidate.prog = candidate.prog.accept(thatRenamer);
                }
            }

            //Step 3. we need to merge the extraComponents. If a component is not used in the new workList, we don't need it in
            //the extraComponents anymore. We should also be on the lookout for redundant components.
            let newECs = [];
            for (let comp of this.extraComponents) {
                if (renameThis[comp.name].usecount > 0) {
                    comp.name = renameThis[comp.name].name;
                    newECs.push(comp);
                }
            }
            for (let comp of otherState.extraComponents) {
                if (renameThat[comp.name].usecount > 0) {
                    comp.name = renameThat[comp.name].name;
                    newECs.push(comp);
                }
            }
            this.extraComponents = newECs;
        }
        if (this.bestScore > otherState.bestScore) {
            this.bestScore = otherState.bestScore;
            this.bestProgram = otherState.bestProgram;
        }
        this.cost += otherState.cost;//costs add because we are now incorporating all the knowledge from
        //otherState into this, so we have to account for how much it cost to produce that knowledge.

        //Step 4. We need to merge the StatsTracker. First, we need to rename the states to account for the new component
        //names and remove states corresponding to components that disappeared. Then we merge and we keep the best value
        //for each component.
        function renameInTable(table, renamer) {
            function newName(id) {
                if (id.length == 0) return id;
                if (id.substring(0, 4) == 'fun/') {
                    let fname = id.substring(4);
                    if (fname in renamer) {
                        return renamer[fname].name;
                    }
                }
                return id;
            }

            let rv = {};
            for (let key in table) {
                let parts = key.split(':'); // id:parent:pid:child
                let parent = newName(parts[1]);
                let child = newName(parts[3]);
                let newkey = parts[0] + ':' + parent + ':' + parts[2] + ':' + child;
                rv[newkey] = table[key];
            }
            return rv;
        }

        let trackerThis = renameInTable(this.st.tracker, renameThis);
        let trackerThat = renameInTable(otherState.st.tracker, renameThat);
        //Now they are both in the same key space.
        for (let key in trackerThis) {
            if (key in trackerThat) {
                let entThis = trackerThis[key];
                let entThat = trackerThat[key];
                trackerThis[key] = { reward: Math.max(entThis.reward, entThat.reward), scores: entThis.scores + entThat.scores };
            }
        }
        for (let key in trackerThat) {
            if (!(key in trackerThis)) {
                let entThat = trackerThat[key];
                trackerThis[key] = { reward: entThat.reward, scores: entThat.scores };
            }
        }
        this.st.tracker = trackerThis;
        this.st.resetPolicyCache();
    }


    serialize() {
        return JSON.stringify(this);
    }
    deserialize(json_state, language) {
        let tmpstate;
        if (typeof (json_state) == 'string') {
            tmpstate = JSON.parse(json_state);
        } else {
            tmpstate = json_state;
        }
        let extendedLanguage = language.slice(0);

        this.extraComponents = tmpstate.extraComponents.map((e) => {
            let rv = deserializeComponent(e, language);
            rv.pos = extendedLanguage.length;
            extendedLanguage.push(rv);
            return rv;
        });


        this.workList = tmpstate.workList.map((e) => { return { prog: deserializeProg(e.prog, extendedLanguage), score: e.score }; });
        this.beamsize = tmpstate.beamsize;
        this.bestProgram = deserializeProg(tmpstate.bestProgram, language);
        this.bestScore = tmpstate.bestScore;
        this.st = new StatsTracker(tmpstate.st);
        this.cost = tmpstate.cost;
    }
    getTracker() {
        return this.st;
    }
    populate(gen) {
        for (let i = 0; i < this.beamsize; ++i) {
            let rv = gen(i);
            this.workList[i] = rv;
            if (rv.score < this.bestScore) {
                this.bestScore = rv.score;
                this.bestProgram = rv.prog;
            }
        }
    }
    sortWorklist() {
        this.workList.sort((a, b) => a.score - b.score);
        if (this.highScore() < this.bestScore) {
            this.bestScore = this.highScore();
            this.bestProgram = this.workList[0].prog;
        }
    }
    forEach(f) {
        this.workList.forEach(f);
    }
    setWorkList(newWorkList) {
        this.workList = newWorkList;
    }
    incrementCost(inc) {
        this.cost += inc;
        return this.cost;
    }
    updateBest(score, prog) {
        if (score < this.bestScore) {
            this.bestScore = score;
            this.bestProgram = prog;
        }
    }
    randomIndex() {
        return Math.floor(Math.random() * this.beamsize);
    }
    highScore() {
        return this.workList[0].score;
    }
    lowScore() {
        return this.workList[this.beamsize - 1].score
    }
    replaceWorst(adjusted, score) {
        let beamsize = this.beamsize;
        for (let i = 0; i < beamsize; ++i) {
            if (this.workList[i].score == this.workList[beamsize - 1].score) { // reached the first worst one.
                // If i == beamsize - 1, we are replacing the last one in the list.
                //otherwise, we pick one at random between i and beamsize - 1.
                if (i == beamsize - 1) {
                    this.workList[i] = { prog: adjusted, score: score };
                } else {
                    //pick one at random between i and beamsize - 1.
                    let idx = Math.floor(Math.random() * (beamsize - i)) + i;
                    this.workList[idx] = { prog: adjusted, score: score };
                }
                break;
            }
        }
    }
    componentizeGlobal(core_language) {
        let language = core_language.slice(0);
        this.updateLanguage(language);
        return this.componentize(language);
    }
    componentize(language) {
        let rv = componentize(this.workList, language, this.st);
        if (!rv.component) {
            //no new components.
            return;
        }
        //We need to update the worklist with the new components.
        this.workList = rv.workList;
        this.extraComponents.push(rv.component);
        return rv.component;
    }
    getExtraComponents() {
        return this.extraComponents;
    }
    updateLanguage(language) {
        for (let component of this.extraComponents) {
            component.pos = language.length;
            language.push(component);
        }
    }
    getBestProg() {
        if (this.highScore() < this.bestScore) {
            this.bestScore = this.highScore();
            this.bestProgram = this.workList[0].prog;
        }
        return this.bestProgram;
    }
    getBestScore() {
        if (this.highScore() < this.bestScore) {
            this.bestScore = this.highScore();
            this.bestProgram = this.workList[0].prog;
        }
        return this.bestScore;
    }
}

class Result {
    constructor(status, bestProgram, bestScore, cost, state) {
        this.prog = bestProgram;
        this.status = status;
        this.score = bestScore;
        this.cost = cost;
        this.state = state;
        this.kind = "result";
    }
    toString() {
        let sol = this;
        let synthetics = "";
        let ec = this.state.getExtraComponents();
        if (ec.length > 0) {
            synthetics = '\n' + ec.map((elem) => elem.name + " : " + elem.source.toString() + "\n").reduce((acc, elem) => acc + elem, "");
        }
        return sol.status + " cost:" + (sol.cost) + " score: " + sol.score + "\t" + (sol.prog ? sol.prog.toString() : "NO_PROGRAM_FOUND") + synthetics;
    }
    serialize() {
        return JSON.stringify(this);
    }
    merge(other, newBeamsize) {
        if (other.score < this.score) {
            this.score = other.score;
            this.prog = other.prog;
            this.status = other.status;
        }
        this.cost += other.cost;
        this.state.merge(other.state, newBeamsize);
    }
}

function randomProgram(expectedType, language, bound, st, tc, extras, state, initialBound) {
    if (initialBound == undefined) {
        initialBound = bound;
    }
    if (state == undefined) {
        state = st.startState();
    }

    // Select initial language construct using statistical guidance
    let construct = st.randomConstruct(state, language, extras);
    let initialConst = construct.pos;

    function advanceConstruct() {
        // Filter out lambdas and functions when no depth remaining
        if (bound <= 0) {
            while (construct && (construct.kind == "lambda" || (construct.kind == "fun" && inferNargs(construct.type) > 0))) {
                st.failedAction(state, construct);
                construct = st.nextConstruct(construct, initialConst, state, language, extras);
            }
        }
        // Find type-compatible construct by cycling through language elements
        if (construct) {
            let chk = tc.checkStep(construct, expectedType);
            let i = 0;
            while (!chk && construct) {
                st.failedAction(state, construct);
                ++i;
                construct = st.nextConstruct(construct, initialConst, state, language, extras);
                if (bound <= 0) {
                    while (construct && (construct.kind == "lambda" || (construct.kind == "fun" && inferNargs(construct.type) > 0))) {
                        st.failedAction(state, construct);
                        construct = st.nextConstruct(construct, initialConst, state, language, extras);
                    }
                }
                if (construct) {
                    chk = tc.checkStep(construct, expectedType);
                }
            }
        }
    }


    advanceConstruct();


    if (!construct) {
        st.failedState(state);
        return new RVError(0); // RVError 0 means that this node was unsatisfiable. 
    }

    let oldTypes = tc.checkpoint();

    function fleshOutConstruct(construct) {
        if (construct.kind == "fun") {
            let n = inferNargs(construct.type);
            let args = [];
            let rv;
            if (construct.parametric) {
                let param = construct.paramInit();
                rv = new pFunN(construct.name, construct.imp, args, param);
            } else {
                rv = new FunN(construct.name, construct.imp, args);
            }

            if (!tc.addConstraint(expectedType, construct.returntype, rv.id)) {
                return new RVError(0);
            }
            rv.state = state;
            st.trackAction(state, rv);
            if (n == 0) {
                rv.childstate = st.transition(state, rv, 0);
            }
            // Recursively generate arguments with decremented bound
            for (let i = 0; i < n; ++i) {
                let newstate = st.transition(state, rv, i);
                let arg = randomProgram(tc.convert(construct.typeargs[i], rv.id), language, bound - 1, st, tc, extras, newstate, initialBound);

                if (arg instanceof RVError) {
                    //If i==0 and arg.narg == 0, it means that this whole node is unsatisfiable. 
                    if (i == 0 && arg.narg == 0) {
                        return arg;
                    } else {
                        //The farther we get from zero, the more likely it is that random regeneration might fix things.
                        return new RVError(arg.narg + 1);
                    }
                }
                args.push(arg);
            }
            //console.log("Returning fun", bound);
            rv.actualReturntype = tc.convert(construct.returntype, rv.id);
            return rv;
        }
        if (construct.kind == "int") {
            let randval = Math.floor(Math.random() * (construct.range[1] - construct.range[0] + 1) + construct.range[0]);
            let rv = new IntN(randval, construct.range);

            rv.state = state;
            rv.childstate = st.transition(state, rv, 0);
            if (!tc.addConstraint(expectedType, construct.type, rv.id)) {
                return new RVError(0);
            }
            return rv;
        }
        if (construct.kind == "lambda") {
            let args;
            let rv = new LambdaN(HOLE);
            rv.state = state;

            if (!expectedType) {
                //should not produce lambdas if we don't know what type the argument is going to be.
                return new RVError(0);
            }
            let typeFrom = expectedType.from;
            let typeTo = expectedType.to;
            // Create de Bruijn environment with lambda parameter
            if (extras) {
                let idx = extras.length;
                args = extras.map((dbi, i) => new deBroujin(idx - i, dbi.type, dbi.pos));
                args.push(new deBroujin(0, typeFrom, language.length + idx));
            } else {
                args = [new deBroujin(0, typeFrom, language.length)];
            }

            st.trackAction(state, rv);
            let newstate = st.transition(state, rv, 0);
            // Recursively generate lambda body with extended environment
            let body = randomProgram(typeTo, language, bound - 1, st, tc, args, newstate, initialBound);

            rv.body = body;
            if (body instanceof RVError) {
                return body;
            }
            return rv;
        }
        if (construct.kind == "input") {

            if (!tc.addConstraint(expectedType, construct.type)) {
                return new RVError(0);
            }
            let rv = new InputN(construct.name);
            rv.setState(state);
            rv.childstate = st.transition(state, rv, 0);
            st.trackAction(state, rv);
            return rv;
        }
        if (construct.kind == "index") {
            let rv = new deBroujin(construct.idx);

            if (!tc.addConstraint(expectedType, construct.type, rv.id)) {
                return new RVError(0);
            }
            st.trackAction(state, rv);
            rv.setState(state);
            rv.childstate = st.transition(state, rv, 0);
            return rv;
        }
    }
    let attempts = 0;
    let pbound = 1 / Math.pow(2, bound);
    while (construct) {
        ++attempts;
        let out = fleshOutConstruct(construct);
        if (out instanceof RVError) {
            if (out.narg == 0) {
                //This means that this construct failed conclusively, so we should continue cycling through constructs until
                //we run out, at which point we return 0.
                st.failedAction(state, construct);
                construct = st.nextConstruct(construct, initialConst, state, language, extras);
                advanceConstruct();

                tc.revert(oldTypes);
            } else {
                //This means that this construct failed, but it might be fixable by regenerating it.
                //We flip a biased coin to either retry at this level or go back to the previous level.
                //The lower the bound, the more likely we are to go back to the previous level.
                let mr = Math.random();
                if (initialBound == bound || (mr > pbound && attempts < 5)) {
                    //retry at this level. Since we retry with random, we re-initialize the initial construct.
                    construct = st.randomConstruct(state, language, extras);
                    initialConst = construct.pos;
                    advanceConstruct();

                    tc.revert(oldTypes);
                } else {
                    return new RVError(out.narg + 1);
                }
            }
        } else {

            out.type = expectedType;
            if (!out.type && out.actualReturntype) {
                out.type = out.actualReturntype;
            }
            out.typeConvert(tc);
            out.setDepth();
            return out;
        }
    }
    return new RVError(0);
}

function runOrLocalize(examples, prog, bound) {
    let outputs = [];
    let bestBad = undefined;
    let idx = 0;
    let badIdx = -1;
    for (let example of examples) {
        let out = prog.eval(bound, example.in, []);
        if (isError(out)) {
            out = badResult(undefined, -1, prog, out.narg, bound, []);
        }
        if (isBadResult(out)) {
            badIdx = idx;
            bestBad = out;
            break;
        }
        outputs.push(out);
        ++idx;
    }
    if (bestBad) {
        throw new globalThis.RVError(JSON.stringify(bestBad, undefined, 2));
    }
    return outputs;
}

function soltoString() {
    let sol = this;
    let synthetics = "";
    if (sol.synthetic) {
        synthetics = '\n' + sol.synthetic.map((elem) => elem.name + " : " + elem.source.toString() + "\n").reduce((acc, elem) => acc + elem, "");
    }
    return sol.status + " cost:" + (sol.cost) + " score: " + sol.score + "\t" + sol.prog.toString() + synthetics;
}

function smcSynth(language, examples, bound, budget, outType, state, config) {
    let st;
    let tc = new TypeChecker();
    let out;
    const initBudget = budget;

    let totalScore = 0;

    function mass(score) {
        return Math.exp(-3 * score);
    }
    if (!state) {
        state = new SynthesizerState(config.beamsize || 20);
        st = state.getTracker();
        state.populate((i) => {
            tc.reset();
            let newprog = randomProgram(outType, language, bound, st, tc, undefined, undefined, undefined);
            score = testProg(newprog, examples, bound, config, st);
            totalScore += mass(score);
            return { prog: newprog, score: score };
        });
        budget -= state.beamsize;
    } else {
        totalScore = 0;
        state.forEach((c) => {
            totalScore += mass(c.score);
        });
        st = state.getTracker();
        state.updateLanguage(language);
    }




    state.sortWorklist();

    let lastCacheReset = budget;
    while (budget > 0) {
        if (lastCacheReset - budget > 100) {
            st.resetPolicyCache();
            lastCacheReset = budget;
        }
        let candidates = [];
        state.forEach((c) => {
            let n = Math.ceil((state.beamsize * mass(c.score)) / totalScore)
            for (let i = 0; i < n; ++i) {
                if (candidates.length < state.beamsize) {
                    candidates.push(c);
                }
            }
        });

        totalScore = 0;
        state.setWorkList(candidates.map((entry) => {
            tc.reset();
            let adjusted;
            if (Math.random() > 0.1) {
                adjusted = fancyRandClone(language, entry.prog, bound, st, tc);
                --budget;
            } else {
                adjusted = entry.prog;
            }

            if (adjusted instanceof RVError) {
                console.log("randomAndHillClimb1 FAILED")
                return adjusted;
            }
            score = testProg(adjusted, examples, bound, config, st);
            totalScore += mass(score);
            state.updateBest(score, adjusted);

            return { prog: adjusted, score: score };
        }));


        if (state.bestScore < config.threshold) {
            //All outputs correct enough, we are done!
            //return an object with the program, the status, the score, and the budget. 
            //it also has a print function that returns a string representation of the object.                    
            return new Result("CORRECT", state.getBestProg(), state.getBestScore(), state.incrementCost(initBudget - budget), state);
        }
        state.sortWorklist();


        //let disp = workList.reduce((acc, b) => acc + "" + b.score + ",", "");
        //console.log(disp);

    }
    return new Result("INCORRECT", state.getBestProg(), state.getBestScore(), state.incrementCost(initBudget - budget), state);
}

/**
     * The general strategy for this function is that we keep a worklist of N programs sorted from best to worst.
     * At each step, we randomly pick a program from the worklist. If the program is in the bottom half (bad), 
     * we simply replace it with a new random program. If the program is in the top half (good), we wiggle it 
     * a little, and if it improves, we add it in place of the worse program, and if it doesn't improve, we drop it.
     * @param {any} language
     * @param {any} examples
     * @param {any} prog
     * @param {any} bound
     * @param {any} budget
     */
function randomAndHillClimb(language, examples, bound, budget, outType, state, config) {

    let tc = new TypeChecker();
    let st;
    const initBudget = budget;
    let rejuvenate = -1;
    let compStep = 10000;


    let score;
    // Initialize beam with random programs or reuse existing state
    if (!state) {
        state = new SynthesizerState(config.beamsize || 10);
        st = state.getTracker();
        state.populate((i) => {
            tc.reset();
            let newprog = randomProgram(outType, language, bound, st, tc, undefined, undefined, undefined);
            score = testProg(newprog, examples, bound, config, st);
            return { prog: newprog, score: score };
        });
        budget -= state.beamsize;
    } else {
        st = state.getTracker();
        state.updateLanguage(language);
    }



    // sort so that the lowest score is workList[0]
    state.sortWorklist();


    // Setup component learning and rejuvenation tracking
    let doComponents = config.componentize == true;
    let rejubudget = 300;
    let lastCacheReset = budget;
    let highScore = state.highScore();
    let lowScore = state.lowScore();
    let lastHighLowChange = budget;

    // Main hillclimbing loop: alternate exploration and exploitation
    while (budget > 0) {
        // Periodically reset policy cache to adapt to changing landscape
        if (lastCacheReset - budget > 100) {
            st.resetPolicyCache();
            lastCacheReset = budget;
        }
        // Track score changes for componentization and rejuvenation triggers
        if (highScore != state.highScore() || lowScore != state.lowScore()) {
            lastHighLowChange = budget;
            highScore = state.highScore();
            lowScore = state.lowScore();
        }
        // Component learning: extract patterns when scores stagnate
        if (doComponents && budget < lastHighLowChange - compStep) {
            let comp = state.componentize(language, st);
            if (comp) {
                comp.pos = language.length;
                language.push(comp);
            }
            console.log(budget, ": Componentized");
            lastHighLowChange = budget;
            compStep = compStep * 2; // Reduce componentization frequency
        }
        tc.reset();
        --budget;

        // 50/50 exploration vs exploitation strategy
        const probReplace = 0.5;
        if (Math.random() < probReplace) {
            // EXPLORATION: Generate completely new random program
            let adjusted = randomProgram(outType, language, bound, st, tc, undefined, undefined, undefined);
            if (adjusted instanceof RVError) {
                console.log("randomAndHillClimb1 FAILED")
                return;
            }
            score = testProg(adjusted, examples, bound, config, st);

            log(3, "After mod ", () => adjusted.toString(), "score", score);
            // Replace worst beam member if new program is better
            if (score < 1 && (score <= state.lowScore())) {
                state.replaceWorst(adjusted, score);
            }
        } else {
            // EXPLOITATION: Mutate existing beam program for local search
            let idx = state.randomIndex();
            let prog = state.workList[idx].prog;
            log(3, () => "original one " + idx + ":" + prog.toString() + " score" + workList[idx].score);

            let adjusted = fancyRandClone(language, state.workList[idx].prog, bound, st, tc);
            if (adjusted instanceof RVError) {
                console.log("randomAndHillClimb1 FAILED")
                return;
            }
            score = testProg(adjusted, examples, bound, config, st);
            log(3, "After mod ", () => adjusted.toString(), "score", score);
            // Hillclimbing update: keep if better, occasionally accept worse
            if (score < state.workList[idx].score) {
                state.workList[idx] = { prog: adjusted, score: score };
            } else if (score < state.lowScore()) {
                if (Math.random() < 0.05) {
                    // Occasionally accept slightly worse programs for diversity
                }
            }
        }


        // Sort by score with program depth as tiebreaker (prefer simpler)
        function quant(ent) {
            return ent.score * 100 + ent.prog.depth;
        }

        state.workList.sort((a, b) => quant(a) - quant(b));
        // Check for success: score below threshold
        if (state.highScore() < config.threshold) {
            return new Result("CORRECT", state.getBestProg(), state.getBestScore(), state.incrementCost(initBudget - budget), state);
        }
        // Rejuvenation: replace worst half when scheduled
        if (budget == rejuvenate) {
            for (let i = state.beamsize / 2; i < state.beamsize; ++i) {
                let adjusted = randomProgram(outType, language, bound, st, tc, undefined, undefined, undefined);
                if (adjusted instanceof RVError) {
                    console.log("randomAndHillClimb1 FAILED")
                    return;
                }
                score = testProg(adjusted, examples, bound, config, st);
                state.workList[i] = { prog: adjusted, score: score };
            }
            state.workList.sort((a, b) => quant(a) - quant(b));
            rejuvenate = -1;
            rejubudget = rejubudget * 1.5; // Increase interval between rejuvenations
        }
        // Schedule rejuvenation when beam converges (all same score)
        if (state.highScore() < 1 && state.highScore() == state.lowScore() && rejuvenate < 1) {
            rejuvenate = budget - rejubudget;
        }
    }
    return new Result("INCORRECT", state.getBestProg(), state.getBestScore(), state.incrementCost(initBudget - budget), state);

}

/**
     * This is a synthesis strategy that randomly generates programs until it finds one that works.
     * @param {any} language
     * @param {any} examples
     * @param {any} prog
     * @param {any} bound
     * @param {any} budget
     * @returns { prog: bestSolution, status: "INCORRECT"|"CORRECT", score: bestScore, budget: 0, crashing: how many times has it crashed?, toString: soltoString };
     */
function randomRandom(language, examples, bound, budget, outType, config) {
    let bestSolution = undefined;
    let bestOutput = undefined;
    let bestScore = 100000;//score is an error, so bigger is worse.

    let prog = randomProgram(outType, language, bound, st, tc, undefined, undefined, undefined);
    let out = runOrLocalize(examples, prog, bound);
    const initBudget = budget;

    let crashing = 0;
    while (budget > 0) {
        if (isBadResult(out)) {
            console.log(prog.toString());
            throw "Should never happen";
        } else {
            let score = config.scoreOutputs(examples, out)
            if (typeof score !== 'number' || isNaN(score)) {
                throw new Error("invalid score: " + score);
            }
            st.scoreTree(prog, (1 - score) * 100);
            log(1, budget + " Score:", score, () => prog.toString());
            if (score < config.threshold) {
                //All outputs correct enough, we are done!
                //return an object with the program, the status, the score, and the budget. 
                //it also has a print function that returns a string representation of the object.
                return { prog: prog, status: "CORRECT", score: score, cost: initBudget - budget, initBudget: initBudget, crashing: crashing, toString: soltoString };
            } else {
                if (score < bestScore || (score == bestScore && Math.random() > 0.75)) {
                    //If we are better than the best score, we don't want to lose this solution.
                    bestScore = score;
                    bestSolution = prog;
                    bestOutput = out;
                    log(1, "New best solution", score, () => bestSolution.toString());
                }
                tc.reset();
                prog = randomProgram(outType, language, bound, st, tc, undefined, undefined, undefined); //fancyRandClone(language, prog, bound);
                --budget;
                out = runOrLocalize(examples, prog, bound);
            }

        }

    }
    return { prog: bestSolution, status: "INCORRECT", score: bestScore, cost: initBudget, initBudget: initBudget, crashing: crashing, toString: soltoString };
}

function fancyRandClone(language, prog, bound, st, tc) {
    // Depth-dependent mutation: higher bound = lower mutation probability
    let probBound = Math.pow(1.5, -bound);

    function traverse(node, lbound, envt, expectedType) {
        // With probability (1-probBound), continue traversing deeper
        if (Math.random() > probBound) {

            if (node instanceof FunN) {
                let changed = false;
                // Randomly select one argument to potentially mutate
                let choice = Math.floor(Math.random() * node.args.length);
                let newargs = node.args.map((arg, idx) => {
                    if (idx === choice) {
                        let rv = traverse(arg, lbound - 1, envt, arg.type);

                        if (rv != arg) {
                            changed = true;
                        }
                        return rv;
                    } else {
                        return arg;
                    }
                });
                if (changed) {
                    let rv;
                    if (node.isParametric()) {
                        rv = (new pFunN(node.name, node.impP, newargs, node.param));
                    } else {
                        rv = (new FunN(node.name, node.imp, newargs));
                    }
                    if (newargs.length == 0) {
                        rv.childstate = st.transition(node.state, rv, 0);
                    }
                    rv.type = expectedType || node.type;
                    rv.setDepth();
                    return rv.setState(node.state);

                } else {
                    // If no argument changed, give whole node a chance to be replaced
                    let rv = randomProgram(expectedType, language, lbound, st, tc, envt, node.state, lbound);
                    if (rv instanceof RVError) {

                        return node;
                    }
                    if (rv.equals(node)) {
                        return node;
                    }
                    return rv;
                }
            }
            if (node instanceof LambdaN) {
                let idx = envt.length;
                // Update de Bruijn environment for lambda nesting
                let newenvt = envt.map((dbi, i) => new deBroujin(idx - i, dbi.type, dbi.pos));
                let argtype = node.type ? node.type.from : undefined;
                newenvt.push(new deBroujin(0, argtype, language.length + envt.length));
                let newbody = traverse(node.body, lbound - 1, newenvt, node.body.type);

                if (newbody != node.body) {
                    let rv = (new LambdaN(newbody)).setState(node.state);
                    rv.type = expectedType;
                    rv.setDepth();
                    return rv;
                } else {
                    return node;
                }
            }
            if (node instanceof IntN) {
                // Generate different random value in same range
                let randval = Math.floor(Math.random() * (node.range[1] - node.range[0] + 1) + node.range[0]);
                while (randval == node.val) {
                    randval = Math.floor(Math.random() * (node.range[1] - node.range[0] + 1) + node.range[0]);
                }
                let rv = new IntN(randval, node.range);
                rv.type = expectedType;
                rv.setDepth();
                rv.setState(node.state);
                rv.childstate = node.childstate;
                return rv;
            }

            return node;
        } else {
            // Replace entire subtree with new random program
            let rv = randomProgram(expectedType, language, lbound, st, tc, envt, node.state, lbound);
            if (rv instanceof RVError) {

                return node;
            }
            if (rv.equals(node)) {
                return node;
            }
            return rv;
        }
    }
    let rv = traverse(prog, bound, []);
    // Retry with higher mutation probability if no change occurred
    while (rv == prog) {
        probBound = probBound * 1.5;
        rv = traverse(prog, bound, []);
    }
    return rv;
}

function processFunctionType(c) {
    // Convert string type to Tp object if needed
    let type = (typeof c.type === 'string') ? Tp(c.type) : c.type;
    let nargs = inferNargs(c.type);
    let typeargs = [];
    for (let i = 0; i < nargs; ++i) {
        typeargs.push(type.from);
        type = type.to;
    }
    c.typeargs = typeargs;
    c.returntype = type;
}

function processLanguage(language, inputspec) {
    let rv = language.map(
        (c, idx) => {
            if (c.kind == "fun") {
                processFunctionType(c);
                return c;
            } if (c.kind == "int") {
                c.type = new Primitive("int");
                return c;
            } else {
                return c;
            }
        }
    );
    rv = rv.concat(inputspec.filter((elem) => elem.kind == "input"));
    rv.map((c, idx) => { c.pos = idx; return c; });
    return rv;
}


function synthesize(inputspec, examples, language, scoreOutputs, threshold, bound, N, config) {
    if (!config) {
        config = {};
    }

    config.solver = config.solver || "hillclimb";
    config.scoreOutputs = scoreOutputs;
    config.threshold = threshold;

    // Convert string types to Tp objects in inputspec
    let processedInputspec = inputspec.map(elem => {
        if (elem.type && typeof elem.type === 'string') {
            return { ...elem, type: Tp(elem.type) };
        }
        return elem;
    });

    let outspec = processedInputspec.filter((elem) => elem.kind == "output");
    let outType = undefined;
    if (outspec.length != 0) {
        outType = outspec[0].type;
    }

    let langWithInputs = processLanguage(language, processedInputspec);



    let synthesizer;
    if (config.solver == 'hillclimb') {
        synthesizer = randomAndHillClimb;
    } else if (config.solver == 'smc') {
        synthesizer = smcSynth;
    } else if (config.solver == 'random') {
        synthesizer = randomRandom;
    } else {
        throw "Solver '" + config.solver + "' does not exist.";
    }


    let rv = synthesizer(langWithInputs, examples, bound, N, outType, config.initialState, config);

    return rv;

}
//Score ranges from 0 for perfect match to 1 for bad match.

function score(examples, outputs) {
    function singleOutput(example, output) {
        //If example and output are of wong type DISTANCE = 100;
        if (typeof (example) != typeof (output)) {
            return 100;
        }
        //If example and output are both array type, get the average distance of their elements.
        if (example instanceof Array && output instanceof Array) {
            let minidx = Math.min(example.length, output.length);
            let maxidx = Math.max(example.length, output.length);
            let totdist = 0;
            for (let i = 0; i < minidx; ++i) {
                let dist = singleOutput(example[i], output[i]);
                totdist += dist;
            }
            totdist += (maxidx - minidx) * 100;
            return totdist / maxidx;
        }
        //If they are both scalars, compute a true dist:
        if (example == output) {
            return 0;
        }
        if (example != output) {
            return 50;
        }
    }
    let output = 0;
    for (let idx in outputs) {
        output += singleOutput(examples[idx].out, outputs[idx]) / 100;
    }
    return output / outputs.length;
}

function numscore(examples, outputs) {
    //This is meant for arrays of arrays of numbers. The distance doesn't just capture the numerical
    //distance; it also captures whether they change in ways that are correlated. 
    //We expect the type checker will rule out type mismatches, so we don't have to worry about those. 
    let flatExamples = [];
    let flatOutput = [];
    function singleOutput(example, output) {
        if (typeof (example) != typeof (output)) {
            flatExamples.push('x');
            flatOutput.push('x');
            return;
        }
        if (example instanceof Array && output instanceof Array) {
            let minidx = Math.min(example.length, output.length);
            let maxidx = Math.max(example.length, output.length);
            let totdist = 0;
            for (let i = 0; i < minidx; ++i) {
                singleOutput(example[i], output[i]);
            }
            let dif = (maxidx - minidx);
            for (let i = 0; i < dif; ++i) {
                flatExamples.push('x');
                flatOutput.push('x');
            }
            return;
        }
        flatExamples.push(example);
        flatOutput.push(output);
    }

    for (let idx in outputs) {
        singleOutput(examples[idx].out, outputs[idx]);
    }
    let len = flatExamples.length;
    let hamming = 0;
    let deriv = 0;
    for (let i = 0; i < len; ++i) {
        if (flatExamples[i] == 'x' || flatExamples[i] != flatOutput[i]) {
            hamming++;
        }
        if (i > 0) {
            let curE = flatExamples[i];
            let curO = flatOutput[i];
            let prevE = flatExamples[i - 1];
            let prevO = flatOutput[i - 1];
            if (curE == 'x' || prevE == 'x') {
                continue;
            }
            if (Math.sign(curE - prevE) != Math.sign(curO - prevO)) {
                deriv++;
            }
        }
    }
    return 0.8 * hamming / len + 0.2 * deriv / (len - 1);

}