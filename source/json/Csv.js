import Kinds from "./Kinds.js";
import Path  from "./Path.js";



// What can stand between the values of a line, the likeliest first
const DELIMITERS = [ ",", ";", "\t", "|" ];



/**
 * Returns the columns a list is written with as a table: the paths that
 * lead to a value in some item, each as far in as an object goes when
 * they are asked to be spread, and no further than a list or a plain value
 * @param {Array}   items
 * @param {Boolean} isNested
 * @returns {String[][]}
 */
function getColumns(items, isNested) {
    const result = new Map();
    const add    = (value, path, depth) => {
        const isObject = Path.isContainer(value) && !Array.isArray(value);
        if (isObject && Object.keys(value).length && (!depth || (isNested && depth < 3))) {
            for (const [ key, child ] of Object.entries(value)) {
                add(child, [ ...path, key ], depth + 1);
            }
        } else if (!result.has(Path.toPointer(path))) {
            result.set(Path.toPointer(path), path);
        }
    };

    for (const item of items.slice(0, 1000)) {
        add(item, [], 0);
    }
    return [ ...result.values() ];
}

/**
 * Returns the name of a column, which is the path it shows written short
 * @param {String[]} path
 * @returns {String}
 */
function getColumnName(path) {
    return path.length ? path.join(".") : "value";
}

/**
 * Writes the list out as CSV, a line for each item and a column for each
 * value its items have
 * @param {Array} items
 * @returns {String}
 */
function write(items) {
    const columns = getColumns(items, true);
    const lines   = [ columns.map((path) => writeCell(getColumnName(path))).join(",") ];

    for (const item of items) {
        lines.push(columns.map((path) => {
            const value = Path.get(item, path);
            if (value === undefined || value === null) {
                return "";
            }
            return writeCell(typeof value === "string" ? value : JSON.stringify(value));
        }).join(","));
    }
    return lines.join("\n");
}

/**
 * Writes a value of a line, in quotes when it has what would break the line
 * @param {String} text
 * @returns {String}
 */
function writeCell(text) {
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
}



/**
 * Reads a CSV as a list of objects, the first line naming the keys. A name
 * with dots in it is the path to a value inside, the way they are written
 * @param {String} text
 * @returns {Object[]}
 */
function read(text) {
    const delimiter = findDelimiter(text);
    const rows      = readRows(text, delimiter);
    if (rows.length < 1) {
        return [];
    }

    const names  = rows[0].map((name, index) => name.trim() || `column${index + 1}`);
    const result = [];
    for (const row of rows.slice(1)) {
        if (row.length === 1 && !row[0]) {
            continue;
        }
        let item = {};
        for (const [ index, name ] of names.entries()) {
            const cell = row[index] === undefined ? "" : row[index];
            item = setCell(item, name.split("."), readCell(cell));
        }
        result.push(item);
    }
    return result;
}

/**
 * Returns the item with the given value at the given path, making the
 * objects on the way there
 * @param {Object}   item
 * @param {String[]} path
 * @param {*}        value
 * @returns {Object}
 */
function setCell(item, path, value) {
    const [ key, ...rest ] = path;
    if (!rest.length) {
        return { ...item, [key] : value };
    }
    const child = Path.isContainer(item[key]) && !Array.isArray(item[key]) ? item[key] : {};
    return { ...item, [key] : setCell(child, rest, value) };
}

/**
 * Returns the value a cell holds: a number, a word or a container when it
 * reads as one, nothing when it is empty, and its text otherwise
 * @param {String} cell
 * @returns {*}
 */
function readCell(cell) {
    if (cell === "") {
        return null;
    }
    if (/^[[{]/.test(cell.trim())) {
        try {
            return JSON.parse(cell);
        } catch {
            return cell;
        }
    }
    return Kinds.parseValue(cell);
}

/**
 * Returns what stands between the values of the lines, which is whichever
 * of the candidates the first line has the most of
 * @param {String} text
 * @returns {String}
 */
function findDelimiter(text) {
    const end   = text.indexOf("\n");
    const line  = end === -1 ? text : text.slice(0, end);
    let   best  = DELIMITERS[0];
    let   count = 0;
    for (const delimiter of DELIMITERS) {
        const amount = line.split(delimiter).length - 1;
        if (amount > count) {
            best  = delimiter;
            count = amount;
        }
    }
    return best;
}

/**
 * Splits the text into its lines and each line into its values, minding
 * the quotes, inside which a line may end and the delimiter is a letter
 * @param {String} text
 * @param {String} delimiter
 * @returns {String[][]}
 */
function readRows(text, delimiter) {
    const rows   = [];
    let   row    = [];
    let   cell   = "";
    let   quoted = false;

    for (let i = 0; i < text.length; i += 1) {
        const char = text[i];
        if (quoted) {
            if (char === "\"" && text[i + 1] === "\"") {
                cell += "\"";
                i    += 1;
            } else if (char === "\"") {
                quoted = false;
            } else {
                cell += char;
            }
        } else if (char === "\"" && !cell) {
            quoted = true;
        } else if (char === delimiter) {
            row.push(cell);
            cell = "";
        } else if (char === "\n" || char === "\r") {
            if (char === "\r" && text[i + 1] === "\n") {
                i += 1;
            }
            row.push(cell);
            rows.push(row);
            row  = [];
            cell = "";
        } else {
            cell += char;
        }
    }
    if (cell || row.length) {
        row.push(cell);
        rows.push(row);
    }
    return rows;
}

/**
 * Returns true if the text reads as a CSV rather than as a JSON, which is
 * a few lines with the same delimiter in each
 * @param {String} text
 * @returns {Boolean}
 */
function isCsv(text) {
    const trimmed = text.trim();
    if (!trimmed || /^[[{"]/.test(trimmed)) {
        return false;
    }
    const lines     = trimmed.split("\n").slice(0, 5);
    const delimiter = findDelimiter(trimmed);
    const amount    = lines[0].split(delimiter).length;
    return lines.length > 1 && amount > 1 && lines.every((line) => line.split(delimiter).length === amount);
}




// The public API
export default {
    getColumns,
    getColumnName,
    write,
    read,
    isCsv,
};
