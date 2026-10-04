import TextView  from "./TextView.js";
import TreeView  from "./TreeView.js";
import TableView from "./TableView.js";
import Configs   from "../core/Configs.js";
import Toast     from "../core/Toast.js";
import Utils     from "../core/Utils.js";
import Parse     from "../json/Parse.js";
import Format    from "../json/Format.js";
import Kinds     from "../json/Kinds.js";
import Path      from "../json/Path.js";
import validate  from "../json/Schema.js";



// The ways a document can be looked at
export const MODES = [ "text", "tree", "table" ];

// How many steps back a document can be taken
const MAX_UNDO = 200;

// How long the typing has to pause for what was typed to be one step back
const TYPING_PAUSE = 800;

// How many problems are listed under a document
const MAX_PROBLEMS = 50;



/**
 * A Panel, which holds a document and shows it as text, as a tree or as a
 * table. The text is what the document is: the value is read from it, and
 * a change made to the value is written back as text
 */
export default class Panel {

    /** @type {Configs} */
    #configs;
    /** @type {Toast} */
    #toast;

    /** @type {Object.<String, (TextView|TreeView|TableView)>} */
    #views;

    #name     = "";
    #text     = "";
    #parsed   = null;
    #undo     = [];
    #redo     = [];
    #lastPush = 0;
    #timer    = 0;

    /** @type {?Object} */
    #schema = null;


    /**
     * Panel constructor
     * @param {String}  side
     * @param {Configs} configs
     * @param {Toast}   toast
     */
    constructor(side, configs, toast) {
        this.side     = side;
        this.#configs = configs;
        this.#toast   = toast;

        /** @type {HTMLElement} */
        this.element = document.querySelector(`.panel[data-side="${side}"]`);

        /** @type {HTMLTemplateElement} */
        const template = document.querySelector("#panel-template");
        this.element.appendChild(template.content.cloneNode(true));

        this.mode       = "text";
        this.docID      = 0;
        this.selection  = null;
        this.expanded   = new Set([ "" ]);
        this.limits     = new Map();
        this.tablePath  = [];
        this.tableSort  = null;
        this.marks      = null;
        this.problems   = [];

        // The Panel beside this one while the two are compared, and the
        // place of the difference being looked at
        /** @type {?Panel} */
        this.peer    = null;
        this.focusAt = null;

        this.schemaText = "";
        this.search     = { isOpen : false, text : "", matches : [], index : -1 };

        /** @type {?Function} */
        this.onChange = null;

        this.#views = {
            text  : new TextView(this, this.getElement(".text-view"), configs),
            tree  : new TreeView(this, this.getElement(".tree-view"), configs),
            table : new TableView(this, this.getElement(".table-view"), configs),
        };

        /** @type {HTMLInputElement} */
        const name = this.element.querySelector(".panel-name");
        name.addEventListener("input", () => {
            this.#name = name.value;
            this.#notify("name");
        });
    }

    /**
     * Returns an Element of the Panel
     * @param {String} selector
     * @returns {HTMLElement}
     */
    getElement(selector) {
        return this.element.querySelector(selector);
    }

    /**
     * Returns the name of the document
     * @returns {String}
     */
    get name() {
        return this.#name;
    }

    /**
     * Returns the text of the document
     * @returns {String}
     */
    get text() {
        return this.#text;
    }

    /**
     * Returns what the text reads as, which is only read once for each text
     * @returns {{value: *, error: ?Object, isEmpty: Boolean}}
     */
    get parsed() {
        if (!this.#parsed) {
            this.#parsed = Parse.parse(this.#text);
        }
        return this.#parsed;
    }

    /**
     * Returns the value the text holds, or undefined when it holds none
     * @returns {*}
     */
    get value() {
        return this.parsed.value;
    }

    /**
     * Returns what stops the text from being JSON, if anything does
     * @returns {?Object}
     */
    get error() {
        return this.parsed.error;
    }

    /**
     * Returns true if there is no document
     * @returns {Boolean}
     */
    get isEmpty() {
        return this.parsed.isEmpty;
    }

    /**
     * Returns true if the text is JSON
     * @returns {Boolean}
     */
    get isValid() {
        return this.parsed.value !== undefined;
    }

    /**
     * Returns the views of the Panel
     * @returns {{text: TextView, tree: TreeView, table: TableView}}
     */
    get views() {
        // @ts-ignore
        return this.#views;
    }

    /**
     * Returns the document as it is kept for the next visit
     * @returns {{name: String, text: String, mode: String, docID: Number}}
     */
    get doc() {
        return { name : this.#name, text : this.#text, mode : this.mode, docID : this.docID };
    }

    /**
     * Says what the document is, in a few words, and how much room it takes
     * @returns {{kind: String, size: String}}
     */
    get info() {
        let kind = "empty";
        if (this.isValid) {
            kind = Path.isContainer(this.value) ? Kinds.summary(this.value) : Kinds.typeOf(this.value);
        } else if (!this.isEmpty) {
            kind = "not valid";
        }
        return { kind, size : Kinds.sizeOf(this.#text) };
    }



    /**
     * Takes the given document as a new one, with nothing to go back to
     * @param {{name: String, text: String}}   file
     * @param {{docID: Number, mode: String}=} options
     * @returns {Void}
     */
    load(file, options = {}) {
        this.#name     = file.name || "";
        this.#text     = file.text || "";
        this.#parsed   = null;
        this.#undo     = [];
        this.#redo     = [];
        this.docID     = options.docID || 0;
        this.selection = null;
        this.expanded  = new Set([ "" ]);
        this.limits    = new Map();
        this.tablePath = [];
        this.tableSort = null;

        // A text that is not JSON can only be shown as the text it is
        const mode = MODES.includes(options.mode) ? options.mode : this.mode;
        this.mode  = this.isValid ? mode : "text";

        this.check();
        this.render();
        this.#notify("load");
    }

    /**
     * Takes the name the document is given
     * @param {String} name
     * @returns {Void}
     */
    setName(name) {
        this.#name = name;
        this.drawHead();
        this.#notify("name");
    }

    /**
     * Takes the text as it is being typed. What is typed without a pause
     * is one step back, and what the text reads as is said once the
     * typing rests, since reading a long text at every letter is slow
     * @param {String} text
     * @returns {Void}
     */
    edit(text) {
        if (text === this.#text) {
            return;
        }
        if (Date.now() - this.#lastPush > TYPING_PAUSE) {
            this.#push();
        }
        this.#lastPush = Date.now();
        this.#redo     = [];
        this.#text     = text;
        this.#parsed   = null;

        // What an empty document shows is gone at the first letter, and
        // not once the typing rests
        this.element.classList.toggle("is-empty", !text.trim());

        window.clearTimeout(this.#timer);
        this.#timer = window.setTimeout(() => {
            this.check();
            this.drawState();
            this.#views.text.drawMark();
        }, 250);
        this.#notify("edit");
    }

    /**
     * Takes the given text as the document, as a step that can be taken back
     * @param {String} text
     * @returns {Void}
     */
    setText(text) {
        if (text === this.#text) {
            return;
        }
        this.#push();
        this.#text   = text;
        this.#parsed = null;
        this.#changed();
    }

    /**
     * Takes the given value as the document, which is written out the way
     * the Settings ask for, as a step that can be taken back
     * @param {*}                     value
     * @param {(String|Number)[]=}    selection
     * @returns {Void}
     */
    setValue(value, selection) {
        this.#push();
        this.#text   = Format.stringify(value, this.#configs.get("indent"));
        this.#parsed = { value, error : null, isEmpty : value === undefined };
        if (selection !== undefined) {
            this.selection = selection;
        }
        this.#changed();
    }

    /**
     * Shows the document again after a change that was not typed
     * @returns {Void}
     */
    #changed() {
        window.clearTimeout(this.#timer);
        if (!this.isValid && this.mode !== "text") {
            this.mode = "text";
        }
        if (this.selection && !Path.has(this.value, this.selection)) {
            this.selection = null;
        }
        this.check();
        this.render();
        this.#notify("edit");
    }

    /**
     * Keeps the document as it is, to come back to it
     * @returns {Void}
     */
    #push() {
        this.#undo.push({ text : this.#text, selection : this.selection });
        if (this.#undo.length > MAX_UNDO) {
            this.#undo.shift();
        }
        this.#redo     = [];
        this.#lastPush = 0;
    }

    /**
     * Returns true if there is a step to take back
     * @returns {Boolean}
     */
    get canUndo() {
        return this.#undo.length > 0;
    }

    /**
     * Returns true if there is a step that was taken back to take again
     * @returns {Boolean}
     */
    get canRedo() {
        return this.#redo.length > 0;
    }

    /**
     * Takes the last step back
     * @returns {Boolean}
     */
    undo() {
        return this.#step(this.#undo, this.#redo);
    }

    /**
     * Takes again the last step that was taken back
     * @returns {Boolean}
     */
    redo() {
        return this.#step(this.#redo, this.#undo);
    }

    /**
     * Moves the document to the last one of the first list, keeping the
     * one it leaves in the second
     * @param {Object[]} from
     * @param {Object[]} to
     * @returns {Boolean}
     */
    #step(from, to) {
        if (!from.length) {
            return false;
        }
        to.push({ text : this.#text, selection : this.selection });

        const state    = from.pop();
        this.#text     = state.text;
        this.#parsed   = null;
        this.selection = state.selection;
        this.#lastPush = 0;
        this.#changed();
        return true;
    }

    /**
     * Tells whoever listens that the document changed
     * @param {String} kind
     * @returns {Void}
     */
    #notify(kind) {
        if (this.onChange) {
            this.onChange(this, kind);
        }
    }



    /**
     * Shows the document the given way, and says whether it could: a text
     * that is not JSON has no tree and no table
     * @param {String} mode
     * @returns {Boolean}
     */
    setMode(mode) {
        if (!MODES.includes(mode)) {
            return false;
        }
        if (mode !== "text" && !this.isValid && !this.isEmpty) {
            this.#toast.show("The text is not valid JSON, repair it first");
            return false;
        }
        this.mode = mode;
        this.render();
        this.#notify("mode");
        return true;
    }

    /**
     * Draws the whole Panel
     * @returns {Void}
     */
    render() {
        this.element.dataset.mode = this.mode;
        this.drawHead();
        this.drawView();
        this.drawState();
    }

    /**
     * Draws the document, the way it is being looked at. While the two
     * are compared, the one beside it is drawn again too, since a row
     * that opens here makes room for itself there
     * @param {Boolean=} isPeer
     * @returns {Void}
     */
    drawView(isPeer = false) {
        this.#views[this.mode].render();
        this.drawPath();
        if (this.peer && !isPeer && this.mode === "tree" && this.peer.mode === "tree") {
            this.peer.drawView(true);
        }
    }

    /**
     * Draws what is said around the document: whether it is JSON, what it
     * holds, what can be done with it and what is wrong with it
     * @returns {Void}
     */
    drawState() {
        this.element.classList.toggle("is-empty", this.isEmpty);
        this.element.classList.toggle("is-invalid", !this.isValid && !this.isEmpty);
        this.element.classList.toggle("has-undo", this.canUndo);
        this.element.classList.toggle("has-redo", this.canRedo);
        this.drawFoot();
        this.drawProblems();
    }

    /**
     * Draws the head of the Panel, with the way the document is looked at
     * and its name
     * @param {Boolean=} withMove
     * @returns {Void}
     */
    drawHead(withMove = true) {
        for (const tab of this.element.querySelectorAll(".panel-head [data-mode]")) {
            if (tab instanceof HTMLElement) {
                tab.classList.toggle("selected", tab.dataset.mode === this.mode);
            }
        }
        Utils.moveMark(this.getElement(".panel-head .tabs"), withMove);

        /** @type {HTMLInputElement} */
        const name = this.element.querySelector(".panel-name");
        if (name.value !== this.#name) {
            name.value = this.#name;
        }
    }

    /**
     * Draws the foot of the Panel, with where the caret is, what the
     * document holds and whether it is JSON
     * @returns {Void}
     */
    drawFoot() {
        const { kind, size } = this.info;
        let place = "";
        if (this.mode === "text") {
            const { line, column, selected } = this.#views.text.place;
            place = `Line ${line}, column ${column}${selected ? ` · ${selected} selected` : ""}`;
        } else if (this.selection) {
            place = Kinds.typeOf(Path.get(this.value, this.selection));
        }

        this.getElement(".foot-place").textContent = place;
        this.getElement(".foot-info").textContent  = this.isEmpty ? "" : (this.isValid ? `${kind} · ${size}` : size);

        const state = this.getElement(".foot-state");
        state.textContent = this.isEmpty ? "" : (this.isValid ? "Valid" : "Not valid");
        state.classList.toggle("is-bad", !this.isValid && !this.isEmpty);
    }

    /**
     * Draws the path to what is selected, each part of it a place to go
     * @returns {Void}
     */
    drawPath() {
        const element = this.getElement(".panel-path");
        if (this.mode === "text" || !this.isValid) {
            element.innerHTML = "";
            return;
        }

        const path  = this.selection || (this.mode === "table" ? this.tablePath : []);
        const parts = [ `<a href="#" data-action="go-path" data-path="">${Kinds.typeOf(this.value) === "array" ? "list" : "root"}</a>` ];
        for (let i = 0; i < path.length; i += 1) {
            const pointer = Path.toPointer(path.slice(0, i + 1));
            parts.push(`<a href="#" data-action="go-path" data-path="${Utils.escape(pointer)}">${Utils.escape(String(path[i]))}</a>`);
        }
        element.innerHTML = parts.join("<i></i>");
        element.scrollLeft = element.scrollWidth;
    }

    /**
     * Draws what is wrong with the document: where it stops being JSON,
     * and where it is not what its schema asks for
     * @returns {Void}
     */
    drawProblems() {
        const element = this.getElement(".panel-problems");
        const parts   = [];

        if (this.error) {
            const { line, column, message } = this.error;
            parts.push('<div class="problem is-error">' +
                `<span><b>Line ${line}, column ${column}</b>${Utils.escape(message)}</span>` +
                '<a href="#" data-action="show-error">Show</a>' +
                '<a href="#" data-action="repair">Repair</a>' +
                "</div>");
        }
        for (const problem of this.problems.slice(0, MAX_PROBLEMS)) {
            const pointer = Path.toPointer(problem.path);
            const where   = Path.toText(problem.path, this.value) || "root";
            parts.push(`<div class="problem" data-action="go-problem" data-path="${Utils.escape(pointer)}">` +
                `<span><b>${Utils.escape(where)}</b>${Utils.escape(problem.message)}</span>` +
                "</div>");
        }
        if (this.problems.length > MAX_PROBLEMS) {
            parts.push(`<div class="problem"><span>And ${this.problems.length - MAX_PROBLEMS} more</span></div>`);
        }
        element.innerHTML = parts.join("");
    }



    /**
     * Takes the JSON Schema the document is checked against, as text, and
     * says whether it could be read. An empty one checks nothing
     * @param {String} text
     * @returns {Boolean}
     */
    setSchema(text) {
        if (!text.trim()) {
            this.#schema    = null;
            this.schemaText = "";
            this.check();
            return true;
        }
        const { value } = Parse.parse(text);
        if (!Path.isContainer(value) && typeof value !== "boolean") {
            return false;
        }
        this.#schema    = value;
        this.schemaText = text;
        this.check();
        return true;
    }

    /**
     * Checks the document against its schema, when it has one
     * @returns {Void}
     */
    check() {
        this.problems = this.#schema !== null && this.isValid ? validate(this.value, this.#schema) : [];
    }

    /**
     * Returns the problem of the schema at the given path, if there is one
     * @param {String} pointer
     * @returns {String}
     */
    getProblem(pointer) {
        const problem = this.problems.find((one) => Path.toPointer(one.path) === pointer);
        return problem ? problem.message : "";
    }



    /**
     * Selects what is at the given path, and brings it into view
     * @param {?(String|Number)[]} path
     * @param {Boolean=}           withReveal
     * @returns {Void}
     */
    select(path, withReveal = true) {
        this.selection = path;
        if (path && this.mode === "tree") {
            this.expandTo(path);
        }
        if (this.mode !== "text") {
            this.drawView();
            if (path && withReveal) {
                this.#views[this.mode].reveal(path);
            }
        }
        this.drawFoot();
    }

    /**
     * Opens every container on the way to the given path
     * @param {(String|Number)[]} path
     * @returns {Void}
     */
    expandTo(path) {
        for (let i = 0; i < path.length; i += 1) {
            const parentPath = path.slice(0, i);
            const parent     = Path.get(this.value, parentPath);
            const pointer    = Path.toPointer(parentPath);
            this.expanded.add(pointer);

            // What is past the ones that are shown is shown too
            const keys  = Array.isArray(parent) ? null : Object.keys(parent || {});
            const index = keys ? keys.indexOf(String(path[i])) : Number(path[i]);
            if (index >= (this.limits.get(pointer) || TreeView.PAGE)) {
                this.limits.set(pointer, (Math.floor(index / TreeView.PAGE) + 1) * TreeView.PAGE);
            }
        }
    }

    /**
     * Opens or closes the container at the given path
     * @param {(String|Number)[]} path
     * @returns {Void}
     */
    toggle(path) {
        const pointer = Path.toPointer(path);
        if (this.expanded.has(pointer)) {
            this.expanded.delete(pointer);
        } else {
            this.expanded.add(pointer);
        }
        this.drawView();
    }

    /**
     * Opens every container from the given path down, as far as the tree
     * can be drawn without the page slowing to a stop
     * @param {(String|Number)[]} path
     * @returns {Void}
     */
    expandAll(path) {
        let   count = 0;
        const walk  = (value, at) => {
            if (!Path.isContainer(value) || count > 5000) {
                return;
            }
            this.expanded.add(Path.toPointer(at));
            const isList = Array.isArray(value);
            for (const [ key, child ] of Object.entries(value).slice(0, TreeView.PAGE)) {
                count += 1;
                walk(child, [ ...at, isList ? Number(key) : key ]);
            }
        };
        walk(Path.get(this.value, path), path);
        this.drawView();
        if (count > 5000) {
            this.#toast.show("The document is too large to open all of it at once");
        }
    }

    /**
     * Closes every container from the given path down
     * @param {(String|Number)[]} path
     * @returns {Void}
     */
    collapseAll(path) {
        const pointer = Path.toPointer(path);
        for (const one of [ ...this.expanded ]) {
            if (one.startsWith(`${pointer}/`) || (one === pointer && path.length)) {
                this.expanded.delete(one);
            }
        }
        this.drawView();
    }

    /**
     * Takes what was typed over a key or over a value of the tree or of
     * the table, and says whether it was taken
     * @param {(String|Number)[]} path
     * @param {String}            field
     * @param {String}            text
     * @returns {Boolean}
     */
    commit(path, field, text) {
        if (field === "key") {
            const key    = String(path[path.length - 1]);
            const parent = Path.get(this.value, path.slice(0, -1));
            if (text === key) {
                return false;
            }
            if (Object.prototype.hasOwnProperty.call(parent, text)) {
                this.#toast.show(`There is already a "${Utils.escape(text)}" here`);
                return false;
            }

            // What was open under the old name is open under the new one
            const from = Path.toPointer(path);
            const to   = Path.toPointer([ ...path.slice(0, -1), text ]);
            for (const one of [ ...this.expanded ]) {
                if (one === from || one.startsWith(`${from}/`)) {
                    this.expanded.delete(one);
                    this.expanded.add(to + one.slice(from.length));
                }
            }
            this.setValue(Path.rename(this.value, path, text), [ ...path.slice(0, -1), text ]);
            return true;
        }

        const old = Path.get(this.value, path);
        let value;
        if (Path.isContainer(old)) {
            // A container is typed as the JSON it is
            const parsed = Parse.parse(text);
            if (parsed.value === undefined) {
                this.#toast.show("That is not valid JSON");
                return false;
            }
            value = parsed.value;
        } else {
            // A text that reads as a number stays the text it was
            const wasText = typeof old === "string" && Kinds.readsAsOther(old);
            value = Kinds.parseValue(text, wasText);
        }

        if (JSON.stringify(value) === JSON.stringify(old)) {
            return false;
        }
        this.setValue(Path.set(this.value, path, value), path);
        return true;
    }

    /**
     * Gives the keys to the document
     * @returns {Void}
     */
    focus() {
        this.#views[this.mode].focus();
    }
}
