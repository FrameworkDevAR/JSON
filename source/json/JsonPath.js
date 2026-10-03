import Sort from "./Sort.js";
import Path from "./Path.js";



/**
 * Runs a JSONPath over the value and returns what it finds: the one value
 * a path that names a single place leads to, and the list of every value
 * a path that can lead to several does
 *
 *     $.store.book[?(@.price < 10)].title
 *
 * @param {*}      data
 * @param {String} text
 * @returns {*}
 */
function run(data, text) {
    const state = { text : text.trim(), at : 0, root : data };
    if (!state.text) {
        return data;
    }
    if (state.text[0] !== "$") {
        fail(state, "A JSONPath starts with a $");
    }
    state.at = 1;

    const steps = readSteps(state);
    if (state.at < state.text.length) {
        fail(state, `There is a "${state.text[state.at]}" the path does not know what to do with`);
    }

    let nodes = [ data ];
    for (const step of steps) {
        nodes = nodes.flatMap((node) => step.run(node));
    }
    if (steps.every((step) => step.isSingle)) {
        return nodes.length ? nodes[0] : null;
    }
    return nodes;
}

/**
 * Stops the path with what is wrong with it
 * @param {Object} state
 * @param {String} message
 * @returns {never}
 */
function fail(state, message) {
    throw new Error(`${message}, at character ${state.at + 1}`);
}

/**
 * Returns everything the value holds, and everything those hold, itself
 * included, which is what two dots walk through
 * @param {*} value
 * @returns {Array}
 */
function descend(value) {
    const result = [ value ];
    if (Path.isContainer(value)) {
        for (const child of Object.values(value)) {
            result.push(...descend(child));
        }
    }
    return result;
}

/**
 * Returns what the value holds under the given key, as a list of the one
 * thing or of nothing
 * @param {*}               value
 * @param {(String|Number)} key
 * @returns {Array}
 */
function child(value, key) {
    if (Array.isArray(value)) {
        const index = Number(key) < 0 ? value.length + Number(key) : Number(key);
        return Number.isInteger(index) && index >= 0 && index < value.length ? [ value[index] ] : [];
    }
    if (Path.isContainer(value) && Object.prototype.hasOwnProperty.call(value, key)) {
        return [ value[key] ];
    }
    return [];
}



/**
 * Reads the steps of a path, each taking the values the one before found
 * to the ones it finds in them
 * @param {Object} state
 * @returns {{run: Function, isSingle: Boolean}[]}
 */
function readSteps(state) {
    const { text } = state;
    const steps    = [];

    while (state.at < text.length) {
        if (text.startsWith("..", state.at)) {
            state.at += 2;
            steps.push({ run : descend, isSingle : false });
            if (text[state.at] === "[") {
                continue;
            }
            steps.push(readName(state));
        } else if (text[state.at] === ".") {
            state.at += 1;
            steps.push(readName(state));
        } else if (text[state.at] === "[") {
            state.at += 1;
            steps.push(readBrackets(state));
        } else {
            break;
        }
    }
    return steps;
}

/**
 * Reads the name after a dot, which is a key or a star for every one
 * @param {Object} state
 * @returns {{run: Function, isSingle: Boolean}}
 */
function readName(state) {
    if (state.text[state.at] === "*") {
        state.at += 1;
        return { run : (value) => (Path.isContainer(value) ? Object.values(value) : []), isSingle : false };
    }

    const name = /[^.[\]\s()<>=!&|,~]+/y;
    name.lastIndex = state.at;
    const match = name.exec(state.text);
    if (!match) {
        fail(state, "A dot must be followed by a name");
    }
    state.at += match[0].length;
    return { run : (value) => child(value, match[0]), isSingle : true };
}

/**
 * Reads what is between brackets: keys, places of a list, a slice of one,
 * a star, or a condition the values have to answer
 * @param {Object} state
 * @returns {{run: Function, isSingle: Boolean}}
 */
function readBrackets(state) {
    const { text } = state;
    skipSpaces(state);

    if (text[state.at] === "*") {
        state.at += 1;
        close(state);
        return { run : (value) => (Path.isContainer(value) ? Object.values(value) : []), isSingle : false };
    }

    if (text[state.at] === "?") {
        state.at += 1;
        const test = readOr(state);
        close(state);
        return {
            run      : (value) => (Path.isContainer(value) ? Object.values(value) : []).filter((item) => Boolean(test(item))),
            isSingle : false,
        };
    }

    // A slice is the one thing with colons in it
    const slice = /\s*(-?\d+)?\s*:\s*(-?\d+)?\s*(?::\s*(-?\d+)?\s*)?\]/y;
    slice.lastIndex = state.at;
    const parts = slice.exec(text);
    if (parts) {
        state.at += parts[0].length;
        return { run : (value) => cut(value, parts[1], parts[2], parts[3]), isSingle : false };
    }

    const keys = [];
    for (;;) {
        skipSpaces(state);
        if (text[state.at] === "'" || text[state.at] === "\"") {
            keys.push(readString(state));
        } else {
            const number = /-?\d+/y;
            number.lastIndex = state.at;
            const match = number.exec(text);
            if (!match) {
                fail(state, "The brackets need a key, a place or a condition");
            }
            state.at += match[0].length;
            keys.push(Number(match[0]));
        }
        skipSpaces(state);
        if (text[state.at] !== ",") {
            break;
        }
        state.at += 1;
    }
    close(state);
    return { run : (value) => keys.flatMap((key) => child(value, key)), isSingle : keys.length === 1 };
}

/**
 * Takes the bracket that closes the ones being read
 * @param {Object} state
 * @returns {Void}
 */
function close(state) {
    skipSpaces(state);
    if (state.text[state.at] !== "]") {
        fail(state, "A bracket is never closed");
    }
    state.at += 1;
}

/**
 * Returns the part of a list between two places, taking one of every so
 * many, the way a slice is counted
 * @param {*}       value
 * @param {String=} from
 * @param {String=} to
 * @param {String=} step
 * @returns {Array}
 */
function cut(value, from, to, step) {
    if (!Array.isArray(value)) {
        return [];
    }
    const every = Math.max(Number(step || 1), 1);
    return value.slice(from === undefined ? 0 : Number(from), to === undefined ? undefined : Number(to))
        .filter((item, index) => index % every === 0);
}

/**
 * Moves past the spaces that are next
 * @param {Object} state
 * @returns {Void}
 */
function skipSpaces(state) {
    while (state.at < state.text.length && /\s/.test(state.text[state.at])) {
        state.at += 1;
    }
}

/**
 * Reads a text in single or double quotes
 * @param {Object} state
 * @returns {String}
 */
function readString(state) {
    const { text } = state;
    const quote    = text[state.at];
    let   result   = "";
    for (state.at += 1; state.at < text.length; state.at += 1) {
        if (text[state.at] === "\\" && state.at + 1 < text.length) {
            state.at += 1;
            result   += text[state.at];
        } else if (text[state.at] === quote) {
            state.at += 1;
            return result;
        } else {
            result += text[state.at];
        }
    }
    return fail(state, "A text is never closed");
}



/**
 * Reads conditions with an "or" between them. Each one comes back as a
 * function that takes an item and gives what the condition does for it
 * @param {Object} state
 * @returns {Function}
 */
function readOr(state) {
    let left = readAnd(state);
    for (;;) {
        skipSpaces(state);
        if (!state.text.startsWith("||", state.at)) {
            return left;
        }
        state.at += 2;
        const one   = left;
        const other = readAnd(state);
        left = (item) => Boolean(one(item)) || Boolean(other(item));
    }
}

/**
 * Reads conditions with an "and" between them
 * @param {Object} state
 * @returns {Function}
 */
function readAnd(state) {
    let left = readTest(state);
    for (;;) {
        skipSpaces(state);
        if (!state.text.startsWith("&&", state.at)) {
            return left;
        }
        state.at += 2;
        const one   = left;
        const other = readTest(state);
        left = (item) => Boolean(one(item)) && Boolean(other(item));
    }
}

/**
 * Reads a condition, which is two values and the sign that compares them,
 * or a single value that only has to be there
 * @param {Object} state
 * @returns {Function}
 */
function readTest(state) {
    const { text } = state;
    const left     = readOperand(state);
    skipSpaces(state);

    const sign = [ "===", "!==", "==", "!=", "<=", ">=", "<", ">", "=~" ].find((one) => text.startsWith(one, state.at));
    if (!sign) {
        return (item) => {
            const value = left(item);
            return value !== undefined && value !== null && value !== false;
        };
    }
    state.at += sign.length;
    skipSpaces(state);

    if (sign === "=~") {
        const pattern = /\/((?:\\.|[^/\\])+)\/([a-z]*)/y;
        pattern.lastIndex = state.at;
        const match = pattern.exec(text);
        if (!match) {
            fail(state, "A =~ must be followed by a /pattern/");
        }
        state.at += match[0].length;
        const regex = new RegExp(match[1], match[2]);
        return (item) => regex.test(String(left(item)));
    }

    const right = readOperand(state);
    return (item) => {
        const one   = left(item);
        const other = right(item);
        if (one === undefined || other === undefined) {
            return sign.startsWith("!");
        }
        switch (sign) {
        case "==":
        case "===":
            return isEqual(one, other);
        case "!=":
        case "!==":
            return !isEqual(one, other);
        case "<":
            return typeof one === typeof other && Sort.compare(one, other) < 0;
        case "<=":
            return typeof one === typeof other && Sort.compare(one, other) <= 0;
        case ">":
            return typeof one === typeof other && Sort.compare(one, other) > 0;
        default:
            return typeof one === typeof other && Sort.compare(one, other) >= 0;
        }
    };
}

/**
 * Returns true if both values are the same, all the way in
 * @param {*} one
 * @param {*} other
 * @returns {Boolean}
 */
function isEqual(one, other) {
    if (one === other) {
        return true;
    }
    return Path.isContainer(one) && Path.isContainer(other) && JSON.stringify(one) === JSON.stringify(other);
}

/**
 * Reads one side of a condition: a path from the item or from the root, a
 * text, a number, a word, a condition in parentheses, or one turned around
 * @param {Object} state
 * @returns {Function}
 */
function readOperand(state) {
    const { text } = state;
    skipSpaces(state);
    const char = text[state.at];

    if (char === "(") {
        state.at += 1;
        const test = readOr(state);
        skipSpaces(state);
        if (text[state.at] !== ")") {
            fail(state, "A parenthesis is never closed");
        }
        state.at += 1;
        return test;
    }
    if (char === "!") {
        state.at += 1;
        const test = readOperand(state);
        return (item) => {
            const value = test(item);
            return value === undefined || value === null || value === false;
        };
    }
    if (char === "@" || char === "$") {
        state.at += 1;
        const steps = readSteps(state);
        const { root } = state;
        return (item) => {
            let nodes = [ char === "@" ? item : root ];
            for (const step of steps) {
                nodes = nodes.flatMap((node) => step.run(node));
            }
            return nodes.length ? nodes[0] : undefined;
        };
    }
    if (char === "'" || char === "\"") {
        const value = readString(state);
        return () => value;
    }

    const word = /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/y;
    word.lastIndex = state.at;
    const match = word.exec(text);
    if (!match) {
        fail(state, "A condition needs a value here");
    }
    state.at += match[0].length;
    const value = JSON.parse(match[0]);
    return () => value;
}




// The public API
export default {
    run,
};
