/*\
title: $:/plugins/Federation/FederationCore/bundleOptions.js
type: application/javascript
module-type: utils

These are functions that define how tiddlers are bundled when a tiddler bundle is requested.
bundleTiddlers is the default one. The function should create the Bundle object which is added as a tiddler in the receiving wiki.

If you want to add more options without chaing this you can create a new tiddler, just copy this one, change the title, the title listed in the first line at the top and replace
the function bundleTiddlers with your function. This way we can have multiple plugins use the same communication mechanism without all having to modify the smae tiddlers to work.

You can use this as a function template:

For new ones just use $tw.wiki.functionName = function (event) {
  <<function Content>>
  event.source.postMessage({verb:"DELIVER_BUNDLE", bundle: Bundle, origin: event.data.destination},"*");
}

\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

exports.name = "bundleOptions";
exports.platforms = ["browser"];
exports.before = ["browser-messaging"];
exports.synchronous = true;

$tw.wiki.bundleHandler = $tw.wiki.bundleHandler || {};
$tw.wiki.bundleFunction = $tw.wiki.bundleFunction || {};

$tw.wiki.bundleHandler.full = function(event) {
  const creationFields = $tw.wiki.getCreationFields();
  event.data.bundle.title = event.data.bundle.title + ' - ' + event.data.origin;
  $tw.wiki.addTiddler(new $tw.Tiddler(creationFields, event.data.bundle));
  const historyTiddler = $tw.wiki.getTiddler('$:/FetchHistory/' + event.data.origin);
  let newText = {};
  if (historyTiddler) {
    newText = JSON.parse(historyTiddler.fields.text);
    newText[event.data.filter] = event.data.bundle.most_recent ? event.data.bundle.most_recent:'0';
  } else {
    newText[event.data.filter] = event.data.bundle.most_recent ? event.data.bundle.most_recent:'0';
    historyTiddler = {
      title: '$:/FetchHistory/' + event.data.origin,
      type: 'application/json',
      text: ''
    };
  }
  $tw.wiki.addTiddler(new $tw.Tiddler(historyTiddler, {text: JSON.stringify(newText)}));
};

$tw.wiki.bundleFunction.bundleTiddlers = function(event, status_message) {
  const status = status_message || '';
  const separator = event.data.separator ? event.data.separator : '<!-- TIDDLER SEPARATOR --!>';
  const bundleFilter = event.data.filter ? event.data.filter : '[is[system]!is[system]]';
  const bundleTitle = event.data.bundlename ? event.data.bundlename : "Default Bundle";
  const bundleList = [];
  const bundleTiddlers = $tw.wiki.filterTiddlers(bundleFilter);
  for (let i = 0; i < bundleTiddlers.length; i++) {
    bundleTiddlers[i] = decodeURI(bundleTiddlers[i]);
  }
  let bundleText = '';
  for (let i = 0; i < bundleTiddlers.length; i++) {
    const currentBundleTiddler = this.wiki.getTiddler(decodeURI(bundleTiddlers[i]));
    // Make the tiddler text and escape any places the separator strings
    // shows up in the tiddler.
    const tidText = (currentBundleTiddler.getFieldStringBlock({exclude: ["text"]}) + (!!currentBundleTiddler.fields.text ? "\n\n" + currentBundleTiddler.fields.text : "")).replace(separator, '\'+separator)
    bundleText += tidText + '\n' + separator + '\n';
  }
  const Bundle = {
    title: bundleTitle,
    text: bundleText,
    list: $tw.utils.stringifyList(bundleList),
    tags: '[[Tiddler Bundle]]',
    separator: separator,
    type: 'text/plain',
    status: status,
    origin: event.data.destination,
    bundle_function: event.data.bundleFunction,
    unbundle_function: 'full',
    filter: bundleFilter,
    bundle_size: bundleTiddlers.length
  };
  const messageObject = {
    verb:"DELIVER_BUNDLE",
    bundle: Bundle,
    origin: event.data.destination,
    type: 'full',
    filter: bundleFilter
  };
  event.source.postMessage(messageObject,"*");
};

$tw.wiki.bundleFunction.JSONBundle = function(event, status_message) {
  const status = status_message || '';
  const separator = event.data.separator ? event.data.separator : '<!-- TIDDLER SEPARATOR --!>';
  const bundleFilter = event.data.filter ? event.data.filter : '[is[system]!is[system]]';
  const bundleTitle = event.data.bundlename ? event.data.bundlename : "JSON Bundle";
  const bundleTiddlers = $tw.wiki.filterTiddlers(bundleFilter);
  for (let i = 0; i < bundleTiddlers.length; i++) {
    bundleTiddlers[i] = decodeURI(bundleTiddlers[i]);
  }
  const bundleObject = {};
  for (let i = 0; i < bundleTiddlers.length; i++) {
    bundleObject[bundleTiddlers[i]] = $tw.wiki.getTiddler(decodeURI(bundleTiddlers[i]));
  };
  const Bundle = {
    title: bundleTitle,
    text: JSON.stringify(bundleObject, null, 2),
    list: $tw.utils.stringifyList(bundleTiddlers),
    tags: '[[JSON Bundle]]',
    separator: separator,
    type: 'text/plain',
    status: status,
    bundle_size: bundleTiddlers.length
  };
  const messageObject = {
    verb:"DELIVER_BUNDLE",
    bundle: Bundle,
    origin: event.data.destination,
    type: 'JSON Bundle'
  };
  event.source.postMessage(messageObject,"*");
};

})();
