/*\
title: $:/plugins/Federation/FederationCore/action-tiddlerbundle.js
type: application/javascript
module-type: widget

$filter and $unpackFilter should be combined since the widget will always either unpack of pack something, never both.

Usage:

<$action-tiddlerbundle $bundle=BundleName $filter= $overwrite= $separator= $action= $unpackFilter= $type=/>

|!Parameter |!Description |
|$bundle |The name of the bundle, either for bundle creation or to select which bundle to unpack. (No default)|
|$filter |The filter used to select which tiddlers are put into the bundle if making a bundle, or which tiddlers to unpack if unpacking a bundle (No default)|
|$overwrite |Set this to `true` to overwrite existing tiddlers from the bundle, set to `false` to leave existing tiddlers unaffected. (Default: `false`)|
|$separator |The separator string used between tiddlers in the bundle. (Default: `<!-- TIDDLER SEPARATOR --!>`) |
|$action |Pack (create bundle) or unpack (unpack tiddlers) (Default: `Pack`)|
|$type |`Tiddler` or `JSON` (Default: `Tiddler`) |
|$delete |When unpacking a bundle, if this is set to `true` the bundle will be deleted after it is unpacked. (default: `false`) |

\*/

(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

const Widget = require("$:/core/modules/widgets/widget.js").widget;

const ActionTiddlerBundle = function(parseTreeNode,options) {
  this.initialise(parseTreeNode,options);
};

/*
Inherit from the base widget class
*/
ActionTiddlerBundle.prototype = new Widget();

/*
Render this widget into the DOM
*/
ActionTiddlerBundle.prototype.render = function(parent,nextSibling) {
  this.computeAttributes();
  this.execute();
};

/*
Compute the internal state of the widget
*/
ActionTiddlerBundle.prototype.execute = function() {
  this.actionBundle = this.getAttribute("$bundle");
  this.filter = this.getAttribute("$filter");
  this.actionOverwrite = this.getAttribute("$overwrite", false);
  this.actionSeparator = this.getAttribute("$separator");
  this.actionAction = this.getAttribute("$action", "pack");
  this.bundleType = this.getAttribute("$type", "Tiddler");
  this.deleteBundle = this.getAttribute("$delete", "false");
  this.useImport = this.getAttribute("$useImport", false);
};

/*
Refresh the widget by ensuring our attributes are up to date
*/
ActionTiddlerBundle.prototype.refresh = function(changedTiddlers) {
  const changedAttributes = this.computeAttributes();
  if(Object.keys(changedAttributes).length > 0) {
    this.refreshSelf();
    return true;
  }
  return this.refreshChildren(changedTiddlers);
};

/*
Invoke the action associated with this widget
*/
ActionTiddlerBundle.prototype.invokeAction = function(triggeringWidget,event) {
  let separator;
  if (this.actionSeparator) {
    separator = this.actionSeparator;
  } else {
    separator = '<!-- TIDDLER SEPARATOR --!>'
  }

  if (this.actionAction === 'pack') {
    const bundleType = this.bundleType ? this.bundleType:'Tiddler';
    const bundleFilter = this.filter;
    const bundleTiddlers = this.wiki.filterTiddlers(bundleFilter);
    let bundleText = '';
    const bundleObject = {};
    for (var i = 0; i < bundleTiddlers.length; i++) {
      if (this.bundleType === "JSON") {
        const currentBundleTiddler = this.wiki.getTiddler(decodeURI(bundleTiddlers[i]));
        bundleObject[bundleTiddlers[i]] = currentBundleTiddler;
      } else {
        const currentBundleTiddler = this.wiki.getTiddler(decodeURI(bundleTiddlers[i]));
        // Make the tiddler text and escape any places the separator strings
        // shows up in the tiddler.
				const re = new RegExp(separator, 'g')
        const tidText = (currentBundleTiddler.getFieldStringBlock({exclude: ["text"]}) + (!!currentBundleTiddler.fields.text ? "\n\n" + currentBundleTiddler.fields.text : "")).replace(re, '\\'+separator)
        bundleText += tidText + '\n' + separator + '\n';
      }
    }
    if (this.bundleType === "JSON") {
      bundleText = JSON.stringify(bundleObject, null, 2);
    }
    const fields = {
      title: this.actionBundle,
      text: bundleText,
      list: $tw.utils.stringifyList(bundleTiddlers),
      tags: '[[Tiddler Bundle]]',
      separator: separator,
      bundle_type: bundleType,
      bundle_name: this.actionBundle,
      type: 'text/plain'
    };
    this.wiki.addTiddler(fields);
  } else if (this.actionAction === 'unpack') {
    const self = this
    const filterOutput = this.filter ? true:false;
    const unpackList = (filterOutput)? this.wiki.filterTiddlers(this.filter): []
    const tiddler = $tw.wiki.getTiddler(this.actionBundle);
    if (tiddler) {
      //Get the raw text for the bundle.
      const bundleText = tiddler.getFieldString('text');
      if (tiddler.fields.bundle_type === 'JSON') {
        const bundleObject = JSON.parse(tiddler.fields.text);
        for (let tiddlerName in bundleObject) {
          if (filterOutput === false || (unpackList.indexOf(tiddlerName) !== -1)) {
            if (self.actionOverwrite || !self.wiki.getTiddler(tiddlerName)) {
              if (self.useImport) {
                $tw.wiki.importTiddler(new $tw.Tiddler(bundleObject[tiddlerName].fields));
              } else {
                self.wiki.addTiddler(new $tw.Tiddler(bundleObject[tiddlerName].fields));
              }
            }
          }
        }
      } else {
        //Get the raw text for each tiddler.
        const rawBundleTiddlers = bundleText.split('\n' + separator + '\n');
        //Create a tiddler from each tiddler. Only overwrite existing tiddlers if this.actionOverwrite is true
        for (let i = 0; i < rawBundleTiddlers.length; i++) {
          if (rawBundleTiddlers[i].trim() !== '') {
						const re = new RegExp('\\\\' + separator, 'g')
            const tiddlers = this.wiki.deserializeTiddlers('.tid',rawBundleTiddlers[i].replace(re,separator));
            $tw.utils.each(tiddlers,function(tiddler) {
              if (filterOutput === false || (unpackList.indexOf(tiddler.title) !== -1)) {
                if (self.actionOverwrite || !self.wiki.getTiddler(tiddler.title)) {
                  if (self.useImport) {
                    $tw.wiki.importTiddler(new $tw.Tiddler(tiddler));
                  } else {
                    self.wiki.addTiddler(new $tw.Tiddler(tiddler));
                  }
                }
              }
            });
          }
        }
      }
      if (this.deleteBundle === 'true') {
        this.wiki.deleteTiddler(this.actionBundle)
      }
    }
  }
  return true; // Action was invoked
};

exports["action-tiddlerbundle"] = ActionTiddlerBundle;

})();
