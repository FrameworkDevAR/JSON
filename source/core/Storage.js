/**
 * The Storage, which keeps the documents and how they were being looked at
 * for the next visit
 */
export default class Storage {

    /**
     * Returns a stored String
     * @param {...String} keys
     * @returns {String}
     */
    getString(...keys) {
        return localStorage.getItem(keys.join("-")) || "";
    }

    /**
     * Saves a String, and says whether it fit. A document too big for the
     * browser to keep is not kept, and is no less worked on for it
     * @param {...*} items
     * @returns {Boolean}
     */
    setString(...items) {
        const value = items.pop();
        try {
            localStorage.setItem(items.join("-"), value);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Returns a stored Number
     * @param {...*} items
     * @returns {Number}
     */
    getNumber(...items) {
        const defValue = items.pop();
        return Number(localStorage.getItem(items.join("-"))) || defValue;
    }

    /**
     * Saves a Number
     * @param {...*} items
     * @returns {Void}
     */
    setNumber(...items) {
        const value = items.pop();
        this.setString(...items, String(value));
    }

    /**
     * Returns a stored Object
     * @param {...String} keys
     * @returns {?Object}
     */
    getData(...keys) {
        const data = localStorage.getItem(keys.join("-"));
        try {
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    }

    /**
     * Saves an Object
     * @param {...*} items
     * @returns {Void}
     */
    setData(...items) {
        const value = items.pop();
        this.setString(...items, JSON.stringify(value));
    }



    /**
     * Returns the document of the given side, as it was left
     * @param {String} side
     * @returns {{name: String, text: String, mode: String, docID: Number}}
     */
    getDoc(side) {
        return {
            name  : this.getString(side, "name"),
            text  : this.getString(side, "text"),
            mode  : this.getString(side, "mode") || "text",
            docID : this.getNumber(side, "docID", 0),
        };
    }

    /**
     * Keeps the document of the given side, and says whether its text fit
     * @param {String} side
     * @param {{name: String, text: String, mode: String, docID: Number}} doc
     * @returns {Boolean}
     */
    setDoc(side, doc) {
        this.setString(side, "name", doc.name || "");
        this.setString(side, "mode", doc.mode || "text");
        this.setNumber(side, "docID", doc.docID || 0);

        const isKept = this.setString(side, "text", doc.text || "");
        if (!isKept) {
            localStorage.removeItem(`${side}-text`);
        }
        return isKept;
    }

    /**
     * Returns the JSON Schema the given side is checked against, as text
     * @param {String} side
     * @returns {String}
     */
    getSchema(side) {
        return this.getString(side, "schema");
    }

    /**
     * Keeps the JSON Schema the given side is checked against
     * @param {String} side
     * @param {String} text
     * @returns {Void}
     */
    setSchema(side, text) {
        this.setString(side, "schema", text);
    }



    /**
     * Returns true if the given thing was left turned on
     * @param {String} name
     * @returns {Boolean}
     */
    getFlag(name) {
        return this.getString("flag", name) === "1";
    }

    /**
     * Keeps whether the given thing is turned on
     * @param {String}  name
     * @param {Boolean} isOn
     * @returns {Void}
     */
    setFlag(name, isOn) {
        this.setString("flag", name, isOn ? "1" : "0");
    }

    /**
     * Returns the side of the Panel that is shown alone, or nothing when
     * the two of them are shown
     * @returns {String}
     */
    getOnly() {
        return this.getString("only");
    }

    /**
     * Keeps the side of the Panel that is shown alone
     * @param {String} side
     * @returns {Void}
     */
    setOnly(side) {
        this.setString("only", side);
    }

    /**
     * Returns the share of the page the left Panel was left with
     * @returns {Number}
     */
    getSplit() {
        return this.getNumber("split", 0.5);
    }

    /**
     * Keeps the share of the page the left Panel takes
     * @param {Number} share
     * @returns {Void}
     */
    setSplit(share) {
        this.setNumber("split", share);
    }

    /**
     * Returns the language the queries were last written in
     * @returns {String}
     */
    getLanguage() {
        return this.getString("language") || "query";
    }

    /**
     * Keeps the language the queries are written in
     * @param {String} language
     * @returns {Void}
     */
    setLanguage(language) {
        this.setString("language", language);
    }



    /**
     * Returns the IDs of the entries of the History, newest first
     * @returns {Number[]}
     */
    getHistory() {
        return this.getData("history") || [];
    }

    /**
     * Keeps the IDs of the entries of the History
     * @param {Number[]} ids
     * @returns {Void}
     */
    setHistory(ids) {
        this.setData("history", ids);
    }

    /**
     * Returns the ID the next entry of the History takes
     * @returns {Number}
     */
    get nextHistory() {
        return this.getNumber("nextHistory", 1);
    }

    /**
     * Returns an entry of the History
     * @param {Number} id
     * @returns {?Object}
     */
    getEntry(id) {
        return this.getData("entry", String(id));
    }

    /**
     * Keeps an entry of the History, and says whether it fit
     * @param {Object} entry
     * @returns {Boolean}
     */
    setEntry(entry) {
        return this.setString("entry", String(entry.id), JSON.stringify(entry));
    }

    /**
     * Removes an entry of the History
     * @param {Number} id
     * @returns {Void}
     */
    removeEntry(id) {
        localStorage.removeItem(`entry-${id}`);
    }



    /**
     * Returns the Settings, if any were ever saved
     * @returns {?Object}
     */
    getSettings() {
        return this.getData("settings");
    }

    /**
     * Saves the Settings
     * @param {Object} settings
     * @returns {Void}
     */
    setSettings(settings) {
        this.setData("settings", settings);
    }

    /**
     * Returns the Mode
     * @returns {String}
     */
    getMode() {
        return this.getString("mode") || "system";
    }

    /**
     * Sets the Mode, which is the light, the dark or the one of the system
     * @param {String} mode
     * @returns {Void}
     */
    setMode(mode) {
        this.setString("mode", mode);
    }
}
