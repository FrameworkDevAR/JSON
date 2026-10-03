// What may stand between two parts of a JSON
const SPACES = " \t\n\r";

// What a number is written as
const NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;



/**
 * Reads the text as JSON, with the browser doing the reading, which is the
 * fastest there is. When it cannot be read, the text is read again here to
 * say where it stops being JSON, since the browser says that its own way
 * in each one of them
 * @param {String} text
 * @returns {{value: *, error: ?Object, isEmpty: Boolean}}
 */
function parse(text) {
    if (!text.trim()) {
        return { value : undefined, error : null, isEmpty : true };
    }
    try {
        return { value : JSON.parse(text), error : null, isEmpty : false };
    } catch (error) {
        return { value : undefined, error : findError(text) || describe(text, 0, error.message), isEmpty : false };
    }
}

/**
 * Returns where the value at the given path is written in the text, as
 * the place it starts and the place it ends, or nothing when the text is
 * not JSON or has nothing there
 * @param {String}            text
 * @param {(String|Number)[]} path
 * @returns {?{start: Number, end: Number, line: Number}}
 */
function locate(text, path) {
    const state = { text, at : 0, target : path.map(String), found : null };
    try {
        skipSpaces(state);
        scanValue(state, 0, true);
    } catch {
        return null;
    }
    if (!state.found) {
        return null;
    }
    return { ...state.found, line : lineOf(text, state.found.start).line };
}

/**
 * Returns the line and the column of the given place of the text, both
 * counted from one
 * @param {String} text
 * @param {Number} position
 * @returns {{line: Number, column: Number}}
 */
function lineOf(text, position) {
    let line = 1;
    let from = 0;
    for (let i = text.indexOf("\n"); i !== -1 && i < position; i = text.indexOf("\n", i + 1)) {
        line += 1;
        from  = i + 1;
    }
    return { line, column : position - from + 1 };
}



/**
 * Returns what stops the text from being JSON, and where, or nothing when
 * it reads well here
 * @param {String} text
 * @returns {?Object}
 */
function findError(text) {
    const state = { text, at : 0, target : null, found : null };
    try {
        skipSpaces(state);
        scanValue(state, 0, false);
        skipSpaces(state);
        if (state.at < text.length) {
            fail(state, "There is more text after the end of the JSON");
        }
    } catch (error) {
        if (error instanceof ScanError) {
            return describe(text, error.position, error.message);
        }
        throw error;
    }
    return null;
}

/**
 * Returns the error with the line and the column it is at
 * @param {String} text
 * @param {Number} position
 * @param {String} message
 * @returns {Object}
 */
function describe(text, position, message) {
    return { message, position, ...lineOf(text, position) };
}

/**
 * The error of a text that is not JSON, which knows where it stopped
 */
class ScanError extends Error {

    /**
     * Scan Error constructor
     * @param {String} message
     * @param {Number} position
     */
    constructor(message, position) {
        super(message);
        this.position = position;
    }
}

/**
 * Stops the reading with the given message, at where the reading is
 * @param {Object}  state
 * @param {String}  message
 * @param {Number=} position
 * @returns {never}
 */
function fail(state, message, position = state.at) {
    throw new ScanError(message, Math.min(position, state.text.length));
}

/**
 * Moves past whatever spaces are next
 * @param {Object} state
 * @returns {Void}
 */
function skipSpaces(state) {
    while (state.at < state.text.length && SPACES.includes(state.text[state.at])) {
        state.at += 1;
    }
}

/**
 * Reads a value of the text. The depth is how many keys of the path being
 * looked for have been matched on the way here, and the reading is on it
 * while every one so far matched
 * @param {Object}  state
 * @param {Number}  depth
 * @param {Boolean} isOn
 * @returns {Void}
 */
function scanValue(state, depth, isOn) {
    const { text } = state;
    const start    = state.at;
    const isTarget = isOn && state.target && depth === state.target.length;

    switch (text[state.at]) {
    case "{":
        scanObject(state, depth, isOn);
        break;
    case "[":
        scanArray(state, depth, isOn);
        break;
    case "\"":
        scanString(state);
        break;
    case undefined:
        fail(state, "The JSON ends before it is complete");
        break;
    default:
        scanWord(state);
    }

    if (isTarget) {
        state.found = { start, end : state.at };
    }
}

/**
 * Reads an object of the text
 * @param {Object}  state
 * @param {Number}  depth
 * @param {Boolean} isOn
 * @returns {Void}
 */
function scanObject(state, depth, isOn) {
    const { text } = state;
    state.at += 1;
    skipSpaces(state);
    if (text[state.at] === "}") {
        state.at += 1;
        return;
    }

    for (;;) {
        if (text[state.at] !== "\"") {
            if (text[state.at] === "}") {
                fail(state, "A comma has nothing after it");
            }
            fail(state, state.at >= text.length ? "An object is never closed" : "A key must be in double quotes");
        }
        const key = scanString(state);
        skipSpaces(state);
        if (text[state.at] !== ":") {
            fail(state, "A key must be followed by a colon");
        }
        state.at += 1;
        skipSpaces(state);

        const isChild = isOn && state.target && depth < state.target.length && state.target[depth] === key;
        scanValue(state, depth + 1, Boolean(isChild));
        skipSpaces(state);

        if (text[state.at] === "}") {
            state.at += 1;
            return;
        }
        if (text[state.at] !== ",") {
            fail(state, state.at >= text.length ? "An object is never closed" : "A comma or a closing brace is missing");
        }
        state.at += 1;
        skipSpaces(state);
    }
}

/**
 * Reads a list of the text
 * @param {Object}  state
 * @param {Number}  depth
 * @param {Boolean} isOn
 * @returns {Void}
 */
function scanArray(state, depth, isOn) {
    const { text } = state;
    state.at += 1;
    skipSpaces(state);
    if (text[state.at] === "]") {
        state.at += 1;
        return;
    }

    for (let index = 0; ; index += 1) {
        if (text[state.at] === "]") {
            fail(state, "A comma has nothing after it");
        }
        const isChild = isOn && state.target && depth < state.target.length && state.target[depth] === String(index);
        scanValue(state, depth + 1, Boolean(isChild));
        skipSpaces(state);

        if (text[state.at] === "]") {
            state.at += 1;
            return;
        }
        if (text[state.at] !== ",") {
            fail(state, state.at >= text.length ? "A list is never closed" : "A comma or a closing bracket is missing");
        }
        state.at += 1;
        skipSpaces(state);
    }
}

/**
 * Reads a text of the text, and returns what it says
 * @param {Object} state
 * @returns {String}
 */
function scanString(state) {
    const { text } = state;
    const start    = state.at;

    for (state.at += 1; state.at < text.length; state.at += 1) {
        const char = text[state.at];
        if (char === "\"") {
            state.at += 1;
            try {
                return JSON.parse(text.slice(start, state.at));
            } catch {
                fail(state, "A text has something that can not be in one", start);
            }
        }
        if (char === "\\") {
            const next = text[state.at + 1];
            if (next === "u") {
                if (!/^[0-9a-fA-F]{4}$/.test(text.slice(state.at + 2, state.at + 6))) {
                    fail(state, "A \\u must be followed by four digits");
                }
            } else if (!"\"\\/bfnrt".includes(next || "?")) {
                fail(state, `A text can not hold \\${next || ""}`);
            }
            state.at += 1;
        } else if (char === "\n") {
            fail(state, "A text is never closed", start);
        } else if (char < " ") {
            fail(state, "A text holds a character that has to be escaped");
        }
    }
    return fail(state, "A text is never closed", start);
}

/**
 * Reads a number, or one of the three words JSON has
 * @param {Object} state
 * @returns {Void}
 */
function scanWord(state) {
    const { text } = state;
    for (const word of [ "true", "false", "null" ]) {
        if (text.startsWith(word, state.at)) {
            state.at += word.length;
            return;
        }
    }

    NUMBER.lastIndex = state.at;
    const match = NUMBER.exec(text);
    if (match && match[0]) {
        state.at += match[0].length;
        return;
    }

    switch (text[state.at]) {
    case "'":
        fail(state, "A text must be in double quotes, not single ones");
        break;
    case ",":
        fail(state, "There is a comma where a value should be");
        break;
    case "}":
    case "]":
        fail(state, "There is a closing bracket where a value should be");
        break;
    default:
        fail(state, "This is not a value JSON knows");
    }
}




// The public API
export default {
    parse,
    locate,
    lineOf,
};
