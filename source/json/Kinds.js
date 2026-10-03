// The dates a number is taken to be a moment of, which is what tells a
// time from any other large number
const TIME_FROM = Date.UTC(2000, 0, 1);
const TIME_TO   = Date.UTC(2100, 0, 1);

// What a number reads as, to tell text that is one from text that is not
const NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

// What a color and an address are written as
const COLOR  = /^(#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|(?:rgb|hsl)a?\([^()]+\))$/i;
const URL    = /^https?:\/\/\S+$/i;



/**
 * Returns what kind of a thing the value is, in the words JSON has for it
 * @param {*} value
 * @returns {String}
 */
function typeOf(value) {
    if (value === null) {
        return "null";
    }
    if (Array.isArray(value)) {
        return "array";
    }
    return typeof value;
}

/**
 * Returns the value that the given text is when it is typed in: a number,
 * true, false or null when it reads as one, and the text itself otherwise.
 * Text that is asked to stay text is never read as anything else
 * @param {String}   text
 * @param {Boolean=} asText
 * @returns {*}
 */
function parseValue(text, asText = false) {
    if (asText) {
        return text;
    }
    const trimmed = text.trim();
    switch (trimmed) {
    case "true":
        return true;
    case "false":
        return false;
    case "null":
        return null;
    default:
    }
    if (NUMBER.test(trimmed)) {
        const number = Number(trimmed);
        if (Number.isFinite(number)) {
            return number;
        }
    }
    return text;
}

/**
 * Returns true if the text would be read as something other than text,
 * which is what a string like "42" has to be kept from
 * @param {String} text
 * @returns {Boolean}
 */
function readsAsOther(text) {
    return typeof parseValue(text) !== "string";
}

/**
 * Returns the value as it is typed in, which is how it is written without
 * the quotes of a text
 * @param {*} value
 * @returns {String}
 */
function toInput(value) {
    return typeof value === "string" ? value : JSON.stringify(value);
}

/**
 * Returns the value turned into the given type, keeping what it can of it
 * @param {*}      value
 * @param {String} type
 * @returns {*}
 */
function convert(value, type) {
    const from = typeOf(value);
    switch (type) {
    case "string":
        return from === "string" ? value : JSON.stringify(value);
    case "number": {
        const number = Number(from === "string" ? value.trim() : value);
        return from !== "object" && from !== "array" && Number.isFinite(number) ? number : 0;
    }
    case "boolean":
        return from === "string" ? value.trim().toLowerCase() === "true" : Boolean(value);
    case "null":
        return null;
    case "object":
        if (from === "object") {
            return value;
        }
        if (from === "array") {
            return Object.fromEntries(value.map((item, index) => [ String(index), item ]));
        }
        return readContainer(value, "object") || {};
    case "array":
        if (from === "array") {
            return value;
        }
        if (from === "object") {
            return Object.values(value);
        }
        return readContainer(value, "array") || (from === "null" ? [] : [ value ]);
    default:
        return value;
    }
}

/**
 * Returns the container a text holds written out, when it holds one of
 * the given type
 * @param {*}      value
 * @param {String} type
 * @returns {?(Object|Array)}
 */
function readContainer(value, type) {
    if (typeof value !== "string") {
        return null;
    }
    try {
        const result = JSON.parse(value);
        return typeOf(result) === type ? result : null;
    } catch {
        return null;
    }
}



/**
 * Returns true if the value is a color, as a stylesheet writes one
 * @param {*} value
 * @returns {Boolean}
 */
function isColor(value) {
    return typeof value === "string" && COLOR.test(value);
}

/**
 * Returns true if the value is the address of a page
 * @param {*} value
 * @returns {Boolean}
 */
function isUrl(value) {
    return typeof value === "string" && URL.test(value);
}

/**
 * Returns the moment the value is, when it is a number that counts the
 * milliseconds or the seconds to a day of this century
 * @param {*} value
 * @returns {?Date}
 */
function toTime(value) {
    if (typeof value !== "number" || !Number.isInteger(value)) {
        return null;
    }
    if (value >= TIME_FROM && value < TIME_TO) {
        return new Date(value);
    }
    if (value * 1000 >= TIME_FROM && value * 1000 < TIME_TO) {
        return new Date(value * 1000);
    }
    return null;
}

/**
 * Says what a container holds, in a few words
 * @param {*} value
 * @returns {String}
 */
function summary(value) {
    switch (typeOf(value)) {
    case "array":
        return value.length === 1 ? "1 item" : `${value.length} items`;
    case "object": {
        const count = Object.keys(value).length;
        return count === 1 ? "1 prop" : `${count} props`;
    }
    default:
        return typeOf(value);
    }
}

/**
 * Says how much room a text takes, in the unit that reads best
 * @param {String} text
 * @returns {String}
 */
function sizeOf(text) {
    const bytes = new Blob([ text ]).size;
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}




// The public API
export default {
    typeOf,
    parseValue,
    readsAsOther,
    toInput,
    convert,

    isColor,
    isUrl,
    toTime,
    summary,
    sizeOf,
};
