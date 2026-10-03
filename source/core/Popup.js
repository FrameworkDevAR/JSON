import Utils from "./Utils.js";



/**
 * The Popup, which is the one menu of the page: it opens beside whatever
 * asked for it with the things that can be done there, and is gone once
 * one is picked or anything else is touched
 */
export default class Popup {

    /** @type {HTMLElement} */
    #element;

    #isOpen = false;
    #place  = { x : 0, y : 0 };


    /**
     * Popup constructor
     */
    constructor() {
        this.#element = document.querySelector(".popup");
    }

    /**
     * Returns true if the menu is open
     * @returns {Boolean}
     */
    get isOpen() {
        return this.#isOpen;
    }

    /**
     * Returns the place the menu last opened at, for a menu that opens
     * from another one to open where that one was
     * @returns {{x: Number, y: Number}}
     */
    get place() {
        return this.#place;
    }

    /**
     * Opens the menu with the given items at the given place of the window.
     * An item is a thing to do, a line between two groups, or a name with
     * the few things it can be done with beside it
     * @param {Object[]} items
     * @param {{x: Number, y: Number}} place
     * @returns {Void}
     */
    open(items, place) {
        this.#element.innerHTML = items.map(renderItem).join("");
        this.#element.style.display = "flex";
        this.#element.scrollTop = 0;
        this.#isOpen = true;
        this.#place  = place;

        // It opens down and to the right of the place, unless the window
        // ends before the menu does
        const edge   = 8;
        const width  = this.#element.offsetWidth;
        const height = this.#element.offsetHeight;
        const left   = Math.max(Math.min(place.x, window.innerWidth - width - edge), edge);
        const top    = Math.max(Math.min(place.y, window.innerHeight - height - edge), edge);
        this.#element.style.left = `${left}px`;
        this.#element.style.top  = `${top}px`;
    }

    /**
     * Opens the menu under the given Element
     * @param {Object[]}    items
     * @param {HTMLElement} target
     * @returns {Void}
     */
    openUnder(items, target) {
        // A menu asked for from the menu opens where that one was
        if (target.closest(".popup")) {
            this.open(items, this.#place);
            return;
        }
        const bounds = target.getBoundingClientRect();
        this.open(items, { x : bounds.left, y : bounds.bottom + 6 });
    }

    /**
     * Closes the menu
     * @returns {Void}
     */
    close() {
        if (this.#isOpen) {
            this.#isOpen = false;
            this.#element.style.display = "none";
        }
    }
}



/**
 * Draws an item of the menu
 * @param {Object} item
 * @returns {String}
 */
function renderItem(item) {
    if (item.line) {
        return "<hr />";
    }
    if (item.chips) {
        const chips = item.chips.map((chip) => renderLink(chip, "popup-chip")).join("");
        return `<div class="popup-row"><span>${Utils.escape(item.label)}</span><div>${chips}</div></div>`;
    }
    return renderLink(item, item.isDanger ? "popup-item is-danger" : "popup-item");
}

/**
 * Draws a thing to do as the link that does it
 * @param {Object} item
 * @param {String} className
 * @returns {String}
 */
function renderLink(item, className) {
    const value = item.value !== undefined ? ` data-value="${Utils.escape(String(item.value))}"` : "";
    const keys  = item.keys ? `<b>${Utils.escape(item.keys)}</b>` : "";
    return `<a href="#" class="${className}" data-action="${item.action}"${value}>${Utils.escape(item.text)}${keys}</a>`;
}
