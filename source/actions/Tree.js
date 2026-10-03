import * as App from "../App.js";
import Panel    from "../panel/Panel.js";
import Utils    from "../core/Utils.js";
import Format   from "../json/Format.js";
import Kinds    from "../json/Kinds.js";
import Parse    from "../json/Parse.js";
import Path     from "../json/Path.js";
import Sort     from "../json/Sort.js";



// What a new thing is when it is put in, by what was asked for
const BLANKS = { value : "", object : {}, array : [] };

// What the kinds of value are called in the menu
const TYPES = [
    { text : "Text", value : "string" },
    { text : "Number", value : "number" },
    { text : "Boolean", value : "boolean" },
    { text : "Null", value : "null" },
    { text : "Object", value : "object" },
    { text : "List", value : "array" },
];



/**
 * Returns the path the given Element of a tree or of a table is about
 * @param {HTMLElement} target
 * @returns {?String[]}
 */
function pathOf(target) {
    const element = target.closest("[data-path]");
    return element instanceof HTMLElement ? Path.fromPointer(element.dataset.path) : null;
}

/**
 * Returns the path as it is kept, with the places of a list as numbers
 * @param {Panel}    panel
 * @param {String[]} path
 * @returns {(String|Number)[]}
 */
function toPath(panel, path) {
    const result = [];
    let   value  = panel.value;
    for (const key of path) {
        result.push(Array.isArray(value) ? Number(key) : key);
        value = Path.isContainer(value) ? value[key] : undefined;
    }
    return result;
}

/**
 * Selects the row or the cell that was touched
 * @param {Panel}       panel
 * @param {HTMLElement} target
 * @returns {Void}
 */
export function select(panel, target) {
    const path = pathOf(target);
    if (!path || panel.views[panel.mode].isEditing) {
        return;
    }
    panel.select(toPath(panel, path), false);
    panel.focus();
}

/**
 * Opens or closes the container of the row that was touched
 * @param {Panel}       panel
 * @param {HTMLElement} target
 * @returns {Void}
 */
export function toggle(panel, target) {
    const path = pathOf(target);
    if (path) {
        panel.selection = toPath(panel, path);
        panel.toggle(panel.selection);
        panel.drawFoot();
        panel.focus();
    }
}

/**
 * Shows more of what the container of the row holds
 * @param {Panel}       panel
 * @param {HTMLElement} target
 * @returns {Void}
 */
export function showMore(panel, target) {
    const path = pathOf(target);
    if (path) {
        const pointer = Path.toPointer(path);
        const limit   = panel.limits.get(pointer) || 100;
        panel.limits.set(pointer, limit + 100);
        panel.drawView();
    }
}

/**
 * Lets what was touched twice be typed over: the key or the value of a
 * row, or a cell
 * @param {Panel}       panel
 * @param {HTMLElement} target
 * @returns {Boolean}
 */
export function editAt(panel, target) {
    const pointed = pathOf(target);
    if (!pointed || !panel.isValid) {
        return false;
    }
    const path = toPath(panel, pointed);
    if (panel.mode === "table") {
        return target.closest(".table-cell") ? panel.views.table.edit(path) : false;
    }

    const field = target.closest("[data-edit]");
    if (field instanceof HTMLElement) {
        return panel.views.tree.edit(path, field.dataset.edit);
    }
    return false;
}

/**
 * Goes to the place of the path that was touched: the list the table
 * shows, or the row of the tree
 * @param {Panel}       panel
 * @param {HTMLElement} target
 * @returns {Void}
 */
export function goTo(panel, target) {
    const path = toPath(panel, Path.fromPointer(target.dataset.path || ""));
    if (panel.mode === "text") {
        panel.views.text.reveal(path);
        return;
    }
    if (panel.mode === "table") {
        if (Array.isArray(Path.get(panel.value, path)) || !path.length) {
            panel.tablePath = path;
            panel.tableSort = null;
            panel.limits.delete("table");
            panel.selection = null;
            panel.drawView();
            panel.drawFoot();
            return;
        }
    }
    panel.select(path);
}

/**
 * Shows the place a problem of the schema is at
 * @param {Panel}       panel
 * @param {HTMLElement} target
 * @returns {Void}
 */
export function goToProblem(panel, target) {
    const path = toPath(panel, Path.fromPointer(target.dataset.path || ""));
    if (panel.mode === "text") {
        panel.views.text.reveal(path);
    } else if (panel.mode === "table") {
        panel.setMode("tree");
        panel.select(path);
    } else {
        panel.select(path);
    }
}



/**
 * Opens the menu of the row that was touched, with what can be done to it
 * @param {Panel}       panel
 * @param {HTMLElement} target
 * @param {{x: Number, y: Number}=} place
 * @returns {Void}
 */
export function openMenu(panel, target, place) {
    const pointed = pathOf(target);
    if (!pointed || !panel.isValid) {
        return;
    }
    // The row is drawn again once it is selected, so where the menu opens
    // is asked of it before
    const bounds = target.getBoundingClientRect();
    openMenuAt(panel, toPath(panel, pointed), place || { x : bounds.left, y : bounds.bottom + 4 });
}

/**
 * Opens the menu of what is selected in the tree, or of the whole
 * document when nothing is, under the button that asks for it
 * @param {Panel}       panel
 * @param {HTMLElement} target
 * @returns {Void}
 */
export function openSelectedMenu(panel, target) {
    if (panel.mode !== "tree" || !panel.isValid) {
        return;
    }
    const bounds = target.getBoundingClientRect();
    openMenuAt(panel, panel.selection || [], { x : bounds.left, y : bounds.bottom + 6 });
}

/**
 * Opens the menu of what is at the given path, at the given place
 * @param {Panel}                  panel
 * @param {(String|Number)[]}      path
 * @param {{x: Number, y: Number}} place
 * @returns {Void}
 */
function openMenuAt(panel, path, place) {
    panel.select(path, false);

    const value       = Path.get(panel.value, path);
    const isContainer = Path.isContainer(value);
    const isRoot      = !path.length;
    const parent      = isRoot ? null : Path.get(panel.value, path.slice(0, -1));
    const inserts     = [ { text : "Value", value : "value" }, { text : "Object", value : "object" }, { text : "List", value : "array" } ];

    const items = [];
    if (!isContainer) {
        items.push({ text : "Edit the value", action : "tree-edit-value", keys : "Enter" });
    }
    if (!isRoot && !Array.isArray(parent)) {
        items.push({ text : "Edit the key", action : "tree-edit-key" });
    }
    items.push({ label : "Turn into", chips : TYPES.map((type) => ({ ...type, action : "tree-convert" })) });
    items.push({ line : true });
    if (isContainer) {
        items.push({ label : "Insert inside", chips : inserts.map((one) => ({ ...one, action : "tree-insert-inside" })) });
    }
    if (!isRoot) {
        items.push({ label : "Insert before", chips : inserts.map((one) => ({ ...one, action : "tree-insert-before" })) });
        items.push({ label : "Insert after", chips : inserts.map((one) => ({ ...one, action : "tree-insert-after" })) });
        items.push({ line : true });
        items.push({ text : "Duplicate", action : "tree-duplicate", keys : "⌘D" });
        items.push({ text : "Move up", action : "tree-move", value : -1 });
        items.push({ text : "Move down", action : "tree-move", value : 1 });
    }
    items.push({ line : true });
    items.push({ text : "Copy", action : "tree-copy" });
    items.push({ text : "Copy the path", action : "tree-copy-path" });
    if (!isRoot) {
        items.push({ text : "Cut", action : "tree-cut" });
    }
    items.push({ text : "Paste over it", action : "tree-paste" });
    if (isContainer) {
        items.push({ line : true });
        items.push({ text : "Sort…", action : "open-sort" });
        items.push({ text : "Transform…", action : "open-transform" });
        items.push({ text : "Open all of it", action : "expand-all" });
        items.push({ text : "Close all of it", action : "collapse-all" });
        if (!isRoot) {
            items.push({ text : "Keep only this", action : "tree-extract" });
        }
    }
    if (!isRoot) {
        items.push({ line : true });
        items.push({ text : "Remove", action : "tree-remove", keys : "⌫", isDanger : true });
    }

    App.popup.open(items, place);
}

/**
 * Lets the key or the value of what is selected be typed over
 * @param {Panel}  panel
 * @param {String} field
 * @returns {Boolean}
 */
export function edit(panel, field) {
    if (!panel.selection || !panel.isValid) {
        return false;
    }
    if (panel.mode === "table") {
        return panel.views.table.edit(panel.selection);
    }
    if (panel.mode !== "tree") {
        return false;
    }
    if (field === "value" && Path.isContainer(Path.get(panel.value, panel.selection))) {
        panel.toggle(panel.selection);
        return true;
    }
    return panel.views.tree.edit(panel.selection, field);
}

/**
 * Puts a new thing in, beside what is selected or inside it, and lets it
 * be named or typed right away
 * @param {Panel}  panel
 * @param {String} where
 * @param {String} kind
 * @returns {Boolean}
 */
export function insert(panel, where, kind) {
    const path = panel.selection;
    if (!path || !panel.isValid || (where !== "inside" && !path.length)) {
        return false;
    }

    const parentPath = where === "inside" ? path : path.slice(0, -1);
    const parent     = Path.get(panel.value, parentPath);
    if (!Path.isContainer(parent)) {
        return false;
    }

    const isList = Array.isArray(parent);
    const last   = path[path.length - 1];
    const key    = isList ? "" : Path.freeKey(parent, "key");
    const place  = where === "inside" ? {} : { [where] : last };
    const root   = Path.insert(panel.value, parentPath, place, key, BLANKS[kind]);

    let index = parent.length;
    if (isList && where === "before") {
        index = Number(last);
    } else if (isList && where === "after") {
        index = Number(last) + 1;
    }
    const newPath = [ ...parentPath, isList ? index : key ];

    panel.expanded.add(Path.toPointer(parentPath));
    if (kind !== "value") {
        panel.expanded.add(Path.toPointer(newPath));
    }
    panel.setValue(root, newPath);
    panel.select(newPath);
    panel.views.tree.edit(newPath, isList ? "value" : "key");
    return true;
}

/**
 * Puts a copy of what is selected right after it
 * @param {Panel} panel
 * @returns {Boolean}
 */
export function duplicate(panel) {
    const path = panel.selection;
    if (!path || !path.length || !panel.isValid || panel.mode === "text") {
        return false;
    }

    // In a table what is copied is the row of the cell
    const rowPath    = panel.mode === "table" ? path.slice(0, panel.tablePath.length + 1) : path;
    const parentPath = rowPath.slice(0, -1);
    const parent     = Path.get(panel.value, parentPath);
    const last       = rowPath[rowPath.length - 1];
    const value      = Path.get(panel.value, rowPath);
    const isList     = Array.isArray(parent);
    const key        = isList ? "" : Path.freeKey(parent, `${last}_copy`);

    const root = Path.insert(panel.value, parentPath, { after : last }, key, value);
    panel.setValue(root, [ ...parentPath, isList ? Number(last) + 1 : key ]);
    return true;
}

/**
 * Removes what is selected, and selects what was beside it
 * @param {Panel} panel
 * @returns {Boolean}
 */
export function remove(panel) {
    const path = panel.selection;
    if (!path || !path.length || !panel.isValid || panel.mode === "text") {
        return false;
    }

    const rowPath    = panel.mode === "table" ? path.slice(0, panel.tablePath.length + 1) : path;
    const parentPath = rowPath.slice(0, -1);
    const parent     = Path.get(panel.value, parentPath);
    const keys       = Array.isArray(parent) ? parent.map((item, index) => index) : Object.keys(parent);
    const at         = keys.findIndex((key) => String(key) === String(rowPath[rowPath.length - 1]));
    const root       = Path.remove(panel.value, rowPath);

    // In a list what comes after takes the place, and in an object the
    // one after or the one before is what is left to select
    let next = parentPath;
    if (keys.length > 1 && panel.mode === "tree") {
        if (Array.isArray(parent)) {
            next = [ ...parentPath, Math.min(at, keys.length - 2) ];
        } else {
            next = [ ...parentPath, keys[at + 1] !== undefined ? keys[at + 1] : keys[at - 1] ];
        }
    }
    panel.setValue(root, panel.mode === "tree" ? next : null);
    return true;
}

/**
 * Moves what is selected a place up or down among what is beside it
 * @param {Panel}  panel
 * @param {Number} step
 * @returns {Boolean}
 */
export function move(panel, step) {
    const path = panel.selection;
    if (!path || !path.length || !panel.isValid || panel.mode !== "tree") {
        return false;
    }
    const result = Path.move(panel.value, path, step);
    if (result.root === panel.value) {
        return false;
    }

    // What was open at each of the two places goes along with it
    const from = Path.toPointer(path);
    const to   = Path.toPointer(result.path);
    if (from !== to) {
        const moved = new Set();
        for (const one of [ ...panel.expanded ]) {
            for (const [ source, dest ] of [ [ from, to ], [ to, from ] ]) {
                if (one === source || one.startsWith(`${source}/`)) {
                    panel.expanded.delete(one);
                    moved.add(dest + one.slice(source.length));
                }
            }
        }
        for (const one of moved) {
            panel.expanded.add(one);
        }
    }
    panel.setValue(result.root, result.path);
    panel.views.tree.reveal(result.path);
    return true;
}

/**
 * Turns what is selected into the given kind of value
 * @param {Panel}  panel
 * @param {String} type
 * @returns {Boolean}
 */
export function convert(panel, type) {
    const path = panel.selection;
    if (!path || !panel.isValid) {
        return false;
    }
    const value  = Path.get(panel.value, path);
    const result = Kinds.convert(value, type);
    if (Kinds.typeOf(result) === Kinds.typeOf(value)) {
        return false;
    }
    panel.setValue(Path.set(panel.value, path, result), path);
    return true;
}

/**
 * Keeps only what is selected, as the whole document
 * @param {Panel} panel
 * @returns {Boolean}
 */
export function extract(panel) {
    const path = panel.selection;
    if (!path || !path.length || !panel.isValid) {
        return false;
    }
    const value = Path.get(panel.value, path);
    panel.expanded = new Set([ "" ]);
    panel.setValue(value, []);
    return true;
}



/**
 * Returns what is selected written out as JSON, to be copied
 * @param {Panel} panel
 * @returns {String}
 */
export function getCopy(panel) {
    if (!panel.selection || !panel.isValid || panel.mode === "text") {
        return "";
    }
    return Format.stringify(Path.get(panel.value, panel.selection), App.configs.get("indent"));
}

/**
 * Puts what is selected where the next paste takes it from
 * @param {Panel} panel
 * @returns {Boolean}
 */
export function copy(panel) {
    const text = getCopy(panel);
    if (!text) {
        return false;
    }
    Utils.copy(text).then((isCopied) => {
        App.toast.show(isCopied ? "Copied" : "The browser did not let it be copied");
    });
    return true;
}

/**
 * Puts the path to what is selected where the next paste takes it from
 * @param {Panel} panel
 * @returns {Boolean}
 */
export function copyPath(panel) {
    if (!panel.selection) {
        return false;
    }
    const text = Path.toText(panel.selection, panel.value) || "$";
    Utils.copy(text).then((isCopied) => {
        App.toast.show(isCopied ? `Copied ${Utils.escape(text)}` : "The browser did not let it be copied");
    });
    return true;
}

/**
 * Puts the given text over what is selected: as the JSON it is when it
 * reads as one, and as a text otherwise
 * @param {Panel}  panel
 * @param {String} text
 * @returns {Boolean}
 */
export function pasteText(panel, text) {
    if (!panel.selection || !panel.isValid || panel.mode === "text" || !text) {
        return false;
    }
    const parsed = Parse.parse(text);
    const value  = parsed.value !== undefined ? parsed.value : text;
    panel.setValue(Path.set(panel.value, panel.selection, value), panel.selection);
    return true;
}

/**
 * Pastes over what is selected what the browser has to paste, when it
 * lets it be read
 * @param {Panel} panel
 * @returns {Boolean}
 */
export function paste(panel) {
    navigator.clipboard.readText().then((text) => {
        pasteText(panel, text);
    }).catch(() => {
        App.toast.show("The browser did not let it be pasted, use the keys instead");
    });
    return true;
}

/**
 * Moves the selection of the tree with the arrows: up and down through
 * the rows, left to close a container or go to the one that holds it,
 * and right to open one
 * @param {Panel}  panel
 * @param {String} key
 * @returns {Boolean}
 */
export function moveSelection(panel, key) {
    if (panel.mode !== "tree" || !panel.isValid) {
        return false;
    }
    const rows    = panel.views.tree.rows;
    const current = panel.selection ? Path.toPointer(panel.selection) : null;
    const at      = current === null ? -1 : rows.indexOf(current);

    if (key === "arrowdown" || key === "arrowup") {
        const next = key === "arrowdown" ? Math.min(at + 1, rows.length - 1) : Math.max(at - 1, 0);
        if (rows[next] === undefined) {
            return false;
        }
        panel.select(toPath(panel, Path.fromPointer(rows[next])));
        return true;
    }
    if (!panel.selection) {
        return false;
    }

    const isContainer = Path.isContainer(Path.get(panel.value, panel.selection));
    const isOpen      = panel.expanded.has(current);
    if (key === "arrowright") {
        if (isContainer && !isOpen) {
            panel.toggle(panel.selection);
        }
        return true;
    }
    if (isContainer && isOpen) {
        panel.toggle(panel.selection);
    } else if (panel.selection.length) {
        panel.select(panel.selection.slice(0, -1));
    }
    return true;
}



/**
 * Puts the list of the table in order by the column that was touched,
 * and the other way around when it is touched again
 * @param {Panel}       panel
 * @param {HTMLElement} target
 * @returns {Void}
 */
export function sortColumn(panel, target) {
    const pointer = target.dataset.column || "";
    const items   = panel.views.table.items;
    if (!items) {
        return;
    }
    const isDescending = Boolean(panel.tableSort && panel.tableSort.pointer === pointer && !panel.tableSort.isDescending);
    const sorted       = Sort.sortItems(items, Path.fromPointer(pointer), isDescending);

    panel.tableSort = { pointer, isDescending };
    panel.setValue(Path.set(panel.value, panel.tablePath, sorted), null);
}

/**
 * Shows the list that was picked as the table
 * @param {Panel}       panel
 * @param {HTMLElement} target
 * @returns {Void}
 */
export function openList(panel, target) {
    panel.tablePath = toPath(panel, Path.fromPointer(target.dataset.path || ""));
    panel.tableSort = null;
    panel.selection = null;
    panel.limits.delete("table");
    panel.drawView();
}

/**
 * Opens the menu of the row of the table that was touched
 * @param {Panel}       panel
 * @param {HTMLElement} target
 * @returns {Void}
 */
export function openRowMenu(panel, target) {
    const path = pathOf(target);
    if (!path) {
        return;
    }
    panel.selection = toPath(panel, path);
    panel.drawPath();
    App.popup.openUnder([
        { text : "Insert a row above", action : "table-insert", value : "before" },
        { text : "Insert a row below", action : "table-insert", value : "after" },
        { text : "Duplicate the row", action : "tree-duplicate" },
        { line : true },
        { text : "Copy the row", action : "tree-copy" },
        { text : "Show it in the tree", action : "table-to-tree" },
        { line : true },
        { text : "Remove the row", action : "tree-remove", isDanger : true },
    ], target);
}

/**
 * Puts a new row in the table, beside the one that is selected or at the
 * end. It has what the row beside it has, with nothing in each
 * @param {Panel}  panel
 * @param {String} where
 * @returns {Boolean}
 */
export function insertRow(panel, where) {
    const items = panel.views.table.items;
    if (!items) {
        return false;
    }
    const depth = panel.tablePath.length;
    const index = panel.selection && panel.selection.length > depth ? Number(panel.selection[depth]) : items.length - 1;
    const model = items[index];
    const blank = Path.isContainer(model) && !Array.isArray(model)
        ? Object.fromEntries(Object.keys(model).map((key) => [ key, null ]))
        : null;

    const place = !items.length ? {} : { [where === "before" ? "before" : "after"] : index };
    const at    = !items.length ? 0 : (where === "before" ? index : index + 1);
    panel.setValue(Path.insert(panel.value, panel.tablePath, place, "", blank), [ ...panel.tablePath, at ]);
    panel.views.table.reveal([ ...panel.tablePath, at ]);
    return true;
}

/**
 * Shows what is selected in the table as a row of the tree
 * @param {Panel} panel
 * @returns {Boolean}
 */
export function showInTree(panel) {
    const path = panel.selection;
    if (!panel.setMode("tree")) {
        return false;
    }
    if (path) {
        panel.select(path);
    }
    return true;
}
