chrome.runtime.onMessage.addListener(function(message, sender, sendResponse){
  if(!message || message.type !== "ACF_AREA_SELECTED") return;

  var windowId = sender && sender.tab ? sender.tab.windowId : undefined;
  chrome.tabs.captureVisibleTab(windowId, {format:"png"}, function(dataUrl){
    if(chrome.runtime.lastError || !dataUrl){
      sendResponse({ok:false, error:chrome.runtime.lastError ? chrome.runtime.lastError.message : "Capture failed"});
      return;
    }
    var payload = {
      dataUrl:dataUrl,
      rect:message.rect,
      expectedCode:message.expectedCode || "",
      detectedTargets:message.detectedTargets || [],
      viewport:message.viewport,
      dpr:message.dpr,
      sourceUrl:sender && sender.tab ? sender.tab.url : "",
      createdAt:Date.now()
    };
    chrome.storage.local.set({acfAreaCapture:payload}, function(){
      chrome.tabs.create({url:chrome.runtime.getURL("picker.html")}, function(){
        sendResponse({ok:true});
      });
    });
  });
  return true;
});
