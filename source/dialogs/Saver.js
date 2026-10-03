import Dialog  from "./Dialog.js";
import History from "../core/History.js";



/**
 * The Save Dialog, which names a document to keep it in the History for good
 */
export default class Saver {

    /** @type {Dialog} */
    #dialog;


    /**
     * Saver constructor
     */
    constructor() {
        this.#dialog = new Dialog("save");
    }

    /**
     * Returns true if the Dialog is open
     * @returns {Boolean}
     */
    get isOpen() {
        return this.#dialog.isOpen;
    }

    /**
     * Opens the Dialog for the given entry, to name it or to name it again
     * @param {Object} entry
     * @returns {Void}
     */
    open(entry) {
        this.#dialog.setTitle(entry.isPinned ? "Rename the document" : "Save the document");
        this.#dialog.setButton(entry.isPinned ? "Rename" : "Save");
        this.#dialog.getElement(".save-forget").style.display = entry.isPinned ? "" : "none";
        this.#dialog.setInput("name", History.nameOf(entry));
        this.#dialog.open();

        /** @type {HTMLInputElement} */
        // @ts-ignore
        const input = this.#dialog.getElement("[data-field=name] input");
        input.select();
    }

    /**
     * Returns the name that was typed, or nothing when there is none, which
     * the Dialog says
     * @returns {String}
     */
    getName() {
        const name = String(this.#dialog.getInput("name")).trim();
        if (!name) {
            this.#dialog.showError("name");
            return "";
        }
        return name;
    }

    /**
     * Closes the Dialog
     * @returns {Void}
     */
    close() {
        this.#dialog.close();
    }
}
