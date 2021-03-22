=====================
Running the Processor
=====================

.. include:: substitutions.txt

|CCBYSA| `Frank Bennett <https://twitter.com/fgbjr>`_

------------------------

------------
Introduction
------------

The processor loads as a single ``CSL`` object, and must be instantiated
before use:

.. code-block:: javascript

   var citeproc = new CSL.Engine(sys, style, lang, forceLang);

**sys**
    *Required.* A JavaScript object providing (at least) the functions
    ``retrieveLocale()`` and ``retrieveItem()``.

**style**
    *Required.* CSL style as serialized XML (if ``xmldom.js`` is used)
    or as JavaScript object (if ``xmljson.js`` is used).

**lang**
    *Optional.* A language tag compliant with RFC 5646.  Defaults to ``en``.
    Styles that contain a ``default-locale`` attribute value
    on the ``style`` node will ignore this option unless
    the ``forceLang`` argument is set to a non-nil value.

**forceLang**
    *Optional.* When set to a non-nil value, force the use of the
    locale set in the ``lang`` argument, overriding
    any language set in the ``default-locale`` attribute
    on the ``style`` node.


--------------------------
Required ``sys`` functions
--------------------------

Two locally defined synchronous functions on the ``sys`` object must
be supplied to acquire runtime inputs.

!!!!!!!!!!!!!!
retrieveLocale
!!!!!!!!!!!!!!

The ``retrieveLocale()`` function fetches CSL locales needed at
runtime. The locale source is available for download from the `CSL
locales repository
<https://github.com/citation-style-language/locales>`_.  The function
takes a single RFC 5646 language tag as its sole argument, and returns
a locale object. The return may be a serialized XML string, an E4X
object, a DOM document, or a JSON or JavaScript representation of the
locale XML.  If the requested locale is not available, the function
must return a value that tests ``false``. The function *must* return a
value for the ``us`` locale.

!!!!!!!!!!!!
retrieveItem
!!!!!!!!!!!!

The ``retrieveItem()`` function fetches citation data for an item. The
function takes an item ID as its sole argument, and returns a
JavaScript object in `CSL JSON format <./csl-json/markup.html>`_.

----------------------------------
Public methods: data and rendering
----------------------------------

The instantiated processor offers a few basic methods for handling
input and obtaining rendered output. A few terms will be used with
a specific meaning in the descriptions below.

**item**
    An item is a single bundle of metadata for a source to be referenced.
    See the `CSL Specification <http://docs.citationstyles.org/en/stable/specification.html>`_
    for details on the fields available on an item, and the `CSL-JSON chapter of this manual <./csl-json/markup.html>`_
    for the format of specific field types. Every item must have an ``id``
    and a ``type``.
    
**citation**
    A citation is a set of one or more items, optionally supplemented by
    locator information, prefixes or suffixes supplied by the user.

**registry**
    The processor maintains a stateful registry of details on each item
    submitted for processing. Registry entries are maintained
    automatically, and cover matters such as disambiguation parameters,
    sort sequence, and the first reference in which an item occurs.

**citable items**
    Citable items are those meant for inclusion only if used in one or
    more citations.

**uncited items**
    Uncited items are those meant for inclusion regardless of whether
    they are used in a citation.

    
!!!!!!!!!!!
updateItems
!!!!!!!!!!!

The ``updateItems()`` method accepts a single argument when invoked
as a public method, and refreshes the registry with a designated
set of citable items. Citable items not listed in the argument are removed from the
registry:

.. code-block:: javascript

   citeproc.updateItems(idList);

**idList**
    *Required.* An array of item ``id`` values,
    which may be number or string: 

    .. code-block:: javascript

        ['Item-1', 'Item-2']

!!!!!!!!!!!!!!!!!!
updateUncitedItems
!!!!!!!!!!!!!!!!!!

Like its corollary above, the ``updateUncitedItems()`` method  the registry accepts a single
argument, but refreshes the registry with a designated set of uncited items.
Uncited items not listed in the argument are removed from the registry.


.. code-block:: javascript

   citeproc.updateUncitedItems(idList);

**idList**
    *Required.* A JavaScript array of item ``id`` values,
    which may be number or string: 

    .. code-block:: javascript

        ['Item-1', 'Item-2']

!!!!!!!!!!!!!!!!!!!!!!
processCitationCluster
!!!!!!!!!!!!!!!!!!!!!!

Use the ``processCitationCluster()`` method to generate and
maintain citations dynamically in the text of a document. The method
takes three arguments:

.. code-block:: javascript
   
   var result = citeproc.processCitationCluster(citation, citationsPre, citationsPost);

**citation**
    The citation argument is a citation object as described in the `CSL-JSON section <./csl-json/markup.html>`_ of
    this manual.

**citationsPre**
    An array citationID/note-number pairs preceding the target citation.

**citationsPost**
    A list of citationID/note-number pairs following the target citation
    (note numbers to reflect the state of the document after the insertion).

The result is an array of two elements: a data object, and
an array of one or more index/string pairs, one for each citation
affected by the citation edit or insertion operation.

Code invoking ``processCitationCluster()`` on a document from which several citations
have already been registered in the processor might look like this:

.. code-block:: javascript

   var citation = {
       properties: {
           noteIndex: 3
       },
       citationItems: [
            {
                id: 'Item-X' // A work by Richard Snoakes
            }
        ]
   }
   var citationsPre = [ ["citation-quaTheb4", 1], ["citation-mileiK4k", 2] ];
   var citationsPost = [ ["citation-adaNgoh1", 4] ];
   var result = citeproc.processCitationCluster(citation, citationsPre, citationsPost);
   console.log(JSON.stringify(result[0], null, 2));
   {
       "bibchange": true
   }
   console.log(JSON.stringify(result[1], null, 2));
   [
       [ 1,"(Ronald Snoakes 1950)" ], // Existing citation modified by disambiguation
       [ 3,"(Richard Snoakes 1950)" ]
   ]

A worked example showing the result of multiple transactions can be
found in the `processor test suite`__.

__ https://github.com/citation-style-language/test-suite/blob/master/processor-tests/humans/integration_IbidOnInsert.txt


!!!!!!!!!!!!!!!!!!!!!!
previewCitationCluster
!!!!!!!!!!!!!!!!!!!!!!

Use ``previewCitationCluster()`` to generate accurately formatted
citations as they would appear at a given location within a document
managed using ``processCitationCluster()``. The method accepts four
arguments, the first three of which are identical to those accepted
by ``processCitationCluster()``. The fourth argument may be used to
control the output mode.

.. code-block:: javascript

    var result = citeproc.previewCitationCluster(citation, citationsPre, citationsPost, format);

**citation**
    *See ``processCitationCluster()`` above.*

**citationsPre**
    *See ``processCitationCluster()`` above.*

**citationsPost**
    *See ``processCitationCluster()`` above.*

**format**
    The optional format argument may be one of ``html``, ``text`` or ``rtf``.
    If this argument is not provided, the default value set in the instantiated
    processor is used.

The result is a string representation of the target citation, in the
specified format. Changes made to the registry (necessary for correct
disambiguation, sorting and other adjustments) are reversed after the
citation is generated, leaving the registry in its original state.

    
!!!!!!!!!!!!!!!!!!!
makeCitationCluster
!!!!!!!!!!!!!!!!!!!

Use ``makeCitationCluster()`` to generate citations without the burden of
registry adjustments. The method accepts an array of cite-items as its
sole argument:

.. code-block:: javascript

    var result = citeproc.makeCitationCluster(idList);

**idList**
    An array of cite-items, as specified in the `CSL-JSON section <./csl-json/markup.html>`_ of
    this manual. Note the additional cite-item options noted there.

While ``makeCitationCluster()`` is faster than its companions, note that
it does not perform the citation sort, if any, that might be required by the
style, and that it does not perform disambiguation or apply style rules to
adjust the cites as appropriate to the context. This method is primarily
useful for writing simplified test fixtures. It should not be relied on
in production.


!!!!!!!!!!!!!!!!
makeBibliography
!!!!!!!!!!!!!!!!

The ``makeBibliography()`` method returns a single bibliography object based on
the current state of the processor registry. It accepts on optional argument.


.. code-block:: javascript

   var result = citeproc.makeBibliography(filter);

The value returned by this command is a two-element list, composed of
a JavaScript array containing certain formatting parameters, and a
list of strings representing bibliography entries.  It is the responsibility
of the calling application to compose the list into a finish string
for insertion into the document.  The first
element —- the array of formatting parameters —- contains the key/value
pairs shown below (the values shown are the processor defaults in the
HTML output mode, with registered items "Item-1" and "Item-2").

.. code-block:: javascript

   [
      { 
         maxoffset: 0,
         entryspacing: 0,
         linespacing: 0,
         hangingindent: false,
         second-field-align: false,
         bibstart: "<div class=\"csl-bib-body\">\n",
         bibend: "</div>",
         bibliography_errors: [],
         entry_ids: [[\"Item-1\"], [\"Item-2\"]]
      },
      [
         "<div class=\"csl-entry\">Book A</div>",
         "<div class=\"csl-entry\">Book C</div>"
      ]
   ]


*maxoffset*
   Some citation styles apply a label (either a number or an
   alphanumeric code) to each bibliography entry, and use this label
   to cite bibliography items in the main text.  In the bibliography,
   the labels may either be hung in the margin, or they may be set
   flush to the margin, with the citations indented by a uniform
   amount to the right.  In the latter case, the amount of indentation
   needed depends on the maximum width of any label.  The
   ``maxoffset`` value gives the maximum number of characters that
   appear in any label used in the bibliography.  The client that
   controls the final rendering of the bibliography string should use
   this value to calculate and apply a suitable indentation length.

*entryspacing*
   An integer representing the spacing between entries in the bibliography.

*linespacing*
   An integer representing the spacing between the lines within
   each bibliography entry.

*hangingindent*
   A boolean value indicating whether hanging indent should be applied.

*second-field-align*
   When the ``second-field-align`` CSL option is set, this returns
   either "flush" or "margin".  The calling application should
   align text in bibliography output as described in the `CSL specification`__.
   Where ``second-field-align`` is not set, this return value is set to ``false``.

*bibstart*
   A string to be appended to the front of the finished bibliography
   string.
   
*bibend*
   A string to be appended to the end of the finished bibliography
   string.


__ http://citationstyles.org/downloads/specification.html#bibliography-specific-options



------------
Dirty Tricks
------------

!!!!!!!!!!!!!
Debug logging
!!!!!!!!!!!!!

Errors and warnings are issued by the functions ``CSL.error`` and ``CSL.debug``
respectively, both of which take a single string as argument. The former
throws an error. The latter reports the string to ``console.log`` if available,
otherwise ``dump`` is used. The functions can be redefined to use any reporting
mechanism you like. For example:

.. code-block:: javascript

   CSL.debug = function(str) {
     MyApp.log(str);
   }


!!!!!!!!!!!!!!!!!!!!!!
Special citation forms
!!!!!!!!!!!!!!!!!!!!!!


In ordinary operation, the processor generates citation strings
suitable for a given position in the document, in accordance with the
`CSL Specification
<http://docs.citationstyles.org/en/1.0.1/specification.html>`_.  The
processor is also capable of rendering citation content in three special
forms:

``author-only``
    Render only the author of the item, or where a title is substituted
    in lieu of an author, the title, without citation affixes or styling.

``suppress-author``
    Render the citation omitting the author, or where the title was
    substituted in lieu of an author, the title.

``composite``
    Render the ``author-only`` form, optionally followed by a user-supplied
    ``infix``, followed by the ``suppress-author`` form.

These effects are achieved by setting "citation flags" on processor
input items.  For styles that do not produce satisfactory results for
the ``author-only`` form by default (such as numeric or "trigraph"
styles), an optional ``cs:intext`` element can be added to the style
as a sibling to ``cs:citation`` and ``cs:bibliography``. (Note that
the ``cs:intext`` element is outside the official CSL Specification.)

The citation flags are applied differently in the two methods of running the
processor (``makeCitationCluster`` and ``processCitationCluster``). As the
former is used primarily for testing purposes, it is explained only briefly
below, followed by a more complete explanation of citation flags with
the ``processCitationCluster`` method.


^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
Citation flags with ``makeCitationCluster``
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

With the ``makeCitationCluster`` method, citation flags are added to
input citation items as boolean flags. For example, citations to
Ken Kesey's novel *Sometimes a Great Notion* might be called as follows:

.. code-block:: json

    [
        { "ITEM-1" },
        { "ITEM-1", "author-only": true },
        { "ITEM-1", "suppress-author": true }
    ]

With a simple author-date style, this produces the following citation strings:

.. code-block:: html

    (Kesey 1964)
    Kesey
    (1964)

The ``composite`` citation flag is not available in the
``makeCitationCluster`` method. If applied, it will have no effect.

^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
Citation flags with ``processCitationCluster``
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

The ``processCitationCluster`` method provides full support for
citation flags. In addition to recognizing ``composite``, this method
will ignore citations set with the ``author-only`` flag for
back-referencing purposes (i.e. ibid and targeted references using
``first-reference-note-number``). The following input sample
exercises the flags in a series of four citations. Note the use
of the ``mode`` attribute on the ``properties`` segment of each
citation:

.. code-block:: json

    [
        [
            {
                "citationID": "CITATION-1",
                "citationItems": [ { "id": "ITEM-1" } ],
                "properties": { "noteIndex": 0 }
            },
            [],
            []
        ],
        [
            {
                "citationID": "CITATION-2",
                "citationItems": [ { "id": "ITEM-1" } ],
                "properties": { "noteIndex": 0, "mode": "author-only" }
            },
            [["CITATION-1", 0]],
            []
        ],
        [
            {
                "citationID": "CITATION-3",
                "citationItems": [ { "id": "ITEM-1" } ],
                "properties": { "noteIndex": 0, "mode": "suppress-author" }
            },
            [["CITATION-1", 0],["CITATION-2", 0]],
            []
        ],
        [
            {
                "citationID": "CITATION-4",
                "citationItems": [ { "id": "ITEM-1" } ],
                "properties": { "noteIndex": 0, "mode": "composite" }
            },
            [["CITATION-1", 0],["CITATION-2", 0],["CITATION-3", 0]],
            []
        ]
    ]

In a simple author-date style that italicizes author names, this
produces the following citation strings. Note that formatting is
stripped from the ``author-only`` and ``composite`` renderings of the
author name:
    
.. code-block:: html

    (<i>Kesey</i> 1964)
    Kesey
    (1964)
    Kesey (1964)

When ``suppress-author`` or ``composite`` are set on a multiple
citation, collapsing is performed in the usual way. For example, in
our simple italicizing author-date style, a citation to Ken Kesey's
novels *One Flew Over the Cuckoo's Nest* and *Sometimes a Great
Notion*, followed by Ursula Le Guin's *Left Hand of Darkness* will
render as follows if ``collapse="year"`` is set on the ``cs:citation``
element:

.. code-block:: html

    Kesey (1962, 1964; <i>Le Guin</i> 1969)

An ``infix`` attribute can be used to insert text between the two
halves of a ``composite`` citation, with input like the following:

.. code-block:: json

    [
        [
            {
                "citationID": "CITATION-1",
                "citationItems": [
                    { "id": "ITEM-1" },
                    { "id": "ITEM-2" },
                    { "id": "ITEM-3", "prefix": "cf." }
                ],
                "properties": {
                    "mode": "composite",
                    "noteIndex": 0,
                    "infix": "'s early work"
                }
            },
            [],
            []
        ]
    ]

In our simple style, this produces the following output:

.. code-block:: text

    Kesey’s early work (1962, 1964; cf. <i>Le Guin</i> 1969)

In the example above, space before the apostrophe is quashed
automatically: text without leading punctuation will attract
a leading space. Note also that affixes are recognized
within items.

To support styles that require discrete formatting of names written
into the document text, the processor recognizes a ``cs:intext``
element as a sibling to ``cs:citation`` and ``cs:bibliography``.  The
following minimal style will render author names joined by ``&`` in citations,
and by ``and`` in the ``author-only`` or ``composite`` forms:

.. code-block:: xml

    <style 
          xmlns="http://purl.org/net/xbiblio/csl"
          class="in-text"
          version="1.0">
      <info>
        <id />
        <title />
        <updated>2009-08-10T04:49:00+09:00</updated>
      </info>
      <citation collapse="year">
        <layout prefix="(" suffix=")" delimiter="; ">
          <group delimiter=" ">
            <names variable="author">
              <name form="short" font-style="italic" and="symbol"/>
            </names>
            <date variable="issued" date-parts="year" form="text"/>
          </group>
        </layout>
      </citation>
      <bibliography>
        <layout prefix="(" suffix=")" delimiter="; ">
          <group delimiter=" ">
            <group delimiter=", ">
              <names variable="author">
                <name form="short" and="symbol"/>
              </names>
              <text variable="title"/>
              <date variable="issued" date-parts="year" form="text" prefix="(" suffix=")"/>
            </group>
          </group>
        </layout>
      </bibliography>
      <intext>
        <layout>
          <names variable="author">
            <name and="text" form="short"/>
          </names>
        </layout>
      </intext>
    </style>

The style produces the output below when called against Fisher &
Ury's classic negotiation text, *Getting to Yes: Reaching Agreement
Without Giving In*, with no citation flags, and with the ``composite``
flag respectively:

.. code-block:: html

    (<i>Fisher</i> &#38; <i>Ury</i> 1991)
    Fisher and Ury (1991)

In some cases, the processor will be unable to produce content for an
``author-only`` citation flag, or for the corresponding portion of a
``composite`` citation. This may occur when no ``cs:intext`` is
provided, and the item begins with a bare ``cs:text`` or other
non-names element. This may be true for a legal item type, and is
always true of numeric and trigraph styles; and a ``cs:intext``
element may itself fail to produce output for a particular item.  By
default in such cases, the processor will output an ugly slug:

.. code-block:: html

    (Unauthored thing 1964)
    [NO_PRINTED_FORM]
    (Unauthored thing 1964)
    [NO_PRINTED_FORM] (Unauthored thing 1964)

The instantiated processor can be set to throw a JavaScript error with
code ``ECSEMPTY`` rather than printing the slug:

.. code-block:: javascript

   citeproc.opt.development_extensions.throw_on_empty = true;

The toggle can be switched on and off to select the behavior appropriate
to context in the calling application.

!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
Selective output with ``makeBibliography()``
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

The ``makeBibliography()`` command accepts one optional argument,
which is a nested JavaScript object that may contain
*one of* the objects ``select``, ``include`` or ``exclude``, and
optionally an additional  ``quash`` object.  Each of these four objects
is an array containing one or more objects with ``field`` and ``value``
attributes, each with a simple string value (see the examples below).
The matching behavior for each of the four object types, with accompanying
input examples, is as follows:

``select``
   For each item in the bibliography, try every match object in the array against
   the item, and include the item if, and only if, *all* of the objects match.

.. admonition:: Hint

   The target field in the data items registered in the processor
   may either be a string or an array.  In the latter case,
   an array containing a value identical to the
   relevant value is treated as a match.

.. code-block:: javascript

   var myarg = {
      "select" : [
         {
            "field" : "type",
            "value" : "book"
         },
         {  "field" : "categories",
             "value" : "1990s"
         }
      ]
   }

   var mybib = cp.makeBibliography(myarg);

``include``
   Try every match object in the array against the item, and include the
   item if *any* of the objects match.

.. code-block:: javascript

   var myarg = {
      "include" : [
         {
            "field" : "type",
            "value" : "book"
         }
      ]
   }

   var mybib = cp.makeBibliography(myarg);

``exclude``
   Include the item if *none* of the objects match.

.. code-block:: javascript

   var myarg = {
      "exclude" : [
         {
            "field" : "type",
            "value" : "legal_case"
         },
         {
            "field" : "type",
            "value" : "legislation"
         }
      ]
   }

   var mybib = cp.makeBibliography(myarg);

``quash``
   Regardless of the result from ``select``, ``include`` or ``exclude``,
   skip the item if *all* of the objects match.


.. admonition:: Hint

   An empty string given as the field value will match items
   for which that field is missing or has a nil value.

.. code-block:: javascript

   var myarg = {
      "include" : [
         {
            "field" : "categories",
            "value" : "classical"
         }
      ],
      "quash" : [
         {
            "field" : "type",
            "value" : "manuscript"
         },
         {
            "field" : "issued",
            "value" : ""
         }
      ]
   }

   var mybib = cp.makeBibliography(myarg);




