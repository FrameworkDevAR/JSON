/**
 * Returns true if the value holds others, as an object or as a list
 * @param {*} value
 * @returns {Boolean}
 */
function isContainer(value) {
    return value !== null && typeof value === "object";
}

/**
 * Returns the path written as the one line that names it for good, which
 * is what a row carries to say where it is
 * @param {(String|Number)[]} path
 * @returns {String}
 */
function toPointer(path) {
    return path.map((key) => `/${String(key).replace(/~/g, "~0").replace(/\//g, "~1")}`).join("");
}

/**
 * Returns the path a pointer names. Every key comes back as text, which
 * reads a list as well as a number does
 * @param {String} pointer
 * @returns {String[]}
 */
function fromPointer(pointer) {
    if (!pointer) {
        return [];
    }
    return pointer.slice(1).split("/").map((key) => key.replace(/~1/g, "/").replace(/~0/g, "~"));
}

/**
 * Returns the path the way it is written in code, to be read by a person
 * @param {(String|Number)[]} path
 * @param {*}                 root
 * @returns {String}
 */
function toText(path, root) {
    let result = "";
    let value  = root;
    for (const key of path) {
        if (Array.isArray(value)) {
            result += `[${key}]`;
        } else if (/^[A-Za-z_$][\w$]*$/.test(String(key))) {
            result += result ? `.${key}` : String(key);
        } else {
            result += `[${JSON.stringify(String(key))}]`;
        }
        value = isContainer(value) ? value[key] : undefined;
    }
    return result;
}



/**
 * Returns what is at the given path, or undefined when nothing is
 * @param {*}                 root
 * @param {(String|Number)[]} path
 * @returns {*}
 */
function get(root, path) {
    let value = root;
    for (const key of path) {
        if (!isContainer(value) || !Object.prototype.hasOwnProperty.call(value, key)) {
            return undefined;
        }
        value = value[key];
    }
    return value;
}

/**
 * Returns true if there is something at the given path
 * @param {*}                 root
 * @param {(String|Number)[]} path
 * @returns {Boolean}
 */
function has(root, path) {
    return get(root, path) !== undefined;
}

/**
 * Returns the root with what is at the given path changed by the given
 * function. Only what is on the way there is made anew, and the rest is
 * the same as it was, so the root that was given is left as it is
 * @param {*}                 root
 * @param {(String|Number)[]} path
 * @param {Function}          change
 * @returns {*}
 */
function update(root, path, change) {
    if (!path.length) {
        return change(root);
    }

    const [ key, ...rest ] = path;
    if (Array.isArray(root)) {
        const result = root.slice();
        result[Number(key)] = update(root[Number(key)], rest, change);
        return result;
    }
    if (isContainer(root)) {
        return { ...root, [key] : update(root[key], rest, change) };
    }

    // Where there is nothing yet, the objects on the way are made
    return root === undefined ? { [key] : update(undefined, rest, change) } : root;
}

/**
 * Returns the root with the given value at the given path
 * @param {*}                 root
 * @param {(String|Number)[]} path
 * @param {*}                 value
 * @returns {*}
 */
function set(root, path, value) {
    return update(root, path, () => value);
}

/**
 * Returns the root without what is at the given path
 * @param {*}                 root
 * @param {(String|Number)[]} path
 * @returns {*}
 */
function remove(root, path) {
    if (!path.length) {
        return undefined;
    }

    const key = path[path.length - 1];
    return update(root, path.slice(0, -1), (parent) => {
        if (Array.isArray(parent)) {
            return parent.filter((item, index) => index !== Number(key));
        }
        const result = { ...parent };
        delete result[key];
        return result;
    });
}

/**
 * Returns the root with the given value put in the container at the given
 * path, at the given place: before or after one of what it holds, or at
 * its start or its end. The key is what an object calls it, which a list
 * has no use for
 * @param {*}                 root
 * @param {(String|Number)[]} parentPath
 * @param {{before: (String|Number), after: (String|Number), atStart: Boolean}} place
 * @param {String}            key
 * @param {*}                 value
 * @returns {*}
 */
function insert(root, parentPath, place, key, value) {
    return update(root, parentPath, (parent) => {
        if (Array.isArray(parent)) {
            const result = parent.slice();
            let   index  = parent.length;
            if (place.before !== undefined) {
                index = Number(place.before);
            } else if (place.after !== undefined) {
                index = Number(place.after) + 1;
            } else if (place.atStart) {
                index = 0;
            }
            result.splice(index, 0, value);
            return result;
        }

        // An object keeps its keys in the order they were put in, so it is
        // written again with the new one where it goes
        const result = {};
        if (place.atStart) {
            result[key] = value;
        }
        for (const [ name, item ] of Object.entries(parent)) {
            if (name === String(place.before)) {
                result[key] = value;
            }
            result[name] = item;
            if (name === String(place.after)) {
                result[key] = value;
            }
        }
        if (!Object.prototype.hasOwnProperty.call(result, key)) {
            result[key] = value;
        }
        return result;
    });
}

/**
 * Returns the root with the key at the end of the given path called the
 * given name instead, in the same place among the others
 * @param {*}                 root
 * @param {(String|Number)[]} path
 * @param {String}            name
 * @returns {*}
 */
function rename(root, path, name) {
    const key = String(path[path.length - 1]);
    return update(root, path.slice(0, -1), (parent) => {
        if (Array.isArray(parent)) {
            return parent;
        }
        const result = {};
        for (const [ one, item ] of Object.entries(parent)) {
            if (one === key) {
                result[name] = item;
            } else if (one !== name) {
                result[one] = item;
            }
        }
        return result;
    });
}

/**
 * Returns the root with what is at the given path moved one place up or
 * down among what its container holds, and the path it ends up at
 * @param {*}                 root
 * @param {(String|Number)[]} path
 * @param {Number}            step
 * @returns {{root: *, path: (String|Number)[]}}
 */
function move(root, path, step) {
    const parentPath = path.slice(0, -1);
    const parent     = get(root, parentPath);
    const key        = path[path.length - 1];
    if (!isContainer(parent)) {
        return { root, path };
    }

    if (Array.isArray(parent)) {
        const from = Number(key);
        const to   = from + step;
        if (to < 0 || to >= parent.length) {
            return { root, path };
        }
        const result = parent.slice();
        result.splice(to, 0, result.splice(from, 1)[0]);
        return { root : set(root, parentPath, result), path : [ ...parentPath, to ] };
    }

    const keys = Object.keys(parent);
    const from = keys.indexOf(String(key));
    const to   = from + step;
    if (to < 0 || to >= keys.length) {
        return { root, path };
    }
    keys.splice(to, 0, keys.splice(from, 1)[0]);

    const result = {};
    for (const name of keys) {
        result[name] = parent[name];
    }
    return { root : set(root, parentPath, result), path };
}

/**
 * Returns a name no key of the given object has yet, starting from the
 * given one
 * @param {Object} parent
 * @param {String} name
 * @returns {String}
 */
function freeKey(parent, name) {
    let result = name;
    let count  = 2;
    while (Object.prototype.hasOwnProperty.call(parent, result)) {
        result = `${name}${count}`;
        count += 1;
    }
    return result;
}

/**
 * Returns true if both paths are the same one
 * @param {?(String|Number)[]} one
 * @param {?(String|Number)[]} other
 * @returns {Boolean}
 */
function isSame(one, other) {
    return Boolean(one && other) && toPointer(one) === toPointer(other);
}




// The public API
export default {
    isContainer,
    toPointer,
    fromPointer,
    toText,

    get,
    has,
    update,
    set,
    remove,
    insert,
    rename,
    move,
    freeKey,
    isSame,
};
