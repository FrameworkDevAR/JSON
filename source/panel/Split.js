import Storage from "../core/Storage.js";



// The least and the most of the page the left Panel can take
const MIN_SHARE = 0.2;
const MAX_SHARE = 0.8;



/**
 * The Split, which is the handle between the two Panels: dragging it
 * gives one of them more of the page and the other less, and touching it
 * twice gives each its half back
 */
export default class Split {

    /** @type {Storage} */
    #storage;

    /** @type {HTMLElement} */
    #main;
    /** @type {HTMLElement} */
    #strip;
    /** @type {HTMLElement} */
    #grip;

    #share = 0.5;


    /**
     * Split constructor
     * @param {Storage}   storage
     * @param {?Function} onChange
     */
    constructor(storage, onChange = null) {
        this.#storage = storage;
        this.#main    = document.querySelector(".main");
        this.#strip   = document.querySelector(".between");
        this.#grip    = document.querySelector(".between-grip");
        this.onChange = onChange;

        this.#grip.addEventListener("pointerdown", (e) => {
            this.#startDrag(e);
        });
        this.#grip.addEventListener("dblclick", () => {
            this.setShare(0.5);
        });
        this.setShare(storage.getSplit());
    }

    /**
     * Gives the left Panel the given share of the page, and the right one
     * what is left of it
     * @param {Number} share
     * @returns {Void}
     */
    setShare(share) {
        this.#share = Math.min(Math.max(share || 0.5, MIN_SHARE), MAX_SHARE);
        this.#main.style.setProperty("--left", `${this.#share}fr`);
        this.#main.style.setProperty("--right", `${1 - this.#share}fr`);
        this.#storage.setSplit(this.#share);
        if (this.onChange) {
            this.onChange();
        }
    }

    /**
     * Moves the handle along with the pointer that holds it. The Panels
     * are one over the other on a narrow page, where it moves up and down
     * @param {PointerEvent} event
     * @returns {Void}
     */
    #startDrag(event) {
        event.preventDefault();

        const bounds  = this.#main.getBoundingClientRect();
        const isTall  = getComputedStyle(this.#strip).flexDirection === "row";
        const onMove  = (e) => {
            const share = isTall
                ? (e.clientY - bounds.top) / bounds.height
                : (e.clientX - bounds.left) / bounds.width;
            this.setShare(share);
        };
        const onEnd   = () => {
            document.body.classList.remove("is-resizing");
            this.#grip.removeEventListener("pointermove", onMove);
        };

        document.body.classList.add("is-resizing");
        this.#grip.setPointerCapture(event.pointerId);
        this.#grip.addEventListener("pointermove", onMove);
        this.#grip.addEventListener("pointerup", onEnd, { once : true });
        this.#grip.addEventListener("pointercancel", onEnd, { once : true });
    }
}
