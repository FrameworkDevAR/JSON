import * as App     from "../App.js";
import * as Edits   from "./Edits.js";
import * as Tree    from "./Tree.js";
import * as Search  from "./Search.js";
import * as Compare from "./Compare.js";
import * as History from "./History.js";



// What the keys held with another are called, which is not the same everywhere
const IS_MAC    = navigator.platform.startsWith("Mac");
const MOD_KEY   = IS_MAC ? "⌘" : "Ctrl";
const SHIFT_KEY = IS_MAC ? "⇧" : "Shift";

// Every key the app answers to, said once: the handler reads it, the Settings
// list it, and the tooltip of a button says which key does the same. A name
// of "Mod" is the key that is held, whichever this machine calls it. A key
// that is "onTree" only works while a row of the tree or a cell of the table
// is what the keys go to
const SHORTCUTS = [
    {
        names  : [ "Esc" ],
        keys   : [ "escape" ],
        always : true,
        text   : "<b>Close</b> a menu, a dialog or the search, or <b>leave</b> the field being typed in",
        run    : closeSomething,
    },
    {
        names   : [ "Mod", "Z" ],
        keys    : [ "z" ],
        withKey : true,
        inField : false,
        action  : "undo",
        text    : "<b>Undo</b> the last change of the document",
        run     : () => Edits.undo(App.active),
    },
    {
        names     : [ "Mod", "Shift", "Z" ],
        keys      : [ "z" ],
        withKey   : true,
        withShift : true,
        inField   : false,
        action    : "redo",
        text      : "<b>Redo</b> the change that was undone",
        run       : () => Edits.redo(App.active),
    },
    {
        names   : [ "Mod", "Enter" ],
        keys    : [ "enter" ],
        withKey : true,
        action  : "format",
        text    : "<b>Format</b> the document, a line for each thing it holds",
        run     : () => Edits.format(App.active),
    },
    {
        names   : [ "Mod", "J" ],
        keys    : [ "j" ],
        withKey : true,
        action  : "smart-format",
        text    : "<b>Smart format</b> the document, keeping what fits in a line in one",
        run     : () => Edits.smartFormat(App.active),
    },
    {
        names     : [ "Mod", "Shift", "Enter" ],
        keys      : [ "enter" ],
        withKey   : true,
        withShift : true,
        action    : "compact",
        text      : "<b>Compact</b> the document into the one line",
        run       : () => Edits.compact(App.active),
    },
    {
        names   : [ "Mod", "F" ],
        keys    : [ "f" ],
        withKey : true,
        action  : "toggle-search",
        text    : "<b>Search</b> in the document, and replace what is found",
        run     : () => Search.toggle(App.active),
    },
    {
        names   : [ "Mod", "S" ],
        keys    : [ "s" ],
        withKey : true,
        text    : "<b>Save</b> the document in the history, with a name",
        run     : History.openSave,
    },
    {
        names   : [ "Mod", "O" ],
        keys    : [ "o" ],
        withKey : true,
        action  : "open-history",
        text    : "Open the <b>history</b> of the documents",
        run     : History.openHistory,
    },
    {
        names   : [ "Mod", "↓" ],
        keys    : [ "arrowdown" ],
        withKey : true,
        action  : "next-difference",
        text    : "Walk to the <b>next difference</b>, while comparing",
        run     : () => Compare.walk(1),
    },
    {
        names   : [ "Mod", "↑" ],
        keys    : [ "arrowup" ],
        withKey : true,
        action  : "prev-difference",
        text    : "Walk to the <b>difference before</b>, while comparing",
        run     : () => Compare.walk(-1),
    },
    {
        names : [ "1" ],
        keys  : [ "1" ],
        text  : "Show the document as <b>text</b>",
        run   : () => Edits.setMode(App.active, "text"),
    },
    {
        names : [ "2" ],
        keys  : [ "2" ],
        text  : "Show the document as a <b>tree</b>",
        run   : () => Edits.setMode(App.active, "tree"),
    },
    {
        names : [ "3" ],
        keys  : [ "3" ],
        text  : "Show the document as a <b>table</b>",
        run   : () => Edits.setMode(App.active, "table"),
    },
    {
        names  : [ "T" ],
        keys   : [ "t" ],
        action : "open-transform",
        text   : "<b>Transform</b> the document with a query",
        run    : () => Edits.openTransform(App.active),
    },
    {
        names  : [ "W" ],
        keys   : [ "w" ],
        action : "toggle-wrap",
        text   : "<b>Wrap</b> the long lines of the text, or let them run",
        run    : Edits.toggleWrap,
    },
    {
        names  : [ "C" ],
        keys   : [ "c" ],
        action : "toggle-compare",
        text   : "<b>Compare</b> the two documents, or stop comparing them",
        run    : Compare.toggleComparing,
    },
    {
        names  : [ "↑", "↓" ],
        keys   : [ "arrowup", "arrowdown" ],
        onTree : true,
        text   : "Move through the rows of the <b>tree</b>",
        run    : (e) => Tree.moveSelection(App.active, e.key.toLowerCase()),
    },
    {
        names  : [ "←", "→" ],
        keys   : [ "arrowleft", "arrowright" ],
        onTree : true,
        text   : "<b>Close</b> or <b>open</b> the row of the tree",
        run    : (e) => Tree.moveSelection(App.active, e.key.toLowerCase()),
    },
    {
        names  : [ "Enter" ],
        keys   : [ "enter" ],
        onTree : true,
        text   : "<b>Edit the value</b> that is selected",
        run    : () => Tree.edit(App.active, "value"),
    },
    {
        names     : [ "Shift", "Enter" ],
        keys      : [ "enter" ],
        withShift : true,
        onTree    : true,
        text      : "<b>Edit the key</b> that is selected",
        run       : () => Tree.edit(App.active, "key"),
    },
    {
        names   : [ "Mod", "D" ],
        keys    : [ "d" ],
        withKey : true,
        onTree  : true,
        text    : "<b>Duplicate</b> what is selected",
        run     : () => Tree.duplicate(App.active),
    },
    {
        names  : [ "⌫" ],
        keys   : [ "backspace", "delete" ],
        onTree : true,
        text   : "<b>Remove</b> what is selected",
        run    : () => Tree.remove(App.active),
    },
    {
        names   : [ "Mod", "," ],
        keys    : [ "," ],
        withKey : true,
        action  : "open-settings",
        text    : "Open the <b>Settings</b>",
        run     : () => App.settings.open(),
    },
    {
        names    : [ "?" ],
        keys     : [ "?" ],
        anyShift : true,
        text     : "Show this list of <b>shortcuts</b>",
        run      : () => App.settings.open("keys"),
    },
];



/**
 * Does what the given key asks of the app, and says whether it asked for
 * anything: a key that is not bound is left to the browser
 * @param {KeyboardEvent} event
 * @returns {Boolean}
 */
export function handleKey(event) {
    if (event.altKey) {
        return false;
    }

    // A key held is part of what is pressed, so one that asks for it is not
    // the same shortcut as the letter on its own
    const withKey  = event.ctrlKey || event.metaKey;
    const key      = event.key.toLowerCase();
    const onTree   = isOnTree();
    const shortcut = SHORTCUTS.find((one) => one.keys.includes(key) &&
        Boolean(one.withKey) === withKey &&
        (one.anyShift || Boolean(one.withShift) === event.shiftKey) &&
        (!one.onTree || onTree));
    if (!shortcut) {
        return false;
    }

    // A Dialog is a question, and the app is not listening until it is
    // answered or taken away. What is typed belongs to the field it is typed
    // in, unless a key is held, which is what tells a command from a letter.
    // A field that undoes its own typing is left to do it, but for the text
    // of the document, which the app undoes along with everything else
    if (!shortcut.always) {
        if (getOpenDialog()) {
            return false;
        }
        if (!withKey && isTyping()) {
            return false;
        }
        if (shortcut.inField === false && isTyping() && !isDocument()) {
            return false;
        }
    }
    return shortcut.run(event) !== false;
}

/**
 * Says which key does the same as a button, on the button itself
 * @returns {Void}
 */
export function showKeys() {
    for (const shortcut of SHORTCUTS) {
        if (!shortcut.action) {
            continue;
        }
        const name = getNames(shortcut).join(" ");
        for (const element of document.querySelectorAll(`[data-action="${shortcut.action}"][data-tip]`)) {
            if (element instanceof HTMLElement) {
                element.dataset.keys = name;
            }
        }
    }
}

/**
 * Returns every shortcut there is, to be listed
 * @returns {Object[]}
 */
export function getShortcuts() {
    return SHORTCUTS.map((shortcut) => ({ names : getNames(shortcut), text : shortcut.text }));
}

/**
 * Returns the keys of the given Shortcut as this machine calls them
 * @param {Object} shortcut
 * @returns {String[]}
 */
function getNames(shortcut) {
    return shortcut.names.map((name) => {
        switch (name) {
        case "Mod":
            return MOD_KEY;
        case "Shift":
            return SHIFT_KEY;
        default:
            return name;
        }
    });
}

/**
 * Closes whatever is open, from the top: the menu, a Dialog that can be
 * closed, the search, and then the field that is being typed in
 * @returns {Boolean}
 */
function closeSomething() {
    if (App.popup.isOpen) {
        App.popup.close();
        return true;
    }

    // A Dialog is closed the way its own button closes it
    const dialog = getOpenDialog();
    if (dialog) {
        const close = dialog.querySelector("[data-action^='close-']");
        if (close instanceof HTMLElement) {
            close.click();
            return true;
        }
        return false;
    }

    if (App.active.search.isOpen) {
        Search.close(App.active);
        return true;
    }
    if (isTyping() && !isDocument() && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
        return true;
    }
    return false;
}

/**
 * Returns the Dialog that is open, if any is
 * @returns {?HTMLElement}
 */
function getOpenDialog() {
    for (const element of document.querySelectorAll("[data-dialog]")) {
        // One on its way out is already answered, and a second Escape belongs
        // to whatever is behind it
        if (element instanceof HTMLElement && !element.classList.contains("closing") &&
            getComputedStyle(element).display !== "none"
        ) {
            return element;
        }
    }
    return null;
}

/**
 * Returns true if what is typed belongs to a field rather than to the app
 * @returns {Boolean}
 */
function isTyping() {
    const element = document.activeElement;
    return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ||
        element instanceof HTMLSelectElement;
}

/**
 * Returns true if the field being typed in is the text of a document
 * @returns {Boolean}
 */
function isDocument() {
    const element = document.activeElement;
    return element instanceof HTMLTextAreaElement && Boolean(element.closest(".text-view"));
}

/**
 * Returns true if the keys go to a tree or to a table with something
 * selected in it, which is when the keys of the rows are listened to
 * @returns {Boolean}
 */
function isOnTree() {
    const element = document.activeElement;
    return element instanceof HTMLElement && element.matches(".tree-view, .table-view") &&
        Boolean(App.active.selection || App.active.mode === "tree");
}

