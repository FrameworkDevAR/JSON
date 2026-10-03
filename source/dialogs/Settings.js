import Dialog  from "./Dialog.js";
import Configs from "../core/Configs.js";
import Utils   from "../core/Utils.js";



// What the dialog asks for, and how each answer is read back: the ones
// that are either on or off, and the ones that are one of a few
const SWITCHES = [ "paintCode", "wrapText", "showTags", "spreadColumns" ];
const CHOICES  = [ "indent" ];



/**
 * The Settings Dialog
 */
export default class Settings {

    /** @type {Dialog} */
    #dialog;

    /** @type {Configs} */
    #configs;

    /** @type {HTMLElement} */
    #scroll;
    /** @type {HTMLElement} */
    #form;
    /** @type {HTMLElement} */
    #keys;


    /**
     * Settings Dialog constructor
     * @param {Configs}  configs
     * @param {Object[]} shortcuts
     */
    constructor(configs, shortcuts) {
        this.#dialog  = new Dialog("settings");
        this.#configs = configs;

        this.#scroll = this.#dialog.getElement(".settings-scroll");
        this.#form   = this.#dialog.getElement("form");
        this.#keys   = this.#dialog.getElement(".keys-list");

        // Each list says how much of it is past each end as it is scrolled
        for (const element of [ this.#form, this.#keys ]) {
            element.addEventListener("scroll", () => this.setFade());
        }

        for (const shortcut of shortcuts) {
            const item = document.createElement("li");
            const keys = document.createElement("div");
            const text = document.createElement("span");

            keys.className = "keys-keys";
            for (const name of shortcut.names) {
                const key = document.createElement("b");
                key.innerHTML = name;
                keys.appendChild(key);
            }

            text.innerHTML = shortcut.text;
            item.appendChild(keys);
            item.appendChild(text);
            this.#keys.appendChild(item);
        }
    }

    /**
     * Returns true if the Dialog is open
     * @returns {Boolean}
     */
    get isOpen() {
        return this.#dialog.isOpen;
    }

    /**
     * Shows the Options or the Shortcuts
     * @param {HTMLElement} target
     * @returns {Void}
     */
    setTab(target) {
        this.showTab(target.dataset.tab);
    }

    /**
     * Shows the given tab, and moves the mark under it
     * @param {String}   tab
     * @param {Boolean=} withMove
     * @returns {Void}
     */
    showTab(tab, withMove = true) {
        for (const element of this.#dialog.getElements("[data-tab]")) {
            element.classList.toggle("selected", element.dataset.tab === tab);
        }
        this.#dialog.getElement("dialog").classList.toggle("show-keys", tab === "keys");
        Utils.moveMark(this.#dialog.getElement(".tabs"), withMove);
        this.setFade();
    }

    /**
     * Fades the end of the list that runs past the Dialog by as much as it
     * hides and never deeper, so an end with nothing past it is not faded
     * @returns {Void}
     */
    setFade() {
        const depth = 16;
        const list  = this.#dialog.getElement("dialog").classList.contains("show-keys") ? this.#keys : this.#form;
        const rest  = list.scrollHeight - list.clientHeight - list.scrollTop;

        this.#scroll.style.setProperty("--fade-above", `${Math.min(Math.max(list.scrollTop, 0), depth)}px`);
        this.#scroll.style.setProperty("--fade-below", `${Math.min(Math.max(rest, 0), depth)}px`);
    }

    /**
     * Opens the Dialog with the Configs as they are, on the given tab
     * @param {String=} tab
     * @returns {Void}
     */
    open(tab = "options") {
        for (const name of SWITCHES) {
            this.#dialog.setInput(name, this.#configs.get(name));
        }
        for (const name of CHOICES) {
            for (const input of this.#dialog.getElements(`input[name="${name}"]`)) {
                if (input instanceof HTMLInputElement) {
                    input.checked = input.value === String(this.#configs.get(name));
                }
            }
        }
        this.#dialog.hideErrors();
        this.#dialog.open();
        this.showTab(tab, false);
    }

    /**
     * Returns what the Dialog was left at
     * @returns {?Object}
     */
    update() {
        if (!this.#dialog.isOpen) {
            return null;
        }

        const result = {};
        for (const name of SWITCHES) {
            result[name] = Boolean(this.#dialog.getInput(name));
        }
        for (const name of CHOICES) {
            const input = this.#dialog.getElement(`input[name="${name}"]:checked`);
            if (input instanceof HTMLInputElement) {
                result[name] = input.value;
            }
        }

        this.#dialog.close();
        return result;
    }

    /**
     * Closes the Dialog
     * @returns {Void}
     */
    close() {
        this.#dialog.close();
    }
}
