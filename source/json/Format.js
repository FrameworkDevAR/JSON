// What each indent that can be asked for is written with
const INDENTS = { 2 : "  ", 4 : "    ", tab : "\t" };

// How long a line may get before what it holds is given lines of its own,
// how deep a container may go and still be written in the one line, and
// how much longer than the shortest the longest key may be for the colons
// of an object to be lined up
const LINE_LENGTH = 80;
const MAX_DEPTH   = 2;
const MAX_PADDING = 16;



/**
 * Returns what a level of the JSON is set in with, for the indent that the
 * Settings ask for
 * @param {String} indent
 * @returns {String}
 */
function indentOf(indent) {
    return INDENTS[indent] || INDENTS[4];
}

/**
 * Writes the value out as JSON, a line for each thing it holds
 * @param {*}      value
 * @param {String} indent
 * @returns {String}
 */
function stringify(value, indent) {
    if (value === undefined) {
        return "";
    }
    return JSON.stringify(value, null, indentOf(indent));
}

/**
 * Writes the value out as JSON in the one line, with nothing to spare
 * @param {*} value
 * @returns {String}
 */
function compact(value) {
    return value === undefined ? "" : JSON.stringify(value);
}

/**
 * Writes the value out as JSON the way a person would: what is simple and
 * fits in a line stays in the one line, a long list of plain values fills
 * its lines, and the rest is given a line for each thing it holds, with
 * the colons of an object lined up one under the other
 * @param {*}      value
 * @param {String} indent
 * @returns {String}
 */
function smart(value, indent) {
    if (value === undefined) {
        return "";
    }
    return writeSmart(value, "", 0, indentOf(indent));
}

/**
 * Returns how deep a value goes: a plain value and an empty container not
 * at all, and a container one more than the deepest thing it holds
 * @param {*} value
 * @returns {Number}
 */
function depthOf(value) {
    if (value === null || typeof value !== "object") {
        return 0;
    }
    const items = Object.values(value);
    return items.length ? 1 + Math.max(...items.map(depthOf)) : 0;
}

/**
 * Writes a value in what is left of the line when it is simple enough and
 * fits there, and otherwise over several lines
 * @param {*}      value
 * @param {String} pad
 * @param {Number} used
 * @param {String} indent
 * @returns {String}
 */
function writeSmart(value, pad, used, indent) {
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value);
    }

    const depth = depthOf(value);
    const flat  = writeFlat(value);
    if (depth <= MAX_DEPTH && pad.length + used + flat.length <= LINE_LENGTH) {
        return flat;
    }

    const inner = pad + indent;
    if (Array.isArray(value)) {
        const lines = depth === 1
            ? fillLines(value.map((item) => JSON.stringify(item)), inner)
            : value.map((item) => inner + writeSmart(item, inner, 1, indent));
        return `[\n${lines.join(",\n")}\n${pad}]`;
    }

    // The colons are lined up unless the keys are too uneven, or lining
    // them up pushes a line past where it may end
    const entries = Object.entries(value).map(([ key, item ]) => [ JSON.stringify(key), item ]);
    const lengths = entries.map(([ name ]) => name.length);
    const width   = Math.max(...lengths);
    const write   = (isAligned) => entries.map(([ name, item ]) => {
        const start = `${name}${isAligned ? " ".repeat(width - name.length) : ""}: `;
        return inner + start + writeSmart(item, inner, start.length + 1, indent);
    });

    let lines = write(true);
    const isUneven = width - Math.min(...lengths) > MAX_PADDING;
    const isLong   = lines.some((line) => line.split("\n")[0].length + 1 > LINE_LENGTH);
    if (isUneven || isLong) {
        lines = write(false);
    }
    return `{\n${lines.join(",\n")}\n${pad}}`;
}

/**
 * Returns the lines of a list of plain values, with as many of them in
 * each line as fit in it
 * @param {String[]} items
 * @param {String}   pad
 * @returns {String[]}
 */
function fillLines(items, pad) {
    const lines = [];
    let   line  = "";
    for (const item of items) {
        if (line && pad.length + line.length + item.length + 3 > LINE_LENGTH) {
            lines.push(pad + line);
            line = "";
        }
        line += line ? `, ${item}` : item;
    }
    if (line) {
        lines.push(pad + line);
    }
    return lines;
}

/**
 * Writes a value in the one line, with a space after each comma and each
 * colon, and one inside the brackets of what holds other containers, so
 * the ones inside are told from the one around them
 * @param {*} value
 * @returns {String}
 */
function writeFlat(value) {
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value);
    }

    const isList = Array.isArray(value);
    const items  = isList
        ? value.map(writeFlat)
        : Object.entries(value).map(([ key, item ]) => `${JSON.stringify(key)}: ${writeFlat(item)}`);
    const [ open, close ] = isList ? [ "[", "]" ] : [ "{", "}" ];
    const space = depthOf(value) > 1 ? " " : "";
    return items.length ? `${open}${space}${items.join(", ")}${space}${close}` : `${open}${close}`;
}

/**
 * Writes the value out in the one line and cuts it where it gets long,
 * for the places that only have room to hint at it
 * @param {*}      value
 * @param {Number} length
 * @returns {String}
 */
function preview(value, length) {
    const text = compact(value);
    return text.length > length ? `${text.slice(0, length)}…` : text;
}




// The public API
export default {
    indentOf,
    stringify,
    smart,
    compact,
    preview,
};
