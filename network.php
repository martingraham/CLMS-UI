<!--
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
-->
<?php
    session_start();
?>

<!DOCTYPE html>
<html>
    <head>
        <meta http-equiv="content-type" content="text/html; charset=UTF-8">
        <meta charset="utf-8">
        <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">
        <meta http-equiv="content-type" content="text/html; charset=utf-8" />
        <meta http-equiv="cache-control" content="max-age=0" />
        <meta http-equiv="cache-control" content="no-cache" />
        <meta http-equiv="expires" content="0" />
        <meta http-equiv="expires" content="Tue, 01 Jan 1980 1:00:00 GMT" />
        <meta http-equiv="pragma" content="no-cache" />

        <meta name="description" content="common platform for downstream analysis of CLMS data" />
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-status-bar-style" content="black">

        <link rel="stylesheet" href="./css/reset.css" />
        <link rel="stylesheet" type="text/css" href="./css/byrei-dyndiv_0.5.css">
        <link rel="stylesheet" href="./css/style.css" />
        <link rel="stylesheet" href="./css/xiNET.css">
        <link rel="stylesheet" href="./css/matrix.css">
        <link rel="stylesheet" href="./css/tooltip.css">
        <link rel="stylesheet" href="./css/c3.css">
        <link rel="stylesheet" href="./css/minigram.css">
        <link rel="stylesheet" href="./css/ddMenuViewBB.css">
        <link rel="stylesheet" href="./css/alignViewBB.css">
        <link rel="stylesheet" href="./css/selectionViewBB.css">
        <link rel="stylesheet" href="./css/circularViewBB.css">
        <link rel="stylesheet" href="./css/spectrumViewWrapper.css">
        <link rel="stylesheet" href="./css/validate.css">
        <link rel="stylesheet" href="./css/proteinInfoViewBB.css">
        <link rel="stylesheet" href="./css/key.css">

        <script type="text/javascript" src="./vendor/byrei-dyndiv_1.0rc1-src.js"></script>
        <script type="text/javascript" src="./vendor/d3.js"></script>
        <script type="text/javascript" src="./vendor/colorbrewer.js"></script>
        <script type="text/javascript" src="./vendor/rgbcolor.js"></script>
        <script type="text/javascript" src="./vendor/ngl.embedded.min.js"></script>
        <script type="text/javascript" src="./vendor/crosslink.js"></script>
        <script type="text/javascript" src="./vendor/c3.js"></script>
        <script type="text/javascript" src="./vendor/split.js"></script>
        <script type="text/javascript" src="./vendor/svgexp.js"></script>
        <script type="text/javascript" src="./vendor/underscore.js"></script>
        <script type="text/javascript" src="./vendor/zepto.js"></script>
        <script type="text/javascript" src="./vendor/backbone.js"></script>

<!--
        <script type="text/javascript" src="./vendor/CLMS_model.js"></script>
-->

        <script type="text/javascript" src="../CLMS-model/src/CLMS/model/SearchResultsModel.js"></script>
        <script type="text/javascript" src="../CLMS-model/src/CLMS/model/SpectrumMatch.js"></script>
        <script type="text/javascript" src="../CLMS-model/src/CLMS/model/AnnotatedRegion.js"></script>
        <script type="text/javascript" src="../CLMS-model/src/CLMS/model/CrossLink.js"></script>
        <script type="text/javascript" src="../CLMS-model/src/CLMS/util/xiNET_Storage.js"></script>

<!--
       <script type="text/javascript" src="./vendor/crosslinkviewer.js"></script>
-->

        <script type="text/javascript" src="../crosslink-viewer/src/CLMS/xiNET/CrosslinkViewerBB.js"></script>
        <script type="text/javascript" src="../crosslink-viewer/src/CLMS/xiNET/RenderedLink.js"></script>
        <script type="text/javascript" src="../crosslink-viewer/src/CLMS/xiNET/RenderedProtein.js"></script>
        <script type="text/javascript" src="../crosslink-viewer/src/CLMS/xiNET/RenderedCrossLink.js"></script>
        <script type="text/javascript" src="../crosslink-viewer/src/CLMS/xiNET/P_PLink.js"></script>
        <script type="text/javascript" src="../crosslink-viewer/src/CLMS/xiNET/Rotator.js"></script>

        <!-- Backbone models/views loaded after Backbone itself, otherwise need to delay their instantiation somehow -->
        <script type="text/javascript" src="./js/Utils.js"></script>
        <script type="text/javascript" src="./js/models.js"></script>
        <script type="text/javascript" src="./js/compositeModelType.js"></script>
        <script type="text/javascript" src="./js/modelUtils.js"></script>
        <script type="text/javascript" src="./js/distogramViewBB.js"></script>
        <script type="text/javascript" src="./js/DistanceSliderBB.js"></script>
        <script type="text/javascript" src="./js/filterViewBB.js"></script>
        <script type="text/javascript" src="./js/matrixViewBB.js"></script>
        <script type="text/javascript" src="./js/tooltipViewBB.js"></script>
        <script type="text/javascript" src="./js/minigramViewBB.js"></script>
        <script type="text/javascript" src="./js/ddMenuViewBB.js"></script>
        <script type="text/javascript" src="./js/NGLViewBB.js"></script>
        <script type="text/javascript" src="./js/bioseq32.js"></script>
        <script type="text/javascript" src="./js/alignModelType.js"></script>
        <script type="text/javascript" src="./js/alignViewBB3.js"></script>
        <script type="text/javascript" src="./js/alignSettingsViewBB.js"></script>
        <script type="text/javascript" src="./js/selectionTableViewBB.js"></script>
        <script type="text/javascript" src="./js/circularViewBB.js"></script>
        <script type="text/javascript" src="./js/linkColourAssignment.js"></script>
        <script type="text/javascript" src="./js/spectrumViewWrapper.js"></script>
        <script type="text/javascript" src="./js/validate.js"></script>
        <script type="text/javascript" src="./js/proteinInfoViewBB.js"></script>
        <script type="text/javascript" src="./js/keyViewBB.js"></script>
        <script type="text/javascript" src="./js/networkFrame.js"></script>
        <script type="text/javascript" src="./js/downloads.js"></script>

        <!-- Spectrum view .js files -->
        <script type="text/javascript" src="../spectrum/src/model.js"></script>
        <script type="text/javascript" src="../spectrum/src/SpectrumView2.js"></script>
        <script type="text/javascript" src="../spectrum/src/FragmentationKeyView.js"></script>
        <script type="text/javascript" src="../spectrum/src/FragKey/KeyFragment.js"></script>
        <script type="text/javascript" src="../spectrum/src/graph/Graph.js"></script>
        <script type="text/javascript" src="../spectrum/src/graph/Peak.js"></script>
        <script type="text/javascript" src="../spectrum/src/graph/Fragment.js"></script>
        <script type="text/javascript" src="../spectrum/src/graph/IsotopeCluster.js"></script>
    </head>

    <body>
        <!--
        <div class="dynDiv" id="spectrumPanelWrapper"></div>
        <div class="dynDiv" id="keyPanel"></div>
        <div class="dynDiv" id="nglPanel"></div>
        <div class="dynDiv" id="distoPanel"></div>
        <div class="dynDiv" id="matrixPanel"></div>
        <div class="dynDiv" id="alignPanel"></div>
        <div class="dynDiv" id="circularPanel"></div>
        -->
        <!-- Main -->
        <div id="main">

            <div class="container">
        <h1 class="page-header">
            <i class="fa fa-home" onclick="window.location = './history.php';" title="Return to search history"></i>
            <p class="btn">Layout:</p>
            <button class="btn btn-1 btn-1a" id="save" onclick="saveLayout();">Save</button>
            <button class="btn btn-1 btn-1a" onclick="crosslinkViewer.reset();">Reset</button>
            <p id="expDropdownPlaceholder"></p>
            <p id="viewDropdownPlaceholder"></p>
            <a href="./html/help.html" target="_blank" class="btn btn-1 btn-1a righty">Help</a>
        </h1>
    </div>

            <div class="mainContent">
                <div id="topDiv">
                    <div id="networkDiv"></div>
                    <div id="sliderDiv"></div>
                </div>
                <div id="bottomDiv"></div>
            </div>

            <div class="controls">
     <span id="filterPlaceholder"></span>

                    <div style='float:right'>

<!--
    <label style="margin-left:20px;"><span>Annotations:</span>
                            <select id="annotationsSelect" onChange="changeAnnotations();">
                                <option>None</option>
                                <option selected>Custom</option>
                                <option>UniprotKB</option>
                                <option>SuperFamily</option>
                                <option>Lysines</option>
                            </select>
                        </label>
-->
                        <label style="margin-left:20px;">Link colours:
                            <select id="linkColourSelect" onChange="changeLinkColours();">
                                <option selected>Default</option>
                                <option>Group</option>
<!--
                                <option>SAS dist.</option>
-->
<!--
                                <option>Euclidean dist.</option>
-->

                            </select>
                        </label>
                    </div>
                </div>
        </div><!-- MAIN -->


    <script>
    //<![CDATA[

        var CLMSUI = CLMSUI || {};
        <?php
            if (isset($_SESSION['session_name'])) {
                echo "CLMSUI.loggedIn = true;";
            }
            include './php/loadData.php';
            //~ if (file_exists('../annotations.php')){
                //~ include '../annotations.php';
            //~ }
        ?>

        var options = {proteins: proteins, peptides: peptides, rawMatches: tempMatches,  searches: searchMeta};

        CLMSUI.init.models(options);

        var searches = CLMSUI.compositeModelInst.get("clmsModel").get("searches");
        document.title = Array.from(searches.keys()).join();

        var windowLoaded = function () {

            CLMSUI.init.views();

            allDataAndWindowLoaded ();

        };

        var split = Split (["#topDiv", "#bottomDiv"], { direction: "vertical", sizes: [60,40], minSize: [200,10], });

        //~ https://thechamplord.wordpress.com/2014/07/04/using-javascript-window-onload-event-properly/
        window.addEventListener("load", windowLoaded);

    //]]>
    </script>

    </body>
</html>
