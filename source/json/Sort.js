import Kinds from "./Kinds.js";
import Path  from "./Path.js";



// The order the kinds of value go in when a list holds more than one
const ORDER = [ "null", "boolean", "number", "string", "array", "object" ];



/**
 * Says which of the two values goes first: a number before a larger one,
 * a text before one that reads after it, with the numbers inside a text
 * counted as numbers, and each kind apart from the others
 * @param {*} one
 * @param {*} other
 * @returns {Number}
 */
function compare(one, other) {
    const oneKind   = Kinds.typeOf(one === undefined ? null : one);
    const otherKind = Kinds.typeOf(other === undefined ? null : other);
    if (oneKind !== otherKind) {
        return ORDER.indexOf(oneKind) - ORDER.indexOf(otherKind);
    }

    switch (oneKind) {
    case "number":
    case "boolean":
        return Number(one) - Number(other);
    case "string":
        return one.localeCompare(other, undefined, { numeric : true, sensitivity : "base" });
    case "array":
    case "object":
        return JSON.stringify(one).localeCompare(JSON.stringify(other));
    default:
        return 0;
    }
}

/**
 * Returns the object with its keys in order
 * @param {Object}  value
 * @param {Boolean} isDescending
 * @returns {Object}
 */
function sortKeys(value, isDescending) {
    const keys = Object.keys(value).sort((one, other) => compare(one, other) * (isDescending ? -1 : 1));
    return Object.fromEntries(keys.map((key) => [ key, value[key] ]));
}

/**
 * Returns the list in order, by the value each item has at the given path
 * or by the item itself when the path is empty
 * @param {Array}    value
 * @param {String[]} path
 * @param {Boolean}  isDescending
 * @returns {Array}
 */
function sortItems(value, path, isDescending) {
    const way = isDescending ? -1 : 1;
    return value
        .map((item, index) => ({ item, index, by : Path.get(item, path) }))
        .sort((one, other) => compare(one.by, other.by) * way || one.index - other.index)
        .map((entry) => entry.item);
}

/**
 * Returns every path the items of a list can be put in order by, which are
 * the ones that lead to a plain value in some item of the first ones
 * @param {Array} value
 * @returns {String[][]}
 */
function getFields(value) {
    const result = new Map();
    const add    = (item, path, depth) => {
        if (Path.isContainer(item) && !Array.isArray(item) && depth < 4) {
            for (const [ key, child ] of Object.entries(item)) {
                add(child, [ ...path, key ], depth + 1);
            }
        } else if (!Path.isContainer(item) && path.length) {
            result.set(Path.toPointer(path), path);
        }
    };

    for (const item of value.slice(0, 200)) {
        add(item, [], 0);
    }
    return [ ...result.values() ];
}




// The public API
export default {
    compare,
    sortKeys,
    sortItems,
    getFields,
};
