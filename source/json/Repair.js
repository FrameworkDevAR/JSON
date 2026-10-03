// What opens a text, and what closes the one it opened
const QUOTES = {
    "\""     : "\"",
    "'"      : "'",
    "`"      : "`",
    "“" : "”",
    "”" : "”",
    "‘" : "’",
    "’" : "’",
};

// What a letter after a backslash stands for
const ESCAPES = { b : "\b", f : "\f", n : "\n", r : "\r", t : "\t", "/" : "/", "\\" : "\\" };

// The words other languages have for what JSON calls true, false and null
const WORDS = {
    true      : true,
    True      : true,
    false     : false,
    False     : false,
    null      : null,
    None      : null,
    undefined : null,
    NaN       : null,
    Infinity  : null,
};

// What ends a word that is written without quotes
const ENDS = ",:[]{}\n";

// What a number is written as, anywhere a language writes one
const NUMBER = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/;



/**
 * Reads a text that is almost JSON and returns what it holds, mending what
 * a person or a program left wrong: single quotes, keys without quotes,
 * comments, commas that are missing or left over, brackets never closed,
 * the words of other languages, a call around it, several values one
 * after the other, and JSON that was written inside a text
 * @param {String} text
 * @returns {*}
 */
export default function repair(text) {
    const state = { text : unescape(stripFence(text)), at : 0 };
    skip(state);
    if (state.at >= state.text.length) {
        throw new Error("There is nothing to repair");
    }

    // A call around the JSON, as a page asks for it from another one
    const call = /^[A-Za-z_$][\w$.]*\s*\(/y;
    call.lastIndex = state.at;
    const wrapper = call.exec(state.text);
    if (wrapper && !isKnownCall(wrapper[0])) {
        state.at += wrapper[0].length;
    }

    const values = [ readValue(state) ];

    // More values after the first are the lines of a list written one
    // value per line, and are given back as that list
    for (;;) {
        skip(state);
        while (state.at < state.text.length && ",;)".includes(state.text[state.at])) {
            state.at += 1;
            skip(state);
        }
        if (state.at >= state.text.length) {
            break;
        }
        const before = state.at;
        values.push(readValue(state));
        if (state.at === before) {
            state.at += 1;
            values.pop();
        }
    }

    const result = values.length === 1 ? values[0] : values;
    return unwrap(result);
}

/**
 * Returns the text without the fence a chat puts around code
 * @param {String} text
 * @returns {String}
 */
function stripFence(text) {
    const match = text.match(/^\s*```[a-zA-Z]*\n([\s\S]*?)\n?```\s*$/);
    return match ? match[1] : text;
}

/**
 * Returns the text without the backslashes a program put before every
 * quote, when it wrote the JSON as a text and the quotes around it are gone
 * @param {String} text
 * @returns {String}
 */
function unescape(text) {
    if (!/^\s*[[{]\s*\\"/.test(text)) {
        return text;
    }
    return text.replace(/\\(["\\])/g, "$1");
}

/**
 * Returns the JSON a text holds, when all there is is a text that holds
 * one, as it comes out of a log or of a program that wrote it twice
 * @param {*} value
 * @returns {*}
 */
function unwrap(value) {
    if (typeof value !== "string") {
        return value;
    }
    const trimmed = value.trim();
    if (!/^[[{]/.test(trimmed)) {
        return value;
    }
    try {
        return JSON.parse(trimmed);
    } catch {
        return value;
    }
}

/**
 * Returns true if the call is one that wraps a single value of a database
 * @param {String} call
 * @returns {Boolean}
 */
function isKnownCall(call) {
    return /^(ObjectId|ISODate|NumberLong|NumberInt|NumberDecimal|Date|new)\b/.test(call);
}



/**
 * Moves past the spaces and the comments that are next
 * @param {Object} state
 * @returns {Void}
 */
function skip(state) {
    const { text } = state;
    for (;;) {
        while (state.at < text.length && /\s/.test(text[state.at])) {
            state.at += 1;
        }
        if (text.startsWith("//", state.at)) {
            const end = text.indexOf("\n", state.at);
            state.at = end === -1 ? text.length : end + 1;
        } else if (text.startsWith("/*", state.at)) {
            const end = text.indexOf("*/", state.at + 2);
            state.at = end === -1 ? text.length : end + 2;
        } else if (text.startsWith("...", state.at)) {
            state.at += 3;
        } else {
            return;
        }
    }
}

/**
 * Reads a value, whatever it is
 * @param {Object} state
 * @returns {*}
 */
function readValue(state) {
    const { text } = state;
    skip(state);

    const char = text[state.at];
    if (char === "{") {
        return readObject(state);
    }
    if (char === "[") {
        return readArray(state);
    }
    if (QUOTES[char]) {
        return readStrings(state);
    }
    if (char === undefined || ENDS.includes(char) || char === ")") {
        return null;
    }
    return readWord(state);
}

/**
 * Reads an object, with or without the commas, the quotes and the closing
 * brace it should have
 * @param {Object} state
 * @returns {Object}
 */
function readObject(state) {
    const { text } = state;
    const result   = {};
    state.at += 1;

    for (;;) {
        skip(state);
        const char = text[state.at];
        if (char === undefined) {
            return result;
        }
        if (char === "}") {
            state.at += 1;
            return result;
        }
        if (char === "," || char === ";") {
            state.at += 1;
            continue;
        }
        if (char === "]" || char === ")") {
            return result;
        }

        const before = state.at;
        const key    = QUOTES[char] ? readString(state) : readKey(state);
        skip(state);
        if (text[state.at] === ":" || text[state.at] === "=") {
            state.at += text.startsWith("=>", state.at) ? 2 : 1;
            result[key] = readValue(state);
        } else if (QUOTES[text[state.at]] || /[\d{[\-tfn]/.test(text[state.at] || "")) {
            // The colon is missing, and what follows is the value all the same
            result[key] = readValue(state);
        } else {
            result[key] = null;
        }
        if (state.at === before) {
            state.at += 1;
        }
    }
}

/**
 * Reads a list, with or without the commas and the closing bracket
 * @param {Object} state
 * @returns {Array}
 */
function readArray(state) {
    const { text } = state;
    const result   = [];
    state.at += 1;

    for (;;) {
        skip(state);
        const char = text[state.at];
        if (char === undefined) {
            return result;
        }
        if (char === "]") {
            state.at += 1;
            return result;
        }
        if (char === ",") {
            state.at += 1;
            continue;
        }
        if (char === "}" || char === ")") {
            return result;
        }

        const before = state.at;
        result.push(readValue(state));
        if (state.at === before) {
            state.at += 1;
            result.pop();
        }
    }
}

/**
 * Reads a text, and whatever texts are added to it with a plus
 * @param {Object} state
 * @returns {String}
 */
function readStrings(state) {
    let result = readString(state);
    for (;;) {
        const before = state.at;
        skip(state);
        if (state.text[state.at] !== "+") {
            state.at = before;
            return result;
        }
        state.at += 1;
        skip(state);
        if (!QUOTES[state.text[state.at]]) {
            state.at = before;
            return result;
        }
        result += readString(state);
    }
}

/**
 * Reads a text in whichever quotes it was written, closed or not
 * @param {Object} state
 * @returns {String}
 */
function readString(state) {
    const { text } = state;
    const close    = QUOTES[text[state.at]];
    let   result   = "";

    for (state.at += 1; state.at < text.length; state.at += 1) {
        const char = text[state.at];
        if (char === close || (close === "”" && char === "\"") || (close === "’" && char === "'")) {
            state.at += 1;
            return result;
        }
        if (char !== "\\") {
            result += char;
            continue;
        }

        const next = text[state.at + 1];
        state.at += 1;
        if (next === "u" && /^[0-9a-fA-F]{4}$/.test(text.slice(state.at + 1, state.at + 5))) {
            result   += String.fromCharCode(parseInt(text.slice(state.at + 1, state.at + 5), 16));
            state.at += 4;
        } else if (next !== undefined) {
            result += ESCAPES[next] !== undefined ? ESCAPES[next] : next;
        }
    }
    return result;
}

/**
 * Reads the key of an object that was written without quotes
 * @param {Object} state
 * @returns {String}
 */
function readKey(state) {
    const { text } = state;
    const start    = state.at;
    while (state.at < text.length && !":=,{}[]\n".includes(text[state.at])) {
        state.at += 1;
    }
    return text.slice(start, state.at).trim();
}

/**
 * Reads what was written without quotes: a number, a word another language
 * has for a value, a call around one, or a text that never had its quotes
 * @param {Object} state
 * @returns {*}
 */
function readWord(state) {
    const { text } = state;
    const start    = state.at;

    // A call around a value gives the value it is around
    const call = /(?:new\s+)?[A-Za-z_$][\w$.]*\s*\(/y;
    call.lastIndex = start;
    const wrapper = call.exec(text);
    if (wrapper) {
        state.at += wrapper[0].length;
        const value = readValue(state);
        skip(state);
        if (text[state.at] === ")") {
            state.at += 1;
        }
        return value;
    }

    // A quote after a space opens the text that comes next, with its comma
    // missing, and is no part of this word
    while (state.at < text.length && !ENDS.includes(text[state.at]) && text[state.at] !== ")") {
        if (QUOTES[text[state.at]] && /\s/.test(text[state.at - 1])) {
            break;
        }
        state.at += 1;
    }
    let word = text.slice(start, state.at).trim();

    // Several words are a text with spaces, unless the first one is a value
    // on its own, which is then followed by others that lost their commas
    const first = word.split(/\s+/)[0];
    if (first !== word && (isNumber(first) || Object.prototype.hasOwnProperty.call(WORDS, first))) {
        state.at = start + first.length;
        word     = first;
    }
    if (Object.prototype.hasOwnProperty.call(WORDS, word)) {
        return WORDS[word];
    }

    // A number that starts with zeros is a code, which a number would lose
    return isNumber(word) ? Number(word) : word;
}

/**
 * Returns true if the word is a number that can be kept as one
 * @param {String} word
 * @returns {Boolean}
 */
function isNumber(word) {
    return NUMBER.test(word) && !/^[-+]?0\d/.test(word) && Number.isFinite(Number(word));
}
