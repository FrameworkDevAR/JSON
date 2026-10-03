import Configs from "../core/Configs.js";
import Format  from "../json/Format.js";
import Parse   from "../json/Parse.js";
import Syntax  from "../json/Syntax.js";



// The text past which it is shown plain, with no colors, no folding and no
// wrapping, since drawing it line by line at every letter would make the
// typing slow
const MAX_PAINT = 250000;

// What a line and the space around the text measure, which the stylesheet
// says the same way
const LINE_HEIGHT = 20;
const PADDING     = 12;

// The characters that stand for what is folded. They are from the part of
// Unicode that is kept for private use, so no text has a reason to hold one
const FOLD_FROM = 0xE000;
const FOLD_TO   = 0xF8FF;
const FOLDS     = /[-]/g;



/**
 * The Text View, which shows the document as the text it is. The text is
 * typed in an area that shows nothing but the caret and the selection, and
 * under it the same text is painted line by line, in the color of each of
 * its parts and with its number beside it. What is folded is taken out of
 * the area and a single character is left in its place, which is put back
 * as what it stands for whenever the text is asked for
 */
export default class TextView {

    #panel;

    /** @type {Configs} */
    #configs;

    /** @type {HTMLElement} */
    #scroll;
    /** @type {HTMLElement} */
    #code;
    /** @type {HTMLTextAreaElement} */
    #area;
    /** @type {HTMLElement} */
    #paint;
    /** @type {HTMLElement} */
    #lines;

    /** @type {Map<String, {text: String, lines: Number}>} */
    #folds = new Map();

    /** @type {Map<Number, {start: Number, end: Number}>} */
    #regions = new Map();

    /** @type {Number[]} */
    #numbers = [ 1 ];

    /** @type {?Element} */
    #active = null;

    #nextFold  = FOLD_FROM;
    #lineCount = 0;
    #letter    = 0;
    #isPlain   = false;


    /**
     * Text View constructor
     * @param {Object}      panel
     * @param {HTMLElement} element
     * @param {Configs}     configs
     */
    constructor(panel, element, configs) {
        this.#panel   = panel;
        this.#configs = configs;
        this.#scroll  = element.querySelector(".text-scroll");
        this.#code    = element.querySelector(".text-code");
        this.#area    = element.querySelector("textarea");
        this.#paint   = element.querySelector(".text-paint");
        this.#lines   = element.querySelector(".text-lines");

        this.#area.addEventListener("input", () => {
            this.#panel.edit(this.#expand(this.#area.value));
            this.draw();
        });
        this.#area.addEventListener("keydown", (e) => {
            if (this.#handleKey(e)) {
                e.preventDefault();
            }
        });

        // What is copied is the text with what is folded in it, and not the
        // character that stands for it
        for (const name of [ "copy", "cut" ]) {
            this.#area.addEventListener(name, (e) => {
                if (!(e instanceof ClipboardEvent) || !e.clipboardData || !this.#folds.size) {
                    return;
                }
                e.clipboardData.setData("text/plain", this.selected);
                e.preventDefault();
                if (name === "cut") {
                    const start = this.#area.selectionStart;
                    this.#type("", start, this.#area.selectionEnd, start);
                }
            });
        }

        // Where the caret is is said as it moves, which only the page hears
        document.addEventListener("selectionchange", () => {
            if (document.activeElement === this.#area) {
                this.drawActive();
                this.#panel.drawFoot();
            }
        });
    }

    /**
     * Returns where the caret is in the document, and how much is selected
     * @returns {{line: Number, column: Number, selected: Number}}
     */
    get place() {
        const text  = this.#area.value;
        const start = this.#area.selectionStart;
        const from  = text.lastIndexOf("\n", start - 1) + 1;

        let index = 0;
        for (let i = text.indexOf("\n"); i !== -1 && i < start; i = text.indexOf("\n", i + 1)) {
            index += 1;
        }
        return {
            line     : this.#numbers[index] || index + 1,
            column   : start - from + 1,
            selected : this.selected.length,
        };
    }

    /**
     * Returns the text that is selected, with what is folded in it
     * @returns {String}
     */
    get selected() {
        return this.#expand(this.#area.value.slice(this.#area.selectionStart, this.#area.selectionEnd));
    }

    /**
     * Shows the text of the document. A text that is not the one being
     * shown is shown with nothing folded
     * @returns {Void}
     */
    render() {
        if (this.#expand(this.#area.value) !== this.#panel.text) {
            const start = this.#area.selectionStart;
            this.#folds.clear();
            this.#nextFold   = FOLD_FROM;
            this.#area.value = this.#panel.text;
            this.#area.setSelectionRange(start, start);
        }
        this.draw();
    }

    /**
     * Paints the text under the area, line by line, each with its number
     * and with what folds or unfolds it
     * @returns {Void}
     */
    draw() {
        const text     = this.#area.value;
        const isPlain  = text.length > MAX_PAINT;
        const isWrap   = !isPlain && this.#configs.get("wrapText");

        this.#isPlain = isPlain;
        this.#scroll.classList.toggle("is-plain", isPlain);
        this.#scroll.classList.toggle("is-wrap", isWrap);
        this.#area.setAttribute("wrap", isWrap ? "soft" : "off");
        if (isPlain) {
            this.#paint.innerHTML = "";
            this.#drawPlain(text);
            return;
        }

        const lines   = text.split("\n");
        const painted = (this.#configs.get("paintCode") ? Syntax.paint(text) : Syntax.escape(text)).split("\n");
        const html    = [];

        this.#regions = findRegions(text);
        this.#numbers = [];

        let number = 1;
        for (const [ index, line ] of lines.entries()) {
            this.#numbers.push(number);
            number += 1;

            // What is folded on a line takes its lines along, and the line
            // unfolds it rather than fold what it is in
            let fold = "";
            const folded = line.match(FOLDS);
            if (folded && folded.some((char) => this.#folds.has(char))) {
                for (const char of folded) {
                    number += this.#folds.has(char) ? this.#folds.get(char).lines : 0;
                }
                fold = `<i class="text-fold is-folded" data-action="text-fold" data-line="${index}"></i>`;
            } else if (this.#regions.has(index)) {
                fold = `<i class="text-fold" data-action="text-fold" data-line="${index}"></i>`;
            }

            const source = painted[index].replace(FOLDS, (char) => (
                this.#folds.has(char) ? `<span class="text-pill">${char}</span>` : char
            ));
            html.push(`<div class="text-line"><span class="text-num" data-action="text-line" data-line="${index}">${this.#numbers[index]}${fold}</span>` +
                `<span class="text-src">${source}</span></div>`);
        }

        this.#code.style.setProperty("--digits", String(String(number - 1).length));
        this.#paint.innerHTML = html.join("");
        this.#active = null;
        this.drawActive();
        this.drawMark();
    }

    /**
     * Marks the line the caret is on, the way a row of the tree is marked
     * when it is selected
     * @returns {Void}
     */
    drawActive() {
        if (this.#isPlain) {
            return;
        }
        const text  = this.#area.value;
        const start = this.#area.selectionStart;
        let   index = 0;
        for (let i = text.indexOf("\n"); i !== -1 && i < start; i = text.indexOf("\n", i + 1)) {
            index += 1;
        }

        const line = this.#paint.children[index] || null;
        if (line === this.#active) {
            return;
        }
        if (this.#active) {
            this.#active.classList.remove("is-active");
        }
        if (line) {
            line.classList.add("is-active");
        }
        this.#active = line;
    }

    /**
     * Selects the whole of the given line, as touching its number asks for
     * @param {Number} index
     * @returns {Void}
     */
    selectLine(index) {
        const lines = this.#area.value.split("\n");
        const start = lines.slice(0, index).reduce((total, line) => total + line.length + 1, 0);
        const end   = Math.min(start + (lines[index] || "").length + 1, this.#area.value.length);

        this.#area.focus({ preventScroll : true });
        this.#area.setSelectionRange(start, end);
        this.drawActive();
        this.#panel.drawFoot();
    }

    /**
     * Shows a long text plain: the area shows it, and its lines are
     * counted beside it in the one column
     * @param {String} text
     * @returns {Void}
     */
    #drawPlain(text) {
        let count  = 1;
        let widest = 0;
        let from   = 0;
        for (let i = text.indexOf("\n"); i !== -1; i = text.indexOf("\n", i + 1)) {
            widest = Math.max(widest, i - from);
            from   = i + 1;
            count += 1;
        }
        widest = Math.max(widest, text.length - from);

        // A tab takes up to four letters, so the lines are given room as if
        // every one of them had a few
        this.#code.style.setProperty("--columns", String(widest + 24));
        this.#code.style.setProperty("--rows", String(count));

        if (count !== this.#lineCount) {
            this.#lineCount = count;
            let numbers = "";
            for (let i = 1; i <= count; i += 1) {
                numbers += `${i}\n`;
            }
            this.#lines.textContent = numbers;
        }
    }

    /**
     * Marks the line where the text stops being JSON
     * @returns {Void}
     */
    drawMark() {
        const { error } = this.#panel;
        for (const line of this.#paint.querySelectorAll(".text-line.is-error")) {
            line.classList.remove("is-error");
        }
        if (!error || this.#isPlain) {
            return;
        }

        // A line that is folded away is marked on the line that holds it
        let index = this.#numbers.length - 1;
        while (index > 0 && this.#numbers[index] > error.line) {
            index -= 1;
        }
        const line = this.#paint.children[index];
        if (line) {
            line.classList.add("is-error");
        }
    }



    /**
     * Returns the text with everything that is folded in it put back
     * @param {String} text
     * @returns {String}
     */
    #expand(text) {
        if (!this.#folds.size) {
            return text;
        }
        return text.replace(FOLDS, (char) => (this.#folds.has(char) ? this.#expand(this.#folds.get(char).text) : char));
    }

    /**
     * Returns a character no fold and no part of the text is using, or
     * nothing when they are all taken
     * @param {String} text
     * @returns {String}
     */
    #getFold(text) {
        while (this.#nextFold <= FOLD_TO) {
            const char = String.fromCharCode(this.#nextFold);
            this.#nextFold += 1;
            if (!text.includes(char)) {
                return char;
            }
        }
        return "";
    }

    /**
     * Folds what the given line opens, or unfolds what is folded on it
     * @param {Number} index
     * @returns {Void}
     */
    toggleFold(index) {
        const text  = this.#area.value;
        const lines = text.split("\n");
        const from  = lines.slice(0, index).reduce((total, line) => total + line.length + 1, 0);
        const line  = lines[index] || "";
        let   caret = this.#area.selectionStart;

        // What is folded on the line is put back, the first of it
        let at = -1;
        for (let i = 0; i < line.length && at === -1; i += 1) {
            at = this.#folds.has(line[i]) ? i : -1;
        }
        if (at !== -1) {
            const inner = this.#folds.get(line[at]).text;
            this.#folds.delete(line[at]);
            this.#area.value = text.slice(0, from + at) + inner + text.slice(from + at + 1);
            caret = caret > from + at ? caret + inner.length - 1 : caret;
        } else {
            const region = this.#regions.get(index);
            const char   = region ? this.#getFold(this.#panel.text) : "";
            if (!char) {
                return;
            }
            const inner = text.slice(region.start, region.end);
            this.#folds.set(char, { text : inner, lines : countLines(this.#expand(inner)) });
            this.#area.value = text.slice(0, region.start) + char + text.slice(region.end);
            if (caret > region.start) {
                caret = caret < region.end ? region.start : caret - inner.length + 1;
            }
        }
        this.#area.setSelectionRange(caret, caret);
        this.draw();
        this.#panel.drawFoot();
    }

    /**
     * Folds everything that can be folded, from what is furthest in to
     * what holds it all, so each thing that is unfolded shows what it
     * holds still folded
     * @returns {Boolean}
     */
    foldAll() {
        if (this.#isPlain) {
            return false;
        }
        let text = this.#expand(this.#area.value);
        this.#folds.clear();
        this.#nextFold = FOLD_FROM;

        for (;;) {
            // The ones that hold no other are folded together, which leaves
            // the ones that held them as the ones to fold next
            const regions = [ ...findRegions(text).values() ].sort((one, other) => one.start - other.start);
            const inner   = regions.filter((region, index) => {
                const next = regions[index + 1];
                return !next || next.start >= region.end;
            });
            if (!inner.length) {
                break;
            }

            let result = "";
            let last   = 0;
            let isFull = false;
            for (const region of inner) {
                const char = this.#getFold(this.#panel.text);
                if (!char) {
                    isFull = true;
                    break;
                }
                const part = text.slice(region.start, region.end);
                this.#folds.set(char, { text : part, lines : countLines(this.#expand(part)) });
                result += text.slice(last, region.start) + char;
                last    = region.end;
            }
            text = result + text.slice(last);
            if (isFull) {
                break;
            }
        }

        this.#area.value = text;
        this.#area.setSelectionRange(0, 0);
        this.#scroll.scrollTop = 0;
        this.draw();
        return true;
    }

    /**
     * Unfolds everything that is folded
     * @returns {Boolean}
     */
    unfoldAll() {
        if (!this.#folds.size) {
            return false;
        }
        const caret = this.#expand(this.#area.value.slice(0, this.#area.selectionStart)).length;
        this.#area.value = this.#expand(this.#area.value);
        this.#folds.clear();
        this.#nextFold = FOLD_FROM;
        this.#area.setSelectionRange(caret, caret);
        this.draw();
        return true;
    }



    /**
     * Selects the given part of the document, and brings it into view.
     * Everything is unfolded first, as what is asked for may be folded away
     * @param {Number} start
     * @param {Number} end
     * @returns {Void}
     */
    select(start, end) {
        this.unfoldAll();
        this.#area.focus({ preventScroll : true });
        this.#area.setSelectionRange(start, end);
        this.drawActive();

        const { line, column } = Parse.lineOf(this.#area.value, start);
        const element = this.#paint.children[line - 1];
        const top     = element instanceof HTMLElement ? element.offsetTop - PADDING : (line - 1) * LINE_HEIGHT;
        const height  = this.#scroll.clientHeight;
        if (top < this.#scroll.scrollTop || top > this.#scroll.scrollTop + height - LINE_HEIGHT * 3) {
            this.#scroll.scrollTop = Math.max(top - height / 3, 0);
        }

        const left = column * this.#getLetter();
        if (left < this.#scroll.scrollLeft || left > this.#scroll.scrollLeft + this.#scroll.clientWidth - 120) {
            this.#scroll.scrollLeft = Math.max(left - this.#scroll.clientWidth / 2, 0);
        }
        this.#panel.drawFoot();
    }

    /**
     * Returns how wide a letter is drawn, which is asked of the page once
     * @returns {Number}
     */
    #getLetter() {
        if (!this.#letter) {
            const probe = document.createElement("span");
            probe.className   = "text-src";
            probe.textContent = "0".repeat(20);
            this.#code.appendChild(probe);
            this.#letter = probe.getBoundingClientRect().width / 20 || 7;
            probe.remove();
        }
        return this.#letter;
    }

    /**
     * Brings into view where the value at the given path is written
     * @param {(String|Number)[]} path
     * @returns {Void}
     */
    reveal(path) {
        const found = Parse.locate(this.#panel.text, path);
        if (found) {
            this.select(found.start, found.end);
        }
    }

    /**
     * Gives the keys to the area
     * @returns {Void}
     */
    focus() {
        this.#area.focus({ preventScroll : true });
    }

    /**
     * Types the given text where the caret is, as if it had been typed
     * @param {String} text
     * @param {Number} start
     * @param {Number} end
     * @param {Number} caret
     * @returns {Void}
     */
    #type(text, start, end, caret) {
        this.#area.setRangeText(text, start, end, "end");
        this.#area.setSelectionRange(caret, caret);
        this.#panel.edit(this.#expand(this.#area.value));
        this.draw();
    }

    /**
     * Does what a few keys do in an editor rather than in a form: the tab
     * sets a line in, and a new line starts as far in as the one before it,
     * or one more when that one opened a bracket
     * @param {KeyboardEvent} event
     * @returns {Boolean}
     */
    #handleKey(event) {
        if (event.metaKey || event.ctrlKey || event.altKey) {
            return false;
        }
        const indent = Format.indentOf(this.#configs.get("indent"));
        const text   = this.#area.value;
        const start  = this.#area.selectionStart;
        const end    = this.#area.selectionEnd;

        if (event.key === "Tab" && !event.shiftKey) {
            this.#type(indent, start, end, start + indent.length);
            return true;
        }
        if (event.key !== "Enter") {
            return false;
        }

        const lineStart = text.lastIndexOf("\n", start - 1) + 1;
        const before    = text.slice(lineStart, start);
        const lead      = before.match(/^[ \t]*/)[0];
        const opens     = /[{[]\s*$/.test(before);
        const closes    = opens && /^\s*[}\]]/.test(text.slice(end));

        let insert = `\n${lead}${opens ? indent : ""}`;
        const caret = start + insert.length;
        if (closes) {
            insert += `\n${lead}`;
        }
        this.#type(insert, start, end, caret);
        return true;
    }
}



/**
 * Returns how many lines the text adds to the one it starts on
 * @param {String} text
 * @returns {Number}
 */
function countLines(text) {
    let count = 0;
    for (let i = text.indexOf("\n"); i !== -1; i = text.indexOf("\n", i + 1)) {
        count += 1;
    }
    return count;
}

/**
 * Returns what can be folded on each line of the text: what is between a
 * bracket the line opens and the one that closes it on a later line. When
 * a line opens more than one, it folds the one that holds the others
 * @param {String} text
 * @returns {Map<Number, {start: Number, end: Number}>}
 */
function findRegions(text) {
    const result = new Map();
    const opens  = [];
    let   line   = 0;
    let   inText = false;

    for (let i = 0; i < text.length; i += 1) {
        const char = text[i];
        if (char === "\n") {
            line  += 1;
            inText = false;
        } else if (inText) {
            if (char === "\\") {
                i += 1;
            } else if (char === "\"") {
                inText = false;
            }
        } else if (char === "\"") {
            inText = true;
        } else if (char === "{" || char === "[") {
            opens.push({ at : i, line });
        } else if ((char === "}" || char === "]") && opens.length) {
            const open = opens.pop();
            if (open.line < line) {
                result.set(open.line, { start : open.at + 1, end : i });
            }
        }
    }
    return result;
}
