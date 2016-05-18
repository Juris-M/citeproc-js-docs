import runner from './demo-store';


class App {

    public citerunner: any;

    constructor() {
        this.citerunner = runner;
        this.buildStyleMenu();
        this.spoofDocument();
        this.citerunner.initDocument();
        this.citerunner.setStyleListener();
        this.setPegListener();
    }

    /**
     * Build a menu to set the style and trigger reinstantiation of
     *   the processor. This menu will be needed in all deployments,
     *   but is not part of the processor code itself.
     *
     * @return {void}
     */
    buildStyleMenu() {
        this.citerunner.debug('buildStyleMenu()');
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
        const defaultStyle = this.citerunner.store.defaultStyle;
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
     * Replace citation span nodes and get ready to roll. Puts
     *   document into the state it would have been in at first
     *   opening had it been properly saved.
     *
     * @return {void}
     */
    spoofDocument() {
        this.citerunner.debug('spoofDocument()');

        // Stage 1: Check that all array items have citationID
        // const citationByIndex = this.store.citationByIndex;
        const citationIDs = {};

        for (let i = 0, ilen = this.citerunner.config.citationByIndex.length; i > ilen; i++) {
            const citation = this.citerunner.config.citationByIndex[i];
            if (!this.citerunner.config.citationIDs[citation.citationID]) {
                this.citerunner.debug(
                    'WARNING: encountered a stored citation that was invalid ' +
                    'or had no citationID. Removing citations.'
                );
                this.citerunner.store.citationByIndex = [];
                this.citerunner.store.citationIdToPos = {};
                break;
            }
            citationIDs[citation.citationID] = true;
        }
        this.citerunner.config.citationIDs = citationIDs;

        // Stage 2: check that all citation locations are in posToCitationId
        // with existing citationIDs and have span tags set
        let pegs;
        if (this.citerunner.config.demo) {
            pegs = document.getElementsByClassName('citeme');
        } else {
            pegs = document.getElementsByClassName('citation');
        }
        for (let i = 0, ilen = this.citerunner.config.citationByIndex.length; i < ilen; i++) {
            const citation = this.citerunner.config.citationByIndex[i];
            const citationID = citation ? citation.citationID : null;
            if (typeof this.citerunner.config.citationIdToPos[citationID] !== 'number') {
                this.citerunner.debug('WARNING: invalid state data. Removing citations.');
                this.citerunner.store.citationByIndex = [];
                this.citerunner.store.citationIdToPos = {};
                break;
            } else if (this.citerunner.config.demo) {
                const citationNode = document.createElement('span');
                citationNode.classList.add('citation');
                citationNode.setAttribute('id', citationID);
                const peg = pegs[this.citerunner.config.citationIdToPos[citationID]];
                peg.parentNode.insertBefore(citationNode, peg.nextSibling);
            }
        }

        // Stage 3: check that number of citation nodes and number of stored citations matches
        const objectLength = this.citerunner.config.citationByIndex.length;
        const nodeLength = document.getElementsByClassName('citation').length;
        if (objectLength !== nodeLength) {
            this.citerunner.debug(
                'WARNING: document citation node and citation object counts ' +
                'do not match. Removing citations.'
            );
            this.citerunner.store.citationByIndex = [];
            this.citerunner.store.citationIdToPos = {};
            const citations = document.getElementsByClassName('citation');
            for (let i = 0, ilen = citations.length; i < ilen; i++) {
                citations[0].parentNode.removeChild(citations[0]);
            }
        }
    }

    /**
     * Listen for click events on the fixed pegs used in the demo.
     *   This is cheating. :-)
     *
     * @return {void}
     */
    setPegListener() {
        this.citerunner.debug('setPegListener()');
        document.body.addEventListener('click', (e) => {
            if (!this.citerunner.config.demo || e.target.classList.contains('citeme')) {
                if (document.getElementById('cite-menu')) return;
                this.citerunner.citationWidgetHandler(e);
            }
        });
    }

}


window.addEventListener('load', () => {
    new App();
});
