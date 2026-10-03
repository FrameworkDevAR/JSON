import Path from "./Path.js";



/**
 * Compares the two values and returns where they differ: what each side
 * has that the other does not, what both have with another value, and the
 * containers that hold a difference somewhere inside. An object is
 * compared key by key and a list item by item, in the order they are in
 * @param {*} left
 * @param {*} right
 * @returns {{left: Map<String, String>, right: Map<String, String>, list: Object[]}}
 */
export default function compareValues(left, right) {
    const result = { left : new Map(), right : new Map(), list : [] };
    walk(left, right, [], result);
    return result;
}

/**
 * Compares what the two sides have at the given path, and says whether
 * they differ
 * @param {*}                 left
 * @param {*}                 right
 * @param {(String|Number)[]} path
 * @param {Object}            result
 * @returns {Boolean}
 */
function walk(left, right, path, result) {
    const pointer = Path.toPointer(path);

    if (left === undefined || right === undefined) {
        if (left !== undefined) {
            result.left.set(pointer, "removed");
        } else {
            result.right.set(pointer, "added");
        }
        result.list.push({ path, kind : left !== undefined ? "removed" : "added" });
        return true;
    }

    const bothLists   = Array.isArray(left) && Array.isArray(right);
    const bothObjects = Path.isContainer(left) && Path.isContainer(right) &&
        !Array.isArray(left) && !Array.isArray(right);
    if (!bothLists && !bothObjects) {
        if (left === right || (Path.isContainer(left) && Path.isContainer(right) &&
            JSON.stringify(left) === JSON.stringify(right))
        ) {
            return false;
        }
        result.left.set(pointer, "changed");
        result.right.set(pointer, "changed");
        result.list.push({ path, kind : "changed" });
        return true;
    }

    let   isDifferent = false;
    const keys        = bothLists
        ? Array.from({ length : Math.max(left.length, right.length) }, (item, index) => index)
        : [ ...new Set([ ...Object.keys(left), ...Object.keys(right) ]) ];
    for (const key of keys) {
        const hasLeft  = Object.prototype.hasOwnProperty.call(left, key);
        const hasRight = Object.prototype.hasOwnProperty.call(right, key);
        if (walk(hasLeft ? left[key] : undefined, hasRight ? right[key] : undefined, [ ...path, key ], result)) {
            isDifferent = true;
        }
    }

    if (isDifferent) {
        result.left.set(pointer, "inside");
        result.right.set(pointer, "inside");
    }
    return isDifferent;
}
