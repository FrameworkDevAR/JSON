import * as App       from "../App.js";
import * as Documents from "./Documents.js";



/**
 * Opens the History, to open one of its documents in the Panel being
 * worked on
 * @returns {Boolean}
 */
export function openHistory() {
    App.historyDialog.open(App.history.list(), App.active.side);
    return true;
}

/**
 * Puts the document of the given entry in the Panel being worked on
 * @param {Number} id
 * @returns {Void}
 */
export function openEntry(id) {
    const entry = App.history.get(id);
    if (!entry) {
        return;
    }
    App.historyDialog.close();
    App.active.load({ name : entry.fileName, text : entry.text }, { docID : id, mode : App.active.mode === "text" ? "tree" : App.active.mode });
}

/**
 * Removes the given entry, and draws the list again without it
 * @param {Number} id
 * @returns {Void}
 */
export function removeEntry(id) {
    App.history.remove(id);
    for (const side of App.SIDES) {
        Documents.drawSaved(App.panels[side]);
    }
    App.historyDialog.render(App.history.list());
}

/**
 * Removes every entry that was not saved
 * @returns {Void}
 */
export function clearRecent() {
    App.history.clearRecent();
    App.historyDialog.render(App.history.list());
    App.toast.show("The recent documents are gone");
}



/**
 * Opens the Dialog to save the document being worked on, or to rename it
 * once it is saved
 * @returns {Boolean}
 */
export function openSave() {
    const entry = App.history.get(App.active.docID);
    if (!entry) {
        App.toast.show("There is nothing to save yet");
        return false;
    }
    App.saver.open(entry);
    return true;
}

/**
 * Saves the document being worked on under the name that was typed
 * @returns {Void}
 */
export function saveEntry() {
    const name = App.saver.getName();
    if (!name || !App.active.docID) {
        return;
    }
    App.history.pin(App.active.docID, name);
    App.saver.close();
    Documents.drawSaved(App.active);
    App.toast.show("The document is saved");
}

/**
 * Lets the document being worked on go back among the recent
 * @returns {Void}
 */
export function forgetEntry() {
    App.history.unpin(App.active.docID);
    App.saver.close();
    Documents.drawSaved(App.active);
    App.toast.show("The document is no longer saved");
}
