// What the parts of a JSON are, to be told apart as they are painted: a
// text, with the colon that makes it a key, a word, a number, or a bracket
const PARTS = /("(?:\\.|[^"\\\n])*"?)(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}[\],:]/g;



/**
 * Returns the text as it goes in a page, with what would be read as a tag
 * written out plain
 * @param {String} text
 * @returns {String}
 */
function escape(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Returns the JSON with each part in the color of what it is. Whatever is
 * not a part of a JSON is left as it was, so a text that is not one is
 * still painted as far as it can be
 * @param {String} text
 * @returns {String}
 */
function paint(text) {
    let result = "";
    let last   = 0;

    PARTS.lastIndex = 0;
    for (let match = PARTS.exec(text); match; match = PARTS.exec(text)) {
        result += escape(text.slice(last, match.index));
        last    = match.index + match[0].length;

        const part = match[0];
        if (match[1]) {
            if (match[2]) {
                result += `<span class="code-key">${escape(match[1])}</span>${match[2]}`;
            } else {
                result += `<span class="code-string">${escape(part)}</span>`;
            }
        } else if (part === "true" || part === "false") {
            result += `<span class="code-boolean">${part}</span>`;
        } else if (part === "null") {
            result += `<span class="code-null">${part}</span>`;
        } else if (part.length > 1 || /\d/.test(part)) {
            result += `<span class="code-number">${part}</span>`;
        } else {
            result += `<span class="code-mark">${part}</span>`;
        }
    }
    return result + escape(text.slice(last));
}




// The public API
export default {
    escape,
    paint,
};
