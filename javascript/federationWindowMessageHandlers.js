/*\
title: $:/plugins/Federation/FederationCore/federationWindowMessageHandlers.js
type: application/javascript
module-type: utils

These are functions that handle messages that are sent using the postMessage
function to communicate across the iframe boundary.

This can be extended by creating a plugin that has more functions. Use this
file as the template and changing the names as appropriate.

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

exports.name = "federationWindowMessageHandlers";
exports.platforms = ["browser"];
exports.before = ["browser-messaging"];
exports.synchronous = true;

function closeIFrame(url) {
  const iframe = document.body.getElementsByTagName('iframe');
  for (let j = 0; j < iframe.length; j++) {
    if (iframe[j].src === url) {
      document.body.removeChild(iframe[j]);
      $tw.browserMessaging.iframeInfoMap[url] = null;
    }
  }
}

$tw.windowMessageHandlers = $tw.windowMessageHandlers || {};
$tw.bundleHandler = $tw.bundleHandler || {};

$tw.windowMessageHandlers.BUNDLE_REQUEST = function (event) {
  if (event.data.bundleFunction) {
    const bundleFunction = $tw.wiki.bundleFunction[event.data.bundleFunction];
    if (typeof bundleFunction === "function") {
      bundleFunction(event, 'Ok');
    } else {
      //If an invalid is given use the default function
      $tw.wiki.bundleFunction.bundleTiddlers(event, 'invalid bundle function given, using default function as fallback. Bundle function: ' + event.data.bundleFunction);
    }
  } else {
    //If no bundleFunction is given use the default function
    $tw.wiki.bundleFunction.bundleTiddlers(event, 'no bundle function given, used default.');
  }
}

$tw.windowMessageHandlers.DELIVER_BUNDLE = function (event) {
  event.data = event.data || {};
  event.data.bundle = event.data.bundle || {};
  if (event.data.bundle.handler) {
    $tw.bundleHandler[event.data.bundle.handler](event)
  } else {
    $tw.bundleHandler['default'](event)
  }
  closeIFrame(event.data.origin);
}

/*
  The default bundle handler
*/
$tw.bundleHandler.default = function(event) {
  //Check to see if the bundle is empty, if so don't save it
  if (event.data.bundle.text != '' && event.data.bundle.list != '') {
    //If the source isn't recognized than set the tiddler as plain text and marke it as having an unrecognized source.
    event.data.bundle.type = 'text/plain';
    event.data.bundle.source = 'unrecognized';
    event.data.bundle.title = event.data.bundle.title + ' - ' + event.data.origin;
    $tw.wiki.addTiddler(new $tw.Tiddler(event.data.bundle));
    //We need to create the history tiddler even if we don't have a recognized source.
    let historyTiddler = $tw.wiki.getTiddler('$:/FetchHistory/' + event.data.origin);
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
  }
  $tw.wiki.addTiddler(new $tw.Tiddler($tw.wiki.getCreationFields(),{title: '$:/TiddlerBundleData/' + event.data.bundle.title, list: event.data.bundle.list, text: "Source: {{!!source}}<br>Tiddlers: <$list filter='[list[]]'><$link to=<<currentTiddler>>><$view field='title'/></$link>, </$list>", tags: '$:/tags/TiddlerBundle', source: event.origin}));
}

})();
