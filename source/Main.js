import * as App       from "./App.js";
import * as Documents from "./actions/Documents.js";
import * as Edits     from "./actions/Edits.js";
import * as Tree      from "./actions/Tree.js";
import * as Search    from "./actions/Search.js";
import * as Compare   from "./actions/Compare.js";
import * as Settings  from "./actions/Settings.js";
import * as History   from "./actions/History.js";
import * as Keys      from "./actions/Keys.js";
import Utils          from "./core/Utils.js";



/**
 * Puts everything back the way it was left, unless the address asks for
 * a document, which is then the one to show
 * @returns {Void}
 */
function start() {
    Keys.showKeys();
    Settings.restoreTheme();
    Edits.drawWrap();
    Documents.start();
}



/**
 * The Click Event Handler
 */
document.addEventListener("click", (e) => {
    const target = Utils.getTarget(e);
    const action = target.dataset.action;
    const value  = target.dataset.value;
    const inMenu = Boolean(target.closest(".popup"));
    const panel  = inMenu ? App.active : App.panelOf(target);

    // The menu is gone at any click, the one that picks from it included
    const wasOpen = App.popup.isOpen;
    App.popup.close();

    switch (action) {
    // Document Actions
    case "new-document":
        Documents.newDocument(panel);
        break;
    case "upload-file":
        Documents.uploadFile(panel);
        break;
    case "open-url":
        Documents.openUrl();
        break;
    case "load-url":
        Documents.loadUrl();
        break;
    case "close-open":
        App.opener.close();
        break;
    case "load-example":
        Documents.loadExample(panel);
        break;
    case "new-value":
        Documents.newValue(panel, value);
        break;
    case "save-file":
        Documents.saveFile(panel);
        break;
    case "export-csv":
        Documents.exportCsv(panel);
        break;
    case "copy-document":
        Documents.copyDocument(panel);
        break;
    case "copy-compact":
        Documents.copyCompact(panel);
        break;
    case "open-menu":
        if (!wasOpen) {
            Documents.openMenu(panel, target, target.dataset.menu);
        }
        break;
    case "copy-right":
        Documents.copyAcross("left");
        break;
    case "copy-left":
        Documents.copyAcross("right");
        break;
    case "toggle-expand":
        Documents.toggleExpand(panel);
        break;

    // Edit Actions
    case "set-mode":
        Edits.setMode(panel, target.dataset.mode);
        break;
    case "format":
        Edits.format(panel);
        break;
    case "smart-format":
        Edits.smartFormat(panel);
        break;
    case "compact":
        Edits.compact(panel);
        break;
    case "toggle-wrap":
        Edits.toggleWrap();
        break;
    case "text-fold":
        panel.views.text.toggleFold(Number(target.dataset.line));
        break;
    case "text-line":
        panel.views.text.selectLine(Number(target.dataset.line));
        break;
    case "repair":
        Edits.repair(panel);
        break;
    case "undo":
        Edits.undo(panel);
        break;
    case "redo":
        Edits.redo(panel);
        break;
    case "show-error":
        Edits.showError(panel);
        break;
    case "expand-all":
        Edits.expandAll(panel);
        break;
    case "collapse-all":
        Edits.collapseAll(panel);
        break;
    case "open-sort":
        if (!wasOpen || inMenu) {
            Edits.openSort(panel, target);
        }
        break;
    case "apply-sort":
        Edits.applySort(value);
        break;
    case "open-transform":
        Edits.openTransform(panel);
        break;
    case "transform-language":
        Edits.setLanguage(target.dataset.language);
        break;
    case "transform-pick":
        App.transformer.togglePick(Number(value));
        break;
    case "apply-transform":
        Edits.applyTransform();
        break;
    case "close-transform":
        App.transformer.close();
        break;
    case "open-schema":
        Edits.openSchema(panel);
        break;
    case "save-schema":
        Edits.saveSchema();
        break;
    case "close-schema":
        App.schemer.close();
        break;

    // Tree and Table Actions
    case "tree-select":
    case "table-select":
        Tree.select(panel, target);
        break;
    case "tree-toggle":
        Tree.toggle(panel, target);
        break;
    case "tree-more":
        Tree.showMore(panel, target);
        break;
    case "tree-menu":
        if (!wasOpen) {
            Tree.openMenu(panel, target);
        }
        break;
    case "selected-menu":
        if (!wasOpen) {
            Tree.openSelectedMenu(panel, target);
        }
        break;
    case "tree-edit-value":
        Tree.edit(panel, "value");
        break;
    case "tree-edit-key":
        Tree.edit(panel, "key");
        break;
    case "tree-convert":
        Tree.convert(panel, value);
        break;
    case "tree-insert-inside":
        Tree.insert(panel, "inside", value);
        break;
    case "tree-insert-before":
        Tree.insert(panel, "before", value);
        break;
    case "tree-insert-after":
        Tree.insert(panel, "after", value);
        break;
    case "tree-duplicate":
        Tree.duplicate(panel);
        break;
    case "tree-move":
        Tree.move(panel, Number(value));
        break;
    case "tree-remove":
        Tree.remove(panel);
        break;
    case "tree-extract":
        Tree.extract(panel);
        break;
    case "tree-copy":
        Tree.copy(panel);
        break;
    case "tree-copy-path":
        Tree.copyPath(panel);
        break;
    case "tree-cut":
        Tree.copy(panel);
        Tree.remove(panel);
        break;
    case "tree-paste":
        Tree.paste(panel);
        break;
    case "go-path":
        Tree.goTo(panel, target);
        break;
    case "go-problem":
        Tree.goToProblem(panel, target);
        break;
    case "open-link":
        window.open(target.getAttribute("href"), "_blank", "noopener");
        break;
    case "table-sort":
        Tree.sortColumn(panel, target);
        break;
    case "table-open":
        Tree.openList(panel, target);
        break;
    case "table-menu":
        if (!wasOpen) {
            Tree.openRowMenu(panel, target);
        }
        break;
    case "table-insert":
        Tree.insertRow(panel, value);
        break;
    case "table-add":
        Tree.insertRow(panel, "after");
        break;
    case "table-more":
        panel.views.table.showMore();
        break;
    case "table-to-tree":
        Tree.showInTree(panel);
        break;

    // Search Actions
    case "toggle-search":
        Search.toggle(panel);
        break;
    case "close-search":
        Search.close(panel);
        break;
    case "search-next":
        Search.walk(panel, 1);
        break;
    case "search-prev":
        Search.walk(panel, -1);
        break;
    case "replace-one":
        Search.replaceOne(panel);
        break;
    case "replace-all":
        Search.replaceAll(panel);
        break;

    // Compare Actions
    case "toggle-compare":
        Compare.toggleComparing();
        break;
    case "next-difference":
        Compare.walk(1);
        break;
    case "prev-difference":
        Compare.walk(-1);
        break;

    // History Actions
    case "open-history":
        History.openHistory();
        break;
    case "close-history":
        App.historyDialog.close();
        break;
    case "open-entry":
        History.openEntry(Number(target.dataset.entry));
        break;
    case "remove-entry":
        History.removeEntry(Number(target.dataset.entry));
        break;
    case "clear-recent":
        History.clearRecent();
        break;
    case "open-save":
        History.openSave();
        break;
    case "close-save":
        App.saver.close();
        break;
    case "save-entry":
        History.saveEntry();
        break;
    case "forget-entry":
        History.forgetEntry();
        break;

    // Settings Actions
    case "open-settings":
        App.settings.open();
        break;
    case "settings-tab":
        App.settings.setTab(target);
        break;
    case "close-settings":
        App.settings.close();
        break;
    case "save-settings":
        Settings.saveSettings();
        break;

    // Mode Actions
    case "mode-light":
        Settings.setMode("light");
        break;
    case "mode-system":
        Settings.setMode("system");
        break;
    case "mode-dark":
        Settings.setMode("dark");
        break;
    default:
    }

    if (action) {
        e.preventDefault();
    }
});

/**
 * The Double Click Event Handler. A key, a value or a cell that is
 * touched twice is typed over
 */
document.addEventListener("dblclick", (e) => {
    if (e.target instanceof HTMLElement && e.target.closest(".tree-view, .table-view")) {
        if (Tree.editAt(App.panelOf(e.target), e.target)) {
            e.preventDefault();
        }
    }
});

/**
 * The Context Menu Event Handler. The menu of a row of the tree opens
 * where the row was touched
 */
document.addEventListener("contextmenu", (e) => {
    if (!(e.target instanceof HTMLElement)) {
        return;
    }
    const row = e.target.closest(".tree-view .tree-row[data-action='tree-select']");
    if (row instanceof HTMLElement && !e.target.closest("input")) {
        e.preventDefault();
        Tree.openMenu(App.panelOf(row), row, { x : e.clientX, y : e.clientY });
    }
});

/**
 * The Pointer Event Handler. The Panel that is touched is the one the
 * keys and the dialogs work on
 */
document.addEventListener("pointerdown", (e) => {
    const element = e.target instanceof Element ? e.target.closest(".panel") : null;
    if (element) {
        App.setActive(App.panelOf(element));
        return;
    }

    // The page around the Panels is where to touch to let go of them. The
    // header, the buttons between them, a menu and a dialog are not it
    const isPage = e.target === document.body || e.target === document.documentElement ||
        (e.target instanceof Element && e.target.matches(".main, .between"));
    if (isPage) {
        App.clearActive();
    }
});
document.addEventListener("focusin", (e) => {
    const element = e.target instanceof Element ? e.target.closest(".panel") : null;
    if (element) {
        App.setActive(App.panelOf(element));
    }
});

/**
 * The Submit Event Handler. Enter in a field of a Dialog is the button of
 * the Dialog, not the form going anywhere
 */
document.addEventListener("submit", (e) => {
    e.preventDefault();
    if (e.target instanceof HTMLElement) {
        const button = e.target.querySelector(".btn-fill");
        if (button instanceof HTMLElement) {
            button.click();
        }
    }
});

/**
 * The Search Event Handlers. What is typed is looked for as it is typed,
 * and Enter walks to the next place it was found
 */
for (const side of App.SIDES) {
    const panel = App.panels[side];
    const find  = panel.getElement(".search-find");

    find.addEventListener("input", () => {
        Search.run(panel);
    });
    panel.getElement(".panel-search").addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (e.target === find) {
                Search.walk(panel, e.shiftKey ? -1 : 1);
            } else {
                Search.replaceOne(panel);
            }
        }
    });
}

/**
 * The Drag Event Handlers. A file dragged over a Panel lights it up, and
 * one dropped on it is put in it
 */
document.addEventListener("dragover", (e) => {
    if (!e.dataTransfer || !e.dataTransfer.types.includes("Files")) {
        return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    for (const side of App.SIDES) {
        App.panels[side].element.classList.toggle("dragging", App.panels[side] === App.panelOf(e.target));
    }
});
document.addEventListener("dragleave", (e) => {
    // Leaving the window is the only leave that ends the drag, since going
    // from one element to another leaves the first
    if (!e.relatedTarget) {
        for (const side of App.SIDES) {
            App.panels[side].element.classList.remove("dragging");
        }
    }
});
document.addEventListener("drop", (e) => {
    if (!e.dataTransfer || !e.dataTransfer.files.length) {
        return;
    }
    e.preventDefault();
    for (const side of App.SIDES) {
        App.panels[side].element.classList.remove("dragging");
    }
    Documents.dropFiles(App.panelOf(e.target), e.dataTransfer.files);
});

/**
 * The Clipboard Event Handlers. While the keys go to a tree or to a table,
 * what is copied is what is selected there, and what is pasted goes over it
 */
document.addEventListener("copy", (e) => {
    if (!isOnRows() || !e.clipboardData) {
        return;
    }
    const text = Tree.getCopy(App.active);
    if (text) {
        e.clipboardData.setData("text/plain", text);
        e.preventDefault();
        App.toast.show("Copied");
    }
});
document.addEventListener("cut", (e) => {
    if (!isOnRows() || !e.clipboardData) {
        return;
    }
    const text = Tree.getCopy(App.active);
    if (text && App.active.selection && App.active.selection.length) {
        e.clipboardData.setData("text/plain", text);
        e.preventDefault();
        Tree.remove(App.active);
    }
});
document.addEventListener("paste", (e) => {
    if (!isOnRows() || !e.clipboardData) {
        return;
    }
    // A Panel with no document takes what is pasted as its document
    const text   = e.clipboardData.getData("text/plain");
    const isDone = App.active.isEmpty ? Documents.pasteDocument(App.active, text) : Tree.pasteText(App.active, text);
    if (isDone) {
        e.preventDefault();
    }
});

/**
 * Returns true if the keys go to a tree or to a table, and not to a field
 * @returns {Boolean}
 */
function isOnRows() {
    const element = document.activeElement;
    return element instanceof HTMLElement && element.matches(".tree-view, .table-view");
}

/**
 * The Tooltip Event Handler
 */
document.addEventListener("mouseover", (e) => {
    App.tooltip.follow(e);
});

/**
 * The Scroll Event Handlers. A tip and a menu are about a place that is
 * gone once what holds it is scrolled. The menu only goes when it is the
 * wheel that scrolls, since drawing a row again scrolls on its own
 */
document.addEventListener("scroll", (e) => {
    App.tooltip.hide();
    if (e.target instanceof HTMLElement && e.target.classList.contains("tree-view")) {
        Compare.syncScroll(e.target);
    }
}, true);
document.addEventListener("wheel", (e) => {
    if (!(e.target instanceof Element && e.target.closest(".popup"))) {
        App.popup.close();
    }
}, { passive : true });

/**
 * The Address Event Handler. Going back and forward, and a link opened
 * while the page is already open, change the address under the page, which
 * then shows what the new one asks for
 */
window.addEventListener("popstate", () => {
    Documents.openAddress();
});

/**
 * The Resize Event Handler. The mark of the tabs sits where its tab is,
 * which moves when the Panels take another width
 */
window.addEventListener("resize", () => {
    for (const side of App.SIDES) {
        App.panels[side].drawHead(false);
    }
    App.popup.close();
});

/**
 * The Key Event Handler
 */
document.addEventListener("keydown", (e) => {
    if (Keys.handleKey(e)) {
        e.preventDefault();
    }
});



// Start
start();
