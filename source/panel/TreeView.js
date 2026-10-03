import Configs from "../core/Configs.js";
import Utils   from "../core/Utils.js";
import Kinds   from "../json/Kinds.js";
import Path    from "../json/Path.js";



// What opens and closes each kind of container
const BRACKETS = { object : [ "{", "}" ], array : [ "[", "]" ] };

// The classes that say how a row differs from the other document
const MARKS = { added : "is-added", removed : "is-removed", changed : "is-changed", inside : "is-inside" };

// How long a text is shown before it is cut
const MAX_TEXT = 600;

// How many lines each container takes when it is written out, which is
// worked out once for each, since a change makes a new one of every
// container it touches and leaves the rest as they were
const lineCounts = new WeakMap();



/**
 * The Tree View, which shows the document as rows that open and close: a
 * row for each thing it holds, set in under the one that holds it
 */
export default class TreeView {

    // How many of what a container holds are shown at a time
    static PAGE = 100;

    #panel;

    /** @type {Configs} */
    #configs;

    /** @type {HTMLElement} */
    #element;


    /**
     * Tree View constructor
     * @param {Object}      panel
     * @param {HTMLElement} element
     * @param {Configs}     configs
     */
    constructor(panel, element, configs) {
        this.#panel   = panel;
        this.#element = element;
        this.#configs = configs;
    }

    /**
     * Draws the document as a tree, where it was scrolled to
     * @returns {Void}
     */
    render() {
        const { value } = this.#panel;
        if (value === undefined) {
            this.#element.innerHTML = "";
            return;
        }

        // While the two documents are compared as trees, each is drawn
        // beside the other, with its rows where the rows of the other are
        const { peer } = this.#panel;
        const isPaired = Boolean(peer && peer.isValid && peer.mode === "tree");
        const state    = {
            html      : [],
            line      : 1,
            isPaired,
            isLeft    : this.#panel.side === "left",
            focus     : isPaired ? this.#panel.focusAt : null,
            selected  : this.#panel.selection ? Path.toPointer(this.#panel.selection) : null,
            matches   : this.#getMatches(),
            showTags  : this.#configs.get("showTags"),
        };
        this.#walk(state, value, isPaired ? peer.value : undefined, [], null, false, 0, "");
        this.#element.style.setProperty("--digits", String(String(countLines(value)).length));
        this.#element.classList.toggle("is-paired", isPaired);

        const top  = this.#element.scrollTop;
        const left = this.#element.scrollLeft;
        this.#element.innerHTML  = state.html.join("");
        this.#element.scrollTop  = top;
        this.#element.scrollLeft = left;
    }

    /**
     * Returns the rows the search found something in, each with what was
     * found there and whether it is the one being looked at
     * @returns {Map<String, Object>}
     */
    #getMatches() {
        const result = new Map();
        const { matches, index, isOpen } = this.#panel.search;
        if (!isOpen) {
            return result;
        }
        for (const [ at, match ] of matches.entries()) {
            const pointer = Path.toPointer(match.path);
            const entry   = result.get(pointer) || { key : false, value : false, isCurrent : false };
            entry[match.field] = true;
            entry.isCurrent    = entry.isCurrent || at === index;
            result.set(pointer, entry);
        }
        return result;
    }

    /**
     * Draws the row of a value, and the rows of what it holds when it is
     * open. Each row has the number of the line it is written on when the
     * document is written out, so the rows that are closed take theirs
     * along. What the row inherits is how the container it is in differs
     * from the other document, when all of it does.
     *
     * While the documents are compared, the value the other one has at
     * the same place comes along. Where this one has nothing an empty row
     * is drawn, and what only the other one opens gets its rows too, so
     * the same row of both trees is about the same place
     * @param {Object}            state
     * @param {*}                 mine
     * @param {*}                 theirs
     * @param {(String|Number)[]} path
     * @param {?String}           key
     * @param {Boolean}           isItem
     * @param {Number}            depth
     * @param {String}            inherited
     * @returns {Void}
     */
    #walk(state, mine, theirs, path, key, isItem, depth, inherited) {
        const panel      = this.#panel;
        const pointer    = Path.toPointer(path);
        const isExpanded = panel.expanded.has(pointer);
        const mineOpen   = isExpanded && isFilled(mine);
        const theirsOpen = isExpanded && isFilled(theirs);
        const mark       = inherited || (panel.marks ? panel.marks.get(pointer) : "") || "";
        const focus      = pointer === state.focus ? " is-focus" : "";

        if (mine === undefined) {
            // The room left for the difference being looked at is in the
            // color of what the other document has there
            const theirMark = focus && panel.peer && panel.peer.marks ? MARKS[panel.peer.marks.get(pointer)] : "";
            state.html.push(`<div class="tree-row tree-gap${focus}${theirMark ? ` ${theirMark}` : ""}" style="--depth:${depth}"><span class="tree-num"></span></div>`);
        } else {
            state.html.push(this.#renderRow(state, mine, pointer, key, isItem, depth, mark, mineOpen, focus));
        }
        if (!mineOpen && !theirsOpen) {
            state.line += mine === undefined ? 0 : countLines(mine);
            return;
        }
        if (mine !== undefined) {
            state.line += mineOpen ? 1 : countLines(mine);
        }

        // What all of a container is, everything it holds is too
        const passed  = mark === "added" || mark === "removed" || mark === "changed" ? mark : "";
        const entries = getEntries(mineOpen ? mine : undefined, theirsOpen ? theirs : undefined, state.isLeft);
        const limit   = panel.limits.get(pointer) || TreeView.PAGE;
        for (const entry of entries.slice(0, limit)) {
            const child = [ ...path, entry.isItem ? Number(entry.key) : entry.key ];
            this.#walk(state, entry.mine, entry.theirs, child, entry.key, entry.isItem, depth + 1, passed);
        }
        if (entries.length > limit) {
            const rest = entries.length - limit;
            state.html.push(`<div class="tree-row tree-more" data-path="${Utils.escape(pointer)}" data-action="tree-more" style="--depth:${depth + 1}">` +
                `<span class="tree-num"></span><i class="tree-space"></i>Show ${Math.min(rest, TreeView.PAGE)} more of the ${rest} left</div>`);
            for (const entry of entries.slice(limit)) {
                state.line += entry.mine === undefined ? 0 : countLines(entry.mine);
            }
        }

        if (!mineOpen) {
            state.html.push(`<div class="tree-row tree-gap" style="--depth:${depth}"><span class="tree-num"></span></div>`);
            return;
        }
        state.html.push(`<div class="tree-row tree-end${MARKS[passed] ? ` ${MARKS[passed]}` : ""}" style="--depth:${depth}">` +
            `<span class="tree-num">${state.line}</span><i class="tree-space"></i><span class="tree-bracket">${BRACKETS[Kinds.typeOf(mine)][1]}</span></div>`);
        state.line += 1;
    }

    /**
     * Draws the row of a value
     * @param {Object}  state
     * @param {*}       value
     * @param {String}  pointer
     * @param {?String} key
     * @param {Boolean} isItem
     * @param {Number}  depth
     * @param {String}  mark
     * @param {Boolean} isOpen
     * @param {String}  focus
     * @returns {String}
     */
    #renderRow(state, value, pointer, key, isItem, depth, mark, isOpen, focus) {
        const panel   = this.#panel;
        const kind    = Kinds.typeOf(value);
        const match   = state.matches.get(pointer);
        const problem = panel.problems.length ? panel.getProblem(pointer) : "";

        const classes = [ `tree-row${focus}` ];
        if (pointer === state.selected) {
            classes.push("selected");
        }
        if (MARKS[mark]) {
            classes.push(MARKS[mark]);
        }
        if (match && match.isCurrent) {
            classes.push("is-current");
        }
        if (problem) {
            classes.push("has-problem");
        }

        const parts = [ `<span class="tree-num">${state.line}</span>` ];
        parts.push(isFilled(value)
            ? `<i class="tree-toggle${isOpen ? " open" : ""}" data-action="tree-toggle"></i>`
            : '<i class="tree-space"></i>');

        if (isItem) {
            parts.push(`<span class="tree-index">${key}</span>`);
        } else if (key !== null) {
            const found = match && match.key ? " is-match" : "";
            parts.push(`<span class="tree-key${found}" data-edit="key">${Utils.escape(key) || "&nbsp;"}</span><span class="tree-colon">:</span>`);
        }

        if (kind === "object" || kind === "array") {
            const [ open, close ] = BRACKETS[kind];
            parts.push(`<span class="tree-bracket" data-action="tree-toggle">${open}</span>`);
            parts.push(`<span class="tree-count" data-action="tree-toggle">${Kinds.summary(value)}</span>`);
            if (!isOpen) {
                parts.push(`<span class="tree-bracket" data-action="tree-toggle">${close}</span>`);
            }
        } else {
            parts.push(this.#renderValue(value, kind, match && match.value, state.showTags));
        }
        if (problem) {
            parts.push(`<span class="tree-problem">${Utils.escape(problem)}</span>`);
        }
        parts.push('<i class="tree-dots" data-action="tree-menu"></i>');

        return `<div class="${classes.join(" ")}" data-path="${Utils.escape(pointer)}" data-action="tree-select" style="--depth:${depth}">${parts.join("")}</div>`;
    }

    /**
     * Draws a plain value, with what tells a color, a moment and an
     * address from any other text or number
     * @param {*}       value
     * @param {String}  kind
     * @param {Boolean} isMatch
     * @param {Boolean} showTags
     * @returns {String}
     */
    #renderValue(value, kind, isMatch, showTags) {
        const found = isMatch ? " is-match" : "";
        if (kind !== "string") {
            const time = showTags ? Kinds.toTime(value) : null;
            const tag  = time ? `<span class="tree-tag">${formatTime(time)}</span>` : "";
            return `<span class="tree-value is-${kind}${found}" data-edit="value">${String(value)}</span>${tag}`;
        }

        if (!value) {
            return `<span class="tree-value is-string is-blank${found}" data-edit="value">""</span>`;
        }
        const text   = value.length > MAX_TEXT ? `${value.slice(0, MAX_TEXT)}…` : value;
        let   before = "";
        let   after  = "";
        if (showTags && Kinds.isColor(value)) {
            before = `<i class="tree-swatch" style="background-color:${Utils.escape(value)}"></i>`;
        } else if (showTags && Kinds.isUrl(value)) {
            after = `<a class="tree-link" href="${Utils.escape(value)}" data-action="open-link" data-tip="Open the address" data-tip-top></a>`;
        }
        return `${before}<span class="tree-value is-string${found}" data-edit="value">${Utils.escape(text)}</span>${after}`;
    }



    /**
     * Returns the row of what is at the given path, if it is drawn
     * @param {(String|Number)[]} path
     * @returns {?HTMLElement}
     */
    #getRow(path) {
        const pointer = Path.toPointer(path);
        for (const row of this.#element.querySelectorAll(".tree-row[data-action='tree-select']")) {
            if (row instanceof HTMLElement && row.dataset.path === pointer) {
                return row;
            }
        }
        return null;
    }

    /**
     * Returns the paths of the rows that are drawn, from the top
     * @returns {String[]}
     */
    get rows() {
        const result = [];
        for (const row of this.#element.querySelectorAll(".tree-row[data-action='tree-select']")) {
            if (row instanceof HTMLElement) {
                result.push(row.dataset.path);
            }
        }
        return result;
    }

    /**
     * Brings the row of the given path into view
     * @param {(String|Number)[]} path
     * @returns {Void}
     */
    reveal(path) {
        const row = this.#getRow(path);
        if (row) {
            row.scrollIntoView({ block : "nearest", inline : "nearest" });
        }
    }

    /**
     * Gives the keys to the tree
     * @returns {Void}
     */
    focus() {
        this.#element.focus({ preventScroll : true });
    }

    /**
     * Returns true if a key or a value is being typed over
     * @returns {Boolean}
     */
    get isEditing() {
        return Boolean(this.#element.querySelector(".tree-input"));
    }

    /**
     * Lets the key or the value at the given path be typed over, in the
     * row itself. Enter and leaving the field take what was typed, and
     * Escape leaves it as it was
     * @param {(String|Number)[]} path
     * @param {String}            field
     * @returns {Boolean}
     */
    edit(path, field) {
        const row  = this.#getRow(path);
        const span = row ? row.querySelector(`[data-edit="${field}"]`) : null;
        if (!span) {
            return false;
        }

        const value = Path.get(this.#panel.value, path);
        const input = document.createElement("input");
        input.type       = "text";
        input.className  = `tree-input ${span.className}`;
        input.spellcheck = false;
        input.value      = field === "key" ? String(path[path.length - 1]) : Kinds.toInput(value);

        const setWidth = () => {
            input.style.width = `${Math.max(input.value.length, 2) + 2}ch`;
        };
        let isDone = false;
        const end  = (isTaken) => {
            if (isDone) {
                return;
            }
            isDone = true;
            if (!isTaken || !this.#panel.commit(path, field, input.value)) {
                this.#panel.drawView();
            }
            this.focus();
        };

        input.addEventListener("input", setWidth);
        input.addEventListener("blur", () => end(true));
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                end(true);
            } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                end(false);
            }
            e.stopPropagation();
        });

        span.replaceWith(input);
        setWidth();
        input.focus();
        input.select();
        return true;
    }
}



/**
 * Returns true if the value is a container that holds something, which
 * is what can be opened
 * @param {*} value
 * @returns {Boolean}
 */
function isFilled(value) {
    return value !== null && typeof value === "object" && Object.keys(value).length > 0;
}

/**
 * Returns what the two containers hold, each thing with what the other
 * has at the same place. Two objects and two lists are gone through
 * together, the keys of the left one first and then the ones only the
 * right one has, so both trees go through them in the one order. A list
 * beside an object has nothing at the same place, and neither does a
 * container beside nothing, so each is gone through on its own
 * @param {(Object|Array|undefined)} mine
 * @param {(Object|Array|undefined)} theirs
 * @param {Boolean}                  isLeft
 * @returns {{key: String, isItem: Boolean, mine: *, theirs: *}[]}
 */
function getEntries(mine, theirs, isLeft) {
    const result = [];
    const add    = (holder, key, mineValue, theirsValue) => {
        result.push({ key, isItem : Array.isArray(holder), mine : mineValue, theirs : theirsValue });
    };

    if (mine === undefined || theirs === undefined || Array.isArray(mine) !== Array.isArray(theirs)) {
        const [ first, second ] = isLeft ? [ mine, theirs ] : [ theirs, mine ];
        for (const holder of [ first, second ]) {
            for (const [ key, value ] of Object.entries(holder || {})) {
                add(holder, key, holder === mine ? value : undefined, holder === mine ? undefined : value);
            }
        }
        return result;
    }

    const [ left, right ] = isLeft ? [ mine, theirs ] : [ theirs, mine ];
    const keys = Array.isArray(mine)
        ? Array.from({ length : Math.max(mine.length, theirs.length) }, (item, index) => String(index))
        : [ ...new Set([ ...Object.keys(left), ...Object.keys(right) ]) ];
    for (const key of keys) {
        add(mine, key,
            Object.prototype.hasOwnProperty.call(mine, key) ? mine[key] : undefined,
            Object.prototype.hasOwnProperty.call(theirs, key) ? theirs[key] : undefined);
    }
    return result;
}

/**
 * Returns how many lines the value takes when it is written out a line
 * for each thing: one for a plain value and for an empty container, and
 * two more than what it holds for any other
 * @param {*} value
 * @returns {Number}
 */
function countLines(value) {
    if (value === null || typeof value !== "object") {
        return 1;
    }
    if (lineCounts.has(value)) {
        return lineCounts.get(value);
    }

    let count = 0;
    for (const child of Object.values(value)) {
        count += countLines(child);
    }
    count = count ? count + 2 : 1;
    lineCounts.set(value, count);
    return count;
}

/**
 * Says the moment the way it is read, in the hour of whoever reads it
 * @param {Date} time
 * @returns {String}
 */
function formatTime(time) {
    const pad = (number) => String(number).padStart(2, "0");
    return `${time.getFullYear()}-${pad(time.getMonth() + 1)}-${pad(time.getDate())} ` +
        `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`;
}
