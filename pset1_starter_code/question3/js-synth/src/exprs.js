import { Tp, TypeVar, Primitive, FunctionType, TypeChecker } from './types.js';
import { isBadResult, badResult, rvError, isError } from './util.js';

export { ASTVisitor, FunN, pFunN, LambdaN, InputN, IntN, deBroujin, Hole, Plug, AST, FunctionReplacer, isHole, makeHole, HOLE };


let INSTID = 0;

/**
 * 
 * This is the base class for all AST nodes, which is used to represent the actual programs being synthesized.
 */
class AST {
    constructor(kind) {
        this.kind = kind;
        this.id = INSTID++;
        this.depth = 0;
        this.size = 1;
    }
    traverse(enter, reenter, end) {
        if (enter) { enter(this); }
        if (end) { end(this) }
    }
    setDepth() {
        this.depth = 0;
        this.depth = 1;
        return this;
    }

    setState(state) {
        this.state = state;
        return this;
    }
    /**
     * If the AST node has a type, this function will apply tc.convert to it.
     * @param {any} tc
     */
    typeConvert(tc) {
        if (this.type) {
            this.type = tc.convert(this.type, this.id);
        }
    }
    accept(visitor) { }
}


class Root extends AST {
    constructor() {
        super("root");
        this.prog = undefined;
    }
    temp(prog) {
        this.prog = prog;
        return this;
    }
    traverse(enter, reenter, end) {
        if (enter) { enter(this); }
        if (this.prog) {
            this.prog.traverse(enter, reenter, end);
        }
    }
}

/**
 * Class representing a function node in the AST.
 */
class FunN extends AST {
    constructor(name, imp, args) {
        super("fun");
        this.name = name;
        this.imp = imp;
        this.args = args;
    }
    isParametric() {
        return false;
    }

    setDepth() {
        let dd = 0;
        let size = 1;
        for (let i = 0; i < this.args.length; ++i) {
            dd = Math.max(this.args[i].depth + 1, dd);
            size += this.args[i].size;
        }
        this.depth = dd;
        this.size = size;
        return this;
    }
    toString() {
        let rv = this.name + "(";
        for (let i = 0; i < this.args.length; i++) {
            rv += this.args[i].toString();
            if (i < this.args.length - 1) {
                rv += ", ";
            }
        }
        rv += ")";
        return rv;
    }
    eval(level, inputs, envt) {
        let actuals = [];
        for (let i in this.args) {
            let arg = this.args[i];
            let actual = arg.eval(level - 1, inputs, envt);
            if (isBadResult(actual)) {
                return actual;
            }
            if (isError(actual)) {
                return badResult(this, i, arg, actual.narg, level - 1, envt);
            }
            actuals.push(actual);
        }
        actuals.push(inputs);
        return this.imp.apply(this, actuals);
    }

    accept(visitor) {
        return visitor.visitFun(this);
    }

    traverse(enter, reenter, end) {
        if (enter) { enter(this); }
        for (let arg of this.args) {
            arg.traverse(enter, reenter, end);
            if (reenter) { reenter(this); }
        }
        if (end) { end(this) }
    }
    equals(other) {
        if (other.kind == "fun") {
            if (this.name != other.name) { return false; }
            if (this.args.length != other.args.length) { return false; }
            for (let i in this.args) {
                if (!this.args[i].equals(other.args[i])) {
                    return false;
                }
            }
        } else {
            return false;
        }
        return true;
    }
    /**
     * Needs to run type convert on the arguments as well, not just itself.
     * @param {any} tc
     */
    typeConvert(tc) {
        super.typeConvert(tc);
        for (let i in this.args) {
            this.args[i].typeConvert(tc);
        }
    }
}

/**
 * This class represents a parametric function. This is a function with tunable parameters which need to be discovered by the synthesizer.
 * The big difference with the constructor of FunN is that the imp functions is replaced by impP which 
 * is a function generator that take the parameters as input and produce the actual imp functions as output. 
 * This generator is kept around as impP so it can be used to generate new versions of the actual functions with different parameters when needed.
 */
class pFunN extends FunN {
    constructor(name, impP, args, param) {
        super(name, impP(param), args);
        this.parametric = true;
        this.param = param;
        this.impP = impP;
    }
    isParametric() {
        return true;
    }
    toString() {
        let rv = this.name + "[" + this.param + "]" + "(";
        for (let i = 0; i < this.args.length; i++) {
            rv += this.args[i].toString();
            if (i < this.args.length - 1) {
                rv += ", ";
            }
        }
        rv += ")";
        return rv;
    }
    accept(visitor) {
        return visitor.visitFun(this);
    }
}




class IntN extends AST {
    constructor(val, range) {
        super("int")
        this.val = val;
        this.range = range;
    }
    setDepth() {
        this.depth = 0;
        this.size = 1;
        return this;
    }
    toString() {
        return "" + this.val;
    }
    eval(level) {
        return this.val;
    }

    traverse(enter, reenter, end) {
        if (enter) { enter(this); }
        if (end) { end(this) }
    }
    equals(other) {
        if (other.kind != "int") {
            return false;
        }
        return this.val == other.val;
    }
    accept(visitor) {
        return visitor.visitInt(this);
    }
}

class LambdaN extends AST {
    constructor(body) {
        super("lambda");
        this.body = body;
    }
    toString() {
        return "(λ" + this.body.toString() + ")";
    }
    setDepth() {
        this.depth = this.body.depth + 1;
        this.size = 1 + this.body.size;
        return this;
    }
    /**
     * The eval for lambda should behave as a built in function, which means if its not a 
     * @param {any} level
     * @param {any} inputs
     * @param {any} envt
     * @returns
     */
    eval(level, inputs, envt) {
        return (x) => {
            // let newenv = [x].concat(envt);
            let newenv = envt.slice(0);
            newenv.push(x);
            let rv = this.body.eval(level - 1, inputs, newenv);
            if (isBadResult(rv)) {
                return rv;
            }
            if (isError(rv)) {
                return badResult(this, undefined, this.body, rv.narg, level - 1, newenv);
            }
            return rv;
        }
    }

    traverse(enter, reenter, end) {
        if (enter) { enter(this); }
        this.body.traverse(enter, reenter, end);
        if (reenter) { reenter(this); }
        if (end) { end(this) }
    }
    equals(other) {
        if (other.kind != "lambda") {
            return false;
        }
        return this.body.equals(other.body);
    }
    /**
     * Needs to run type convert on the arguments as well, not just itself.
     * @param {any} tc
     */
    typeConvert(tc) {
        super.typeConvert(tc);
        this.body.typeConvert(tc);
    }
    accept(visitor) {
        return visitor.visitLambda(this);
    }
}

class InputN extends AST {
    constructor(name) {
        super("input");
        this.name = name;
    }
    toString() {
        return this.name;
    }
    setDepth() {
        this.depth = 0;
        this.size = 1;
        return this;
    }
    eval(level, inputs, envt) {
        return inputs[this.name];
    }

    traverse(enter, reenter, end) {
        if (enter) { enter(this); }
        if (end) { end(this) }
    }
    equals(other) {
        if (other.kind != "input") {
            return false;
        }
        return this.name == other.name;
    }
    accept(visitor) {
        return visitor.visitInput(this);
    }
}

class deBroujin extends AST {
    constructor(idx, type, pos) {
        super("index");
        this.idx = idx;
        if (type) {
            this.type = type;
        }
        if (pos) {
            this.pos = pos;
        }
    }
    toString() {
        return "$" + this.idx;
    }
    eval(level, inputs, envt) {
        return envt[envt.length - 1 - this.idx];
    }
    traverse(enter, reenter, end) {
        if (enter) { enter(this); }
        if (end) { end(this) }
    }
    equals(other) {
        if (other.kind != "index") {
            return false;
        }
        return this.idx == other.idx;
    }
    accept(visitor) {
        return visitor.visitIndex(this);
    }
}

class Hole extends AST {
    constructor(type) {
        super("hole");
        if (type) {
            this.type = type;
        }
        this.size = 0;
    }
    setDepth() {
        this.depth = 0;
        this.size = 0; // holes don't count for size purposes.
        return this;
    }
    toString() {
        return "□";
    }
    eval(level, inputs, envt) {
        return this;
    }

    traverse(enter, reenter, end) {
        if (enter) { enter(this); }
        if (end) { end(this) }
    }
    accept(visitor) {
        return visitor.visitHole(this);
    }
    equals(other) {
        if (other.kind != "hole") {
            return false;
        }
        if (this.type || other.type) {
            return false;
        } else {
            return true;
        }
    }
}

class Plug extends AST {
    constructor() {
        super("plug");
        this.depth = 0;
        this.size = 0;
    }
    setDepth() {
        this.depth = 0;
        this.size = 0; // holes don't count for size purposes.
        return this;
    }
    toString() {
        return "#";
    }
    accept(visitor) {
        return visitor.visitPlug(this);
    }
}

class ASTVisitor {
    visitHole(hole) { return hole; }
    visitFun(fun) {
        let newargs = [];
        let changed = false;
        for (let i = 0; i < fun.args.length; ++i) {
            let newarg = fun.args[i].accept(this);
            if (newarg != fun.args[i]) {
                newargs.push(newarg);
                changed = true;
            } else {
                newargs.push(fun.args[i]);
            }
        }
        if (changed) {
            let rv = new FunN(fun.name, fun.imp, newargs).setState(fun.state).setDepth();
            rv.type = fun.type;
            rv.returntype = fun.returntype;
            rv.typeargs = fun.typeargs;
            return rv;
        } else {
            return fun;
        }
    }
    visitpFun(pfun) {
        let newargs = [];
        let changed = false;
        for (let i = 0; i < pfun.args.length; ++i) {
            let newarg = pfun.args[i].accept(this);
            if (newarg != pfun.args[i]) {
                newargs.push(newarg);
                changed = true;
            } else {
                newargs.push(pfun.args[i]);
            }
        }
        if (changed) {
            let rv = new pFunN(pfun.name, pfun.impP, newargs, pfun.param).setState(pfun.state).setDepth();
            rv.type = fun.type;
            rv.returntype = fun.returntype;
            rv.typeargs = fun.typeargs;
            return rv;
        } else {
            return pfun;
        }
    }
    visitInt(intn) { return intn; }
    visitLambda(lambda) {
        let newbody = lambda.body.accept(this);
        if (newbody != lambda.body) {
            let rv = new LambdaN(newbody).setState(lambda.state).setDepth();
            rv.type = lambda.type;
            return rv;
        } else {
            return lambda;
        }
    }
    visitInput(input) { return input; }
    visitIndex(index) {
        return index;
    }
}


function isHole(val) {
    return val instanceof Hole;
}

function makeHole(type) {
    return new Hole(type);
}


const HOLE = new Hole();


//Visitor to construct a function out of result.component;
class GenerateCompImplementation extends ASTVisitor {
    /**
        * The high-level idea of this class is as follows. The goal is to take an AST of the program and turn it into a function 
        * that can be used as the implementation of a function node in language. 
        * this.args is the total number of arguments in the function, and there is an extra argument containing the global parameters.
        * As an example, suppose that we have a component of the form: 
        *  foo(input("x"), int(42), \lambda plus(plug(0), $0)))
        * Then, this will be translated into 
        *  newfun(arg0, gps){
        *   ((arg0, gps)=>{
        *      return foo(((arg0, gps)=> gps['x'] )(arg0,gps), 
        *                 ((arg0, gps)=> 42)(arg0,gps), 
        *                 ((arg0a, gpsa)=> ( ($0)=>(  
        *                                          ((arg0b, gpsb, $0)=>{return plus( ((arg0c,gpsc,$0c)=> arg0c)(arg0b, gpsb,$0), ((arg0c,gpsc,$0c)=> $0c)(arg0b, gpsb,$0)  ) })(arg0a, gpsa, $0)
        *                                          )   )(arg0, gps) )
        *   })(arg0, gps)
        * }
        * 
        * @param {any} component
        */
    constructor(component) {
        super();
        this.args = 0;
        let _this = this;
        this.imp = undefined;

        component.traverse((node) => {
            if (node.kind == 'plug') { node.argpos = _this.args; _this.args++; }
        });
    }
    visitFun(fun) {
        const imp = fun.imp;
        const lazyArgs = fun.args.map((arg) => arg.accept(this));
        return (args) => {
            let finalArgs = lazyArgs.map((f) => f(args));
            finalArgs.push(args[args.length - 1]); // Add the global parameters as the last argument.
            return imp.apply(null, finalArgs);
        }
    }
    visitpFun(pfun) {
        return this.visitFun(pfun);
    }
    visitLambda(lambda) {
        const body = lambda.body.accept(this);
        return (args) => {
            return (lambdaarg) => {
                let newargs = args.slice(0, args.length - 1);
                newargs.push(lambdaarg);
                newargs.push(args[args.length - 1]);
                return body(newargs);
            }
        };
    }
    visitInput(input) {
        const name = input.name;
        return (args) => args[args.length - 1][name];
    }
    visitIndex(index) {
        const idx = index.idx;
        return (args) => args[args.length - 2 - idx];
    }
    visitHole(hole) { throw "Should not be any holes at this point!"; }
    visitPlug(plug) {
        const idx = plug.argpos;
        return (args) => {
            if (args.length <= idx) {
                throw "Not enough arguments provided to plug!";
            }
            return args[idx];
        };
    }
    visitInt(intn) {
        const n = intn.val;
        return (args) => n;
    }
}

class FunctionReplacer extends ASTVisitor {
    constructor(renames) {
        super();
        this.renames = renames;
        for (let x in renames) {
            let elem = renames[x];
            elem.usecount = 0;
        }
    }

    visitFun(fun) {
        let rv = super.visitFun(fun);
        let name = rv.name;
        if (name in this.renames) {
            let fun = rv;
            rv = new FunN(this.renames[name].name, rv.imp, rv.args).setState(rv.state).setDepth();
            rv.type = fun.type;
            rv.returntype = fun.returntype;
            rv.typeargs = fun.typeargs;
            this.renames[name].usecount++;
        }
        return rv;
    }
}