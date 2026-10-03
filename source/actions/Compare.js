import * as App       from "../App.js";
import * as Documents from "./Documents.js";
import compareValues   from "../json/Compare.js";
import Path            from "../json/Path.js";



// Whether the two documents are being compared, the differences there are
// between them, and the one being looked at
let isComparing = false;
let differences = [];
let current     = -1;



/**
 * Compares the two documents, or stops comparing them. They are compared
 * as trees, since a difference is a place in the document and not a line
 * @param {Boolean} isOn
 * @returns {Void}
 */
export function setComparing(isOn) {
    isComparing = isOn;
    current     = -1;
    App.storage.setFlag("compare", isOn);
    document.body.classList.toggle("is-comparing", isOn);

    if (isOn) {
        for (const side of App.SIDES) {
            const panel = App.panels[side];
            if (panel.mode === "text" && panel.isValid) {
                panel.mode = "tree";
            }
        }
    }
    refresh(true);
}

/**
 * Starts or stops comparing the two documents
 * @returns {Boolean}
 */
export function toggleComparing() {
    // It takes the two of them to compare, so both are shown
    if (!isComparing && Documents.getOnly()) {
        Documents.setOnly("");
    }
    setComparing(!isComparing);
    return true;
}

/**
 * Compares the documents again as they are now, and marks on each one
 * where it differs from the other
 * @param {Boolean=} withDraw
 * @returns {Void}
 */
export function refresh(withDraw = false) {
    const { left, right } = App.panels;
    const hadMarks = Boolean(left.marks || right.marks);

    if (!isComparing || !left.isValid || !right.isValid) {
        differences = [];
        left.marks  = null;
        right.marks = null;
        unpair();
        App.header.setStatus(isComparing ? "Both sides need valid JSON to be compared" : "");
        drawCount();
        if (hadMarks || withDraw) {
            left.render();
            right.render();
        }
        return;
    }

    const result = compareValues(left.value, right.value);
    differences  = result.list;
    left.marks   = result.left;
    right.marks  = result.right;
    current      = Math.min(current, differences.length - 1);
    pair();
    setFocus();

    App.header.setStatus(differences.length
        ? `<b class="badge-changed">${differences.length}</b> ${differences.length === 1 ? "difference" : "differences"}`
        : "The two documents are the same");
    drawCount();
    left.render();
    right.render();
}

/**
 * Puts the two trees side by side: each knows the other, and what is open
 * in one is open in both, so the same row of each is about the same place
 * @returns {Void}
 */
function pair() {
    const { left, right } = App.panels;
    if (right.expanded !== left.expanded) {
        for (const pointer of right.expanded) {
            left.expanded.add(pointer);
        }
        for (const [ pointer, limit ] of right.limits) {
            left.limits.set(pointer, Math.max(limit, left.limits.get(pointer) || 0));
        }
        right.expanded = left.expanded;
        right.limits   = left.limits;
    }
    left.peer  = right;
    right.peer = left;
}

/**
 * Lets each tree go its own way again, open where it was left
 * @returns {Void}
 */
function unpair() {
    const { left, right } = App.panels;
    if (right.expanded === left.expanded) {
        right.expanded = new Set(left.expanded);
        right.limits   = new Map(left.limits);
    }
    left.peer   = null;
    right.peer  = null;
    left.focusAt  = null;
    right.focusAt = null;
}

/**
 * Tells both trees which difference is the one being looked at
 * @returns {Void}
 */
function setFocus() {
    const focus = differences[current] ? Path.toPointer(differences[current].path) : null;
    App.panels.left.focusAt  = focus;
    App.panels.right.focusAt = focus;
}

/**
 * Scrolls the tree beside the given one to where it is, while the two are
 * drawn side by side, so the same rows stay beside each other
 * @param {HTMLElement} element
 * @returns {Void}
 */
export function syncScroll(element) {
    const { left, right } = App.panels;
    if (!isComparing || !left.peer || left.mode !== "tree" || right.mode !== "tree") {
        return;
    }
    const from  = left.element.contains(element) ? left : right;
    const other = App.otherOf(from).getElement(".tree-view");
    if (other.scrollTop !== element.scrollTop) {
        other.scrollTop = element.scrollTop;
    }
}

/**
 * Says which difference is being looked at, of how many there are
 * @returns {Void}
 */
function drawCount() {
    const element = document.querySelector(".between-count");
    if (element) {
        element.textContent = `${current >= 0 ? current + 1 : "–"}/${differences.length}`;
    }
}

/**
 * Walks to the difference that many steps from the one being looked at,
 * and shows it on both sides
 * @param {Number} step
 * @returns {Boolean}
 */
export function walk(step) {
    if (!isComparing || !differences.length) {
        return false;
    }
    current = (current + step + differences.length) % differences.length;
    if (current < 0) {
        current = 0;
    }
    drawCount();
    setFocus();

    // What only one side has is selected on that side alone, and the other
    // one shows the room that is left for it
    const { path } = differences[current];
    for (const side of App.SIDES) {
        const panel = App.panels[side];
        if (panel.mode === "tree") {
            panel.expandTo(path);
        }
        panel.selection = Path.has(panel.value, path) ? path : null;
    }
    for (const side of App.SIDES) {
        App.panels[side].drawView(true);
        App.panels[side].drawFoot();
    }

    // The difference is brought to the middle of the trees, which scroll
    // together, and to wherever it is in what is shown another way
    for (const side of App.SIDES) {
        const panel = App.panels[side];
        if (panel.mode !== "tree") {
            if (panel.selection) {
                panel.views[panel.mode].reveal(path);
            }
            continue;
        }
        const row = panel.getElement(".tree-row.is-focus");
        if (row) {
            row.scrollIntoView({ block : "center", inline : "nearest" });
            syncScroll(panel.getElement(".tree-view"));
        }
    }
    return true;
}
