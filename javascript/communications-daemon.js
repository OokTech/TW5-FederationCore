/*\
title: $:/plugins/Federation/FederationCore/communications-daemon.js
type: application/javascript
module-type: startup

This is the background process that is in charge of xmlhttprequests and handling responses from external sources.

\*/
(function () {

  /*jslint node: true, browser: true */
  /*global $tw: false */
  "use strict";

  // Export name and synchronous status
  exports.name = "communications-daemon";
  exports.platforms = ["browser"];
  exports.after = ["startup"];
  exports.synchronous = true;

  $tw.windowMessageHandlers = $tw.windowMessageHandlers || {};
  $tw.wiki.CommunicationsHandlerTypes = $tw.wiki.CommunicationsHandlerTypes || {};
  $tw.wiki.CommunicationsHandler = $tw.wiki.CommunicationsHandler || {};
  $tw.wiki.PendingCommunicationsRequest = 0;

  // Configuration tiddler
  const CONFIGURATION_TIDDLER = "$:/plugins/Federation/FederationCore/CommunicationsDaemonSettings";
  const configurationTiddler = $tw.wiki.getTiddler(CONFIGURATION_TIDDLER);

  //This function gets called whenever something is added to the communications queue or a response is heard from an outside source to a previous request.
  function ProcessCommunicationsQueue() {
    if (Object.keys($tw.wiki.event_queue).length !== 0) {
      //send the next request if there is one and no request is currently pending
      if ($tw.wiki.event_queue[Object.keys($tw.wiki.event_queue)[0]].data) {
        $tw.wiki.CommunicationsHandler['request_bundle']($tw.wiki.event_queue[Object.keys($tw.wiki.event_queue)[0]].data);
        delete $tw.wiki.event_queue[Object.keys($tw.wiki.event_queue)[0]];
      }
    }
  }

  function loadIFrame(url,callback) {
    // Check if iframe already exists
    let iframeInfo = $tw.browserMessaging.iframeInfoMap[url];
    if(iframeInfo) {
      // We've already got the iframe
      callback(null,iframeInfo);
    } else {
      // Create the iframe and save it in the list
      const iframe = document.createElement("iframe"),
        iframeInfo = {
          url: url,
          status: "loading",
          domNode: iframe
        };
      $tw.browserMessaging.iframeInfoMap[url] = iframeInfo;
      saveIFrameInfoTiddler(iframeInfo);
      // Add the iframe to the DOM and hide it
      iframe.style.display = "none";
      document.body.appendChild(iframe);
      // Set up onload
      iframe.onload = function() {
        iframeInfo.status = "loaded";
        saveIFrameInfoTiddler(iframeInfo);
        callback(null,iframeInfo);
      };
      iframe.onerror = function() {
        callback("Cannot load iframe");
      };
      try {
        iframe.src = url;
      } catch(ex) {
        callback(ex);
      }
    }
  }

  function saveIFrameInfoTiddler(iframeInfo) {
    $tw.wiki.addTiddler(new $tw.Tiddler($tw.wiki.getCreationFields(),{
      title: "$:/temp/ServerConnection/" + iframeInfo.url,
      text: iframeInfo.status,
      tags: ["$:/tags/ServerConnection"],
      url: iframeInfo.url
    },$tw.wiki.getModificationFields()));
  }

  exports.startup = function() {
    /*
    The new idea is that I make a worker that will use an xmlhttprequest to load the html of a remote wiki then when that is loaded it will pass that back to the page and the page will use the srcdoc attribute of an iframe to load the wiki, then it will use postMessage the same way as now. This may keep the browser from becoming unresponsive while fetching bundles from other wikis because the webworkers will take care of the heavy lifting. Or at least part of it.
    This doesn't work unless CORS things are properly set. They generally aren't so I can't do much with it.
    */

    /*
    This will be the object that holds the event queue information. It will hold pending requests to be sent. Requests will be added using the tm-send-request message and after being sent the daemon will wait for a response (or a timeout) before moving on to the next request. This is to prevent collisions from responses. It is probably better to create web workers to service each request so we can do multiple requests simultaneously (limit the number of simultaneous workers), but I need to make sure that web workers won't cause other problems by being created using blobs and data uris on https servers.

    The structure of each element should be {url, xmlhttprequest data} for  now, this may get updated later.
    */
    $tw.wiki.event_queue = $tw.wiki.event_queue || {};

    // Reset the values when any of the tiddlers change.
    $tw.rootWidget.addEventListener("tm-send-request",function(event) {
      //If the configuration changes do a full refresh, otherwise just refresh the changed expression.
      const paramObject = event.paramObject || {};
      const request_type = paramObject.request_type;

      if (request_type) {
        if (typeof $tw.wiki.CommunicationsHandlerTypes[request_type] === 'function') {
          $tw.wiki.CommunicationsHandlerTypes[request_type](event);
        } else {
          console.log('No handler exists for that type of request.');
        }
      } else {
        console.log('No request type given.');
      }
      ProcessCommunicationsQueue();
    });

    //With only one handler here this semes a bit clunky, but by making it this way we can have plugins add different event types that can be handled by the same extensible code without changing the core.
    $tw.wiki.CommunicationsHandlerTypes['request_bundle'] = function(event) {
      if ($tw.wiki.event_queue[event.paramObject.url]) {
        //There is already a queued request for that url. Ignore it for now to prevent repeated requests but we need to come up with a more elegant way to handle this in the future.
        console.log('There is already a request for that URL');
      } else {
        console.log('making a request to', event.paramObject.url)
        //The event is placed into the event queue object to be handled by the daemon
        $tw.wiki.event_queue[event.paramObject.url] = {'type':'request_bundle','data':event};
      }
    };

    //Is this where we should add a callback function to make things work better?
    //I think that the callback in loadIFrame takes care of anything that this would do.
    $tw.wiki.CommunicationsHandler['request_bundle'] = function(event) {
      const paramObject = event.paramObject || {},
        url = paramObject.url;
      if(url) {
        loadIFrame(url,function(err,iframeInfo) {
          if(err) {
            alert("Error loading tiddler bundle: " + url);
          } else {
            alert("Loaded Iframe")
            iframeInfo.domNode.contentWindow.postMessage({
              verb: "BUNDLE_REQUEST",
              filter: event.paramObject.filter,
              bundlename: event.paramObject.bundleName,
              separator: event.paramObject.separator,
              destination: url,
              bundleFunction: event.paramObject.bundleFunction,
            }, "*");
          }
        });
      }
    };
    console.log('ponato')
    window.addEventListener("message",function (event) {
      console.log('HERE')
      if (typeof $tw.windowMessageHandlers[event.data.verb] === 'function') {
        console.log('THERE')
        $tw.windowMessageHandlers[event.data.verb](event);
      }
    },false);
    console.log('potato')
  };
})();
