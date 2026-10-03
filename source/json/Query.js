import Sort from "./Sort.js";
import Path from "./Path.js";



// The signs that stand between two values, from the ones that hold the
// loosest to the ones that hold the tightest
const LEVELS = [
    [ "or" ],
    [ "and" ],
    [ "==", "!=", "<=", ">=", "<", ">", "not in", "in" ],
    [ "+", "-" ],
    [ "*", "/", "%" ],
    [ "^" ],
];



/**
 * Runs a query over the value and returns what it gives. A query is a
 * chain of steps, each handing what it gives to the next:
 *
 *     .users | filter(.age >= 18 and .city == "Rosario") | sort(.name) | pick(.name, .age)
 *
 * @param {*}      data
 * @param {String} text
 * @returns {*}
 */
function run(data, text) {
    const state = { text, at : 0 };
    skipSpaces(state);
    if (state.at >= text.length) {
        return data;
    }

    const node = readPipe(state);
    skipSpaces(state);
    if (state.at < text.length) {
        fail(state, `There is a "${text[state.at]}" the query does not know what to do with`);
    }
    return clean(evaluate(node, data));
}

/**
 * Returns the value with nothing JSON has no way to write
 * @param {*} value
 * @returns {*}
 */
function clean(value) {
    if (value === undefined || (typeof value === "number" && !Number.isFinite(value))) {
        return null;
    }
    return value;
}

/**
 * Stops the query with what is wrong with it
 * @param {Object} state
 * @param {String} message
 * @returns {never}
 */
function fail(state, message) {
    throw new Error(`${message}, at character ${state.at + 1}`);
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
 * Takes the given sign if it is what comes next, and says whether it was.
 * A sign made of letters is only taken when it is a word on its own
 * @param {Object} state
 * @param {String} sign
 * @returns {Boolean}
 */
function take(state, sign) {
    skipSpaces(state);
    if (!state.text.startsWith(sign, state.at)) {
        return false;
    }
    const next = state.text[state.at + sign.length] || "";
    if (/[a-z]$/.test(sign) && /[\w$]/.test(next)) {
        return false;
    }
    if ((sign === "<" || sign === ">") && next === "=") {
        return false;
    }
    state.at += sign.length;
    return true;
}

/**
 * Reads a chain of steps, each with a bar before the next
 * @param {Object} state
 * @returns {Object}
 */
function readPipe(state) {
    const items = [ readLevel(state, 0) ];
    while (take(state, "|")) {
        items.push(readLevel(state, 0));
    }
    return items.length === 1 ? items[0] : { type : "pipe", items };
}

/**
 * Reads two values with one of the signs of the given level between them,
 * each value read with the levels that hold tighter
 * @param {Object} state
 * @param {Number} level
 * @returns {Object}
 */
function readLevel(state, level) {
    if (level >= LEVELS.length) {
        return readValue(state);
    }

    let left = readLevel(state, level + 1);
    for (;;) {
        const sign = LEVELS[level].find((one) => take(state, one));
        if (!sign) {
            return left;
        }
        left = { type : "sign", sign, left, right : readLevel(state, level + 1) };
    }
}

/**
 * Reads a single value: a property, a function, an object, a list, a text,
 * a number, a word, or a whole chain in parentheses
 * @param {Object} state
 * @returns {Object}
 */
function readValue(state) {
    const { text } = state;
    skipSpaces(state);
    const char = text[state.at];

    if (char === "(") {
        state.at += 1;
        const node = readPipe(state);
        if (!take(state, ")")) {
            fail(state, "A parenthesis is never closed");
        }
        return node;
    }
    if (char === ".") {
        return readProperty(state);
    }
    if (char === "{") {
        return readObject(state);
    }
    if (char === "[") {
        state.at += 1;
        return { type : "list", items : readList(state, "]") };
    }
    if (char === "\"") {
        return { type : "value", value : readString(state) };
    }

    const number = /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
    number.lastIndex = state.at;
    const digits = number.exec(text);
    if (digits) {
        state.at += digits[0].length;
        return { type : "value", value : Number(digits[0]) };
    }

    const word = /[A-Za-z_$][\w$]*/y;
    word.lastIndex = state.at;
    const name = word.exec(text);
    if (!name) {
        fail(state, char === undefined ? "The query ends before it is complete" : `A "${char}" is not where a value starts`);
    }
    state.at += name[0].length;

    switch (name[0]) {
    case "true":
        return { type : "value", value : true };
    case "false":
        return { type : "value", value : false };
    case "null":
        return { type : "value", value : null };
    default:
    }

    if (!take(state, "(")) {
        fail(state, `"${name[0]}" is a function and needs its parentheses`);
    }
    if (!Object.prototype.hasOwnProperty.call(FUNCTIONS, name[0])) {
        fail(state, `There is no function called "${name[0]}"`);
    }
    return { type : "call", name : name[0], args : readList(state, ")") };
}

/**
 * Reads the path to a property, as .name.other or ."a name"
 * @param {Object} state
 * @returns {Object}
 */
function readProperty(state) {
    const { text } = state;
    const path     = [];
    while (text[state.at] === ".") {
        state.at += 1;
        if (text[state.at] === "\"") {
            path.push(readString(state));
            continue;
        }
        const name = /[\w$]+/y;
        name.lastIndex = state.at;
        const match = name.exec(text);
        if (!match) {
            if (!path.length) {
                break;
            }
            fail(state, "A dot must be followed by the name of a property");
        }
        state.at += match[0].length;
        path.push(match[0]);
    }
    return { type : "get", path };
}

/**
 * Reads an object, each key with the value it is given
 * @param {Object} state
 * @returns {Object}
 */
function readObject(state) {
    const entries = [];
    state.at += 1;
    if (take(state, "}")) {
        return { type : "object", entries };
    }

    for (;;) {
        skipSpaces(state);
        let key = "";
        if (state.text[state.at] === "\"") {
            key = readString(state);
        } else {
            const name = /[\w$]+/y;
            name.lastIndex = state.at;
            const match = name.exec(state.text);
            if (!match) {
                fail(state, "An object needs a key here");
            }
            state.at += match[0].length;
            key = match[0];
        }
        if (!take(state, ":")) {
            fail(state, "A key must be followed by a colon");
        }
        entries.push([ key, readPipe(state) ]);

        if (take(state, "}")) {
            return { type : "object", entries };
        }
        if (!take(state, ",")) {
            fail(state, "A comma or a closing brace is missing");
        }
    }
}

/**
 * Reads the values up to the given closing sign, with commas between them
 * @param {Object} state
 * @param {String} close
 * @returns {Object[]}
 */
function readList(state, close) {
    const items = [];
    if (take(state, close)) {
        return items;
    }
    for (;;) {
        items.push(readPipe(state));
        if (take(state, close)) {
            return items;
        }
        if (!take(state, ",")) {
            fail(state, `A comma or a "${close}" is missing`);
        }
    }
}

/**
 * Reads a text in double quotes
 * @param {Object} state
 * @returns {String}
 */
function readString(state) {
    const string = /"(?:\\.|[^"\\])*"/y;
    string.lastIndex = state.at;
    const match = string.exec(state.text);
    if (!match) {
        fail(state, "A text is never closed");
    }
    state.at += match[0].length;
    try {
        return JSON.parse(match[0]);
    } catch {
        return fail(state, "A text has something that can not be in one");
    }
}



/**
 * Returns what the given part of a query gives for the given value
 * @param {Object} node
 * @param {*}      data
 * @returns {*}
 */
function evaluate(node, data) {
    switch (node.type) {
    case "value":
        return node.value;
    case "get":
        return clean(Path.get(data, node.path));
    case "pipe":
        return node.items.reduce((value, item) => evaluate(item, value), data);
    case "object":
        return Object.fromEntries(node.entries.map(([ key, item ]) => [ key, clean(evaluate(item, data)) ]));
    case "list":
        return node.items.map((item) => clean(evaluate(item, data)));
    case "sign":
        return applySign(node.sign, evaluate(node.left, data), () => evaluate(node.right, data));
    case "call":
        return FUNCTIONS[node.name](data, node.args);
    default:
        return null;
    }
}

/**
 * Returns what the sign gives for the two values. The second one is only
 * worked out when it is needed, which an "and" and an "or" do not always
 * @param {String}   sign
 * @param {*}        left
 * @param {Function} getRight
 * @returns {*}
 */
function applySign(sign, left, getRight) {
    if (sign === "and") {
        return Boolean(left) && Boolean(getRight());
    }
    if (sign === "or") {
        return Boolean(left) || Boolean(getRight());
    }

    const right = getRight();
    switch (sign) {
    case "==":
        return isEqual(left, right);
    case "!=":
        return !isEqual(left, right);
    case "<":
        return Sort.compare(left, right) < 0;
    case "<=":
        return Sort.compare(left, right) <= 0;
    case ">":
        return Sort.compare(left, right) > 0;
    case ">=":
        return Sort.compare(left, right) >= 0;
    case "in":
        return toList(right).some((item) => isEqual(item, left));
    case "not in":
        return !toList(right).some((item) => isEqual(item, left));
    case "+":
        return typeof left === "string" || typeof right === "string" ? `${left}${right}` : left + right;
    case "-":
        return left - right;
    case "*":
        return left * right;
    case "/":
        return left / right;
    case "%":
        return left % right;
    case "^":
        return left ** right;
    default:
        return null;
    }
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
 * Returns the value as a list: itself when it is one, what an object
 * holds, and nothing otherwise
 * @param {*} value
 * @returns {Array}
 */
function toList(value) {
    if (Array.isArray(value)) {
        return value;
    }
    return Path.isContainer(value) ? Object.values(value) : [];
}

/**
 * Returns the numbers a list holds, for the functions that add them up
 * @param {*} value
 * @returns {Number[]}
 */
function toNumbers(value) {
    return toList(value).filter((item) => typeof item === "number");
}

/**
 * Returns the key the given part of a query reads, to name what it gives
 * @param {Object} node
 * @param {Number} index
 * @returns {String}
 */
function nameOf(node, index) {
    return node.type === "get" && node.path.length ? node.path[node.path.length - 1] : `value${index + 1}`;
}

/**
 * Returns the given argument worked out over the value, or the default
 * when the function was not given that many
 * @param {Object[]} args
 * @param {Number}   index
 * @param {*}        data
 * @param {*=}       defValue
 * @returns {*}
 */
function arg(args, index, data, defValue = null) {
    return args[index] ? evaluate(args[index], data) : defValue;
}

// Every function a query can call. Each one is given the value the chain
// has got to and the parts that were written between its parentheses,
// which it works out over that value or over each of what it holds
const FUNCTIONS = {
    get       : (data, args) => clean(Path.get(data, args.map((item) => evaluate(item, data)))),
    filter    : (data, args) => toList(data).filter((item) => Boolean(arg(args, 0, item, true))),
    map       : (data, args) => toList(data).map((item) => clean(arg(args, 0, item, item))),
    sort      : (data, args) => {
        const way  = arg(args, 1, data, "asc") === "desc" ? -1 : 1;
        return toList(data)
            .map((item, index) => ({ item, index, by : arg(args, 0, item, item) }))
            .sort((one, other) => Sort.compare(one.by, other.by) * way || one.index - other.index)
            .map((entry) => entry.item);
    },
    reverse   : (data) => toList(data).slice().reverse(),
    pick      : (data, args) => {
        const pick = (item) => Object.fromEntries(args.map((one, index) => [ nameOf(one, index), clean(evaluate(one, item)) ]));
        return Array.isArray(data) ? data.map(pick) : pick(data);
    },
    groupBy   : (data, args) => {
        const result = {};
        for (const item of toList(data)) {
            const key = String(arg(args, 0, item));
            result[key] = result[key] || [];
            result[key].push(item);
        }
        return result;
    },
    keyBy     : (data, args) => {
        const result = {};
        for (const item of toList(data)) {
            const key = String(arg(args, 0, item));
            if (!Object.prototype.hasOwnProperty.call(result, key)) {
                result[key] = item;
            }
        }
        return result;
    },
    mapKeys   : (data, args) => Object.fromEntries(Object.entries(data || {}).map(([ key, item ]) => [ String(arg(args, 0, key)), item ])),
    mapValues : (data, args) => Object.fromEntries(Object.entries(data || {}).map(([ key, item ]) => [ key, clean(arg(args, 0, item)) ])),
    keys      : (data) => (Path.isContainer(data) ? Object.keys(data) : []),
    values    : (data) => toList(data),
    flatten   : (data) => toList(data).flat(),
    uniq      : (data) => toList(data).filter((item, index, list) => list.findIndex((one) => isEqual(one, item)) === index),
    uniqBy    : (data, args) => {
        const seen = new Set();
        return toList(data).filter((item) => {
            const key = JSON.stringify(arg(args, 0, item));
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    },
    limit     : (data, args) => toList(data).slice(0, Number(arg(args, 0, data, 10))),
    size      : (data) => (typeof data === "string" ? data.length : toList(data).length),
    sum       : (data) => toNumbers(data).reduce((total, item) => total + item, 0),
    prod      : (data) => toNumbers(data).reduce((total, item) => total * item, 1),
    min       : (data) => (toNumbers(data).length ? Math.min(...toNumbers(data)) : null),
    max       : (data) => (toNumbers(data).length ? Math.max(...toNumbers(data)) : null),
    average   : (data) => (toNumbers(data).length ? FUNCTIONS.sum(data) / toNumbers(data).length : null),
    join      : (data, args) => toList(data).join(String(arg(args, 0, data, ""))),
    split     : (data, args) => String(arg(args, 0, data, "")).split(args[1] ? String(arg(args, 1, data)) : /\s+/),
    substring : (data, args) => String(arg(args, 0, data, "")).slice(Number(arg(args, 1, data, 0)), args[2] ? Number(arg(args, 2, data)) : undefined),
    regex     : (data, args) => new RegExp(String(arg(args, 1, data, "")), String(arg(args, 2, data, ""))).test(String(arg(args, 0, data, ""))),
    exists    : (data, args) => Boolean(args[0]) && args[0].type === "get" && Path.get(data, args[0].path) !== undefined,
    if        : (data, args) => (arg(args, 0, data) ? arg(args, 1, data) : arg(args, 2, data)),
    not       : (data, args) => !arg(args, 0, data),
    abs       : (data, args) => Math.abs(Number(arg(args, 0, data))),
    round     : (data, args) => {
        const scale = 10 ** Number(arg(args, 1, data, 0));
        return Math.round(Number(arg(args, 0, data)) * scale) / scale;
    },
    number    : (data, args) => Number(arg(args, 0, data)),
    string    : (data, args) => {
        const value = arg(args, 0, data);
        return typeof value === "string" ? value : JSON.stringify(value);
    },
};



/**
 * Writes the path to a property the way a query reads it
 * @param {String[]} path
 * @returns {String}
 */
function writeProperty(path) {
    return path.map((key) => (/^[\w$]+$/.test(key) ? `.${key}` : `.${JSON.stringify(key)}`)).join("");
}

/**
 * Writes the query that does what was asked for in the form: keeping the
 * items that answer a condition, putting them in order, and keeping only
 * some of what each one has
 * @param {{filter: ?Object, sort: ?Object, pick: String[][]}} wizard
 * @returns {String}
 */
function write(wizard) {
    const steps = [];
    if (wizard.filter) {
        const { path, sign, value } = wizard.filter;
        steps.push(`filter(${writeProperty(path)} ${sign} ${JSON.stringify(value)})`);
    }
    if (wizard.sort) {
        const { path, isDescending } = wizard.sort;
        steps.push(isDescending ? `sort(${writeProperty(path)}, "desc")` : `sort(${writeProperty(path)})`);
    }
    if (wizard.pick && wizard.pick.length) {
        steps.push(`pick(${wizard.pick.map(writeProperty).join(", ")})`);
    }
    return steps.join(" | ");
}

/**
 * Returns the names of every function there is
 * @returns {String[]}
 */
function getFunctions() {
    return Object.keys(FUNCTIONS);
}




// The public API
export default {
    run,
    write,
    getFunctions,
};
