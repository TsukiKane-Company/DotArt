"use strict";
(function(){
var $=function(i){return document.getElementById(i)};
var MAXPX=2048,src=null,cells=null,out=null,pal=[],deb,mode=null,tool="pen",cur=null,custom=[],undoS=[],redoS=[],edited=false,HMAX=100;
var PRESETS={
 tsuki:["#120C1A","#3A2C4A","#7A6A8C","#B5ABC2","#ECE8F0","#8C0A62","#F90AA3","#FF8AD0"],
 gb:["#0F380F","#306230","#8BAC0F","#9BBC0F"],
 term:["#050805","#0B3D16","#1A7A2E","#33C24D","#7DFF8A"]};
var BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
function hex(c){return"#"+c.map(function(v){return v.toString(16).padStart(2,"0")}).join("").toUpperCase()}
function rgb(h){return[1,3,5].map(function(i){return parseInt(h.slice(i,i+2),16)})}
function toast(t,ms){$("toast").textContent=t;clearTimeout(toast.t);toast.t=setTimeout(function(){$("toast").textContent=""},ms||2500)}
function lin(v){v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)}
function toLab(c){var r=lin(c[0]),g=lin(c[1]),b=lin(c[2]);
 var l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
 return[100*(.2104542553*l+.793617785*m-.0040720468*s),100*(1.9779984951*l-2.428592205*m+.4505937099*s),100*(.0259040371*l+.7827717662*m-.808675766*s)]}
function d2(a,b){var x=a[0]-b[0],y=a[1]-b[1],z=a[2]-b[2];return x*x+y*y+z*z}
function isIOS(){return /[?&]ios=1\b/.test(location.search)||/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1)}
// 1) 縮小：セルごとに面積平均（透明度で重み付け）。アルファ<128 のセルは透明のまま
function downsample(img,N){var nw=img.naturalWidth,nh=img.naturalHeight,L=Math.max(nw,nh);
 var w=Math.max(1,Math.round(nw*N/L)),h=Math.max(1,Math.round(nh*N/L)),f=Math.max(1,Math.min(8,Math.floor(Math.min(nw/w,nh/h))));
 var c=document.createElement("canvas");c.width=w*f;c.height=h*f;var x=c.getContext("2d",{willReadFrequently:true});
 x.imageSmoothingEnabled=true;x.imageSmoothingQuality="high";x.drawImage(img,0,0,w*f,h*f);
 var d=x.getImageData(0,0,w*f,h*f).data,W=w*f,o=new Uint8ClampedArray(w*h*4),cx,cy,i,j;
 for(cy=0;cy<h;cy++)for(cx=0;cx<w;cx++){var r=0,g=0,b=0,a=0;
  for(j=0;j<f;j++)for(i=0;i<f;i++){var p=((cy*f+j)*W+cx*f+i)*4,al=d[p+3];r+=d[p]*al;g+=d[p+1]*al;b+=d[p+2]*al;a+=al}
  var q=(cy*w+cx)*4,av=a/(f*f);if(av>=128){o[q]=Math.round(r/a);o[q+1]=Math.round(g/a);o[q+2]=Math.round(b/a);o[q+3]=255}}
 return{w:w,h:h,d:o}}
// 2) 自動パレット：OKLab の k-means（決定論的 farthest-point 初期化）
function kmeans(C,k){var map=new Map(),d=C.d,i,j;
 for(i=0;i<d.length;i+=4){if(!d[i+3])continue;var key=(d[i]<<16)|(d[i+1]<<8)|d[i+2],e=map.get(key);if(e)e.w++;else map.set(key,{rgb:[d[i],d[i+1],d[i+2]],w:1})}
 if(!map.size)return[];var U=[];Array.from(map.keys()).sort(function(a,b){return a-b}).forEach(function(q){var e=map.get(q);U.push({rgb:e.rgb,lab:toLab(e.rgb),w:e.w})});
 var K=Math.min(k,U.length),W=0,m=[0,0,0];U.forEach(function(u){W+=u.w;m[0]+=u.lab[0]*u.w;m[1]+=u.lab[1]*u.w;m[2]+=u.lab[2]*u.w});m=m.map(function(v){return v/W});
 var cs=[],dist=U.map(function(u){return d2(u.lab,m)});
 for(j=0;j<K;j++){var bi=0;for(i=1;i<U.length;i++)if(dist[i]>dist[bi])bi=i;if(j>0&&dist[bi]===0)break;cs.push(U[bi].lab.slice());
  for(i=0;i<U.length;i++)dist[i]=j===0?d2(U[i].lab,cs[0]):Math.min(dist[i],d2(U[i].lab,cs[j]))}
 var as=new Int32Array(U.length),cnt;
 for(var it=0;it<25;it++){var sum=cs.map(function(){return[0,0,0]});cnt=cs.map(function(){return 0});
  for(i=0;i<U.length;i++){var b=0,bd=1e18;for(j=0;j<cs.length;j++){var dd=d2(U[i].lab,cs[j]);if(dd<bd){bd=dd;b=j}}as[i]=b;var w=U[i].w;cnt[b]+=w;sum[b][0]+=U[i].lab[0]*w;sum[b][1]+=U[i].lab[1]*w;sum[b][2]+=U[i].lab[2]*w}
  var mv=false;for(j=0;j<cs.length;j++)if(cnt[j]){var n=sum[j].map(function(v){return v/cnt[j]});if(d2(n,cs[j])>.01)mv=true;cs[j]=n}if(!mv)break}
 // 代表色：クラスタ内で重心に一番近い実在の色（平均で濁らないように）
 var res=[];for(j=0;j<cs.length;j++){if(!cnt[j])continue;var best=-1,b2=1e18;for(i=0;i<U.length;i++)if(as[i]===j){var e2=d2(U[i].lab,cs[j]);if(e2<b2){b2=e2;best=i}}
  if(best>=0)res.push({h:hex(U[best].rgb),n:cnt[j]})}
 res.sort(function(a,b){return b.n-a.n});var seen={};return res.map(function(r){return r.h}).filter(function(h){if(seen[h])return false;seen[h]=1;return true})}
// 3) パレットに当てはめ（OKLab で最近傍、任意で 4×4 Bayer ディザ）
function quantize(C,P,dither){var PL=P.map(function(h){return toLab(rgb(h))}),PR=P.map(rgb),d=C.d,o=new Uint8ClampedArray(d.length),cache=new Map(),w=C.w;
 var spread=P.length<=2?128:P.length<=5?80:56;
 for(var i=0,n=0;i<d.length;i+=4,n++){if(!d[i+3])continue;var r=d[i],g=d[i+1],b=d[i+2];
  if(dither){var t=((BAYER[((n/w|0)&3)*4+(n%w&3)]+.5)/16-.5)*spread;r=Math.max(0,Math.min(255,Math.round(r+t)));g=Math.max(0,Math.min(255,Math.round(g+t)));b=Math.max(0,Math.min(255,Math.round(b+t)))}
  var key=(r<<16)|(g<<8)|b,k=cache.get(key);
  if(k===undefined){var L=toLab([r,g,b]),bd=1e18;k=0;for(var j=0;j<PL.length;j++){var e=d2(L,PL[j]);if(e<bd){bd=e;k=j}}cache.set(key,k)}
  o[i]=PR[k][0];o[i+1]=PR[k][1];o[i+2]=PR[k][2];o[i+3]=255}
 return{w:C.w,h:C.h,d:o}}

function scaleOf(){var v=document.querySelector("input[name=scale]:checked").value,L=out?Math.max(out.w,out.h):1,mx=Math.max(1,Math.floor(MAXPX/L));
 if(v==="max")return{s:mx,cl:false};var s=+v;return s>mx?{s:mx,cl:true}:{s:s,cl:false}}
function enlarge(O,s){var c=document.createElement("canvas");c.width=O.w*s;c.height=O.h*s;var x=c.getContext("2d"),id=x.createImageData(O.w*s,O.h*s),D=id.data,W=O.w*s;
 for(var y=0;y<O.h;y++)for(var X=0;X<O.w;X++){var p=(y*O.w+X)*4;if(!O.d[p+3])continue;
  for(var j=0;j<s;j++){var row=((y*s+j)*W+X*s)*4;for(var i=0;i<s;i++){var q=row+i*4;D[q]=O.d[p];D[q+1]=O.d[p+1];D[q+2]=O.d[p+2];D[q+3]=255}}}
 x.putImageData(id,0,0);return c}
// ---- 表示 ----
var raf=0;function draw(){if(raf)return;raf=requestAnimationFrame(function(){raf=0;drawNow()})}
function drawNow(){if(!out)return;var beads=$("beads").checked;$("preview").hidden=beads;$("chart").hidden=!beads;$("dropText").hidden=true;
 if(beads){drawChart($("chart"));beadPanel()}else{var cv=$("preview"),L=Math.max(out.w,out.h),s=Math.max(1,Math.floor(1024/L));
  var big=enlarge(out,s);if(cv.width!==big.width||cv.height!==big.height){cv.width=big.width;cv.height=big.height}var x=cv.getContext("2d");x.clearRect(0,0,cv.width,cv.height);x.drawImage(big,0,0);
  if($("lines").checked&&s>=3){x.fillStyle="rgba(18,12,26,.45)";for(var i=0;i<=out.w;i++)x.fillRect(Math.min(i*s,cv.width-1),0,1,cv.height);for(var j=0;j<=out.h;j++)x.fillRect(0,Math.min(j*s,cv.height-1),cv.width,1);
   if(out.w>16||out.h>16){x.fillStyle="rgba(236,232,240,.5)";for(i=0;i<=out.w;i+=8)x.fillRect(Math.min(i*s,cv.width-1),0,1,cv.height);for(j=0;j<=out.h;j+=8)x.fillRect(0,Math.min(j*s,cv.height-1),cv.width,1)}}}
 info();ui()}
function info(){if(!out){$("sizeInfo").textContent="";return}var S=scaleOf();
 $("sizeInfo").textContent="ドット "+out.w+"×"+out.h+" → 保存 "+out.w*S.s+"×"+out.h*S.s+" px"+(S.cl?"（最大 "+MAXPX+"px に合わせて "+S.s+" 倍）":"");
 [].forEach.call(document.querySelectorAll(".seg label"),function(l){l.classList.toggle("on",l.querySelector("input").checked)})}
function ui(){var has=!!out,beads=$("beads").checked;$("undo").disabled=!undoS.length;$("redo").disabled=!redoS.length;$("clear").disabled=!has;
 [].forEach.call(document.querySelectorAll(".tool"),function(b){b.disabled=!has||beads;var on=b.dataset.tool===tool;b.classList.toggle("on",on);b.setAttribute("aria-pressed",on)});
 $("save").disabled=!has;$("saveChart").disabled=!has;$("beadBox").hidden=!(has&&beads);$("photoSet").disabled=mode==="blank"}
function chips(){var ul=$("chips");ul.innerHTML="";var all=pal.concat(custom.filter(function(h){return pal.indexOf(h)<0}));
 if(!cur||all.indexOf(cur)<0)cur=pal.indexOf("#F90AA3")>=0?"#F90AA3":all[all.length>1?all.length-1:0];
 all.forEach(function(h){var li=document.createElement("li");li.className="chip"+(h===cur&&tool!=="eraser"?" sel":"");li.style.background=h;li.title=h;li.tabIndex=0;li.dataset.hex=h;
  li.onclick=li.onkeydown=function(e){if(e.type==="keydown"&&e.key!=="Enter")return;setCur(h)};ul.appendChild(li)});
 var c=$("cur");c.style.background=tool==="eraser"?"transparent":cur;c.classList.toggle("none",tool==="eraser");c.title=tool==="eraser"?"透明（消しゴム）":cur}
function setCur(h){cur=h;if(tool==="eraser"||tool==="pick")tool="pen";chips();ui()}
function setTool(t){tool=t;chips();ui()}
// ---- 履歴 ----
function meta(o,src){["mode","N","palKey","pal","k","dither"].forEach(function(k){o[k]=Array.isArray(src[k])?src[k].slice():src[k]});return o}
function same(a,b){if(a.w!==b.w||a.h!==b.h||a.mode!=="photo")return false;for(var i=0;i<a.d.length;i++)if(a.d[i]!==b.d[i])return false;return true}
function snap(){return meta({w:out.w,h:out.h,d:new Uint8ClampedArray(out.d)},out)}
// 状態（out）から UI を作り直す。サイズ表示・パレット・写真設定が常に今のキャンバスと一致するように
function restore(s){out=s;mode=s.mode;$("pal").value=s.palKey;$("kRow").hidden=s.palKey!=="auto";pal=s.pal.slice();
 if(s.mode==="photo"){$("grid").value=s.N;$("gridVal").textContent=s.N;$("k").value=s.k;$("kVal").textContent=s.k;$("dither").checked=s.dither}
 syncSize();chips();draw()}
function syncSize(){var sel=$("blankSize"),o=$("photoOpt");
 if(out&&out.mode==="photo"){o.hidden=false;o.textContent="画像から（"+out.w+"×"+out.h+"）";sel.value="photo"}
 else{o.hidden=true;if(out&&out.mode==="blank")sel.value=String(out.w);else if(sel.value==="photo")sel.value="32"}}
function push(){if(!out)return;undoS.push(snap());if(undoS.length>HMAX)undoS.shift();redoS=[];}
function undo(){if(!undoS.length)return;if(out)redoS.push(snap());restore(undoS.pop())}
function redo(){if(!redoS.length)return;if(out)undoS.push(snap());restore(redoS.pop())}
// ---- 変換 ----
function run(force){if(!src||!(force===true||(out&&out.mode==="photo")))return;TsukiLoader.show({caption:"ドットにしてるよ…",size:3});
 setTimeout(function(){try{var t0=performance.now(),N=+$("grid").value;
  if(!cells||cells.N!==N||cells.img!==src){cells=downsample(src,N);cells.N=N;cells.img=src}
  setPal(true);if(!pal.length){toast("透明な画像みたい");return}
  var next=quantize(cells,pal,$("dither").checked);if(out&&!same(out,next)){push();if(edited)toast("変換し直したよ。描いた分は「元に戻す」で戻せるよ",3500)}
  meta(next,{mode:"photo",N:N,palKey:$("pal").value,pal:pal,k:+$("k").value,dither:$("dither").checked});out=next;mode="photo";edited=false;syncSize();chips();drawNow();window.__tsukiMs=performance.now()-t0}
  catch(e){toast("うまく変換できなかった…");throw e}finally{TsukiLoader.hide()}},30)}
function setPal(forPhoto){var p=$("pal").value;if(p==="auto"){if(forPhoto&&cells)pal=kmeans(cells,+$("k").value);else{pal=PRESETS.tsuki.slice();toast("「自動」は写真を読み込んだときに使えるよ。いまは月兼パレットだよ")}}else pal=PRESETS[p].slice()}
function blank(){var v=$("blankSize").value,n=v==="photo"?32:+v;TsukiLoader.show({caption:"白紙を用意中…",size:2});
 setTimeout(function(){try{if(out)push();mode="blank";if($("pal").value==="auto"){$("pal").value="tsuki";$("kRow").hidden=true}setPal();out=meta({w:n,h:n,d:new Uint8ClampedArray(n*n*4)},{mode:"blank",palKey:$("pal").value,pal:pal});edited=false;syncSize();chips();$("beads").checked=false;drawNow();toast(n+"×"+n+" の白紙だよ。描いてみてね")}finally{TsukiLoader.hide()}},30)}
function load(file){$("toast").textContent="";if(!file||!/^image\//.test(file.type)){toast("画像ファイルを選んでね");return}
 TsukiLoader.show({caption:"読み込み中…",size:3});var url=URL.createObjectURL(file),img=new Image();
 img.onload=function(){if(src&&src.__url)URL.revokeObjectURL(src.__url);img.__url=url;src=img;cells=null;TsukiLoader.hide();run(true)};
 img.onerror=function(){TsukiLoader.hide();URL.revokeObjectURL(url);toast("この画像は開けなかった…（HEIC などはブラウザによって読めないことがあるよ。PNG か JPEG に変換してみてね）",5000)};img.src=url}
// ---- お絵かき ----
function cellAt(e){var r=$("preview").getBoundingClientRect();var x=Math.floor((e.clientX-r.left)/r.width*out.w),y=Math.floor((e.clientY-r.top)/r.height*out.h);
 return x<0||y<0||x>=out.w||y>=out.h?null:[x,y]}
function setCell(x,y,c){var p=(y*out.w+x)*4,d=out.d;if(c){if(d[p+3]===255&&d[p]===c[0]&&d[p+1]===c[1]&&d[p+2]===c[2])return false;d[p]=c[0];d[p+1]=c[1];d[p+2]=c[2];d[p+3]=255}
 else{if(!d[p+3])return false;d[p]=d[p+1]=d[p+2]=d[p+3]=0}return true}
function line(a,b,c){var x0=a[0],y0=a[1],x1=b[0],y1=b[1],dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1,er=dx+dy,ch=false;
 for(;;){ch=setCell(x0,y0,c)||ch;if(x0===x1&&y0===y1)break;var e2=2*er;if(e2>=dy){er+=dy;x0+=sx}if(e2<=dx){er+=dx;y0+=sy}}return ch}
function flood(x,y,c){var d=out.d,w=out.w,h=out.h,p0=(y*w+x)*4,t=[d[p0],d[p0+1],d[p0+2],d[p0+3]];
 if(c&&t[3]===255&&t[0]===c[0]&&t[1]===c[1]&&t[2]===c[2])return false;if(!c&&!t[3])return false;
 function same(p){return t[3]?d[p+3]===255&&d[p]===t[0]&&d[p+1]===t[1]&&d[p+2]===t[2]:!d[p+3]}
 var st=[x,y],seen=new Uint8Array(w*h);while(st.length){var yy=st.pop(),xx=st.pop(),i=yy*w+xx;if(seen[i])continue;seen[i]=1;if(!same(i*4))continue;setCell(xx,yy,c);
  if(xx>0)st.push(xx-1,yy);if(xx<w-1)st.push(xx+1,yy);if(yy>0)st.push(xx,yy-1);if(yy<h-1)st.push(xx,yy+1)}return true}
var stroke=null,cv=$("preview");
cv.addEventListener("pointerdown",function(e){if(!out||$("beads").checked||(e.pointerType==="mouse"&&e.button!==0))return;var c=cellAt(e);if(!c)return;e.preventDefault();
 try{cv.setPointerCapture(e.pointerId)}catch(_){}
 var col=tool==="eraser"?null:rgb(cur);
 if(tool==="pick"){var p=(c[1]*out.w+c[0])*4;if(!out.d[p+3]){setTool("eraser");toast("透明なマスだったので消しゴムにしたよ")}else{var h=hex([out.d[p],out.d[p+1],out.d[p+2]]);if(pal.indexOf(h)<0&&custom.indexOf(h)<0)custom.push(h);setCur(h);toast(h+" を拾ったよ")}return}
 var before=snap();
 if(tool==="fill"){if(flood(c[0],c[1],col)){undoS.push(before);if(undoS.length>HMAX)undoS.shift();redoS=[];edited=true;draw()}return}
 stroke={id:e.pointerId,last:c,col:col,before:before,ch:setCell(c[0],c[1],col)};draw()});
cv.addEventListener("pointermove",function(e){if(!stroke||e.pointerId!==stroke.id)return;e.preventDefault();var evs=e.getCoalescedEvents?e.getCoalescedEvents():[e];if(!evs.length)evs=[e];
 evs.forEach(function(ev){var c=cellAt(ev);if(!c)return;if(line(stroke.last,c,stroke.col))stroke.ch=true;stroke.last=c});draw()});
function endStroke(e){if(!stroke||(e&&e.pointerId!==stroke.id))return;if(stroke.ch){undoS.push(stroke.before);if(undoS.length>HMAX)undoS.shift();redoS=[];edited=true}stroke=null;ui()}
cv.addEventListener("pointerup",endStroke);cv.addEventListener("pointercancel",endStroke);cv.addEventListener("lostpointercapture",endStroke);
cv.addEventListener("touchstart",function(e){if(out&&!$("beads").checked)e.preventDefault()},{passive:false});
cv.addEventListener("touchmove",function(e){if(out&&!$("beads").checked)e.preventDefault()},{passive:false});
cv.addEventListener("contextmenu",function(e){e.preventDefault()});
// ---- アイロンビーズ図面 ----
function counts(){var m={},d=out.d;for(var i=0;i<d.length;i+=4){if(d[i+3]!==255)continue;var h=hex([d[i],d[i+1],d[i+2]]);m[h]=(m[h]||0)+1}
 return Object.keys(m).map(function(h){return{hex:h,n:m[h]}}).sort(function(a,b){return b.n-a.n||(a.hex<b.hex?-1:1)})}
function lum(h){var c=rgb(h);return .2126*lin(c[0])+.7152*lin(c[1])+.0722*lin(c[2])}
function beadPanel(){var K=counts(),tot=K.reduce(function(s,k){return s+k.n},0),ul=$("beadList");ul.innerHTML="";
 $("beadSum").textContent=out.w+"×"+out.h+" マス / ビーズ 合計 "+tot+" 個 / "+K.length+" 色";
 K.forEach(function(k,i){var li=document.createElement("li");li.dataset.hex=k.hex;li.dataset.n=k.n;li.innerHTML='<span class="no">'+(i+1)+'</span><span class="chip" style="background:'+k.hex+'"></span><span>'+k.hex+'</span><span class="n">'+k.n+' 個</span>';ul.appendChild(li)})}
function drawChart(c){var K=counts(),idx={},tot=0;K.forEach(function(k,i){idx[k.hex]=i+1;tot+=k.n});var w=out.w,h=out.h,L=Math.max(w,h),labels=[];
 var cs=Math.max(12,Math.min(28,Math.floor(1800/L))),m=Math.max(28,Math.round(cs*1.4)),top=m+30,gw=w*cs,gh=h*cs,colW=200,rowH=26;
 var W=Math.max(gw+m*2,560),cols=Math.max(1,Math.floor((W-m*2)/colW)),rows=Math.ceil(K.length/cols),H=top+gh+24+rows*rowH+40;
 c.width=W;c.height=H;var x=c.getContext("2d");x.fillStyle="#ECE8F0";x.fillRect(0,0,W,H);
 x.fillStyle="#120C1A";x.font="bold 18px ui-monospace,Menlo,monospace";x.textBaseline="middle";x.textAlign="left";
 x.fillText("アイロンビーズ図面  "+w+"×"+h+"  合計 "+tot+" 個 / "+K.length+" 色",m,22);
 var ox=m,oy=top,fs=Math.max(7,Math.floor(cs*(K.length>=10?.42:.52)));x.font="bold "+fs+"px ui-monospace,Menlo,monospace";x.textAlign="center";
 for(var yy=0;yy<h;yy++)for(var xx=0;xx<w;xx++){var p=(yy*w+xx)*4,X=ox+xx*cs,Y=oy+yy*cs;
  if(out.d[p+3]===255){var hh=hex([out.d[p],out.d[p+1],out.d[p+2]]);x.fillStyle=hh;x.fillRect(X,Y,cs,cs);x.fillStyle=lum(hh)>.25?"#120C1A":"#ECE8F0";x.fillText(String(idx[hh]),X+cs/2,Y+cs/2+.5);labels.push(idx[hh])}
  else{labels.push(0);x.fillStyle="#FFFFFF";x.fillRect(X,Y,cs,cs)}}
 x.fillStyle="rgba(18,12,26,.35)";for(var i=0;i<=w;i++)x.fillRect(ox+i*cs,oy,1,gh+1);for(var j=0;j<=h;j++)x.fillRect(ox,oy+j*cs,gw+1,1);
 x.fillStyle="#120C1A";for(i=0;i<=w;i+=10)x.fillRect(ox+i*cs-1,oy,2,gh+1);for(j=0;j<=h;j+=10)x.fillRect(ox,oy+j*cs-1,gw+1,2);
 x.font="11px ui-monospace,Menlo,monospace";x.fillStyle="#4a4352";for(i=0;i<w;i++)if(i===0||(i+1)%5===0)x.fillText(String(i+1),ox+i*cs+cs/2,oy-9);
 x.textAlign="right";for(j=0;j<h;j++)if(j===0||(j+1)%5===0)x.fillText(String(j+1),ox-5,oy+j*cs+cs/2);
 chartGeom={cs:cs,ox:ox,oy:oy,w:w,h:h,W:W,H:H,labels:labels,key:K.map(function(k){return k.hex})};
 var ly=oy+gh+24;x.textAlign="left";x.font="14px ui-monospace,Menlo,monospace";
 K.forEach(function(k,i){var cx=m+(i%cols)*colW,cy=ly+Math.floor(i/cols)*rowH;x.fillStyle="#120C1A";x.textAlign="right";x.fillText(String(i+1),cx+22,cy+11);
  x.fillStyle=k.hex;x.fillRect(cx+30,cy,22,22);x.strokeStyle="#7A6A8C";x.strokeRect(cx+30.5,cy+.5,21,21);x.fillStyle="#120C1A";x.textAlign="left";x.fillText(k.hex+"  "+k.n+" 個",cx+60,cy+11)});
 x.font="11px ui-monospace,Menlo,monospace";x.fillStyle="#7A6A8C";x.textAlign="right";x.fillText("ドット絵メーカー by 月兼ホッパー",W-m,H-16)}
// ---- 保存 ----
var lastUrl=null,chartGeom=null;
function deliver(canvas,name){TsukiLoader.show({caption:"保存の準備中…",size:3});
 canvas.toBlob(function(b){TsukiLoader.hide();if(!b){toast("保存できなかった…");return}
  if(lastUrl)URL.revokeObjectURL(lastUrl);lastUrl=URL.createObjectURL(b);window.__tsukiLastBlob=b;
  if(isIOS()){$("iosImg").src=lastUrl;$("iosOpen").href=lastUrl;$("iosOpen").setAttribute("download",name);$("iosBox").hidden=false;$("iosBox").scrollIntoView({behavior:"smooth",block:"nearest"});return}
  var a=document.createElement("a");a.href=lastUrl;a.download=name;document.body.appendChild(a);a.click();a.remove();toast(name+" を保存したよ")},"image/png")}
function save(){if(!out)return;var S=scaleOf();deliver(enlarge(out,S.s),"dotart_"+out.w+"x"+out.h+"_"+S.s+"x.png")}
function saveChart(){if(!out)return;var c=document.createElement("canvas");drawChart(c);deliver(c,"beads_"+out.w+"x"+out.h+".png")}
// ---- 入力 ----
$("file").onchange=function(e){load(e.target.files[0]);e.target.value=""};$("openBtn").onclick=function(){$("file").click()};
var st=$("stage");st.addEventListener("keydown",function(e){if(!out&&(e.key==="Enter"||e.key===" ")){e.preventDefault();$("file").click()}});
["dragenter","dragover"].forEach(function(t){st.addEventListener(t,function(e){e.preventDefault();st.classList.add("over")})});
["dragleave","drop"].forEach(function(t){st.addEventListener(t,function(e){e.preventDefault();st.classList.remove("over")})});
st.addEventListener("drop",function(e){load(e.dataTransfer.files[0])});
document.addEventListener("paste",function(e){var it=[].slice.call(e.clipboardData.items||[]).find(function(i){return i.type.indexOf("image/")===0});if(it)load(it.getAsFile());else toast("貼り付けられたのは画像じゃないみたい。画像をコピーしてからもう一度試してね")});
document.addEventListener("keydown",function(e){if(!(e.ctrlKey||e.metaKey)||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;var k=e.key.toLowerCase();
 if(k==="z"&&!e.shiftKey){e.preventDefault();undo()}else if((k==="z"&&e.shiftKey)||k==="y"){e.preventDefault();redo()}});
function later(){clearTimeout(deb);deb=setTimeout(run,120)}
$("grid").oninput=function(){$("gridVal").textContent=this.value;later()};
$("k").oninput=function(){$("kVal").textContent=this.value;later()};
$("pal").onchange=function(){$("kRow").hidden=this.value!=="auto";if(out&&out.mode==="photo")run();else{setPal();if(out){out.palKey=this.value;out.pal=pal.slice()}chips();ui()}};
$("dither").onchange=run;$("lines").onchange=draw;$("beads").onchange=function(){if(this.checked&&out)TsukiLoader.show({caption:"図面を作ってるよ…",size:2});setTimeout(function(){drawNow();TsukiLoader.hide()},30)};
[].forEach.call(document.querySelectorAll("input[name=scale]"),function(r){r.onchange=info});
[].forEach.call(document.querySelectorAll(".tool"),function(b){b.onclick=function(){setTool(b.dataset.tool)}});
$("undo").onclick=undo;$("redo").onclick=redo;$("clear").onclick=function(){if(!out)return;push();out=meta({w:out.w,h:out.h,d:new Uint8ClampedArray(out.w*out.h*4)},out);edited=true;draw()};
$("custom").oninput=function(){var h=this.value.toUpperCase();custom=custom.filter(function(c){return c!==h});custom.push(h);if(custom.length>8)custom.shift();setCur(h)};
$("blankBtn").onclick=blank;$("save").onclick=save;$("saveChart").onclick=saveChart;$("iosClose").onclick=function(){$("iosBox").hidden=true};
setPal();chips();info();ui();
window.__dot={size:function(){return out?[out.w,out.h]:null},palette:function(){return pal.slice()},mode:function(){return mode},
 colors:function(){if(!out)return null;var s={},t=0;for(var i=0;i<out.d.length;i+=4){if(!out.d[i+3]){t++;continue}s[hex([out.d[i],out.d[i+1],out.d[i+2]])]=1}return{hex:Object.keys(s),transparent:t}},
 cell:function(x,y){var p=(y*out.w+x)*4;return out.d[p+3]?hex([out.d[p],out.d[p+1],out.d[p+2]]):null},
 state:function(){return out?out.w+"x"+out.h+":"+Array.prototype.join.call(out.d,","):""},counts:function(){return out?counts():[]},
 chartGeom:function(){return chartGeom},sizeSel:function(){var o=$("photoOpt");return[$("blankSize").value,o.hidden,o.textContent]},hist:function(){return[undoS.length,redoS.length]},cur:function(){return cur},
 hash:function(){if(!out)return 0;var h=0;for(var i=0;i<out.d.length;i++)h=(h*31+out.d[i])|0;return h},presets:PRESETS};
})();
