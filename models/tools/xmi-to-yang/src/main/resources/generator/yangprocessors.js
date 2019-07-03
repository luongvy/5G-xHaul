var _         = require('lodash');
var Util      = require('../model/yang/util');


var yangModels = {
    Module      : require('../model/yang/module.js'),
    Package     : require('../model/yang/package.js'),
    Node        : require('../model/yang/node.js'),
    Leaf        : require('../model/yang/leaf.js'),
    Abstraction : require('../model/yang/abstraction.js'),
    Feature     : require('../model/yang/feature.js'),
    RPC         : require('../model/yang/rpc.js'),
    Uses        : require('../model/yang/uses.js'),
    Type        : require('../model/yang/type.js'),
    Augment     : require('../model/yang/augment.js')
};
var ObjectClass = require('../model/ObjectClass.js');
var creators = require('../parser/creators.js');

module.exports = {
    writeYang: function(store,obj) {
        var layer = 0;
        var st = obj.writeNode(store,layer);
        var res = st.replace(/\t/g, '    ');
        return res;
    },
    pushPackages:function(store){
        for(var t = 0; t < store.yangModule.length; t++){
            var ym = store.yangModule[t];
            for(var j = 0; j < store.packages.length; j++){
                var package = store.packages[j];
                if(package.path == "" && ym.fileName == package.fileName){
                    ym.children.push(package);
                }
            }
        }
    },
    mapPackages:function(store){
        var tempPath;
        for(var j = 0; j < store.packages.length; j++){
            var package1 = store.packages[j];
            for(var k = 0; k < store.packages.length; k++){
                var package2 = store.packages[k];
                if(package1.path == "" && package1.fileName == package2.fileName){
                    tempPath = package1.name;
                }else{
                    tempPath = package1.path + "-" + package1.name;
                }
                if(tempPath == package2.path){
                    package1.children.push(package2);
                }
            }
        }
    },
    processFeat:function(ele,store,config){

        var feat = [];
        for(var i = 0; i < ele.length; i++){
            var obj;
            for(var j = 0; j < store.openModelclass.length; j++) {
                var omc = store.openModelclass[j];
                if(omc.id == ele[i].id){
                    if(omc.condition){
                        for(var k = 0; k < feat.length; k++){
                            if(feat[k].name == omc.condition && feat[k].fileName == omc.fileName){
                                break;
                            }
                        }
                        if(k == feat.length){
                            feat.push(creators.createFeature(omc, ele[i].path));
                        }
                    }
                    break;
                }
            }

            if(ele[i].nodeType == "rpc"){
                obj = new yangModels.RPC(ele[i].name, ele[i].description, ele[i].support, ele[i].status, ele[i].fileName);
            } else if(ele[i].nodeType == "notification"){
                obj = new yangModels.Node(ele[i].name, ele[i].description, "grouping", undefined, undefined, ele[i].id, undefined, undefined, ele[i].support, ele[i].status, ele[i].fileName);
            }else{
                obj = new yangModels.Node(ele[i].name, ele[i].description, "grouping", ele[i]["max-elements"], ele[i]["max-elements"], ele[i].id, ele[i].config, ele[i].isOrdered, ele[i].support, ele[i].status, ele[i].fileName);
                obj.isAbstract = ele[i].isAbstract;
                obj.key = ele[i].key;
                obj.keyid = ele[i].keyid;
                obj.keyvalue=ele[i].keyvalue;
            }

            if(config.withSuffix){
                obj.withSuffix=true;
            }

            //create the object of "typedef"
            if(ele[i].nodeType == "enumeration") {
                obj.nodeType = "typedef";
                if(ele[i].generalization.length > 0){
                    for(var j = 0; j < ele[i].generalization.length; j++) {
                        for (var k = 0; k < store.Typedef.length; k++) {
                            var typeDef = store.Typedef[k];
                            
                            /* This part is causing multiple base under the indentityref, which is not yang conform, that why commented out.
                            Martin & Waseem
                            
                            if(ele[i].generalization[j] == typeDef.id){

                                console.info("\nchildren before:\t"+JSON.stringify(ele[i].attribute[0].children));
                                //ele[i].attribute[0].children = typeDef.attribute[0].children.concat(ele[i].attribute[0].children);
                                console.info("\nchildren after:\t"+JSON.stringify(ele[i].attribute[0].children));
                                break;
                            }
                            */
                        }
                    }
                    ele[i].generalization = [];
                }

                for (var j = 0; j < ele[i].attribute.length; j++) {
                    obj.buildChild(ele[i].attribute[j], "enumeration");
                }

            }

            //convert the "generalization" to "uses"
            if(ele[i].generalization.length !== 0) {
                for(var j = 0; j < ele[i].generalization.length; j++){
                    for(var k = 0; k < store.Class.length; k++){
                        var clazz = store.Class[k];
                        if(clazz.id == ele[i].generalization[j]){
                            if(ele[i].fileName == clazz.fileName){
                                if(clazz.support){
                                    obj.uses = new yangModels.Uses(clazz.name, clazz.support,'',config.withSuffix);
                                }else{
                                    if(config.withSuffix){
                                        obj.uses.push(clazz.name+'-g');
                                    }else{
                                        obj.uses.push(clazz.name);
                                    }
                                }
                            }
                            else{
                                if(clazz.support){
                                    obj.uses = new yangModels.Uses(clazz.fileName.split('.')[0] + ":" + clazz.name, clazz.support,'',config.withSuffix);
                                }else{
                                    if(config.withSuffix){
                                        obj.uses.push(clazz.fileName.split('.')[0] + ":" + clazz.name+'-g');
                                    }else{
                                        obj.uses.push(clazz.fileName.split('.')[0] + ":" + clazz.name);
                                    }

                                }
                            }
                            break;
                        }
                    }
                }
            }

            //deal with the ele whose "nodeType" is "grouping"
            if(ele[i].nodeType == "grouping" || ele[i].nodeType == "notification"){
                //create the "children" of object node(obj);
                ele[i].Gname  ? obj.name = ele[i].Gname : null;
                for (var j = 0; j < ele[i].attribute.length; j++) {
                    //decide whether the subnode is "Derived Types"
                    for(var k = 0; k < store.Typedef.length; k++){
                        var typeDef = store.Typedef[k];
                        if(typeDef.id == ele[i].attribute[j].type){
                            if(ele[i].attribute[j].nodeType == "container"){
                                ele[i].attribute[j].nodeType = "leaf";
                            }else if(ele[i].attribute[j].nodeType == "list"){
                                ele[i].attribute[j].nodeType = "leaf-list";
                            }
                            ele[i].attribute[j].isUses = false;
                            if(typeDef.fileName == ele[i].fileName){
                                ele[i].attribute[j].type = typeDef.name;
                            }else{
                                ele[i].attribute[j].type = typeDef.fileName.split('.')[0] + ":" + typeDef.name;
                            }
                        }
                    }
                    /** Refactor - Merge Start **/
                    for(var k=0;k < store.association.length;k++) {
                        if (ele[i].attribute[j].association && ele[i].attribute[j].association == store.association[k].assoid) {
                            if (store.association[k].strictCom == true) {
                                ele[i].attribute[j].isleafRef = false;
                                if (store.association[k].upperValue >1||store.association[k].upperValue=="*") {
                                    ele[i].attribute[j].nodeType == "list";
                                } else {
                                    ele[i].attribute[j].nodeType == "container";
                                }
                                break;
                            } else if (store.association[k].extendedCom == true) {
                                ele[i].attribute[j].isleafRef = false;
                                for(var l = 0; l < store.Class.length; l++){
                                    if(store.Class[l].id == ele[i].attribute[j].type){
                                        var name;
                                        //if(store.Class[l].fileName != currentFileName){ //todo:
                                        if(store.Class[l].fileName != obj.fileName){
                                            name = store.Class[l].fileName.split('.')[0] + ":" + store.Class[l].name;
                                        }else{
                                            name = store.Class[l].name;
                                        }
                                        obj.uses.push(Util.yangifyName(name));
                                        name = "";
                                        break;
                                    }
                                }
                                ele[i].attribute[j]=null;
                                break;
                            } else {
                                //ele[i].attribute[j].isleafRef = true;
                                if (store.association[k].upperValue > 1 || store.association[k].upperValue == "*") {
                                    ele[i].attribute[j].nodeType == "leaf-list";
                                } else {
                                    ele[i].attribute[j].nodeType == "leaf";
                                }
                                break;
                            }
                        }
                    }
                    /**** End Refactor ****/
                    var vr = "",
                        units = "";

                    if(ele[i].attribute[j]) {
                        for (var k = 0; k < store.openModelAtt.length; k++) {
                            var oma = store.openModelAtt[k];

                            if (oma.id == ele[i].attribute[j].id) {
                                if (oma.condition && !config.suppressIfFeatureGen) {
                                    for (var m = 0; m < feat.length; m++) {
                                        if (feat[m].name == oma.condition && feat[m].fileName == oma.fileName) {
                                            break;
                                        }
                                    }
                                    if (m == feat.length) {
                                        feat.push(creators.createFeature(oma, ele[i].path));
                                        ele[i].attribute[j].support = feat[feat.length - 1].name;
                                    } else {
                                        ele[i].attribute[j].support = feat[m].name;
                                    }
                                }
                                if (oma.passedByReference) {
                                    ele[i].attribute[j].isleafRef = true;
                                }

                                ["status", "units", "valueRange", "attributeValueChangeNotification","unsigned", "writeAllowed", "bitLength", "encoding"]
                                .forEach(function(field) {
                                    
                                    if (oma[field] !== undefined) {
                                        ele[i].attribute[j][field] = oma[field];
                                    }
                                });
                                break;
                            }
                        }

                        //deal with the subnode whose type is neither "Derived Types" nor "Build-in Type".
                        if (ele[i].attribute[j].isUses) {
                            var name = ele[i].attribute[j].type;
                            var clazz;
                            //find the "class" whose value of "id" is value of "type"
                            for (var k = 0; k < store.Class.length; k++) {
                                clazz = store.Class[k];
                                if (clazz.id == name) {
                                    ele[i].attribute[j].isAbstract = clazz.isAbstract;
                                    if (clazz.type !== "Class") {
                                        ele[i].attribute[j].isleafRef = false;
                                        ele[i].attribute[j].isGrouping = true;
                                    }
                                    //recursion
                                    ele[i].attribute[j].isUsesNo = k;
                                    ele[i].attribute[j].key = clazz.key;
                                    ele[i].attribute[j].keyid = clazz.keyid;
                                    ele[i].attribute[j].keyvalue = clazz.keyvalue;
                                    var yangPathStatement = Util.handleNamespacePrefix(clazz.instancePath, store.openModelStatement[ele[i].fileName].prefix);
                                    if (i == k) {
                                        if (clazz.instancePath[0] == "/") {
                                            ele[i].attribute[j].type = "leafref+path '" + yangPathStatement + "'";
                                        }
                                        else {
                                            ele[i].attribute[j].type = "leafref+path '/" + yangPathStatement + "'";
                                        }
                                        if (clazz.isAbstract) {
                                            ele[i].attribute[j].type = "string";
                                        }
                                        if (ele[i].attribute[j].nodeType == "list") {
                                            ele[i].attribute[j].nodeType = "leaf-list";
                                        }
                                        else if (ele[i].attribute[j].nodeType == "container") {
                                            ele[i].attribute[j].nodeType = "leaf";
                                        }
                                        break;
                                    }
                                    else {
                                        if (ele[i].attribute[j].isleafRef) {
                                            if (clazz.instancePath[0] === "/") {
                                                ele[i].attribute[j].type = "leafref+path '" + yangPathStatement + "'";
                                            } else {
                                                ele[i].attribute[j].type = "leafref+path '/" + yangPathStatement + "'";
                                            }

                                            if (ele[i].attribute[j].nodeType === "list") {
                                                //ele[i].attribute[j].nodeType = "leaf-list";
                                            }
                                            else if (ele[i].attribute[j].nodeType === "container") {
                                                //ele[i].attribute[j].nodeType = "leaf";
                                            }
                                            break;
                                        }
                                        else {
                                            var Gname;

                                            clazz.Gname ? Gname = clazz.Gname : Gname = clazz.name;
                                            if (ele[i].fileName === clazz.fileName) {
                                                if (clazz.support) {
                                                    ele[i].attribute[j].isUses = new yangModels.Uses(Gname, clazz.support, '', config.withSuffix);
                                                } else {
                                                    ele[i].attribute[j].isUses = clazz.name;
                                                    if (config.withSuffix) {
                                                        ele[i].attribute[j].isUses += '-g';
                                                    }
                                                }
                                                break;
                                            } else {
                                                if (clazz.support) {
                                                    ele[i].attribute[j].isUses = new yangModels.Uses(clazz.fileName.split('.')[0] + ":" + Gname, clazz.support, '', withSuffix)
                                                } else {
                                                    ele[i].attribute[j].isUses = clazz.fileName.split('.')[0] + ":" + Gname;
                                                    if (config.withSuffix) {
                                                        ele[i].attribute[j].isUses += '-g';
                                                    }
                                                }
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                            //didn't find the "class"
                            if (k === store.Class.length) {
                                ele[i].attribute[j].nodeType === "list" ? ele[i].attribute[j].nodeType = "leaf-list" : ele[i].attribute[j].nodeType = "leaf";
                                ele[i].attribute[j].type = "string";
                            }
                        }
                        if (ele[i].attribute[j].type.split("+")[0] === "leafref") {
                            ele[i].attribute[j].type = new yangModels.Type("leafref", ele[i].attribute[j].id, ele[i].attribute[j].type.split("+")[1], vr, "", "", ele[i].fileName);
                        } else if (ele[i].attribute[j].nodeType === "leaf" || ele[i].attribute[j].nodeType === "leaf-list") {
                            ele[i].attribute[j].type = new yangModels.Type(ele[i].attribute[j].type, ele[i].attribute[j].id, undefined, vr, "", "", ele[i].fileName, ele[i].attribute[j].unsigned, ele[i].attribute[j].units);
                        }

                        if (ele[i].attribute[j].type.range) {
                            var regex = /[^0-9/./*]/;
                            if (regex.test(ele[i].attribute[j].type.range) === true) {
                                if (ele[i].attribute[j].type.range.indexOf('*') !== -1) {
                                    ele[i].attribute[j].type.range = this.range.replace('*', "max");
                                }
                                ele[i].attribute[j].description += "\r\nrange of type : " + ele[i].attribute[j].type.range;
                                ele[i].attribute[j].type.range = undefined;
                                console.warn("Warning: The range of id = \"" + ele[i].attribute[j].type.id + "\"doesn't match the RFC 6020! We will put this range into description. Please recheck it.");
                            } else {
                                if (ele[i].attribute[j].type.range.indexOf('*') !== -1) {
                                    ele[i].attribute[j].type.range = this.range.replace('*', "max");
                                }
                            }
                        }

                        if(i == 0 && j == 0){
                            for(var ii = 0; ii < ele.length; ii++){
                                for(var jj = 0; jj < ele[ii].attribute.length; jj++) {
                                    if(ele[ii].attribute[jj].nodeType == "list" || ele[ii].attribute[jj].nodeType == "container"){
                                        for(var iii = 0; iii < ele.length; iii++){
                                            if(ele[iii].id == ele[ii].attribute[jj].type){
                                                ele[iii].isUsed.push(ii);
                                                if(ele[ii].key.length > 0){
                                                    ele[iii].isUsedRef.push(ii);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }

                         if(ele[i].key && clazz){

                            //add uses of objectclasses
                            if(ele[i].attribute[j].isleafRef == true ){
                                if(ele[i].fileName == clazz.fileName){
                                    ele[i].attribute[j].isUses = clazz.name; // [sko] + "-ref";
                                }else{
                                    ele[i].attribute[j].isUses = clazz.fileName.replace(".uml","") + ":" + clazz.name; // [sko] + "-ref";
                                }
                            }else{
                                if(ele[i].fileName == clazz.fileName){
                                    ele[i].attribute[j].isUses = clazz.name;
                                }else{
                                    ele[i].attribute[j].isUses = clazz.fileName.replace(".uml","") + ":" + clazz.name;
                                }
                            }

                             if(ele[i].attribute[j].isleafRef == true){
                                 for(var ass = 0; ass < store.association.length; ass++){
                                     if(ele[i].attribute[j].association == store.association[ass].assoid && store.association[ass].constraint != undefined){
                                         //遍历所有在ref中的class和attributes，如果某个attribute的association等于该constraint，则为绑定
                                         //寻找该assciation连接的两端，i为一段，isUsesNo为另一端
                                     }
                                 }
                             }

                            //add reference
                            // [sko] why? such grouping are never referenced by yang -> commanded
                            // if(ele[i].key.length > 0 && j == 0){

                            //     if(ele[i].isUsedRef.length == 0 || ele[i].isUsedRef.length == 1){
                            //         var newObj = new yangModels.Node(ele[i].name + '-ref', undefined, "grouping", undefined, undefined, obj.id + '_ref', undefined, undefined, undefined, undefined, ele[i].fileName);
                            //         for(var kk = 0; kk < ele[i].key.length; kk++){
                            //             var mypath = "";
                            //             var kpath = "";
                            //             for(var aa = 0; aa < store.augment.length; aa++){
                            //                 var mystr = ele[i].instancePath.split("/");
                            //                 mypath = mystr[0].substring(mystr[0].length - store.augment[aa].client.length);
                            //                 if(mypath == store.augment[aa].client){
                            //                     kpath = "path '" + store.augment[aa].supplier;
                            //                     for(var mm = 1; mm < mystr.length; mm++){
                            //                         kpath = kpath + "/" + Util.yangifyName(mystr[mm]);
                            //                     }
                            //                 }
                            //             }
                            //             if(kpath == ""){
                            //                 var temporaryPath = Util.handleNamespacePrefix(ele[i].instancePath, store.openModelStatement[ele[i].fileName].prefix);
                            //                 kpath = "path '" + "/" + Util.yangifyName(temporaryPath);
                            //             }
                            //             kpath += "'";
                            //             var newType = new yangModels.Type("leafref", '', kpath, "", "", "", ele[i].fileName);
                            //             var newAtt = new yangModels.Leaf(ele[i].name + "-" + ele[i].key[kk], '', undefined, undefined, undefined, newType, undefined, undefined, ele[i].fileName);
                            //             newObj.children.push(newAtt);
                            //         }
                            //         if(ele[i].isUsedRef.length == 1){
                            //             newObj.uses.push(ele[ele[i].isUsedRef[0]].name + "-ref");
                            //         }
                            //         store.References.push(newObj);
                            //     }

                            //     if(ele[i].isUsedRef.length > 1){
                            //         var newObj = new yangModels.Node(ele[i].name + '-ref-1', undefined, "grouping", undefined, undefined, obj.id + '_ref', undefined, undefined, undefined, undefined, ele[i].fileName);
                            //         for(var kk = 0; kk < ele[i].key.length; kk++){
                            //             var mypath = "";
                            //             var kpath = "";
                            //             for(var aa = 0; aa < store.augment.length; aa++){
                            //                 var mystr = ele[i].instancePath.split("/");
                            //                 mypath = mystr[0].substring(mystr[0].length - store.augment[aa].client.length);
                            //                 if(mypath == store.augment[aa].client){
                            //                     kpath = "path '" + store.augment[aa].supplier;
                            //                     for(var mm = 1; mm < mystr.length; mm++){
                            //                         kpath = kpath + "/" + Util.yangifyName(mystr[mm]);
                            //                     }
                            //                 }
                            //             }
                            //             if(kpath == ""){
                            //                 var temporaryPath = Util.handleNamespacePrefix(ele[i].instancePath, store.openModelStatement[ele[i].fileName].prefix);
                            //                 kpath = "path '" + "/" + Util.yangifyName(temporaryPath);
                            //             }
                            //             kpath += "'";
                            //             var newType = new yangModels.Type("leafref", '', kpath, "", "", "", ele[i].fileName);
                            //             var newAtt = new yangModels.Leaf(ele[i].name + "-" + ele[i].key[kk], '', undefined, undefined, undefined, newType, undefined, undefined, ele[i].fileName);
                            //             newObj.children.push(newAtt);
                            //         }
                            //         newObj.uses.push(ele[ele[i].isUsedRef[0]].name + "-ref");
                            //         store.References.push(newObj);

                            //         for(var k = 1; k < ele[i].isUsedRef.length; k++){
                            //             var newObj = new yangModels.Node(ele[i].name + '-ref-' + (k+1), undefined, "grouping", undefined, undefined, obj.id + '_ref', undefined, undefined, undefined, undefined, ele[i].fileName);
                            //             for(var kk = 0; kk < ele[i].key.length; kk++){
                            //                 var mypath = "";
                            //                 var kpath = "";
                            //                 for(var aa = 0; aa < store.augment.length; aa++){
                            //                     var mystr = ele[i].instancePath.split("/");
                            //                     mypath = mystr[0].substring(mystr[0].length - store.augment[aa].client.length);
                            //                     if(mypath == store.augment[aa].client){
                            //                         kpath = "path '" + store.augment[aa].supplier;
                            //                         for(var mm = 1; mm < mystr.length; mm++){
                            //                             kpath = kpath + "/" + Util.yangifyName(mystr[mm]);
                            //                         }
                            //                     }
                            //                 }
                            //                 if(kpath == ""){
                            //                     var temporaryPath = Util.handleNamespacePrefix(ele[i].instancePath, store.openModelStatement[ele[i].fileName].prefix);
                            //                     kpath = "path '" + "/" + Util.yangifyName(temporaryPath);
                            //                 }
                            //                 kpath += "'";
                            //                 var newType = new yangModels.Type("leafref", '', kpath, "", "", "", ele[i].fileName);
                            //                 var newAtt = new yangModels.Leaf(ele[i].name + "-" + ele[i].key[kk], '', undefined, undefined, undefined, newType, undefined, undefined, ele[i].fileName);
                            //                 newObj.children.push(newAtt);
                            //             }
                            //             newObj.uses.push(ele[ele[i].isUsedRef[k]].name + "-ref");
                            //             store.References.push(newObj);
                            //         }
                            //     }
                            // }
                        }

                        if (ele[i].attribute[j].isSpecTarget === false && ele[i].attribute[j].isSpecReference === false
                            && ele[i].attribute[j].isDefinedBySpec === false) {
                            if(ele[i].attribute[j].nodeType == "list"){
                                ele[i].attribute[j].key = clazz.key;
                                ele[i].attribute[j].keyid = clazz.keyid;
                                ele[i].attribute[j].keyvalue = clazz.keyvalue;
                            }
                            obj.buildChild(ele[i].attribute[j], ele[i].attribute[j].nodeType);//create the subnode to obj
                        }
                    }
                }
            }
            //create the object of "typedef"
            if(ele[i].nodeType === "typedef"){
                obj.nodeType = "typedef";
                if(ele[i].attribute[0]){
                    obj.buildChild(ele[i].attribute[0], "typedef");
                }else{
                    obj.buildChild(ele[i], "typedef");
                }
            }
            //create "rpc"
            if(ele[i].nodeType === "rpc"){

                for (var j = 0; j < ele[i].attribute.length; j++) {

                    if(ele[i].attribute[j].nodeType == "list" || ele[i].attribute[j].nodeType == "container"){
                        for (var k = 0; k < store.Class.length; k++) {
                            var rpcclazz = store.Class[k];

                            if (rpcclazz.id == ele[i].attribute[j].type) {
                                ele[i].attribute[j].isAbstract = rpcclazz.isAbstract;

                                if (rpcclazz.type !== "Class") {
                                    ele[i].attribute[j].isleafRef = false;
                                    ele[i].attribute[j].isGrouping = true;
                                }

                                ele[i].attribute[j].isUsesNo = k;
                                ele[i].attribute[j].key = rpcclazz.key;
                                ele[i].attribute[j].keyid = rpcclazz.keyid;
                                ele[i].attribute[j].keyvalue = rpcclazz.keyvalue;

                            }
                        }

                    }

                    var pValue = ele[i].attribute[j];
                    for(var k = 0; k < store.Typedef.length; k++){
                        var typeDef = store.Typedef[k];
                        if(typeDef.id === pValue.type){
                            if(pValue.nodeType === "list"){
                                pValue.nodeType = "leaf-list";
                            }else{
                                pValue.nodeType = "leaf";
                            }
                            pValue.isUses = false;
                            if(typeDef.fileName === ele[i].fileName){
                                pValue.type = typeDef.name;
                            }else{
                                pValue.type = typeDef.fileName.split('.')[0] + ":" + typeDef.name;
                            }
                            break;
                        }
                    }

                    for(var k = 0; k < store.openModelAtt.length; k++){
                        var oma = store.openModelAtt[k];
                        if(oma.id === ele[i].attribute[j].id){
                            pValue.units = oma.units;
                            pValue.valueRange = oma.valueRange;
                            if(oma.condition){
                                for(var m = 0; m < feat.length; m++){
                                    if(feat[m].name === oma.condition && feat[m].fileName === oma.fileName){
                                        break;
                                    }
                                }
                                if(m === feat.length){
                                    feat.push(creators.createFeature(oma, ele[i].path));
                                    ele[i].attribute[j].support = feat[feat.length - 1].name;
                                }else{
                                    ele[i].attribute[j].support = feat[m].name;
                                }
                            }

                            if(oma.status){
                                ele[i].attribute[j].status = oma.status;
                            }

                            if(oma.passedByReference){
                                ele[i].attribute[j].isleafRef = true;
                            }
                            break;
                        }
                    }
                    if(pValue.isUses){
                        var name = pValue.type;
                        for(var k = 0; k < store.Class.length; k++){
                            var clazz = store.Class[k];
                            if(clazz.id === name){
                                pValue.isAbstract = clazz.isAbstract;
                                if(clazz.type !== "Class"){
                                    pValue.isGrouping = true;
                                }
                                if(i === k){
                                    var yangPathStatement = Util.handleNamespacePrefix(clazz.instancePath.split(":")[1], store.openModelStatement[ele[i].fileName].prefix)
                                    pValue.type = "leafref+path '/" + yangPathStatement + "'";
                                    if(clazz.isGrouping){
                                        pValue.type = "string";
                                    }
                                    if(pValue.nodeType === "list"){
                                        pValue.nodeType = "leaf-list";
                                    }
                                    else if(pValue.nodeType === "container"){
                                        pValue.nodeType = "leaf";
                                    }
                                    break;
                                } else {
                                    var Gname;
                                    clazz.Gname ? Gname = clazz.Gname : Gname = clazz.name;
                                    if (ele[i].fileName === clazz.fileName) {
                                        if (clazz.support) {
                                            pValue.isUses = new yangModels.Uses(Gname, clazz.support,'',config.withSuffix);
                                        } else {
                                            pValue.isUses = clazz.name;
                                            if(config.withSuffix){
                                                pValue.isUses+='-g';
                                            }

                                        }
                                        break;
                                    } else {
                                        var Gname;
                                        clazz.Gname ? Gname = clazz.Gname : Gname = clazz.name;
                                        if (clazz.support) {
                                            pValue.isUses = new yangModels.Uses(clazz.fileName.split('.')[0] + ":" + Gname, clazz.support,'',config.withSuffix)
                                        } else {
                                            pValue.isUses = clazz.fileName.split('.')[0] + ":" + Gname;
                                            //pValue.isUses = Class[k].name;
                                            if(config.withSuffix){
                                                pValue.isUses+='-g';
                                            }
                                        }
                                        pValue.key = clazz.key;
                                        pValue.keyid = clazz.keyid;
                                        pValue.keyvalue = clazz.keyvalue;
                                        break;
                                    }
                                }
                            }
                        }
                        if(k === store.Class.length){
                            pValue.nodeType === "list" ? ele[i].attribute[j].nodeType = "leaf-list" : pValue.nodeType = "leaf";
                            pValue.type = "string";
                        }
                    }
                    obj.buildChild(pValue, pValue.nodeType, pValue.rpcType);
                }
            }

            if(obj.nodeType === "container") {
                for (var k = 0; k < store.association.length; k++) {
                    var assoc = store.association[k];
                    if (ele[i].id === assoc.name) {
                        obj.nodeType = "list";
                        if(assoc.upperValue){
                            obj["max-elements"] = assoc.upperValue;
                        }
                        if(association[k].lowerValue){
                            obj["min-elements"] = assoc.lowerValue;
                        }
                        obj.nodeType = "list";
                        break;
                    }
                }

                if(k === store.association.length){
                    obj["ordered-by"] = undefined;
                }
            }

            //add the "obj" to module by attribute "path"
            var newobj;
            var rootFlag=0;
            var flag = true;
            for(var n=0; n < store.rootElement.length; n++){
                var re = store.rootElement[n];
                if(ele[i].id==re.id){
                    rootFlag=1;
                    flag=false;
                    var name,des,max,min;
                    if (re.name){
                    	name = re.name;
                    }else{
                    	name = ele[i].name;
                    }
                    if(re.description){
                        des = re.description;
                    }

                    if(re.multiplicity) {
                        min = re.multiplicity.split("..")[0];
                        max = re.multiplicity.split("..")[1];
                    }
                    newobj = new yangModels.Node(name, "", "container",max, min, obj.id, obj.config, obj["ordered-by"], undefined, undefined, ele[i].fileName);
                    newobj.key = obj.key;
                    newobj.keyid = obj.keyid;
                    newobj.keyvalue = obj.keyvalue;
                    if(config.withSuffix){
                        newobj.uses.push(obj.name+'-g');
                    }else{
                        newobj.uses.push(obj.name);
                    }

                    newobj.presence=des;
                    if(max && (max>1 || max=="*" )){
                        newobj.nodeType = "list";
                        newobj.presence="";
                    }

                    if(newobj.nodeType !== "list"){
                        newobj["ordered-by"] = undefined;
                    }
                    break;

                }
            }

            if(ele[i].nodeType === "notification"){
                newobj = new yangModels.Node(ele[i].name, undefined, "notification", undefined, undefined, obj.id, obj.config, obj["ordered-by"], undefined, undefined, ele[i].fileName);
                if(config.withSuffix){
                    newobj.uses.push(obj.name+'-g');
                }else{
                    newobj.uses.push(obj.name);
                }
            }
            if(flag && !ele[i].isGrouping){
                obj.name = ele[i].name;
            }
            if(ele[i].path === ""){
                for(var t = 0; t < store.yangModule.length; t++){
                    var ym = store.yangModule[t];

                    if(ele[i].fileName === ym.fileName){
                        if (ele[i].nodeType === "notification" ||rootFlag==1) {
                            ym.children.push(newobj);
                        }

                        ym.children.push(obj);
                        rootFlag=0;
                        break;
                    }
                }
            }

            var tempPath;
            for(var t = 0; t < store.packages.length; t++) {

                var package = store.packages[t];

                if (package.path === "") {
                    tempPath = package.name;
                } else {
                    tempPath = package.path + "-" + package.name
                }

                if (tempPath === ele[i].path && package.fileName === ele[i].fileName) {
                    //create a new node if "ele" needs to be instantiate
                    if (ele[i].nodeType === "notification" ||rootFlag==1) {
                        package.children.push(newobj);
                    }

                    if(package.name.toLowerCase()=="typedefinitions" && obj.name.match(/-d$|-t$/g)==null){
                        obj.name = Util.typeifyName(obj.name);
                    }

                    package.children.push(obj);
                    rootFlag=0;
                    break;
                }
            }
        }
        return feat;
    }
};
