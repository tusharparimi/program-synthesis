export { log, verbosity, RVError, BadResult, isBadResult, isError, badResult, rvError };


let verbosity = 0;

function log(level, msg1, msg2, msg3, msg4) {
    if (level <= verbosity) {
        if (typeof (msg1) == 'function') { msg1 = msg1(); }
        if (typeof (msg2) == 'function') { msg2 = msg2(); }
        if (typeof (msg3) == 'function') { msg3 = msg3(); }
        if (typeof (msg4) == 'function') { msg4 = msg4(); }
        console.log(msg1, msg2, msg3, msg4);
    }
}

class RVError {
    constructor(narg) {
        this.narg = narg;
    }
    toString() {
        return "RVError(" + this.narg + ")";
    }
}

class BadResult {
    constructor(parent, parent_idx, main, child_idx, level, envt) {
        this.parent = parent;
        this.parent_idx = parent_idx;
        this.main = main;
        this.child_idx = child_idx;
        this.level = level;
        this.envt = envt;
    }
}

function isBadResult(res) {
    return res instanceof BadResult;
}

function isError(res) {
    return res instanceof RVError;
}

function badResult(parent, parent_idx, child, child_idx, level, envt) {
    return new BadResult(parent, parent_idx, child, child_idx, level, envt);
}

function rvError(child_id) {
    return new RVError(child_id);
}