import { Tp, TypeVar, Primitive, FunctionType, TypeChecker } from './types.js';
import { ASTVisitor, FunN, pFunN, LambdaN, isHole, Plug, AST } from './exprs.js';

export { deserializeType, deserializeProg, deserializeState, deserializeComponent };

function deserializeType(type) {
    let rv;
    if (type.kind == 'base') {
        rv = new Primitive(type.name);
    }
    if (type.kind == 'var') {
        rv = new TypeVar(type.name, type.id);
    }
    if (type.kind == 'param') {
        rv = new Parametric(type.name, type.params.map((t) => deserializeType(t)));
    }
    if (type.kind == 'fun') {
        rv = new FunctionType(deserializeType(type.from), deserializeType(type.to));
    }
    for (let x in type) {
        if (!(x in rv)) {
            rv[x] = type[x];
        }
    }
    return rv;
}


function deserializeProg(prog, language) {


    function deserialize(prog, langMap) {
        let rv;
        if (prog.kind == 'fun') {
            let comp = langMap[prog.name];
            if (comp.parametric) {
                rv = new pFunN(prog.name, comp.imp, prog.args.map((arg) => deserialize(arg, langMap)), prog.param);

            } else {
                rv = new FunN(prog.name, comp.imp, prog.args.map((arg) => deserialize(arg, langMap)));
            }
        }
        else if (prog.kind == 'lambda') {
            rv = new LambdaN(deserialize(prog.body, langMap));

        } else if (prog.kind == 'input') {
            rv = new InputN(prog.name);
        } else if (prog.kind == 'index') {
            rv = new deBroujin(prog.idx);
        } else if (prog.kind == 'int') {
            rv = new IntN(prog.val, prog.range);
        } else if (prog.kind == 'plug') {
            rv = new Plug();
        }
        rv.id = prog.id;
        if ('type' in prog) {
            rv.type = deserializeType(prog.type);
        }
        if ('returntype' in prog) {
            rv.returntype = deserializeType(prog.returntype);
        }
        for (let x in prog) {
            if (!(x in rv)) {
                rv[x] = prog[x];
            }
        }
        return rv;

    }
    let langMap = {};
    for (let comp of language) {
        if (comp.kind == 'fun') {
            langMap[comp.name] = comp;
        }
    }
    return deserialize(prog, langMap);
}

function deserializeComponent(component, language) {
    component.source = deserializeProg(component.source, language);
    let visitor = new GenerateCompImplementation(component.source);
    let imp = component.source.accept(visitor);
    function myImp() {
        let args = new Array(arguments.length);
        for (let i = 0; i < arguments.length; ++i) { args[i] = arguments[i]; }
        return imp(args);
    }
    component.imp = myImp;
    if ('type' in component) {
        component.type = deserializeType(component.type);
    }
    if ('returntype' in component) {
        component.returntype = deserializeType(component.returntype);
    }
    if ('typeargs' in component) {
        component.typeargs = component.typeargs.map((e) => deserializeType(e));
    }
    return component;
}

function deserializeState(state_stream, language) {

    if (typeof state_stream == "string") {
        state_stream = JSON.parse(state_stream);
    }

    if (state_stream.kind == "result") {
        let tmpstate = new SynthesizerState(0);
        tmpstate.deserialize(state_stream.state, language);
        let prog = deserializeProg(state_stream.prog, language);
        let rv = new Result(state_stream.status, prog, state_stream.score, state_stream.cost, tmpstate);
        return rv;
    } else {
        let rv = new SynthesizerState(0);
        rv.deserialize(state_stream, language);
        return rv;
    }


}