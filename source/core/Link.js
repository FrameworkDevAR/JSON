// The modes a link can ask for
const MODES = [ "text", "tree", "table" ];



/**
 * Reads the documents a link carries after its #, which come either
 * written out, as "json=...", or packed, as "z=..." with the same fields
 * as JSON, gzipped and in base64. Nothing after the # ever leaves the
 * browser. The first document goes to the left and a second one to the
 * right, which a link asks to be compared when it gives both
 * @param {String} hash
 * @returns {Promise<?{left: ?Object, right: ?Object, mode: String, isComparing: Boolean}>}
 */
async function read(hash) {
    let fields = parseFields(hash.replace(/^#/, ""));
    if (fields.z) {
        try {
            fields = JSON.parse(await unpack(fields.z));
        } catch {
            throw new Error("The link is not complete");
        }
    }

    const left  = toDocument(fields.json !== undefined ? fields.json : fields.left, fields.name || fields.leftName);
    const right = toDocument(fields.right, fields.rightName);
    if (!left && !right) {
        return null;
    }
    return {
        left,
        right,
        mode        : MODES.includes(fields.mode) ? fields.mode : "",
        isComparing : fields.compare === true || fields.compare === "true" || fields.compare === "1",
    };
}

/**
 * Returns the document a field of the link holds. One that came packed
 * can be the JSON itself rather than its text, and is then written out
 * @param {*} value
 * @param {*} name
 * @returns {?{name: String, text: String}}
 */
function toDocument(value, name) {
    if (value === undefined || value === "") {
        return null;
    }
    const text = typeof value === "string" ? value.replace(/\r\n?/g, "\n") : JSON.stringify(value, null, 4);
    return { name : typeof name === "string" ? name : "", text };
}

/**
 * Splits the fields of a link apart. A plus is left as a plus, since a
 * text can have one, so a space has to come as %20
 * @param {String} text
 * @returns {Object}
 */
function parseFields(text) {
    const result = {};
    for (const part of text.split("&")) {
        const at = part.indexOf("=");
        if (at <= 0) {
            continue;
        }
        const key   = part.slice(0, at);
        const value = part.slice(at + 1);
        try {
            result[key] = decodeURIComponent(value);
        } catch {
            // A stray % is taken as it was written
            result[key] = value;
        }
    }
    return result;
}

/**
 * Reads the text back from its base64, in either of its alphabets
 * @param {String} packed
 * @returns {Promise<String>}
 */
async function unpack(packed) {
    const binary = atob(packed.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, ""));
    const bytes  = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const stream = new Blob([ bytes ]).stream().pipeThrough(new DecompressionStream("gzip"));
    return new Response(stream).text();
}




// The public API
export default {
    read,
};
