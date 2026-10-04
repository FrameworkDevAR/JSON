import * as App     from "../App.js";
import * as Compare from "./Compare.js";
import * as Search  from "./Search.js";
import Panel        from "../panel/Panel.js";
import Link         from "../core/Link.js";
import Utils        from "../core/Utils.js";
import Csv          from "../json/Csv.js";
import Format       from "../json/Format.js";
import Path         from "../json/Path.js";



// A document with a bit of everything in it, to see the app at work
const EXAMPLE = {
    name : "team.json",
    text : JSON.stringify({
        team    : "Platform",
        active  : true,
        founded : 1420070400000,
        site    : "https://frameworkphp.com.ar",
        color   : "#6366f1",
        members : [
            { id : 1, name : "Ana", role : "lead", age : 34, address : { city : "Rosario", zip : "2000" }, tags : [ "php", "sql" ] },
            { id : 2, name : "Beto", role : "developer", age : 27, address : { city : "Salta", zip : "4400" }, tags : [ "js" ] },
            { id : 3, name : "Caro", role : "developer", age : 41, address : { city : "Rosario", zip : "2000" }, tags : [ "js", "css" ] },
            { id : 4, name : "Dani", role : "designer", age : 30, address : { city : "Mendoza", zip : "5500" }, tags : [] },
        ],
        budget  : { currency : "ARS", amount : 1250000.5, approved : null },
    }, null, 4),
};

// How long a document rests before it is kept, in the Storage and in the
// History, so neither is written at every letter
const KEEP_PAUSE     = 400;
const REMEMBER_PAUSE = 1200;

// The timers that hold each side back
const timers = { left : { keep : 0, remember : 0 }, right : { keep : 0, remember : 0 } };

// Whether the document of each side is one the browser has no room to keep
const unkept = { left : false, right : false };

// True while the address is being followed rather than led, and true once
// a document was opened, which is a step to go back to
let isMoving  = false;
let isNewStep = false;



/**
 * Puts the documents back the way they were left, and then shows what the
 * address asks for, when it asks for something
 * @returns {Promise}
 */
export async function start() {
    setOnly(App.storage.getOnly());

    isMoving = true;
    for (const side of App.SIDES) {
        const panel = App.panels[side];
        const doc   = App.storage.getDoc(side);
        panel.setSchema(App.storage.getSchema(side));
        panel.element.classList.toggle("has-schema", Boolean(panel.schemaText));
        panel.load(doc, { docID : doc.docID, mode : doc.mode });
        panel.onChange = handleChange;
        drawSaved(panel);
    }
    isMoving = false;

    App.setActive(App.panels.left);
    await openAddress(true);
    if (App.storage.getFlag("compare")) {
        Compare.setComparing(true);
    }
}

/**
 * Keeps a document that changed, and shows whatever follows it
 * @param {Panel}  panel
 * @param {String} kind
 * @returns {Void}
 */
function handleChange(panel, kind) {
    const timer = timers[panel.side];
    window.clearTimeout(timer.keep);
    window.clearTimeout(timer.remember);

    // A document that was opened is kept right away, and one being worked
    // on once the work rests
    if (kind === "load") {
        isNewStep = true;
        keep(panel);
        remember(panel);
    } else {
        timer.keep = window.setTimeout(() => keep(panel), KEEP_PAUSE);
        if (kind !== "mode") {
            timer.remember = window.setTimeout(() => remember(panel), REMEMBER_PAUSE);
        }
    }

    if (kind !== "name") {
        Search.refresh(panel);
        Compare.refresh();
    }
}

/**
 * Keeps the document of the Panel for the next visit
 * @param {Panel} panel
 * @returns {Void}
 */
function keep(panel) {
    App.storage.setDoc(panel.side, panel.doc);
}

/**
 * Keeps the document of the Panel in the History, where it takes the place
 * of what it was the last time it was kept
 * @param {Panel} panel
 * @returns {Void}
 */
function remember(panel) {
    if (panel.isEmpty) {
        unkept[panel.side] = false;
        if (panel.docID) {
            panel.docID = 0;
            keep(panel);
        }
    } else {
        const entry = App.history.keep(panel.docID, { name : panel.name, text : panel.text }, panel.info, App.otherOf(panel).docID);
        if (entry.id !== panel.docID) {
            panel.docID = entry.id;
            keep(panel);
        }

        // A document the browser has no room for is said to be so once
        if (!entry.id && !unkept[panel.side]) {
            App.toast.show("The document is too large to be kept, and will be gone when the page closes");
        }
        unkept[panel.side] = !entry.id;
    }
    drawSaved(panel);
    setAddress();
}

/**
 * Says on the Panel whether its document is saved in the History for good
 * @param {Panel} panel
 * @returns {Void}
 */
export function drawSaved(panel) {
    const entry = App.history.get(panel.docID);
    panel.element.classList.toggle("is-saved", Boolean(entry && entry.isPinned));
}



/**
 * Takes the address to the documents being looked at, as the places they
 * have in the History. Opening a document is a step to go back to, and
 * working on one is not, unless a step back or forward has just led here
 * @returns {Void}
 */
function setAddress() {
    const left  = App.panels.left.docID;
    const right = App.panels.right.docID;
    const hash  = left || right ? `#h=${left}${right ? `,${right}` : ""}` : "";
    if (window.location.hash === hash) {
        isNewStep = false;
        return;
    }

    const address = window.location.pathname + window.location.search + hash;
    if (isMoving || !isNewStep) {
        window.history.replaceState(null, "", address);
    } else {
        window.history.pushState(null, "", address);
    }
    isNewStep = false;
}

/**
 * Shows what the address asks for: the documents of the History it names,
 * or the ones a link carries. It is what runs when the page opens and when
 * going back and forward, where the address is already the one to be at.
 * An address that asks for nothing leaves the documents as they are, and
 * is given back the places they have
 * @param {Boolean=} isStart
 * @returns {Promise}
 */
export async function openAddress(isStart = false) {
    isMoving = true;
    try {
        if (!openEntries(isStart) && !await openLink()) {
            setAddress();
        }
    } finally {
        isMoving = false;
    }
}

/**
 * Puts the documents the address names in, each on its side, and says
 * whether the address names any. The page opens with the right side as
 * it was left when the address only names the left one
 * @param {Boolean} isStart
 * @returns {Boolean}
 */
function openEntries(isStart) {
    const match = window.location.hash.match(/^#h=(\d+)(?:,(\d+))?$/);
    if (!match) {
        return false;
    }

    const ids = { left : Number(match[1]), right : Number(match[2] || 0) };
    for (const side of App.SIDES) {
        const panel = App.panels[side];
        const id    = ids[side];
        if (id === panel.docID) {
            continue;
        }
        const entry = App.history.get(id);
        if (entry) {
            panel.load({ name : entry.fileName, text : entry.text }, { docID : id });
        } else if (id) {
            App.toast.show("That document is not in the history anymore");
        } else if (!isStart && !panel.isEmpty) {
            panel.load({ name : "", text : "" });
        }
    }
    setAddress();
    return true;
}

/**
 * Puts the documents of the link in the address in, and says whether
 * there were any. Each is then kept in the History, and its address there
 * takes the place of the link
 * @returns {Promise<Boolean>}
 */
async function openLink() {
    if (window.location.hash.length < 2) {
        return false;
    }

    let link = null;
    try {
        link = await Link.read(window.location.hash);
    } catch (error) {
        App.toast.show(error.message);
    }
    if (!link) {
        return false;
    }

    for (const side of App.SIDES) {
        if (link[side]) {
            App.panels[side].load(link[side], { mode : link.mode || "tree" });
        }
    }
    if (link.right) {
        setOnly("");
    }
    if (link.isComparing) {
        Compare.setComparing(true);
    }
    return true;
}



/**
 * Starts a new document in the Panel
 * @param {Panel} panel
 * @returns {Boolean}
 */
export function newDocument(panel) {
    panel.load({ name : "", text : "" }, { mode : "text" });
    panel.focus();
    return true;
}

/**
 * Puts the example in the Panel
 * @param {Panel} panel
 * @returns {Boolean}
 */
export function loadExample(panel) {
    panel.load(EXAMPLE, { mode : "tree" });
    return true;
}

/**
 * Asks for a file and puts it in the Panel
 * @param {Panel} panel
 * @returns {Void}
 */
export function uploadFile(panel) {
    Utils.selectFile((file) => {
        loadFile(panel, file);
    });
}

/**
 * Reads the file into the Panel. One that is a CSV is read as the list of
 * objects it is
 * @param {Panel} panel
 * @param {File}  file
 * @returns {Promise}
 */
export async function loadFile(panel, file) {
    if (!file) {
        return;
    }
    const text = await Utils.readFile(file);
    loadText(panel, file.name, text);
}

/**
 * Puts the text in the Panel as a document with the given name, reading
 * a CSV as the list it is
 * @param {Panel}  panel
 * @param {String} name
 * @param {String} text
 * @returns {Void}
 */
function loadText(panel, name, text) {
    if (/\.(csv|tsv)$/i.test(name) || Csv.isCsv(text)) {
        const items = Csv.read(text);
        panel.load({
            name : name.replace(/\.(csv|tsv)$/i, ".json"),
            text : Format.stringify(items, App.configs.get("indent")),
        }, { mode : "table" });
        App.toast.show("The CSV was read as a list");
        return;
    }
    panel.load({ name, text }, { mode : panel.mode === "text" ? "tree" : panel.mode });
}

/**
 * Takes what was pasted over a Panel with no document as its document,
 * and says whether there was anything to take
 * @param {Panel}  panel
 * @param {String} text
 * @returns {Boolean}
 */
export function pasteDocument(panel, text) {
    if (!text.trim()) {
        return false;
    }
    loadText(panel, "", text);
    panel.focus();
    return true;
}

/**
 * Starts the document of the Panel as an object or as a list with nothing
 * in it, to be filled from the tree or from the table
 * @param {Panel}  panel
 * @param {String} kind
 * @returns {Boolean}
 */
export function newValue(panel, kind) {
    panel.setValue(kind === "array" ? [] : {}, []);
    panel.focus();
    return true;
}

/**
 * Puts the dropped files in: two go one to each side, in the order they
 * were dropped, and one goes where it was dropped
 * @param {Panel}    panel
 * @param {FileList} files
 * @returns {Promise}
 */
export async function dropFiles(panel, files) {
    if (files.length >= 2) {
        setOnly("");
        await loadFile(App.panels.left, files[0]);
        await loadFile(App.panels.right, files[1]);
        return;
    }
    await loadFile(panel, files[0]);
}

/**
 * Opens the Dialog that asks for the address of a document
 * @returns {Boolean}
 */
export function openUrl() {
    App.opener.open();
    return true;
}

/**
 * Fetches the document at the address that was typed and puts it in the
 * Panel being worked on
 * @returns {Promise}
 */
export async function loadUrl() {
    const url = App.opener.getText();
    if (!/^https?:\/\//i.test(url)) {
        App.opener.showError("The address has to start with http:// or https://");
        return;
    }

    let text = "";
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`The address answered ${response.status}`);
        }
        text = await response.text();
    } catch (error) {
        // A page of another site can only be read when that site allows it
        App.opener.showError(error instanceof TypeError
            ? "The document could not be fetched, which is usually the site not allowing it"
            : error.message);
        return;
    }

    App.opener.close();
    const name = decodeURIComponent(url.split(/[?#]/)[0].split("/").pop() || "");
    loadText(App.active, name, text);
}

/**
 * Hands the document of the Panel over as a file
 * @param {Panel} panel
 * @returns {Boolean}
 */
export function saveFile(panel) {
    if (panel.isEmpty) {
        App.toast.show("There is nothing to save yet");
        return false;
    }
    const name = panel.name || "document.json";
    Utils.download(/\.[a-z0-9]+$/i.test(name) ? name : `${name}.json`, panel.text, "application/json");
    return true;
}

/**
 * Hands the list of the Panel over as a CSV: the one the table shows, or
 * the document when it is a list
 * @param {Panel} panel
 * @returns {Boolean}
 */
export function exportCsv(panel) {
    const items = Array.isArray(Path.get(panel.value, panel.tablePath)) ? Path.get(panel.value, panel.tablePath) : panel.value;
    if (!Array.isArray(items)) {
        App.toast.show("Only a list can be written as a CSV");
        return false;
    }
    const name = (panel.name || "document.json").replace(/\.[a-z0-9]+$/i, "");
    Utils.download(`${name}.csv`, Csv.write(items), "text/csv");
    return true;
}

/**
 * Puts the document of the Panel where the next paste takes it from
 * @param {Panel} panel
 * @returns {Boolean}
 */
export function copyDocument(panel) {
    if (panel.isEmpty) {
        App.toast.show("There is nothing to copy yet");
        return false;
    }
    Utils.copy(panel.text).then((isCopied) => {
        App.toast.show(isCopied ? "The document is copied" : "The browser did not let it be copied");
    });
    return true;
}

/**
 * Puts the document of the given side in the other one
 * @param {String} side
 * @returns {Boolean}
 */
export function copyAcross(side) {
    const from = App.panels[side];
    const to   = App.otherOf(from);
    if (from.isEmpty) {
        App.toast.show("There is nothing to copy yet");
        return false;
    }
    to.load({ name : from.name, text : from.text }, { mode : from.mode });
    App.setActive(to);
    return true;
}

/**
 * Puts the document of the Panel where the next paste takes it from, in
 * the one line
 * @param {Panel} panel
 * @returns {Boolean}
 */
export function copyCompact(panel) {
    if (!panel.isValid) {
        App.toast.show("Only valid JSON can be written in one line");
        return false;
    }
    Utils.copy(Format.compact(panel.value)).then((isCopied) => {
        App.toast.show(isCopied ? "The document is copied, in one line" : "The browser did not let it be copied");
    });
    return true;
}

/**
 * Shows the Panel of the given side alone, or the two of them side by
 * side when no side is given
 * @param {String} side
 * @returns {Void}
 */
export function setOnly(side) {
    const only = App.SIDES.includes(side) ? side : "";
    for (const one of App.SIDES) {
        document.body.classList.toggle(`only-${one}`, one === only);
    }
    App.storage.setOnly(only);

    if (only) {
        Compare.setComparing(false);
        App.setActive(App.panels[only]);
    }
    for (const one of App.SIDES) {
        App.panels[one].drawHead(false);
    }
}

/**
 * Returns the side of the Panel that is shown alone, if one is
 * @returns {String}
 */
export function getOnly() {
    return App.SIDES.find((side) => document.body.classList.contains(`only-${side}`)) || "";
}

/**
 * Gives the Panel the whole of the page, or gives the other one its half
 * back when it already has it
 * @param {Panel} panel
 * @returns {Boolean}
 */
export function toggleExpand(panel) {
    setOnly(getOnly() === panel.side ? "" : panel.side);
    return true;
}

/**
 * Opens one of the menus of the head of a Panel: what can be opened in
 * it, where its document can be saved, or how it can be copied
 * @param {Panel}       panel
 * @param {HTMLElement} target
 * @param {String}      menu
 * @returns {Void}
 */
export function openMenu(panel, target, menu) {
    const menus = {
        open : [
            { text : "Open a file…", action : "upload-file" },
            { text : "Open an address…", action : "open-url" },
            { text : "Open from the history…", action : "open-history" },
            { line : true },
            { text : "Put the example in", action : "load-example" },
        ],
        save : [
            { text : "Save in the history…", action : "open-save" },
            { text : "Save to a file", action : "save-file" },
            { text : "Save as CSV", action : "export-csv" },
        ],
        copy : [
            { text : "Copy the document", action : "copy-document" },
            { text : "Copy it in one line", action : "copy-compact" },
        ],
    };
    App.setActive(panel);
    App.popup.openUnder(menus[menu] || [], target);
}
