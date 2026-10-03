import * as App   from "../App.js";
import * as Edits from "./Edits.js";
import Format     from "../json/Format.js";



/**
 * Saves what the Settings Dialog was left at, and draws the documents
 * again the new way
 * @returns {Void}
 */
export function saveSettings() {
    const data = App.settings.update();
    if (!data) {
        return;
    }

    const indent = App.configs.get("indent");
    App.configs.set(data);
    Edits.drawWrap();

    // The text of a document is only written again when it was written
    // the way the Settings used to ask for, which is not to be undone
    for (const side of App.SIDES) {
        const panel = App.panels[side];
        if (data.indent !== indent && panel.isValid && panel.text === Format.stringify(panel.value, indent)) {
            panel.setText(Format.stringify(panel.value, data.indent));
        } else {
            panel.render();
        }
    }
}

/**
 * Takes the Mode that was last picked, of the three there are
 * @returns {Void}
 */
export function restoreTheme() {
    App.mode.restore(App.storage.getMode());
}

/**
 * Takes the given Mode and keeps it for the next time
 * @param {String} mode
 * @returns {Void}
 */
export function setMode(mode) {
    App.storage.setMode(mode);
    App.mode.restore(mode);
}
