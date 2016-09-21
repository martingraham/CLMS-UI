

    var CLMSUI = CLMSUI || {};
    CLMSUI.BackboneModelTypes = CLMSUI.BackboneModelTypes || {};
    
    CLMSUI.BackboneModelTypes.CompositeModelType = Backbone.Model.extend ({
        applyFilter: function () {
			var filterModel = this.get("filterModel");
            var crossLinks = this.get("clmsModel").get("crossLinks").values();
            for (var crossLink of crossLinks) {
                if (filterModel) {
					crossLink.filteredMatches_pp = [];
					
					if (filterModel.get("intraFDRCut") >= 0 || filterModel.get("interFDRCut") >= 0) {
						//console.log ("yo fdring");
						var pass = filterModel.filterLink (crossLink);
						if (pass) {
							crossLink.filteredMatches_pp = crossLink.matches_pp.slice(0);
							crossLink.ambiguous = 
								!crossLink.filteredMatches_pp.some (function (matchAndPepPos) {
									return matchAndPepPos.match.crossLinks.length === 1;
								})
							;    
						}
					} else {
						crossLink.ambiguous = true;
						crossLink.confirmedHomomultimer = false;
						for (var matchAndPepPos of crossLink.matches_pp) {	
							var match = matchAndPepPos.match;
							var result = filterModel.filter(match);
							if (result === true){
								crossLink.filteredMatches_pp.push(matchAndPepPos);
								if (match.crossLinks.length === 1) {
									crossLink.ambiguous = false;
								}
								if (match.crossLinks.hd === true) { // what is .hd ??
									crossLink.confirmedHomomultimer = true;
								}                       
							}
						}
					}
				}
				else {
					crossLink.filteredMatches_pp = crossLink.matches_pp;
				}
            }
            this.trigger ("filteringDone");
        },

        getFilteredCrossLinks: function (crossLinks) {
            //console.log ("crosslinks", crossLinks);
            var result = new Map;

            crossLinks.forEach (function (value, key) {
                if (!value.filteredMatches_pp
						|| value.filteredMatches_pp.length > 0) {
							result.set (key, value);
				}
            }, this);

            return result;

            //return crossLinks.filter (function(cLink) {
            //    return cLink.filteredMatches_pp.length > 0;
            //}); 
        },
        
        collateMatchRegions: function (crossLinks) {
            var fromPeptides = [], toPeptides = [], regs = [], prots = {};
            crossLinks.forEach (function (crossLink) {
                crossLink.filteredMatches_pp.forEach (function (matchAndPepPos) {
                    console.log ("match", match);
                    var smatch = matchAndPepPos.match;
                    var prot1 = smatch.protein1[0];
                    var prot2 = smatch.protein2[0];
                    prots[prot1] = prots[prot1] || [];
                    prots[prot2] = prots[prot2] || [];

                    var fromPepStart = matchAndPepPos.pepPos[0].start - 1;
                    var fromPepLength = matchAndPepPos.pepPos[0].length;
                    var toPepStart = matchAndPepPos.pepPos[1].start - 1;
                    var toPepLength = matchAndPepPos.pepPos[1].length;
                    
                    prots[prot1].push ({protein: prot1, start: fromPepStart, end: fromPepStart + fromPepStart });
                    prots[prot2].push ({protein: prot2, start: toPepStart, end: toPepStart + toPepLength }); 
                });
            });
            
            console.log ("match regions", prots);
            
            return prots;
        },
        
        // modelProperty can be "highlights" or "selection" (or a new one) depending on what array you want
        // to fill in the model
        calcMatchingCrosslinks: function (modelProperty, crossLinks, andAlternatives, add) {
            if (crossLinks) {   // if undefined nothing happens, to remove selection pass an empty array - []
                if (add) {
                    var existingCrossLinks = this.get (modelProperty);
                    crossLinks = crossLinks.concat (existingCrossLinks);
                    console.log ("excl", existingCrossLinks);
                }
                var crossLinkMap = d3.map (crossLinks, function(d) { return d.id; });

                if (andAlternatives) {
                    crossLinks.forEach (function (crossLink) {
                        if (crossLink.ambiguous || crossLink.ambig) {
                           this.recurseAmbiguity (crossLink, crossLinkMap);
                        }
                    }, this);
                }
                var dedupedCrossLinks = crossLinkMap.values();
                this.set (modelProperty, dedupedCrossLinks);
            }
        },

        recurseAmbiguity: function (crossLink, crossLinkMap) {
            var matches = crossLink.filteredMatches_pp;
            matches.forEach (function (match) {
                var matchData = match.match;
                if (matchData.isAmbig()) {
                    matchData.crossLinks.forEach (function (overlapCrossLink) {
                        if (!crossLinkMap.has (overlapCrossLink.id)) {
                            crossLinkMap.set (overlapCrossLink.id, overlapCrossLink);
                            this.recurseAmbiguity (overlapCrossLink, crossLinkMap);
                        }
                    }, this);
                }
            }, this);
        },
        
        //what type should selectedProtein be? Set? Array? Is a map needed?
        setSelectedProteins: function (idArr, add) {
            var map = add ? new Map (this.get("selectedProtein")) : new Map ();
            idArr.forEach (function (id) {
                map.set (id, this.get("clmsModel").get("interactors").get(id));    
            }, this);
            console.log ("map eq", map == this.get("selectedProtein"));
            // Currently (03/06/16) Maps/Sets don't trigger change functions even for new Objects
            // https://github.com/jashkenas/underscore/issues/2451
            // So need to force change event
            this.set ("selectedProtein", map);
            this.trigger ("change:selectedProtein", this);
            console.log ("map", this.get("selectedProtein"));
        },
        
        getSingleCrosslinkDistance: function (xlink) {
            if (xlink.toProtein === xlink.fromProtein) {
                var distances = xlink.toProtein.distances;
                if (distances) {
                    var highRes = Math.max (xlink.toResidue, xlink.fromResidue);
                    var lowRes = Math.min (xlink.toResidue, xlink.fromResidue);
                    var values = d3.values(distances);
                    var dist = d3.min (values.map (function (value) {
                        return value[highRes] ? value[highRes][lowRes] : null;
                    }))
                    //console.log ("dist", dist);
                    return dist;
                }
            }
            return null;
        }
    
    });
