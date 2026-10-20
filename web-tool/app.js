/* Alcantara Color Finder, shared matching + UI. Works on the website page and in the Chrome extension popup. */
(function () {
  "use strict";
  function rbase(){ return (typeof window.RACESIO_BASE==="string") ? window.RACESIO_BASE : "https://racesio.com"; }
  var COLORS = window.ALCANTARA_COLORS || [];

  // ---- color math ----
  function rgb2lab(r, g, b) {
    function f(c){c/=255;return c>0.04045?Math.pow((c+0.055)/1.055,2.4):c/12.92;}
    r=f(r);g=f(g);b=f(b);
    var X=r*0.4124+g*0.3576+b*0.1805, Y=r*0.2126+g*0.7152+b*0.0722, Z=r*0.0193+g*0.1192+b*0.9505;
    var xn=0.95047,yn=1,zn=1.08883;
    function k(t){return t>0.008856?Math.cbrt(t):7.787*t+16/116;}
    var fx=k(X/xn),fy=k(Y/yn),fz=k(Z/zn);
    return [116*fy-16,500*(fx-fy),200*(fy-fz)];
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
    var dhp=0; if(C1p*C2p!==0){dhp=h2p-h1p; if(dhp>180)dhp-=360; else if(dhp<-180)dhp+=360;}
    var dHp=2*Math.sqrt(C1p*C2p)*Math.sin((dhp/2)*rad);
    var Lbp=(L1+L2)/2, Cbp=(C1p+C2p)/2, hbp;
    if(C1p*C2p===0){hbp=h1p+h2p;}
    else{hbp=h1p+h2p; if(Math.abs(h1p-h2p)>180){if(h1p+h2p<360)hbp+=360;else hbp-=360;} hbp/=2;}
    var T=1-0.17*Math.cos((hbp-30)*rad)+0.24*Math.cos((2*hbp)*rad)+0.32*Math.cos((3*hbp+6)*rad)-0.20*Math.cos((4*hbp-63)*rad);
    var dTheta=30*Math.exp(-Math.pow((hbp-275)/25,2));
    var Rc=2*Math.sqrt(Math.pow(Cbp,7)/(Math.pow(Cbp,7)+Math.pow(25,7)));
    var Sl=1+(0.015*Math.pow(Lbp-50,2))/Math.sqrt(20+Math.pow(Lbp-50,2));
    var Sc=1+0.045*Cbp, Sh=1+0.015*Cbp*T, Rt=-Math.sin((2*dTheta)*rad)*Rc;
    return Math.sqrt(Math.pow(dLp/Sl,2)+Math.pow(dCp/Sc,2)+Math.pow(dHp/Sh,2)+Rt*(dCp/Sc)*(dHp/Sh));
  }
  function quality(d){ if(d<2)return["Very close","q-vc"]; if(d<5)return["Close","q-c"]; if(d<10)return["Near","q-n"]; return["Rough match","q-r"]; }

  function match(rgb, n){
    var lab=rgb2lab(rgb[0],rgb[1],rgb[2]);
    var arr=COLORS.map(function(c){ return {c:c, d:ciede2000(lab[0],lab[1],lab[2],c.lab[0],c.lab[1],c.lab[2])}; });
    arr.sort(function(x,y){return x.d-y.d;});
    return arr.slice(0, n||5);
  }

  // ---- rendering ----
  function esc(s){return (s||"").replace(/[&<>"]/g,function(m){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m];});}
  function renderResults(rgb, host){
    var matches=match(rgb,5);
    var html='<div class="acf-picked"><span class="acf-chip" style="background:rgb('+rgb.join(",")+')"></span>'+
             '<span>You picked <b>'+rgbHex(rgb)+'</b></span></div>'+
             '<div class="acf-list">';
    matches.forEach(function(m,i){
      var c=m.c, q=quality(m.d), label=c.name?esc(c.name)+' '+c.code:'Alcantara '+c.code;
      var rsName=c.rsn&&c.rsn.length?(' · Racesio: '+esc(c.rsn.join(" / "))):'';
      html+='<div class="acf-item'+(i===0?' acf-top':'')+'">'+
              '<span class="acf-chip" style="background:'+c.hex+'"></span>'+
              '<div class="acf-meta"><div class="acf-name">'+label+'</div>'+
              '<div class="acf-sub">'+c.hex+' · '+esc(c.apps.join(", "))+rsName+'</div></div>'+
              '<span class="acf-q '+q[1]+'">'+q[0]+'</span>'+
              (c.rs?'<a class="acf-buy" target="_blank" rel="noopener" href="'+rbase()+'/search?q='+encodeURIComponent(c.code)+'">View on Racesio →</a>':'')+
            '</div>';
    });
    html+='</div>';
    host.innerHTML=html;
  }
  function rgbHex(rgb){return "#"+rgb.map(function(v){return ("0"+v.toString(16)).slice(-2);}).join("").toUpperCase();}

  // ---- inputs ----
  function initEyeDropper(btn, onPick){
    if(!window.EyeDropper){ btn.disabled=true; btn.title="Your browser doesn't support screen color picking, use image upload instead."; btn.classList.add("acf-disabled"); return; }
    btn.addEventListener("click", function(){
      var ed=new window.EyeDropper();
      ed.open().then(function(res){
        var m=res.sRGBHex.match(/#(..)(..)(..)/); onPick([parseInt(m[1],16),parseInt(m[2],16),parseInt(m[3],16)]);
      }).catch(function(){});
    });
  }
  function initImage(fileInput, canvas, onPick){
    var ctx=canvas.getContext("2d",{willReadFrequently:true});
    fileInput.addEventListener("change", function(e){
      var f=e.target.files[0]; if(!f)return;
      var img=new Image();
      img.onload=function(){
        var maxW=420, sc=Math.min(1,maxW/img.width); canvas.width=img.width*sc; canvas.height=img.height*sc;
        ctx.drawImage(img,0,0,canvas.width,canvas.height); canvas.style.display="block"; canvas.classList.add("acf-ready");
      };
      img.src=URL.createObjectURL(f);
    });
    function sampleAt(ev){
      if(!canvas.classList.contains("acf-ready"))return;
      var r=canvas.getBoundingClientRect();
      var x=Math.floor((ev.clientX-r.left)*(canvas.width/r.width));
      var y=Math.floor((ev.clientY-r.top)*(canvas.height/r.height));
      // 5x5 average
      var d=ctx.getImageData(Math.max(0,x-2),Math.max(0,y-2),5,5).data, R=0,G=0,B=0,n=0;
      for(var i=0;i<d.length;i+=4){R+=d[i];G+=d[i+1];B+=d[i+2];n++;}
      onPick([Math.round(R/n),Math.round(G/n),Math.round(B/n)]);
    }
    canvas.addEventListener("click",sampleAt);
  }

  window.AlcantaraFinder={
    init:function(opts){
      var pickBtn=document.getElementById(opts.pickBtn);
      var fileInput=document.getElementById(opts.fileInput);
      var canvas=document.getElementById(opts.canvas);
      var results=document.getElementById(opts.results);
      function onPick(rgb){ renderResults(rgb, results); }
      if(pickBtn) initEyeDropper(pickBtn,onPick);
      if(fileInput&&canvas) initImage(fileInput,canvas,onPick);
    },
    match:match, rgb2lab:rgb2lab, ciede2000:ciede2000
  };
})();
