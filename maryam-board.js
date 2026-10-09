/* ===== Maryam Doska pleyeri — videodagi dars animatsiyasi (qayta ishlatiladigan komponent) =====
   MaryamBoard.create(host, {title, steps, ...}) → {start, play, pause, restart, append, destroy, ...}
   Hamma harakat bitta virtual soat (clock) funksiyasi: pauza = soat to'xtaydi, restart = soat 0.
   step: {title, voice, el:[...], plot?:{curves,points,lines,move,xmin,xmax,ymin,ymax}, plotAt?:n, newPage?:bool}      */
(function(root){
"use strict";
const IC={
 back:'<svg class="ic" viewBox="0 0 24 24"><path d="M20 12H5M11 5l-7 7 7 7"/></svg>',
 grid:'<svg class="ic" viewBox="0 0 24 24"><rect x="4.5" y="4.5" width="15" height="15" rx="2.6"/><path d="M12 4.5v15M4.5 12h15"/></svg>',
 more:'<svg class="ic" viewBox="0 0 24 24"><circle class="f" cx="5" cy="12" r="1.5"/><circle class="f" cx="12" cy="12" r="1.5"/><circle class="f" cx="19" cy="12" r="1.5"/></svg>',
 list:'<svg class="ic" viewBox="0 0 24 24"><circle class="f" cx="4.5" cy="6" r="1.4"/><circle class="f" cx="4.5" cy="12" r="1.4"/><circle class="f" cx="4.5" cy="18" r="1.4"/><path d="M9 6h11M9 12h11M9 18h11"/></svg>',
 replay:'<svg class="ic" viewBox="0 0 24 24"><path d="M4.2 12a8 8 0 1 0 2.5-5.8"/><path d="M4.2 3.8V9h5.2"/></svg>',
 pause:'<svg class="ic" viewBox="0 0 24 24"><rect class="f" x="6" y="4.5" width="4.3" height="15" rx="1.5"/><rect class="f" x="13.7" y="4.5" width="4.3" height="15" rx="1.5"/></svg>',
 play:'<svg class="ic" viewBox="0 0 24 24"><path class="f" d="M7 4.7v14.6c0 .8.9 1.3 1.6.9l11-7.3c.6-.4.6-1.4 0-1.8l-11-7.3C7.9 3.4 7 3.9 7 4.7z"/></svg>',
 vol:'<svg class="ic" viewBox="0 0 24 24"><path d="M4 9.6v4.8h3.6l4.4 3.6V6L7.6 9.6z"/><path d="M15.2 9.6a3.4 3.4 0 0 1 0 4.8M17.8 7.2a7 7 0 0 1 0 9.6"/></svg>',
 mute:'<svg class="ic" viewBox="0 0 24 24"><path d="M4 9.6v4.8h3.6l4.4 3.6V6L7.6 9.6z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>',
 share:'<svg class="ic" viewBox="0 0 24 24"><circle cx="6" cy="12" r="2.6"/><circle cx="17.5" cy="6" r="2.6"/><circle cx="17.5" cy="18" r="2.6"/><path d="M8.3 10.8l7-3.6M8.3 13.2l7 3.6"/></svg>',
 send:'<svg class="ic" viewBox="0 0 24 24"><path class="f" d="M3.3 20.5l17.6-7.8c.8-.4.8-1.6 0-2L3.3 2.9C2.6 2.6 1.8 3.2 2 4l1.4 5.9 9.1 2.1-9.1 2.1L2 20c-.2.8.6 1.4 1.3.5z"/></svg>'
};
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v)),lerp=(a,b,t)=>a+(b-a)*t;
const eio=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2, eout=t=>1-Math.pow(1-t,3), ebk=t=>{const c=2.70158;return 1+c*Math.pow(t-1,3)+(c-1)*Math.pow(t-1,2);};
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const SUPD="⁰¹²³⁴⁵⁶⁷⁸⁹";const sup=s=>esc(s).replace(/\^(\d+)/g,(m,d)=>d.split("").map(c=>SUPD[c]).join(""));
const CS=["ink","blue","green","red","purple","orange"];const col=c=>CS.indexOf(c)>=0?c:"";
const fmtN=v=>String(Number(v.toFixed(6)));

/* list → alohida qatorlar, rectangle → box (har bir qator o'z vaqtida yoziladi) */
function expand(el){
  const out=[];
  (el||[]).forEach(e=>{
    if(!e||typeof e!=="object")return;
    if(e.type==="list"){(e.items||[]).slice(0,8).forEach((it,i)=>{const o=typeof it==="object"&&it?it:{text:it};out.push({type:"li",text:o.text,color:o.color||e.color||(i===0&&/[<]/.test(String(o.text))?"":"")});});return;}
    if(e.type==="rectangle"){out.push({type:"box",items:[{type:"text",text:e.text!=null?e.text:e.formula}]});return;}
    if(e.type==="box"){out.push(Object.assign({},e,{items:expand(e.items)}));return;}
    out.push(e);
  });
  return out;
}


/* ---------- xavfsiz formula kompilyatori (y=f(x)) va grafik ma'lumotini tayyorlash ---------- */
function compile(expr){
  let e=String(expr||"").replace(/^\s*y\s*=/i,"").replace(/[−–]/g,"-").replace(/[×·]/g,"*").replace(/(?<![A-Za-z])pi(?![A-Za-z])/gi,"(3.141592653589793)").replace(/(?<![A-Za-z.])(sin|cos|tan|sqrt|abs|log|exp)(?![A-Za-z])/g,"Math.$1");
  for(let k=0;k<4;k++){const n=e.replace(/(Math\.\w+\([^()]*\)|x|\d+(?:\.\d+)?|\([^()]*\))\s*\^\s*(-?\d+(?:\.\d+)?|x|\([^()]*\))/g,"Math.pow($1,$2)");if(n===e)break;e=n;}
  e=e.replace(/(\d)\s*(x|\(|Math)/g,"$1*$2").replace(/\)\s*(x|\d|\(|Math)/g,")*$1").replace(/x\s*\(/g,"x*(").replace(/\bx\s*(x|Math)/g,"x*$1");
  if(!/^[0-9x+\-*\/().,\s]*$/.test(e.replace(/Math\.(sin|cos|tan|sqrt|abs|log|exp|pow)/g,"")))return null;
  try{const f=new Function("x","return "+e);const t=f(1);return typeof t==="number"?f:null;}catch(_){return null;}
}
const HEX=/^#[0-9a-f]{3,8}$/i,CURVE_COL=["#2f7de1","#e5484d","#3b8a1f","#8a4fc9"];
function prepPlot(p){
  if(!p||typeof p!=="object"||Array.isArray(p))return null;if(p.fns)return p;
  const arr=(a,n)=>Array.isArray(a)?a.slice(0,n).filter(x=>x&&typeof x==="object"):[];
  const nz=(v,d)=>{v=Number(v);return v!==null&&isFinite(v)?v:d;};
  const curves=arr(p.curves,4).map((c,i)=>{const fn=String(c.fn||c.function||"").slice(0,80);return fn&&compile(fn)?{fn,label:String(c.label||"").slice(0,40),color:HEX.test(c.color||"")?c.color:CURVE_COL[i%4],s:Math.floor(nz(c.s,0)),dur:clamp(nz(c.dur,1.8),.3,6)}:null;}).filter(Boolean);
  const fns=curves.map(c=>compile(c.fn));
  const points=arr(p.points,12).map(q=>{const x=Number(q.x);if(q.x==null||!isFinite(x))return null;const ci=Math.floor(nz(q.curve,-1)),c=curves[ci]||null;let y=q.y==null?NaN:Number(q.y);if(!isFinite(y)&&c){try{y=compile(c.fn)(x);}catch(_){y=NaN;}}
    return isFinite(y)?{x,y,label:String(q.label||"").slice(0,24),color:HEX.test(q.color||"")?q.color:"#f08a00",s:Math.floor(nz(q.s,0))}:null;}).filter(Boolean);
  const lines=arr(p.lines,8).map(q=>{const v=[q.x1,q.y1,q.x2,q.y2];return v.every(z=>z!=null&&isFinite(Number(z)))?{x1:+v[0],y1:+v[1],x2:+v[2],y2:+v[3],color:HEX.test(q.color||"")?q.color:"#e5484d",s:Math.floor(nz(q.s,0))}:null;}).filter(Boolean);
  let move=null;if(p.move&&typeof p.move==="object"&&curves.length){const ci=Math.floor(nz(p.move.curve,0)),a=p.move.from==null?NaN:Number(p.move.from),b=p.move.to==null?NaN:Number(p.move.to);if(curves[ci]&&isFinite(a)&&isFinite(b)&&a!==b)move={curve:ci,from:a,to:b,dur:clamp(nz(p.move.dur,3),.5,10),color:HEX.test(p.move.color||"")?p.move.color:"#14162a",s:Math.floor(nz(p.move.s,0))};}
  let x0=p.xmin==null?NaN:Number(p.xmin),x1=p.xmax==null?NaN:Number(p.xmax);if(!(isFinite(x0)&&isFinite(x1)&&x1>x0&&x1-x0<=2000)){x0=-5;x1=5;}
  let y0=p.ymin==null?NaN:Number(p.ymin),y1=p.ymax==null?NaN:Number(p.ymax);if(!(isFinite(y0)&&isFinite(y1)&&y1>y0&&y1-y0<=2000)){y0=null;y1=null;}
  if(!curves.length&&!points.length&&!lines.length&&p.axes===false)return null;
  return{xmin:x0,xmax:x1,ymin:y0,ymax:y1,curves,fns,points,lines,move};
}

/* ---------- grafik (Canvas): vaqtning sof funksiyasi ---------- */
function plotModel(P,W,H){
  /* videodagi kabi: x o'qi kenglikka, y o'qi balandlikka mustaqil moslanadi */
  const a=P.xmin,b=P.xmax,xs=b-a,fns=P.fns;let lo,hi;
  if(P.ymin!=null){lo=P.ymin;hi=P.ymax;}
  else{
    const cap=xs*1.1,vals=[0];P.points.forEach(p=>vals.push(p.y));P.lines.forEach(l=>vals.push(l.y1,l.y2));
    fns.forEach(f=>{for(let k=0;k<=160;k++){let y=NaN;try{y=f(a+xs*k/160);}catch(_){}if(isFinite(y))vals.push(clamp(y,-cap,cap));}});
    lo=Math.min(...vals);hi=Math.max(...vals);if(hi-lo<2){hi+=1;lo-=1;}
    const sp=hi-lo;if(lo>=-1e-9)lo-=sp*.28;else lo-=sp*.08;hi+=sp*.06;
  }
  const scX=W/xs,scY=H/(hi-lo);
  const it=[];P.curves.forEach((c,i)=>it.push({k:"c",i,s:c.s,d:c.dur}));P.lines.forEach((c,i)=>it.push({k:"l",i,s:c.s,d:.8}));P.points.forEach((c,i)=>it.push({k:"p",i,s:c.s,d:.6}));
  if(P.move)it.push({k:"m",i:0,s:P.move.s,d:P.move.dur});
  it.forEach((e,n)=>e.n=n);it.sort((x,y)=>x.s-y.s||x.n-y.n);
  let t=1.2;it.forEach(e=>{e.t0=t;t+=e.d+.25;});
  return{scX,scY,x0:(a+b)/2-W/scX/2,y1:hi,W,H,fns,it,total:t+.3,axesD:1.2};
}
function niceStep(sc){for(const s of [.1,.2,.5,1,2,5,10,20,50,100,200,500,1000,5000]){if(s*sc>=26)return s;}return 10000;}
function drawPlot(ctx,P,M,t,dpr){
  const W=M.W,H=M.H,X=x=>(x-M.x0)*M.scX,Y=y=>(M.y1-y)*M.scY;
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);let tip=null;
  const xMax=M.x0+W/M.scX,yMin=M.y1-H/M.scY,stpX=niceStep(M.scX),stpY=niceStep(M.scY);
  const ox=clamp(X(0),30,W-14),oy=clamp(Y(0),14,H-26);
  /* o'qlar bosqichma-bosqich: avval gorizontal, keyin vertikal */
  const pa=clamp(t/M.axesD,0,1),ph=clamp(pa*2,0,1),pv=clamp(pa*2-1,0,1);
  ctx.strokeStyle="#1b1a18";ctx.fillStyle="#1b1a18";ctx.lineWidth=1.7;ctx.lineCap="round";
  if(ph>0){const ex=lerp(0,W-3,eio(ph));ctx.beginPath();ctx.moveTo(0,oy);ctx.lineTo(ex,oy);ctx.stroke();if(ph>=1){ctx.beginPath();ctx.moveTo(W-1,oy);ctx.lineTo(W-10,oy-4.5);ctx.lineTo(W-10,oy+4.5);ctx.fill();}tip={x:ex,y:oy};}
  if(pv>0){const ey=lerp(H,2,eio(pv));ctx.beginPath();ctx.moveTo(ox,H);ctx.lineTo(ox,ey);ctx.stroke();if(pv>=1){ctx.beginPath();ctx.moveTo(ox,1);ctx.lineTo(ox-4.5,10);ctx.lineTo(ox+4.5,10);ctx.fill();}tip={x:ox,y:ey};}
  if(pa>=1){
    const q=clamp((t-M.axesD)/.4,0,1);ctx.save();ctx.globalAlpha=q;ctx.lineWidth=1.3;ctx.font="600 11.5px system-ui,Roboto,sans-serif";ctx.fillStyle="#6b665a";
    const evX=stpX*M.scX<34?2:1,evY=stpY*M.scY<34?2:1;
    for(let i=Math.ceil(M.x0/stpX),n=0;i*stpX<=xMax&&n<300;i++,n++){if(i===0||i%evX)continue;const px=X(i*stpX);if(px<14||px>W-18)continue;ctx.beginPath();ctx.moveTo(px,oy-4);ctx.lineTo(px,oy+4);ctx.stroke();ctx.textAlign="center";ctx.textBaseline="top";ctx.fillText(fmtN(i*stpX),px,oy+7);}
    for(let i=Math.ceil(yMin/stpY),n=0;i*stpY<=M.y1&&n<300;i++,n++){if(i===0||i%evY)continue;const py=Y(i*stpY);if(py<12||py>H-14)continue;ctx.beginPath();ctx.moveTo(ox-4,py);ctx.lineTo(ox+4,py);ctx.stroke();ctx.textAlign="right";ctx.textBaseline="middle";ctx.fillText(fmtN(i*stpY),ox-8,py);}
    ctx.restore();
  }
  M.it.forEach(e=>{
    const p=clamp((t-e.t0)/e.d,0,1);if(p<=0)return;
    if(e.k==="l"){const l=P.lines[e.i],q=eio(p);ctx.save();ctx.setLineDash([7,6]);ctx.strokeStyle=l.color;ctx.lineWidth=2.2;ctx.beginPath();ctx.moveTo(X(l.x1),Y(l.y1));const ex=X(l.x1+(l.x2-l.x1)*q),ey=Y(l.y1+(l.y2-l.y1)*q);ctx.lineTo(ex,ey);ctx.stroke();ctx.restore();if(p<1)tip={x:ex,y:ey};if(p>=1&&Math.abs(l.y2-l.y1)>0){/* strelka */const g=Math.atan2(Y(l.y2)-Y(l.y1),X(l.x2)-X(l.x1)),ax=X(l.x2),ay=Y(l.y2);ctx.fillStyle=l.color;ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(ax-9*Math.cos(g-.45),ay-9*Math.sin(g-.45));ctx.lineTo(ax-9*Math.cos(g+.45),ay-9*Math.sin(g+.45));ctx.fill();}}
    else if(e.k==="c"){
      const c=P.curves[e.i],N=300,end=Math.max(1,Math.round(N*eio(p)));
      ctx.save();ctx.beginPath();ctx.rect(0,0,W,H);ctx.clip();ctx.strokeStyle=c.color;ctx.lineWidth=3;ctx.lineJoin="round";ctx.lineCap="round";ctx.beginPath();
      let pen=false,lx=0,ly=0;
      for(let k=0;k<=end;k++){const x=M.x0+(xMax-M.x0)*k/N;let y=NaN;try{y=M.fns[e.i](x);}catch(_){}if(!isFinite(y)||Math.abs(Y(y))>H*6){pen=false;continue;}lx=X(x);ly=Y(y);if(pen)ctx.lineTo(lx,ly);else{ctx.moveTo(lx,ly);pen=true;}}
      ctx.stroke();ctx.restore();if(p<1&&pen)tip={x:lx,y:ly};
      if(p>=1&&c.label){ctx.font="600 20px 'Caveat',cursive";ctx.fillStyle=c.color;ctx.textAlign="left";ctx.textBaseline="alphabetic";
        for(const f of [.78,.3,.55]){const x=M.x0+(xMax-M.x0)*f;let y=NaN;try{y=M.fns[e.i](x);}catch(_){}if(isFinite(y)&&Y(y)>60&&Y(y)<H-80){ctx.fillText(c.label,Math.min(X(x)+8,W-ctx.measureText(c.label).width-8),Y(y)-10);break;}}}
    }else if(e.k==="p"){
      const q=P.points[e.i],px=X(q.x),py=Y(q.y);ctx.fillStyle=q.color;ctx.beginPath();ctx.arc(px,py,5.5*Math.max(0,ebk(p)),0,7);ctx.fill();tip={x:px,y:py};
      if(q.label){ctx.save();ctx.globalAlpha=p;ctx.font="600 23px 'Caveat',cursive";ctx.fillStyle=q.color;ctx.textBaseline="top";ctx.textAlign="center";const w=ctx.measureText(q.label).width,cx=clamp(px,w/2+4,W-w/2-4);ctx.fillText(q.label,cx,py+(py>H-50?-34:9));ctx.restore();}
    }else if(e.k==="m"){
      const m=P.move,x=m.from+(m.to-m.from)*eio(p);let y=NaN;try{y=M.fns[m.curve](x);}catch(_){}if(!isFinite(y))return;
      ctx.save();ctx.shadowColor="rgba(0,0,0,.35)";ctx.shadowBlur=8;ctx.fillStyle=m.color;ctx.beginPath();ctx.arc(X(x),Y(y),9,0,7);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle="#ff8a00";ctx.beginPath();ctx.arc(X(x)+6,Y(y)-6,3.5,0,7);ctx.fill();ctx.restore();if(p<1)tip={x:X(x),y:Y(y)};
    }
  });
  return tip;
}

/* ---------- komponent ---------- */
function create(host,o){
  const opt=Object.assign({title:"",steps:[],play:true,rate:1,renderEl:null,renderMath:null,delegate:true,
    placeholder:"Yana so'rang...",taskPlaceholder:"Javobingni yoz...",onAct:null,onGo:null,onStep:null,onVoice:null,onStepEnd:null,onHold:null,PW:520},o||{});
  const root=document.createElement("div");root.className="mb";
  root.innerHTML='<div class="mb-view" data-r="view"><div class="mb-world" data-r="world"><div class="mb-page" data-r="page"></div><canvas class="mb-plot" data-r="plot"></canvas></div></div>'+
   '<div class="mb-fx"><div class="mb-pen" data-r="pen"></div><div class="mb-orb" data-r="orb"><i class="e l"></i><i class="e r"></i><i class="m"></i></div></div>'+
   '<div class="mb-top"><button type="button" data-act="home" aria-label="Orqaga">'+IC.back+'</button><div class="mb-pill"><b data-r="ttl"></b><span data-r="stl"></span></div><button type="button" data-act="overview" aria-label="Umumiy ko\'rinish">'+IC.grid+'</button><button type="button" data-act="menu" aria-label="Yana">'+IC.more+'</button></div>'+
   '<div class="mb-sheet" data-r="sheet"><svg class="curve" viewBox="0 0 100 16" preserveAspectRatio="none"><path d="M0 0Q50 32 100 0V16H0Z" fill="#18162c"/></svg><div class="body"><div class="mb-sub" data-r="sub"></div><div class="mb-ua" id="uA" data-r="ua"></div>'+
   '<div class="mb-card"><div class="mb-seg" data-r="seg"></div><div class="mb-ctl"><button type="button" data-act="list" aria-label="Bosqichlar">'+IC.list+'</button><button type="button" data-act="replay" aria-label="Qayta">'+IC.replay+'</button><button type="button" class="pp" data-act="pp" data-r="pp" aria-label="Play/Pauza">'+IC.pause+'</button><button type="button" data-act="snd" data-r="snd" aria-label="Ovoz">'+IC.vol+'</button><button type="button" data-act="share" aria-label="Ulashish">'+IC.share+'</button></div>'+
   '<div class="mb-ask"><input class="ust-in" id="uQ" data-r="inp" autocomplete="off" enterkeyhint="send" placeholder="'+esc(opt.placeholder)+'"><button type="button" class="mb-send" data-act="ask" data-r="send" aria-label="Yuborish">'+IC.send+'</button></div></div></div></div>';
  host.appendChild(root);
  const R={};root.querySelectorAll("[data-r]").forEach(n=>R[n.dataset.r]=n);
  const ctx=R.plot.getContext("2d");
  const prep=q=>Object.assign({},q,{el:Array.isArray(q.el)?q.el:[],plot:prepPlot(q.plot)});
  let lastBox=null,steps=opt.steps.map(prep),cur=-1,built=0,ev=[],kf=[],cam0=null,camLast=null,lastKfEnd=0,clock=0,playing=false,held=false,animDone=false,voiceDone=false,endFired=false,endAt=0;
  let boxes=[],PWv=380,W=0,H=0,bandTop=100,bandBot=600,plotX=0,plotH=0,curZ=1,raf=0,lastTs=0,destroyed=false,dpr=1;
  let pen={x:0,y:0,has:false},orb={x:0,y:0,init:false},bob=0,ovr=0,ovrT=0,PM=null,PP=null,plotT=0,snd=true,rate=opt.rate;
  const tms=[];let pageStart=[];

  /* ---- o'lchamlar ---- */
  function layout(){
    const r=root.getBoundingClientRect();W=Math.max(1,r.width);H=Math.max(1,r.height);
    const top=root.querySelector(".mb-top").getBoundingClientRect(),sh=R.sheet.getBoundingClientRect();
    bandTop=top.bottom-r.top+4;bandBot=sh.top-r.top+10;if(bandBot-bandTop<120)bandBot=bandTop+120;
    PWv=Math.max(300,Math.round(W-6));R.page.style.width=PWv+'px';plotX=PWv+30;plotH=Math.round(bandBot-bandTop+14);
    dpr=Math.min(2,window.devicePixelRatio||1);
    R.plot.style.width=W+"px";R.plot.style.height=plotH+"px";R.plot.style.left=plotX+"px";R.plot.style.top="0px";
    R.plot.width=Math.round(W*dpr);R.plot.height=Math.round(plotH*dpr);
    if(PP)PM=plotModel(PP,W,plotH);
  }
  const FY=()=>(bandTop+bandBot)/2-14;
  function startCam(){return{x:W/2,y:FY()-(bandTop+12),z:1,fy:FY()};}  /* sahifa yuqorisi bandTop+12 da */
  function plotCam(){return{x:plotX+W/2,y:plotH/2,z:1,fy:bandTop+plotH/2-4};}

  /* ---- DOM yaratish ---- */
  function nodeFor(e,k,parent,instant,evs,depth){
    const wrap=document.createElement("div");wrap.className="mb-b"+(instant?" on":"");
    const t=e.type;let cls="";
    if(t==="box"){
      wrap.classList.add("mb-boxw");wrap.style.width="100%";
      wrap.innerHTML='<div class="mb-box"><div class="bg"></div><svg class="bd"><path fill="none" stroke="#1b1a18" stroke-width="3" stroke-linejoin="miter"/></svg><div class="in"></div></div>';
      parent.appendChild(wrap);const inn=wrap.querySelector(".in");
      const ev0={k,kind:"box",node:wrap,box:wrap.querySelector(".mb-box"),bd:wrap.querySelector("path"),bg:wrap.querySelector(".bg"),inn,dur:1.1,gap:.25,n:0};
      evs.push(ev0);boxes.push(ev0);if(!depth)lastBox=ev0;
      (e.items||[]).forEach((c,j)=>nodeFor(c,k+"."+j,inn,instant,evs,(depth||0)+1));
      return wrap;
    }
    if(t==="underline"){
      wrap.className="mb-b mb-ulw on";const prev=parent.lastElementChild;
      wrap.innerHTML='<div class="mb-ul"><svg viewBox="0 0 100 12" preserveAspectRatio="none"><path pathLength="1" d="M1 7C22 4 48 9 70 6S92 4 99 5" fill="none" stroke="'+({blue:"#2f7de1",green:"#3b8a1f",purple:"#8a4fc9"}[e.color]||"#e5484d")+'" stroke-width="4" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg></div>';
      parent.appendChild(wrap);
      evs.push({k,kind:"ul",node:wrap,path:wrap.querySelector("path"),prev,dur:.7,gap:.25});
      return wrap;
    }
    let html=opt.renderEl?opt.renderEl(e,k):"";
    if(!html)html=defaultEl(e,k);
    wrap.innerHTML=html;parent.appendChild(wrap);
    const dr=wrap.querySelectorAll(".dr"),bars=wrap.querySelectorAll(".bar");
    const txt=String(e.text!=null?e.text:(e.formula||"")),n=txt.length;
    let dur=t==="heading"?.5+n*.1:t==="formula"?1.4+Math.max(0,n-14)*.05:t==="question"?.9:.45+n*.085;
    dur=clamp(dur,.7,6.5);if(dr.length||bars.length||t==="draw"||t==="chart"||t==="graph"||t==="table"||t==="timeline"||t==="code")dur=Math.max(dur,1.6);
    const inB=parent!==R.page&&lastBox&&parent===lastBox.inn&&e.inBox;
    evs.push({k,kind:"el",node:wrap,dr,bars,dur:dur+(inB?.5:0),grow:inB?.5:0,boxEv:inB?lastBox:null,gap:.35,hold:t==="question",type:t});
    return wrap;
  }
  function defaultEl(e,k){
    const x=e.text!=null?e.text:(e.formula||e.q||"");const c=col(e.color),cc=c?" c-"+c:"";
    switch(e.type){
      case"heading":return'<div class="mb-h">'+esc(x)+'</div>';
      case"formula":return'<div class="mb-fm'+cc+'">'+(opt.renderMath?opt.renderMath(x):sup(x))+'</div>';
      case"handwriting":return'<div class="mb-tx c-purple">'+sup(x)+'</div>';
      case"highlight":return'<div class="mb-hl"><mark>'+sup(x)+'</mark></div>';
      case"li":return'<div class="mb-li'+cc+'"><i>·</i>'+sup(x)+'</div>';
      case"warning":return'<div class="mb-warn">'+sup(x)+'</div>';
      case"tip":return'<div class="mb-tx c-green">'+sup(x)+'</div>';
      case"task":{const s=String(x);return'<div class="mb-task">'+sup(/^(topshiriq|mashq)/i.test(s)?s:"Topshiriq: "+s)+'</div>';}
      case"question":return'<div class="mb-ex">'+sup(x)+'</div>'+(e.options||[]).map((op,j)=>'<button type="button" class="ust-opt" data-q="'+k+'" data-j="'+j+'">'+sup(op)+'</button>').join("")+'<div class="mb-ex" id="qf'+k+'"></div>';
      case"code":return'<pre class="code">'+esc(x)+'</pre>';
      default:return'<div class="mb-tx'+cc+'">'+sup(x)+'</div>';
    }
  }
  function rectOf(n){const p=R.page.getBoundingClientRect(),b=n.getBoundingClientRect(),z=curZ||1;return{x:(b.left-p.left)/z,y:(b.top-p.top)/z,w:b.width/z,h:b.height/z};}

  /* sahifaga bosqichni qo'shish: instant=true → animatsiyasiz (to'liq ko'rinadigan) */
  function addStep(j,instant){
    const s=steps[j],evs=[];
    if(s.newPage&&R.page.children.length){const g=document.createElement("div");g.className="mb-gap";g.style.height=Math.round(Math.max(H*1.15,640))+"px";R.page.appendChild(g);}
    pageStart[j]=R.page.children.length;
    (s.el||[]).forEach((e,k)=>{const par=(e.inBox&&lastBox&&lastBox.node.isConnected)?lastBox.inn:R.page;nodeFor(e,String(k),par,instant,evs,par===R.page?0:1);});
    return evs;
  }
  function clearPage(){R.page.innerHTML="";built=0;pageStart=[];lastBox=null;boxes=[];}

  /* ---- vaqt jadvali va kamera ---- */
  function camTo(to,dur,dip,at,lin){at=Math.max(at,lastKfEnd);kf.push({t:at,dur,to,dip:dip||0,lin:!!lin});lastKfEnd=at+dur;camLast=to;return at;}
  function targetFor(rect,last){
    let x=last.x,y=last.y;const left=rect.x-10,right=rect.x+rect.w+12,vl=x-W/2,vr=x+W/2;
    if(!(left>=vl-1&&right<=vr+1)){
      if(rect.w+22<=W)x=left<vl?left+W/2-4:right-W/2+4;else x=left+W/2;
    }
    const ey=rect.y+Math.min(rect.h,90)/2,sy=(ey-y)+FY();
    if(sy<bandTop+50||sy>bandBot-60)y=ey;
    return{x,y,z:1,fy:FY()};
  }
  function buildTimeline(j,evs,from){
    kf=[];lastKfEnd=0;camLast=from;let t=.45;
    const s=steps[j],list=[];
    /* plot o'rni: standart — elementlardan keyin; plotAt:0 bo'lsa — oldin */
    const nEl=evs.filter(e=>e.kind!=="ul"&&e.kind!=="box"||e.kind==="box").length;
    let plotIdx=s.plot?(s.plotAt!=null?clamp(+s.plotAt,0,evs.length):evs.length):-1;
    const seq=evs.slice();if(plotIdx>=0)seq.splice(plotIdx,0,{kind:"plot",dur:0,gap:.5});
    seq.forEach(e=>{
      if(e.kind==="plot"){
        PP=s.plot;PM=plotModel(PP,W,plotH);e.dur=PM.total;e.pm=PM;
        const st=camTo(plotCam(),1.25,.18,t);e.t0=st+.7;e.dur=PM.total;t=e.t0+e.dur+e.gap;
        e.pen=p=>null;list.push(e);return;
      }
      e.rect=rectOf(e.node.querySelector?e.node:e.node);
      if(e.kind==="ul"&&e.prev){const pr=rectOf(e.prev);e.node.style.width=Math.max(40,pr.w)+"px";e.rect=rectOf(e.node);}
      let need=targetFor(e.kind==="box"?{x:e.rect.x,y:e.rect.y,w:Math.min(e.rect.w,W),h:60}:e.rect,camLast),moved=Math.abs(need.x-camLast.x)>2||Math.abs(need.y-camLast.y)>2||Math.abs(camLast.z-1)>.01||Math.abs(need.fy-camLast.fy)>2;
      if(moved){const far=Math.hypot(need.x-camLast.x,need.y-camLast.y)>Math.max(W,H*.7),dur=far?1.35:.85;const st=camTo(need,dur,far?.22:0,t);t=st+dur*.5;}
      e.t0=t;
      if(e.kind==="el"||e.kind==="ul"){
        const rr=e.rect;
        if(rr.x+rr.w+12>camLast.x+W/2+1&&e.kind==="el"){camTo({x:rr.x+rr.w+12-W/2,y:camLast.y,z:1,fy:FY()},e.dur*.95,0,e.t0,true);}
      }
      if(e.kind==="box"){
        const rr=e.rect;if(rr.x+rr.w+12>camLast.x+W/2+1){camTo({x:rr.x+rr.w+12-W/2,y:camLast.y,z:1,fy:FY()},1.1,0,e.t0+.1);}
      }
      list.push(e);t=e.t0+e.dur+e.gap;
    });
    ev=list;endAt=t+.2;
  }

  function penPos(e,p){
    const r=e.rect;if(!r)return null;
    if(e.kind==="box"){const per=2*(r.w+r.h),d=p*per;let x,y;if(d<r.w){x=r.x+d;y=r.y;}else if(d<r.w+r.h){x=r.x+r.w;y=r.y+(d-r.w);}else if(d<2*r.w+r.h){x=r.x+r.w-(d-r.w-r.h);y=r.y+r.h;}else{x=r.x;y=r.y+r.h-(d-2*r.w-r.h);}return{x,y};}
    if(e.kind==="ul")return{x:r.x+r.w*eio(p),y:r.y+r.h*.55};
    return{x:r.x+r.w*p,y:r.y+r.h*.62};
  }

  /* ---- ko'rsatish ---- */
  function camAt(){
    if(!cam0)cam0=startCam();
    let from=cam0,out=cam0;
    for(const k of kf){
      if(clock<k.t)break;
      const u=clamp((clock-k.t)/k.dur,0,1);
      if(u<1){const e=k.lin?u:eio(u);out={x:lerp(from.x,k.to.x,e),y:lerp(from.y,k.to.y,e),fy:lerp(from.fy,k.to.fy,e),z:lerp(from.z,k.to.z,e)-k.dip*Math.sin(Math.PI*e)};break;}
      from=k.to;out=k.to;
    }
    return out;
  }
  function overviewCam(){if(!W)return{x:0,y:0,z:1,fy:0};
    const ph=R.page.offsetHeight||300,pw=PWv+30,z=clamp(Math.min(W/pw,(bandBot-bandTop-10)/Math.max(ph,200)),.28,1);
    return{x:pw/2,y:Math.min(ph,Math.max(ph,200))/2,z,fy:(bandTop+bandBot)/2};
  }
  function boxPath(e){if(!e.node.isConnected)return;const w=e.box.offsetWidth,h=e.box.offsetHeight;if(w===e.cw&&h===e.ch)return;e.cw=w;e.ch=h;e.bd.setAttribute('d','M1.5 1.5H'+(w-1.5)+'V'+(h-1.5)+'H1.5Z');e.bd.setAttribute('pathLength','1');}
  function applyEvents(){
    boxes.forEach(boxPath);
    for(const e of ev){
      const p=e.dur>0?clamp((clock-e.t0)/e.dur,0,1):(clock>=e.t0?1:0);
            if(e.lp===p)continue;e.lp=p;
      if(e.kind==="plot"){plotT=p*e.dur;continue;}
      if(e.kind==="el"){
        const n=e.node;n.classList.toggle("on",p>0);
        let q=p;
        if(e.grow&&e.rect){const gp=clamp((clock-e.t0)/e.grow,0,1);if(gp<1){n.style.height=(e.rect.h*eio(gp))+"px";n.style.overflow="hidden";n.style.marginBottom=(12*eio(gp))+"px";}else{n.style.height="";n.style.overflow="";n.style.marginBottom="";}
          q=clamp((clock-e.t0-e.grow)/Math.max(.1,e.dur-e.grow),0,1);if(e.boxEv)e.boxEv.dirty=2;}
        if(e.dr.length||e.bars.length){n.style.clipPath="none";e.dr.forEach(d=>{d.style.strokeDasharray="1";d.style.strokeDashoffset=String(1-q);});e.bars.forEach(b=>{b.style.transform="scaleY("+eout(q)+")";});}
        else n.style.clipPath=q>=1?"none":"inset(-12px "+((1-q)*100).toFixed(2)+"% -16px -12px)";
      }else if(e.kind==="box"){
        e.node.classList.toggle("on",p>0);boxPath(e);
        e.bd.style.strokeDasharray="1";e.bd.style.strokeDashoffset=String(1-eio(p));
        e.bg.style.opacity=clamp((p-.45)*2,0,1);
      }else if(e.kind==="ul"){
        e.path.style.strokeDasharray="1";e.path.style.strokeDashoffset=String(1-eio(p));e.path.style.opacity=p>0?1:0;
      }
    }
  }
  function render(dt){
    if(destroyed||!W)return;
    applyEvents();
    let c=camAt();
    if(ovrT>0){const e=eio(ovr),o=overviewCam();c={x:lerp(c.x,o.x,e),y:lerp(c.y,o.y,e),z:lerp(c.z,o.z,e),fy:lerp(c.fy,o.fy,e)};}
    curZ=c.z;const tx=W/2-c.x*c.z,ty=c.fy-c.y*c.z;
    R.world.style.transform="translate("+tx.toFixed(2)+"px,"+ty.toFixed(2)+"px) scale("+c.z.toFixed(4)+")";
    const g=20*c.z;R.view.style.backgroundSize=g+"px "+g+"px,"+g+"px "+g+"px,"+(g*5)+"px "+(g*5)+"px,"+(g*5)+"px "+(g*5)+"px";
    R.view.style.backgroundPosition=tx+"px "+ty+"px";
    /* grafik */
    if(PP&&PM){const tip=drawPlot(ctx,PP,PM,plotT,dpr);R.plot._tip=tip;}
    /* qalam: eng oxirgi boshlangan hodisa */
    let pe=null;for(const e of ev){if(e.t0<=clock)pe=e;}
    if(pe){
      let wp=null;
      if(pe.kind==="plot"){const tp=R.plot._tip;if(tp)wp={x:plotX+tp.x,y:tp.y};}
      else{const p=pe.dur>0?clamp((clock-pe.t0)/pe.dur,0,1):1;wp=penPos(pe,p);}
      if(wp){pen.x=wp.x;pen.y=wp.y;pen.has=true;}
    }
    const sx=(pen.x)*c.z+tx,sy=(pen.y)*c.z+ty;
    if(pen.has){R.pen.style.opacity=1;R.pen.style.transform="translate("+sx.toFixed(1)+"px,"+sy.toFixed(1)+"px)";}
    /* qo'g'irchoq: qalam yonida yumshoq ergashadi */
    bob+=dt;const k=1-Math.exp(-dt*5.5);
    let txo=pen.has?sx-40:W/2,tyo=pen.has?sy-36:(bandTop+bandBot)/2;
    txo=clamp(txo,34,W-34);tyo=clamp(tyo,bandTop+30,bandBot-34);
    if(!orb.init){orb.x=W/2;orb.y=(bandTop+bandBot)/2;orb.init=true;}
    orb.x+=(txo-orb.x)*k;orb.y+=(tyo-orb.y)*k;
    R.orb.style.transform="translate("+(orb.x+Math.sin(bob*1.7)*3).toFixed(1)+"px,"+(orb.y+Math.cos(bob*1.3)*4).toFixed(1)+"px)";
  }
  function frame(ts){
    raf=0;if(destroyed)return;
    const dt=lastTs?Math.min(.05,(ts-lastTs)/1000):0;lastTs=ts;
    if(ovrT!==0){ovr=clamp(ovr+ovrT*dt/.6,0,1);if(ovr<=0||ovr>=1){if(ovr<=0)ovrT=0;else ovrT=ovrT>0?1e-9:ovrT;}}
    if(playing&&!held){
      clock+=dt*rate;
      /* so'roq/mashq: hodisa oxiriga yetganda to'xtash */
      for(const e of ev){if(e.hold&&!e.released&&clock>=e.t0+e.dur){clock=e.t0+e.dur;held=true;e.released=false;opt.onHold&&opt.onHold(e.k);break;}}
      if(!animDone&&clock>=endAt-.2){animDone=true;}
      checkEnd();
    }
    render(playing?dt:0);
    if(playing)raf=requestAnimationFrame(frame);else if(ovrT!==0&&ovr>0&&ovr<1)raf=requestAnimationFrame(frame);
  }
  function kick(){if(destroyed||raf||document.hidden)return;lastTs=0;raf=requestAnimationFrame(frame);}
  function checkEnd(){
    if(endFired||!animDone||!voiceDone||held)return;
    endFired=true;tms.push(setTimeout(()=>{if(destroyed)return;if(!playing){endFired=false;return;}opt.onStepEnd&&opt.onStepEnd(cur);},Math.round(700/Math.max(.5,rate))));
  }
  const onVis=()=>{if(document.hidden){if(raf){cancelAnimationFrame(raf);raf=0;}}else if(playing)kick();else render(0);};
  document.addEventListener("visibilitychange",onVis);
  const ro=window.ResizeObserver?new ResizeObserver(()=>{if(destroyed)return;const w=W;layout();if(cur>=0&&steps[cur]){rebuildCamera();}render(0);}):null;
  if(ro)ro.observe(root);else window.addEventListener("resize",()=>{layout();render(0);});

  function rebuildCamera(){
    /* o'lcham o'zgarsa: DOM va soat o'zgarmaydi, faqat kamera kadrlari qayta hisoblanadi */
    const s=steps[cur];if(!s)return;const evs=ev.filter(e=>e.kind!=="plot");
    const keepClock=clock;const from=cam0;
    const plotEv=ev.find(e=>e.kind==="plot");
    const old=ev;buildTimeline(cur,old.filter(e=>e.kind!=="plot").map(e=>{const n=Object.assign({},e);delete n.lp;return n;}),from);
    clock=keepClock;
  }

  /* ---- bosqich boshqaruvi ---- */
  function setSeg(){
    const n=steps.length;
    R.seg.innerHTML=steps.map((_,k)=>'<i data-go="'+k+'" class="'+(k<cur?"d":k===cur?"on":"")+'"></i>').join("")+"<span>"+(cur+1)+" / "+n+"</span>";
    R.ttl.textContent=opt.title;R.stl.textContent=(cur+1)+"-qadam / "+n;
  }
  function setPP(){R.pp.innerHTML=playing?IC.pause:IC.play;root.classList.toggle("paused",!playing);}
  function finalize(evs){evs.forEach(e=>{e.t0=-10;e.dur=1;e.lp=null;});const sv=ev,sc=clock;ev=evs;clock=0;applyEvents();ev=sv;clock=sc;}
  function start(i,o2){
    o2=o2||{};if(!steps.length)return;
    i=clamp(Math.floor(+i)||0,0,steps.length-1);
    tms.forEach(clearTimeout);tms.length=0;layout();
    let from=cur<0?startCam():(camLast||startCam());
    if(i!==built){ /* ketma-ket emas (qayta boshlash / sakrash): oldingi bosqichlar tayyor holatda tiklanadi */
      clearPage();ev=[];
      for(let j=0;j<i;j++){const evs=addStep(j,true);finalize(evs);}
      built=i;const pb=R.page.lastElementChild;
      from=(pb&&i>0)?targetFor(rectOf(pb),startCam()):startCam();
      PP=null;PM=null;plotT=0;ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,R.plot.width,R.plot.height);
    }
    else if(ev.length){finalize(ev.filter(e=>e.kind!=="plot"));}
    cam0=from;cur=i;
    const evs=addStep(i,false);built=i+1;
    clock=0;held=false;animDone=false;voiceDone=!!o2.noVoice;endFired=false;
    buildTimeline(i,evs,cam0);
    ev.forEach(e=>{e.lp=null;e.released=false;});
    pen.has=false;R.pen.style.opacity=0;
    R.sub.textContent=steps[i].voice||steps[i].title||"";
    setSeg();setTask(o2.task);
    playing=o2.play!==false&&opt.play!==false&&!o2.paused;setPP();
    opt.onStep&&opt.onStep(i,steps[i]);
    render(0);
    if(playing){opt.onVoice&&opt.onVoice(i,steps[i].voice||"");kick();}
  }
  function setTask(on){R.inp.placeholder=on?opt.taskPlaceholder:opt.placeholder;R.send.dataset.act=on?"check":"ask";}
  function play(){if(playing||cur<0)return;playing=true;setPP();kick();opt.onVoice&&!voiceDone&&opt.onVoice(cur,steps[cur].voice||"",true);}
  function pause(){if(!playing)return;playing=false;setPP();if(raf){cancelAnimationFrame(raf);raf=0;}tms.forEach(clearTimeout);tms.length=0;endFired=false;render(0);}
  function release(){held=false;ev.forEach(e=>{if(e.hold&&e.released===false&&clock>=e.t0+e.dur)e.released=true;});kick();}
  function append(list){const was=steps.length;steps=steps.concat(list.map(prep));setSeg();return was;}
  function list(){
    let e=root.querySelector(".mb-ls");if(e){e.remove();return;}
    root.insertAdjacentHTML("beforeend",'<div class="mb-ls">'+steps.map((q,k)=>'<button type="button" data-go="'+k+'"'+(k===cur?' class="cur"':"")+'>'+(k+1)+". "+esc(q.title)+'</button>').join("")+'</div>');
  }
  function menu(items){
    let e=root.querySelector(".mb-ls");if(e){e.remove();return;}
    root.insertAdjacentHTML("beforeend",'<div class="mb-ls" style="max-height:none">'+items.map(it=>'<button type="button" data-act="'+it.act+'">'+esc(it.label)+'</button>').join("")+'</div>');
  }
  function closePop(){const e=root.querySelector(".mb-ls");if(e)e.remove();}
  function overview(){ovrT=ovrT>0?-1:1;if(ovrT<0&&ovr<=0)ovrT=0;if(ovrT>0&&ovr>=1)ovrT=-1;kick();if(!raf)render(0);}
  function setSound(on){snd=!!on;R.snd.innerHTML=snd?IC.vol:IC.mute;}
  function setRate(r){rate=r;}
  function voiceEnded(){voiceDone=true;checkEnd();}
  function destroy(){destroyed=true;if(raf)cancelAnimationFrame(raf);raf=0;tms.forEach(clearTimeout);tms.length=0;document.removeEventListener("visibilitychange",onVis);if(ro)ro.disconnect();root.remove();}

  if(opt.delegate){
    root.addEventListener("click",e=>{
      const t=e.target.closest("[data-act],[data-go]");if(!t||!root.contains(t))return;
      if(t.dataset.go!==undefined){closePop();opt.onGo?opt.onGo(+t.dataset.go):start(+t.dataset.go);return;}
      const a=t.dataset.act;
      if(a==="pp"){playing?pause():play();return;}
      if(a==="overview")return overview();
      if(a==="list")return list();
      if(a==="menu")return menu([{act:"spd",label:"Tezlikni almashtirish"},{act:"mic",label:"Gapirib so'rash"},{act:"share",label:"Ulashish"}]);
      if(a==="replay"){closePop();return start(0);}
      if(a==="snd"){setSound(!snd);}
      opt.onAct&&opt.onAct(a,t,e);
    });
  }
  try{if(document.fonts){['700 30px Caveat','600 24px Caveat','700 34px "Patrick Hand"'].forEach(f=>document.fonts.load(f).catch(()=>{}));document.fonts.ready.then(()=>{if(!destroyed&&cur>=0){rebuildCamera();render(0);}});}}catch(_){}
  layout();setSeg();setPP();setSound(true);R.sub.textContent="";render(0);
  return{el:root,R,start,play,pause,release,append,list,menu,closePop,overview,setSound,setRate,voiceEnded,destroy,setTask,
    get playing(){return playing},get step(){return cur},get steps(){return steps},get clock(){return clock},get held(){return held},
    seek(t){clock=clamp(t,0,endAt+5);ev.forEach(e=>e.lp=null);render(0);for(let q=0;q<45;q++)render(1/30);},state(){return{clock,cur,playing,held,kf:kf.length,events:ev.length,cam:camAt(),plotT,pen:{x:pen.x,y:pen.y},endAt,animDone,voiceDone};},
    setAsk(v){if(R.inp)R.inp.value=v||"";},relayout(){layout();rebuildCamera();render(0);}};
}
root.MaryamBoard={create,expand,prepPlot,compile,version:"1.0"};
})(window);
