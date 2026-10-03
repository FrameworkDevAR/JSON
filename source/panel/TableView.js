import Configs from "../core/Configs.js";
import Utils   from "../core/Utils.js";
import Csv     from "../json/Csv.js";
import Format  from "../json/Format.js";
import Kinds   from "../json/Kinds.js";
import Path    from "../json/Path.js";



// How many rows are shown at a time
const PAGE = 200;

// How many lists inside a document are offered to be shown as a table
const MAX_LISTS = 40;

// How much of a container is written in a cell
const MAX_CELL = 80;



/**
 * The Table View, which shows a list as a table: a row for each item and a
 * column for each value the items have. A document that is not a list
 * offers the lists it holds instead
 */
export default class TableView {

    #panel;

    /** @type {Configs} */
    #configs;

    /** @type {HTMLElement} */
    #element;


    /**
     * Table View constructor
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
     * Returns the list the table shows, or nothing when what is at the
     * path of the table is not one
     * @returns {?Array}
     */
    get items() {
        const items = Path.get(this.#panel.value, this.#panel.tablePath);
        return Array.isArray(items) ? items : null;
    }

    /**
     * Returns the columns of the table
     * @returns {String[][]}
     */
    get columns() {
        return this.items ? Csv.getColumns(this.items, this.#configs.get("spreadColumns")) : [];
    }

    /**
     * Draws the list as a table, where it was scrolled to
     * @returns {Void}
     */
    render() {
        const panel = this.#panel;
        const items = this.items;
        if (!items) {
            this.#element.innerHTML = panel.value === undefined ? "" : this.#renderLists();
            return;
        }
        if (!items.length) {
            this.#element.innerHTML = '<div class="table-empty"><h3>The list is empty</h3>' +
                '<p>There is nothing to show as a table yet.</p>' +
                '<button class="btn btn-small" data-action="table-add">Add a row</button></div>';
            return;
        }

        const columns  = this.columns;
        const selected = panel.selection ? Path.toPointer(panel.selection) : null;
        const matches  = new Map();
        if (panel.search.isOpen) {
            for (const [ at, match ] of panel.search.matches.entries()) {
                matches.set(Path.toPointer(match.path), at === panel.search.index);
            }
        }

        const html = [ '<table class="table"><thead><tr><th class="table-corner"></th>' ];
        for (const column of columns) {
            const pointer = Path.toPointer(column);
            const sort    = panel.tableSort && panel.tableSort.pointer === pointer
                ? (panel.tableSort.isDescending ? " is-down" : " is-up") : "";
            html.push(`<th class="table-head${sort}" data-action="table-sort" data-column="${Utils.escape(pointer)}">` +
                `<span>${Utils.escape(Csv.getColumnName(column))}</span><i class="table-arrow"></i></th>`);
        }
        html.push("</tr></thead><tbody>");

        const limit = panel.limits.get("table") || PAGE;
        for (const [ index, item ] of items.slice(0, limit).entries()) {
            const rowPath = [ ...panel.tablePath, index ];
            html.push(`<tr><th class="table-index" data-action="table-menu" data-path="${Utils.escape(Path.toPointer(rowPath))}">${index}</th>`);
            for (const column of columns) {
                const path    = [ ...rowPath, ...column ];
                const pointer = Path.toPointer(path);
                html.push(this.#renderCell(Path.get(item, column), pointer, {
                    isSelected : pointer === selected,
                    isMatch    : matches.has(pointer),
                    isCurrent  : matches.get(pointer) === true,
                    mark       : panel.marks ? panel.marks.get(pointer) : "",
                    problem    : panel.problems.length ? panel.getProblem(pointer) : "",
                }));
            }
            html.push("</tr>");
        }
        html.push("</tbody></table>");
        if (items.length > limit) {
            const rest = items.length - limit;
            html.push(`<div class="table-more" data-action="table-more">Show ${Math.min(rest, PAGE)} more of the ${rest} left</div>`);
        }

        const top  = this.#element.scrollTop;
        const left = this.#element.scrollLeft;
        this.#element.innerHTML  = html.join("");
        this.#element.scrollTop  = top;
        this.#element.scrollLeft = left;
    }

    /**
     * Draws a cell of the table
     * @param {*}      value
     * @param {String} pointer
     * @param {{isSelected: Boolean, isMatch: Boolean, isCurrent: Boolean, mark: String, problem: String}} state
     * @returns {String}
     */
    #renderCell(value, pointer, state) {
        const kind    = value === undefined ? "missing" : Kinds.typeOf(value);
        const classes = [ "table-cell", `is-${kind}` ];
        if (state.isSelected) {
            classes.push("selected");
        }
        if (state.isMatch) {
            classes.push("is-match");
        }
        if (state.isCurrent) {
            classes.push("is-current");
        }
        if (state.mark && state.mark !== "inside") {
            classes.push(`is-${state.mark}`);
        }
        if (state.problem) {
            classes.push("has-problem");
        }

        let text = "";
        if (kind === "object" || kind === "array") {
            text = Utils.escape(Format.preview(value, MAX_CELL));
        } else if (kind === "string") {
            const swatch = this.#configs.get("showTags") && Kinds.isColor(value)
                ? `<i class="tree-swatch" style="background-color:${Utils.escape(value)}"></i>` : "";
            text = swatch + Utils.escape(value.length > MAX_CELL * 2 ? `${value.slice(0, MAX_CELL * 2)}…` : value);
        } else if (kind !== "missing") {
            text = String(value);
        }

        const tip = state.problem ? ` data-tip="${Utils.escape(state.problem)}" data-tip-top` : "";
        return `<td class="${classes.join(" ")}" data-action="table-select" data-path="${Utils.escape(pointer)}"${tip}>${text}</td>`;
    }

    /**
     * Draws the lists a document that is not one holds, to pick the one
     * to show as a table
     * @returns {String}
     */
    #renderLists() {
        const lists = [];
        const walk  = (value, path, depth) => {
            if (lists.length >= MAX_LISTS || !Path.isContainer(value) || depth > 5) {
                return;
            }
            if (Array.isArray(value)) {
                if (path.length) {
                    lists.push({ path, count : value.length });
                }
                return;
            }
            for (const [ key, child ] of Object.entries(value)) {
                walk(child, [ ...path, key ], depth + 1);
            }
        };
        walk(Path.get(this.#panel.value, this.#panel.tablePath), this.#panel.tablePath, 0);

        const items = lists.map((list) => '<li data-action="table-open" ' +
            `data-path="${Utils.escape(Path.toPointer(list.path))}">` +
            `<span>${Utils.escape(Path.toText(list.path, this.#panel.value))}</span>` +
            `<b>${list.count === 1 ? "1 item" : `${list.count} items`}</b></li>`).join("");

        return '<div class="table-empty"><h3>A table shows a list</h3>' +
            (items
                ? `<p>This is not one, but it holds these. Pick the one to show.</p><ol class="table-lists">${items}</ol>`
                : "<p>This document is not a list and holds none, so there is nothing to show as a table.</p>") +
            "</div>";
    }



    /**
     * Returns the cell of what is at the given path, if it is drawn
     * @param {(String|Number)[]} path
     * @returns {?HTMLElement}
     */
    #getCell(path) {
        const pointer = Path.toPointer(path);
        for (const cell of this.#element.querySelectorAll(".table-cell")) {
            if (cell instanceof HTMLElement && cell.dataset.path === pointer) {
                return cell;
            }
        }
        return null;
    }

    /**
     * Brings the cell of the given path into view, showing the rows down
     * to it when it is past the ones that are shown
     * @param {(String|Number)[]} path
     * @returns {Void}
     */
    reveal(path) {
        const index = Number(path[this.#panel.tablePath.length]);
        const limit = this.#panel.limits.get("table") || PAGE;
        if (index >= limit) {
            this.#panel.limits.set("table", (Math.floor(index / PAGE) + 1) * PAGE);
            this.render();
        }
        const cell = this.#getCell(path);
        if (cell) {
            cell.scrollIntoView({ block : "nearest", inline : "nearest" });
        }
    }

    /**
     * Shows more of the rows
     * @returns {Void}
     */
    showMore() {
        this.#panel.limits.set("table", (this.#panel.limits.get("table") || PAGE) + PAGE);
        this.render();
    }

    /**
     * Gives the keys to the table
     * @returns {Void}
     */
    focus() {
        this.#element.focus({ preventScroll : true });
    }

    /**
     * Returns true if a cell is being typed over
     * @returns {Boolean}
     */
    get isEditing() {
        return Boolean(this.#element.querySelector(".table-input"));
    }

    /**
     * Lets the cell at the given path be typed over. A container is typed
     * as the JSON it is
     * @param {(String|Number)[]} path
     * @returns {Boolean}
     */
    edit(path) {
        const cell = this.#getCell(path);
        if (!cell) {
            return false;
        }

        const value = Path.get(this.#panel.value, path);
        const input = document.createElement("input");
        input.type       = "text";
        input.className  = "table-input";
        input.spellcheck = false;
        input.value      = value === undefined ? "" : (Path.isContainer(value) ? Format.compact(value) : Kinds.toInput(value));

        let isDone = false;
        const end  = (isTaken) => {
            if (isDone) {
                return;
            }
            isDone = true;

            // A cell with nothing in it that is left empty stays that way
            const isSame = value === undefined && !input.value;
            if (!isTaken || isSame || !this.#panel.commit(path, "value", input.value)) {
                this.#panel.drawView();
            }
            this.focus();
        };

        input.addEventListener("blur", () => end(true));
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                end(true);
            } else if (e.key === "Escape") {
                e.preventDefault();
                end(false);
            }
            e.stopPropagation();
        });

        cell.style.minWidth = `${cell.offsetWidth}px`;
        cell.innerHTML = "";
        cell.appendChild(input);
        input.focus();
        input.select();
        return true;
    }
}
