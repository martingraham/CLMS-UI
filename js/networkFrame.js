//  CLMS-UI
//  Copyright 2015 Colin Combe, Rappsilber Laboratory, Edinburgh University
//
//  This file is part of CLMS-UI.
//
//  CLMS-UI is free software: you can redistribute it and/or modify
//  it under the terms of the GNU General Public License as published by
//  the Free Software Foundation, either version 3 of the License, or
//  (at your option) any later version.
//
//  CLMS-UI is distributed in the hope that it will be useful,
//  but WITHOUT ANY WARRANTY; without even the implied warranty of
//  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//  GNU General Public License for more details.
//
//  You should have received a copy of the GNU General Public License
//  along with CLMS-UI.  If not, see <http://www.gnu.org/licenses/>.

var CLMSUI = CLMSUI || {};

// http://stackoverflow.com/questions/11609825/backbone-js-how-to-communicate-between-views
CLMSUI.vent = {};
_.extend(CLMSUI.vent, Backbone.Events);

CLMSUI.init = CLMSUI.init || {};

// only when sequences and blosums have been loaded, if only one or other either no align models = crash, or no blosum matrices = null
CLMSUI.init.postDataLoaded = function() {
    console.log("DATA LOADED AND WINDOW LOADED");
    
    CLMSUI.compositeModelInst.set("go", CLMSUI.go); // add pre-parsed go terms to compositeModel from placeholder
    CLMSUI.go = null;

    // Now we have blosum models and sequences, we can set blosum defaults for alignment models
    CLMSUI.compositeModelInst.get("alignColl").models.forEach (function (protAlignModel) {
        protAlignModel.set("scoreMatrix", CLMSUI.blosumCollInst.get("Blosum100"));
    });

    // init annotation types
    var annotationTypes = [
        new CLMSUI.BackboneModelTypes.AnnotationType({
            category: "AA",
            type: "Digestible",
            tooltip: "Mark Digestible Residues",
            source: "Search",
            colour: "#1f78b4",
        }),
        new CLMSUI.BackboneModelTypes.AnnotationType({
            category: "AA",
            type: "Cross-linkable-1",
            tooltip: "Mark Cross-Linkable residues (first or only reactive gruop)",
            source: "Search",
            colour: "#a6cee3",
        }),
        new CLMSUI.BackboneModelTypes.AnnotationType({
            category: "AA",
            type: "Cross-linkable-2",
            tooltip: "Mark Cross-Linkable residues (second reactive group if heterobifunctional cross-linker)",
            source: "Search",
            colour: "#a6cee3",
        }),
        new CLMSUI.BackboneModelTypes.AnnotationType({
            category: "Alignment",
            type: "PDB aligned region",
            tooltip: "Show regions that align to currently loaded PDB Data",
            source: "PDB",
            colour: "#b2df8a",
        })
    ];

    //  make uniprot feature types - done here as need proteins parsed and ready from xi
    var uniprotFeatureTypes = new Map();
    var participantArray = CLMS.arrayFromMapValues(CLMSUI.compositeModelInst.get("clmsModel").get("participants"));
    participantArray.forEach (function (participant) {
        if (participant.uniprot) {
            var featureArray = Array.from(participant.uniprot.features);
            featureArray.forEach (function (feature) {
                var key = feature.category + "-" + feature.type;
                if (!uniprotFeatureTypes.has(key)) {
                    var annotationType = new CLMSUI.BackboneModelTypes.AnnotationType(feature);
                    annotationType
                        .set("source", "Uniprot")
                        .set("typeAlignmentID", "Canonical")
                    ;
                    uniprotFeatureTypes.set(key, annotationType);
                }
            });
        }
    });
    
    // add uniprot feature types
    annotationTypes = annotationTypes.concat(CLMS.arrayFromMapValues(uniprotFeatureTypes));
    var annotationTypeCollection = new CLMSUI.BackboneModelTypes.AnnotationTypeCollection(annotationTypes);
    CLMSUI.compositeModelInst.set("annotationTypes", annotationTypeCollection);

    CLMSUI.vent.trigger("buildAsyncViews");
    //CLMSUI.init.viewsThatNeedAsyncData();

    CLMSUI.compositeModelInst.applyFilter(); // do it first time so filtered sets aren't empty

    CLMSUI.vent.trigger("initialSetupDone"); //	Message that models and views are ready for action, with filter set initially
};

// This bar function calls postDataLoaded on the 4th go, ensuring all data is in place from various data loading ops
var allDataLoaded = _.after(4, CLMSUI.init.postDataLoaded);

// for qunit testing
CLMSUI.init.pretendLoad = function() {
    allDataLoaded();
    allDataLoaded();
};


CLMSUI.init.blosumLoading = function (options) {
    options = options || {};
    
    // Collection of blosum matrices that will be fetched from a json file
    CLMSUI.blosumCollInst = new CLMSUI.BackboneModelTypes.BlosumCollection (options); // options if we want to override defaults

    // when the blosum Collection is fetched (an async process), we select one of its models as being selected
    CLMSUI.blosumCollInst.listenToOnce (CLMSUI.blosumCollInst, "sync", function() {
        console.log("ASYNC. blosum models loaded");
        allDataLoaded();
    });
    
    // Start the asynchronous blosum fetching after the above events have been set up
    CLMSUI.blosumCollInst.fetch (options);
};

CLMSUI.init.models = function(options) {

    // define alignment model and listeners first, so they're ready to pick up events from other models
    var alignmentCollectionInst = new CLMSUI.BackboneModelTypes.ProtAlignCollection();
    options.alignmentCollectionInst = alignmentCollectionInst;

    alignmentCollectionInst.listenToOnce (CLMSUI.vent, "uniprotDataParsed", function(clmsModel) {
        this.addNewProteins (CLMS.arrayFromMapValues(clmsModel.get("participants")));
        console.log("ASYNC. uniprot sequences poked to collection", this);
        allDataLoaded();
    });
    
    CLMSUI.init.modelsEssential(options);

    // following listeners require compositeModelInst etc to be set up in modelsEssential() so placed afterwards

    // this listener adds new sequences obtained from pdb files to existing alignment sequence models
    alignmentCollectionInst.listenTo (CLMSUI.compositeModelInst, "3dsync", function(sequences, removeThese) {
        if (!_.isEmpty(sequences)) { // if sequences passed and it has a non-zero length...
            console.log("3dsync", arguments);
            // remove before add so if someone decides to reload the same file/code (why, but possible) we don't end up removing what we've just added
            if (removeThese && removeThese.length) {
                removeThese.forEach(function(structureName) {
                    var seqModels = this.getSequencesByPredicate(function(seq) {
                        return structureName + ":" === seq.get("id").substring(0, structureName.length + 1);
                    });
                    this.removeSequences(seqModels);
                }, this);
            }
            sequences.forEach(function(entry) {
                this.addSeq(entry.id, entry.name, entry.data, entry.otherAlignSettings);
            }, this);
            // this triggers an event to say loads has changed in the alignment collection
            // more efficient to listen to that then redraw/recalc for every seq addition

            this.bulkAlignChangeFinished();

            console.log("3D sequences poked to collection", this);
        }
    });


    // this listener makes new alignment sequence models based on the current participant set (this usually gets called after a csv file is loaded)
    // it uses the same code as that used when a xi search is the source of data, see earlier in this code (roughly line 96'ish)
    alignmentCollectionInst.listenTo (CLMSUI.compositeModelInst.get("clmsModel"), "change:matches", function() {
        this.addNewProteins(CLMS.arrayFromMapValues(CLMSUI.compositeModelInst.get("clmsModel").get("participants")));
        // this triggers an event to say loads has changed in the alignment collection
        // more efficient to listen to that then redraw/recalc for every seq addition
        this.bulkAlignChangeFinished();

        console.log("CSV sequences poked to collection", this);
    });

    // Set up colour models, some (most) of which depend on data properties
    //console.log ("clspec", d3.keys(CLMSUI.compositeModelInst.get("clmsModel").get("crosslinkerSpecificity")));
    CLMSUI.linkColour.setupColourModels ({distance: {domain: [15, 25], range: ['#5AAE61', '#FDB863', '#9970AB']}});

    // Start asynchronous GO term fetching
    //CLMSUI.modelUtils.loadGOAnnotations(); // it will call allDataLoaded when done
};


//only inits stuff required by validation page
CLMSUI.init.modelsEssential = function(options) {
    CLMSUI.oldDB = options.oldDB || false;

    var hasMissing = !_.isEmpty(options.missingSearchIDs);
    var hasIncorrect = !_.isEmpty(options.incorrectSearchIDs);
    var hasNoMatches = _.isEmpty(options.rawMatches);

    CLMSUI.utils.displayError(function() {
            return hasMissing || hasIncorrect || hasNoMatches;
        },
        (hasMissing ? "Cannot find Search ID" + (options.missingSearchIDs.length > 1 ? "s " : " ") + options.missingSearchIDs.join(", ") + ".<br>" : "") +
        (hasIncorrect ? "Wrong ID Key for Search ID" + (options.incorrectSearchIDs.length > 1 ? "s " : " ") + options.incorrectSearchIDs.join(", ") + ".<br>" : "") +
        (!hasMissing && !hasIncorrect && hasNoMatches ? "No cross-links detected for this search.<br>" : "") +
        "<p>You can either go to the search history page <br>or you can upload CSV files via the LOAD menu.</p>"
    );

    // This SearchResultsModel is what fires (sync or async) the uniprotDataParsed event we've set up a listener for above ^^^
    var clmsModelInst = new window.CLMS.model.SearchResultsModel();
    //console.log ("options", options, JSON.stringify(options));
    clmsModelInst.parseJSON(options);

    // some proteins have no size, i.e. ambiguous placeholders, and lack of size property is breaking things later on. MJG 17/05/17
    clmsModelInst.get("participants").forEach(function(prot) {
        prot.size = prot.size || 1;
    });

    var urlChunkMap = CLMSUI.modelUtils.parseURLQueryString (window.location.search.slice(1));

    // Anonymiser for screen shots / videos. MJG 17/05/17, add &anon to url for this
    if (urlChunkMap.anon) {
        clmsModelInst.get("participants").forEach(function(prot, i) {
            prot.name = "Protein " + (i + 1);
            prot.description = "Protein " + (i + 1) + " Description";
        });
    }

    // Add c- and n-term positions to searchresultsmodel on a per protein basis // MJG 29/05/17
    //~ clmsModelInst.set("terminiPositions", CLMSUI.modelUtils.getTerminiPositions (options.peptides));

    var scoreExtentInstance = CLMSUI.modelUtils.matchScoreRange(clmsModelInst.get("matches"), true);
    if (scoreExtentInstance[0]) {
        scoreExtentInstance[0] = Math.min(0, scoreExtentInstance[0]); // make scoreExtent min zero, if existing min isn't negative
    }
    var filterSettings = {
        decoys: clmsModelInst.get("decoysPresent"),
        betweenLinks: true, //clmsModelInst.targetProteinCount > 1,
        A: clmsModelInst.get("manualValidatedPresent"),
        B: clmsModelInst.get("manualValidatedPresent"),
        C: clmsModelInst.get("manualValidatedPresent"),
        Q: clmsModelInst.get("manualValidatedPresent"),
        AUTO: !clmsModelInst.get("manualValidatedPresent"),
        ambig: clmsModelInst.get("ambiguousPresent"),
        linears: clmsModelInst.get("linearsPresent"),
        //matchScoreCutoff: [undefined, undefined],
        matchScoreCutoff: scoreExtentInstance.slice(),
        //distanceCutoff: [0, 250],
        searchGroups: CLMSUI.modelUtils.getSearchGroups(clmsModelInst),
    };
    var urlFilterSettings = CLMSUI.BackboneModelTypes.FilterModel.prototype.getFilterUrlSettings(urlChunkMap);
    filterSettings = _.extend(filterSettings, urlFilterSettings); // overwrite default settings with url settings
    console.log("urlFilterSettings", urlFilterSettings, "progFilterSettings", filterSettings);
    var filterModelInst = new CLMSUI.BackboneModelTypes.FilterModel(filterSettings, {
        scoreExtent: scoreExtentInstance,
        //distanceExtent: [0, 250],
        possibleSearchGroups: CLMSUI.modelUtils.getSearchGroups(clmsModelInst),
    });

    var tooltipModelInst = new CLMSUI.BackboneModelTypes.TooltipModel();
    
    
    // Make score and distance minigram models, and add listeners to make sure they synchronise to attributes in filter model
    var minigramModels = ["matchScoreCutoff", "distanceCutoff"].map (function (filterAttrName) {
        var filterAttr = filterModelInst.get (filterAttrName);
        var miniModel = new CLMSUI.BackboneModelTypes.MinigramModel({
            domainStart: filterAttr[0],// || 0,
            domainEnd: filterAttr[1],// || 1,
        });
        miniModel
            .listenTo (filterModelInst, "change:"+filterAttrName, function(filterModel, newCutoff) {
                this.set({
                    domainStart: newCutoff[0],
                    domainEnd: newCutoff[1]
                });
            })
        ;
        
        // When the range changes on these models pass the values onto the appropriate value in the filter model
        filterModelInst.listenTo (miniModel, "change", function(model) {
            this.set (filterAttrName, [model.get("domainStart"), model.get("domainEnd")]);
        }, this);
        
        return miniModel;
    });

    // Data generation routines for minigram models
    minigramModels[0].data = function() {
        return CLMSUI.modelUtils.flattenMatches(clmsModelInst.get("matches")); // matches is now an array of arrays - [matches, []];
    };
    minigramModels[1].data = function() {
        var crossLinks = CLMSUI.compositeModelInst.getAllCrossLinks();
        var distances = crossLinks
            .map (function (clink) { return clink.getMeta("distance"); })
            .filter (function (dist) { return dist !== undefined; })
        ;
        return [distances];
    };
    
    // change in distanceObj changes the distanceExtent in filter model and should trigger a re-filter for distance minigram model as dists may have changed
    minigramModels[1]
        .listenTo (clmsModelInst, "change:distancesObj", function (clmsModel, distObj) { 
            //console.log ("minigram arguments", arguments, this);
            var max = Math.ceil(distObj.maxDistance);
            this.set ("extent", [0, max + 1]);
            //console.log ("MM", this);
            filterModelInst.distanceExtent = [0, max];
            filterModelInst
                .trigger ("change:distanceCutoff", filterModelInst, [this.get("domainStart"), this.get("domainEnd")])
                .trigger ("change", filterModelInst, {showHide: true})
            ;
        })
    ;


    // overarching model
    CLMSUI.compositeModelInst = new CLMSUI.BackboneModelTypes.CompositeModelType({
        clmsModel: clmsModelInst,
        filterModel: filterModelInst,
        tooltipModel: tooltipModelInst,
        alignColl: options.alignmentCollectionInst,
        linkColourAssignment: CLMSUI.linkColour.defaultColoursBB,
        minigramModels: {distance: minigramModels[1], score: minigramModels[0]},
    });

    //moving this to end of allDataLoaded - think validation page needs this, TODO, check
    CLMSUI.compositeModelInst.applyFilter(); // do it first time so filtered sets aren't empty

    // instead of views listening to changes in filter directly, we listen to any changes here, update filtered stuff
    // and then tell the views that filtering has occurred via a custom event ("filteringDone") in applyFilter().
    // This ordering means the views are only notified once the changed data is ready.
    CLMSUI.compositeModelInst.listenTo(filterModelInst, "change", function() {
        console.log("filterChange");
        this.applyFilter();
    });

};

CLMSUI.init.views = function() {

    var compModel = CLMSUI.compositeModelInst;
    var matchesFound = !_.isEmpty(compModel.get("clmsModel").get("matches"));
    //console.log("MODEL", compModel);

    //todo: only if there is validated {
    // compModel.get("filterModel").set("unval", false); // set to false in filter model defaults

    var windowIds = ["spectrumPanelWrapper", "spectrumSettingsWrapper", "keyPanel", "nglPanel", "distoPanel", "matrixPanel", "alignPanel", "circularPanel", "proteinInfoPanel", "pdbPanel", "csvPanel", "searchSummaryPanel", "linkMetaLoadPanel", "proteinMetaLoadPanel", "userAnnotationsMetaLoadPanel", "gafAnnotationsMetaLoadPanel", "scatterplotPanel", "urlSearchBox", "listPanel", "goTermsPanel"];
    // something funny happens if I do a data join and enter with d3 instead
    // ('distoPanel' datum trickles down into chart axes due to unintended d3 select.select inheritance)
    // http://stackoverflow.com/questions/18831949/d3js-make-new-parent-data-descend-into-child-nodes
    windowIds.forEach(function(winid) {
        d3.select("body").append("div")
            .attr("id", winid)
            .attr("class", "dynDiv dynDiv_bodyLimit");
    });

    CLMSUI.init.viewsEssential({
        "specWrapperDiv": "#spectrumPanelWrapper"
    });

    // Generate checkboxes for view dropdown
    var checkBoxData = [{
            id: "circularChkBxPlaceholder",
            label: "Circular",
            eventName: "circularShow",
            tooltip: "Proteins are arranged circumferentially, with Cross-Links drawn in-between",
        },
        {
            id: "nglChkBxPlaceholder",
            label: "3D (NGL)",
            eventName: "nglShow",
            tooltip: "Spatial view of protein complexes and Cross-Links. Requires a relevant PDB File to be loaded [Load > PDB Data]"
        },
        {
            id: "matrixChkBxPlaceholder",
            label: "Matrix",
            eventName: "matrixShow",
            tooltip: "AKA Contact Map. Relevant PDB File required for distance background"
        },
        {
            id: "proteinInfoChkBxPlaceholder",
            label: "Protein Info",
            eventName: "proteinInfoShow",
            tooltip: "Shows metadata and Cross-Link annotated sequences for currently selected proteins"
        },
        {
            id: "spectrumChkBxPlaceholder",
            label: "Spectrum",
            eventName: "spectrumShow",
            tooltip: "View the spectrum for a selected match (selection made through Selected Match Table after selecting Cross-Links)",
            sectionEnd: true
        },
        {
            id: "distoChkBxPlaceholder",
            label: "Histogram",
            eventName: "distoShow",
            tooltip: "Configurable view for showing distribution of one Cross-Link/Match property"
        },
        {
            id: "scatterplotChkBxPlaceholder",
            label: "Scatterplot",
            eventName: "scatterplotShow",
            tooltip: "Configurable view for comparing two Cross-Link/Match properties",
        },
        {
            id: "listChkBxPlaceholder",
            label: "List",
            eventName: "listShow",
            tooltip: "Sortable list of cross-links, can convert to heatmap",
            sectionEnd: true
        },
        {
            id: "alignChkBxPlaceholder",
            label: "Alignment",
            eventName: "alignShow",
            tooltip: "Shows alignments between Search/PDB/Uniprot sequences per protein"
        },
        {
            id: "searchSummaryChkBxPlaceholder",
            label: "Search Summaries",
            eventName: "searchesShow",
            tooltip: "Shows metadata for current searches",
            sectionEnd: true
        },
        {
            id: "keyChkBxPlaceholder",
            label: "Legend & Colours",
            eventName: "keyShow",
            tooltip: "Explains and allows changing of current colour scheme",
            sectionEnd: false
        },
        {
            id: "goTermsChkBxPlaceholder",
            label: "GO Terms",
            eventName: "goTermsShow",
            tooltip: "Browse Gene Ontology terms"
        },
    ];
    checkBoxData.forEach(function(cbdata) {
        var options = $.extend({
            labelFirst: false
        }, cbdata);
        var cbView = new CLMSUI.utils.checkBoxView({
            myOptions: options
        });
        $("#viewDropdownPlaceholder").append(cbView.$el);
    }, this);

    // Add them to a drop-down menu (this rips them away from where they currently are - document)
    var maybeViews = ["#nglChkBxPlaceholder" /*, "#distoChkBxPlaceholder"*/ ];
    var mostViews = checkBoxData.map(function(d) {
        return "#" + d.id;
    }).filter(function(id) {
        return id !== "#keyChkBxPlaceholder" && id !== "#nglChkBxPlaceholder";
    });
    new CLMSUI.DropDownMenuViewBB({
            el: "#viewDropdownPlaceholder",
            model: compModel.get("clmsModel"),
            myOptions: {
                title: "Views",
                menu: checkBoxData,
                tooltipModel: compModel.get("tooltipModel")
            }
        })
        // hide/disable view choices that depend on certain data being present until that data arrives
        .enableItemsByID(maybeViews, false)
        .enableItemsByID(mostViews, matchesFound)
        .listenTo(compModel.get("clmsModel"), "change:distancesObj", function(model, newDistancesObj) {
            this.enableItemsByID(maybeViews, !!newDistancesObj);
        })
        .listenTo(compModel.get("clmsModel"), "change:matches", function() {
            this.enableItemsByID(mostViews, true);
        });


    // Generate protein selection drop down
    d3.select("body").append("input")
        .attr("type", "text")
        .attr("id", "proteinSelectionFilter");
    new CLMSUI.DropDownMenuViewBB({
            el: "#proteinSelectionDropdownPlaceholder",
            model: compModel.get("clmsModel"),
            myOptions: {
                title: "Protein-Selection",
                menu: [{
                        name: "Hide Selected",
                        func: compModel.hideSelectedProteins,
                        context: compModel,
                        tooltip: "Hide selected proteins"
                    },
                    {
                            name: "Hide Unselected",
                            func: compModel.hideUnselectedProteins,
                            context: compModel,
                            tooltip: "Hide unselected proteins"
                    },
                    {
                        name: "+Neighbours",
                        func: compModel.stepOutSelectedProteins,
                        context: compModel,
                        tooltip: "Select proteins which are cross-linked to already selected proteins"
                    },
                    {
                        id: "proteinSelectionFilter",
                        func: compModel.proteinSelectionTextFilter,
                        closeOnClick: false,
                        context: compModel,
                        label: "Protein Selection by Description",
                        tooltip: "Select proteins whose descriptions include input text"
                    },
                    // {
                    //     name: "Group",
                    //     func: compModel.groupSelectedProteins,
                    //     context: compModel,
                    //     tooltip: "Put selected proteins in a group"
                    // }
                ],
                tooltipModel: compModel.get("tooltipModel")
            }
        })
        .wholeMenuEnabled(matchesFound)
        .listenTo(compModel.get("clmsModel"), "change:matches", function() {
            this.wholeMenuEnabled(true);
        });

    // Generate buttons for load dropdown
    var loadButtonData = [{
            name: "PDB Data",
            eventName: "pdbShow",
            tooltip: "Load a PDB File from local disk or by PDB ID code from RCSB.org. Allows viewing of 3D Structure and of distance background in Matrix View"
        },
        {
            name: "Cross-Links (CSV)",
            eventName: "csvShow",
            tooltip: "Load Cross-Links from a local CSV File"
        },
        {
            name: "Cross-Link Metadata",
            eventName: "linkMetaShow",
            tooltip: "Load Cross-Link Meta-Data from a local CSV file. See 'Expected CSV Format' within for syntax"
        },
        {
            name: "Protein Metadata",
            eventName: "proteinMetaShow",
            tooltip: "Load Protein Meta-Data from a local CSV file. See 'Expected CSV Format' within for syntax"
        },
        {
            name: "User Annotations",
            eventName: "userAnnotationsMetaShow",
            tooltip: "Load User Annotations from a local CSV file. See 'Expected CSV Format' within for syntax"
        },
    ];
    loadButtonData.forEach(function(bdata) {
        bdata.func = function() {
            CLMSUI.vent.trigger(bdata.eventName, true);
        };
    });
    new CLMSUI.DropDownMenuViewBB({
            el: "#loadDropdownPlaceholder",
            model: compModel.get("clmsModel"),
            myOptions: {
                title: "Load",
                menu: loadButtonData,
                tooltipModel: compModel.get("tooltipModel"),
            }
        }) // hide/disable view choices that depend on certain data being present until that data arrives
        .enableItemsByIndex([0, 2, 3], matchesFound)
        .listenTo(compModel.get("clmsModel"), "change:matches", function() {
            this.enableItemsByIndex([0, 2, 3], true);
        })
        .setVis(!matchesFound) // open as default if empty search
    ;

    new CLMSUI.URLSearchBoxViewBB({
        el: "#urlSearchBox",
        model: compModel,
        displayEventName: "shareURL",
        myOptions: {}
    });

    new CLMSUI.xiNetControlsViewBB({
        el: "#xiNetButtonBar",
        model: compModel
    });

    // Set up a one-time event listener that is then called from allDataLoaded
    // Once this is done, the views depending on async loading data (blosum, uniprot) can be set up
    // Doing it here also means that we don't have to set up these views at all if these views aren't needed (e.g. for some testing or validation pages)
    compModel.listenToOnce(CLMSUI.vent, "buildAsyncViews", function() {
        CLMSUI.init.viewsThatNeedAsyncData();
    });
};


CLMSUI.init.viewsEssential = function(options) {

    var compModel = CLMSUI.compositeModelInst;
    var filterModel = compModel.get("filterModel");

    var singleTargetProtein = compModel.get("clmsModel").targetProteinCount < 2;
    new CLMSUI.FilterViewBB({
        el: "#filterPlaceholder",
        model: filterModel,
        myOptions: {
            hide: {
                //todo: reinstate sensible hiding of controls, need listeners on these attributes
                //temp hack - dont hide anything, data may change when csv uploaded
                /*
                "selfLinks": singleTargetProtein,
                "betweenLinks": singleTargetProtein,
                "AUTO": !compModel.get("clmsModel").get("autoValidatedPresent"),
                "ambig": !compModel.get("clmsModel").get("ambiguousPresent"),
                "unval": !compModel.get("clmsModel").get("unvalidatedPresent"),
                "linear": !compModel.get("clmsModel").get("linearsPresent"),
                "protNames": singleTargetProtein,
                */
            }
        }
    });

    new CLMSUI.FilterSummaryViewBB({
        el: "#filterReportPlaceholder",
        model: compModel,
    });

    if (compModel.get("clmsModel").get("unvalidatedPresent") !== true) {
        d3.select("#filterModeDiv").style("display", "none");
    }

    
    // Generate minigram views
    var minigramViewConfig = [
        {id: "score", el: "#filterPlaceholdermatchScoreSliderHolder", seriesNames: ["Targets", "Decoys"], colours: ["blue", "red"], label: "Score"},
        {id: "distance", el: "#filterPlaceholderdistanceFilterSliderHolder", seriesNames: ["Distances"], colours: ["blue"], label: "Distance"},
    ];
    var minigramViews = minigramViewConfig.map (function (config) {
        return new CLMSUI.MinigramViewBB({
            el: config.el,
            model: compModel.get("minigramModels")[config.id],
            myOptions: {
                maxX: 0, // let data decide
                seriesNames: config.seriesNames,
                //scaleOthersTo: "Matches",
                xlabel: config.label,
                ylabel: "Count",
                height: 65,
                colours: _.object (_.zip (config.seriesNames, config.colours)), // [a,b],[c,d] -> [a,c],[b,d] -> {a:c, b:d}
            }
        })
        // If the clmsModel matches attribute changes then tell the mini histogram view
        .listenTo(compModel.get("clmsModel"), "change:matches", function() { this.render().redrawBrush(); }) // if the matches change (likely?) need to re-render the view too
    ;
    });
    
    // redraw brush when distancesObj is changed, extent is likely to be different
    minigramViews[1]
        .listenTo(compModel.get("clmsModel"), "change:distancesObj", function (clmsModel, distObj) { 
            this.render().redrawBrush();
        }) // if the distances change (likely?) need to re-render the view too
    ;


    // World of code smells vol.1
    // selectionViewer declared before spectrumWrapper because...
    // 1. Both listen to event A, selectionViewer to build table, spectrumWrapper to do other stuff
    // 2. Event A in spectrumWrapper fires event B
    // 3. selectionViewer listens for event B to highlight row in table - which means it must have built the table
    // 4. Thus selectionViewer must do its routine for event A before spectrumWrapper, so we initialise it first
    var selectionViewer = new CLMSUI.SelectionTableViewBB({
        el: "#bottomDiv",
        model: compModel,
    });

    selectionViewer.lastCount = 1;
    selectionViewer.render();

    new SpectrumViewWrapper({
            el: options.specWrapperDiv,
            model: compModel,
            displayEventName: "spectrumShow",
            myOptions: {
                wrapperID: "spectrumPanel",
                canBringToTop: options.spectrumToTop
            }
        })
        .listenTo(CLMSUI.vent, "individualMatchSelected", function(match) {
            if (match) {
                this.lastRequestedID = match.id; // async catch
                //console.log ("MATCH ID", this, match.id);
                this.primaryMatch = match; // the 'dynamic_rank = true' match
                var url = "../CLMS-model/php/spectrumMatches.php?sid=" +
                    this.model.get("clmsModel").get("sid") +
                    "&unval=1&linears=1&spectrum=" + match.spectrumId + "&matchid=" + match.id;
                var self = this;
                d3.json(url, function(error, json) {
                    if (error) {
                        console.log("error", error, "for", url, arguments);
                    } else {
                        // this works if first item in array has the same id, might in future send matchid to php to return for reliability
                        //var thisMatchID = json.rawMatches && json.rawMatches[0] ? json.rawMatches[0].id : -1;
                        var returnedMatchID = json.matchid;

                        //console.log ("json", json, self.lastRequestedID, thisMatchID, returnedMatchID);
                        if (returnedMatchID == self.lastRequestedID) { // == not === 'cos returnedMatchID is a atring and self.lastRequestedID is a number
                            //console.log (":-)", json, self.lastRequestedID, thisSpecID);
                            var altModel = new window.CLMS.model.SearchResultsModel();
                            altModel.parseJSON(json);
                            var allCrossLinks = CLMS.arrayFromMapValues(altModel.get("crossLinks"));
                            // empty selection first
                            // (important or it will crash coz selection contains links to proteins not in clms model)
                            self.alternativesModel
                                .set("selection", [])
                                .set("clmsModel", altModel)
                                .applyFilter()
                                .set("lastSelectedMatch", {
                                    match: match,
                                    directSelection: true
                                });
                            d3.select("#alternatives").style("display", altModel.get("matches").length === 1 ? "none" : "block");
                            //self.alternativesModel.set("selection", allCrossLinks);
                            self.alternativesModel.setMarkedCrossLinks("selection", allCrossLinks, false, false);
                            CLMSUI.vent.trigger("resizeSpectrumSubViews", true);
                        }
                    }
                });
            } else {
                //~ //this.model.clear();
            }
        });

    // xiSPEC.init(options.specWrapperDiv, {baseDir: CLMSUI.xiSpecBaseDir, xiAnnotatorBaseURL: CLMSUI.xiAnnotRoot});

    var xiSPEC_options = {
        targetDiv: 'modular_xispec',
        baseDir: CLMSUI.xiSpecBaseDir,
        xiAnnotatorBaseURL: CLMSUI.xiAnnotRoot,
        knownModificationsURL: CLMSUI.xiAnnotRoot + "annotate/knownModifications",
        showCustomConfig: true,
        showQualityControl: "min",
    }

    xiSPEC.init(xiSPEC_options);

    // Update spectrum view when external resize event called
    xiSPEC.Spectrum.listenTo(CLMSUI.vent, "resizeSpectrumSubViews", function() {
        xiSPEC.vent.trigger('resize:spectrum');
    });

    // xiSPEC.Spectrum.listenTo(CLMSUI.vent, "resizeSpectrumSubViews", function() {
    //     this.resize();
    // });
    // xiSPEC.Spectrum.listenTo(CLMSUI.vent, "resizeSpectrumSubViews", function() {
    //     this.resize();
    // });
    // xiSPEC.FragmentationKey.listenTo(CLMSUI.vent, "resizeSpectrumSubViews", function() {
    //     this.resize();
    // });
    // xiSPEC.ErrorIntensityPlot.listenTo(CLMSUI.vent, "resizeSpectrumSubViews", function() {
    //     this.render();
    // });
    // xiSPEC.ErrorMzPlot.listenTo(CLMSUI.vent, "resizeSpectrumSubViews", function() {
    //     this.render();
    // });

    // "individualMatchSelected" in CLMSUI.vent is link event between selection table view and spectrum view
    // used to transport one Match between views
    xiSPEC.Spectrum.listenTo(CLMSUI.vent, "individualMatchSelected", function(match) {
        if (match) {
            var randId = CLMSUI.compositeModelInst.get("clmsModel").getSearchRandomId(match);
            CLMSUI.loadSpectrum(match, randId, this.model);
        } else {
            xiSPEC.clear();
        }
    });

    // Generate data export drop down
    new CLMSUI.DropDownMenuViewBB({
            el: "#expDropdownPlaceholder",
            model: compModel.get("clmsModel"),
            myOptions: {
                title: "Export",
                menu: [{
                        name: "Filtered Matches",
                        func: downloadMatches,
                        tooltip: "Produces a CSV File of Filtered Matches data",
                        categoryTitle: "As a CSV File",
                        sectionBegin: true
                    },
                    {
                        name: "Filtered Cross-Links",
                        func: downloadLinks,
                        tooltip: "Produces a CSV File of Filtered Cross-Link data"
                    },
                    {
                        name: "Filtered PPI",
                        func: downloadPPIs,
                        tooltip: "Produces a CSV File of Filtered Protein-Protein Interaction data"
                    },
                    {
                        name: "Filtered Residues",
                        func: downloadResidueCount,
                        tooltip: "Produces a CSV File of Count of Filtered Residues ",
                    },
                    {
                        name: "Protein Accession list",
                        func: downloadProteinAccessions,
                        tooltip: "Produces a single row CSV File of visible Proteins' Accession numbers",
                        sectionEnd: true
                    },
                    {
                        name: "Filtered Matches ",
                        func: downloadSSL,
                        tooltip: "Produces an SSL file for quantitation in SkyLine",
                        categoryTitle: "As an SSL File",
                        sectionBegin: true,
                        sectionEnd: true
                    },
                    {
                        name: "Make Filtered XI URL",
                        func: function() {
                            CLMSUI.vent.trigger("shareURL", true);
                        },
                        tooltip: "Produces a URL that embeds the current filter state within it for later reproducibility",
                        categoryTitle: "As a URL",
                        sectionBegin: true,
                    },
                ],
                tooltipModel: compModel.get("tooltipModel"),
                sectionHeader: function(d) {
                    return (d.categoryTitle ? d.categoryTitle.replace(/_/g, " ") : "");
                },
            }
        })
        .wholeMenuEnabled(!_.isEmpty(compModel.get("clmsModel").get("matches")))
        .listenTo(compModel.get("clmsModel"), "change:matches", function() {
            this.wholeMenuEnabled(true);
        });

    // Generate help drop down
    new CLMSUI.DropDownMenuViewBB({
        el: "#helpDropdownPlaceholder",
        model: compModel.get("clmsModel"),
        myOptions: {
            title: "Help",
            menu: [{
                name: "Xi Docs",
                func: function() {
                    window.open("../xidocs/html/xiview.html", "_blank");
                },
                tooltip: "Documentation for Xi View"
            }, {
                name: "Online Videos",
                func: function() {
                    window.open("https://vimeo.com/user64900020", "_blank");
                },
                tooltip: "A number of how-to videos are available on Vimeo, accessible via this link to the lab homepage"
            }, {
                name: "Report Issue on Github",
                func: function() {
                    window.open("https://github.com/Rappsilber-Laboratory/xi3-issue-tracker/issues", "_blank");
                },
                tooltip: "Opens a new browser tab for the GitHub issue tracker (You must be logged in to GitHub to view and add issues.)"
            }, {
                name: "About Xi View",
                func: function() {
                    window.open("https://rappsilberlab.org/software/xiview/", "_blank");
                },
                tooltip: "About Xi View (opens external web page)"
            }, ],
            tooltipModel: compModel.get("tooltipModel"),
        }
    });
    d3.select("#helpDropdownPlaceholder > div").append("img")
        .attr("class", "rappsilberImage")
        .attr("src", "./images/logos/rappsilber-lab-small.png")
        .on("click", function() {
            window.open("http://rappsilberlab.org", "_blank");
        });


    d3.select("body").append("div").attr({
        id: "tooltip2",
        class: "CLMStooltip"
    });
    new CLMSUI.TooltipViewBB({
        el: "#tooltip2",
        model: compModel.get("tooltipModel")
    });
};

CLMSUI.init.viewsThatNeedAsyncData = function() {

    var compModel = CLMSUI.compositeModelInst;

    // This generates the legend div, we don't keep a handle to it - the event object has one
    new CLMSUI.KeyViewBB({
        el: "#keyPanel",
        displayEventName: "keyShow",
        model: compModel,
    });

    new CLMSUI.SearchSummaryViewBB({
        el: "#searchSummaryPanel",
        displayEventName: "searchesShow",
        model: compModel.get("clmsModel"),
    });

    /* 'cos circle listens to annotation model which is formed from uniprot async data */
    new CLMSUI.CircularViewBB({
        el: "#circularPanel",
        displayEventName: "circularShow",
        model: compModel,
    });


    // Make a drop down menu constructed from the annotations collection
    new CLMSUI.AnnotationDropDownMenuViewBB({
            el: "#annotationsDropdownPlaceholder",
            collection: compModel.get("annotationTypes"),
            myOptions: {
                title: "Annotations",
                closeOnClick: false,
                groupByAttribute: "category",
                labelByAttribute: "type",
                toggleAttribute: "shown",
                tooltipModel: compModel.get("tooltipModel"),
                sectionHeader: function(d) {
                    return (d.category ? d.category.replace(/_/g, " ") : "Uncategorised") +
                        (d.source ? " (" + d.source + ")" : "");
                },
            }
        })
        .wholeMenuEnabled(!_.isEmpty(compModel.get("clmsModel").get("matches")))
        .listenTo(compModel.get("clmsModel"), "change:matches", function() {
            this.wholeMenuEnabled(true);
        });


    new CLMSUI.utils.ColourCollectionOptionViewBB({
        el: "#linkColourDropdownPlaceholder",
        model: CLMSUI.linkColour.Collection,
        storeSelectedAt: {
            model: compModel,
            attr: "linkColourAssignment"
        },
    });

    compModel.listenTo(CLMSUI.linkColour.Collection, "aColourModelChanged", function(colourModel, newDomain) {
        console.log("col change args", arguments, this);
        if (this.get("linkColourAssignment") === colourModel) {
            this.trigger("currentColourModelChanged", colourModel, newDomain);
        }
    });

    // If more than one search, set group colour scheme to be default. https://github.com/Rappsilber-Laboratory/xi3-issue-tracker/issues/72
    compModel.set("linkColourAssignment",
        compModel.get("clmsModel").get("searches").size > 1 ? CLMSUI.linkColour.groupColoursBB : CLMSUI.linkColour.defaultColoursBB
    );

    new CLMS.xiNET.CrosslinkViewer({
        el: "#networkDiv",
        model: compModel,
        //     myOptions: {layout: storedLayout}
    });


    // Alignment View
    new CLMSUI.AlignCollectionViewBB({
        el: "#alignPanel",
        collection: compModel.get("alignColl"),
        displayEventName: "alignShow",
        tooltipModel: compModel.get("tooltipModel")
    });


    new CLMSUI.DistogramBB({
        el: "#distoPanel",
        model: compModel,
        //colourScaleModel: CLMSUI.linkColour.distanceColoursBB,
        //colourScaleModel: CLMSUI.linkColour.defaultColoursBB,
        colourScaleModel: CLMSUI.linkColour.groupColoursBB,
        displayEventName: "distoShow",
        myOptions: {
            chartTitle: "Histogram",
            seriesName: "Actual"
        }
    });

    // This makes a matrix viewer
    new CLMSUI.DistanceMatrixViewBB({
        el: "#matrixPanel",
        model: compModel,
        colourScaleModel: CLMSUI.linkColour.distanceColoursBB,
        displayEventName: "matrixShow",
    });

    // This makes a list viewer
    new CLMSUI.ListViewBB({
        el: "#listPanel",
        model: compModel,
        colourScaleModel: CLMSUI.linkColour.distanceColoursBB,
        displayEventName: "listShow",
    });

    // Make new ngl view with pdb dataset
    // In a horrific misuse of the MVC pattern, this view actually generates the 3dsync
    // event that other views are waiting for.
    new CLMSUI.NGLViewBB({
        el: "#nglPanel",
        model: compModel,
        displayEventName: "nglShow",
    });

    var urlChunkMap = CLMSUI.modelUtils.parseURLQueryString(window.location.search.slice(1));
    new CLMSUI.PDBFileChooserBB({
        el: "#pdbPanel",
        model: compModel,
        displayEventName: "pdbShow",
        initPDBs: urlChunkMap.pdb,
    });

    new CLMSUI.ScatterplotViewBB({
        el: "#scatterplotPanel",
        model: compModel,
        displayEventName: "scatterplotShow",
    });

    new CLMSUI.CSVFileChooserBB({
        el: "#csvPanel",
        model: compModel,
        displayEventName: "csvShow",
    });

    new CLMSUI.LinkMetaDataFileChooserBB({
        el: "#linkMetaLoadPanel",
        model: compModel,
        displayEventName: "linkMetaShow",
    });

    new CLMSUI.ProteinMetaDataFileChooserBB({
        el: "#proteinMetaLoadPanel",
        model: compModel,
        displayEventName: "proteinMetaShow",
    });

    new CLMSUI.UserAnnotationsMetaDataFileChooserBB({
        el: "#userAnnotationsMetaLoadPanel",
        model: compModel,
        displayEventName: "userAnnotationsMetaShow",
    });

    new CLMSUI.GoTermsViewBB({
        el: "#goTermsPanel",
        model: compModel,
        displayEventName: "goTermsShow",
    });

    new CLMSUI.ProteinInfoViewBB({
        el: "#proteinInfoPanel",
        displayEventName: "proteinInfoShow",
        model: compModel,
    });

    new CLMSUI.FDRViewBB({
        el: "#fdrPanel",
        //displayEventName: "fdrShow",
        model: compModel.get("filterModel"),
    });

    new CLMSUI.FDRSummaryViewBB({
        el: "#fdrSummaryPlaceholder",
        //displayEventName: "fdrShow",
        model: compModel,
    });

    //make sure things that should be hidden are hidden
    compModel.trigger("hiddenChanged");

    // ByRei_dynDiv by default fires this on window.load (like this whole block), but that means the KeyView is too late to be picked up
    // so we run it again here, doesn't do any harm
    ByRei_dynDiv.init.main();
    //ByRei_dynDiv.db (1, d3.select("#subPanelLimiter").node());
};
