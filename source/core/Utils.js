/**
 * Returns true if the element has any of the classes
 * @param {HTMLElement} element
 * @param  {...String}  className
 * @returns {Boolean}
 */
function hasClass(element, ...className) {
    return className.some((name) => element.classList.contains(name));
}

/**
 * Returns an element from the Target with an action
 * @param {Event} event
 * @returns {HTMLElement}
 */
function getTarget(event) {
    /** @type {HTMLElement} */
    // @ts-ignore
    let element = event.target;
    while (element.parentElement && !element.dataset.action) {
        element = element.parentElement;
    }
    return element;
}

/**
 * Returns the text with what HTML would read as its own written out plain
 * @param {String} text
 * @returns {String}
 */
function escape(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}



/**
 * Asks for a file and hands over the one that is chosen
 * @param {Function} onSelect
 * @returns {Void}
 */
function selectFile(onSelect) {
    const input    = document.createElement("input");
    input.type     = "file";
    input.onchange = () => onSelect(input.files[0]);
    input.click();
}

/**
 * Reads the file as text
 * @param {File} file
 * @returns {Promise<String>}
 */
function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader   = new FileReader();
        reader.onload  = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}

/**
 * Hands the text over as a file to be kept wherever files are kept
 * @param {String} name
 * @param {String} text
 * @param {String} type
 * @returns {Void}
 */
function download(name, text, type) {
    const link = document.createElement("a");
    const url  = URL.createObjectURL(new Blob([ text ], { type }));
    link.href     = url;
    link.download = name;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Puts the text where the next paste takes it from, and says whether it
 * could
 * @param {String} text
 * @returns {Promise<Boolean>}
 */
async function copy(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}

/**
 * Unselects the elements
 * @returns {Void}
 */
function unselect() {
    if (window.getSelection) {
        window.getSelection().removeAllRanges();
    }
}



/**
 * Puts the mark of the tabs under the one that is selected, which it slides
 * to from wherever it was
 * @param {HTMLElement} tabs
 * @param {Boolean=}    withMove
 * @returns {Void}
 */
function moveMark(tabs, withMove = true) {
    const tab  = tabs.querySelector("a.selected");
    const mark = tabs.querySelector(".tabs-mark");
    if (!(tab instanceof HTMLElement) || !(mark instanceof HTMLElement)) {
        return;
    }

    // An open has nowhere to slide from, so the mark just appears there
    mark.style.transition = withMove ? "" : "none";
    mark.style.setProperty("--mark-width", `${tab.offsetWidth}px`);
    mark.style.setProperty("--mark-left", `${tab.offsetLeft}px`);
    if (!withMove) {
        void mark.offsetWidth;
        mark.style.transition = "";
    }
}




// The public API
export default {
    hasClass,
    getTarget,
    escape,

    selectFile,
    readFile,
    download,
    copy,
    unselect,

    moveMark,
};
