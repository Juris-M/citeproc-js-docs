var citesupport = new function () {
    this.initProcessor = initProcessor;
    this.registerCitation = registerCitation;
    this.getCurrentCitationInfo = getCurrentCitationInfo;
    this.citationAddOrEditHandler = citationAddOrEditHandler;
    //
    var config = {
        debug: false,
        mode: 'note',
        defaultLocale: 'en-US',
        defaultStyle: 'jm-indigobook-law-review',
        posToCitationId: {},
        citationIdToPos: {},
        processorReady: false,
        citationByIndex: [],
        current: {}
    }
    this.config = config;

    /*
     * Local configs (move to separate file when time permits maybe)
     */

    function debug (txt) {
        if (config.debug) {
            console.log('*** '+txt);
        }
    }

    /*
     * Insert handler
     */

    function citationAddOrEditHandler(event) {
        debug('citationAddOrEditHandler()');
        var menu = document.getElementById('cite-menu');
        var citationItems = getCitationItemIdsFrom(menu);
        var hasCitation = menuHasCitation(menu);
        config.current = getCurrentCitationInfo();

        // If there are no citation items from the menu,
        // then we are either removing an existing citation
        // or doing nothing.
        if (citationItems.length === 0) {
            if (hasCitation) {
                // Remove existing citation
                removeCitation();
            } else {
                // Do nothing
                removeCiteMenu();
            }
            return;
        } else {
            if (!hasCitation) {
                domInsertEmptyCitationMarkerAt(menu);
            }
        }

        // Get citation details for submission
        var citationNodes = document.getElementsByClassName('citation');
        var splitData = getCitationSplits(citationNodes);
        // Compose the citation.
        var citation;
        if (splitData.citation) {
            citation = splitData.citation;
            citation.citationItems = citationItems;
        } else {
            citation = {
                citationItems: citationItems,
                properties: {
                    noteIndex: 0
                }
            }
        }
        if (config.mode === 'note') {
            citation.properties.noteIndex = (splitData.citationsPre.length + 1);
            fixupPrePostNoteNumbers(splitData.citationsPre, splitData.citationsPost);
        }
        // Submit the citation.
        // Remove menu in bounce-back.
        citesupport.registerCitation(citation, splitData.citationsPre, splitData.citationsPost);
    };

    function removeCitation() {
        debug('removeCitation()');

        // Remove citation from DOM
        if (config.current.citationID) {
            domRemoveCitation(config.current.citationID);
        }

        // Remove citation from citationByIndex, posToCitationId, and citationIdToPos
        // Adjust note numbers in citationByIndex child properties if note style
        removePos = removeIdFromDataSets(config.mode, config.current.citationID);

        // If we have no citations left, initialize the processor
        // Otherwise, re-insert the first citation in the list to trigger and update
        if (config.citationByIndex.length === 0) {
            localStorage.removeItem('citationByIndex');
            citesupport.initProcessor(config.defaultStyle, config.defaultLocale, config.citationByIndex);
        } else {
            domHideFootnoteAt(removePos);
            var splitData = getCitationSplits();
            splitData.citation.properties.noteIndex = 1;
            config.processorReady = true;
            citesupport.registerCitation(splitData.citation, splitData.citationsPre, splitData.citationsPost);
        }
    }

    /*
     * Utility functions
     */

    function fixupPrePostNoteNumbers(citationsPre, citationsPost) {
        debug('fixupPrePostNoteNumbers()');
        for (var i=0,ilen=citationsPre.length;i<ilen;i++) {
            citationsPre[i][1] = (i + 1);
        }
        var offset = (citationsPre.length+1)
        for (var i=0,ilen=citationsPost.length;i<ilen;i++) {
            citationsPost[i][1] = (i + offset + 1);
        }
    }

    function removeCiteMenu() {
        debug('removeCiteMenu()');
        var menu = document.getElementById('cite-menu');
        if (menu) {
            menu.parentNode.removeChild(menu);
        }
    }

    function getCurrentCitationInfo() {
        debug('getCurrentCitationInfo()');
        var info = {
            pos: 0,
            citationID: null
        };
        var citemeNodes = document.getElementsByClassName('citeme');
        var citationIndex = 0;
        for (var i=0,ilen=citemeNodes.length;i<ilen;i++) {
            var node = citemeNodes[i];
            var sib = node.nextSibling;
            var hasCitationNode = false;
            if (sib && sib.classList && sib.classList.contains('citation')) {
                hasCitationNode = true;
            }
            if (node.firstChild) {
                info.pos = i;
                info.citationIndex = citationIndex;
                if (hasCitationNode) {
                    info.citationID = sib.getAttribute('id');
                }
                break;
            } else if (hasCitationNode) {
                citationIndex++;
            }
        }
        return info;
    }

    function menuHasCitation(menuNode) {
        debug('menuHasCitation()');
        var sib = menuNode.parentNode.nextSibling;
        var hasCitation = false;
        if (sib && sib.classList && sib.classList.contains('citation')) {
            hasCitation = true;
        };
        return hasCitation;
    }

    function getCitationItemIdsFrom(menuNode) {
        debug('getCitationItemIdsFrom()');
        var citationItems = [];
        var checkboxes = menuNode.getElementsByTagName('input');
        for (var i=0,ilen=checkboxes.length;i<ilen;i++) {
            var checkbox = checkboxes[i];
            if (checkbox.checked) {
                citationItems.push({
                    id: checkbox.getAttribute('value')
                });
            }
        }
        return citationItems;
    }

    function convertRebuildDataToCitationData(rebuildData) {
        if (!rebuildData) return;
        debug('rebuildCitations()');
        // rebuildData has this structure:
        //   [<citation_id>, <note_number>, <citation_string>]
        // domSetCitations() wants this structure:
        //   [<citation_index>, <citation_string>, <citation_id>]
        var citationData = rebuildData.map(function(obj){
            return [0, obj[2], obj[0]];
        })
        for (var i=0,ilen=citationData.length;i<ilen;i++) {
            citationData[i][0] = i;
        }
        return citationData;
    }

    function getCitationSplits(nodes) {
        debug('getCitationSplits()');
        var splitData = {
            citation: null,
            citationsPre: [],
            citationsPost: []
        }
        var current = 'citationsPre';
        var offset = 0;
        if (nodes) {
            for (var i=0,ilen=nodes.length;i<ilen;i++) {
                var node = nodes[i];
                if (node.previousSibling.firstChild) {
                    current = 'citationsPost';
                    if (!node.firstChild) {
                        // Inserting a new citation
                        offset = -1;
                    } else {
                        // Editing an existing citation
                        splitData.citation = config.citationByIndex[i];
                    }
                } else {
                    splitData[current].push([config.citationByIndex[i + offset].citationID, 0]);
                }
            }
        } else {
            splitData.citation = config.citationByIndex[0];
            splitData.citationsPost = config.citationByIndex.slice(1).map(function(obj){
                return [obj.citationID, 0];
            })
        }
        return splitData;
    }

    function removeIdFromDataSets(mode, citationID) {
        debug('removeIdFromDataSets()');
        var removePos = -1;
        for (var i=config.citationByIndex.length-1;i>-1;i--) {
            if (config.citationByIndex[i].citationID === citationID) {
                var citation = config.citationByIndex[i];
                removePos = config.citationIdToPos[citationID];
                delete config.posToCitationId[config.citationIdToPos[citation.citationID]];
                delete config.citationIdToPos[citation.citationID];
                config.citationByIndex = config.citationByIndex.slice(0, i).concat(config.citationByIndex.slice(i+1));
                if (mode === 'note') {
                    for (var j=i,jlen=config.citationByIndex.length;j<jlen;j++) {
                        config.citationByIndex[j].properties.noteIndex += -1;
                    }
                }
            }
        }
        return removePos;
    }

    /*
     * DOM methods
     */

    function domSetCitations(mode, citeTuples, addOrEdit) {
        debug('domSetCitations()');
        //
        for (var i=0,ilen=citeTuples.length;i<ilen;i++) {
            if (addOrEdit && !config.current.citationID) {
                var citationID = citeTuples[i][2];
                domSetNewCitation(citationID);
            }
        }
        if (mode === 'note') {
            var footnoteTexts = document.getElementsByClassName('footnote-text');
            var footnoteNumbers = document.getElementsByClassName('footnote-number');
            var footnoteContainer = document.getElementById('footnote-container');
            if (citeTuples.length) {
                footnoteContainer.hidden = false;
            } else {
                footnoteContainer.hidden = true;
            }
            for (var i=0,ilen=citeTuples.length;i<ilen;i++) {
                // Marshal data
                var tuple = citeTuples[i];
                var citationID = tuple[2];
                var citationNode = document.getElementById(citationID);
                var citationText = tuple[1];
                var citationIndex = tuple[0];
                // Apply changes
                citationNode.innerHTML = '[' + (citationIndex+1) + ']';
                var idx = config.citationIdToPos[citationID];
                footnoteNumbers[idx].innerHTML = "" + (citationIndex+1);
                footnoteTexts[idx].parentNode.hidden = false;
                footnoteTexts[idx].innerHTML = citationText;
            }
            domFixupNoteNumbers();
        } else {
            for (var i=0,ilen=citeTuples.length;i<ilen;i++) {
                var tuple = citeTuples[i];
                var citationID = tuple[2];
                var citationNode = document.getElementById(citationID);
                var citationText = citeTuples[i][1];
                citationNode.innerHTML = citationText;
            }
        }
    }

    function domSetBibliography(data) {
        debug('domSetBibliography()');
        var bibContainer = document.getElementById('bibliography-container');
        if (!data || !data[1] || data[1].length === 0) {
            bibContainer.hidden = true;
            return;
        };
        var bib = document.getElementById('bibliography');
        bib.innerHTML = data[1].join('\n');
        var entries = document.getElementsByClassName('csl-entry');
        if (data[0].hangingindent) {
            for (var i=0,ilen=entries.length;i<ilen;i++) {
                var entry = entries[i];
                entry.setAttribute('style', 'padding-left: 1.3em;text-indent: -1.3em;');
            }
        } else if (data[0]['second-field-align']) {
            for (var i=0,ilen=entries.length;i<ilen;i++) {
                var entry = entries[i];
                entry.setAttribute('style', 'white-space: nowrap;');
            }
            var numbers = document.getElementsByClassName('csl-left-margin');
            for (var i=0,ilen=numbers.length;i<ilen;i++) {
                var number = numbers[i];
                number.setAttribute('style', 'float: left;padding-right: 0.3em;');
            }
            var texts = document.getElementsByClassName('csl-right-inline');
            for (var i=0,ilen=texts.length;i<ilen;i++) {
                var text = texts[i];
                text.setAttribute('style', 'display: inline-block;white-space: normal;');
            }
        }
        bibContainer.hidden = false;
    }

    function domClearDocument() {
        debug('domClearDocument()');
        domRemoveCitations();
        domHideBibliographySection();
        domHideFootnoteSection();
        domHideFootnotes();
        domPrepCitations();
    }

    function domRemoveCitations() {
        debug('domRemoveCitations()');
        var citationNodes = document.getElementsByClassName('citation');
        for (var i=0,ilen=citationNodes.length;i<ilen;i++) {
            citationNodes[0].parentNode.removeChild(citationNodes[0]);
        }
    }

    function domHideBibliographySection() {
        debug('domHideBibliographySection()');
        var bibContainer = document.getElementById('bibliography-container');
        bibContainer.hidden = true;
    }

    function domHideFootnoteSection() {
        debug('domHideFootnoteSection()');
        var footnoteContainer = document.getElementById('footnote-container');
        footnoteContainer.hidden = true;
    }

    function domHideFootnotes() {
        debug('domHideAllFootnotes()');
        var footnotes = document.getElementById('footnotes');
        for (var i=0,ilen=footnotes.children.length;i<ilen;i++) {
            footnotes.children[i].hidden = true;
        }
    }

    function domPrepCitations() {
        debug('domPrepCitations()');
        var positionNodes = document.getElementsByClassName('citeme');
        for (var i=0,ilen=config.citationByIndex.length;i<ilen;i++) {
            var citation = config.citationByIndex[i];
            var positionNode = positionNodes[config.citationIdToPos[citation.citationID]];
            var citationNode = document.createElement('span');
            citationNode.classList.add('citation');
            citationNode.setAttribute('id', citation.citationID);
            positionNode.parentNode.insertBefore(citationNode, positionNode.nextSibling);
        }
    }

    function domSetNewCitation(citationID) {
        debug('domSetNewCitation()');
        if ("number" !== typeof config.citationIdToPos[citationID]) {
            var citationNode = document.getElementById('citation-breadcrumb');
            citationNode.setAttribute('id', citationID);
            config.citationIdToPos[citationID] = config.current.pos;
            config.posToCitationId[config.current.pos] = citationID;
            config.current = getCurrentCitationInfo();
        }
    }

    function domInsertEmptyCitationMarkerAt(menu) {
        debug('domInsertEmptyCitationMarkerAt()');
        var citationNode = document.createElement('span');
        citationNode.classList.add('citation');
        menu.parentNode.parentNode.insertBefore(citationNode, menu.parentNode.nextSibling);
        citationNode.setAttribute('id', 'citation-breadcrumb');
    }

    function domFixupNoteNumbers() {
        debug('domFixupNoteNumbers()');
        if (config.mode !== 'note') return;
        var citationNodes = document.getElementsByClassName('citation');
        for (var i=0,ilen=citationNodes.length;i<ilen;i++) {
            var citationNode = citationNodes[i];
            citationNode.innerHTML = '[' + (i+1) + ']'
        }
        var footnoteNumberNodes = document.getElementsByClassName('footnote-number');
        var footnoteNumber = 1;
        for (var i=0,ilen=footnoteNumberNodes.length;i<ilen;i++) {
            var footnoteNumberNode = footnoteNumberNodes[i];
            if (!footnoteNumberNode.parentNode.hidden) {
                footnoteNumberNode.innerHTML = "" + footnoteNumber;
                footnoteNumber++;
            }
        }
    }

    function domRemoveCitation(citationID) {
        debug('domRemoveCitation()');
        var citationToRemove = document.getElementById(config.current.citationID);
        citationToRemove.parentNode.removeChild(citationToRemove);
        delete config.posToCitationId[config.citationIdToPos[citationToRemove.citationID]];
        delete config.citationIdToPos[citationToRemove.citationID];
        localStorage.setItem('posToCitationId', JSON.stringify(config.posToCitationId));
        localStorage.setItem('citationIdToPos', JSON.stringify(config.citationIdToPos));
    }

    function domHideFootnoteAt(pos) {
        debug('domHideFootnoteAt()');
        if (config.mode === 'note') {
            var footnotes = document.getElementById('footnotes').children;
            footnotes[pos].hidden = true;
        }
    }

    /*
     * Worker API
     */

    var worker = new Worker('_static/js/citeworker.js');

    function initProcessor(styleName, localeName, citationByIndex) {
        // Instantiates the processor
        debug('initProcessor() [CALL]');
        config.processorReady = false;
        if (!citationByIndex) {
            citationByIndex = {};
        }
        domClearDocument();
        worker.postMessage({
            command: 'initProcessor',
            styleName: styleName,
            localeName: localeName,
            citationByIndex: citationByIndex
        });
    }

    function registerCitation(citation, preCitations, postCitations) {
        // Use return from getCitationID and data fetched from
        // selections in the UI to submit an edit request
        if (!config.processorReady) return;
        debug('registerCitation() [CALL]');
        config.processorReady = false;
        worker.postMessage({
            command: 'registerCitation',
            citation: citation,
            preCitations: preCitations,
            postCitations: postCitations
        });
    }

    worker.onmessage = function(e) {
        var d = e.data;
        switch(d.command) {
        case 'initProcessor':
            debug('initProcessor() [RESPONSE]');
            removeCiteMenu();
            config.mode = d.xclass;
            var citationData = convertRebuildDataToCitationData(d.rebuildData);
            domSetCitations(config.mode, citationData);
            domSetBibliography(d.bibliographyData);
            config.processorReady = true;
            break;
        case 'registerCitation':
            debug('registerCitation() [RESPONSE]');
            config.citationByIndex = d.citationByIndex;
            domSetCitations(config.mode, d.citationData, true);
            domSetBibliography(d.bibliographyData);
            localStorage.setItem('citationByIndex', JSON.stringify(config.citationByIndex));
            localStorage.setItem('citationIdToPos', JSON.stringify(config.citationIdToPos));
            localStorage.setItem('posToCitationId', JSON.stringify(config.posToCitationId));
            removeCiteMenu();
            config.processorReady = true;
            break;
        }
    }
}

function buildStyleMenu () {
    console.log('citesupport: buildStyleMenu()');
    var styleData = [
        {
            title: "American Medical Association",
            id: "american-medical-association"
        },
        {
            title: "Chicago Manual of Style 16th edition (author-date)",
            id: "chicago-author-date"
        },
        {
            title: "JM Chicago Manual of Style 16th edition (full note)",
            id: "jm-chicago-fullnote-bibliography"
        },
        {
            title: "JM Indigo Book",
            id: "jm-indigobook"
        },
        {
            title: "JM Indigo Book (law reviews)",
            id: "jm-indigobook-law-review"
        },
        {
            title: "OSCOLA - Oxford Standard for Citation of Legal Authorities",
            id: "jm-oscola"
        }
    ]
    if (localStorage.getItem('defaultStyle')) {
        citesupport.config.defaultStyle = localStorage.getItem('defaultStyle');
    }
    var stylesMenu = document.getElementById('citation-styles');
    for (var i=0,ilen=styleData.length;i<ilen;i++) {
        var styleDatum = styleData[i];
        var option = document.createElement('option');
        option.setAttribute('value', styleDatum.id);
        if (styleDatum.id === citesupport.config.defaultStyle) {
            option.selected = true;
        }
        option.innerHTML = styleDatum.title;
        stylesMenu.appendChild(option);
    }
}

function buildItemMenu(node) {
    var itemData = [
        {
            title: "Geller 2002",
            id: "item01"
        },
        {
            title: "West 1934",
            id: "item02"
        },
        {
            title: "Allen 1878",
            id: "item03"
        },
        {
            title: "American case",
            id: "item04"
        },
        {
            title: "British case",
            id: "item05"
        }
    ]
    var citeMenu = document.createElement('div');
    citeMenu.setAttribute('id', 'cite-menu');
    var innerHTML = '<div class="menu">'
    var tmpl = '<label><input id="%%ID%%" type="checkbox" name="cite-menu-item" value="%%ID%%">%%TITLE%%</label><br/>'

    for (var i=0,ilen=itemData.length;i<ilen;i++) {
        var datum = itemData[i];
        innerHTML += tmpl.split('%%ID%%').join(datum.id).replace('%%TITLE%%', datum.title);
    }
    innerHTML += '</div>';
    citeMenu.innerHTML = innerHTML;
    var button = document.createElement('button');
    button.setAttribute('type', 'button');
    button.innerHTML = 'Save';
    var menu = citeMenu.getElementsByClassName('menu')[0];
    menu.appendChild(button);
    node.appendChild(citeMenu);

    // XXX If no citation attached, menu is blank
    if (node.nextSibling && node.nextSibling.classList && node.nextSibling.classList.contains('citation')) {
        // XXX If citation is attached, index should be in the map, so use it.
        citesupport.config.current = citesupport.getCurrentCitationInfo();
        var citation = citesupport.config.citationByIndex[citesupport.config.current.citationIndex];
        var itemIDs = citation.citationItems.map(function(obj){
            return obj.id;
        });
        for (var i=0,ilen=itemIDs.length;i<ilen;i++) {
            var menuItem = document.getElementById(itemIDs[i]);
            menuItem.checked = true;
        }
    }
    button.addEventListener('click', citesupport.citationAddOrEditHandler);
}


function initCiteSupport() {
    function safeStorageGet(key, fallback) {
        var ret;
        var val = localStorage.getItem(key);
        if (!val) {
            console.log('No value in storage!');
            ret = fallback;
        } else {
            try {
                ret = JSON.parse(val);
            } catch (e) {
                console.log('JSON parse error! '+key+" "+val);
                ret = fallback;
            }
        }
        citesupport.config[key] = ret;
        return ret;
    }

    safeStorageGet('citationIdToPos', {});
    safeStorageGet('posToCitationId', {});
    safeStorageGet('citationByIndex', []);

    // Validate. All citation IDs and positions must be in maps,
    // and vice-a-versa
    function validateStorage () {
        var seenCitationIDs = {};
        for (var i=citesupport.config.citationByIndex.length-1;i>-1;i--) {
            var citation = citesupport.config.citationByIndex[i];
            if ("number" === typeof citesupport.config.citationIdToPos[citation.citationID]) {
                seenCitationIDs[citation.citationID] = true;
            } else {
                console.log('WARNING: removing unindexed citation from storage');
                citesupport.config.citationByIndex = citesupport.config.citationByIndex.slice(0, i).concat(citesupport.config.citationByIndex.slice(i+1));
            }
        }
        for (var key in citesupport.config.citationIdToPos) {
            if (!seenCitationIDs[key]) {
                console.log('WARNING: removing orphan index entry from storage');
                delete citesupport.config.citationIdToPos[key];
            }
        }
        citesupport.config.posToCitationId = {};
        for (var i=0,ilen=citesupport.config.citationByIndex.length;i<ilen;i++) {
            var citation = citesupport.config.citationByIndex[i];
            citesupport.config.posToCitationId[citesupport.config.citationIdToPos[citation.citationID]] = citation.citationID;
        }
        for (var i=0,ilen=citesupport.config.citationByIndex.length;i<ilen;i++) {
            if (citesupport.config.mode === 'note') {
                citesupport.config.citationByIndex[i].properties.noteIndex = (i+1);
            } else {
                citesupport.config.citationByIndex[i].properties.noteIndex = 0;
            }
        }
        localStorage.setItem('citationIdToPos', JSON.stringify(citesupport.config.citationIdToPos));
        localStorage.setItem('posToCitationId', JSON.stringify(citesupport.config.posToCitationId));
        localStorage.setItem('citationByIndex', JSON.stringify(citesupport.config.citationByIndex));
        console.log('CONFIG citationByIndex: '+JSON.stringify(citesupport.config.citationByIndex.map(function(obj){return obj.citationID})));
        console.log('CONFIG citationIdToPos: '+JSON.stringify(citesupport.config.citationIdToPos));
        console.log('CONFIG posToCitationId: '+JSON.stringify(citesupport.config.posToCitationId));
    }
    validateStorage();
}


/*
 * Listener
 */

window.addEventListener('load', function(event) {
    initCiteSupport();
    buildStyleMenu();
    citesupport.initProcessor(citesupport.config.defaultStyle, citesupport.config.defaultLocale, citesupport.config.citationByIndex);
    document.body.addEventListener('change', function(e) {
        if (e.target.getAttribute('id') === 'citation-styles') {
            citesupport.config.defaultStyle = e.target.value;
            localStorage.setItem('defaultStyle', citesupport.config.defaultStyle);
            citesupport.initProcessor(citesupport.config.defaultStyle, citesupport.config.defaultLocale, citesupport.config.citationByIndex);
        }
    });
    document.body.addEventListener('click', function(e) {
        if (e.target.classList.contains('citeme')) {
            if (document.getElementById('cite-menu')) return;
            var node = e.target;
            buildItemMenu(node);
        }
    });
});
