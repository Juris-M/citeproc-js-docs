/**
 * citesupport - Citation support for xHTML documents
 *
 * An es6 class object that provides support for dynamic citation
 * management similar to that found in reference managers (Zotero,
 * Mendeley, EndNote, Citavi, Papers2 etc.)
 *
 * Here are some notes on things relevant to deployment:
 *
 * - The class should be instantiated as `citesupport`. The event
 *   handlers expect the class object to be available in global
 *   context under that name.
 *
 * - If `config.demo` is `true`, the stored object `citationIdToPos`
 *   maps citationIDs to the index position of fixed "pegs" in the
 *   document that have class `citeme`. In the demo, this map is
 *   stored in localStorage, and is used to reconstruct the document
 *   state (by reinserting `class:citation` span tags) on page reload.
 *
 * - If `config.demo` is `false`, the document is assumed to contain
 *   `class:citation` span tags, and operations on `citeme` nodes will
 *   not be performed. In non-demo mode, `citationIdToPos` carries
 *   the index position of citation nodes for good measure, but the
 *   mapping is not used for anything.
 *
 * - The `spoofDocument()` function brings citation data into memory.
 *   In the demo, this data is held in localStorage, and
 *   `spoofDocument()` performs some sanity checks on data and
 *   document. For a production deployment, this is the place for code
 *   that initially extracts citation data the document (if, for example,
 *   it is stashed in data-attributes on citation nodes).
 *
 * - The `setCitations()` function is where citation data for individual
 *   citations would be saved, at the location marked by NOTE.
 *
 * - The user-interface functions `buildStyleMenu()` and
 *   `citationWidget()` are simple things cast for the demo, and
 *   should be replaced with something a bit more functional.
 *
 * - The `SafeStorage` class should be replaced (or subclassed?) for
 *   deployment with a class that provides the same methods. If
 *   the citation objects making up `citationByIndex` are stored
 *   directly on the `class:citation` span nodes, the getter for
 *   that value should harvest the values from the nodes, and
 *   store them on `config.citationByIndex`. The setter should
 *   set `config.citationByIndex` only, relying on other code
 *   to update the node value.
 *
 * - Probably some other stuff that I've overlooked.
 */

class SafeStorage {

    constructor(citesupport) {
        this.citesupport = citesupport;
    }

    safeStorageGet(key, fallback) {
        let ret;
        const val = localStorage.getItem(key);
        if (!val) {
            this.citesupport.debug('No value in storage!');
            ret = fallback;
        } else if (['{', '['].indexOf(val.slice(0, 1)) > -1) {
            try {
                ret = JSON.parse(val);
            } catch (e) {
                this.citesupport.debug(`JSON parse error! ${key} ${val}`);
                ret = fallback;
            }
        } else {
            ret = val;
        }
        this.citesupport.config[key] = ret;
        return ret;
    }

    set defaultLocale(localeName) {
        this.citesupport.config.defaultLocale = localeName;
        localStorage.setItem('defaultLocale', localeName);
    }

    set defaultStyle(styleName) {
        localStorage.setItem('defaultStyle', styleName);
        this.citesupport.config.defaultStyle = styleName;
    }

    set citationByIndex(citationByIndex) {
        localStorage.setItem('citationByIndex', JSON.stringify(citationByIndex));
        this.citesupport.config.citationByIndex = citationByIndex;
    }

    set citationIdToPos(citationIdToPos) {
        localStorage.setItem('citationIdToPos', JSON.stringify(citationIdToPos));
        this.citesupport.config.citationIdToPos = citationIdToPos;
    }

    get defaultLocale() {
        return this.safeStorageGet('defaultLocale', 'en-US');
    }

    get defaultStyle() {
        return this.safeStorageGet('defaultStyle', 'american-medical-association');
    }

    get citationByIndex() {
        return this.safeStorageGet('citationByIndex', []);
    }

    get citationIdToPos() {
        return this.safeStorageGet('citationIdToPos', {});
    }

}

class CiteSupport {

    constructor() {
        this.safeStorage = new SafeStorage(this);
        this.config = {
            debug: true,
            mode: 'note',
            defaultLocale: 'en-US',
            defaultStyle: 'american-medical-association',
            citationIDs: {},
            citationByIndex: [],
            processorReady: false,
            demo: true,
        };
        this.worker = new Worker('_static/js/citeworker.js');
        this.worker.onmessage = (e) => {
            switch (e.data.command) {
            /**
             * In response to `callInitProcessor` request, refresh
             *   `config.mode`, and document citations (if any)
             *   and document bibliography (if any).
             *
             * @param {string} xclass Either `note` or `in-text` as a string
             * @param {Object[]} rebuildData Array of elements with the form
             *   `[citationID, noteNumber, citeString]`
             * @param {Object[]} bibliographyData Array of serialized xHTML bibliography entries
             */
            case 'initProcessor': {
                this.debug('initProcessor()');
                this.config.mode = e.data.xclass;
                const citationData = this.convertRebuildDataToCitationData(e.data.rebuildData);
                this.setCitations(this.config.mode, citationData);
                this.setBibliography(e.data.bibliographyData);
                this.safeStorage.citationByIndex = this.config.citationByIndex;
                this.config.processorReady = true;
                break;
            }
             /**
              * In response to `callRegisterCitation`, refresh `config.citationByIndex`,
              *   set citations that require update in the document, replace
              *   the bibliography in the document, and save the `citationByIndex` array
              *   for persistence.
              *
              * @param {Object[]} citationByIndex Array of registered citation objects
              * @param {Object[]} citationData Array of elements with the form
              *   `[noteNumber, citeString]`
              * @param {Object[]} bibliographyData Array of serialized xHTML bibliography entries
              */
            case 'registerCitation': {
                this.debug('registerCitation()');
                this.config.citationByIndex = e.data.citationByIndex;
                // setCitations() implicitly updates this.config.citationIDs
                this.setCitations(this.config.mode, e.data.citationData, true);
                this.setBibliography(e.data.bibliographyData);
                this.safeStorage.citationByIndex = this.config.citationByIndex;
                this.config.processorReady = true;
                break;
            }
            default:
                return;
            }
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

    /**
     * Initializes the processor, optionally populating it with a
     *   preexisting list of citations.
     *
     * @param {string} styleName The ID of a style
     * @param {string} localeName The ID of a locale
     * @param {Object[]} citationByIndex An array of citation objects with citationIDs
     * @return {void}
     */
    callInitProcessor(styleName, localeName, citationByIndex) {
        this.debug('callInitProcessor()');
        this.config.processorReady = false;
        this.worker.postMessage({
            command: 'initProcessor',
            styleName,
            localeName,
            citationByIndex,
        });
    }

    /**
     * Registers a single citation in the processor to follow
     *   citations described by `preCitations` and precede those
     *   described in `postCitations`.
     *
     * @param {Object{}} citation A citation object
     * @param {Object[]} preCitations Array of `[citationID, noteNumber]` pairs in document order
     * @param {Object[]} postCitations Array of `[citationID, noteNumber]` pairs in document order
     * @return {void}
     */
    callRegisterCitation(citation, preCitations, postCitations) {
        if (!this.config.processorReady) return;
        this.debug('callRegisterCitation()');
        this.config.processorReady = false;
        this.worker.postMessage({
            command: 'registerCitation',
            citation,
            preCitations,
            postCitations,
        });
    }

    /**
     * Converts the array returned by the processor `rebuildProcessor()` method
     * to the form digested by our own `setCitations()` method.
     *
     * rebuildData has this structure:
     *    [<citation_id>, <note_number>, <citation_string>]
     *
     * setCitations() wants this structure:
     *    [<citation_index>, <citation_string>, <citation_id>]
     *
     * @param {Object[]} rebuildData An array of values for insertion of citations into a document
     * @return {Object[]}
     */
    convertRebuildDataToCitationData(rebuildData) {
        if (!rebuildData) return [];
        this.debug('convertRebuildDataToCitationData()');
        const citationData = rebuildData.map(obj => [0, obj[2], obj[0]]);
        for (let i = 0, ilen = citationData.length; i < ilen; i++) {
            citationData[i][0] = i;
        }
        return citationData;
    }

    /**
     * Function to be run immediately after document has been loaded, and
     *   before any editing operations.
     *
     * @return {void}
     */
    initDocument() {
        this.debug('initDocument()');
        this.callInitProcessor(
            this.safeStorage.defaultStyle,
            this.safeStorage.defaultLocale,
            this.safeStorage.citationByIndex
        );
    }

    /**
     * Update all citations based on data returned by the processor.
     * The update has two effects: (1) the id of all in-text citation
     * nodes is set to the processor-assigned citationID; and (2)
     * citation texts are updated. For footnote styles, the footnote
     * block is regenerated from scratch, using hidden text stored
     * in the citation elements.
     *
     * @param {string} mode The mode of the current style, either `in-text` or `note`
     * @param {Object[]} data An array of elements with the form
     *   `[citationIndex, citationText, citationID]`
     * @return {void}
     */
    setCitations(mode, data) {
        this.debug('setCitations()');

        // Assure that every citation node has citationID
        // Store data on any node of first impression
        const citationNodes = document.getElementsByClassName('citation');

        for (let i = 0, ilen = data.length; i < ilen; i++) {
            const citationNode = citationNodes[data[i][0]];
            if (!citationNode) return;
            const citationID = data[i][2];

            if (!citationNode.id) {
                citationNode.id = citationID;

                if (this.config.demo) {
                    // Demo-only hack, used to reconstruct document state on load
                    const pegs = document.getElementsByClassName('citeme');
                    for (let j = 0, jlen = pegs.length; j < jlen; j++) {
                        const sib = pegs[j].nextSibling;
                        if (sib && sib.getAttribute && sib.getAttribute('id') === citationID) {
                            this.config.citationIdToPos[citationID] = j;
                        }
                    }
                } else {
                    // citationIdToPos isn't used for anything other than (optionally) validation
                    const citations = document.getElementsByClassName('citation');
                    for (let j = 0, jlen = citations.length; j < jlen; j++) {
                        const citation = citations[j];
                        if (citation && citation.getAttribute && citation.id === citationID) {
                            // NOTE: If stashing data on citation nodes, that should happen here.
                            this.config.citationIdToPos[citationID] = j;
                        }
                    }
                }
                this.safeStorage.citationIdToPos = this.config.citationIdToPos;
            }
        }

        /*
         * Pseudo-code
         *
         * (1) Open a menu at current document position.
         *   (a) Set a class:citation span placeholder if necessary.
         *   (b) Hang menu off of class:citation span.
         * (2) Perform click-handler from menu, which:
         *   * If no citationID on class:citation span ...
         *      ... and empty menu: just deletes the node.
         *      ... and menu content: file request w/empty citationID
         *   * If has citationID on class:citation span ...
         *      ... and empty menu, then ...
         *           ... if now no citations, file init request.
         *           ... if still citations, refile 1st citation.
         *      ... and menu content: file request w/citationID
         */

        if (mode === 'note') {
            const footnoteContainer = document.getElementById('footnote-container');

            footnoteContainer.hidden = data.length === 0;

            for (let i = 0, ilen = data.length; i < ilen; i++) {
                // Get data for each cite for update (ain't pretty)
                const tuple = data[i];
                const citationID = tuple[2];
                const citationNode = document.getElementById(citationID);
                const citationText = tuple[1];
                const citationIndex = tuple[0];
                const footnoteNumber = (citationIndex + 1);

                // The footnote update is tricky and hackish because
                // HTML has no native mechanism for binding
                // footnote markers to footnotes proper.
                //
                //   (1) We write the citationText in a hidden sibling to
                // the in-text note number. This gives us a persistent
                // record of the footnote text.
                //
                //   (2) We then (later) iterate over the citation
                // nodes to regenerate the footnote block from scratch.
                citationNode.innerHTML =
                    `<span class="footnote-mark">${footnoteNumber}</span>` +
                    `<span hidden="true">${citationText}</span>`;
            }
            // Reset the number on all footnote markers
            // (the processor does not issue updates for note-number-only changes)
            const footnoteMarkNodes = document.getElementsByClassName('footnote-mark');
            for (let i = 0, ilen = footnoteMarkNodes.length; i < ilen; i++) {
                const footnoteMarkNode = footnoteMarkNodes[i];
                footnoteMarkNode.innerHTML = (i + 1);
            }
            // Remove all footnotes
            const footnotes = document.getElementsByClassName('footnote');
            for (let i = footnotes.length - 1; i > -1; i--) {
                footnotes[i].parentNode.removeChild(footnotes[i]);
            }
            // Regenerate all footnotes from hidden texts

            for (let i = 0, ilen = citationNodes.length; i < ilen; i++) {
                const footnoteText = citationNodes[i].childNodes[1].innerHTML;
                const footnoteNumber = (i + 1);
                const footnote = document.createElement('div');
                footnote.classList.add('footnote');
                footnote.innerHTML =
                    `<span class="footnote">
                        <span class="footnote-number">${footnoteNumber}</span>
                        <span class="footnote-text">${footnoteText}</span>
                    </span>`;
                footnoteContainer.appendChild(footnote);
            }
        } else {
            const footnoteContainer = document.getElementById('footnote-container');
            footnoteContainer.hidden = true;
            for (let i = 0, ilen = data.length; i < ilen; i++) {
                const tuple = data[i];
                const citationID = tuple[2];
                const citationNode = document.getElementById(citationID);
                const citationText = tuple[1];
                citationNode.innerHTML = citationText;
            }
        }
    }

    /**
     * Replace bibliography with xHTML returned by the processor.
     *
     * @param {Object[]} data An array consisting of [0] an object with style
     *   information and [1] an array of serialized xHMTL bibliography entries.
     */
    setBibliography(data) {
        this.debug('setBibliography()');
        const bibContainer = document.getElementById('bibliography-container');
        if (!data || !data[1] || data[1].length === 0) {
            bibContainer.hidden = true;
            return;
        }
        const bib = document.getElementById('bibliography');
        bib.setAttribute('style', 'visibility: hidden;');
        bib.innerHTML = data[1].join('\n');
        const entries = document.getElementsByClassName('csl-entry');
        if (data[0].hangingindent) {
            for (let i = 0, ilen = entries.length; i < ilen; i++) {
                const entry = entries[i];
                entry.style.cssText = 'padding-left: 1.3em;text-indent: -1.3em;';
            }
            bibContainer.hidden = false;
            bib.setAttribute('style', 'visibility: visible;');
        } else if (data[0]['second-field-align']) {
            const offsetSpec = data[0].maxoffset ?
                `width: ${(data[0].maxoffset / 2) + 0.5}em;` :
                'padding-right:0.3em;';

            for (let i = 0, ilen = entries.length; i < ilen; i++) {
                const entry = entries[i];
                entry.style.cssText = 'white-space: nowrap;';
            }
            const numbers = document.getElementsByClassName('csl-left-margin');
            for (let i = 0, ilen = numbers.length; i < ilen; i++) {
                const number = numbers[i];
                number.style.cssText = `display:inline-block; ${offsetSpec}`;
            }
            if (data[0].maxoffset) {
                // cheat
                const texts = document.getElementsByClassName('csl-right-inline');
                const containerWidth = document.getElementById('dynamic-editing').offsetWidth;
                const numberWidth = (data[0].maxoffset * (90 / 9));
                const widthSpec = `width: ${(containerWidth - numberWidth - 20)}px;`;
                for (let i = 0, ilen = texts.length; i < ilen; i++) {
                    const text = texts[i];
                    text.style.cssText = `display: inline-block; white-space: normal; ${widthSpec}`;
                }
                bibContainer.hidden = false;
                bib.style.visibility = 'visible';
            } else {
                bibContainer.hidden = false;
                bib.style.visibility = 'visible';
            }
        } else {
            bibContainer.hidden = false;
            bib.style.visibility = 'visible';
        }
    }
    /**
     * Set or acquire a citation node for editing. If the node is
     * newly set, it will not have a processor-assigned citationID.
     * The presence or absence of citationID is used in later code to
     * determine how to handle a save operation.
     *
     * This is demo code: replace it with something more sophisticated
     * for production.
     *
     * @param {Event} e An event generated by the DOM
     */
    citationWidgetHandler(e) {
        this.debug('citationWidgetHandler()');

        // In the demo, citations are set on a "citeme peg"
        // hard-coded into the document.
        //
        // If the peg has a citation node as its following sibling,
        // open it for editing.
        //
        // If the peg is not followed by a citation node, add
        // one and open it for editing.

        const peg = e.target;
        const sibling = peg.nextSibling;
        const hasCitation = (
            sibling &&
            sibling.classList &&
            sibling.classList.contains('citation')
        );
        let citation;
        if (hasCitation) {
            citation = sibling;
        } else {
            citation = document.createElement('span');
            citation.classList.add('citation');
            peg.parentNode.insertBefore(citation, peg.nextSibling);
        }
        this.citationWidget(citation);
    }

    /**
     * Presents an interface for inserting citations.
     *
     * This is demo code: replace this function with something more
     * sophisticated for production.
     *
     * @param {htmlElement} citation A span node with class `citation`
     * @return {void}
     */
    citationWidget(citationNode) {
        this.debug('citationWidget()');

        const itemData = [
            {
                title: 'Geller 2002',
                id: 'item01',
            },
            {
                title: 'West 1934',
                id: 'item02',
            },
            {
                title: 'Allen 1878',
                id: 'item03',
            },
            {
                title: 'American case',
                id: 'item04',
            },
            {
                title: 'British case',
                id: 'item05',
            },
        ];

        const citeMenu = document.createElement('div');
        citeMenu.setAttribute('id', 'cite-menu');
        let innerHTML = '<div class="menu">';

        for (let i = 0, ilen = itemData.length; i < ilen; i++) {
            const itemID = itemData[i].id;
            const itemTitle = itemData[i].title;
            innerHTML +=
                `<label>
                    <input id="${itemID}" type="checkbox" name="cite-menu-item" value="${itemID}" />
                    ${itemTitle}
                </label><br/>`;
        }
        innerHTML += '<button id="cite-save-button" type="button">Save</button></div>';
        citeMenu.innerHTML = innerHTML;
        if (!this.hasRoomForMenu(citationNode)) {
            citeMenu.firstChild.setAttribute('style', 'left:-160px !important;');
        } else {
            citeMenu.firstChild.setAttribute('style', 'left:0px !important;');
        }
        citationNode.insertBefore(citeMenu, citationNode.firstChild);

        const button = document.getElementById('cite-save-button');

        const citationID = citationNode.getAttribute('id');

        if (citationID) {
            let citation;
            for (let i = 0, ilen = this.config.citationByIndex.length; i < ilen; i++) {
                if (this.config.citationByIndex[i].citationID === citationID) {
                    citation = this.config.citationByIndex[i];
                }
            }
            // Although citation should ALWAYS exist if document data has cleared validation
            if (citation) {
                const itemIDs = citation.citationItems.map(obj => obj.id);
                for (let i = 0, ilen = itemIDs.length; i < ilen; i++) {
                    const menuItem = document.getElementById(itemIDs[i]);
                    menuItem.checked = true;
                }
            }
        }
        button.addEventListener('click', this.citationEditHandler.bind(this));
    }

    /**
     * Perform the update operation appropriate to selections
     *   and context.
     *
     *     - If this is a fresh citation and no items are to be added,
     *       remove the menu and citation node.
     *     - If this is a fresh citation and items are to be added,
     *       request the update from the processor.
     *     - If this is an existing citation and no items are to be used,
     *       and removing the existing cites leaves none, request processor
     *       initialization.
     *     - If this is an existing citation and no items are to be used,
     *       and removing the existing cites will leave some, update
     *       using the first citation in the document.
     *     - If this is an existing citation and items are to be used,
     *       update this citation in context.
     *
     * @params {Event} e An event object
     * @return {void}
     */
    citationEditHandler() {
        this.debug('citationEditHandler()');
        const menu = document.getElementById('cite-menu');
        const citationItems = this.getCitationItemIdsFrom(menu);
        const citationNode = menu.parentNode;
        const citationID = citationNode.id;

        // Before touching the processor, we need to assure that citationByIndex
        // reflects current document state. In the demo, that's easy: the two are
        // always congruent at the top of this handler. With free-text editing
        // and the possibility of both internal and external cut-and-paste it won't
        // be so easy.

        // In the code here, we assume that external cut-and-paste (i.e. pasting
        // in text with `citeSupport` citations) is not possible.
        const citationNodes = document.getElementsByClassName('citation');
        const citationByIndex = [];
        const citationMap = {};
        for (let i = 0, ilen = this.config.citationByIndex.length; i < ilen; i++) {
            const citation = this.config.citationByIndex[i];
            citationMap[citation.citationID] = i;
        }
        for (let i = 0, ilen = citationNodes.length; i < ilen; i++) {
            const node = citationNodes[i];
            const id = node.id;
            if (id) {
                citationByIndex.push(this.config.citationByIndex[citationMap[id]]);
            }
        }

        // Next, we normalize our record of the note numbers.
        // * In word processor context, note numbers are controlled by the
        //   calling application, and should be taken at face value.
        //   There, it is important to respect the application's assigned values,
        //   since not all footnotes are inserted by the processor.
        // * Here, though, all footnotes are generated by citationsupport,
        //   and the browser doesn't have any special knowledge about them.
        //   They are spoofed.
        // * So before doing anything further, we force the numbers into sequence.
        //   This will give the processor correct information for back-reference
        //   cites in footnote styles.

        for (let i = 0, ilen = citationByIndex.length; i < ilen; i++) {
            const citation = citationByIndex[i];
            if (citation.citationID) {
                if (this.config.mode === 'note') {
                    citation.properties.noteIndex = (i + 1);
                } else {
                    citation.properties.noteIndex = 0;
                }
            }
        }
        this.safeStorage.citationByIndex = citationByIndex;

        // If there are no citation items from the menu,
        // then we are either removing an existing citation
        // or doing nothing.
        if (citationItems.length === 0) {
            if (citationID) {
                // Remove an existing citation

                // Remove citation from DOM
                citationNode.parentNode.removeChild(citationNode);

                // Remove citation data from memory objects and storage
                delete this.config.citationIDs[citationID];
                delete this.config.citationIdToPos[citationID];

                // Remove citation from citationByIndex and citationIDs
                for (let i = this.config.citationByIndex.length - 1; i > -1; i--) {
                    if (this.config.citationByIndex[i].citationID === citationID) {
                        this.config.citationByIndex =
                            this.config.citationByIndex
                                .slice(0, i)
                                .concat(this.config.citationByIndex
                                .slice(i + 1));

                        // Adjust note numbers in citationByIndex child properties if note style
                        if (this.config.mode === 'note') {
                            for (let j = i; j < this.config.citationByIndex.length; j++) {
                                this.config.citationByIndex[j].properties.noteIndex += -1;
                            }
                        }
                    }
                }

                if (this.config.citationByIndex.length === 0) {
                    // If we have no citations left, initialize the processor
                    this.callInitProcessor(
                        this.config.defaultStyle,
                        this.config.defaultLocale,
                        this.config.citationByIndex
                    );
                } else {
                    // Get citation, citationsPre, citationsPost
                    const splitData = this.getCitationSplits();
                    splitData.citation.properties.noteIndex = 1;

                    // Adjust note numbers in citationByIndex child properties if note style
                    if (this.config.mode === 'note') {
                        for (let i = 1, ilen = this.config.citationByIndex.length; i < ilen; i++) {
                            this.config.citationByIndex[i].properties.noteIndex = (i + 1);
                        }
                    }

                    this.config.processorReady = true;
                    this.callRegisterCitation(
                        splitData.citation,
                        splitData.citationsPre,
                        splitData.citationsPost
                    );
                }
            } else {
                // Just remove the menu AND the citation
                menu.parentNode.parentNode.removeChild(menu.parentNode);
            }
        } else {
            // Get citationsPre and citationsPost
            const splitData = this.getCitationSplits(citationNodes);

            // Get the note number
            const noteNumber = this.config.mode === 'note' ?
                (splitData.citationsPre.length + 1) :
                0;

            // Compose the citation.
            let citation;
            if (splitData.citation) {
                citation = splitData.citation;
                citation.citationItems = citationItems;
            } else {
                citation = {
                    citationItems,
                    properties: {
                        noteIndex: noteNumber,
                    },
                };
            }

            // Submit the update request.
            this.callRegisterCitation(
                citation,
                splitData.citationsPre,
                splitData.citationsPost
            );
        }
    }

    /**
     * Return a citation and descriptive arrays representing
     *   citations before and after its position.
     *
     * If `nodes` argument is provided, return a citation object for
     *   the current citation open for editing. If no `nodes` argument
     *   is given, use the first citation in the document as the
     *   "current" citation.
     *
     *
     *
     * @param {HtmlElementList} nodes A list of citation nodes
     * @return {Object[]} splitData An object with citation object as `citation`, an
     */
    getCitationSplits(nodes) {
        this.debug('getCitationSplits()');
        const splitData = {
            citation: null,
            citationsPre: [],
            citationsPost: [],
        };
        let current = 'citationsPre';
        let offset = 0;
        if (nodes) {
            for (let i = 0, ilen = nodes.length; i < ilen; i++) {
                const node = nodes[i];
                if (node.firstChild && node.firstChild.getAttribute && node.firstChild.id === 'cite-menu') {
                    current = 'citationsPost';
                    if (!node.getAttribute('id')) {
                        // Inserting a new citation
                        offset = -1;
                    } else {
                        // Editing an existing citation
                        splitData.citation = this.config.citationByIndex[i];
                    }
                } else {
                    const citation = this.config.citationByIndex[i + offset];
                    splitData[current].push([citation.citationID, citation.properties.noteIndex]);
                }
            }
        } else {
            splitData.citation = this.config.citationByIndex[0];
            splitData.citationsPost =
                this.config.citationByIndex
                    .slice(1)
                    .map(obj => [obj.citationID, obj.properties.noteIndex]);
        }
        return splitData;
    }

    /**
     * Read and return selections from citation menu.
     *
     * @param {HtmlElement} menu A DOM node containing input elements of type `checkbox`
     * @return {Object[]} An array of objects, each with an `id` value
     */
    getCitationItemIdsFrom(menu) {
        this.debug('getCitationItemIdsFrom()');
        const citationItems = [];
        const checkboxes = menu.getElementsByTagName('input');
        for (let i = 0, ilen = checkboxes.length; i < ilen; i++) {
            const checkbox = checkboxes[i];
            if (checkbox.checked) {
                citationItems.push({
                    id: checkbox.value,
                });
            }
        }
        return citationItems;
    }

    /**
     * Replace citation span nodes and get ready to roll. Puts
     *   document into the state it would have been in at first
     *   opening had it been properly saved.
     *
     * @return {void}
     */
    spoofDocument() {
        this.debug('spoofDocument()');

        this.safeStorage.citationIdToPos;

        // Stage 1: Check that all array items have citationID
        // const citationByIndex = this.safeStorage.citationByIndex;
        const citationIDs = {};

        for (let i = 0, ilen = this.config.citationByIndex.length; i > ilen; i++) {
            const citation = this.config.citationByIndex[i];
            if (!this.config.citationIDs[citation.citationID]) {
                this.debug(
                    'WARNING: encountered a stored citation that was invalid ' +
                    'or had no citationID. Removing citations.'
                );
                this.safeStorage.citationByIndex = [];
                this.safeStorage.citationIdToPos = {};
                break;
            }
            citationIDs[citation.citationID] = true;
        }
        this.config.citationIDs = citationIDs;

        // Stage 2: check that all citation locations are in posToCitationId
        // with existing citationIDs and have span tags set
        let pegs;
        if (this.config.demo) {
            pegs = document.getElementsByClassName('citeme');
        } else {
            pegs = document.getElementsByClassName('citation');
        }
        for (let i = 0, ilen = this.config.citationByIndex.length; i < ilen; i++) {
            const citation = this.config.citationByIndex[i];
            const citationID = citation ? citation.citationID : null;
            if (typeof this.config.citationIdToPos[citationID] !== 'number') {
                this.debug('WARNING: invalid state data. Removing citations.');
                this.safeStorage.citationByIndex = [];
                this.safeStorage.citationIdToPos = {};
                break;
            } else if (this.config.demo) {
                const citationNode = document.createElement('span');
                citationNode.classList.add('citation');
                citationNode.setAttribute('id', citationID);
                const peg = pegs[this.config.citationIdToPos[citationID]];
                peg.parentNode.insertBefore(citationNode, peg.nextSibling);
            }
        }

        // Stage 3: check that number of citation nodes and number of stored citations matches
        const objectLength = this.config.citationByIndex.length;
        const nodeLength = document.getElementsByClassName('citation').length;
        if (objectLength !== nodeLength) {
            this.debug(
                'WARNING: document citation node and citation object counts ' +
                'do not match. Removing citations.'
            );
            this.safeStorage.citationByIndex = [];
            this.safeStorage.citationIdToPos = {};
            const citations = document.getElementsByClassName('citation');
            for (let i = 0, ilen = citations.length; i < ilen; i++) {
                citations[0].parentNode.removeChild(citations[0]);
            }
        }
    }

    /**
     * Build a menu to set the style and trigger reinstantiation of
     *   the processor. This menu will be needed in all deployments,
     *   but is not part of the processor code itself.
     *
     * @return {void}
     */
    buildStyleMenu() {
        this.debug('buildStyleMenu()');
        const styleData = [
            {
                title: 'ACM Proceedings',
                id: 'acm-sig-proceedings',
            },
            {
                title: 'AMA',
                id: 'american-medical-association',
            },
            {
                title: 'Chicago (author-date)',
                id: 'chicago-author-date',
            },
            {
                title: 'Chicago (full note)',
                id: 'jm-chicago-fullnote-bibliography',
            },
            {
                title: 'DIN-1505-2 (alpha)',
                id: 'din-1505-2-alphanumeric',
            },
            {
                title: 'JM Indigo',
                id: 'jm-indigobook',
            },
            {
                title: 'JM Indigo (L. Rev.)',
                id: 'jm-indigobook-law-review',
            },
            {
                title: 'JM OSCOLA',
                id: 'jm-oscola',
            },
        ];
        const defaultStyle = this.safeStorage.defaultStyle;
        const stylesMenu = document.getElementById('citation-styles');
        for (let i = 0, ilen = styleData.length; i < ilen; i++) {
            const styleDatum = styleData[i];
            const option = document.createElement('option');
            option.setAttribute('value', styleDatum.id);
            if (styleDatum.id === defaultStyle) {
                option.selected = true;
            }
            option.innerHTML = styleDatum.title;
            stylesMenu.appendChild(option);
        }
    }

    /**
     * Listen for selections on the style menu, and initialize the processor
     *   for the selected style.
     *
     * @return {void}
     */
    setStyleListener() {
        this.debug('setStyleListener()');
        document.body.addEventListener('change', (e) => {
            if (e.target.id === 'citation-styles') {
                this.debug(`SET STYLE TO: ${e.target.value}`);
                this.safeStorage.defaultStyle = e.target.value;
                this.callInitProcessor(
                    this.config.defaultStyle,
                    this.config.defaultLocale,
                    this.config.citationByIndex
                );
            }
        });
    }

    /**
     * Listen for click events on the fixed pegs used in the demo.
     *   This is cheating. :-)
     *
     * @return {void}
     */
    setPegListener() {
        this.debug('setPegListener()');
        document.body.addEventListener('click', (e) => {
            if (!this.config.demo || e.target.classList.contains('citeme')) {
                if (document.getElementById('cite-menu')) return;
                this.citationWidgetHandler(e);
            }
        });
    }


    /**
     * This is a demo-specific hack for the citation widget.
     * It's a helper function used to keep the widget in-frame on
     * small devices.
     */
    hasRoomForMenu(obj) {
        let curleft = 0;
        let curtop = 0;
        if (obj.offsetParent) {
            do {
                curleft += obj.offsetLeft;
                curtop += obj.offsetTop;
            } while (obj === obj.offsetParent);
        }
        const xpos = [curleft, curtop][0];

        const w = window;
        const d = document;
        const e = d.documentElement;
        const g = d.getElementsByTagName('body')[0];
        const x = (w.innerWidth || e.clientWidth || g.clientWidth);

        const screenwidth = x;

        return ((screenwidth - xpos) > 114);
    }
}


const citesupport = new CiteSupport();


window.addEventListener('load', () => {
    citesupport.buildStyleMenu();
    citesupport.spoofDocument();
    citesupport.initDocument();
    citesupport.setStyleListener();
    citesupport.setPegListener();
});