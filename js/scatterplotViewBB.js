/*jslint white: true, sloppy: true, vars: true*/
//		a matrix viewer
//
//		Colin Combe, Martin Graham
//		Rappsilber Laboratory, 2015
    
    var CLMSUI = CLMSUI || {};

    CLMSUI.ScatterplotViewBB = CLMSUI.utils.BaseFrameView.extend ({   
        
    events: function() {
      var parentEvents = CLMSUI.utils.BaseFrameView.prototype.events;
      if(_.isFunction(parentEvents)){
          parentEvents = parentEvents();
      }
      return _.extend({},parentEvents,{
        "mousemove .scatterplotBackground": "doTooltip",
        "mousemove .background": "doHighlightAndTooltip",
        "mousemove .extent": "doHighlightAndTooltip",
        "mouseleave .background": "clearHighlightAndTooltip",
        "click .jitter": "toggleJitter",
      });
    },

    initialize: function (viewOptions) {
        CLMSUI.ScatterplotViewBB.__super__.initialize.apply (this, arguments);
        
        var self = this;

        var defaultOptions = {
            xlabel: "Axis 1",
            ylabel: "Axis 2",
            chartTitle: "Scatterplot",
            selectedColour: "#ff0",
            highlightedColour: "#f80",
            background: "#eee",
            jitter: true,
            chartMargin: 10,
            pointSize: 4,
            attributeOptions: CLMSUI.modelUtils.attributeOptions,
        };
        
        this.options = _.extend(defaultOptions, viewOptions.myOptions);
        
        this.margin = {
            top:    this.options.chartTitle  ? 30 : 0,
            right:  20,
            bottom: this.options.xlabel ? 40 : 25,
            left:   this.options.ylabel ? 70 : 50
        };
        
        this.displayEventName = viewOptions.displayEventName;
        
        // targetDiv could be div itself or id of div - lets deal with that
        // Backbone handles the above problem now - element is now found in this.el
        //avoids prob with 'save - web page complete'
        var mainDivSel = d3.select(this.el).classed("scatterplotView", true); 
        
        var flexWrapperPanel = mainDivSel.append("div")
            .attr ("class", "verticalFlexContainer")
        ;
        
        this.controlDiv = flexWrapperPanel.append("div").attr("class", "toolbar");
        
        // Add download button
        var buttonData = [
            {class: "downloadButton2", label: CLMSUI.utils.commonLabels.downloadImg+"SVG", type: "button", id: "download"},
        ];
        CLMSUI.utils.makeBackboneButtons (this.controlDiv, self.el.id, buttonData);
        
        // Add two select widgets for picking axes data types
        CLMSUI.utils.addMultipleSelectControls ({
            addToElem: this.controlDiv, 
            selectList: ["X", "Y"], 
            optionList: this.options.attributeOptions, 
            selectLabelFunc: function (d) { return d+" Axis Attribute"; }, 
            optionLabelFunc: function (d) { return d.label; }, 
            changeFunc: function () { self.axisChosen().render(); },
        });
        
        // Add jitter toggle checkbox
        var toggleButtonData = [
            {class: "jitter", label: "Jitter", id: "jitter", type: "checkbox", inputFirst: true, initialState: this.options.jitter}
        ];
        CLMSUI.utils.makeBackboneButtons (this.controlDiv, self.el.id, toggleButtonData);
        
        
        // Add the scatterplot and axes
        var chartDiv = flexWrapperPanel.append("div")
            .attr("class", "panelInner")
            .attr("flex-grow", 1)
            .style("position", "relative")
        ;      
        
        var viewDiv = chartDiv.append("div")
            .attr("class", "viewDiv")
        ;
        
                
        // Canvas
        this.canvas = viewDiv.append("div")
            .style("position", "absolute")
            .style("transform", "translate(" + this.margin.left + "px," + this.margin.top + "px)")
            .append ("canvas")  
            .style("transform", "translate(0px,0px)")
        ;
       
        // Scales
        this.x = d3.scale.linear();
        this.y = d3.scale.linear();
 
        // SVG element
        this.svg = viewDiv.append("svg");

        this.vis = this.svg.append("g")
            .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")")
        ;

        this.scatg = this.vis.append("g");
        //this.scatg.append("rect")
        //    .attr ("class", "scatterplotBackground")
        //;
        
        // Axes setup
        this.xAxis = d3.svg.axis().scale(this.x).orient("bottom").tickFormat(d3.format(",d"));
        this.yAxis = d3.svg.axis().scale(this.y).orient("left").tickFormat(d3.format(",d"));
        
        this.vis.append("g")
            .attr("class", "y axis")
        ;
        
        this.vis.append("g")
            .attr("class", "x axis")
        ;
        
        
        // Add labels
        var labelInfo = [
            {class: "axis", text: this.options.xlabel, dy: "0em"},
            {class: "axis", text: this.options.ylabel, dy: "1em"},
            {class: "chartHeader", text: this.options.chartTitle, dy: "-0.5em"},
        ];

        this.vis.selectAll("g.label")
            .data(labelInfo)
            .enter()
            .append ("g")
            .attr("class", "label")
            .append("text")
                .attr("class", function(d) { return d.class; })
                .text(function(d) { return d.text; })
                .attr("dy", function(d) { return d.dy; })
        ;
        
        // Brush
        var brushEnded = function (options) {
            options = options || {};
            options.extent = self.brush.extent();
            options.add = d3.event.ctrlKey || d3.event.shiftKey || (d3.event.sourceEvent ? d3.event.sourceEvent.ctrlKey || d3.event.sourceEvent.shiftKey : false);
            self.selectPoints (options);
        };
        
        var brushSnap = function () {
            if (d3.event.sourceEvent.type === "brush") { return; }
            var meta = self.getBothAxesMetaData();
            var selection = self.brush.extent();
            
            var adjs = meta.map (function (m) {
                return Math.pow (10, -m.decimalPlaces) / 2;
            });
            
            var expandOrShrink = function (selection, shrink) {
                var sign = shrink ? 1 : -1;
                return selection.map (function (corner, i) {
                    var gCorner = corner.slice();
                    gCorner[0] -= (adjs[0] * sign * (i === 0 ? -1 : 1));
                    gCorner[1] -= (adjs[1] * sign * (i === 0 ? -1 : 1));
                    return gCorner;
                });
            };
            
            var shrunkSelection = expandOrShrink (selection, true);

            var newSelection = shrunkSelection.map (function (corner) {
                return corner.map (function (v, axisIndex) { return d3.round (d3.round (v, 10), meta[axisIndex].decimalPlaces); }); 
                // sometimes numbers like 3.5 get rounded to 3.499999999999996 in javascript
                // then d3.round (3.49999999996, 0) returns 3, not what we want
                // so doing d3.round (3.49999999996, 10) return 3.5, then d3.round (3.5, 0) returns 4 which is what we want
            });

            var generousSelection = expandOrShrink (newSelection, false);
            
            //console.log ("d1", selection[0][0], selection[1][0], "old", shrunkSelection[0][0], shrunkSelection[1][0], "new", newSelection[0][0], newSelection[1][0], "generous", generousSelection[0][0], generousSelection[1][0], self.brush.extent(), d3.event);
            
            if (!_.isEqual (selection, generousSelection)) {
                self.brush.extent (generousSelection); 
                self.scatg.select(".brush").call(self.brush);   // recall brush binding so background rect is resized and brush redrawn
                ["n", "e"].forEach (function (orient, i) {
                    self.scatg.select(".resize."+orient+" text").text("["+newSelection[0][i]+" to "+newSelection[1][i]+"]");   // for brush extent labelling  
                });
            }
        };
        this.brush = d3.svg.brush()
            .x(self.x)
            .y(self.y)
            //.clamp ([false, false])
            .on("brush", brushSnap)
            .on("brushend", function() { brushEnded ({select: true}); })
        ;
        
        // Restore when match selection is sorted out
        this.scatg.append("g")
            .attr("class", "brush")
            .call(self.brush)
        ;
        
        
        this.scatg.select(".resize.n").append("text");
        this.scatg.select(".resize.e").append("text");
        
        this.scatg.select(".brush")
            .on ("mouseover", function () {
                self.scatg.select(".brush").selectAll("text").transition().duration(500).style("opacity", 1);
            })
            .on ("mouseout", function () {
                self.scatg.select(".brush").selectAll("text").transition().duration(500).style("opacity", 0);
            })
        ;
        
        // Listen to these events (and generally re-render in some fashion)
        this.listenTo (this.model, "selectionMatchesLinksChanged", this.recolourCrossLinks);
        this.listenTo (this.model, "highlightsMatchesLinksChanged", this.recolourCrossLinks);
        this.listenTo (this.model, "filteringDone", this.renderCrossLinks);
        this.listenTo (this.model, "change:linkColourAssignment", this.recolourCrossLinks);
        this.listenTo (this.model, "currentColourModelChanged", this.recolourCrossLinks);
        this.listenTo (this.model.get("clmsModel"), "change:distancesObj", function() { this.axisChosen().render(); });
        this.listenTo (CLMSUI.vent, "linkMetadataUpdated", function (columns) {
            //console.log ("HELLO", arguments);
            var newOptions = columns.map (function (column) {
                return {id: column, label: column, decimalPlaces: 2, matchLevel: false, linkFunc: function (c) {
                    return c.meta ? [c.meta[column]] : [];
                }};
            });
            //console.log ("NEW OPTIONS", newOptions);

            var toolbar = mainDivSel.select("div.toolbar");
            CLMSUI.utils.addMultipleSelectControls ({
                addToElem: toolbar, 
                selectList: ["X", "Y"], 
                optionList: newOptions, 
                keepOldOptions: true,
                selectLabelFunc: function (d) { return d+" Axis Attribute"; }, 
                optionLabelFunc: function (d) { return d.label; }, 
                changeFunc: function () { self.axisChosen().render(); },
            });
        });
        
        this.axisChosen().render();     // initial render with defaults
    },
        
    // options.extent = area of selection in data coordinates if we're not picking it up from the brush
    // options.add = add to existing selections
    // options.select = true for selections, false for highlight
    selectPoints: function (options) {
        options = options || {};
        var xAxisData = this.getAxisData ("X", true);
        var yAxisData = this.getAxisData ("Y", true);
        var xData = xAxisData.data;
        var yData = yAxisData.data;
        var filteredCrossLinks = this.getFilteredCrossLinks ();
        var extent = options.extent || this.brush.extent();
        var matchLevel = xAxisData.matchLevel || yAxisData.matchLevel;
        var exmin = extent[0][0], exmax = extent[1][0], eymin = extent[0][1], eymax = extent[1][1];

        var add = options.add || false;
        var type = options.select ? "selection" : "highlights";
        //console.log ("type", options, type, matchLevel, xAxisData);

        if (matchLevel) {
            var matchingMatches = filteredCrossLinks.map (function (link, i) {
                var xDatum = xData[i];
                var yDatum = yData[i];

                var passMatches = (xDatum && yDatum) ? link.filteredMatches_pp.filter (function (match, ii) {
                    var xd = xDatum.length === 1 ? xDatum[0] : xDatum[ii];
                    var yd = yDatum.length === 1 ? yDatum[0] : yDatum[ii];
                    return (xd >= exmin && xd <= exmax && yd >= eymin && yd <= eymax);
                }) : [];
                return passMatches;
            });
            var allMatchingMatches = d3.merge (matchingMatches);
            this.selectSize = allMatchingMatches.length;
            this.model.setMarkedMatches (type, allMatchingMatches, true, add);
        } else {
            var matchingLinks = filteredCrossLinks.filter (function (link, i) {
                var xDatum = xData[i];
                var yDatum = yData[i];
                var bool = xDatum && xDatum.some (function (xd) {
                    return xd >= exmin && xd <= exmax;
                });
                bool = bool && yDatum && yDatum.some (function (yd) {
                    return yd >= eymin && yd <= eymax;
                });
                return bool;
            });
            this.selectSize = matchingLinks.length;
            this.model.setMarkedCrossLinks (type, matchingLinks, true, add);
        }
    },
        
    relayout: function () {
        this.render();
        return this;
    },
        
    toggleJitter: function () {
        this.options.jitter = !this.options.jitter;
        this.render();
        return this;
    },
        
    getData: function (linkFunc, filteredFlag, optionalLinks) {
        var crossLinks = optionalLinks || 
            (filteredFlag ? this.getFilteredCrossLinks () : CLMS.arrayFromMapValues (this.model.get("clmsModel").get("crossLinks")))
        ;
        var data = crossLinks.map (function (c) {
            return linkFunc ? linkFunc.call (this, c) : [undefined];
        }, this);
        return data;
    },
        
    getSelectedOption: function (axisLetter) {
        var funcMeta;
        
        this.controlDiv
            .selectAll("select")
                .filter(function(d) { return d === axisLetter; })
                .selectAll("option")
                .filter(function() { return d3.select(this).property("selected"); })
                .each (function (d) {
                    funcMeta = d;
                })
        ;
        
        return funcMeta;
    },
        
    getFilteredCrossLinks: function () {
        return this.model.getFilteredCrossLinks ("all");    // include decoys and linears for this view
    },
        
    getAxisData: function (axisLetter, filteredFlag, optionalLinks) {
        var funcMeta = this.getSelectedOption (axisLetter);  
        var data = this.getData (funcMeta ? funcMeta.linkFunc : undefined, filteredFlag, optionalLinks);
        return {label: funcMeta ? funcMeta.label : "?", data: data, zeroBased: !funcMeta.nonZeroBased, matchLevel: funcMeta.matchLevel || false};
    },
        
    getBothAxesMetaData: function () {
        return ["X", "Y"].map (function (axisLetter) {
            return this.getSelectedOption (axisLetter);
        }, this);    
    },
        
    axisChosen: function () { 
        var datax = this.getAxisData ("X", false);
        var datay = this.getAxisData ("Y", false);
        
        var directions = [
            {dataDetails: datax, scale: this.x},
            {dataDetails: datay, scale: this.y},
        ];
        
        directions.forEach (function (direction) {
            var dom = d3.extent (d3.merge (direction.dataDetails.data));
            if (dom[0] === undefined || !_.isNumber (dom[0])) {
                dom = [0, 0];
            }
            if (direction.dataDetails.zeroBased && _.isNumber (dom[0])) {
                dom[0] = d3.min ([0, dom[0]]);
            }
            dom = dom.map (function (v, i) { 
                return _.isNumber(v) ? Math[i === 0 ? "floor": "ceil"](v) : v; 
            });
            //var leeway = Math.ceil (Math.abs(dom[1] - dom[0]) / 10) / 2;
            //dom[0] -= xLeeway; // 0.5;
            //dom[1] += 0.5;
            direction.scale.domain (dom);
            //console.log ("DOM", dom, direction.scale, direction.scale.domain());
        }); 
        //console.log ("data", datax, datay, domX, domY);
        
        // Update x/y labels and axes tick formats
        this.vis.selectAll("g.label text").data([datax, datay])
            .text (function(d) { return d.label; })
        ;
        
        if (!this.brush.empty()) {
            this.model.setMarkedCrossLinks ("highlights", [], false, false);
        }
        this.brush.clear();
          
        return this;
    }, 
        
    doHighlightAndTooltip: function (evt) {
        return this.doHighlight(evt).doTooltip(evt);
    },
        
    getHighlightRange: function (evt, squarius) {
        var background = d3.select(this.el).select(".background").node();
        var margin = this.options.chartMargin;
        var x = CLMSUI.utils.crossBrowserElementX (evt, background) + margin;
        var y = CLMSUI.utils.crossBrowserElementY (evt, background) + margin;
        var sortFunc = function (a,b) { return a - b; };
        var xrange = [this.x.invert (x - squarius), this.x.invert (x + squarius)].sort (sortFunc);
        var yrange = [this.y.invert (y - squarius), this.y.invert (y + squarius)].sort (sortFunc);
        return {xrange: xrange, yrange: yrange};
    },
      
    doTooltip: function (evt) {
        var axesMetaData = this.getBothAxesMetaData();
        var highlightRange = this.getHighlightRange (evt, 20);
        var vals = [highlightRange.xrange, highlightRange.yrange];
        var inBetweenValidValues = false;
        
        var tooltipData = axesMetaData.map (function (axisMetaData, i) {
            var commaFormat = d3.format(",."+axisMetaData.decimalPlaces+"f");
            var rvals = ["ceil", "floor"].map (function (func, ii) {
                var v = CLMSUI.utils[func] (vals[i][ii], axisMetaData.decimalPlaces);
                if (v === 0) { v = 0; } // gets rid of negative zero
                return v;
            });
            var fvals = rvals.map (function (v) { return commaFormat(v); });
            inBetweenValidValues |= (rvals[0] > rvals[1]);
            return [axisMetaData.label, rvals[0] > rvals[1] ? "---" : fvals[0] + (fvals[0] === fvals[1] ? "" : " to "+fvals[1])];  
        });
        
        var size = this.selectSize;
        var level = axesMetaData.some (function (axmd) { return axmd.matchLevel; }) ? (size === 1 ? "Match" : "Matches") : (size === 1 ? "Cross-Link" : "Cross-Links");
        
         this.model.get("tooltipModel")
            .set("header", "Highlighting "+(d3.format(",")(size))+" "+level)
            .set("contents", inBetweenValidValues ? null : tooltipData)
            .set("location", evt)
        ;
        this.trigger ("change:location", this.model, evt);  // necessary to change position 'cos d3 event is a global property, it won't register as a change
        return this;
    },
        
    doHighlight: function (evt) {
        var highlightRange = this.getHighlightRange (evt, 20);
        var extent = [
            [highlightRange.xrange[0], highlightRange.yrange[0]],
            [highlightRange.xrange[1], highlightRange.yrange[1]],
        ]; 
        this.selectPoints ({extent: extent, add: evt.shiftKey || evt.ctrlKey});
        return this;
    },
        
    clearHighlightAndTooltip: function () {
        return this.clearHighlight().clearTooltip();    
    },
        
    clearTooltip: function () {
        this.model.get("tooltipModel").set("contents", null);
        return this;
    },
        
    clearHighlight: function () {
        this.model.setMarkedCrossLinks ("highlights", [], false, false);
        return this;
    },
        
    render: function () {
        if (this.isVisible()) {
            console.log ("SCATTERPLOT RENDER");
            this
                .resize()
                .renderCrossLinks ({isVisible: true})
            ;
        }
        return this;
    },
        
        
    recolourCrossLinks: function () {
        this.renderCrossLinks ({recolourOnly: true});
        return this;
    },
        

    renderCrossLinks: function (options) {
        options = options || {};
        
        if (options.isVisible || this.isVisible()) {
            
            var pointSize = this.options.pointSize;
            var halfPointSize = pointSize / 2;
            
            var self = this;
            var colourScheme = this.model.get("linkColourAssignment");

            var filteredCrossLinks = this.getFilteredCrossLinks ();
            var selectedCrossLinkIDs = d3.set (_.pluck (this.model.getMarkedCrossLinks("selection"), "id"));
            var highlightedCrossLinkIDs = d3.set (_.pluck (this.model.getMarkedCrossLinks("highlights"), "id"));
            
            var selectedMatchMap = this.model.getMarkedMatches ("selection");
            var highlightedMatchMap = this.model.getMarkedMatches ("highlights");
            
            var sortedFilteredCrossLinks = CLMSUI.modelUtils.radixSort (4, filteredCrossLinks, function (link) {
                return highlightedCrossLinkIDs.has (link.id) ? 3 : (selectedCrossLinkIDs.has (link.id) ? 2 : (link.isDecoyLink() ? 0 : 1));
            });
            
            var makeCoords = function (datax, datay) {
                return datax.data.map (function (xd, i) {
                    var yd = datay.data[i];
                    var pairs;
                    if (xd.length === 1) {
                        pairs = yd.map (function (d) {
                            return [xd[0], d];
                        });
                    }
                    else if (yd.length === 1) {
                        pairs = xd.map (function (d) {
                            return [d, yd[0]];
                        });
                    }
                    else {
                        pairs = xd.map (function (d,i) {
                            return [d, yd[i]];
                        });
                    }
                    
                    // get rid of pairings where one of the values is undefined
                    pairs = pairs.filter (function (pair) {
                        return pair[0] !== undefined && pair[1] !== undefined;
                    });
                    
                    return pairs;
                });
            };
            
            /*
            var linkSel = this.scatg.selectAll("g.crossLinkGroup")
                .data (filteredCrossLinks, function(d) { return d.id; })
                .order()
            ;
            linkSel.exit().remove();
            linkSel.enter().append("g")
                .attr ("class", "crossLinkGroup")
            ;
            linkSel.each (function (d) {
                var high = highlightedCrossLinkIDs.has (d.id);
                var selected = selectedCrossLinkIDs.has (d.id);
                d3.select(this)
                    .style ("fill", high ?  self.options.highlightedColour : (selected ? self.options.selectedColour : colourScheme.getColour (d)))
                    .style ("stroke", high || selected ? "black" : null)
                    .style ("stroke-opacity", high || selected ? 0.4 : null)
                ;
            });
            
            
            if (!options.recolourOnly) {
                var jitter = this.options.jitter;
                var datax = this.getAxisData ("X", true, filteredCrossLinks);
                var datay = this.getAxisData ("Y", true, filteredCrossLinks);

                var coords = makeCoords (datax, datay);

                //console.log ("coords", datax, datay, coords);

                var matchSel = linkSel.selectAll("rect.datapoint").data (function(d,i) { return coords[i]; });

                matchSel.exit().remove();
                matchSel.enter().append("rect")
                    .attr ("class", "datapoint")
                    .attr ("width", pointSize)
                    .attr ("height", pointSize)
                ;

                matchSel
                    .attr("x", function(d) { 
                        var xr = Math.random() - 0.5;
                        var z = (d[0] * d[1]) + d[0] + d[1];
                        return self.x (d[0]) + (jitter ? xr * self.jitterRanges.x : 0); 
                    })
                    .attr("y", function(d) { 
                        var yr = Math.random() - 0.5;
                        return self.y (d[1]) + (jitter ? yr * self.jitterRanges.y : 0);
                    })
                ;
            }
            */
            
            var canvasNode = this.canvas.node();
            var ctx = canvasNode.getContext("2d");       
            ctx.fillStyle = this.options.background;
            ctx.fillRect (0, 0, canvasNode.width, canvasNode.height);
            ctx.imageSmoothingEnabled = false;
            
            var datax = this.getAxisData ("X", true, sortedFilteredCrossLinks);
            var datay = this.getAxisData ("Y", true, sortedFilteredCrossLinks);
            var matchLevel = datax.matchLevel || datay.matchLevel;
            var coords = makeCoords (datax, datay);
            var jitter = this.options.jitter;
            //console.log ("ddd", datax, datay, filteredCrossLinks, coords, colourScheme);
            
            var countable = colourScheme.isCategorical();
            if (countable) {
                this.counts = d3.range (0, colourScheme.getDomainCount()).map (function() { return 0; });
            }

            sortedFilteredCrossLinks.forEach (function (link, i) {
                var decoy = link.isDecoyLink();
                var linkValue = colourScheme.getValue (link);
                var colour = colourScheme.getColourByValue (linkValue);

                var high, selected;
                if (!matchLevel) {
                    high = highlightedCrossLinkIDs.has (link.id);
                    selected = selectedCrossLinkIDs.has (link.id);
                    ctx.fillStyle = high ? self.options.highlightedColour : (selected ? self.options.selectedColour : colour);
                    ctx.strokeStyle = high || selected ? "black" : (decoy ? ctx.fillStyle : null);
                }
                
                // try to make jitter deterministic so points don't jump on filtering, recolouring etc
                var xr = ((link.fromResidue % 10) / 10) - 0.45;
                var yr = ((link.toResidue % 10) / 10) - 0.45;
                
                coords[i].forEach (function (coord, ii) {
                    //var xr = (Math.random() - 0.5);
                    //var yr = (Math.random() - 0.5);
                    if (matchLevel) {
                        var match = link.filteredMatches_pp[ii].match;
                        high = highlightedMatchMap.has (match.id);
                        selected = selectedMatchMap.has (match.id);
                        ctx.fillStyle = high ? self.options.highlightedColour : (selected ? self.options.selectedColour : colour);
                        ctx.strokeStyle = high || selected ? "black" : (decoy ? ctx.fillStyle : null);
                    }
                    var x = self.x (coord[0]) + (jitter ? xr * self.jitterRanges.x : 0) - halfPointSize;
                    var y = self.y (coord[1]) + (jitter ? yr * self.jitterRanges.y : 0) - halfPointSize;
                    x = Math.round (x); // the rounding and 0.5s are to make fills and strokes crisp (i.e. not anti-aliasing)
                    y = Math.round (y);
                    if (decoy) {
                        //var offset = Math.floor (halfPointSize);
                        ctx.strokeRect (x - 0.5, y - 0.5, pointSize, pointSize);
                        //ctx.fillRect (x, y + offset, pointSize + 1, 1);
                        //ctx.fillRect (x + offset, y, 1, pointSize + 1);
                    } else {
                        ctx.fillRect (x, y, pointSize, pointSize);
                        if (high || selected) {
                            ctx.strokeRect (x - 0.5, y - 0.5, pointSize, pointSize);
                        }
                        
                        if (countable) {
                            this.counts[linkValue]++;
                        }
                    }
                }, this);
            }, this);
            
            this.makeChartTitle (this.counts, colourScheme, d3.select(this.el).select(".chartHeader"), matchLevel);
        }
        return this;
    },
        
    getSizeData: function () {
        // Firefox returns 0 for an svg element's clientWidth/Height, so use zepto/jquery width function instead
        var jqElem = $(this.svg.node());
        var cx = jqElem.width(); //this.svg.node().clientWidth;
        var cy = jqElem.height(); //this.svg.node().clientHeight;
        var width = Math.max (0, cx - this.margin.left - this.margin.right);
        var height = Math.max (0, cy - this.margin.top  - this.margin.bottom);
        // if it's going to be square and fit in containing div
        var minDim = Math.min (width, height);
        
        return {cx: cx, cy: cy, width: width, height: height, minDim: minDim,};
    },
        
    calcJitterRanges: function () {
        this.jitterRanges = this.jitterRanges || {};
        var xunit = Math.abs (this.x(this.x.domain()[0]) - this.x(this.x.domain()[0] + 1));
        this.jitterRanges.x = Math.max (2, xunit / 3);
        var yunit = Math.abs (this.y(this.y.domain()[0]) - this.y(this.y.domain()[0] + 1));
        this.jitterRanges.y = Math.max (2, yunit / 3);
        return this;
    },
    
    // called when things need repositioned, but not re-rendered from data
    resize: function () {
        
        var sizeData = this.getSizeData(); 

        this.vis
            .style("width",  sizeData.width+"px")
            .style("height", sizeData.height+"px")
        ;      
        
        this.scatg.select(".scatterplotBackground")
            .attr("width",  sizeData.width)
            .attr("height", sizeData.height)
        ;    
        
        this.canvas
            .attr("width",  sizeData.width)
            .attr("height", sizeData.height)
        ;

        var extent = this.brush.extent(); // extent saved before x and y ranges updated
        var chartMargin = this.options.chartMargin;
        
        this.x.range([chartMargin, sizeData.width - chartMargin]);
        this.y.range([sizeData.height - chartMargin, chartMargin]); // y-scale (inverted domain)
        
        // https://stackoverflow.com/questions/32720469/d3-updating-brushs-scale-doesnt-update-brush
        this.brush.extent (extent); // old extent restored
        this.scatg.select(".brush").call(this.brush);   // recall brush binding so background rect is resized and brush redrawn

        this.xAxis.ticks (Math.round ((sizeData.width - (chartMargin * 2)) / 40)).outerTickSize(0);
        this.yAxis.ticks (Math.round ((sizeData.height - (chartMargin * 2)) / 40)).outerTickSize(0);
        
        this.vis.select(".y")
            .attr("transform", "translate(-1,0)")
            .call(this.yAxis)
        ;
        
        this.vis.select(".x")
            .attr("transform", "translate(0," + (sizeData.height) + ")")
            .call(this.xAxis)
        ;
        
        this
            .repositionLabels (sizeData)
            .calcJitterRanges()
        ;
        
        CLMSUI.utils.declutterAxis (this.vis.select(".x"));
        
        return this;
    },
        
    // Used to do this just on resize, but rectangular areas mean labels often need re-centred on panning
    repositionLabels: function (sizeData) {
        // reposition labels
        var labelCoords = [
            {x: sizeData.width / 2, y: sizeData.height + this.margin.bottom - 5, rot: 0}, 
            {x: -this.margin.left, y: sizeData.height / 2, rot: -90},
            {x: sizeData.width / 2, y: 0, rot: 0}
        ];
        this.vis.selectAll("g.label text")
            .data (labelCoords)
            .attr ("transform", function(d) {
                return "translate("+d.x+" "+d.y+") rotate("+d.rot+")";
            })
        ;
        return this;
    },
        
    canvasImageParent: "svg > g > g",   // where to put image made from canvas for downloading svg file
  
    identifier: "Scatterplot",
        
    optionsToString: function () {
        var meta = this.getBothAxesMetaData();
        var axisLabels = _.pluck (meta, "label");
        
        if (!this.brush.empty()) {
            var axisExtents = [];
            d3.select(this.el).selectAll(".brush text")
                .each (function () {
                    axisExtents.push (d3.select(this).text());
                })
            ;
            axisLabels = axisLabels.map (function (axisLabel, i) {
                return axisLabel + "_("+axisExtents[i]+")";
            });
        }
        return (this.options.jitter ? "Jitter_" : "") + axisLabels.join("_by_");
    },
});
    