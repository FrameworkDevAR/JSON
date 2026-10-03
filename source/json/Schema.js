import Kinds from "./Kinds.js";
import Path  from "./Path.js";



// How many problems are looked for before the checking stops
const MAX_PROBLEMS = 100;

// What the formats a text can be asked to have are written as
const FORMATS = {
    "email"     : /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    "uri"       : /^[a-zA-Z][a-zA-Z0-9+.-]*:\S+$/,
    "url"       : /^https?:\/\/\S+$/,
    "date"      : /^\d{4}-\d{2}-\d{2}$/,
    "time"      : /^\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/,
    "date-time" : /^\d{4}-\d{2}-\d{2}[Tt ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|z|[+-]\d{2}:\d{2})?$/,
    "uuid"      : /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "ipv4"      : /^(\d{1,3}\.){3}\d{1,3}$/,
    "hostname"  : /^[a-zA-Z0-9]([a-zA-Z0-9-.]*[a-zA-Z0-9])?$/,
};



/**
 * Checks the value against a JSON Schema and returns every place where it
 * is not what the schema asks for. It knows the keywords a schema is
 * usually written with: the types, the properties of an object and which
 * are required, the items of a list, the bounds of a number and of a text,
 * the values that are allowed, the combinations, and what is defined once
 * and pointed at from elsewhere in the same schema
 * @param {*}      value
 * @param {Object} schema
 * @returns {{path: (String|Number)[], message: String}[]}
 */
export default function validate(value, schema) {
    const state = { root : schema, problems : [] };
    check(value, schema, [], state);
    return state.problems;
}

/**
 * Notes a problem at the given path
 * @param {Object}            state
 * @param {(String|Number)[]} path
 * @param {String}            message
 * @returns {Void}
 */
function report(state, path, message) {
    if (state.problems.length < MAX_PROBLEMS) {
        state.problems.push({ path, message });
    }
}

/**
 * Returns true if the value answers the schema, without noting anything
 * @param {*}      value
 * @param {*}      schema
 * @param {Object} state
 * @returns {Boolean}
 */
function answers(value, schema, state) {
    const inner = { root : state.root, problems : [] };
    check(value, schema, [], inner);
    return inner.problems.length === 0;
}

/**
 * Returns the schema that another one points at, inside the same one
 * @param {String} pointer
 * @param {Object} state
 * @returns {*}
 */
function follow(pointer, state) {
    if (!pointer.startsWith("#")) {
        return true;
    }
    const path = Path.fromPointer(decodeURIComponent(pointer.slice(1)));
    const found = Path.get(state.root, path);
    return found === undefined ? true : found;
}

/**
 * Returns true if the value is of the given type, as a schema names them
 * @param {*}      value
 * @param {String} type
 * @returns {Boolean}
 */
function isType(value, type) {
    const kind = Kinds.typeOf(value);
    if (type === "integer") {
        return kind === "number" && Number.isInteger(value);
    }
    return kind === type;
}

/**
 * Checks the value at the given path against the given schema
 * @param {*}                 value
 * @param {*}                 schema
 * @param {(String|Number)[]} path
 * @param {Object}            state
 * @returns {Void}
 */
function check(value, schema, path, state) {
    if (schema === true || schema === undefined || state.problems.length >= MAX_PROBLEMS) {
        return;
    }
    if (schema === false) {
        report(state, path, "Nothing is allowed here");
        return;
    }
    if (!Path.isContainer(schema) || Array.isArray(schema)) {
        return;
    }
    if (typeof schema.$ref === "string") {
        check(value, follow(schema.$ref, state), path, state);
        return;
    }

    const kind = Kinds.typeOf(value);
    if (schema.type !== undefined) {
        const types = Array.isArray(schema.type) ? schema.type : [ schema.type ];
        if (!types.some((type) => isType(value, type))) {
            report(state, path, `It should be ${types.join(" or ")}, and it is ${kind}`);
            return;
        }
    }
    if (Array.isArray(schema.enum) && !schema.enum.some((item) => isEqual(item, value))) {
        report(state, path, `It should be one of ${schema.enum.map((item) => JSON.stringify(item)).join(", ")}`);
    }
    if (schema.const !== undefined && !isEqual(schema.const, value)) {
        report(state, path, `It should be ${JSON.stringify(schema.const)}`);
    }

    switch (kind) {
    case "number":
        checkNumber(value, schema, path, state);
        break;
    case "string":
        checkString(value, schema, path, state);
        break;
    case "array":
        checkArray(value, schema, path, state);
        break;
    case "object":
        checkObject(value, schema, path, state);
        break;
    default:
    }
    checkCombined(value, schema, path, state);
}

/**
 * Checks a number against what the schema asks of one
 * @param {Number}            value
 * @param {Object}            schema
 * @param {(String|Number)[]} path
 * @param {Object}            state
 * @returns {Void}
 */
function checkNumber(value, schema, path, state) {
    if (typeof schema.minimum === "number" && value < schema.minimum) {
        report(state, path, `It should be ${schema.minimum} or more`);
    }
    if (typeof schema.maximum === "number" && value > schema.maximum) {
        report(state, path, `It should be ${schema.maximum} or less`);
    }
    if (typeof schema.exclusiveMinimum === "number" && value <= schema.exclusiveMinimum) {
        report(state, path, `It should be more than ${schema.exclusiveMinimum}`);
    }
    if (typeof schema.exclusiveMaximum === "number" && value >= schema.exclusiveMaximum) {
        report(state, path, `It should be less than ${schema.exclusiveMaximum}`);
    }
    if (typeof schema.multipleOf === "number" && schema.multipleOf > 0) {
        const times = value / schema.multipleOf;
        if (Math.abs(times - Math.round(times)) > 1e-9) {
            report(state, path, `It should be a multiple of ${schema.multipleOf}`);
        }
    }
}

/**
 * Checks a text against what the schema asks of one
 * @param {String}            value
 * @param {Object}            schema
 * @param {(String|Number)[]} path
 * @param {Object}            state
 * @returns {Void}
 */
function checkString(value, schema, path, state) {
    const length = [ ...value ].length;
    if (typeof schema.minLength === "number" && length < schema.minLength) {
        report(state, path, `It should have ${schema.minLength} characters or more`);
    }
    if (typeof schema.maxLength === "number" && length > schema.maxLength) {
        report(state, path, `It should have ${schema.maxLength} characters or less`);
    }
    if (typeof schema.pattern === "string") {
        try {
            if (!new RegExp(schema.pattern, "u").test(value)) {
                report(state, path, `It should match ${schema.pattern}`);
            }
        } catch {
            // A pattern that can not be read asks for nothing
        }
    }
    if (typeof schema.format === "string" && FORMATS[schema.format] && !FORMATS[schema.format].test(value)) {
        report(state, path, `It should be written as ${schema.format === "email" || schema.format === "ipv4" ? "an" : "a"} ${schema.format}`);
    }
}

/**
 * Checks a list against what the schema asks of one
 * @param {Array}             value
 * @param {Object}            schema
 * @param {(String|Number)[]} path
 * @param {Object}            state
 * @returns {Void}
 */
function checkArray(value, schema, path, state) {
    if (typeof schema.minItems === "number" && value.length < schema.minItems) {
        report(state, path, `It should have ${schema.minItems} items or more`);
    }
    if (typeof schema.maxItems === "number" && value.length > schema.maxItems) {
        report(state, path, `It should have ${schema.maxItems} items or less`);
    }
    if (schema.uniqueItems === true) {
        const seen = new Set();
        for (const item of value) {
            const text = JSON.stringify(item);
            if (seen.has(text)) {
                report(state, path, "Its items should all be different");
                break;
            }
            seen.add(text);
        }
    }

    // The items are asked the same thing each, or one thing per place, and
    // the ones past the last place are asked whatever is asked of the rest
    const places = Array.isArray(schema.prefixItems) ? schema.prefixItems
        : (Array.isArray(schema.items) ? schema.items : []);
    const rest   = Array.isArray(schema.items) ? schema.additionalItems : schema.items;
    for (const [ index, item ] of value.entries()) {
        check(item, index < places.length ? places[index] : rest, [ ...path, index ], state);
    }
    if (schema.contains !== undefined && !value.some((item) => answers(item, schema.contains, state))) {
        report(state, path, "None of its items is what one of them should be");
    }
}

/**
 * Checks an object against what the schema asks of one
 * @param {Object}            value
 * @param {Object}            schema
 * @param {(String|Number)[]} path
 * @param {Object}            state
 * @returns {Void}
 */
function checkObject(value, schema, path, state) {
    const keys       = Object.keys(value);
    const properties = Path.isContainer(schema.properties) ? schema.properties : {};
    const patterns   = Path.isContainer(schema.patternProperties) ? Object.entries(schema.patternProperties) : [];

    for (const name of Array.isArray(schema.required) ? schema.required : []) {
        if (!Object.prototype.hasOwnProperty.call(value, name)) {
            report(state, path, `It should have a "${name}"`);
        }
    }
    if (typeof schema.minProperties === "number" && keys.length < schema.minProperties) {
        report(state, path, `It should have ${schema.minProperties} properties or more`);
    }
    if (typeof schema.maxProperties === "number" && keys.length > schema.maxProperties) {
        report(state, path, `It should have ${schema.maxProperties} properties or less`);
    }

    for (const key of keys) {
        const childPath = [ ...path, key ];
        let   isKnown   = false;
        if (Object.prototype.hasOwnProperty.call(properties, key)) {
            isKnown = true;
            check(value[key], properties[key], childPath, state);
        }
        for (const [ pattern, inner ] of patterns) {
            let isMatch = false;
            try {
                isMatch = new RegExp(pattern, "u").test(key);
            } catch {
                isMatch = false;
            }
            if (isMatch) {
                isKnown = true;
                check(value[key], inner, childPath, state);
            }
        }
        if (isKnown || schema.additionalProperties === undefined) {
            continue;
        }
        if (schema.additionalProperties === false) {
            report(state, childPath, "This property is not one the schema allows");
        } else {
            check(value[key], schema.additionalProperties, childPath, state);
        }
    }
}

/**
 * Checks the value against the schemas that are combined in this one
 * @param {*}                 value
 * @param {Object}            schema
 * @param {(String|Number)[]} path
 * @param {Object}            state
 * @returns {Void}
 */
function checkCombined(value, schema, path, state) {
    if (Array.isArray(schema.allOf)) {
        for (const inner of schema.allOf) {
            check(value, inner, path, state);
        }
    }
    if (Array.isArray(schema.anyOf) && !schema.anyOf.some((inner) => answers(value, inner, state))) {
        report(state, path, "It is none of the things it may be");
    }
    if (Array.isArray(schema.oneOf)) {
        const amount = schema.oneOf.filter((inner) => answers(value, inner, state)).length;
        if (amount !== 1) {
            report(state, path, amount ? "It is more than one of the things it may be" : "It is none of the things it may be");
        }
    }
    if (schema.not !== undefined && answers(value, schema.not, state)) {
        report(state, path, "It is what it should not be");
    }
    if (schema.if !== undefined) {
        const branch = answers(value, schema.if, state) ? schema.then : schema.else;
        if (branch !== undefined) {
            check(value, branch, path, state);
        }
    }
}

/**
 * Returns true if both values are the same, all the way in
 * @param {*} one
 * @param {*} other
 * @returns {Boolean}
 */
function isEqual(one, other) {
    if (one === other) {
        return true;
    }
    return Path.isContainer(one) && Path.isContainer(other) && JSON.stringify(one) === JSON.stringify(other);
}
