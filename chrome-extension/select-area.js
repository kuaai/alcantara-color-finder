(function(){
  "use strict";
  if(window.__acfAreaPickerActive) return;
  window.__acfAreaPickerActive = true;

  var overlay = document.createElement("div");
  var box = document.createElement("div");
  var label = document.createElement("div");
  var start = null;
  var current = null;
  var dragging = false;

  overlay.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:2147483647",
    "cursor:crosshair",
    "background:transparent",
    "user-select:none"
  ].join(";");

  box.style.cssText = [
    "position:fixed",
    "display:none",
    "border:2px solid #F55139",
    "background:transparent",
    "box-shadow:none",
    "pointer-events:none"
  ].join(";");

  label.textContent = "Drag over one Alcantara swatch. Press Esc to cancel.";
  label.style.cssText = [
    "position:fixed",
    "left:50%",
    "top:18px",
    "transform:translateX(-50%)",
    "background:#111",
    "color:#fff",
    "font:13px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif",
    "padding:8px 11px",
    "border-radius:8px",
    "box-shadow:0 8px 24px rgba(0,0,0,.25)",
    "pointer-events:none"
  ].join(";");

  document.documentElement.appendChild(overlay);
  document.documentElement.appendChild(box);
  document.documentElement.appendChild(label);

  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
  function pos(ev){
    return {
      x:clamp(ev.clientX,0,window.innerWidth),
      y:clamp(ev.clientY,0,window.innerHeight)
    };
  }
  function rectFrom(a,b){
    return {
      left:Math.min(a.x,b.x),
      top:Math.min(a.y,b.y),
      width:Math.abs(a.x-b.x),
      height:Math.abs(a.y-b.y)
    };
  }
  function draw(rect){
    box.style.display = "block";
    box.style.left = rect.left + "px";
    box.style.top = rect.top + "px";
    box.style.width = rect.width + "px";
    box.style.height = rect.height + "px";
  }
  function cleanup(){
    window.__acfAreaPickerActive = false;
    overlay.remove();
    box.remove();
    label.remove();
    window.removeEventListener("keydown", onKey, true);
  }
  function codeFromText(text){
    var value=String(text || "");
    var tail=value.split(/[?#]/)[0].split("/").pop();
    var m=tail.match(/^(\d{4})(?=[._-]|$)/);
    if(!m) m=value.match(/\b(\d{4})\b/);
    return m ? m[1] : null;
  }
  function overlap(a,b){
    var left=Math.max(a.left,b.left);
    var top=Math.max(a.top,b.top);
    var right=Math.min(a.left+a.width,b.left+b.width);
    var bottom=Math.min(a.top+a.height,b.top+b.height);
    if(right<=left || bottom<=top) return 0;
    return (right-left)*(bottom-top);
  }
  function detectOfficialTargets(rect){
    var found=[];
    Array.prototype.forEach.call(document.images || [], function(img){
      var r=img.getBoundingClientRect();
      var score=overlap(rect,{left:r.left,top:r.top,width:r.width,height:r.height});
      if(!score) return;
      var fields=[
        img.currentSrc,
        img.src,
        img.getAttribute("data-src"),
        img.getAttribute("data-lazy-src"),
        img.getAttribute("srcset"),
        img.alt,
        img.title
      ];
      var code=null;
      for(var i=0;i<fields.length && !code;i++) code=codeFromText(fields[i]);
      if(!code) return;
      found.push({
        code:code,
        overlap:Math.round(score),
        source:img.currentSrc || img.src || img.alt || ""
      });
    });
    found.sort(function(a,b){return b.overlap-a.overlap;});
    var seen={};
    return found.filter(function(item){
      if(seen[item.code]) return false;
      seen[item.code]=true;
      return true;
    }).slice(0,5);
  }
  function finish(rect){
    var detectedTargets=detectOfficialTargets(rect);
    cleanup();
    var payload={
      type:"ACF_AREA_SELECTED",
      rect:rect,
      expectedCode:detectedTargets[0] ? detectedTargets[0].code : "",
      detectedTargets:detectedTargets,
      viewport:{width:window.innerWidth,height:window.innerHeight},
      dpr:window.devicePixelRatio || 1
    };
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        chrome.runtime.sendMessage(payload);
      });
    });
  }
  function onKey(ev){
    if(ev.key === "Escape"){
      ev.preventDefault();
      cleanup();
    }
  }

  overlay.addEventListener("mousedown", function(ev){
    if(ev.button !== 0) return;
    ev.preventDefault();
    dragging = true;
    start = pos(ev);
    current = start;
    draw(rectFrom(start,current));
  }, true);

  overlay.addEventListener("mousemove", function(ev){
    if(!dragging) return;
    ev.preventDefault();
    current = pos(ev);
    draw(rectFrom(start,current));
  }, true);

  overlay.addEventListener("mouseup", function(ev){
    if(!dragging) return;
    ev.preventDefault();
    dragging = false;
    current = pos(ev);
    var rect = rectFrom(start,current);
    if(rect.width < 8 || rect.height < 8){
      cleanup();
      return;
    }
    finish(rect);
  }, true);

  window.addEventListener("keydown", onKey, true);
})();
