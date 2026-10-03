import Storage from "./Storage.js";



// How many of the documents that were not saved are kept, newest first
const MAX_RECENT = 20;

// The longest text that is kept. The browser has room for a few like it,
// and one longer than this would push every other out and still not fit
const MAX_TEXT = 1500000;



/**
 * The History, which keeps the documents that were worked on: the recent
 * ones for a while, and the saved ones, which have a name, for good
 */
export default class History {

    /** @type {Storage} */
    #storage;

    /** @type {Number[]} */
    #ids = [];


    /**
     * History constructor
     * @param {Storage} storage
     */
    constructor(storage) {
        this.#storage = storage;
        this.#ids     = storage.getHistory();
    }

    /**
     * Returns the entry with the given ID, if it is still there
     * @param {Number} id
     * @returns {?Object}
     */
    get(id) {
        return id ? this.#storage.getEntry(id) : null;
    }

    /**
     * Returns every entry, the saved ones apart from the recent, each
     * newest first
     * @returns {{pinned: Object[], recent: Object[]}}
     */
    list() {
        const pinned = [];
        const recent = [];
        for (const id of this.#ids) {
            const entry = this.get(id);
            if (entry) {
                (entry.isPinned ? pinned : recent).push(entry);
            }
        }
        return { pinned, recent };
    }

    /**
     * Returns what the entry is called: the name it was saved with, or the
     * name of its file, and nothing for one that was only pasted in, which
     * is told by what it holds
     * @param {Object} entry
     * @returns {String}
     */
    static nameOf(entry) {
        return entry.name || entry.fileName || "";
    }



    /**
     * Keeps the document as it is now. The entry it already has is written
     * over, since a document being worked on is the one document, and one
     * that has none takes the entry that holds the same text, or a new one.
     * The entry of the document on the other side is never taken, so each
     * side goes on with its own
     * @param {Number} id
     * @param {{name: String, text: String}} file
     * @param {{kind: String, size: String}} info
     * @param {Number} otherID
     * @returns {Object}
     */
    keep(id, file, info, otherID) {
        if (file.text.length > MAX_TEXT) {
            return { id : 0, isPinned : false };
        }
        const found = (id !== otherID && this.get(id)) || this.#find(file.text, otherID);
        if (found) {
            const entry = { ...found, ...info, fileName : file.name || "", text : file.text, time : Date.now() };
            if (!entry.isPinned) {
                this.#ids = [ entry.id, ...this.#ids.filter((one) => one !== entry.id) ];
                this.#storage.setHistory(this.#ids);
            }
            if (!this.#storage.setEntry(entry)) {
                return found;
            }
            return entry;
        }

        const entry = {
            id       : this.#storage.nextHistory,
            name     : "",
            fileName : file.name || "",
            text     : file.text,
            kind     : info.kind,
            size     : info.size,
            time     : Date.now(),
            isPinned : false,
        };
        this.#storage.setNumber("nextHistory", entry.id + 1);

        // The oldest of the recent make room, and when the browser has no
        // room for it even then, the entry is not kept and nothing is lost
        this.#ids.unshift(entry.id);
        this.#trimRecent(MAX_RECENT);
        while (!this.#storage.setEntry(entry)) {
            const recent = this.#ids.filter((one) => one !== entry.id && !this.#isPinned(one));
            if (!recent.length) {
                this.#ids = this.#ids.filter((one) => one !== entry.id);
                entry.id  = 0;
                break;
            }
            this.#trimRecent(recent.length - 1);
        }
        this.#storage.setHistory(this.#ids);
        return entry;
    }

    /**
     * Saves the entry for good, under the given name
     * @param {Number} id
     * @param {String} name
     * @returns {Void}
     */
    pin(id, name) {
        const entry = this.get(id);
        if (entry) {
            entry.name     = name;
            entry.isPinned = true;
            this.#storage.setEntry(entry);
        }
    }

    /**
     * Lets the entry go back among the recent
     * @param {Number} id
     * @returns {Void}
     */
    unpin(id) {
        const entry = this.get(id);
        if (entry) {
            entry.name     = "";
            entry.isPinned = false;
            this.#storage.setEntry(entry);
        }
    }

    /**
     * Removes the entry
     * @param {Number} id
     * @returns {Void}
     */
    remove(id) {
        this.#ids = this.#ids.filter((one) => one !== id);
        this.#storage.removeEntry(id);
        this.#storage.setHistory(this.#ids);
    }

    /**
     * Removes every entry that was not saved
     * @returns {Void}
     */
    clearRecent() {
        this.#trimRecent(0);
        this.#storage.setHistory(this.#ids);
    }



    /**
     * Returns the entry that holds the given text, if one other than the
     * given one does
     * @param {String} text
     * @param {Number} otherID
     * @returns {?Object}
     */
    #find(text, otherID) {
        for (const id of this.#ids) {
            const entry = id === otherID ? null : this.get(id);
            if (entry && entry.text === text) {
                return entry;
            }
        }
        return null;
    }

    /**
     * Returns true if the entry with the given ID is saved
     * @param {Number} id
     * @returns {Boolean}
     */
    #isPinned(id) {
        const entry = this.get(id);
        return Boolean(entry && entry.isPinned);
    }

    /**
     * Removes the oldest of the recent entries past the given amount
     * @param {Number} amount
     * @returns {Void}
     */
    #trimRecent(amount) {
        let count = 0;
        this.#ids = this.#ids.filter((id) => {
            if (this.#isPinned(id)) {
                return true;
            }
            count += 1;
            if (count > amount) {
                this.#storage.removeEntry(id);
                return false;
            }
            return true;
        });
    }
}
