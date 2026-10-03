import Dialog from "./Dialog.js";



/**
 * A Dialog that asks for a text, which the app has two of: the one that
 * asks for the address of a document, and the one that asks for the
 * schema a document is checked against
 */
export default class Texter {

    /** @type {Dialog} */
    #dialog;

    /** @type {(HTMLInputElement|HTMLTextAreaElement)} */
    #input;


    /**
     * Texter constructor
     * @param {String} name
     */
    constructor(name) {
        this.#dialog = new Dialog(name);
        // @ts-ignore
        this.#input  = this.#dialog.getElement("input[type=text], textarea");
    }

    /**
     * Returns true if the Dialog is open
     * @returns {Boolean}
     */
    get isOpen() {
        return this.#dialog.isOpen;
    }

    /**
     * Opens the Dialog with the given text in it
     * @param {String=} text
     * @returns {Void}
     */
    open(text = "") {
        this.#input.value = text;
        this.#dialog.open();
        this.#input.focus();
    }

    /**
     * Returns the text that was typed
     * @returns {String}
     */
    getText() {
        return this.#input.value.trim();
    }

    /**
     * Says what is wrong with the text that was typed
     * @param {String} message
     * @returns {Void}
     */
    showError(message) {
        this.#dialog.showError("text", message);
    }

    /**
     * Closes the Dialog
     * @returns {Void}
     */
    close() {
        this.#dialog.close();
    }
}
