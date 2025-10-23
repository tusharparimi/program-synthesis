
import { getLabel } from './librarylearning.js';

export { StatsTracker, stateToStr, nextStateToStr };

function stateToStr(state) {
    return state.depth + ":" + state.grandpa + ":" + state.parentIdx + ":" + state.parent;
}

function nextStateToStr(state, node) {
    return (state.depth + 1) + ":" + state.parent + ":" + state.idx + ":" + getLabel(node);
}

class StatsTracker {
    constructor(serialized) {
        if (serialized) {
            this.tracker = serialized.tracker;
        } else {
            this.tracker = {};
        }
        this.policyCache = {};
    }
    resetPolicyCache() {
        this.policyCache = {};
    }
    nextConstruct(construct, initial, state, language, extras) {
        let totalLen = language.length + (extras ? extras.length : 0);
        let idx = (construct.pos + 1) % totalLen;
        if (idx == initial) {
            //This means we have wrapped around and we are done.
            return undefined;
        } else {
            return idx >= language.length ? extras[idx - language.length] : language[idx];
        }
    }

    randomConstruct(state, language, extras) {

        let key = stateToStr(state);
        let pckey = key + ":" + state.idx;
        function uniform() {
            let el = 0;
            if (extras) {
                el = extras.length;
            }
            let idx = Math.floor(Math.random() * (language.length + el));
            return idx >= language.length ? extras[idx - language.length] : language[idx];
        }


        let total;
        let scores;
        let tmp = this.policyCache[pckey];
        if (tmp) {
            total = tmp.total;
            scores = tmp.scores;
            let el = 0;
            if (extras && extras.length > 0) {
                el = extras.length;
                if (scores.length < language.length + el) {
                    scores = this.succScores(state, language, extras);
                    total = scores[scores.length - 1];
                    if (total == 0) {
                        return uniform();
                    }
                    this.policyCache[pckey] = { scores: scores, total: total };
                }
            }
            if (scores.length > language.length + el) {
                total = scores[language.length + el - 1];
            }
        } else {
            let tstate;
            if (key in this.tracker) {
                tstate = this.tracker[key];
            }
            if (!(tstate && tstate.scores > 40)) {
                return uniform();
            }
            scores = this.succScores(state, language, extras);
            total = scores[scores.length - 1];
            if (total == 0) {
                return uniform();
            }
            this.policyCache[pckey] = { scores: scores, total: total };
        }

        let rnd = Math.random() * total;
        let i = 0;
        for (i = 0; i < language.length; ++i) {
            if (scores[i] > rnd) {
                return language[i];
            }
        }
        if (extras) {
            for (let j = 0; j < extras.length; ++j) {
                if (scores[i] > rnd) {
                    return extras[j];
                }
                ++i;
            }
        }
        console.log("WTF!!!!");

    }

    succScores(state, language, extras) {
        let sz = language.length + (extras ? extras.length : 0);
        let rv = new Float32Array(sz);
        let rvidx = 0;
        let total = 0;
        function rescale(score) {
            //(tanh((x-50)/ 50) + 1) / 2
            //(Math.tanh(score / 100) + 1) / 2;
            //return (Math.tanh((score - 50) / 50) + 1) / 2;
            return (Math.tanh((score - 60) / 40) + 1) / 2;
        }
        let zeroR = rescale(0);
        for (let i = 0; i < language.length; ++i) {
            let construct = language[i];
            let totreward = 0;
            let key = nextStateToStr(state, construct);
            let tstate = this.tracker[key];

            if (tstate) {
                totreward = rescale(tstate.reward);
            } else {
                totreward = zeroR;
            }
            total += totreward;
            rv[rvidx] = total; ++rvidx;
        }
        if (extras) {
            for (let i = 0; i < extras.length; ++i) {
                let construct = extras[i];
                let key = nextStateToStr(state, construct, 0);
                let tstate = this.tracker[key];
                let totreward = 0;
                if (tstate) {
                    totreward = rescale(tstate.reward);
                } else {
                    totreward = zeroR;
                }
                total += totreward;
                rv[rvidx] = total; ++rvidx;
            }
        }
        return rv;

    }

    startState() {
        return { parent: "START", parentIdx: 0, grandpa: "", idx: 0, depth: 0 };
    }
    trackAction(state, node) {

    }
    transition(state, node, childidx) {
        childidx = childidx || 0;
        let action = getLabel(node);

        return { parent: action, grandpa: state.parent, parentIdx: state.idx, idx: childidx, depth: state.depth + 1 }; // , pred: state 
    }
    failedAction(state, action) {
        //console.log(stateToStr(state), getLabel(action));
    }
    scoreTree(node, score) {
        if (score <= 0) { return; }
        let tracker = this.tracker;
        function scoreF(key) {
            if (key in tracker) {
                let q = tracker[key];
                if (score > q.reward) {
                    q.reward = score;
                }
                // q.reward =  (q.reward * q.scores + score) / (q.scores + 1);
                q.scores++;
            } else {
                let tr = {
                    reward: score, scores: 1
                };
                tracker[key] = tr;
            }
        }
        node.traverse((n) => {
            let key = stateToStr(n.state);
            scoreF(key);
            if (n.childstate) {
                key = stateToStr(n.childstate);
                scoreF(key);
            }
        });
    }
    failedState(state) {
        return;
    }
}