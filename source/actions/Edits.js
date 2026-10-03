import * as App       from "../App.js";
import * as Documents from "./Documents.js";
import Panel          from "../panel/Panel.js";
import Format         from "../json/Format.js";
import Path           from "../json/Path.js";
import repairText     from "../json/Repair.js";
import Sort           from "../json/Sort.js";



// Where the sort and the query that are being asked for will be applied,
// and the values the items of the list being sorted can be sorted by
let target = { panel : null, path : [] };
let fields = [];



/**
 * Says the document has to be JSON for what was asked, and returns
 * whether it is
 * @param {Panel} panel
 * @returns {Boolean}
 */
function requireValid(panel) {
    if (panel.isEmpty) {
        App.toast.show("There is no document yet");
        return false;
    }
    if (!panel.isValid) {
        App.toast.show("The text is not valid JSON, repair it first");
        return false;
    }
    return true;
}

/**
 * Returns the place in the document that what is asked applies to: the
 * container that is selected, the one that holds what is selected, or the
 * whole document
 * @param {Panel} panel
 * @returns {(String|Number)[]}
 */
function getPlace(panel) {
    if (panel.mode === "table") {
        return panel.tablePath;
    }
    if (panel.mode !== "tree" || !panel.selection) {
        return [];
    }
    return Path.isContainer(Path.get(panel.value, panel.selection)) ? panel.selection : panel.selection.slice(0, -1);
}

/**
 * Says where a place of the document is, in words
 * @param {Panel}             panel
 * @param {(String|Number)[]} path
 * @returns {String}
 */
function describe(panel, path) {
    return path.length ? Path.toText(path, panel.value) : "the whole document";
}



/**
 * Writes the document out again, a line for each thing it holds
 * @param {Panel} panel
 * @returns {Boolean}
 */
export function format(panel) {
    if (!requireValid(panel)) {
        return false;
    }
    panel.setText(Format.stringify(panel.value, App.configs.get("indent")));
    return true;
}

/**
 * Writes the document out again the way a person would, with what fits in
 * a line left in the one line
 * @param {Panel} panel
 * @returns {Boolean}
 */
export function smartFormat(panel) {
    if (!requireValid(panel)) {
        return false;
    }
    panel.setText(Format.smart(panel.value, App.configs.get("indent")));
    return true;
}

/**
 * Writes the document out again in the one line
 * @param {Panel} panel
 * @returns {Boolean}
 */
export function compact(panel) {
    if (!requireValid(panel)) {
        return false;
    }
    panel.setText(Format.compact(panel.value));
    if (panel.mode !== "text") {
        App.toast.show("The document is compact, as its text shows");
    }
    return true;
}

/**
 * Mends a text that is almost JSON
 * @param {Panel} panel
 * @returns {Boolean}
 */
export function repair(panel) {
    if (panel.isEmpty) {
        App.toast.show("There is no document yet");
        return false;
    }
    if (panel.isValid) {
        App.toast.show("The JSON is already valid");
        return false;
    }

    try {
        panel.setValue(repairText(panel.text));
        App.toast.show("The JSON was repaired");
        return true;
    } catch (error) {
        App.toast.show(error.message);
        return false;
    }
}

/**
 * Takes the last step back
 * @param {Panel} panel
 * @returns {Boolean}
 */
export function undo(panel) {
    if (!panel.undo()) {
        App.toast.show("There is nothing to undo");
    }
    return true;
}

/**
 * Takes again the last step that was taken back
 * @param {Panel} panel
 * @returns {Boolean}
 */
export function redo(panel) {
    if (!panel.redo()) {
        App.toast.show("There is nothing to redo");
    }
    return true;
}

/**
 * Shows the place where the text stops being JSON
 * @param {Panel} panel
 * @returns {Boolean}
 */
export function showError(panel) {
    if (!panel.error) {
        return false;
    }
    panel.views.text.select(panel.error.position, panel.error.position);
    return true;
}

/**
 * Shows the document of the Panel the given way
 * @param {Panel}  panel
 * @param {String} mode
 * @returns {Boolean}
 */
export function setMode(panel, mode) {
    if (panel.mode === mode) {
        return true;
    }
    return panel.setMode(mode);
}

/**
 * Opens everything: every row of the tree, or the ones under what is
 * selected, and everything that is folded in the text
 * @param {Panel} panel
 * @returns {Boolean}
 */
export function expandAll(panel) {
    if (panel.mode === "text") {
        return panel.views.text.unfoldAll();
    }
    if (panel.mode !== "tree" || !panel.isValid) {
        return false;
    }
    panel.expandAll(panel.selection || []);
    return true;
}

/**
 * Closes everything: every row of the tree, or the ones under what is
 * selected, and everything that can be folded in the text
 * @param {Panel} panel
 * @returns {Boolean}
 */
export function collapseAll(panel) {
    if (panel.mode === "text") {
        return panel.views.text.foldAll();
    }
    if (panel.mode !== "tree" || !panel.isValid) {
        return false;
    }
    panel.collapseAll(panel.selection || []);
    return true;
}

/**
 * Wraps the long lines of the text, or lets them run
 * @returns {Boolean}
 */
export function toggleWrap() {
    App.configs.set({ wrapText : !App.configs.get("wrapText") });
    drawWrap();
    for (const side of App.SIDES) {
        if (App.panels[side].mode === "text") {
            App.panels[side].drawView();
        }
    }
    return true;
}

/**
 * Says on the page whether the long lines are wrapped
 * @returns {Void}
 */
export function drawWrap() {
    document.body.classList.toggle("wrap-text", Boolean(App.configs.get("wrapText")));
}



/**
 * Opens the menu that puts a list or an object in order: the keys of an
 * object one way or the other, and the items of a list by themselves or
 * by any of the values they have
 * @param {Panel}       panel
 * @param {HTMLElement} element
 * @returns {Boolean}
 */
export function openSort(panel, element) {
    if (!requireValid(panel)) {
        return false;
    }
    const path  = getPlace(panel);
    const value = Path.get(panel.value, path);
    if (!Path.isContainer(value)) {
        App.toast.show("Only a list or an object can be put in order");
        return false;
    }

    const ways  = (by) => [
        { text : "A → Z", action : "apply-sort", value : `asc:${by}` },
        { text : "Z → A", action : "apply-sort", value : `desc:${by}` },
    ];
    const items = [];
    target = { panel, path };
    fields = Array.isArray(value) ? Sort.getFields(value) : [];

    if (!Array.isArray(value)) {
        items.push({ label : "The keys", chips : ways("") });
    } else if (!fields.length) {
        items.push({ label : "The items", chips : ways("") });
    } else {
        for (const [ index, field ] of fields.entries()) {
            items.push({ label : field.join("."), chips : ways(String(index)) });
        }
    }
    App.setActive(panel);
    App.popup.openUnder(items, element);
    return true;
}

/**
 * Puts the list or the object in the order that was picked, which comes
 * as the way and the value to sort by
 * @param {String} choice
 * @returns {Void}
 */
export function applySort(choice) {
    const { panel, path } = target;
    const [ way, by ]     = choice.split(":");
    const value           = Path.get(panel.value, path);
    const isDescending    = way === "desc";
    if (!Path.isContainer(value)) {
        return;
    }

    panel.setValue(Path.set(panel.value, path, Array.isArray(value)
        ? Sort.sortItems(value, by === "" ? [] : fields[Number(by)] || [], isDescending)
        : Sort.sortKeys(value, isDescending)));
}

/**
 * Opens the Dialog that asks the document a query
 * @param {Panel} panel
 * @returns {Boolean}
 */
export function openTransform(panel) {
    if (!requireValid(panel)) {
        return false;
    }
    const path = getPlace(panel);
    target = { panel, path };
    App.transformer.open(Path.get(panel.value, path), describe(panel, path), App.storage.getLanguage());
    return true;
}

/**
 * Takes the language the query is written in
 * @param {String} language
 * @returns {Void}
 */
export function setLanguage(language) {
    App.storage.setLanguage(language);
    App.transformer.setLanguage(language);
}

/**
 * Puts what the query gives where what it was asked was, or in the other
 * Panel when that is what the Dialog asks for
 * @returns {Void}
 */
export function applyTransform() {
    if (!App.transformer.showPreview()) {
        return;
    }
    const { panel, path } = target;
    const result  = App.transformer.getResult();
    const toOther = App.transformer.toOther;

    App.transformer.close();
    if (toOther) {
        const other = App.otherOf(panel);
        Documents.setOnly("");
        other.load({ name : "", text : Format.stringify(result, App.configs.get("indent")) }, { mode : panel.mode });
        App.setActive(other);
        return;
    }
    panel.setValue(Path.set(panel.value, path, result), path);
}



/**
 * Opens the Dialog that asks for the schema the document is checked with
 * @param {Panel} panel
 * @returns {Boolean}
 */
export function openSchema(panel) {
    target = { panel, path : [] };
    App.schemer.open(panel.schemaText);
    return true;
}

/**
 * Takes the schema that was typed, and checks the document with it. An
 * empty one stops the checking
 * @returns {Void}
 */
export function saveSchema() {
    const { panel } = target;
    const text      = App.schemer.getText();
    if (!panel.setSchema(text)) {
        App.schemer.showError("The schema has to be valid JSON, with an object at the top");
        return;
    }

    App.storage.setSchema(panel.side, text);
    App.schemer.close();
    panel.element.classList.toggle("has-schema", Boolean(text));
    panel.render();
    if (!text) {
        App.toast.show("The document is no longer checked with a schema");
    } else if (panel.problems.length) {
        App.toast.show(panel.problems.length === 1 ? "The schema found 1 problem" : `The schema found ${panel.problems.length} problems`);
    } else {
        App.toast.show("The document is what the schema asks for");
    }
}
