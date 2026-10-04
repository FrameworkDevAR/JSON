import Settings      from "./dialogs/Settings.js";
import HistoryDialog from "./dialogs/History.js";
import Saver         from "./dialogs/Saver.js";
import Texter        from "./dialogs/Texter.js";
import Transformer   from "./dialogs/Transform.js";
import * as Keys     from "./actions/Keys.js";
import Panel         from "./panel/Panel.js";
import Split         from "./panel/Split.js";
import Header        from "./panel/Header.js";
import Storage       from "./core/Storage.js";
import History       from "./core/History.js";
import Configs       from "./core/Configs.js";
import Mode          from "./core/Mode.js";
import Toast         from "./core/Toast.js";
import Tooltip       from "./core/Tooltip.js";
import Popup         from "./core/Popup.js";
import Apps          from "./core/Apps.js";



// The sides a document can be on
export const SIDES = [ "left", "right" ];

// The one of each the app is made of, which every action reaches for
export const storage       = new Storage();
export const history       = new History(storage);
export const configs       = new Configs(storage);
export const mode          = new Mode();
export const toast         = new Toast();
export const tooltip       = new Tooltip();
export const popup         = new Popup();
export const apps          = new Apps("json", ".header-logo");
export const settings      = new Settings(configs, Keys.getShortcuts());
export const historyDialog = new HistoryDialog();
export const saver         = new Saver();
export const transformer   = new Transformer();
export const opener        = new Texter("open");
export const schemer       = new Texter("schema");
export const header        = new Header();

// The two Panels, each with the document of its side
export const panels = {
    left  : new Panel("left", configs, toast),
    right : new Panel("right", configs, toast),
};

// The strip between them, which gives one more of the page than the other
export const split = new Split(storage);

// The Panel that was last touched, which is the one the keys and the
// dialogs work on. It is exported as a binding rather than a value, so
// whoever imports it sees the new one
/** @type {Panel} */
export let active = panels.left;



/**
 * Takes the given Panel as the one being worked on
 * @param {Panel} panel
 * @returns {Void}
 */
export function setActive(panel) {
    active = panel;
    for (const side of SIDES) {
        panels[side].element.classList.toggle("active", panels[side] === panel);
    }
}

/**
 * Lets go of the Panels: neither is marked as the one being worked on,
 * and whatever of them had the keys gives them up. The one that was last
 * worked on is still the one the keys and the dialogs go to
 * @returns {Void}
 */
export function clearActive() {
    for (const side of SIDES) {
        panels[side].element.classList.remove("active");
    }
    const element = document.activeElement;
    if (element instanceof HTMLElement && element.closest(".panel")) {
        element.blur();
    }
}

/**
 * Returns the Panel the given Element is in, or the one being worked on
 * when it is in none
 * @param {*} target
 * @returns {Panel}
 */
export function panelOf(target) {
    const element = target instanceof Element ? target.closest(".panel") : null;
    if (element instanceof HTMLElement && panels[element.dataset.side]) {
        return panels[element.dataset.side];
    }
    return active;
}

/**
 * Returns the Panel beside the given one
 * @param {Panel} panel
 * @returns {Panel}
 */
export function otherOf(panel) {
    return panel === panels.left ? panels.right : panels.left;
}
