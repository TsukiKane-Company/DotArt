/* tsuki-loader v1 — 月兼重工 像素跳蛛载入动画。无依赖，无网络。 */
(function(){
var SPRITE="data:image/png;base64,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";
var CSS=".tsuki-loader{display:inline-flex;flex-direction:column;align-items:center;gap:8px;font:12px/1.4 ui-monospace,monospace;color:inherit}"+
".tsuki-loader__plate{display:inline-block;line-height:0;border-radius:12px}"+
".tsuki-loader[data-plate=on] .tsuki-loader__plate{background:#ECE8F0;padding:calc(6px*var(--tl-s))}"+
"@media (prefers-color-scheme:dark){.tsuki-loader[data-plate=auto] .tsuki-loader__plate{background:#ECE8F0;padding:calc(6px*var(--tl-s))}}"+
".tsuki-loader__sprite{display:block;width:calc(48px*var(--tl-s));height:calc(48px*var(--tl-s));background:url("+SPRITE+") 0 0/calc(384px*var(--tl-s)) calc(48px*var(--tl-s)) no-repeat;image-rendering:pixelated;animation:tsuki-hop .8s steps(8) infinite}"+
"@keyframes tsuki-hop{to{background-position-x:calc(-384px*var(--tl-s))}}"+
"@media (prefers-reduced-motion:reduce){.tsuki-loader__sprite{animation:none;background-position-x:calc(-336px*var(--tl-s))}}"+
".tsuki-overlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(18,12,26,.55);z-index:2147483000;color:#ECE8F0}";
function css(){if(!document.getElementById("tsuki-loader-css")){var s=document.createElement("style");s.id="tsuki-loader-css";s.textContent=CSS;document.head.appendChild(s);}}
class TL extends HTMLElement{
 static get observedAttributes(){return["size","caption","plate"];}
 connectedCallback(){css();this.render();}
 attributeChangedCallback(){if(this.isConnected)this.render();}
 render(){var s=parseInt(this.getAttribute("size"),10);if([1,2,3].indexOf(s)<0)s=2;
  var p=this.getAttribute("plate");if(["on","off","auto"].indexOf(p)<0)p="auto";
  this.className="tsuki-loader";this.dataset.plate=p;this.style.setProperty("--tl-s",s);
  this.setAttribute("role","status");this.setAttribute("aria-live","polite");
  this.innerHTML='<span class="tsuki-loader__plate"><span class="tsuki-loader__sprite" aria-hidden="true"></span></span>';
  var c=this.getAttribute("caption");if(c){var t=document.createElement("span");t.className="tsuki-loader__caption";t.textContent=c;this.appendChild(t);}
  else this.setAttribute("aria-label","読み込み中");}
}
if(!customElements.get("tsuki-loader"))customElements.define("tsuki-loader",TL);
var ov=null;
window.TsukiLoader={show:function(o){o=o||{};this.hide();css();ov=document.createElement("div");ov.className="tsuki-overlay";
  var l=document.createElement("tsuki-loader");l.setAttribute("size",o.size||3);l.setAttribute("plate",o.plate||"on");if(o.caption)l.setAttribute("caption",o.caption);
  ov.appendChild(l);document.body.appendChild(ov);return ov;},
 hide:function(){if(ov){ov.remove();ov=null;}}};
})();
