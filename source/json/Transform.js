import JsonPath from "./JsonPath.js";
import Query    from "./Query.js";



// The languages a document can be asked in, and what each one starts with
const LANGUAGES = {
    query      : { name : "Query", start : "", hasWizard : true },
    jsonpath   : { name : "JSONPath", start : "$", hasWizard : false },
    javascript : { name : "JavaScript", start : "function query (data) {\n    return data\n}", hasWizard : true },
};



/**
 * Returns what the given language starts a query with
 * @param {String} language
 * @returns {String}
 */
function getStart(language) {
    return (LANGUAGES[language] || LANGUAGES.query).start;
}

/**
 * Returns true if the form can write a query in the given language
 * @param {String} language
 * @returns {Boolean}
 */
function hasWizard(language) {
    return Boolean(LANGUAGES[language] && LANGUAGES[language].hasWizard);
}

/**
 * Runs the query over the value, in the language it is written in, and
 * returns what it gives as something JSON can hold
 * @param {*}      data
 * @param {String} language
 * @param {String} text
 * @returns {*}
 */
function run(data, language, text) {
    let result;
    switch (language) {
    case "jsonpath":
        result = JsonPath.run(data, text);
        break;
    case "javascript":
        result = runScript(data, text);
        break;
    default:
        result = Query.run(data, text);
    }

    // What JSON has no way to write is left out, the way it leaves it out
    const written = JSON.stringify(result === undefined ? null : result);
    return JSON.parse(written === undefined ? "null" : written);
}

/**
 * Runs a function written in JavaScript over a copy of the value, so
 * whatever it does to what it is given stays out of the document
 * @param {*}      data
 * @param {String} text
 * @returns {*}
 */
function runScript(data, text) {
    // eslint-disable-next-line no-new-func
    const query = new Function(`"use strict"; return (${text}\n);`)();
    if (typeof query !== "function") {
        throw new Error("The JavaScript has to be a function that takes the data");
    }
    return query(JSON.parse(JSON.stringify(data)));
}

/**
 * Writes the query that does what was asked for in the form, in the given
 * language
 * @param {String} language
 * @param {{filter: ?Object, sort: ?Object, pick: String[][]}} wizard
 * @returns {String}
 */
function write(language, wizard) {
    if (language !== "javascript") {
        return Query.write(wizard);
    }

    const read  = (name, path) => name + path.map((key) => (/^[A-Za-z_$][\w$]*$/.test(key) ? `?.${key}` : `?.[${JSON.stringify(key)}]`)).join("");
    const steps = [];
    if (wizard.filter) {
        const { path, sign, value } = wizard.filter;
        steps.push(`.filter((item) => ${read("item", path)} ${sign} ${JSON.stringify(value)})`);
    }
    if (wizard.sort) {
        const { path, isDescending } = wizard.sort;
        const [ one, other ] = isDescending ? [ "b", "a" ] : [ "a", "b" ];
        steps.push(`.sort((a, b) => (${read(one, path)} > ${read(other, path)} ? 1 : ${read(one, path)} < ${read(other, path)} ? -1 : 0))`);
    }
    if (wizard.pick && wizard.pick.length) {
        const keys = wizard.pick.map((path) => `${JSON.stringify(path[path.length - 1])}: ${read("item", path)}`);
        steps.push(`.map((item) => ({ ${keys.join(", ")} }))`);
    }

    const lines = steps.map((step) => `\n        ${step}`).join("");
    return `function query (data) {\n    return data${lines}\n}`;
}




// The public API
export default {
    getStart,
    hasWizard,
    run,
    write,
};
