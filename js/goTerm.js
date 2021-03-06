CLMSUI = CLMSUI || {};

CLMSUI.GoTerm = function() {
    // lazy instantiation instead
    //this.is_a = new Set(); // i.e. superclasses
    //this.subclasses = new Set();
    //this.part_of = new Set();
    //this.parts = new Set();
    //this.interactors = new Set();
    this.filtInteractorCount = 0;
};

CLMSUI.GoTerm.prototype.getInteractors = function (storeCount) {
    var go = CLMSUI.compositeModelInst.get("go");
    CLMSUI.GoTerm.prototype.getCount++;
    
    var subTreeSet; // = new Set();
    
    if (this.parts || this.subclasses || this.interactors) {
        subTreeSet = new Set();
        
        if (this.parts) {
            for (let partId of this.parts) {
                var sub = go.get(partId).getInteractors(storeCount);
                if (sub) {
                    sub.forEach (subTreeSet.add, subTreeSet);
                }
            }
        }
        if (this.subclasses) {
            for (let subclassId of this.subclasses) {
                var sub = go.get(subclassId).getInteractors(storeCount);
                if (sub) {
                    sub.forEach (subTreeSet.add, subTreeSet);
                }
            }
        }

        if (this.interactors) {
            for (let i of this.interactors) {
                if (i.hidden == false) {
                    subTreeSet.add(i);
                }
            }
        }
        
        if (subTreeSet.size === 0) { subTreeSet = null; }
    }
    if (storeCount) {
        this.filtInteractorCount = subTreeSet ? subTreeSet.size : 0;
        //if (subTreeSet.size) { console.log ("sub", subTreeSet, this.id); }
    }
    
    return subTreeSet;
};


CLMSUI.GoTerm.prototype.isDirectRelation = function(anotherGoTerm) {
    var agoid = anotherGoTerm.id;
    return ( 
        (this == anotherGoTerm) ||
        (this.is_a && this.is_a.has (agoid)) ||
        (this.subclasses && this.subclasses.has (agoid)) ||
        (this.part_of && this.part_of.has (agoid)) ||
        (this.parts && this.parts.has (agoid)) 
    );
}


/*
CLMSUI.GoTerm.prototype.getClosestVisibleParents = function(visibleParents) {
    if (!visibleParents) {
        visibleParents = new Set();
    }
    for (var parent of this.parents) {
        if (parent.isVisible()) {
            visibleParents.add(parent);
        } else {
            parent.getClosestVisibleParents(visibleParents);
        }
    }
    return visibleParents;
}

CLMSUI.GoTerm.prototype.isVisible = function() {
    if (this.parents.length == 0) {
        return true;
    } else {
        for (let p of this.parents) {
            if (p.expanded) {
                return true;
            }
        }
    }
    return false;
}
*/
