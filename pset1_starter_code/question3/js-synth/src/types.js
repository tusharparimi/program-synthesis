export { Tp, TypeVar, Primitive, FunctionType, TypeChecker };


class Type {
    constructor(kind) {
        this.kind = kind;
    }
}

class Primitive extends Type {
    constructor(name) {
        super("base");
        this.name = name;
        this.isFixed = true;
    }
    toString() {
        return this.name;
    }
    addId() {
        return this;
    }
    replaceVar(f) {
        return this;
    }
    compatible(t) {
        if (t instanceof Primitive) {
            return this.name == t.name;
        }
        if (t instanceof TypeVar) {
            return true;
        }
        return false;
    }
    contains() {
        return false;
    }
}

let greeks = {
    "\\alpha": "α",
    "\\beta": "β",
    "\\gamma": "γ",
    "\\delta": "δ",
    "\\epsilon": "ε",
}

class TypeVar extends Type {
    constructor(name, id) {
        super("var");
        if (name in greeks) {
            this.name = greeks[name];
        } else {
            this.name = name;
        }


        if (id != undefined) {
            this.id = id;
            this.namewid = this.name + "." + this.id;
        }
        this.isFixed = false;
    }
    toString() {
        if ('id' in this) {
            return this.namewid;
        } else {
            return this.name;
        }
    }
    addId(id) {
        if ('id' in this) {
            return this;
        } else {
            return new TypeVar(this.name, id);
        }
    }
    replaceVar(f) {
        return f(this);
    }
    compatible(t) {
        return true;
    }
    contains(alt) {
        if (alt instanceof TypeVar) {
            if ('id' in this) {
                return alt.name == this.name && alt.id === this.id;
            } else {
                return alt.name == this.name;
            }
        } else {
            //alt must be a string;               
            return alt == this.toString();
        }

    }
    antiunify(other, state) {
        if (other instanceof TypeVar && other.name == this.name) {
            return this;
        } else {
            for (let x in greeks) {
                if (!greeks[x] in state) {
                    state[greeks[x]] = true;
                    return new TypeVar(greeks[x]);
                }
            }
        }
    }
}

class Parametric extends Type {
    constructor(name, params) {
        super("param");
        this.name = name;
        this.params = params;
        let ifx = true;
        for (let i = 0; i < params.length; ++i) {
            ifx = ifx && params[i].isFixed;
        }
        this.isFixed = ifx; //parametric types are fixed if all their parameters are fixed.
    }
    toString() {
        let rv = this.name;
        rv += "[";
        for (let i = 0; i < this.params.length; ++i) {
            rv += this.params[i].toString();
            if (i < this.params.length - 1) {
                rv += ", ";
            }
        }
        rv += "]";
        return rv;
    }
    addId(id) {
        let np = [];
        let changed = false;
        for (let i = 0; i < this.params.length; ++i) {
            let p = this.params[i].addId(id);
            np.push(p);
            if (p != this.params[i]) {
                changed = true;
            }
        }
        if (changed) {
            return new Parametric(this.name, np);
        } else {
            return this;
        }
    }
    replaceVar(f) {
        if (this.params.length == 1) {
            let p = this.params[0].replaceVar(f);
            if (p != this.params[0]) {
                return new Parametric(this.name, [p]);
            } else {
                return this;
            }
        } else {
            let np = [];
            let changed = false;
            for (let i = 0; i < this.params.length; ++i) {
                let p = this.params[i].replaceVar(f);
                np.push(p);
                if (p != this.params[i]) {
                    changed = true;
                }
            }
            if (changed) {
                return new Parametric(this.name, np);
            } else {
                return this;
            }
        }
    }
    compatible(t) {
        if (t instanceof Primitive) {
            return false;
        }
        if (t instanceof TypeVar) {
            return true;
        }
        if (t instanceof Parametric) {
            if (this.name != t.name) {
                return false;
            }
            if (this.params.length != t.params.length) {
                return false;
            }
            for (let i = 0; i < this.params.length; ++i) {
                if (!this.params[i].compatible(t.params[i])) {
                    return false;
                }
            }
            return true;
        }
        if (t instanceof FunctionType) {
            return false;
        }
    }
    contains(alt) {
        //assumes alt is a typeVar
        for (let p of this.params) {
            if (p.contains(alt)) {
                return true;
            }
        }
        return false;
    }
}
class FunctionType extends Type {
    constructor(from, to) {
        super("fun");
        this.from = from;
        this.to = to;
        this.isFixed = from.isFixed && to.isFixed; //function types are fixed if both their from and to types are fixed.
    }
    toString() {
        let rv = this.from.toString();
        if (this.from instanceof FunctionType) {
            rv = "(" + rv + ")";
        }
        return rv + " -> " + this.to.toString();
    }
    addId(id) {
        let newfrom = this.from.addId(id);
        let newto = this.to.addId(id);
        if (newfrom != this.from || newto != this.to) {
            return new FunctionType(newfrom, newto);
        } else {
            return this;
        }
    }
    replaceVar(f) {
        let newfrom = this.from.replaceVar(f);
        let newto = this.to.replaceVar(f);
        if (newfrom != this.from || newto != this.to) {
            return new FunctionType(newfrom, newto);
        } else {
            return this;
        }
    }
    compatible(t) {
        if (t instanceof FunctionType) {
            return this.from.compatible(t.from) && this.to.compatible(t.to);
        }
        return t.compatible(this);
    }
    contains(alt) {
        //assumes alt is a typeVar
        return this.from.contains(alt) || this.to.contains(alt);
    }
}

//This function parses a string representing a type into an AST of types.
//Type variables are represented wity Latex greek letters (e.g. \alpha, \beta),
//primitive types are represented with their name (e.g. int, string),
//parametric types are represented with a name and its parameters in square brackets (e.g. list[int], set[\alpha])
//Function types are represented with the -> symbol (e.g. int -> string -> bool)
function parseType(str) {
    function consume(token, str) {
        let rv = str.match(token);
        if (rv) {
            return str.substring(rv.index + rv[0].length).trim();
        } else {
            throw "Expected " + token + " but got " + str;
        }
    }
    function parseName(str) {
        //check if it's a primitive or a type var and then return either [Primitive, rest] or [TypeVar, rest]]
        let rv = str.match(/^[a-zA-Z]+/);
        if (rv) {
            return [new Primitive(rv[0]), str.substring(rv[0].length).trim()];
        }
        rv = str.match(/^\\[a-zA-Z]+/);
        if (rv) {
            return [new TypeVar(rv[0]), str.substring(rv[0].length).trim()];
        } else {
            throw "Expected a type name or a type variable but got " + str;
        }
    }

    str = str.trim();
    let type;
    if (str[0] == "(") {
        let rv = parseType(str.substring(1));
        str = consume("\\)", rv[1]);
        type = rv[0];
    } else {
        let res = parseName(str);
        type = res[0];
        str = res[1];
        if (str[0] == "[") {
            let params = [];
            str = consume("\\[", str);
            while (str[0] != "]") {
                let res = parseType(str);
                params.push(res[0]);
                str = res[1];
                if (str[0] == ",") {
                    str = consume(",", str);
                }
            }
            str = consume("\\]", str);
            type = new Parametric(type.name, params);
        }
    }
    if (str[0] == "-") {
        str = consume("->", str);
        let res = parseType(str);
        type = new FunctionType(type, res[0]);
        str = res[1];
    }
    return [type, str];
}
function Tp(str) {
    let rv = parseType(str);
    return rv[0];
}



class TypeChecker {

    constructor() {
        this.constraints = new Map();
    }

    reset() {
        this.constraints = new Map();
    }

    checkpoint() {
        //return a clone of the constraints object
        //return Object.assign({}, this.constraints);
        let rv = [];
        let tc = this.constraints.entries();
        for (let x of tc) {
            rv.push(x);
        }
        return rv;
    }
    revert(checkpoint) {
        //this.constraints = Object.assign({}, checkpoint);
        let tc = new Map();
        for (let i = 0; i < checkpoint.length; ++i) {
            let ent = checkpoint[i];
            tc.set(ent[0], ent[1]);
        }
        this.constraints = tc;
    }

    checkStep(node, expectedType) {
        if (!expectedType) { return true; }
        if (node.kind == "lambda") {
            return expectedType instanceof FunctionType;
        }
        if (node.kind == 'fun') {
            return expectedType.compatible(node.returntype);
        }
        if (node.type) {
            return expectedType.compatible(node.type);
        }
        return true;
    }

    /**
     * This function takes a type and replaces any type variables that have been constrained to a concrete type.        
     * @param {any} type
     * @param {any} id
     * @param {any} limit
     * @returns
     */
    convert(type, id, limit) {
        if (type.isFixed) { return type; } //If the type is fixed, we don't need to convert it.
        if (limit == undefined) { limit = 20; }
        if (limit <= 0) {
            throw "Too much";
        }
        return type.replaceVar((t) => {
            t = t.addId(id);
            let ts = t.toString();
            let converted = this.constraints.get(ts);
            if (converted) {
                return this.convert(converted, undefined, limit - 1);
            } else {
                return t;
            }
        });
    }
    /**
     * This function is similar to convert, but it assumes that the type variables aready have their id set. 
     * This is only used internally when generating constraints to avoid converting a type variable to another type variable 
     * when it is possible to convert it all the way to a primitive.
     * @param {any} type
     * @param {any} limit
     * @returns
     */
    localConvert(type, limit) {
        if (type.isFixed) { return type; }
        if (limit == undefined) { limit = 20; }
        if (limit <= 0) {
            throw "Too much";
        }
        return type.replaceVar((t) => {
            let ts = t.toString();
            if (this.constraints.has(ts)) {
                return this.localConvert(this.constraints.get(ts), limit - 1);
            } else {
                return t;
            }
        });
    }


    constraint(ta, tb) {
        let taconv = this.constraints.get(ta);
        if (taconv) {
            let alt = this.localConvert(taconv);
            if (alt instanceof TypeVar) {
                if (!(tb instanceof TypeVar)) {
                    //We need to check if the parametric doesn't contain alt internally, because then it wouldn't be compatible.
                    if (!(tb.contains(alt))) {
                        this.constraints.set(ta, tb);
                        this.constraints.set(alt.toString(), tb);
                        return true;
                    } else {
                        //console.log("Trying to unify " + ta + " with " + tb.toString() + " but they are incompatible.");                            
                        return false;
                    }
                }
                //console.log("Trying to unify " + ta + " with " + tb.toString() + " but they are incompatible.");
                throw "NYI";
                return false;
            } else {
                let tbs = tb.toString();
                let alts = alt.toString();
                if (tbs == alts) {
                    return true;
                }
                if (tb instanceof TypeVar) {
                    return this.constraint(tbs, alt);
                }
                //console.log("Trying to unify " + ta + " with " + tb.toString() + " but it's already constrained to " + alt);
                if (alt instanceof Parametric && !(tb instanceof Parametric)) {
                    return false;
                }
                if (alt instanceof FunctionType && !(tb instanceof FunctionType)) {
                    return false;
                }
                return this.unify(alt, tb);
            }
        } else {
            if (tb.contains(ta)) {
                return false;
            }
            this.constraints.set(ta, tb);
            return true;
        }
    }

    addConstraint(expectedType, newType, id) {
        if (expectedType == undefined) { return true; }
        let type = newType;
        type = type.addId(id);
        return this.unify(expectedType, type);
    }
    unify(ta, tb) {
        if (ta instanceof Primitive) {
            if (tb instanceof Primitive) {
                return ta.name == tb.name;
            }
            if (tb instanceof TypeVar) {
                return this.constraint(tb.toString(), ta);
            }
            return false;
        }
        if (ta instanceof TypeVar) {
            if (tb instanceof Primitive) {
                return this.constraint(ta.toString(), tb);
            }
            if (tb instanceof TypeVar) {
                let tas = ta.toString();
                let tbs = tb.toString();
                if (tas == tbs) {
                    return true;
                }
                // We  want to pick one to be the primary, so that the secondary just gets replaced by the primary.
                //The goal is to avoid cycles.
                let taconv = this.constraints.get(tas);
                if (taconv) {
                    let tbconv = this.constraints.get(tbs);
                    if (tbconv) {
                        //Both already have constraints. We need to check if they are compatible.
                        //If they are not, then we are done and return false.
                        let converted = this.localConvert(tbconv);
                        let rv = this.unify(taconv, converted);
                        if (!rv) {
                            return false;
                        }
                        //If they are compatible, we just pick one to point to the other.
                        return this.constraint(tas, converted);
                    } else {
                        //Easy, ta has constraints, tb does not. We just point tb to ta.
                        return this.constraint(tbs, this.localConvert(taconv));
                    }
                } else {
                    let tbconv = this.constraints.get(tbs);
                    if (tbconv) {
                        //Easy, tb has constraints, ta does not. We just point ta to tb.
                        return this.constraint(tas, this.localConvert(tbconv));
                    } else {
                        //None of them has constraints, we just point one to the other.
                        return this.constraint(tas, tb);
                    }
                }

            }
            if (tb instanceof Parametric) {
                return this.constraint(ta.toString(), this.localConvert(tb));
            }
            if (tb instanceof FunctionType) {
                return this.constraint(ta.toString(), this.localConvert(tb));
            }
        }
        if (ta instanceof Parametric) {
            if (tb instanceof Primitive) {
                return false;
            }
            if (tb instanceof TypeVar) {
                return this.constraint(tb.toString(), this.localConvert(ta));
            }
            if (tb instanceof Parametric) {
                if (ta.name != tb.name) {
                    return false;
                }
                if (ta.params.length != tb.params.length) {
                    return false;
                }
                for (let i = 0; i < ta.params.length; ++i) {
                    if (!this.unify(ta.params[i], tb.params[i])) {
                        return false;
                    }
                }
                return true;
            }
            if (tb instanceof FunctionType) {
                return false;
            }
        }
        if (ta instanceof FunctionType) {
            if (tb instanceof Primitive) {
                return false;
            }
            if (tb instanceof TypeVar) {
                return this.constraint(tb.toString(), this.localConvert(ta));
            }
            if (tb instanceof Parametric) {
                return false;
            }
            if (tb instanceof FunctionType) {
                return this.unify(ta.from, tb.from) && this.unify(ta.to, tb.to);
            }
        }
    }



}
