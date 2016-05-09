
class CiteSupport {

    constructor() {
        this.config = {
            debug: false,
            mode: 'note',
            defaultLocale: 'en-US',
            defaultStyle: 'jm-indigobook-law-review',
            posToCitationId: {},
            citationIdToPos: {},
            processorReady: false,
            citationByIndex: [],
            current: {},
        };
    }

    /**
     * Logs messages to the console if `config.debug` is true
     * @param  {string} txt The message to log
     * @return {void}
     */
    debug(txt) {
        if (this.config.debug) {
            console.log(`*** ${txt}`);
        }
    }

    citationAddOrEditHandler(e) {
        this.debug('citationAddOrEditHandler()');

        const menu = document.getElementById('cite-menu');
        const citationItems = this.getCitationIdsFrom(menu);
        const hasCitation = this.menuHasCitation(menu);
        this.config.current = this.getCurrentCitationInfo();

        if (citationItems.length === 0) {
            if (hasCitation) {

            }
        }

    }


    /**
     * Receives an HTML element as input. An HTML Collection is extracted from
     *   the input element containing all child input[type="checkbox"] elements. The
     *   HTML Collection is then iterated and the values of the checked boxes are
     *   pushed to `citationItems` in the form of { id: `value`}. The "value" of
     *   the checkbox element in this case is the citation ID.
     *
     * NOTE: This is a helper method used for this example and is NOT REQUIRED.
     *
     * @param  {HTMLElement} element An HTML element containing HTML input elements as children.
     * @return {Object[]}      An array of objects containing citation IDs.
     */
    getCitationIdsFrom(element) {
        this.debug('getCitationItemIdsFrom()');
        const citationItems = [];
        const checkboxes = element.getElementsByTagName('input');

        for (const checkbox of checkboxes) {
            if (checkbox.checked) {
                citationItems.push({
                    id: checkbox.value,
                });
            }
        }

        return citationItems;
    }

    /**
     * Helper function used for getting information on the currently selected citation
     *   menu object.
     *
     * NOTE: This is a helper method used for this example and is NOT REQUIRED.
     *
     * @return {Object} `info` object (defined below).
     */
    getCurrentCitationInfo() {
        this.debug('getCurrentCitationInfo()');

        /**
         * Citation info object
         * @type {Object}
         * @prop {number} pos  - The position of the currently selected citation menu.
         * @prop {string} citationID  - The `id` of the span element which holds the
         *   inline citations.
         * @prop {number} citationIndex  - I have no idea what this is for. FIXME
         */
        const info = {
            pos: 0,
            citationID: null,
            citationIndex: -1,
        };
        const citemeElements = document.getElementsByClassName('citeme');

        for (let i = 0; i < citemeElements.length; i++) {
            /** @type {HTMLSpanElement} The button icon to trigger the citation menu */
            const citemeElement = citemeElements[i];

            /** @type {HTMLSpanElement} The inline citation element */
            const sib = citemeElements.item(i).nextElementSibling;

            if (sib.classList.contains('citation')) {
                info.citationIndex++;
            }

            // If the current element has its citation menu open (ie. its first-child)
            // then we've found what we're looking for. Return info after setting
            // the last couple properties.
            if (citemeElement.firstChild) {
                info.pos = i;
                if (sib.classList.contains('citation')) {
                    info.citationID = sib.id;
                }
                return info;
            }
        }
        return null;
    }

    /**
     * Takes an HTML element as input and returns a boolean depending on whether
     *   or not the element's next sibling has the class `citation`. If `false` is
     *   returned, then that means a span citation container element does not exist
     *   for the current line.
     *
     * NOTE: This is a helper method used for this example and is NOT REQUIRED.
     *
     * @param  {HTMLElement} menuElement HTMLElement (in this case, the citation menu)
     * @return {boolean}
     */
    menuHasCitation(menuElement) {
        this.debug('menuHasCitation()');
        const sib = menuElement.parentElement.nextElementSibling;

        if (sib && sib.classList.contains('citation')) {
            return true;
        }
        return false;
    }


    // TODO: Combine this function with some of the others to create one unified
    // DOM update/refresh utility.
    // removeCitation() {
    //     this.debug('removeCitation()');
    //
    //     // Remove citation from DOM
    //     if (this.config.current.citationID) {
    //         domRemoveCitation(config.current.citationID);
    //     }
    //
    //     // Remove citation from citationByIndex, posToCitationId, and citationIdToPos
    //     // Adjust note numbers in citationByIndex child properties if note style
    //     removePos = removeIdFromDataSets(config.mode, config.current.citationID);
    //
    //     // If we have no citations left, initialize the processor
    //     // Otherwise, re-insert the first citation in the list to trigger and update
    //     if (config.citationByIndex.length === 0) {
    //         localStorage.removeItem('citationByIndex');
    //         citesupport.initProcessor(config.defaultStyle, config.defaultLocale, config.citationByIndex);
    //     } else {
    //         domHideFootnoteAt(removePos);
    //         var splitData = getCitationSplits();
    //         splitData.citation.properties.noteIndex = 1;
    //         config.processorReady = true;
    //         citesupport.registerCitation(splitData.citation, splitData.citationsPre, splitData.citationsPost);
    //     }
    }


}

const support = new CiteSupport();
