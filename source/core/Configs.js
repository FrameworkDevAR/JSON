import Storage from "./Storage.js";



// What the app does when nothing has been asked of it
const DEFAULTS = {
    indent        : "4",
    paintCode     : true,
    wrapText      : false,
    showTags      : true,
    spreadColumns : true,
};



/**
 * The Configs
 */
export default class Configs {

    /** @type {Storage} */
    #storage;


    /**
     * Configs constructor
     * @param {Storage} storage
     */
    constructor(storage) {
        this.#storage = storage;
        this.values   = { ...DEFAULTS, ...(storage.getSettings() || {}) };
    }

    /**
     * Returns the value of the given Config
     * @param {String} name
     * @returns {*}
     */
    get(name) {
        return this.values[name];
    }

    /**
     * Takes the given Configs, keeping the rest as they are
     * @param {Object} values
     * @returns {Void}
     */
    set(values) {
        this.values = { ...this.values, ...values };
        this.#storage.setSettings(this.values);
    }
}
