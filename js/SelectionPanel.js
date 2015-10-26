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

function SelectionPanel (targetDiv){
	// targetDiv could be div itself or id of div - lets deal with that
	if (typeof targetDiv === "string"){
		targetDiv = document.getElementById(targetDiv);
	}
	//avoids prob with 'save - web page complete'
	d3.select(targetDiv).selectAll("*").remove();
	
	this.targetDiv = targetDiv;
}

SelectionPanel.prototype.updateTable = function(selectedLinks){
	//console.log("SELECTED:", selectedLinks);
	var selectionDiv = document.getElementById("selectionDiv");
	var selectedLinkArray = selectedLinks.values();
	var selectedLinkCount = selectedLinkArray.length;
	if (selectedLinkCount === 0) {
		selectionDiv.innerHTML = "<p>No selection.</p>" + 
			"<p>To hide this panel click the X in its top right corner or uncheck the selection checkbox in the top right of the window.</p>";
					
	}
	else {
		var out = ""

		var scoresTable = "<table><tr>";
		//~ scoresTable += "<th>Id</th>";
		scoresTable += "<th>Protein1</th>";
		scoresTable += "<th>PepPos1</th>";
		scoresTable += "<th>PepSeq1</th>";
		scoresTable += "<th>LinkPos1</th>";
		scoresTable += "<th>Protein2</th>";
		scoresTable += "<th>PepPos2</th>";
		scoresTable += "<th>PepSeq2</th>";
		scoresTable += "<th>LinkPos2</th>";
		scoresTable += "<th>Score</th>";
		if (xlv.autoValidatedFound === true){
			scoresTable += "<th>Auto</th>";
		}
		if (xlv.manualValidatedFound === true){
			scoresTable += "<th>Manual</th>";
		}
			scoresTable += "<th>Group</th>";
		scoresTable += "<th>Run name</th>";
		scoresTable += "<th>Scan number</th>";
		scoresTable += "</tr>";

		out +=  scoresTable;

		for (var i = 0; i < selectedLinkCount; i++) {
			var aLink = selectedLinkArray[i];
			if (aLink.residueLinks) {//its a ProteinLink
				out += SelectionPanel.proteinLinkToHTML(aLink);
			}else {//must be ResidueLink
				out += SelectionPanel.residueLinkToHTML(aLink);						
			}							
		}

		out += "</table>";

		selectionDiv.innerHTML = out;
	}
}

SelectionPanel.prototype.clearTableHighlights = function(){
	d3.select(this.targetDiv).selectAll("tr").classed('spectrumShown', false);
}


//used when link clicked
SelectionPanel.proteinLinkToHTML = function (proteinLink) {
	var linkInfo = "";
	var resLinks = proteinLink.residueLinks.values();
	var resLinkCount = resLinks.length;
	for (var i = 0; i < resLinkCount; i++) {
		var resLink = resLinks[i];
		linkInfo += SelectionPanel.residueLinkToHTML(resLink);
	}
	return linkInfo;
};

SelectionPanel.residueLinkToHTML = function(residueLink){
	var matches = residueLink.getFilteredMatches();
	var c = matches.length;
	var rows = "";
	for (var j = 0; j < c; j++) {
		var match = matches[j][0];

		var htmlTableRow = "<tr>";
		if (typeof loadSpectra == "function"){
			htmlTableRow = "<tr id='match" + match.id + "' onclick=\"loadSpectra('"+match.id+"','"+match.pepSeq1+"',"
				+match.linkPos1+",'"+match.pepSeq2+"',"+match.linkPos2+");selectionPanel.clearTableHighlights();"
				+ "d3.selectAll('#match"+match.id+"').attr('class','spectrumShown');\">";
		}

		//~ htmlTableRow += "<td><p>" + match.id
			//~ + "</p></td>";
		htmlTableRow += "<td><p>" + match.protein1
			+ "</p></td>";
		htmlTableRow += "<td><p>" + match.pepPos1
			+ "</p></td>";
		htmlTableRow += "<td><p>" + match.pepSeq1raw
			+ "</p></td>";
		htmlTableRow += "<td><p>" + match.linkPos1
			+ "</p></td>";
		htmlTableRow += "<td><p>" + match.protein2
			+ "</p></td>";
		htmlTableRow += "<td><p>" + match.pepPos2
			+ "</p></td>";
		htmlTableRow += "<td><p>" + match.pepSeq2raw
			+ "</p></td>";
		htmlTableRow += "<td><p>" + match.linkPos2
			+ "</p></td>";

		htmlTableRow += "<td><p>" +
		((typeof match.score !== 'undefined')? match.score.toFixed(4) : 'undefined')
		+ "</p></td>";

		if (match.controller.autoValidatedFound === true){
			htmlTableRow += "<td><p>" + match.autovalidated
				+ "</p></td>";
		}

		if (match.controller.manualValidatedFound === true){
			htmlTableRow += "<td><p>" + match.validated
				+ "</p></td>";
		}
		htmlTableRow += "<td><p>" + match.group
				+ "</p></td>";
		htmlTableRow += "<td><p>" + match.runName
				+ "</p></td>";
		htmlTableRow += "<td><p>" + match.scanNumber
				+ "</p></td>";
		htmlTableRow += "</tr>";
		rows += htmlTableRow;
	}
	return rows;
}