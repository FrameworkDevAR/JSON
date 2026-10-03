/**
 * The Header, which says what is being looked at
 */
export default class Header {

    /** @type {HTMLElement} */
    #status;


    /**
     * Header constructor
     */
    constructor() {
        this.#status = document.querySelector(".header-status");
    }

    /**
     * Says the given text beside the title
     * @param {String} text
     * @returns {Void}
     */
    setStatus(text) {
        this.#status.innerHTML = text;
    }
}
