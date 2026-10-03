import Dialog  from "./Dialog.js";
import History from "../core/History.js";
import Utils   from "../core/Utils.js";



/**
 * The History Dialog, which lists the documents that were worked on
 */
export default class HistoryDialog {

    /** @type {Dialog} */
    #dialog;


    /**
     * History Dialog constructor
     */
    constructor() {
        this.#dialog = new Dialog("history");
    }

    /**
     * Returns true if the Dialog is open
     * @returns {Boolean}
     */
    get isOpen() {
        return this.#dialog.isOpen;
    }

    /**
     * Opens the Dialog with the given entries, saying which side one that
     * is picked opens in
     * @param {{pinned: Object[], recent: Object[]}} entries
     * @param {String}                               side
     * @returns {Void}
     */
    open(entries, side) {
        this.#dialog.getElement(".history-side").textContent = side;
        this.render(entries);
        this.#dialog.open();
    }

    /**
     * Draws the given entries, the saved ones apart from the recent
     * @param {{pinned: Object[], recent: Object[]}} entries
     * @returns {Void}
     */
    render(entries) {
        const isEmpty = !entries.pinned.length && !entries.recent.length;
        this.#dialog.getElement(".history-empty").style.display = isEmpty ? "block" : "none";
        this.#dialog.getElement(".history-where").style.display = isEmpty ? "none" : "";
        this.#dialog.getElement("[data-action='clear-recent']").style.display = entries.recent.length ? "" : "none";

        for (const [ section, list ] of Object.entries(entries)) {
            const element = this.#dialog.getElement(`[data-section="${section}"]`);
            element.style.display = list.length ? "" : "none";
            element.querySelector("ol").innerHTML = list.map(renderEntry).join("");
        }
    }

    /**
     * Closes the Dialog
     * @returns {Void}
     */
    close() {
        this.#dialog.close();
    }
}



/**
 * Draws an entry as a row of the list
 * @param {Object} entry
 * @returns {String}
 */
function renderEntry(entry) {
    const what = `<span>${Utils.escape(entry.kind)}</span><i></i><span>${Utils.escape(entry.size)}</span>`;
    const name = History.nameOf(entry);

    // A document with no name is told by what it holds, which stands as
    // its name, with how it starts beside it
    const start = Utils.escape(entry.text.replace(/\s+/g, " ").slice(0, 60));
    const title = name
        ? `<div class="history-name">${Utils.escape(name)}</div>`
        : `<div class="history-name"><code>${start}</code></div>`;

    return `<li data-action="open-entry" data-entry="${entry.id}">` +
        `<div class="history-text">${title}` +
        `<div class="history-meta">${what}<i></i><span>${formatTime(entry.time)}</span></div></div>` +
        `<a href="#" class="close" data-action="remove-entry" data-entry="${entry.id}" data-tip="Remove it from the history" data-tip-top aria-label="Remove it from the history"></a>` +
        "</li>";
}

/**
 * Says when the entry was last worked on, as the day when it was not today
 * @param {Number} time
 * @returns {String}
 */
function formatTime(time) {
    const date  = new Date(time);
    const now   = new Date();
    const clock = date.toLocaleTimeString([], { hour : "2-digit", minute : "2-digit" });

    if (date.toDateString() === now.toDateString()) {
        return `Today at ${clock}`;
    }
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
        return `Yesterday at ${clock}`;
    }
    const options = date.getFullYear() === now.getFullYear()
        ? { day : "numeric", month : "short" }
        : { day : "numeric", month : "short", year : "numeric" };
    // @ts-ignore
    return date.toLocaleDateString([], options);
}
