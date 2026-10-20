(function(){
  "use strict";
  var COLORS = window.ALCANTARA_COLOR_PROFILES || window.ALCANTARA_COLORS || [];
  var canvas = document.getElementById("imageCanvas");
  var ctx = canvas.getContext("2d", {willReadFrequently:true});
  var empty = document.getElementById("empty");
  var analyzeBtn = document.getElementById("analyzeBtn");
  var resetBtn = document.getElementById("resetBtn");
  var results = document.getElementById("results");
  var stats = document.getElementById("stats");
  var swatches = document.getElementById("swatches");
  var source = document.getElementById("source");
  var expectedCodeEl = document.getElementById("expectedCode");
  var expectedInput = document.getElementById("expectedInput");
  var saveExpectedBtn = document.getElementById("saveExpectedBtn");
  var exportLogBtn = document.getElementById("exportLogBtn");
  var clearLogBtn = document.getElementById("clearLogBtn");
  var evalStatus = document.getElementById("evalStatus");
  var logSummary = document.getElementById("logSummary");
  var image = null;
  var capture = null;
  var initialSelection = null;
  var selection = null;
  var dragging = false;
  var dragStart = null;
  var expectedCode = "";
  var expectedSource = "";
  var currentProfile = null;
  var currentMatches = null;
  var lastSavedSignature = "";

  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
  function rgbHex(rgb){ return "#"+rgb.map(function(v){return ("0"+Math.round(v).toString(16)).slice(-2);}).join("").toUpperCase(); }
  function esc(s){ return String(s || "").replace(/[&<>"]/g,function(m){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m];}); }
  function normalizeCode(s){
    var m=String(s || "").match(/\d{4}/);
    return m ? m[0] : "";
  }

  function rgb2lab(r,g,b){
    function f(c){ c/=255; return c>0.04045 ? Math.pow((c+0.055)/1.055,2.4) : c/12.92; }
    r=f(r); g=f(g); b=f(b);
    var X=r*0.4124+g*0.3576+b*0.1805;
    var Y=r*0.2126+g*0.7152+b*0.0722;
    var Z=r*0.0193+g*0.1192+b*0.9505;
    var xn=0.95047, yn=1, zn=1.08883;
    function k(t){ return t>0.008856 ? Math.cbrt(t) : 7.787*t+16/116; }
    var fx=k(X/xn), fy=k(Y/yn), fz=k(Z/zn);
    return [116*fy-16, 500*(fx-fy), 200*(fy-fz)];
  }

  function ciede2000(L1,a1,b1,L2,a2,b2){
    var rad=Math.PI/180, deg=180/Math.PI;
    var C1=Math.sqrt(a1*a1+b1*b1), C2=Math.sqrt(a2*a2+b2*b2), Cb=(C1+C2)/2;
    var G=0.5*(1-Math.sqrt(Math.pow(Cb,7)/(Math.pow(Cb,7)+Math.pow(25,7))));
    var a1p=(1+G)*a1, a2p=(1+G)*a2;
    var C1p=Math.sqrt(a1p*a1p+b1*b1), C2p=Math.sqrt(a2p*a2p+b2*b2);
    var h1p=Math.atan2(b1,a1p)*deg; if(h1p<0)h1p+=360;
    var h2p=Math.atan2(b2,a2p)*deg; if(h2p<0)h2p+=360;
    var dLp=L2-L1, dCp=C2p-C1p;
    var dhp=0; if(C1p*C2p!==0){ dhp=h2p-h1p; if(dhp>180)dhp-=360; else if(dhp<-180)dhp+=360; }
    var dHp=2*Math.sqrt(C1p*C2p)*Math.sin((dhp/2)*rad);
    var Lbp=(L1+L2)/2, Cbp=(C1p+C2p)/2, hbp;
    if(C1p*C2p===0){ hbp=h1p+h2p; }
    else{ hbp=h1p+h2p; if(Math.abs(h1p-h2p)>180){ if(h1p+h2p<360)hbp+=360; else hbp-=360; } hbp/=2; }
    var T=1-0.17*Math.cos((hbp-30)*rad)+0.24*Math.cos((2*hbp)*rad)+0.32*Math.cos((3*hbp+6)*rad)-0.20*Math.cos((4*hbp-63)*rad);
    var dTheta=30*Math.exp(-Math.pow((hbp-275)/25,2));
    var Rc=2*Math.sqrt(Math.pow(Cbp,7)/(Math.pow(Cbp,7)+Math.pow(25,7)));
    var Sl=1+(0.015*Math.pow(Lbp-50,2))/Math.sqrt(20+Math.pow(Lbp-50,2));
    var Sc=1+0.045*Cbp, Sh=1+0.015*Cbp*T, Rt=-Math.sin((2*dTheta)*rad)*Rc;
    return Math.sqrt(Math.pow(dLp/Sl,2)+Math.pow(dCp/Sc,2)+Math.pow(dHp/Sh,2)+Rt*(dCp/Sc)*(dHp/Sh));
  }

  function distLab(a,b){ return ciede2000(a[0],a[1],a[2],b[0],b[1],b[2]); }
  function percentile(sorted,p){ return sorted[Math.max(0, Math.min(sorted.length-1, Math.floor((sorted.length-1)*p)))]; }
  function median(vals){
    var a=vals.slice().sort(function(x,y){return x-y;});
    var mid=Math.floor(a.length/2);
    return a.length%2 ? a[mid] : (a[mid-1]+a[mid])/2;
  }
  function mean(vals){ return vals.reduce(function(a,b){return a+b;},0) / Math.max(1, vals.length); }
  function meanRgb(samples){
    var r=0,g=0,b=0;
    samples.forEach(function(s){ r+=s.r; g+=s.g; b+=s.b; });
    return [r/samples.length, g/samples.length, b/samples.length];
  }
  function medianRgb(samples){
    return [
      median(samples.map(function(s){return s.r;})),
      median(samples.map(function(s){return s.g;})),
      median(samples.map(function(s){return s.b;}))
    ];
  }

  function draw(showSelection){
    if(!image) return;
    if(showSelection === undefined) showSelection = true;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(image,0,0,canvas.width,canvas.height);
    if(showSelection && selection){
      ctx.save();
      ctx.strokeStyle="#F55139";
      ctx.lineWidth=Math.max(2, Math.round(canvas.width/700));
      ctx.strokeRect(selection.x,selection.y,selection.w,selection.h);
      ctx.restore();
    }
  }

  function pointerPos(ev){
    var r=canvas.getBoundingClientRect();
    return {
      x:clamp(Math.round((ev.clientX-r.left) * canvas.width / r.width),0,canvas.width),
      y:clamp(Math.round((ev.clientY-r.top) * canvas.height / r.height),0,canvas.height)
    };
  }

  function rectFrom(a,b){
    return {
      x:Math.min(a.x,b.x),
      y:Math.min(a.y,b.y),
      w:Math.abs(a.x-b.x),
      h:Math.abs(a.y-b.y)
    };
  }

  function collectSamples(rect){
    draw(false);
    var x=Math.max(0, Math.floor(rect.x));
    var y=Math.max(0, Math.floor(rect.y));
    var w=Math.max(1, Math.min(canvas.width-x, Math.floor(rect.w)));
    var h=Math.max(1, Math.min(canvas.height-y, Math.floor(rect.h)));
    var data=ctx.getImageData(x,y,w,h).data;
    var total=w*h;
    var step=Math.max(1, Math.floor(Math.sqrt(total/4200)));
    var samples=[];
    for(var yy=0; yy<h; yy+=step){
      for(var xx=0; xx<w; xx+=step){
        var i=(yy*w+xx)*4;
        if(data[i+3] < 245) continue;
        var r=data[i], g=data[i+1], b=data[i+2];
        var lab=rgb2lab(r,g,b);
        samples.push({r:r,g:g,b:b,lab:lab,L:lab[0]});
      }
    }
    return samples;
  }

  function trimSamples(samples){
    if(samples.length < 12) return samples;
    var Ls=samples.map(function(s){return s.L;}).sort(function(a,b){return a-b;});
    var lo=percentile(Ls,.08);
    var hi=percentile(Ls,.92);
    var byLight=samples.filter(function(s){return s.L>=lo && s.L<=hi;});
    var baseLab=rgb2lab.apply(null, medianRgb(byLight));
    var ds=byLight.map(function(s){return distLab(s.lab,baseLab);}).sort(function(a,b){return a-b;});
    var maxD=percentile(ds,.86);
    return byLight.filter(function(s){return distLab(s.lab,baseLab)<=maxD;});
  }

  function kmeansDominant(samples){
    if(samples.length < 3) return meanRgb(samples);
    var sorted=samples.slice().sort(function(a,b){return a.L-b.L;});
    var centers=[sorted[Math.floor(sorted.length*.2)].lab.slice(), sorted[Math.floor(sorted.length*.5)].lab.slice(), sorted[Math.floor(sorted.length*.8)].lab.slice()];
    var groups=[[],[],[]];
    for(var iter=0; iter<8; iter++){
      groups=[[],[],[]];
      samples.forEach(function(s){
        var best=0, bestD=Infinity;
        centers.forEach(function(c,i){
          var d=Math.pow(s.lab[0]-c[0],2)+Math.pow(s.lab[1]-c[1],2)+Math.pow(s.lab[2]-c[2],2);
          if(d<bestD){ bestD=d; best=i; }
        });
        groups[best].push(s);
      });
      centers=groups.map(function(g,i){
        if(!g.length) return centers[i];
        return [mean(g.map(function(s){return s.lab[0];})), mean(g.map(function(s){return s.lab[1];})), mean(g.map(function(s){return s.lab[2];}))];
      });
    }
    groups.sort(function(a,b){return b.length-a.length;});
    return meanRgb(groups[0].length ? groups[0] : samples);
  }

  function buildProfile(samples){
    var trimmed=trimSamples(samples);
    var medRgb=medianRgb(trimmed);
    var avgRgb=meanRgb(trimmed);
    var domRgb=kmeansDominant(trimmed);
    var anchors=[
      {label:"Median", rgb:medRgb, lab:rgb2lab(medRgb[0],medRgb[1],medRgb[2])},
      {label:"Trimmed mean", rgb:avgRgb, lab:rgb2lab(avgRgb[0],avgRgb[1],avgRgb[2])},
      {label:"Dominant cluster", rgb:domRgb, lab:rgb2lab(domRgb[0],domRgb[1],domRgb[2])}
    ];
    var medLab=anchors[0].lab;
    var spread=median(trimmed.map(function(s){return distLab(s.lab,medLab);}));
    return {rawCount:samples.length, keptCount:trimmed.length, anchors:anchors, spread:spread};
  }

  function nearestDistance(sampleLab, candidateLabs){
    var best=Infinity;
    candidateLabs.forEach(function(lab){
      var d=distLab(sampleLab,lab);
      if(d<best) best=d;
    });
    return best;
  }

  function candidateDistance(profile, c){
    var candidateLabs=(c.profileAnchors && c.profileAnchors.length)
      ? c.profileAnchors.map(function(a){return a.lab;})
      : [c.lab];
    var sampleMedian=profile.anchors[0].lab;
    var sampleMean=profile.anchors[1].lab;
    var sampleDominant=profile.anchors[2].lab;
    var dMedian=nearestDistance(sampleMedian,candidateLabs);
    var dMean=nearestDistance(sampleMean,candidateLabs);
    var dDominant=nearestDistance(sampleDominant,candidateLabs);
    var profilePenalty=c.profileSpread ? Math.min(10,c.profileSpread)*0.08 : 0;
    return dMedian*0.45 + dDominant*0.35 + dMean*0.20 + profilePenalty;
  }

  function matchProfile(profile){
    var arr=COLORS.map(function(c){
      var d=candidateDistance(profile,c);
      return {c:c,d:d};
    }).sort(function(a,b){return a.d-b.d;});
    var best=arr[0] ? arr[0].d : 99;
    var gap=arr[1] ? (arr[1].d-best) : 0;
    var spreadPenalty=Math.min(18, profile.spread) * .32;
    arr.forEach(function(m,i){
      var localGap=i===0 ? gap : Math.max(0, (arr[Math.min(i+1,arr.length-1)].d - m.d));
      m.confidence=Math.max(0, Math.min(99, Math.round((1 - m.d/22) * 78 + Math.min(10,localGap) * 1.6 - spreadPenalty)));
    });
    if(arr[0]){
      arr[0].confidence=Math.max(0, Math.min(99, Math.round((1 - best/20) * 82 + Math.min(12,gap) * 2 - spreadPenalty)));
    }
    return arr.slice(0,5);
  }

  function confClass(v){ return v>=70 ? "high" : (v>=42 ? "med" : "low"); }
  function confText(v){ return v>=70 ? "higher confidence" : (v>=42 ? "medium confidence" : "low confidence"); }

  function renderProfile(profile){
    stats.style.display="grid";
    stats.innerHTML =
      '<div class="stat"><b>Pixels sampled</b><span>'+profile.rawCount+'</span></div>'+
      '<div class="stat"><b>Pixels kept</b><span>'+profile.keptCount+'</span></div>'+
      '<div class="stat"><b>Texture spread</b><span>dE '+profile.spread.toFixed(1)+'</span></div>';
    swatches.style.display="grid";
    swatches.innerHTML = profile.anchors.map(function(a){
      var rgb=a.rgb.map(Math.round);
      return '<div class="swatch"><i style="background:'+rgbHex(rgb)+'"></i><div><b>'+esc(a.label)+'</b><br>'+rgbHex(rgb)+'</div></div>';
    }).join("");
  }

  function renderMatches(profile){
    var matches=matchProfile(profile);
    results.innerHTML = matches.map(function(m){
      var c=m.c;
      var isExpected=expectedCode && c.code === expectedCode;
      var label=(c.name ? esc(c.name)+" " : "Alcantara ") + esc(c.code);
      var apps=Array.isArray(c.apps) ? c.apps.join(", ") : "";
      var rs=c.rs && c.rsn && c.rsn.length ? " | Racesio: "+esc(c.rsn.join(" / ")) : "";
      var sources=c.profileSources ? " | official profiles: "+c.profileSources : "";
      return '<div class="match">'+
        '<div class="chip" style="background:'+esc(c.hex)+'"></div>'+
        '<div><div class="name">'+label+(isExpected?' <span class="pill hit">expected</span>':'')+'</div><div class="meta">'+esc(c.hex)+' | '+esc(apps)+rs+sources+' | profile dE '+m.d.toFixed(2)+'</div></div>'+
        '<div class="score"><b>'+m.confidence+'%</b><span class="'+confClass(m.confidence)+'">'+confText(m.confidence)+'</span></div>'+
      '</div>';
    }).join("");
    return matches;
  }

  function rankForExpected(matches){
    if(!expectedCode || !matches) return 0;
    for(var i=0;i<matches.length;i++){
      if(matches[i].c.code === expectedCode) return i+1;
    }
    return 0;
  }

  function setExpectedCode(code, sourceLabel){
    expectedCode = normalizeCode(code);
    expectedSource = sourceLabel || "";
    if(expectedCode){
      expectedCodeEl.innerHTML = '<span class="pill">'+esc(expectedCode)+'</span>' + (expectedSource ? ' <span class="mini">'+esc(expectedSource)+'</span>' : '');
      expectedInput.value = expectedCode;
    } else {
      expectedCodeEl.textContent = "Not detected";
    }
    updateEvaluationStatus();
  }

  function updateEvaluationStatus(){
    if(!currentMatches){
      evalStatus.textContent = expectedCode ? "Expected code is ready. The next analysis will be logged." : "No expected code detected yet. Enter the official code manually if needed.";
      return;
    }
    if(!expectedCode){
      evalStatus.innerHTML = '<span class="pill miss">not logged</span> No expected code detected. Enter the official code and click Save expected.';
      return;
    }
    var rank=rankForExpected(currentMatches);
    var top=currentMatches[0] ? currentMatches[0].c.code : "";
    var label=rank===1 ? "Top 1 hit" : (rank && rank<=3 ? "Top 3 hit" : (rank ? "Top 5 hit" : "miss"));
    var cls=rank && rank<=3 ? "hit" : "miss";
    evalStatus.innerHTML = '<span class="pill '+cls+'">'+label+'</span> expected '+esc(expectedCode)+', top result '+esc(top || "none");
  }

  function logRecord(reason){
    if(!expectedCode || !currentMatches || !currentProfile || !selection) return null;
    var rank=rankForExpected(currentMatches);
    return {
      version:"profile-logger-v1",
      reason:reason,
      expectedCode:expectedCode,
      expectedSource:expectedSource,
      detectedTargets:capture && capture.detectedTargets ? capture.detectedTargets : [],
      sourceUrl:capture ? capture.sourceUrl : "",
      captureCreatedAt:capture ? capture.createdAt : null,
      analyzedAt:Date.now(),
      selection:{x:selection.x,y:selection.y,w:selection.w,h:selection.h},
      sample:{
        rawCount:currentProfile.rawCount,
        keptCount:currentProfile.keptCount,
        spread:Number(currentProfile.spread.toFixed(3)),
        anchors:currentProfile.anchors.map(function(a){return {label:a.label,hex:rgbHex(a.rgb),lab:a.lab.map(function(v){return Number(v.toFixed(3));})};})
      },
      top:currentMatches.map(function(m,i){
        return {
          rank:i+1,
          code:m.c.code,
          name:m.c.name || "",
          confidence:m.confidence,
          d:Number(m.d.toFixed(4)),
          apps:m.c.apps || [],
          profileSources:m.c.profileSources || 0
        };
      }),
      hitRank:rank,
      top1Hit:rank===1,
      top3Hit:rank>0 && rank<=3,
      top5Hit:rank>0 && rank<=5
    };
  }

  function saveEvaluation(reason){
    var record=logRecord(reason);
    if(!record) return;
    var signature=[
      record.expectedCode,
      record.reason,
      record.selection.x,
      record.selection.y,
      record.selection.w,
      record.selection.h,
      record.top.map(function(x){return x.code;}).join("/")
    ].join("|");
    if(signature === lastSavedSignature) return;
    lastSavedSignature = signature;
    chrome.storage.local.get({acfEvaluationLog:[]}, function(data){
      var log=data.acfEvaluationLog || [];
      log.push(record);
      chrome.storage.local.set({acfEvaluationLog:log}, function(){
        renderLogSummary(log);
      });
    });
  }

  function renderLogSummary(log){
    log = log || [];
    if(!log.length){
      logSummary.textContent = "Log: 0 records.";
      return;
    }
    var top1=log.filter(function(x){return x.top1Hit;}).length;
    var top3=log.filter(function(x){return x.top3Hit;}).length;
    var top5=log.filter(function(x){return x.top5Hit;}).length;
    logSummary.textContent = "Log: "+log.length+" records. Top 1 "+top1+"/"+log.length+", Top 3 "+top3+"/"+log.length+", Top 5 "+top5+"/"+log.length+".";
  }

  function refreshLogSummary(){
    chrome.storage.local.get({acfEvaluationLog:[]}, function(data){
      renderLogSummary(data.acfEvaluationLog || []);
    });
  }

  function exportLog(){
    chrome.storage.local.get({acfEvaluationLog:[]}, function(data){
      var log=data.acfEvaluationLog || [];
      var blob=new Blob([JSON.stringify({exportedAt:Date.now(), records:log}, null, 2)], {type:"application/json"});
      var url=URL.createObjectURL(blob);
      var a=document.createElement("a");
      a.href=url;
      a.download="alcantara-area-picker-log-"+new Date().toISOString().slice(0,19).replace(/[:T]/g,"-")+".json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
    });
  }

  function analyze(){
    if(!image || !selection) return;
    if(selection.w < 8 || selection.h < 8){
      results.innerHTML='<div class="hint">Selection is too small. Pick a larger swatch area.</div>';
      return;
    }
    var samples=collectSamples(selection);
    if(samples.length < 12){
      results.innerHTML='<div class="hint">Not enough pixels in this area. Pick a larger swatch area.</div>';
      return;
    }
    var profile=buildProfile(samples);
    currentProfile=profile;
    renderProfile(profile);
    currentMatches=renderMatches(profile);
    updateEvaluationStatus();
    saveEvaluation("auto");
    draw();
  }

  function loadCapture(payload){
    capture=payload;
    setExpectedCode(payload.expectedCode || "", payload.expectedCode ? "auto detected" : "");
    image=new Image();
    image.onload=function(){
      canvas.width=image.naturalWidth;
      canvas.height=image.naturalHeight;
      canvas.style.display="block";
      empty.style.display="none";
      var sx=canvas.width / Math.max(1, capture.viewport.width);
      var sy=canvas.height / Math.max(1, capture.viewport.height);
      initialSelection={
        x:Math.round(capture.rect.left*sx),
        y:Math.round(capture.rect.top*sy),
        w:Math.round(capture.rect.width*sx),
        h:Math.round(capture.rect.height*sy)
      };
      selection={
        x:initialSelection.x,
        y:initialSelection.y,
        w:initialSelection.w,
        h:initialSelection.h
      };
      if(capture.sourceUrl){
        var targets=(capture.detectedTargets || []).map(function(t){return t.code;}).join(", ");
        source.textContent = "Source: " + capture.sourceUrl + (targets ? " | detected candidates: " + targets : "");
      }
      draw();
      analyze();
    };
    image.src=payload.dataUrl;
  }

  analyzeBtn.addEventListener("click", analyze);
  resetBtn.addEventListener("click", function(){
    if(!initialSelection) return;
    selection={
      x:initialSelection.x,
      y:initialSelection.y,
      w:initialSelection.w,
      h:initialSelection.h
    };
    draw();
    analyze();
  });
  saveExpectedBtn.addEventListener("click", function(){
    var code=normalizeCode(expectedInput.value);
    setExpectedCode(code, code ? "manual" : "");
    if(currentMatches) {
      currentMatches=renderMatches(currentProfile);
      updateEvaluationStatus();
      saveEvaluation("manual");
    }
  });
  expectedInput.addEventListener("keydown", function(ev){
    if(ev.key === "Enter") saveExpectedBtn.click();
  });
  exportLogBtn.addEventListener("click", exportLog);
  clearLogBtn.addEventListener("click", function(){
    chrome.storage.local.set({acfEvaluationLog:[]}, function(){
      lastSavedSignature = "";
      renderLogSummary([]);
    });
  });

  canvas.addEventListener("pointerdown", function(ev){
    if(!image) return;
    dragging=true;
    dragStart=pointerPos(ev);
    selection={x:dragStart.x,y:dragStart.y,w:1,h:1};
    canvas.setPointerCapture(ev.pointerId);
    draw();
  });
  canvas.addEventListener("pointermove", function(ev){
    if(!dragging || !dragStart) return;
    selection=rectFrom(dragStart,pointerPos(ev));
    draw();
  });
  canvas.addEventListener("pointerup", function(ev){
    if(!dragging) return;
    dragging=false;
    canvas.releasePointerCapture(ev.pointerId);
    if(selection && selection.w >= 8 && selection.h >= 8) analyze();
  });

  chrome.storage.local.get("acfAreaCapture", function(data){
    if(!data || !data.acfAreaCapture){
      results.innerHTML='<div class="hint">No capture found. Go to alcantara.com, open the extension, and pick an area.</div>';
      return;
    }
    loadCapture(data.acfAreaCapture);
  });
  refreshLogSummary();
})();
