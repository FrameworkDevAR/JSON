import Dialog    from "./Dialog.js";
import Utils     from "../core/Utils.js";
import Format    from "../json/Format.js";
import Kinds     from "../json/Kinds.js";
import Sort      from "../json/Sort.js";
import Transform from "../json/Transform.js";



// How many lines of what a query gives are shown before it is run for good
const MAX_PREVIEW = 60;

// The signs the form can compare a value with
const SIGNS = [ "==", "!=", "<", "<=", ">", ">=" ];



/**
 * The Transform Dialog, which asks a document a query and shows what the
 * query gives before the document is changed for it. A query is written
 * by hand, or by the form above it when what is asked is a list
 */
export default class Transformer {

    /** @type {Dialog} */
    #dialog;

    /** @type {HTMLTextAreaElement} */
    #query;
    /** @type {HTMLElement} */
    #preview;

    /** @type {String[][]} */
    #fields = [];

    /** @type {Set<Number>} */
    #picks = new Set();

    #data     = null;
    #language = "query";
    #timer    = 0;


    /**
     * Transformer constructor
     */
    constructor() {
        this.#dialog  = new Dialog("transform");
        // @ts-ignore
        this.#query   = this.#dialog.getElement(".transform-query");
        this.#preview = this.#dialog.getElement(".transform-preview");

        this.#query.addEventListener("input", () => {
            window.clearTimeout(this.#timer);
            this.#timer = window.setTimeout(() => this.showPreview(), 250);
        });
        this.#dialog.getElement(".wizard").addEventListener("input", () => this.#writeQuery());
        this.#dialog.getElement(".wizard").addEventListener("change", () => this.#writeQuery());
    }

    /**
     * Returns true if the Dialog is open
     * @returns {Boolean}
     */
    get isOpen() {
        return this.#dialog.isOpen;
    }

    /**
     * Returns the language the query is written in
     * @returns {String}
     */
    get language() {
        return this.#language;
    }

    /**
     * Returns true if what the query gives goes to the other panel
     * @returns {Boolean}
     */
    get toOther() {
        return Boolean(this.#dialog.getInput("toOther"));
    }

    /**
     * Opens the Dialog to ask the given value, saying where it is
     * @param {*}      data
     * @param {String} where
     * @param {String} language
     * @returns {Void}
     */
    open(data, where, language) {
        this.#data   = data;
        this.#fields = Array.isArray(data) ? Sort.getFields(data) : [];
        this.#picks  = new Set();

        this.#dialog.getElement(".transform-where").textContent = `What the query is asked is ${where}.`;
        this.#dialog.setInput("toOther", false);
        this.#fillWizard();
        this.#dialog.open();
        this.setLanguage(language, false);
        this.#query.focus();
    }

    /**
     * Takes the given language, and starts the query the way it starts one
     * @param {String}   language
     * @param {Boolean=} withMove
     * @returns {Void}
     */
    setLanguage(language, withMove = true) {
        this.#language = language;
        for (const element of this.#dialog.getElements("[data-language]")) {
            element.classList.toggle("selected", element.dataset.language === language);
        }
        Utils.moveMark(this.#dialog.getElement(".tabs"), withMove);

        const hasWizard = Transform.hasWizard(language) && this.#fields.length > 0;
        this.#dialog.getElement(".wizard").style.display = hasWizard ? "" : "none";
        this.#query.value = Transform.getStart(language);
        if (hasWizard) {
            this.#writeQuery();
        } else {
            this.showPreview();
        }
    }

    /**
     * Fills the form with the values the items of the list have
     * @returns {Void}
     */
    #fillWizard() {
        const options = this.#fields.map((path, index) => `<option value="${index}">${Utils.escape(path.join("."))}</option>`).join("");
        for (const name of [ "filterField", "sortField" ]) {
            this.#dialog.getElement(`select[name="${name}"]`).innerHTML = `<option value="">–</option>${options}`;
        }
        this.#dialog.getElement('select[name="filterSign"]').innerHTML = SIGNS.map((sign) => `<option>${Utils.escape(sign)}</option>`).join("");

        /** @type {HTMLInputElement} */
        // @ts-ignore
        const value = this.#dialog.getElement('input[name="filterValue"]');
        value.value = "";
        this.#drawPicks();
    }

    /**
     * Draws the values that can be kept of each item, the kept ones lit
     * @returns {Void}
     */
    #drawPicks() {
        this.#dialog.getElement(".wizard-picks").innerHTML = this.#fields.map((path, index) => {
            const selected = this.#picks.has(index) ? " selected" : "";
            return `<a href="#" class="wizard-pick${selected}" data-action="transform-pick" data-value="${index}">${Utils.escape(path.join("."))}</a>`;
        }).join("");
    }

    /**
     * Keeps the given value of each item, or stops keeping it
     * @param {Number} index
     * @returns {Void}
     */
    togglePick(index) {
        if (this.#picks.has(index)) {
            this.#picks.delete(index);
        } else {
            this.#picks.add(index);
        }
        this.#drawPicks();
        this.#writeQuery();
    }

    /**
     * Writes the query that does what the form asks for
     * @returns {Void}
     */
    #writeQuery() {
        const read = (name) => {
            const element = this.#dialog.getElement(`[name="${name}"]`);
            return element instanceof HTMLSelectElement || element instanceof HTMLInputElement ? element.value : "";
        };

        const wizard = { filter : null, sort : null, pick : [ ...this.#picks ].sort((a, b) => a - b).map((index) => this.#fields[index]) };
        if (read("filterField") !== "") {
            wizard.filter = {
                path  : this.#fields[Number(read("filterField"))],
                sign  : read("filterSign"),
                value : Kinds.parseValue(read("filterValue")),
            };
        }
        if (read("sortField") !== "") {
            wizard.sort = {
                path         : this.#fields[Number(read("sortField"))],
                isDescending : read("sortWay") === "desc",
            };
        }

        this.#query.value = Transform.write(this.#language, wizard) || Transform.getStart(this.#language);
        this.showPreview();
    }

    /**
     * Returns what the query gives. A query that can not be run says why
     * @returns {*}
     */
    getResult() {
        return Transform.run(this.#data, this.#language, this.#query.value);
    }

    /**
     * Shows what the query gives, or what is wrong with it
     * @returns {Boolean}
     */
    showPreview() {
        this.#dialog.hideErrors();
        try {
            const result = this.getResult();
            const lines  = Format.stringify(result, "2").split("\n");
            const rest   = lines.length - MAX_PREVIEW;
            this.#preview.textContent = lines.slice(0, MAX_PREVIEW).join("\n") + (rest > 0 ? `\n… and ${rest} more lines` : "");
            return true;
        } catch (error) {
            this.#preview.textContent = "";
            this.#dialog.showError("query", error.message);
            return false;
        }
    }

    /**
     * Closes the Dialog
     * @returns {Void}
     */
    close() {
        window.clearTimeout(this.#timer);
        this.#dialog.close();
    }
}
