import * as App from "../App.js";
import Panel    from "../panel/Panel.js";
import Kinds    from "../json/Kinds.js";
import Path     from "../json/Path.js";
import Finder   from "../json/Search.js";



/**
 * Returns the fields of the search of a Panel
 * @param {Panel} panel
 * @returns {{find: HTMLInputElement, replace: HTMLInputElement, count: HTMLElement}}
 */
function getFields(panel) {
    return {
        // @ts-ignore
        find    : panel.getElement(".search-find"),
        // @ts-ignore
        replace : panel.getElement(".search-replace"),
        count   : panel.getElement(".search-count"),
    };
}

/**
 * Opens the search of the Panel, or closes it. It opens looking for what
 * is selected in the text, when something is
 * @param {Panel} panel
 * @returns {Boolean}
 */
export function toggle(panel) {
    const { find } = getFields(panel);
    const isOpen   = !panel.search.isOpen || document.activeElement !== find;

    panel.search.isOpen = isOpen;
    panel.element.classList.toggle("is-searching", isOpen);
    if (!isOpen) {
        panel.search.matches = [];
        panel.search.index   = -1;
        panel.drawView();
        panel.focus();
        return true;
    }

    const selected = panel.mode === "text" ? panel.views.text.selected : "";
    if (selected && !selected.includes("\n")) {
        find.value = selected;
    }
    find.focus();
    find.select();
    run(panel);
    return true;
}

/**
 * Closes the search of the Panel
 * @param {Panel} panel
 * @returns {Void}
 */
export function close(panel) {
    if (panel.search.isOpen) {
        panel.search.isOpen  = false;
        panel.search.matches = [];
        panel.search.index   = -1;
        panel.element.classList.remove("is-searching");
        panel.drawView();
        panel.focus();
    }
}

/**
 * Looks for what was typed in the document of the Panel, and shows the
 * first place it is found
 * @param {Panel} panel
 * @returns {Void}
 */
export function run(panel) {
    find(panel);
    panel.search.index = panel.search.matches.length ? 0 : -1;
    show(panel, false);
}

/**
 * Looks again for what is being searched after the document changed,
 * staying at the place that was being looked at
 * @param {Panel} panel
 * @returns {Void}
 */
export function refresh(panel) {
    if (!panel.search.isOpen) {
        return;
    }
    const { index } = panel.search;
    find(panel);
    panel.search.index = Math.min(index, panel.search.matches.length - 1);
    drawCount(panel);
}

/**
 * Finds every place the text that was typed is in the document: in the
 * text when it is shown as one, and in the keys and the values otherwise
 * @param {Panel} panel
 * @returns {Void}
 */
function find(panel) {
    const needle = getFields(panel).find.value;
    panel.search.text    = needle;
    panel.search.matches = [];
    if (!needle) {
        return;
    }

    if (panel.mode === "text") {
        const text  = panel.text.toLowerCase();
        const lower = needle.toLowerCase();
        for (let at = text.indexOf(lower); at !== -1 && panel.search.matches.length < 2000; at = text.indexOf(lower, at + lower.length)) {
            panel.search.matches.push({ start : at, end : at + lower.length });
        }
        return;
    }

    // The table only shows its list, so only what is in it is found
    const prefix = Path.toPointer(panel.tablePath);
    panel.search.matches = Finder.find(panel.value, needle).filter((match) => (
        panel.mode !== "table" || (match.field === "value" && Path.toPointer(match.path).startsWith(`${prefix}/`))
    ));
}

/**
 * Says which place is being looked at, of how many were found
 * @param {Panel} panel
 * @returns {Void}
 */
function drawCount(panel) {
    const { matches, index, text } = panel.search;
    const { count } = getFields(panel);
    count.textContent = text ? `${index + 1}/${matches.length}` : "";
    count.classList.toggle("is-none", Boolean(text) && !matches.length);
}

/**
 * Shows the place being looked at
 * @param {Panel}    panel
 * @param {Boolean=} withFocus
 * @returns {Void}
 */
function show(panel, withFocus = true) {
    const { matches, index } = panel.search;
    drawCount(panel);

    const match = matches[index];
    if (panel.mode === "text") {
        if (match && withFocus) {
            panel.views.text.select(match.start, match.end);
        }
        return;
    }
    if (match) {
        panel.select(match.path);
    } else {
        panel.drawView();
    }
}

/**
 * Walks to the place that many steps from the one being looked at
 * @param {Panel}  panel
 * @param {Number} step
 * @returns {Boolean}
 */
export function walk(panel, step) {
    const { matches } = panel.search;
    if (!matches.length) {
        return false;
    }
    panel.search.index = (panel.search.index + step + matches.length) % matches.length;
    show(panel);
    return true;
}

/**
 * Replaces what was found at the place being looked at, and moves on
 * @param {Panel} panel
 * @returns {Boolean}
 */
export function replaceOne(panel) {
    const { matches, index, text } = panel.search;
    const match = matches[index];
    if (!match) {
        return false;
    }

    const replacement = getFields(panel).replace.value;
    if (panel.mode === "text") {
        panel.setText(panel.text.slice(0, match.start) + replacement + panel.text.slice(match.end));
    } else {
        panel.setValue(replaceMatch(panel.value, match, text, replacement));
    }
    panel.search.index = Math.min(index, panel.search.matches.length - 1);
    show(panel);
    return true;
}

/**
 * Replaces what was found at every place
 * @param {Panel} panel
 * @returns {Boolean}
 */
export function replaceAll(panel) {
    const { matches, text } = panel.search;
    if (!matches.length) {
        return false;
    }

    const replacement = getFields(panel).replace.value;
    const amount      = matches.length;
    if (panel.mode === "text") {
        panel.setText(Finder.replace(panel.text, text, replacement));
    } else {
        // From the last to the first, so a key that takes another name
        // does not move what is still to be replaced
        let root = panel.value;
        for (const match of matches.slice().reverse()) {
            root = replaceMatch(root, match, text, replacement);
        }
        panel.setValue(root, null);
    }
    App.toast.show(amount === 1 ? "Replaced it in 1 place" : `Replaced it in ${amount} places`);
    return true;
}

/**
 * Returns the root with what was found at the given place replaced
 * @param {*}      root
 * @param {Object} match
 * @param {String} needle
 * @param {String} replacement
 * @returns {*}
 */
function replaceMatch(root, match, needle, replacement) {
    if (match.field === "key") {
        const key  = String(match.path[match.path.length - 1]);
        const name = Finder.replace(key, needle, replacement);
        const parent = Path.get(root, match.path.slice(0, -1));
        if (name === key || Object.prototype.hasOwnProperty.call(parent, name)) {
            return root;
        }
        return Path.rename(root, match.path, name);
    }

    const old  = Path.get(root, match.path);
    const text = Finder.replace(Finder.toText(old), needle, replacement);
    return Path.set(root, match.path, Kinds.parseValue(text, typeof old === "string"));
}
