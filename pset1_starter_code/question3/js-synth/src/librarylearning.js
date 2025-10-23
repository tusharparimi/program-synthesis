import { Tp, TypeVar, Primitive, FunctionType, TypeChecker } from './types.js';
import { ASTVisitor, FunN, pFunN, LambdaN, isHole, Plug, AST } from './exprs.js';
import { inferNargs } from './synthesis.js';


export { stitch, componentize, getLabel };


function stitch(programs, language) {

    function growCandidate(candidate) {
        let tmpPrograms = candidate.instances.slice(0);
        //After calling thre grow visitor, the newInstancesIdx index maps each label to an outId that is an index inside newProgs returned 
        // by the visitor, and a list of indices into the original tmpPrograms that match that grown component.
        //
        let newInstanceIdx = {};

        /**
         * This class will look for the first hole and replace it with either a plug or it will 
         * grow the candidate with potential matches from the matched instances. It uses the variable tmpPrograms to 
         * keep track of which node in the matching instances it is visiting. 
         * 
         * One caveat is that only holes matching nodes with dbidx of -1 can be converted to plugs. 
         */
        class grow extends ASTVisitor {
            constructor() {
                super();
                this.lastParent = undefined;
            }
            visitFun(fun) {
                let local = tmpPrograms.slice(0);
                let newargs = [];
                let changed = false;
                for (let i = 0; i < fun.args.length; ++i) {
                    this.lastParent = fun;
                    for (let q in tmpPrograms) {
                        tmpPrograms[q] = tmpPrograms[q].args[i];
                    }
                    let newarg;
                    if (changed) {
                        newarg = [fun.args[i]];
                    } else {
                        newarg = fun.args[i].accept(this);
                    }
                    if (newargs.length == 0) {
                        for (let j = 0; j < newarg.length; ++j) {
                            if (newarg[j] != fun.args[i]) { changed = true; }
                            newargs.push([newarg[j]]);
                        }
                    } else {
                        let tmp = [];
                        for (let j = 0; j < newarg.length; ++j) {
                            if (newarg[j] != fun.args[i]) { changed = true; }
                            for (let t = 0; t < newargs.length; ++t) {
                                tmp.push(newargs[t].concat([newarg[j]]));
                            }
                        }
                        newargs = tmp;
                    }
                    tmpPrograms = local.slice(0);
                }

                if (changed) {
                    return newargs.map((pfunargs) => new FunN(fun.name, fun.imp, pfunargs).setDepth());
                } else {
                    return [fun];
                }
            }
            visitpFun(pfun) {
                let local = tmpPrograms.slice(0);
                let newargs = [];
                let changed = false;
                for (let i = 0; i < pfun.args.length; ++i) {
                    this.lastParent = pfun;
                    for (let q in tmpPrograms) {
                        tmpPrograms[q] = tmpPrograms[q].args[i];
                    }
                    let newarg;
                    if (changed) {
                        newarg = [fun.args[i]];
                    } else {
                        newarg = fun.args[i].accept(this);
                    }
                    if (newargs.length == 0) {
                        for (let j = 0; j < newarg.length; ++j) {
                            if (newarg[j] != pfun.args[i]) { changed = true; }
                            newargs.push([newarg[j]]);
                        }
                    } else {
                        let tmp = [];
                        for (let j = 0; j < newarg.length; ++j) {
                            if (newarg[j] != pfun.args[i]) { changed = true; }
                            for (let t = 0; t < newargs.length; ++t) {
                                tmp.push(newargs[t].concat([newarg[j]]));
                            }
                        }
                    }
                    tmpPrograms = local;
                }

                if (changed) {
                    return newargs.map((pfunargs) => new pFunN(pfun.name, pfun.impP, pfunargs, pfun.param).setDepth());
                } else {
                    return [pfun];
                }
            }
            visitPlug(plug) {
                return [plug];
            }
            visitHole(hole) {
                //We have reached a hole. This is the only hole we will reach in this pass.
                // tmpPrograms has a list of current nodes in each instance of the original candidate. We need to group them into distinct indexes.                     
                let newNodes = [];
                let hasPlug = false;
                if (this.lastParent.kind != 'lambda') {
                    //It is undesirable to have a plug as the only child of a lambda; it generally just leads to a bad component. 
                    //So we only add if the lastParent is not a lambda, meaning there has to be a function node between the lambda
                    //and the plug.
                    newInstanceIdx["plug"] = { outId: newNodes.length, lst: [] };
                    newNodes.push(new Plug());
                    hasPlug = true;
                }

                for (let idx in tmpPrograms) {
                    let node = tmpPrograms[idx];
                    let label = getLabel(node);
                    //Only add idx to plug if the node has no unbound deBroujin indices.
                    if (node.dbidx == -1 && hasPlug) {
                        newInstanceIdx["plug"].lst.push(idx);
                    }
                    if (label in newInstanceIdx) {
                        newInstanceIdx[label].lst.push(idx);
                    } else {
                        newInstanceIdx[label] = { outId: newNodes.length, lst: [idx] };
                        newNodes.push(newWithHoles(node));
                    }
                }
                return newNodes;
            }
            visitInt(intn) { return [intn]; }
            visitLambda(lambda) {
                let local = tmpPrograms.slice(0);
                for (let q in tmpPrograms) {
                    tmpPrograms[q] = tmpPrograms[q].body;
                }
                this.lastParent = lambda;
                let newbodys = lambda.body.accept(this);
                tmpPrograms = local;
                return newbodys.map((newbody) => {
                    if (newbody != lambda.body) {
                        return new LambdaN(newbody).setState(lambda.state).setDepth();
                    } else {
                        return lambda;
                    }
                });
            }
            visitInput(input) { return [input]; }
            visitIndex(index) {
                return [index];
            }
        }

        class score extends ASTVisitor {
            /**
             * This class computes a score bound for every node in the AST. The scoreBound for the root node will be the 
             * scoreBound of the component.
             * 
             * @param {any} matches
             */
            constructor(matches) {
                super();
                this.matches = matches;
                this.N = matches.length;
            }
            visitFun(fun) {
                let prevMatches = this.matches;
                let scoreBound = 0;
                for (let idx in fun.args) {
                    this.matches = [];
                    for (let i = 0; i < prevMatches.length; ++i) {
                        this.matches.push(prevMatches[i].args[idx]);
                    }
                    fun.args[idx].accept(this);
                    scoreBound += fun.args[idx].scoreBound;
                }
                this.matches = prevMatches;
                scoreBound += this.N;
                fun.scoreBound = scoreBound;
            }
            visitpFun(pfun) { this.visitFun(pfun); }
            visitPlug(plug) {
                //This is a plug, so it has no score.
                plug.scoreBound = 0;
            }
            visitHole(hole) {
                let prevMatches = this.matches;
                let scoreBound = 0;
                for (let i = 0; i < prevMatches.length; ++i) {
                    scoreBound += prevMatches[i].size;
                }
                hole.scoreBound = scoreBound;
            }
            visitInt(intn) { intn.scoreBound = this.N; }
            visitIndex(index) { index.scoreBound = this.N; }
            visitInput(input) { input.scoreBound = this.N; }
            visitLambda(lambda) {
                let prevMatches = this.matches;
                this.matches = [];
                for (let i = 0; i < prevMatches.length; ++i) {
                    this.matches.push(prevMatches[i].body);
                }
                lambda.body.accept(this);
                lambda.scoreBound = lambda.body.scoreBound + this.N;
                this.matches = prevMatches;
            }
        }

        if (candidate.complete) {
            return [candidate];
        }

        let visitor = new grow();
        let newProgs = candidate.construct.accept(visitor);
        //At this point, the size of newProgrs is the same as the number of entries in newInstanceIdx.
        //After the call to the visitor, now we have to reassemble these into a set of worklist elements.
        let rv = [];
        for (let label in newInstanceIdx) {
            let component = newProgs[newInstanceIdx[label].outId];
            let instances = newInstanceIdx[label].lst.map((idx) => candidate.instances[idx]);
            if (instances.length > 0) {
                component.accept(new score(instances));
                rv.push({
                    construct: component,
                    size: component.size,
                    instances: instances,
                    count: instances.length,
                    score: instances.length * component.size,
                    scoreBound: component.scoreBound
                });
            }
        }
        if (rv.length == 0) {
            candidate.complete = true;
            return [candidate];
        }
        return rv;
    }

    function collect(prog, construct) {
        let rv = [];
        //One requirement of components is that they cannot have unbound deBroujin indices, so we need to label every node with
        //whether or not it has unbound deBroujin indices. Each node will have a field dbidx with the maximum unbound deBroujin index of any child node.

        prog.traverse(undefined, undefined, (node) => {
            //we label the nodes bottom up. 
            if (node.kind == 'index') {
                node.dbidx = node.idx;
            } else if (node.kind == 'fun') {
                node.dbidx = -1;
                for (let arg of node.args) {
                    if (arg.dbidx > node.dbidx) {
                        node.dbidx = arg.dbidx;
                    }
                }
            } else if (node.kind == 'lambda') {
                //if the body dbidx is zero or -1, then this node will also be -1. 
                if (node.body.dbidx < 1) {
                    node.dbidx = -1;
                } else {
                    node.dbidx = node.body.dbidx - 1;
                }
            } else {
                node.dbidx = -1;
            }
        });
        //We push into rv all instances of construct in the given program.
        prog.traverse((elem) => {
            if (elem.kind == 'fun' && construct.kind == 'fun' && elem.name == construct.name) {
                rv.push(elem);
            }
            if (elem.kind == 'lambda' && construct.kind == 'lambda') {
                rv.push(elem);
            }

        });
        return rv;
    }

    function getLabel(instance) {
        if (instance.kind == 'lambda') {
            return 'lambda';
        }
        if (instance instanceof pFunN) {

            return "pFun/" + instance.name + "[" + instance.param + "]";
        }
        if (instance instanceof FunN) {
            return "fun/" + instance.name;
        }
        return instance.toString();
    }

    function newWithHoles(instance) {
        if (instance.kind == 'lambda') {
            return new LambdaN(new Hole());
        }
        if (instance instanceof pFunN) {
            return new pFunN(instance.name, instance.impP, instance.args.map((arg) => new Hole()), instance.param);
        }
        if (instance instanceof FunN) {
            return new FunN(instance.name, instance.imp, instance.args.map((arg) => new Hole()));
        }
        return instance;
    }

    function addToWorklist(wlist, instances) {
        let instmap = {};
        if (instances.length > 0) {
            for (let idx in instances) {
                let label = getLabel(instances[idx]);
                if (label in instmap) {
                    instmap[label].instances.push(instances[idx]);
                } else {
                    instmap[label] = { construct: newWithHoles(instances[idx]), instances: [instances[idx]] };
                }
            }
            for (let label in instmap) {
                let inst = instmap[label];
                let totsize = inst.instances.reduce((a, b) => a + b.size, 0);
                inst.size = 1;
                inst.count = inst.instances.length;
                inst.score = inst.count * inst.size;
                inst.scoreBound = totsize;
                wlist.push(inst);
            }
        }

        return 0;
    }

    let worklist = [];
    let componentIndex = {};
    for (let construct of language) {
        let instances = programs.map((prog) => collect(prog, construct)).reduce((a, b) => a.concat(b), []);
        addToWorklist(worklist, instances);
        if (construct.synthetic) {
            // If the construct is synthetic, we need to add it to the component index.
            componentIndex[construct.source.toString()] = construct;
        };
    }
    //Sort the worklist so the one with the highest score comes out on top.
    worklist.sort((a, b) => b.scoreBound - a.scoreBound);
    while (worklist.length > 0) {
        let newWL = worklist.map((elem) => growCandidate(elem)).reduce((a, b) => a.concat(b), []);

        newWL.sort((a, b) => b.score - a.score);
        //Filter out any candidate that already exists in componentIndex.
        newWL = newWL.filter((elem) => !(elem.construct.toString() in componentIndex));

        let newWL2 = newWL.filter((elem) => (elem.scoreBound != elem.score || elem.size > 1) && elem.count > 1);
        if (newWL2.length == 0) {
            return undefined; // No more candidates to grow.
        }
        // Filter out anything whose scoreBound is less than the best score so far.
        let bestScore = newWL2[0].score;
        worklist = newWL2.filter((elem) => elem.scoreBound >= bestScore && elem.count > 1);
        if (worklist.length == 0) {
            return undefined; // No more candidates to grow.
        }
        //let num = 3;
        if (worklist.length > 10000) {
            worklist = worklist.slice(0, 5000);  //filter((elem) => elem.count > num);
            //++num;
        }

        let completed = true;
        for (let idx in worklist) {
            completed = completed && worklist[idx].complete;
        }
        if (completed) {
            break;
        }
    }

    return worklist[0];

}


function componentize(workList, language, st) {
    let result = stitch(workList.map((elem) => elem.prog), language);
    if (!result) {
        return { workList: workList, component: undefined };
    }
    function bulkMapAdd(map1, map2) {
        for (let k in map2) {
            map1[k] = map2[k];
        }
    }
    function mapToArray(map, n) {
        let rv = new Array(n);
        for (let i = 0; i < n; ++i) {
            if (i in map) {
                rv[i] = map[i];
            }
        }
        return rv;
    }

    class ComponentReplacer extends ASTVisitor {
        /**
         * This class will search for instances of the component in the AST and replace them with the corresponding function call.
         * As it traverses the tree, it will maintain a mode that indicates whether it is in search mode or replace mode.
         * In search mode, it scans for the root node of a component instance. During this stage, the visit function is expected to return 
         * an updated version of the AST. 
         * In replace mode, it means that it has already found a component instance, so now it is looking to match the 'plug' nodes in the 
         * component with sub-trees in the AST that now need to be passed as arguments to the new component function. 
         * In replace mode, the visitor returns the list of arguments found so far.
         * In replace mode, there is an invariant that this.instance should always be the newComponent equivalent of the currently visited node at the start of visit.
         * @param {any} result
         */
        constructor(result, newComponent) {
            super();
            this.instances = result.instances;
            this.mode = "search"; // visitor will iterate between search and replace mode.
            //During replace mode, the current instance will be stored in instance.
            this.instance = undefined;
            this.newComponent = newComponent;
            this.result = result;

        }
        generalSearchMode(node, myfun, parentfun) {
            let elem = this.instances.find((elem) => elem == node);
            if (elem) {
                //It matches, so now we switch to replace mode, so that when we visit the children, we are going to get a list of argument nodes
                //that we can plug in to a new function call.
                this.mode = 'replace';
                this.instance = this.result.construct;
                let newargs = myfun(); //This just jumps to the this.mode == 'replace' branch
                let argArray = mapToArray(newargs, inferNargs(this.newComponent.type));
                let rv = new FunN(this.newComponent.name, this.newComponent.imp, argArray);
                let returntype = elem.type;
                let typeargs = argArray.map(arg => arg.type);
                let type = typeargs.reduceRight((type, arg) => new FunctionType(arg, type), returntype);
                if (this.type) {
                    //For now, we assume they are all of the same type, but in reality, they should be 
                    // antiunified to get the most general type that can be supported by the implementation.
                    //this.type = this.type.antiunify(type);
                } else {
                    this.type = type;
                    this.newComponent.type = type;
                    this.newComponent.returntype = returntype;
                    this.newComponent.typeargs = typeargs;
                }
                rv.type = returntype;
                this.mode = 'search';
                return rv;
            } else {
                return parentfun();
            }
        }
        checkAndSetArg(node, rest) {
            if (this.instance.kind == 'plug') {
                let plug = this.instance;
                //We have reached a plug, and therefore an argument to the function.
                let rv = {};
                rv[plug.argpos] = node;
                return rv;
            } else {
                if (rest) {
                    return rest();
                } else {
                    return {};
                }
            }
        }
        visitFun(fun) {
            if (this.mode == 'search') {
                let _this = this;
                return this.generalSearchMode(fun, () => _this.visitFun(fun), () => super.visitFun(fun));
            } else {
                return this.checkAndSetArg(fun, () => {
                    let args = fun.args;
                    let rv = {};
                    let origInstance = this.instance;
                    for (let idx in args) {
                        this.instance = this.instance.args[idx];
                        let arg = args[idx].accept(this);
                        bulkMapAdd(rv, arg); //This will add the arguments to the rv object, which is a map of argument names to argument nodes.
                        this.instance = origInstance; //Reset the instance to the original component.
                    }
                    return rv;
                });
            }
        }
        visitpFun(pfun) {
            return this.visitFun(pfun);
        }
        visitLambda(lambda) {
            if (this.mode == 'search') {
                let _this = this;
                return this.generalSearchMode(lambda, () => _this.visitLambda(lambda), () => super.visitLambda(lambda));
            } else {
                //There is an invariant that instance should equal fun here.
                return this.checkAndSetArg(lambda, () => {
                    let body = this.instance.body;
                    this.instance = body;
                    let rv = lambda.body.accept(this);
                    return rv;
                });
            }
        }
        visitInput(input) {
            if (this.mode == 'search') {
                return this.generalSearchMode(input, () => { return {}; }, () => input);
            } else {
                return this.checkAndSetArg(input);
            }
        }
        visitIndex(index) {
            if (this.mode == 'search') {
                return this.generalSearchMode(index, () => { return {}; }, () => index);
            } else {
                return this.checkAndSetArg(index);
            }
        }
        visitInt(intn) {
            if (this.mode == 'search') {
                return this.generalSearchMode(intn, () => { return {}; }, () => intn);
            } else {
                return this.checkAndSetArg(intn);
            }
        }
        visitHole(hole) {
            throw "no holes at this point!";
        }
        visitPlug(plug) {
            throw "no holes at this point!";
        }

    }
    function resetStates(prog) {
        // sets the state of every node.
        let myState = st.startState();
        prog.traverse((node) => {
            node.setState(myState);
            if ((node.kind != 'fun' && node.kind != 'lambda') || (node.kind == 'fun' && node.args.length == 0)) {
                node.childstate = st.transition(myState, node, 0);
            } else {
                myState = st.transition(myState, node, 0);
                node.curChild = 0;
            }

        }, (node) => {
            node.curChild++;
            myState = st.transition(node.state, node, node.curChild);
        }, (node) => {
            if ('curChild' in node) { delete node.curChild; }
            node.setDepth();
        });
        return prog;
    }
    let visitor = new GenerateCompImplementation(result.construct);
    let imp = result.construct.accept(visitor);
    let name = "__foo" + language.length;
    let found = language.find((elem) => elem.name == name);
    let i = language.length + 1;
    while (found) {
        name = "__foo" + i;
        ++i;
        found = language.find((elem) => elem.name == name);
    }
    function myImp() {
        let args = new Array(arguments.length);
        for (let i = 0; i < arguments.length; ++i) { args[i] = arguments[i]; }
        return imp(args);
    }
    let langEntry = {
        name: name,
        kind: 'fun',
        imp: myImp,
        pos: language.length,
        synthetic: true,
        source: result.construct
    };
    let replacer = new ComponentReplacer(result, langEntry);
    workList = workList.map((elem) => {
        return { prog: resetStates(elem.prog.accept(replacer)), score: elem.score }
    });
    workList.forEach((elem) => st.scoreTree(elem.prog, (1 - elem.score) * 100));
    st.resetPolicyCache();
    return { workList: workList, component: langEntry };
}

function getLabel(node, stage) {
    let kind = node.kind;
    if (kind == "fun") {
        kind = kind + "/" + node.name;
    }
    if (kind == "input") {
        kind = kind + "/" + node.name;
    }
    if (stage != undefined) {
        kind += "/" + stage;
    }
    return kind;
}

