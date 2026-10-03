import Path from "./Path.js";



// How many matches are looked for before the search gives up counting
const MAX_MATCHES = 2000;



/**
 * Returns every place the given text is found in the value, in its keys
 * and in its plain values, whatever the case of the letters, in the order
 * they are read from the top
 * @param {*}      root
 * @param {String} text
 * @returns {{path: (String|Number)[], field: String}[]}
 */
function find(root, text) {
    const result = [];
    const needle = text.toLowerCase();
    if (!needle || root === undefined) {
        return result;
    }

    const walk = (value, path) => {
        if (result.length >= MAX_MATCHES) {
            return;
        }
        if (!Path.isContainer(value)) {
            if (toText(value).toLowerCase().includes(needle)) {
                result.push({ path, field : "value" });
            }
            return;
        }

        const isList = Array.isArray(value);
        for (const [ key, child ] of Object.entries(value)) {
            const childPath = [ ...path, isList ? Number(key) : key ];
            if (!isList && key.toLowerCase().includes(needle)) {
                result.push({ path : childPath, field : "key" });
            }
            walk(child, childPath);
        }
    };

    walk(root, []);
    return result;
}

/**
 * Returns the text with every place the needle is found in it replaced,
 * whatever the case of the letters
 * @param {String} text
 * @param {String} needle
 * @param {String} replacement
 * @returns {String}
 */
function replace(text, needle, replacement) {
    const pattern = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    return text.replace(pattern, () => replacement);
}

/**
 * Returns a plain value as the text it is searched in
 * @param {*} value
 * @returns {String}
 */
function toText(value) {
    return typeof value === "string" ? value : String(value);
}




// The public API
export default {
    find,
    replace,
    toText,
};
