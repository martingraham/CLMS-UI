var CLMSUI = CLMSUI || {};

CLMSUI.loadSpectra = function (match, randId, spectrumModel, ignoreResultUnlessLastRequested) {

    var xiAnnotRoot = CLMSUI.xiAnnotRoot || "";

    var url = xiAnnotRoot + "annotate/"
        + match.searchId + "/" + (randId || "12345") + "/" + match.id
        + "/?peptide=" + match.matchedPeptides[0].seq_mods
        + ((match.matchedPeptides[1])? ("&peptide=" + match.matchedPeptides[1].seq_mods) : "")
        + ((match.linkPos1)? ("&link=" + match.linkPos1) : "")
        + ((match.linkPos2)? ("&link=" + match.linkPos2) : "")
    ;

	CLMSUI.loadSpectra.lastRequestedID = match.id;

    d3.json (url, function(error, json) {
        if (error) {
            console.log ("error", error, "for", url);
            d3.select("#range-error").text ("Cannot load spectra from URL");
            spectrumModel.clear();
        } else {
			//console.log ("ann json", json);
			//console.log (json.annotation.psmID, CLMSUI.loadSpectra.lastRequestedID);
			if (!ignoreResultUnlessLastRequested || (json && json.annotation && json.annotation.psmID && json.annotation.psmID === CLMSUI.loadSpectra.lastRequestedID)) {
				d3.select("#range-error").text ("");
				spectrumModel.set ({JSONdata: json, match: match, randId: randId});
			}
        }
    });
}; 