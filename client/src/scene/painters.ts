// @ts-nocheck
/* Vendored from design/style-b.html (the confirmed "Inked Noir Deco" reference build):
   procedural painted-scenery layers, station palettes and texture helpers.
   Station 5 (`dark`, the Last Platform) and the `lanterns` painter are additions. */
import * as THREE from 'three';

const mk=s=>()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
const cnv=(W,H)=>{const c=document.createElement('canvas');c.width=W;c.height=H;return c};
const _c=new THREE.Color();
const rgb=h=>{_c.setStyle(h,THREE.SRGBColorSpace);const o=_c.getRGB({},THREE.SRGBColorSpace);return[o.r*255|0,o.g*255|0,o.b*255|0]};
const rgba=(h,a)=>{const[r,g,b]=rgb(h);return`rgba(${r},${g},${b},${a})`};
const mix=(a,b,t)=>{const A=rgb(a),B=rgb(b);return'#'+A.map((v,i)=>Math.round(v+(B[i]-v)*t).toString(16).padStart(2,'0')).join('')};
const variants=(h,n,amt,r)=>{const out=[];for(let i=0;i<n;i++)out.push(mix(h,r()<.5?'#000000':'#ffffff',r()*amt));return out};
const W2=(W,cx,rad,f)=>{f(cx);if(cx-rad<0)f(cx+W);if(cx+rad>W)f(cx-W)};
const periodic=(W,r,oct)=>{const ph=oct.map(()=>r()*6.2832),s=oct.reduce((a,o)=>a+o[1],0);return x=>{let v=0;for(let i=0;i<oct.length;i++)v+=oct[i][1]*Math.sin(6.2832*oct[i][0]*x/W+ph[i]);return v/s}};
const OCT_M=[[3,1],[7,.55],[13,.32],[29,.16],[61,.08],[131,.04]];
const OCT_H=[[5,1],[11,.5],[23,.25],[53,.12],[107,.06]];
function puff(x,cx,cy,r,col,a){const g=x.createRadialGradient(cx,cy,0,cx,cy,r);g.addColorStop(0,rgba(col,a));g.addColorStop(1,rgba(col,0));x.fillStyle=g;x.beginPath();x.arc(cx,cy,r,0,6.2832);x.fill()}
function grain(x,W,H,r,dens=1,a=.05){x.save();x.globalCompositeOperation='source-atop';const n=W*H/320*dens;for(let i=0;i<n;i++){const px=r()*W,py=r()*H;x.strokeStyle=r()<.5?`rgba(255,255,255,${a})`:`rgba(0,0,0,${a*1.5})`;x.lineWidth=1+r()*2.2;x.beginPath();x.moveTo(px,py);x.lineTo(px+(r()-.5)*12,py+(r()-.5)*7);x.stroke()}x.restore()}
function hazeBottom(x,W,H,col,from,a){x.save();x.globalCompositeOperation='source-atop';const g=x.createLinearGradient(0,H*from,0,H);g.addColorStop(0,rgba(col,0));g.addColorStop(1,rgba(col,a));x.fillStyle=g;x.fillRect(0,0,W,H);x.restore()}
function poly(x,pts){x.beginPath();x.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)x.lineTo(pts[i][0],pts[i][1]);x.closePath()}

/* ============================ painters ============================ */
function branch(x,sx,sy,len,ang,w,depth,col,r,spread=1){
  const ex=sx+Math.cos(ang)*len,ey=sy+Math.sin(ang)*len;
  x.strokeStyle=col;x.lineWidth=Math.max(.8,w);x.lineCap='round';x.beginPath();x.moveTo(sx,sy);
  x.quadraticCurveTo((sx+ex)/2+(r()-.5)*len*.35*spread,(sy+ey)/2+(r()-.5)*len*.25*spread,ex,ey);x.stroke();
  if(depth<=1)return[[ex,ey]];
  const n=r()<.3?3:2;let tips=[];
  for(let k=0;k<n;k++)tips=tips.concat(branch(x,ex,ey,len*(.62+r()*.2),ang+((k-(n-1)/2)*.62+(r()-.5)*.5)*spread,w*.66,depth-1,col,r,spread));
  return tips;
}
function blob(x,cx,cy,R,o,r){
  const n=Math.max(10,Math.min(150,R*1.1|0));
  x.fillStyle=o.sh||mix(o.col,'#000000',.35);
  for(let i=0;i<n*.55;i++){const a=r()*6.2832,d=Math.sqrt(r())*R,rr=R*(.14+r()*.18);x.beginPath();x.ellipse(cx+Math.cos(a)*d*1.15,cy+Math.sin(a)*d*.75+R*.2,rr,rr*.8,r()*3,0,6.2832);x.fill()}
  for(let i=0;i<n;i++){const a=r()*6.2832,d=Math.sqrt(r())*R,rr=R*(.12+r()*.18);x.fillStyle=o.vars?o.vars[(r()*o.vars.length)|0]:o.col;x.beginPath();x.ellipse(cx+Math.cos(a)*d*1.1,cy+Math.sin(a)*d*.7,rr,rr*.8,r()*3,0,6.2832);x.fill()}
  if(o.hi){x.globalAlpha=o.hiA??.4;x.fillStyle=o.hi;for(let i=0;i<n*.45;i++){const a=-1.5708+(r()-.5)*2+(o.light||0)*.7,d=R*(.45+r()*.55),rr=R*(.06+r()*.11);x.beginPath();x.ellipse(cx+Math.cos(a)*d*1.05,cy+Math.sin(a)*d*.72,rr,rr*.7,r()*3,0,6.2832);x.fill()}x.globalAlpha=1}
}
function dTree(x,cx,base,h,o,r){
  const tips=branch(x,cx,base,h*.32,-1.5708+(r()-.5)*.2,Math.max(1.5,h*.045),5,o.trunk||o.col,r);
  const R=h*.2;
  blob(x,cx+(r()-.5)*h*.08,base-h*.64,R*1.25,o,r);
  tips.filter(()=>r()<.45).slice(0,8).forEach(([tx,ty])=>blob(x,tx,Math.max(ty,base-h*.98),R*(.5+r()*.35),o,r));
}
function pineTree(x,cx,base,h,o,r){
  x.strokeStyle=o.col;x.lineWidth=Math.max(1,h*.03);x.beginPath();x.moveTo(cx,base);x.lineTo(cx,base-h*.95);x.stroke();
  const tiers=Math.max(4,Math.min(12,h/9|0));
  for(let i=0;i<tiers;i++){
    const t=i/tiers,y=base-h*.06-t*h*.84,w=h*(.25*(1-t)+.035),th=h*.84/tiers*1.7;
    const pts=[[cx,y-th]];
    for(let s=1;s<=4;s++){const u=s/4;pts.push([cx-w*u+(r()-.5)*w*.15,y-th+th*u+(r()-.5)*th*.12])}
    for(let s=1;s<6;s++){const u=s/6;pts.push([cx-w+2*w*u,y+(r()-.25)*th*.22])}
    for(let s=4;s>=1;s--){const u=s/4;pts.push([cx+w*u+(r()-.5)*w*.15,y-th+th*u+(r()-.5)*th*.12])}
    x.fillStyle=o.vars?o.vars[(r()*o.vars.length)|0]:o.col;poly(x,pts);x.fill();
    if(o.hi){const e=(o.light||1)>0?pts.slice(-4):pts.slice(1,5);x.strokeStyle=rgba(o.hi,.4);x.lineWidth=Math.max(1,th*.1);x.beginPath();x.moveTo(pts[0][0],pts[0][1]);e.forEach(p=>x.lineTo(p[0],p[1]));x.stroke()}
    if(o.snow){x.lineCap='round';const L=(o.light||-1)<0;
      x.strokeStyle=rgba(o.snow,.85);x.lineWidth=Math.max(1.2,th*.15);x.beginPath();x.moveTo(pts[0][0],pts[0][1]+th*.08);(L?pts.slice(1,5):pts.slice(-4).reverse()).forEach(p=>x.lineTo(p[0]+(L?w*.04:-w*.04),p[1]-th*.07));x.stroke();
      x.globalAlpha=.35;x.lineWidth=Math.max(1,th*.1);x.beginPath();x.moveTo(pts[0][0],pts[0][1]+th*.08);(L?pts.slice(-4).reverse():pts.slice(1,5)).forEach(p=>x.lineTo(p[0]+(L?-w*.04:w*.04),p[1]-th*.07));x.stroke();x.globalAlpha=1}
  }
}
function gnarled(x,cx,base,h,o,r){
  const w=h*.065;
  x.fillStyle=o.col;x.beginPath();x.moveTo(cx-w*2.6,base);x.bezierCurveTo(cx-w,base-h*.05,cx-w*1.4,base-h*.26,cx-w*.6,base-h*.46);x.lineTo(cx+w*.45,base-h*.48);x.bezierCurveTo(cx+w*1.5,base-h*.26,cx+w*.9,base-h*.06,cx+w*2.8,base);x.closePath();x.fill();
  const tips=[];for(let k=0;k<4;k++)tips.push(...branch(x,cx+(r()-.5)*w,base-h*.43,h*.2,-1.5708+(k-1.5)*.55+(r()-.5)*.4,w*.7,5,o.col,r,1.35));
  if(o.leaf)tips.filter(()=>r()<.22).forEach(([tx,ty])=>blob(x,tx,ty,h*.06,o.leaf,r));
  if(o.moss){x.strokeStyle=rgba(o.moss,.55);x.lineWidth=1.3;tips.filter(()=>r()<.4).forEach(([tx,ty])=>{const L=h*(.03+r()*.11);x.beginPath();x.moveTo(tx,ty);x.quadraticCurveTo(tx+(r()-.5)*6,ty+L*.5,tx+(r()-.5)*4,ty+L);x.stroke()})}
  if(o.rim){x.strokeStyle=rgba(o.rim,.3);x.lineWidth=w*.25;x.beginPath();x.moveTo(cx-w*.55,base-h*.45);x.bezierCurveTo(cx-w*1.3,base-h*.26,cx-w*.9,base-h*.06,cx-w*2.4,base);x.stroke()}
}
function fern(x,sx,sy,L,ang,col,r){
  const ex=sx+Math.cos(ang)*L,ey=sy+Math.sin(ang)*L*.7,cx=sx+Math.cos(ang)*L*.5,cy=sy+Math.sin(ang)*L*.9-L*.25;
  x.strokeStyle=col;x.lineWidth=1.6;x.beginPath();x.moveTo(sx,sy);x.quadraticCurveTo(cx,cy,ex,ey);x.stroke();
  x.lineWidth=1.2;for(let t=.1;t<.98;t+=.07){const px=(1-t)*(1-t)*sx+2*(1-t)*t*cx+t*t*ex,py=(1-t)*(1-t)*sy+2*(1-t)*t*cy+t*t*ey;const l=L*.2*(1-t)+2;
    for(const s of[-1,1]){x.beginPath();x.moveTo(px,py);x.lineTo(px+Math.cos(ang+s*1.1)*l,py+Math.sin(ang+s*1.1)*l*.8+l*.25);x.stroke()}}
}
function grass(x,W,H,r,col,n,tip){x.lineCap='round';for(let i=0;i<n;i++){const bx=r()*W,h=H*(.12+r()*.45),lean=(r()-.5)*h*.7;x.strokeStyle=col;x.lineWidth=1+r()*2;x.beginPath();x.moveTo(bx,H);x.quadraticCurveTo(bx+lean*.2,H-h*.6,bx+lean,H-h);x.stroke();if(tip&&r()<.4){x.strokeStyle=tip;x.lineWidth=2;x.beginPath();x.moveTo(bx+lean*.8,H-h*.92);x.lineTo(bx+lean,H-h);x.stroke()}}}
function tower(x,cx,base,w,h,o,r){
  const top=base-h,pts=[[cx-w/2,base],[cx-w/2,top+r()*h*.08]];const n=3+(r()*4|0);
  for(let i=1;i<n;i++)pts.push([cx-w/2+w*i/n,top+(r()<.5?r()*h*.16:0)]);
  pts.push([cx+w/2,top+r()*h*.1],[cx+w/2,base]);
  x.fillStyle=o.col;poly(x,pts);x.fill();
  const cols=Math.max(2,w/10|0),rows=Math.max(3,h/12|0);
  for(let i=0;i<cols;i++)for(let j=1;j<rows;j++){const wx=cx-w/2+w*(i+.3)/cols,wy=top+h*j/rows;if(r()<o.lit){x.shadowColor=o.win;x.shadowBlur=8;x.fillStyle=o.win;x.fillRect(wx,wy,Math.max(2,w/cols*.35),Math.max(2,h/rows*.4));x.shadowBlur=0}else{x.fillStyle='rgba(0,0,0,.28)';x.fillRect(wx,wy,Math.max(2,w/cols*.35),Math.max(2,h/rows*.4))}}
  if(o.vine){x.fillStyle=o.vine;for(let k=0;k<w*h/500;k++){const px=cx+(r()-.5)*w,py=base-r()*r()*h,rr=2+r()*w*.08;x.beginPath();x.ellipse(px,py,rr,rr*.7,r()*3,0,6.2832);x.fill()}}
}
function spireTower(x,cx,base,h,w,o){
  x.fillStyle=o.col;let y=base,ww=w;
  for(let k=0;k<5;k++){const th=h*(k?.12:.38);x.fillRect(cx-ww/2,y-th,ww,th);y-=th;ww*=.72}
  x.beginPath();x.moveTo(cx-ww*.4,y);x.lineTo(cx,y-h*.22);x.lineTo(cx+ww*.4,y);x.closePath();x.fill();
  x.fillStyle=o.win;x.shadowColor=o.win;x.shadowBlur=10;x.beginPath();x.arc(cx,base-h*.5,w*.08,0,6.2832);x.fill();x.shadowBlur=0;
}
function pagoda(x,cx,base,h,w,col,r){
  const n=3+(r()*3|0);let y=base;
  for(let k=0;k<n;k++){const th=h/n,wt=w*(1-k*.16);x.fillStyle=col;x.fillRect(cx-wt*.35,y-th*.75,wt*.7,th*.75);
    x.beginPath();x.moveTo(cx-wt*.75,y-th*.6);x.quadraticCurveTo(cx-wt*.45,y-th*.72,cx-wt*.3,y-th);x.lineTo(cx+wt*.3,y-th);x.quadraticCurveTo(cx+wt*.45,y-th*.72,cx+wt*.75,y-th*.6);x.closePath();x.fill();y-=th}
  x.fillRect(cx-1,y-h*.15,2,h*.15);
}
function house(x,cx,base,w,h,o,r){
  x.fillStyle=o.col;x.fillRect(cx-w/2,base-h,w,h);
  const rh=h*(.5+r()*.4),top=base-h;
  x.beginPath();x.moveTo(cx-w*.75,top+h*.08);x.quadraticCurveTo(cx-w*.55,top-rh*.12,cx-w*.22,top-rh);x.lineTo(cx+w*.22,top-rh);x.quadraticCurveTo(cx+w*.55,top-rh*.12,cx+w*.75,top+h*.08);x.closePath();x.fill();
  if(r()<.4){x.save();x.globalCompositeOperation='destination-out';x.beginPath();x.ellipse(cx+(r()-.5)*w*.4,top-rh*.6,w*.18,rh*.35,r(),0,6.2832);x.fill();x.restore()}
  if(r()<.6){x.shadowColor=o.win;x.shadowBlur=10;x.fillStyle=o.win;x.fillRect(cx-w*.15,base-h*.6,w*.16,h*.22);x.shadowBlur=0}
}
function flame(x,cx,base,h,w,r){
  puff(x,cx,base-h*.2,h*.95,'#ff7020',.22);
  for(let k=0;k<7;k++){const hh=h*(.35+r()*.65),ww=w*(.25+r()*.45),ox=(r()-.5)*w*.9,tx=cx+ox+(r()-.5)*ww*1.6;
    const g=x.createLinearGradient(0,base,0,base-hh);g.addColorStop(0,'rgba(255,245,205,.95)');g.addColorStop(.3,'rgba(255,170,60,.8)');g.addColorStop(.7,'rgba(230,70,20,.4)');g.addColorStop(1,'rgba(160,20,10,0)');
    x.fillStyle=g;x.beginPath();x.moveTo(cx+ox-ww,base);x.bezierCurveTo(cx+ox-ww,base-hh*.4,tx-ww*.4,base-hh*.7,tx,base-hh);x.bezierCurveTo(tx+ww*.4,base-hh*.6,cx+ox+ww,base-hh*.35,cx+ox+ww,base);x.closePath();x.fill()}
}

/* ---- layer painters (x, W, H, r, o) ---- */
const PAINT={
mountains(x,W,H,r,o){
  o.ranges.forEach(g=>{
    const f=periodic(W,r,OCT_M),ys=[];for(let i=0;i<=W;i+=3)ys.push(H*g.base-H*g.amp*(1-Math.abs(f(i))*2+1)/2);
    const path=(dx=0,dy=0)=>{x.beginPath();x.moveTo(0,H);ys.forEach((y,k)=>x.lineTo(k*3+dx,y+dy));x.lineTo(W,H);x.closePath()};
    const gr=x.createLinearGradient(0,H*(g.base-g.amp),0,H);gr.addColorStop(0,mix(g.col,o.rim,.18));gr.addColorStop(1,mix(g.col,o.haze,.6));
    path();x.fillStyle=gr;x.fill();
    x.save();path();x.clip();
    if(o.snow){const sg=x.createLinearGradient(0,H*(g.base-g.amp),0,H*g.base);sg.addColorStop(0,o.snow);sg.addColorStop(.55,rgba(o.snow,.7));sg.addColorStop(1,rgba(o.snow,0));x.fillStyle=sg;x.fillRect(0,0,W,H)}
    path(-o.light*W*.006,H*.035);x.fillStyle=rgba(mix(g.col,o.shadow||'#000000',.35),o.snow?.55:.6);x.fill();
    x.strokeStyle=rgba(o.rock||mix(g.col,'#000000',.4),.28);
    for(let i=0;i<W/5;i++){const px=r()*W,k=Math.min(ys.length-1,Math.round(px/3)),py=ys[k];x.lineWidth=1+r()*2.5;x.beginPath();x.moveTo(px,py+3);x.quadraticCurveTo(px+(r()-.5)*14,py+H*.08,px+(r()-.5)*30,py+H*(.08+r()*.22));x.stroke()}
    x.restore();
  });
  hazeBottom(x,W,H,o.haze,.45,.75);grain(x,W,H,r,.8,.04);
},
treeline(x,W,H,r,o){
  const f=periodic(W,r,OCT_H),by=i=>H*o.base-H*.05*f(i);
  x.beginPath();x.moveTo(0,H);for(let i=0;i<=W;i+=4)x.lineTo(i,by(i)+H*.05);x.lineTo(W,H);x.closePath();x.fillStyle=o.col;x.fill();
  const vars=variants(o.col,5,.07,r);
  for(let i=0;i<o.n;i++){const cx=r()*W,h=H*(o.hmin+r()*(o.hmax-o.hmin)),b=by(cx)+H*.07,s=r()*1e9|0,p=r()<o.pine;
    W2(W,cx,h*.4,X=>{const q=mk(s);p?pineTree(x,X,b,h,{col:o.col,vars,snow:o.snow,hi:o.hi,light:o.light},q):blob(x,X,b-h*.55,h*.36,{col:o.col,vars,hi:o.hi,light:o.light,hiA:.25},q)})}
  hazeBottom(x,W,H,o.haze,.5,.6);grain(x,W,H,r,.8,.04);
},
mist(x,W,H,r,o){for(let i=0;i<W/14;i++){const cx=r()*W,cy=H*(.5+(r()-.5)*.35),rad=H*(.22+r()*.35);W2(W,cx,rad,X=>puff(x,X,cy,rad,o.col,o.a))}},
shafts(x,W,H,r,o){for(let i=0;i<o.n;i++){const cx=W*(.1+r()*.9),w=W*(.008+r()*.025);const g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,rgba(o.col,o.a));g.addColorStop(.7,rgba(o.col,o.a*.4));g.addColorStop(1,rgba(o.col,0));x.fillStyle=g;
  W2(W,cx,H,X=>{x.beginPath();x.moveTo(X,0);x.lineTo(X+w,0);x.lineTo(X+w-H*o.slant,H);x.lineTo(X-H*o.slant-w*1.6,H);x.closePath();x.fill()})}},
forestMid(x,W,H,r,o){
  const vars=variants(o.col,5,.07,r),it=[];
  for(let i=0;i<o.n;i++)it.push({cx:r()*W,h:H*(.5+r()*.3),p:r()<.4,s:r()*1e9|0});
  it.sort((a,b)=>b.h-a.h).forEach(t=>W2(W,t.cx,t.h*.45,X=>{const q=mk(t.s);t.p?pineTree(x,X,H,t.h,{col:o.col,vars,hi:o.hi,light:o.light},q):dTree(x,X,H,t.h,{col:o.col,trunk:o.trunk,vars,hi:o.hi,light:o.light,hiA:.3},q)}));
  for(let i=0;i<W/18;i++){const cx=r()*W,R=H*(.04+r()*.06),s=r()*1e9|0;W2(W,cx,R*1.3,X=>blob(x,X,H-R*.4,R,{col:o.col,vars,hi:o.hi,light:o.light,hiA:.2},mk(s)))}
  hazeBottom(x,W,H,o.haze,.55,.35);grain(x,W,H,r,1,.05);
},
bigForest(x,W,H,r,o){
  for(let i=0;i<o.n;i++){const cx=(i+.5)*W/o.n+(r()-.5)*W/o.n*.5,w=W*(.014+r()*.012),s=r()*1e9|0;
    W2(W,cx,W/o.n,X=>{const q=mk(s),h=H,T=h*.3;   // trunk top sits inside the crown, which stays fully inside the panel
      x.fillStyle=o.col;x.beginPath();x.moveTo(X-w*2.1,h);x.quadraticCurveTo(X-w*.7,h*.96,X-w*.6,h*.8);x.lineTo(X-w*.36,T);x.lineTo(X+w*.36,T);x.lineTo(X+w*.6,h*.8);x.quadraticCurveTo(X+w*.7,h*.96,X+w*2.1,h);x.closePath();x.fill();
      const sd=o.light>0?1:-1,g=x.createLinearGradient(X+sd*w*.1,0,X+sd*w*.6,0);g.addColorStop(0,rgba(o.rim,0));g.addColorStop(1,rgba(o.rim,.5));x.fillStyle=g;
      x.beginPath();x.moveTo(X+sd*w*.14,T);x.lineTo(X+sd*w*.36,T);x.lineTo(X+sd*w*.6,h*.8);x.lineTo(X+sd*w*.2,h*.8);x.closePath();x.fill();
      x.strokeStyle='rgba(0,0,0,.3)';for(let k=0;k<16;k++){const bx=X+(q()-.5)*w*.7,y0=T+q()*(h-T);x.lineWidth=1+q()*2;x.beginPath();x.moveTo(bx,y0);x.lineTo(bx+(q()-.5)*3,Math.min(h,y0+h*(.05+q()*.12)));x.stroke()}
      for(let k=0;k<4;k++)branch(x,X,h*(.34+q()*.2),h*.12,-1.5708+(q()<.5?-1:1)*(.55+q()*.4),w*.28,3,o.col,q);
      const v=variants(o.leaf,4,.06,q);
      for(let k=0;k<10;k++){const a=k/10,R=h*(.08+q()*.05);blob(x,X+(a-.5)*h*.62+(q()-.5)*h*.06,h*(.2+q()*.14)+Math.abs(a-.5)*h*.12,R,{col:o.leaf,vars:v,hi:o.hi,light:o.light,hiA:.4},q)}
    })}
  grain(x,W,H,r,.7,.05);
},
undergrowth(x,W,H,r,o){
  const f=periodic(W,r,OCT_H);if(!o.sparse){x.beginPath();x.moveTo(0,H);for(let i=0;i<=W;i+=4)x.lineTo(i,H*.66-H*.12*f(i));x.lineTo(W,H);x.closePath();x.fillStyle=o.col;x.fill()}
  const vars=variants(o.col,4,.07,r);
  for(let i=0;i<W/(o.sparse?90:o.dense?13:20);i++){const cx=r()*W,R=H*(.16+r()*.22),s=r()*1e9|0;W2(W,cx,R*1.3,X=>blob(x,X,H*.62-R*.15,R,{col:o.col,vars,hi:o.hi,hiA:.3,light:o.light||1},mk(s)))}
  if(o.ferns)for(let i=0;i<W/(o.sparse?60:34);i++){const cx=r()*W,s=r()*1e9|0,L=H*(.35+r()*.45);W2(W,cx,L,X=>{const q=mk(s);for(let k=0;k<5;k++)fern(x,X,H*.8,L*(.6+q()*.4),-1.5708+(k-2)*.5+(q()-.5)*.2,o.col,q)})}
  grass(x,W,H,r,o.col,W/(o.sparse?9:o.dense?2.5:5),o.tip);
},
farRuins(x,W,H,r,o){
  const f=periodic(W,r,OCT_H);x.beginPath();x.moveTo(0,H);for(let i=0;i<=W;i+=4)x.lineTo(i,H*.8-H*.07*f(i));x.lineTo(W,H);x.closePath();x.fillStyle=o.hill;x.fill();
  for(let i=0;i<30;i++){const cx=r()*W,h=H*(.18+r()*.5),w=W*(.006+r()*.012),s=r()*1e9|0,t=r();
    W2(W,cx,w*2,X=>{const q=mk(s);if(t<.4)pagoda(x,X,H*.84,h,w*1.6,o.col,q);else if(t<.75)tower(x,X,H*.84,w,h,{col:o.col,win:o.win,lit:.06},q);else{x.fillStyle=o.col;x.fillRect(X-w,H*.84-h*.5,w*2,h*.5);x.beginPath();x.arc(X,H*.84-h*.5,w,3.1416,0);x.fill()}})}
  for(let i=0;i<60;i++){const cx=r()*W,cy=H*(.7+r()*.12);x.fillStyle=o.win;x.globalAlpha=.7;x.fillRect(cx,cy,2,2);x.globalAlpha=1}
  hazeBottom(x,W,H,o.haze,.35,.85);grain(x,W,H,r,.6,.04);
},
swampTrees(x,W,H,r,o){
  for(let i=0;i<o.gates;i++){const cx=r()*W,s=r()*1e9|0;W2(W,cx,H*.3,X=>{const q=mk(s);x.save();x.translate(X,H*.93);x.rotate((q()-.5)*.35);const gc=o.stone;x.fillStyle=gc;const gw=H*.22,gh=H*.42;x.fillRect(-gw/2,-gh,gw*.18,gh);x.fillRect(gw/2-gw*.18,-gh,gw*.18,gh);x.fillRect(-gw*.65,-gh-H*.05,gw*1.3,H*.05);x.fillRect(-gw*.5,-gh+H*.03,gw,H*.03);x.fillStyle=rgba(o.rimc,.25);x.fillRect(-gw*.65,-gh-H*.05,gw*1.3,3);x.restore()})}
  const it=[];for(let i=0;i<o.n;i++)it.push({cx:(i+.5)*W/o.n+(r()-.5)*W/o.n*.6,h:H*(.75+r()*.25),s:r()*1e9|0});
  it.forEach(t=>W2(W,t.cx,t.h*.6,X=>gnarled(x,X,H*.97,t.h,{col:o.col,leaf:{col:o.leafc,vars:variants(o.leafc,4,.06,mk(t.s)),hi:o.hi,hiA:.3},moss:o.moss,rim:o.rimc},mk(t.s))));
  hazeBottom(x,W,H,o.haze,.6,.7);grain(x,W,H,r,.8,.05);
},
swampNear(x,W,H,r,o){
  for(let i=0;i<o.n;i++){const cx=r()*W,s=r()*1e9|0,t=r();W2(W,cx,H*.5,X=>{const q=mk(s);
    if(t<.45)gnarled(x,X,H,H*(.6+q()*.35),{col:o.col,moss:o.moss,rim:o.rimc},q);
    else if(t<.75){const w=H*(.14+q()*.1),h=H*.06;x.save();x.translate(X,H*1.01);x.rotate((q()-.5)*.4);x.fillStyle=o.col;x.fillRect(-w*.4,-h,w*.8,h);x.beginPath();x.moveTo(-w*.6,-h);x.lineTo(0,-h-w*.45);x.lineTo(w*.6,-h);x.closePath();x.fill();x.strokeStyle=rgba(o.rimc,.35);x.lineWidth=3;x.beginPath();x.moveTo(-w*.6,-h);x.lineTo(0,-h-w*.45);x.stroke();x.restore()}
    else{x.fillStyle=o.col;for(let k=0;k<5;k++){const ph=H*(.12+q()*.25);x.save();x.translate(X+k*H*.06,H);x.rotate((q()-.5)*.3);x.fillRect(-3,-ph,6,ph);x.restore()}}})}
  grain(x,W,H,r,.6,.05);
},
reeds(x,W,H,r,o){
  if(o.lily){x.fillStyle=o.col;for(let i=0;i<W/30;i++){x.beginPath();x.ellipse(r()*W,H*(.9+r()*.08),8+r()*16,3+r()*3,0,0,6.2832);x.fill()}}
  x.lineCap='round';
  for(let i=0;i<o.n;i++){const bx=r()*W,h=H*(.35+r()*.6),lean=(r()-.5)*h*.25;x.strokeStyle=o.col;x.lineWidth=1.5+r()*1.5;x.beginPath();x.moveTo(bx,H);x.quadraticCurveTo(bx,H-h*.5,bx+lean,H-h);x.stroke();
    if(r()<.45){x.fillStyle=o.head||o.col;x.beginPath();x.ellipse(bx+lean*.92,H-h*.88,3+r()*2,h*.07,lean/h,0,6.2832);x.fill()}
    if(r()<.6){const l=h*(.4+r()*.5),s=r()<.5?-1:1;x.lineWidth=2.5;x.beginPath();x.moveTo(bx,H);x.quadraticCurveTo(bx+s*l*.15,H-l*.6,bx+s*l*.45,H-l*.9);x.stroke()}}
},
skyline(x,W,H,r,o){
  const it=[];for(let i=0;i<46;i++)it.push({cx:r()*W,w:W*(.008+r()*.022),h:H*(.25+r()*.65),s:r()*1e9|0});
  it.sort((a,b)=>b.h-a.h).forEach(t=>W2(W,t.cx,t.w,X=>tower(x,X,H,t.w,t.h,{col:o.col,win:o.win,lit:.07,vine:o.vine},mk(t.s))));
  for(let k=0;k<2;k++){const cx=r()*W;W2(W,cx,W*.03,X=>spireTower(x,X,H,H*.97,W*.03,o))}
  for(let k=0;k<3;k++){const cx=r()*W,h=H*(.6+r()*.3);W2(W,cx,H*.3,X=>{x.strokeStyle=o.col;x.lineWidth=4;x.beginPath();x.moveTo(X,H);x.lineTo(X,H-h);x.lineTo(X+H*.28,H-h);x.moveTo(X-H*.08,H-h);x.lineTo(X,H-h);x.stroke();x.lineWidth=1.5;x.beginPath();x.moveTo(X+H*.24,H-h);x.lineTo(X+H*.24,H-h+H*.2);x.stroke()})}
  x.save();x.globalCompositeOperation='source-atop';const g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,rgba(o.glow,.05));g.addColorStop(.6,rgba(o.glow,.18));g.addColorStop(1,rgba(o.glow,.6));x.fillStyle=g;x.fillRect(0,0,W,H);x.restore();
  grain(x,W,H,r,.7,.05);
},
smoke(x,W,H,r,o){for(let i=0;i<o.n;i++){const cx=r()*W,s=r()*1e9|0;W2(W,cx,H*.7,X=>{const q=mk(s);let px=X,py=H*.98;for(let k=0;k<16;k++){const rad=H*(.05+k*.022)*(.8+q()*.4);puff(x,px,py,rad,o.col,.28);if(k<6)puff(x,px,py+rad*.25,rad*.75,o.glow,.1);px+=(q()-.25)*rad*.45;py-=rad*.42}})}},
flames(x,W,H,r,o){x.globalCompositeOperation='lighter';for(let i=0;i<o.n;i++){const cx=r()*W,base=H*(o.base+r()*.04),h=H*(o.hmin+r()*(o.hmax-o.hmin)),w=h*.35,s=r()*1e9|0;W2(W,cx,w*2.2,X=>flame(x,X,base,h,w,mk(s)))}x.globalCompositeOperation='source-over'},
village(x,W,H,r,o){
  const f=periodic(W,r,OCT_H);x.beginPath();x.moveTo(0,H);for(let i=0;i<=W;i+=4)x.lineTo(i,H*.9-H*.04*f(i));x.lineTo(W,H);x.closePath();x.fillStyle=o.col;x.fill();
  for(let i=0;i<30;i++){const cx=r()*W,w=W*(.014+r()*.022),h=H*(.2+r()*.3),s=r()*1e9|0;W2(W,cx,w,X=>house(x,X,H*.93,w,h,o,mk(s)))}
  x.strokeStyle=o.col;x.lineCap='butt';for(let i=0;i<14;i++){const cx=r()*W,h=H*(.45+r()*.4),s=r()*1e9|0;W2(W,cx,30,X=>{const q=mk(s);x.save();x.translate(X,H*.93);x.rotate((q()-.5)*.15);x.lineWidth=5;x.beginPath();x.moveTo(0,0);x.lineTo(0,-h);x.stroke();x.lineWidth=3;x.beginPath();x.moveTo(-h*.12,-h*.88);x.lineTo(h*.12,-h*.88);x.moveTo(-h*.09,-h*.78);x.lineTo(h*.09,-h*.78);x.stroke();x.restore()})}
  for(let i=0;i<6;i++){const cx=r()*W,s=r()*1e9|0;W2(W,cx,H*.4,X=>branch(x,X,H*.92,H*.22,-1.5708,7,4,o.col,mk(s),1.2))}
  x.save();x.globalCompositeOperation='source-atop';const g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,rgba(o.glow,.12));g.addColorStop(1,rgba(o.glow,.65));x.fillStyle=g;x.fillRect(0,0,W,H);x.restore();
  grain(x,W,H,r,.7,.05);
},
rubble(x,W,H,r,o){
  const shapes=[];const f=periodic(W,r,OCT_H);
  for(let i=0;i<o.walls;i++){const cx=r()*W,w=H*(.3+r()*.7),h=H*(.35+r()*.55),pts=[[cx-w/2,H],[cx-w/2,H-h*(.6+r()*.4)]];for(let k=1;k<6;k++)pts.push([cx-w/2+w*k/6,H-h*(.4+r()*.6)]);pts.push([cx+w/2,H-h*(.3+r()*.5)],[cx+w/2,H]);shapes.push(pts)}
  const draw=(col,dy)=>{x.fillStyle=col;x.beginPath();x.moveTo(0,H);for(let i=0;i<=W;i+=4)x.lineTo(i,H*.82-H*.1*f(i)+dy);x.lineTo(W,H);x.closePath();x.fill();
    shapes.forEach(p=>W2(W,p[0][0]+(p[p.length-1][0]-p[0][0])/2,H,X=>{const ox=X-(p[0][0]+(p[p.length-1][0]-p[0][0])/2);poly(x,p.map(q=>[q[0]+ox,q[1]+dy]));x.fill()}))};
  draw(rgba(o.rim,.85),-3);draw(o.col,0);
  x.save();x.globalCompositeOperation='destination-out';shapes.forEach(p=>{const cx=(p[0][0]+p[p.length-1][0])/2,w=p[p.length-1][0]-p[0][0];for(let k=0;k<2;k++)if(r()<.7)x.fillRect(cx-w*.3+k*w*.35,H*(.45+r()*.15),w*.14,H*.16)});x.restore();
  for(let i=0;i<o.trees;i++){const cx=r()*W,s=r()*1e9|0;W2(W,cx,H*.5,X=>branch(x,X,H*.85,H*.3,-1.5708,10,4,o.col,mk(s),1.3))}
  grain(x,W,H,r,.6,.05);
},
pineForest(x,W,H,r,o){
  const vars=variants(o.col,5,.06,r),it=[];
  for(let i=0;i<o.n;i++)it.push({cx:o.big?(i+.5)*W/o.n+(r()-.5)*W/o.n*.5:r()*W,h:H*(o.hmin+r()*(o.hmax-o.hmin)),s:r()*1e9|0});
  it.sort((a,b)=>b.h-a.h).forEach(t=>W2(W,t.cx,t.h*.32,X=>pineTree(x,X,H,t.h,{col:o.col,vars,snow:o.snow,light:-1,hi:o.hi},mk(t.s))));
  const f=periodic(W,r,OCT_H);x.beginPath();x.moveTo(0,H);for(let i=0;i<=W;i+=4)x.lineTo(i,H*.95-H*.03*f(i));x.lineTo(W,H);x.closePath();x.fillStyle=o.snow;x.fill();
  if(o.haze)hazeBottom(x,W,H,o.haze,.5,.4);grain(x,W,H,r,.7,.04);
},
drifts(x,W,H,r,o){
  const vars=variants(o.bush,4,.06,r);
  for(let i=0;i<W/26*(o.bn??1);i++){const cx=r()*W,R=H*(.12+r()*.18),s=r()*1e9|0;W2(W,cx,R*1.3,X=>blob(x,X,H*.5,R,{col:o.bush,vars},mk(s)))}
  if(o.grass)grass(x,W,H,r,o.bush,W/14,o.col);
  const f=periodic(W,r,OCT_H);const path=()=>{x.beginPath();x.moveTo(0,H);for(let i=0;i<=W;i+=4)x.lineTo(i,H*.62-H*.18*f(i));x.lineTo(W,H);x.closePath()};
  const g=x.createLinearGradient(0,H*.4,0,H);g.addColorStop(0,o.col);g.addColorStop(1,o.sh);path();x.fillStyle=g;x.fill();
  x.fillStyle='#ffffff';for(let i=0;i<W/6;i++){x.globalAlpha=.3+r()*.6;x.fillRect(r()*W,H*(.55+r()*.4),1.5,1.5)}x.globalAlpha=1;
}
};

function skyTex(s,r){
  const W=1100,H=460,c=cnv(W,H),x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,s.sky[0]);g.addColorStop(.26,s.sky[1]);g.addColorStop(.46,s.sky[2]);g.addColorStop(1,s.sky[2]);x.fillStyle=g;x.fillRect(0,0,W,H);
  for(let i=0;i<s.stars;i++){x.fillStyle='#fff';x.globalAlpha=.2+r()*.7;const z=r()*1.6+.4;x.fillRect(r()*W,r()*H*.38,z,z)}x.globalAlpha=1;
  const[sx,sy,sc,sa]=s.sun;puff(x,sx*W,sy*H,W*.5,sc,sa*.7);puff(x,sx*W,sy*H,W*.12,sc,Math.min(1,sa*1.3));
  if(s.moonDisc){x.fillStyle='#f2f6ff';x.beginPath();x.arc(sx*W,sy*H,17,0,6.2832);x.fill();x.fillStyle='rgba(150,165,190,.35)';[[-5,-3,4],[4,5,3],[3,-6,2]].forEach(([a,b,c2])=>{x.beginPath();x.arc(sx*W+a,sy*H+b,c2,0,6.2832);x.fill()})}
  const cl=s.clouds;
  for(let i=0;i<cl.n;i++){const cx=r()*W,cy=H*(cl.y+r()*.16),w=W*(.12+r()*.22);
    for(let k=0;k<16;k++){const px=cx+(r()-.5)*w,py=cy+(r()-.5)*w*.1,rad=w*(.1+r()*.16);x.save();x.translate(px,py);x.scale(1,.38);puff(x,0,0,rad,cl.col,cl.a);
      const ang=Math.atan2(sy*H-py,sx*W-px);puff(x,Math.cos(ang)*rad*.4,Math.sin(ang)*rad*.4/.38,rad*.55,cl.lit,cl.la);x.restore()}}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function groundTex(kind,r){
  const S=512,c=cnv(S,S),x=c.getContext('2d');
  const cfg={forest:{base:'#1d2417',cols:['#2b3420','#141a10','#3b3a22','#4a3c24','#283a1c'],n:9000,len:9,w:2},
    flood:{base:'#3e3260',cols:['#6e5c98','#b49cd0','#2e2450'],n:2600,len:44,w:1.4,h:1},
    burning:{base:'#1a0e09',cols:['#2c1a12','#0c0604','#4a2414','#3a2a24'],n:7500,len:6,w:2.6},
    snow:{base:'#c4d0de',cols:['#e2eaf4','#a8b8cc','#ffffff','#94a6bc'],n:8000,len:14,w:2.4,h:1},
    dark:{base:'#0a0c16',cols:['#141830','#06080e','#1c2240','#10142a'],n:7000,len:7,w:2.4}}[kind];
  x.fillStyle=cfg.base;x.fillRect(0,0,S,S);x.lineCap='round';
  for(let i=0;i<cfg.n;i++){const px=r()*S,py=r()*S,col=cfg.cols[(r()*cfg.cols.length)|0],a=cfg.h?(r()-.5)*.08:r()*6.2832,L=cfg.len*(.4+r());
    x.strokeStyle=col;x.globalAlpha=.25+r()*.45;x.lineWidth=cfg.w*(.5+r());
    const ex=Math.cos(a)*L,ey=Math.sin(a)*L;
    for(const dx of[-S,0,S])for(const dy of[-S,0,S]){const ax=px+dx,ay=py+dy;if(ax<-L||ax>S+L||ay<-L||ay>S+L)continue;x.beginPath();x.moveTo(ax,ay);x.lineTo(ax+ex,ay+ey);x.stroke()}}
  if(kind==='burning'){for(let i=0;i<220;i++){x.fillStyle=r()<.5?'#ff8a30':'#ffcf60';x.globalAlpha=.4+r()*.6;x.fillRect(r()*S,r()*S,2,2)}}
  x.globalAlpha=1;
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;
}

/* ============================ stations ============================ */
const STN={
forest:{sky:['#121a2c','#3c4a62','#e0a46e'],sun:[.82,.42,'#ffd6a0',.65],stars:0,clouds:{n:12,col:'#5a5068',a:.3,lit:'#f2b07a',la:.18,y:.14},
  fog:'#8a7a6c',hemi:['#d4b08a','#22281a',1],moon:['#ffc890',1.15],ground:'forest',palette:['#121a2c','#e0a46e','#6c7488','#2c3836','#161d1b','#ffd098'],
  layers:[
   {z:-122,h:26,W:4096,H:512,p:'mountains',o:{ranges:[{col:'#8a90a6',base:.52,amp:.36},{col:'#6a7286',base:.7,amp:.28}],haze:'#c8a68c',rim:'#ffcf98',light:1}},
   {z:-84,h:12,W:4096,H:512,p:'treeline',o:{col:'#4a5466',hi:'#e2aa80',haze:'#b09484',light:1,pine:.45,base:.58,hmin:.25,hmax:.5,n:260}},
   {z:-70,h:9,W:2048,H:256,p:'mist',o:{col:'#f0c8a8',a:.07}},
   {z:-46,h:12,W:4096,H:1024,p:'forestMid',o:{col:'#2c3836',trunk:'#212a27',hi:'#e8a874',haze:'#7a6a5c',light:1,n:34}},
   {z:-34,h:36,W:2048,H:512,p:'shafts',still:1,add:1,o:{col:'#ffd098',a:.11,n:9,slant:.55}},
   {z:-30,h:7,W:2048,H:256,p:'mist',o:{col:'#e8b890',a:.05}},
   {z:-18,h:15,W:2048,H:1024,p:'bigForest',o:{col:'#151c1a',rim:'#eaa262',leaf:'#1a231d',hi:'#5a6a3a',light:1,n:4}},
   {z:-7,h:3.2,W:2048,H:256,p:'undergrowth',o:{col:'#1e2a1c',hi:'#7a8a48',ferns:1,light:1}},
   {z:5,h:1.1,W:2048,H:256,y:-.05,p:'undergrowth',o:{col:'#0c110c',hi:'#5a6a38',ferns:1,sparse:1,light:1}}]},
flood:{sky:['#1a1530','#4a3e6e','#d8a2c4'],sun:[.5,.46,'#ffd0ea',.55],stars:70,clouds:{n:11,col:'#40365e',a:.35,lit:'#eab4d4',la:.16,y:.16},
  fog:'#9a84b2',hemi:['#c8a8dc','#2a2440',.95],moon:['#e4bce8',1.0],ground:'flood',mirror:'#b8a4d8',palette:['#1a1530','#d8a2c4','#8a7aa8','#4a3e68','#272040','#ffd890'],
  layers:[
   {z:-126,h:18,W:4096,H:512,p:'farRuins',o:{col:'#8c7caa',hill:'#7c6e9c',win:'#ffd890',haze:'#c8a8cc'}},
   {z:-104,h:10,W:2048,H:256,p:'mist',o:{col:'#f0d0f4',a:.09}},
   {z:-64,h:17,W:4096,H:1024,p:'swampTrees',o:{col:'#4a3e68',leafc:'#3e3460',hi:'#b090c8',moss:'#9a88b4',stone:'#6a5c8c',rimc:'#f0c0e0',haze:'#b898c4',n:6,gates:2}},
   {z:-48,h:8,W:2048,H:256,p:'mist',o:{col:'#e0c4ec',a:.1}},
   {z:-25,h:13,W:2048,H:512,p:'swampNear',o:{col:'#282042',moss:'#6a5a88',rimc:'#e8b8e0',n:7}},
   {z:-8,h:4,W:2048,H:256,p:'reeds',o:{col:'#181229',head:'#2a1e2a',n:170}},
   {z:5,h:1.3,W:2048,H:256,y:-.05,p:'reeds',o:{col:'#0a0714',head:'#140c14',n:130,lily:1}}]},
burning:{sky:['#0c0404','#3c1206','#ff9a42'],sun:[.5,.6,'#ffb050',.95],stars:0,clouds:{n:16,col:'#1a0a07',a:.55,lit:'#ff8a40',la:.2,y:.08},
  fog:'#5a220e',hemi:['#ff9a60','#1a0804',.85],moon:['#ff8a44',.9],ground:'burning',mirror:'#ffa060',fire:1,palette:['#0c0404','#ff9a42','#2e140c','#1e0c08','#120604','#ffcf60'],
  layers:[
   {z:-132,h:36,W:4096,H:512,p:'skyline',o:{col:'#2e140c',win:'#ffb04a',vine:'#24180c',glow:'#ff7a2a'}},
   {z:-114,h:44,W:2048,H:512,p:'smoke',o:{col:'#140806',glow:'#ff7a30',n:7}},
   {z:-98,h:12,W:4096,H:512,p:'flames',add:1,flick:1,o:{n:42,base:.96,hmin:.3,hmax:.75}},
   {z:-58,h:13,W:4096,H:512,p:'village',o:{col:'#1e0c08',glow:'#ff6a20',win:'#ffb050'}},
   {z:-56,h:12,W:4096,H:512,p:'flames',add:1,flick:1,o:{n:26,base:.97,hmin:.4,hmax:.95}},
   {z:-40,h:22,W:2048,H:512,p:'smoke',o:{col:'#120604',glow:'#ff6a20',n:4}},
   {z:-20,h:7,W:2048,H:512,p:'rubble',o:{col:'#120604',rim:'#ff7a30',walls:7,trees:3}}]},
snow:{sky:['#0a1222','#22334e','#90a6c0'],sun:[.24,.2,'#eef4ff',.4],moonDisc:1,stars:150,clouds:{n:9,col:'#2a3a54',a:.3,lit:'#c0d0e4',la:.18,y:.22},
  fog:'#8a9cb4',hemi:['#b8c8e4','#3a4a60',1.15],moon:['#d8e4ff',1.3],ground:'snow',palette:['#0a1222','#90a6c0','#eef3fa','#5e6e8a','#20304a','#111b28'],
  layers:[
   {z:-126,h:32,W:4096,H:512,p:'mountains',o:{ranges:[{col:'#7a8aa6',base:.5,amp:.4},{col:'#5e6e8a',base:.68,amp:.3}],haze:'#9aaac2',rim:'#eef4ff',light:-1,snow:'#eef3fa',shadow:'#2a3a5a',rock:'#3e4c64'}},
   {z:-86,h:11,W:4096,H:512,p:'treeline',o:{col:'#34445a',snow:'#c8d4e4',haze:'#8a9cb6',pine:1,base:.6,hmin:.3,hmax:.55,n:300,light:-1}},
   {z:-70,h:8,W:2048,H:256,p:'mist',o:{col:'#c8d8ec',a:.08}},
   {z:-46,h:12,W:4096,H:1024,p:'pineForest',o:{col:'#20304a',snow:'#dce6f0',haze:'#6a7c96',n:48,hmin:.5,hmax:.95}},
   {z:-19,h:13,W:2048,H:1024,p:'pineForest',o:{col:'#111b28',snow:'#e8eef6',n:7,hmin:.7,hmax:1.0,big:1}},
   {z:-7,h:2.6,W:2048,H:256,p:'drifts',o:{col:'#dfe7f0',sh:'#9aaac4',bush:'#1a2432'}},
   {z:5,h:1.1,W:2048,H:256,y:-.05,p:'drifts',o:{col:'#c4d0e0',sh:'#8a9ab4',bush:'#2a3648',grass:1,bn:.25}}]}
};

PAINT.lanterns=function(x,W,H,r,o){
  // a long row of platform lamps receding into the dark; the last one is unlit
  const n=o.n||7;
  for(let i=0;i<n;i++){const cx=W*(.08+.84*i/(n-1)),h=H*(.5+.04*Math.sin(i)),lit=i<n-1;
    x.fillStyle=o.col;x.fillRect(cx-2,H-h,4,h);x.fillRect(cx-9,H-h-2,18,4);
    if(lit){x.globalCompositeOperation='lighter';puff(x,cx,H-h+6,H*.28,o.glow,.55);puff(x,cx,H-h+6,H*.07,'#fff6d0',.95);x.globalCompositeOperation='source-over'}
    else{x.fillStyle=o.col;x.beginPath();x.arc(cx,H-h+6,6,0,6.2832);x.fill()}}
  hazeBottom(x,W,H,o.haze,.5,.5);
};

STN.dark={sky:['#04050a','#0a0f20','#1c2440'],sun:[.72,.34,'#9fb0ff',.14],stars:240,moonDisc:0,clouds:{n:7,col:'#0e1226',a:.4,lit:'#3a4470',la:.12,y:.2},
  fog:'#0a0e1c',hemi:['#7a88c0','#10122a',.75],moon:['#8a9ad8',.85],ground:'dark',palette:['#04050a','#1c2440','#8a9ad8','#0a0e1c','#ffd890','#10142a'],
  layers:[
   {z:-126,h:30,W:4096,H:512,p:'mountains',o:{ranges:[{col:'#1a2040',base:.55,amp:.35},{col:'#121830',base:.72,amp:.28}],haze:'#262e54',rim:'#6a78b8',light:1}},
   {z:-100,h:10,W:2048,H:256,p:'mist',o:{col:'#6a78b0',a:.09}},
   {z:-80,h:12,W:4096,H:256,p:'lanterns',add:1,still:0,o:{n:7,col:'#0a0c18',glow:'#ffcf80',haze:'#10142a'}},
   {z:-64,h:17,W:4096,H:1024,p:'swampTrees',o:{col:'#10142a',leafc:'#0e1226',hi:'#4a5a90',moss:'#4a5688',stone:'#242c52',rimc:'#8a9ad8',haze:'#1c2444',n:5,gates:3}},
   {z:-48,h:8,W:2048,H:256,p:'mist',o:{col:'#8a98d0',a:.07}},
   {z:-25,h:13,W:2048,H:512,p:'swampNear',o:{col:'#080a14',moss:'#2a3050',rimc:'#6a78b0',n:6}},
   {z:-8,h:4,W:2048,H:256,p:'reeds',o:{col:'#06070e',head:'#10121e',n:150}},
   {z:5,h:1.1,W:2048,H:256,y:-.05,p:'reeds',o:{col:'#030308',head:'#080810',n:110}}]};

export {mk,cnv,rgb,rgba,mix,PAINT,skyTex,groundTex,STN};
