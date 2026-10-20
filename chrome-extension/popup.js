(function(){
  "use strict";
  var btn = document.getElementById("startBtn");
  var status = document.getElementById("status");

  function setStatus(text){ status.textContent = text || ""; }

  btn.addEventListener("click", function(){
    btn.disabled = true;
    setStatus("Waiting for page selection...");
    chrome.tabs.query({active:true,currentWindow:true}, function(tabs){
      var tab = tabs && tabs[0];
      if(!tab || !tab.id){
        btn.disabled = false;
        setStatus("No active tab found.");
        return;
      }
      chrome.scripting.executeScript({target:{tabId:tab.id}, files:["select-area.js"]}, function(){
        if(chrome.runtime.lastError){
          btn.disabled = false;
          setStatus(chrome.runtime.lastError.message || "Could not start picker on this page.");
          return;
        }
        setStatus("Drag a rectangle on the page.");
        setTimeout(function(){ window.close(); }, 450);
      });
    });
  });
})();
