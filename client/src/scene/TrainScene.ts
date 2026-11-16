// @ts-nocheck
/* The live 3D train: "Inked Noir Deco" (confirmed Style B).
   Art helpers, passengers, wheels and the locomotive are vendored from design/style-b.html;
   the carriages, props, movement, camera and DOM overlays are game-specific. */
import * as THREE from 'three';
import { mk, cnv, mix, PAINT, skyTex, groundTex, STN } from './painters';
import { CAST, DRIVER, CONDUCTOR } from './cast';

const TOON=(()=>{const t=new THREE.DataTexture(new Uint8Array([60,60,60,255,150,150,150,255,255,255,255,255]),3,1,THREE.RGBAFormat);t.minFilter=t.magFilter=THREE.NearestFilter;t.needsUpdate=true;return t})();
const GLOW=(()=>{const c=cnv(128,128),x=c.getContext('2d');const g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,235,170,1)');g.addColorStop(.35,'rgba(255,190,90,.35)');g.addColorStop(1,'rgba(255,170,60,0)');x.fillStyle=g;x.fillRect(0,0,128,128);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t})();
const OLM=new THREE.MeshBasicMaterial({color:'#1b1210',side:THREE.BackSide});
const SMOKE=(()=>{const c=cnv(128,128),x=c.getContext('2d'),r=mk(9);for(let i=0;i<22;i++){const px=64+(r()-.5)*50,py=64+(r()-.5)*44,rad=16+r()*26,g=x.createRadialGradient(px,py,0,px,py,rad);g.addColorStop(0,'rgba(255,255,255,.5)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.beginPath();x.arc(px,py,rad,0,7);x.fill()}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t})();
const SMK={forest:'#cfc8be',flood:'#ddd4e4',burning:'#3e302a',snow:'#eef2f8'};
SMK.dark = '#aab4d8';

const FLOOR = 1.02, GAUGE = 1.2, SPEED_CRUISE = 7;
const THEME_ORDER = ['forest', 'flood', 'burning', 'snow', 'dark'];
const CAR_ORDER = ['luggage', 'sleepers', 'dining', 'observation'];
const CAR_X = { luggage: -17.2, sleepers: -8.6, dining: 0, observation: 8.6, engine: 21.6 };
const CHAR_INDEX = { fedora: 0, cloche: 1, bowler: 2, flatcap: 3, widebrim: 4, tophat: 5 };
const CAB_W = 1.3;
const cabinX = (slot) => -3.25 + slot * CAB_W;
const propX = (o) => {
  if (o.carriage === 'sleepers') return CAR_X.sleepers + cabinX(o.slot);
  if (o.carriage === 'engine') return [CAR_X.engine + .7, CAR_X.engine - .55, CAR_X.engine + .05][o.slot] ?? CAR_X.engine;
  if (o.kind === 'window') return CAR_X.observation;
  return CAR_X[o.carriage] - 3.3 + o.slot * .95;
};
const ANCHOR_Y = { trunk: .75, crate: .95, bag: .7, shelf: 1.95, drawer: 1.15, lockbox: .75, window: 2.45, lantern: 3.15, cabinet: 1.95, bunk: 1.75, desk: 1.1, coat: 1.9, device: 1.45 };
const ABSOLUTE_ANCHOR = { window: 1, lantern: 1 };

const STYLE = {
  luggage: { wall: '#3a3028', carpet: '#3a2e26', windows: [-2.5, 0, 2.5], ww: 1.6, pics: false, trim: '#8a6a44' },
  sleepers: { wall: '#4a3050', carpet: '#5a2a3a', windows: [0, 1, 2, 3, 4, 5].map(cabinX), ww: .8, pics: false, trim: '#c9a24a' },
  dining: { wall: '#5a2a3a', carpet: '#7a1f2a', windows: [-2.5, 0, 2.5], ww: 1.6, pics: true, trim: '#c9a24a' },
  observation: { wall: '#2f4a3c', carpet: '#2f5a43', windows: [-2.5, 0, 2.5], ww: 1.6, pics: true, trim: '#c9a24a' },
};

export function createTrainScene(canvas, layer, handlers) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const ANI = Math.min(4, renderer.capabilities.getMaxAnisotropy()); // 16x on 4096px layers is a lot of GPU for no visible gain
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 16 / 9, .5, 400);
  const hemi = new THREE.HemisphereLight('#fff', '#444', 1); scene.add(hemi);
  const moon = new THREE.DirectionalLight('#fff', 1.1); moon.position.set(8, 16, 14); scene.add(moon);
  const train = new THREE.Group(), world = new THREE.Group(), stat = new THREE.Group();
  scene.add(train, world, stat);

  let OL=false;
  const mat=(col,o={})=>{let m=o.basic?new THREE.MeshBasicMaterial({color:o.map?'#ffffff':col}):new THREE.MeshToonMaterial({color:o.map?'#ffffff':col,gradientMap:TOON});if(o.map)m.map=o.map;
    if(o.emissive&&m.emissive){m.emissive=new THREE.Color(o.emissive);m.emissiveIntensity=o.ei??1}
    if(o.opacity!==undefined){m.transparent=true;m.opacity=o.opacity}if(o.side)m.side=o.side;return m};
  const outline=(m,t=.03)=>{const g=m.geometry;g.computeBoundingBox();const s=new THREE.Vector3();g.boundingBox.getSize(s);const o=new THREE.Mesh(g,OLM);o.scale.set(1+2*t/Math.max(s.x,.06),1+2*t/Math.max(s.y,.06),1+2*t/Math.max(s.z,.06));m.add(o)};
  const add=(p,geo,m,x,y,z,o={})=>{const me=new THREE.Mesh(geo,m);me.position.set(x,y,z);if(o.rx)me.rotation.x=o.rx;if(o.ry)me.rotation.y=o.ry;if(o.rz)me.rotation.z=o.rz;
    me.castShadow=OL&&o.cs!==false;me.receiveShadow=true;if(OL&&o.ol!==false)outline(me,o.olt);p.add(me);return me};
  const box=(p,w,h,d,x,y,z,col,o={})=>add(p,new THREE.BoxGeometry(w,h,d),mat(col,o),x,y+h/2,z,o);
  const cyl=(p,rt,rb,h,x,y,z,col,o={})=>add(p,new THREE.CylinderGeometry(rt,rb,h,o.seg||12),mat(col,o),x,y+h/2,z,o);
  const sph=(p,r,x,y,z,col,o={})=>add(p,new THREE.SphereGeometry(r,o.seg||12,o.seg?Math.max(6,o.seg-4):8,0,Math.PI*2,0,o.th||Math.PI),mat(col,o),x,y,z,o);
  const grp=(p,x,y,z,ry=0)=>{const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=ry;p.add(g);return g};
  const glowSprite=(p,x,y,z,s,op=.7,col='#ffd890')=>{const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:col,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,opacity:op,fog:false}));sp.position.set(x,y,z);sp.scale.set(s,s,1);sp.renderOrder=5;p.add(sp);return sp};
  const LIT=o=>({emissive:'#ffd98a',ei:1.6,...o});
  const lathe=(p,pts,x,y,z,col,o={})=>{const geo=new THREE.LatheGeometry(pts.map(([a,b])=>new THREE.Vector2(a,b)),o.seg||24);
    if(o.geoRot)geo['rotate'+o.geoRot[0].toUpperCase()](o.geoRot[1]);geo.computeBoundingBox();const c=new THREE.Vector3();geo.boundingBox.getCenter(c);geo.translate(-c.x,-c.y,-c.z);
    const me=add(p,geo,mat(col,o),x+c.x,y+c.y,z+c.z,o);if(o.sx||o.sz)me.scale.set(o.sx||1,1,o.sz||1);return me};
  const cap=(p,r,len,x,y,z,col,o={})=>add(p,new THREE.CapsuleGeometry(r,len,4,o.seg||10),mat(col,o),x,y,z,o);
  const hcyl=(p,r,len,x,y,z,col,o={})=>add(p,new THREE.CylinderGeometry(r,r,len,o.seg||16),mat(col,o),x,y,z,{...o,rz:Math.PI/2});
  const P={wood:'#6a3f26',cloth1:'#7a1f2a',cloth2:'#2f5a43',brass:'#c9a24a',linen:'#e8e0d0',shell:'#26332e',trim:'#c9a24a'};
  function chair(p,x,z,ry,col){const g=grp(p,x,FLOOR,z,ry);box(g,.6,.1,.6,0,.42,0,col);box(g,.6,.7,.1,0,.42,-.3,col);[[-.25,-.25],[.25,-.25],[-.25,.25],[.25,.25]].forEach(([a,b])=>cyl(g,.03,.03,.42,a,0,b,P.wood,{seg:6}))}
  function armchair(p,x,z,ry,col){const g=grp(p,x,FLOOR,z,ry);box(g,.95,.28,.8,0,.2,0,col);box(g,.95,.7,.2,0,.2,-.32,col);box(g,.2,.5,.8,-.5,.2,0,col);box(g,.2,.5,.8,.5,.2,0,col);[[-.4,-.3],[.4,-.3],[-.4,.3],[.4,.3]].forEach(([a,b])=>cyl(g,.035,.03,.2,a,0,b,P.wood,{seg:6}))}
  function table(p,x,z,w=1.5,d=.9){const g=grp(p,x,FLOOR,z);box(g,w,.07,d,0,.72,0,P.wood);cyl(g,.07,.1,.72,0,0,0,P.wood);cyl(g,.3,.3,.03,0,0,0,P.wood,{seg:14});box(g,w,.01,d*.7,0,.79,0,'#f4efe6',{ol:false,cs:false});
    [-.5,0,.5].forEach(k=>{cyl(g,.15,.15,.015,k*w*.6,.79,d*.18,'#fff',{seg:12});cyl(g,.04,.035,.14,k*w*.6+.12,.79,-.1,'#d8e8f0',{seg:8})});cyl(g,.05,.06,.26,0,.79,-.05,P.cloth2,{seg:8})}
  function lamp(p,x,z,y=FLOOR,tall=1.4,withLight=true){cyl(p,.2,.22,.04,x,y,z,P.wood);cyl(p,.025,.03,tall,x,y,z,'#3a2a22',{seg:6});cyl(p,.15,.27,.34,x,y+tall,z,'#ffe2a0',LIT({side:THREE.DoubleSide,ol:false,seg:14}));glowSprite(p,x,y+tall+.15,z,2.6,.8);
    if(withLight){const l=new THREE.PointLight('#ffcc80',12,8,2);l.position.set(x,y+tall+.2,z+.2);p.add(l)}}
  function pendant(p,x,z){cyl(p,.012,.012,.4,x,3.2,z,'#3a2a22',{seg:5,ol:false});sph(p,.15,x,3.1,z,'#ffe2a0',LIT({ol:false}));glowSprite(p,x,3.1,z+.1,2.2,.7);const l=new THREE.PointLight('#ffcc80',9,7,2);l.position.set(x,3,z+.2);p.add(l)}
  function books(p,x,y,z,w,n){const cs=['#7a1f2a','#2f5a43','#c9a24a','#1f2f55','#b58b5a'];let dx=0;for(let i=0;i<n;i++){const bw=.06+((i*7)%3)*.02,bh=.3+((i*5)%4)*.04;box(p,bw,bh,.26,x+dx,y,z,cs[i%5],{ol:false,cs:false});dx+=bw+.01;if(dx>w)break}}
  const figs=[],FAB={};
  function fabric(kind,base){const k=kind+base;if(FAB[k])return FAB[k];const S=64,c=cnv(S,S),x=c.getContext('2d');x.fillStyle=base;x.fillRect(0,0,S,S);
    if(kind==='pinstripe'){x.fillStyle='rgba(235,230,215,.42)';for(let i=0;i<S;i+=16)x.fillRect(i,0,2,S)}
    if(kind==='tweed'){const q=mk(5);for(let i=0;i<1100;i++){x.fillStyle=q()<.5?'rgba(255,235,190,.2)':'rgba(0,0,0,.22)';x.fillRect(q()*S,q()*S,3,1)}}
    if(kind==='argyle'){x.fillStyle='#7a1f2a';x.beginPath();x.moveTo(32,0);x.lineTo(64,32);x.lineTo(32,64);x.lineTo(0,32);x.closePath();x.fill();x.strokeStyle='#e8d9b5';x.lineWidth=2;x.beginPath();x.moveTo(0,0);x.lineTo(64,64);x.moveTo(64,0);x.lineTo(0,64);x.stroke()}
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(kind==='pinstripe'?6:3,kind==='argyle'?2:3);return FAB[k]=t}
  function hat(g,c,hy){
    const col=c.hatc,band=c.band,D=THREE.DoubleSide,h=new THREE.Group();h.position.set(0,hy+.06,0);g.add(h);
    const brim=(pts,seg=30)=>{lathe(h,pts,0,0,0,col,{side:D,seg,ol:false});const[r,y]=pts[pts.length-1];add(h,new THREE.TorusGeometry(r,.005,4,48),mat('#1b1210'),0,y,0,{rx:Math.PI/2,ol:false})};
    if(c.hat==='fedora'){h.rotation.x=.08;lathe(h,[[0,.165],[.05,.16],[.1,.125],[.112,.03],[.118,0]],0,0,0,col,{sz:.88});brim([[.112,.012],[.2,0],[.228,.024]]);cyl(h,.116,.119,.035,0,.006,0,band,{ol:false,seg:20})}
    if(c.hat==='cloche'){h.position.y=hy+.055;h.rotation.x=-.32;lathe(h,[[0,.16],[.08,.15],[.12,.1],[.132,.02],[.136,-.06],[.158,-.1]],0,0,0,col,{side:D,seg:28,ol:false});add(h,new THREE.TorusGeometry(.158,.006,4,40),mat('#1b1210'),0,-.1,0,{rx:Math.PI/2,ol:false});cyl(h,.134,.136,.03,0,-.025,0,band,{ol:false,seg:20});sph(h,.026,.11,-.01,.07,band,{ol:false,seg:8});sph(h,.026,.125,-.02,.035,band,{ol:false,seg:8})}
    if(c.hat==='bowler'){lathe(h,[[0,.15],[.07,.145],[.105,.1],[.115,.03],[.117,0]],0,0,0,col,{seg:26});brim([[.11,.005],[.155,0],[.175,.03]],28);cyl(h,.116,.118,.026,0,.005,0,band,{ol:false,seg:20})}
    if(c.hat==='flatcap'){h.position.y=hy+.05;const m=sph(h,.135,0,.02,-.01,col,{seg:20});m.scale.set(1,.42,1.08);const b=box(h,.17,.016,.11,0,-.012,.135,col);b.rotation.x=.2}
    if(c.hat==='cap'){h.position.y=hy+.03;lathe(h,[[0,.095],[.125,.095],[.12,0]],0,0,0,col,{seg:24});cyl(h,.124,.124,.02,0,.06,0,band,{ol:false,seg:20});const b=box(h,.2,.016,.1,0,-.01,.14,'#1b1210');b.rotation.x=.25}
    if(c.hat==='wide'){h.rotation.z=-.2;h.rotation.x=.08;lathe(h,[[0,.1],[.08,.1],[.1,.07],[.11,0]],0,0,0,col,{seg:24});brim([[.1,.012],[.3,-.012],[.345,-.04]],40);cyl(h,.105,.108,.035,0,.006,0,band,{ol:false,seg:20})}
    if(c.hat==='topper'){lathe(h,[[0,.27],[.098,.27],[.09,.16],[.096,.02],[.1,0]],0,0,0,col,{seg:26});brim([[.095,.01],[.16,0],[.18,.035]],28);cyl(h,.094,.098,.05,0,.012,0,band,{ol:false,seg:20})}
  }
  function figure(p,x,z,c,ry=0,y0=FLOOR){
    const g=grp(p,x,y0,z,ry),F=c.sex==='f',T=c.coatType,skin=c.skin;
    const o=(e={})=>({olt:.012,...e});
    const coatMap=c.fabric?fabric(c.fabric,c.coat):null;
    // legs & shoes
    if(F){const hem=T==='gown'?.1:.32;
      [-1,1].forEach(s=>{if(hem>.15)cap(g,.04,hem-.06,s*.07,hem/2+.03,0,mix(skin,'#7a5a4a',.3),o());
        box(g,.075,.05,.17,s*.07,0,.03,c.shoes[0],o());cyl(g,.012,.018,.07,s*.07,0,-.045,c.shoes[0],o({seg:6}))});
    }else{const tm=c.tfabric?fabric(c.tfabric,c.trousers):null;
      [-1,1].forEach(s=>{
        if(c.legs==='plus'){cap(g,.048,.2,s*.1,.22,0,'#ffffff',o({map:fabric('argyle','#c9a24a')}));const b=sph(g,.115,s*.105,.6,0,c.trousers,o({seg:14,map:fabric('tweed',c.trousers)}));b.scale.set(.95,1.55,1)}
        else{cyl(g,.088,.102,.9,s*.1,.05,0,c.trousers,o({map:tm,seg:14}));cyl(g,.106,.106,.045,s*.1,.05,0,c.trousers,o({map:tm,seg:14}))}
        box(g,.105,.07,.27,s*.1,0,.04,c.shoes[0],o());const t=sph(g,.055,s*.1,.045,.16,c.shoes[1]||c.shoes[0],o({seg:10}));t.scale.set(1,.7,1.1)});
    }
    // body: lathe-turned silhouette, flattened front-to-back
    let prof;
    if(F){const hem=T==='gown'?.1:.32;prof=[[0,hem],[T==='gown'?.3:.27,hem],[.2,.62],[.19,.88],[.195,.95],[.145,1.05],[.16,1.18],[.185,1.27],[.175,1.37],[.11,1.43],[.05,1.46],[0,1.46]]}
    else{const hem=T==='trench'?.36:T==='tails'?.95:.76;prof=[[0,hem],[T==='trench'?.3:.235,hem]];if(hem<.9)prof.push([.22,.95]);prof.push([.205,1.05],[.225,1.24],[.24,1.37],[.2,1.45],[.08,1.5],[0,1.51])}
    lathe(g,prof,0,0,0,c.coat,o({map:coatMap,sz:.74,seg:28}));
    const shW=F?.17:.23;
    cap(g,F?.055:.075,shW*1.5,0,1.4,0,c.coat,o({rz:Math.PI/2,map:coatMap}));
    if(!F){const fz=.168;
      box(g,.11,.24,.012,0,1.17,fz,c.shirt,o({ol:false}));
      if(c.bow)box(g,.09,.035,.02,0,1.38,fz+.012,c.tie,o({ol:false}));else box(g,.035,.22,.014,0,1.17,fz+.008,c.tie,o({ol:false}));
      [-1,1].forEach(s=>{const l=box(g,.07,.3,.014,s*.072,1.1,fz+.006,c.lapel||mix(c.coat,'#000000',.3),o({ol:false}));l.rotation.z=s*.32});
      if(c.db)[[-.06,.98],[.06,.98],[-.06,1.07],[.06,1.07]].forEach(([bx,by])=>sph(g,.014,bx,by,fz+.012,'#1b1210',o({ol:false,seg:6})));
      if(c.scarf)[-1,1].forEach(s=>{const sc=box(g,.07,.45,.015,s*.055,1.0,fz+.016,c.scarf,o({ol:false}));sc.rotation.z=-s*.06});
      if(c.pocketSq)box(g,.05,.03,.012,-.12,1.27,fz-.004,c.pocketSq,o({ol:false}));
      if(T==='tails')[-1,1].forEach(s=>{const t=box(g,.13,.55,.03,s*.075,.42,-.15,c.coat,o());t.rotation.x=-.06});
    }else{
      if(c.fur){const f=add(g,new THREE.TorusGeometry(.13,.058,10,22),mat(c.fur,o()),0,1.4,0,o({rx:Math.PI/2}));f.scale.set(1.08,.86,1.25)}
      if(c.cape)lathe(g,[[.26,1.1],[.24,1.22],[.18,1.36],[.1,1.45],[0,1.46]],0,0,0,c.coat,o({sz:.82,side:THREE.DoubleSide,seg:28}));
      if(c.buttons)[1.0,1.12,1.24].forEach(by=>sph(g,.014,0,by,.14,c.buttons,o({ol:false,seg:6})));
    }
    if(c.belt){const by=F?1.04:1.03,b=add(g,new THREE.TorusGeometry(F?.152:.21,.022,6,28),mat(c.beltc||mix(c.coat,'#000000',.35),o()),0,by,0,o({rx:Math.PI/2}));b.scale.set(1,.74,1);box(g,.05,.05,.02,0,by-.025,F?.115:.158,'#c9a24a',o({ol:false}))}
    // jointed arms
    const hands={};
    [-1,1].forEach(s=>{
      const pose=c.pose[s<0?0:1],sh=new THREE.Group();sh.position.set(s*(shW+.03),1.39,0);g.add(sh);
      cap(sh,F?.042:.052,.2,0,-.14,0,c.coat,o({map:coatMap}));
      const el=new THREE.Group();el.position.set(0,-.29,0);sh.add(el);
      cap(el,F?.036:.045,.18,0,-.12,0,c.longGloves?c.gloves:c.coat,o({map:c.longGloves?null:coatMap}));
      if(!c.longGloves&&!F)cyl(el,.05,.05,.03,0,-.25,0,c.shirt||'#e8e0d0',o({ol:false,seg:10}));
      const hand=sph(el,F?.036:.044,0,-.27,0,c.gloves||skin,o({seg:10}));
      const P={hang:[.05,s*.1,-.15,0],hold:[-.2,s*.06,-1.15,0],pocket:[.15,s*.2,-.25,-s*.3],hip:[.1,s*.62,0,-s*1.9]}[pose]||[0,0,0,0];
      sh.rotation.set(P[0],0,P[1]);el.rotation.set(P[2],0,P[3]);
      if(pose==='pocket')hand.visible=false;hands[s]=hand;
    });
    // head, hair, face
    cyl(g,.042,.048,.1,0,1.45,0,skin,o({seg:10}));
    const hd=sph(g,.112,0,1.635,0,skin,o({seg:20}));hd.scale.set(.9,1.08,.98);
    if(F){const hr=sph(g,.122,0,1.65,-.015,c.hair,o({seg:20,th:Math.PI*.55,side:THREE.DoubleSide}));hr.rotation.x=-.6;[-1,1].forEach(s=>sph(g,.048,s*.098,1.585,-.03,c.hair,o({seg:10})))}
    else{const hr=sph(g,.116,0,1.65,-.012,c.hair,o({seg:20,th:Math.PI*.45,side:THREE.DoubleSide}));hr.scale.set(.94,1.05,1);hr.rotation.x=-.5}
    [-1,1].forEach(s=>{sph(g,.011,s*.037,1.645,.097,'#1b1210',{ol:false,seg:6});box(g,.032,.007,.006,s*.038,1.668,.096,c.hair,{ol:false})});
    sph(g,.015,0,1.615,.106,mix(skin,'#a06040',.15),{ol:false,seg:6});
    box(g,.038,.01,.008,0,1.582,.098,c.lips||mix(skin,'#7a3a2a',.35),{ol:false});
    if(!F)[-1,1].forEach(s=>sph(g,.025,s*.1,1.63,0,skin,{ol:false,seg:6}));
    hat(g,c,1.635);
    // accessory in the right hand
    if(c.acc){hands[1].updateWorldMatrix(true,false);const v=new THREE.Vector3();hands[1].getWorldPosition(v);g.worldToLocal(v);
      if(c.acc==='cane'){cyl(g,.012,.012,v.y,v.x,0,v.z,'#111',o({seg:6}));sph(g,.03,v.x,v.y+.01,v.z,'#d8d8e0',o({seg:8}))}
      if(c.acc==='umbrella'){add(g,new THREE.ConeGeometry(.034,v.y,8),mat('#15151a'),v.x,v.y/2,v.z,o({rx:Math.PI}));add(g,new THREE.TorusGeometry(.04,.012,6,10,Math.PI),mat('#3a2418'),v.x+.04,v.y+.01,v.z,o())}
      if(c.acc==='clutch')box(g,.17,.09,.04,v.x,v.y-.07,v.z+.03,c.clutch||'#1b1210',o());
      if(c.acc==='paper'){const pp=box(g,.04,.27,.19,v.x+.02,v.y-.15,v.z+.03,'#e8e0d0',o());pp.rotation.y=.4}
    }
    g.userData={ph:Math.random()*6,ry0:ry,y0};figs.push(g);return g}
  const wheels=[],cars=[];
  /* ---------- wheels & bogies ---------- */
  const WT={},WM={};
  function wheelTex(cc,n,counter){const k=cc+n+counter;if(WT[k])return WT[k];
    const S=256,c=cnv(S,S),x=c.getContext('2d'),R=S/2,ink='#1b1210';x.translate(R,R);
    for(let i=0;i<n;i++){x.save();x.rotate(i/n*Math.PI*2);x.fillStyle=cc;x.strokeStyle=ink;x.lineWidth=3;x.beginPath();x.moveTo(R*.2,-R*.075);x.lineTo(R*.86,-R*.04);x.lineTo(R*.86,R*.04);x.lineTo(R*.2,R*.075);x.closePath();x.fill();x.stroke();x.restore()}
    if(counter){x.fillStyle=cc;x.strokeStyle=ink;x.lineWidth=3;x.beginPath();x.arc(0,0,R*.84,Math.PI*.7,Math.PI*1.3);x.arc(0,0,R*.34,Math.PI*1.3,Math.PI*.7,true);x.closePath();x.fill();x.stroke()}
    x.lineWidth=R*.16;x.strokeStyle=cc;x.beginPath();x.arc(0,0,R*.905,0,7);x.stroke();
    x.lineWidth=R*.07;x.strokeStyle='#7a7a82';x.beginPath();x.arc(0,0,R*.955,0,7);x.stroke();
    x.lineWidth=3;x.strokeStyle=ink;[.988,.92,.83].forEach(f=>{x.beginPath();x.arc(0,0,R*f,0,7);x.stroke()});
    x.lineWidth=2.5;x.strokeStyle='rgba(255,255,255,.3)';x.beginPath();x.arc(0,0,R*.87,Math.PI*1.1,Math.PI*1.6);x.stroke();
    x.fillStyle=cc;x.beginPath();x.arc(0,0,R*.25,0,7);x.fill();x.lineWidth=3;x.strokeStyle=ink;x.stroke();
    x.fillStyle='#c9a24a';x.beginPath();x.arc(0,0,R*.1,0,7);x.fill();x.stroke();
    for(let i=0;i<6;i++){const a=i/6*Math.PI*2;x.fillStyle=ink;x.beginPath();x.arc(Math.cos(a)*R*.175,Math.sin(a)*R*.175,R*.022,0,7);x.fill()}
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return WT[k]=t}
  function wheelG(p,x,y,z,r,o={}){
    const g=new THREE.Group();g.position.set(x,y,z);p.add(g);const sd=z>=0?1:-1,cc=o.centre||'#2a1f1a',k=cc+(o.spokes||10)+!!o.counter;
    const fm=WM[k]||(WM[k]=new THREE.MeshToonMaterial({map:wheelTex(cc,o.spokes||10,!!o.counter),alphaTest:.5,gradientMap:TOON,side:THREE.DoubleSide}));
    const face=new THREE.Mesh(new THREE.CircleGeometry(r,40),fm);face.position.z=sd*.066;g.add(face);
    const back=new THREE.Mesh(new THREE.CircleGeometry(r,40),fm);back.position.z=-sd*.066;g.add(back);
    const tr=new THREE.Mesh(new THREE.CylinderGeometry(r,r,.13,40,1,true),mat('#6e6e76',{side:THREE.DoubleSide}));tr.rotation.x=Math.PI/2;g.add(tr);
    const fl=new THREE.Mesh(new THREE.RingGeometry(r*.97,r*1.08,40),mat('#3e3e46',{side:THREE.DoubleSide}));fl.position.z=-sd*.07;g.add(fl);
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(r*.2,r*.22,.2,18),mat(cc));hub.rotation.x=Math.PI/2;g.add(hub);
    if(o.pin){const pn=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,.24,10),mat('#9a9aa2'));pn.rotation.x=Math.PI/2;pn.position.set(r*.45,0,sd*.12);g.add(pn)}
    g.userData.r=r;wheels.push(g);return g}
  function bogie(p,x,r=.42){const ax=[-.55,.55],ink='#1e1a18';
    ax.forEach(a=>{[-1,1].forEach(s=>wheelG(p,x+a,r,s*GAUGE,r,{spokes:10}));add(p,new THREE.CylinderGeometry(.06,.06,2.5,8),mat('#3a3a40'),x+a,r,0,{rx:Math.PI/2,ol:false})});
    [-1,1].forEach(s=>{const z=s*(GAUGE+.15);
      box(p,1.95,.12,.07,x,r+.2,z,ink);box(p,1.5,.07,.06,x,r-.16,z,ink);
      [-.82,.82].forEach(d=>box(p,.07,.42,.06,x+d,r-.16,z,ink));
      ax.forEach(a=>{box(p,.24,.32,.11,x+a,r-.16,z,'#2a2420');box(p,.13,.13,.12,x+a,r-.07,z+s*.012,P.brass,{ol:false})});
      for(let k=0;k<4;k++)box(p,.95-k*.17,.028,.06,x,r+.33+k*.03,z,'#3a3430',{ol:false});
      [-.2,.2].forEach(d=>cyl(p,.05,.05,.2,x+d,r+.12,z-s*.03,'#5a5048',{seg:8,ol:false}));
      ax.forEach(a=>box(p,.07,.24,.06,x+a+Math.sign(a)*(r+.06),r-.14,z-s*.1,'#2a2420',{ol:false}));
    });
    box(p,.5,.16,2.7,x,r+.3,0,ink);
  }

  /* ================================================================ */
  /* carriages                                                         */
  /* ================================================================ */
  function wallTex(st) {
    const W = 1024, H = 330, c = cnv(W, H), x = c.getContext('2d');
    x.fillStyle = st.wall; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(201,162,74,.32)'; x.lineWidth = 1.5;
    for (let u = -H; u < W + H; u += 28) { x.beginPath(); x.moveTo(u, 0); x.lineTo(u + H, H); x.stroke(); x.beginPath(); x.moveTo(u + H, 0); x.lineTo(u, H); x.stroke(); }
    x.fillStyle = 'rgba(0,0,0,.32)'; x.fillRect(0, H * .7, W, H * .3); x.fillStyle = st.trim; x.fillRect(0, H * .7, W, 4); x.fillRect(0, 0, W, 6);
    x.strokeStyle = 'rgba(0,0,0,.35)'; for (let u = 0; u < W; u += 110) x.strokeRect(u + 8, H * .7 + 14, 94, H * .3 - 26);
    if (st.pics) [[315, 110], [634, 110]].forEach(([fx, fy], k) => { x.fillStyle = '#c9a24a'; x.fillRect(fx, fy, 72, 92); x.fillStyle = ['#6a8a9a', '#c98a5a'][k]; x.fillRect(fx + 7, fy + 7, 58, 78); x.fillStyle = '#1b1210'; x.beginPath(); x.arc(fx + 36, fy + 38, 16, 0, 7); x.fill(); x.fillRect(fx + 18, fy + 52, 36, 32); });
    const small = st.ww < 1;
    st.windows.forEach((wx) => { const pw = st.ww / 8 * W, px = (wx / 8 + .5) * W - pw / 2; x.clearRect(px, small ? 100 : 81, pw, small ? 110 : 141); });
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return new THREE.MeshToonMaterial({ map: t, alphaTest: .5, gradientMap: TOON, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: .4 });
  }

  function plateTexture(text) {
    const c = cnv(256, 64), x = c.getContext('2d');
    x.fillStyle = '#c9a24a'; x.fillRect(0, 0, 256, 64);
    x.strokeStyle = '#6a4a1a'; x.lineWidth = 3; x.strokeRect(4, 4, 248, 56);
    x.fillStyle = '#2a1a0c'; x.font = 'bold 26px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    let s = text || '';
    while (x.measureText(s).width > 230 && s.length > 3) s = s.slice(0, -2);
    x.fillText(s, 128, 34);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }

  function shutterTex(text, col) {
    const c = cnv(512, 160), x = c.getContext('2d');
    x.fillStyle = col; x.fillRect(0, 0, 512, 160);
    x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 14;
    for (let u = -160; u < 560; u += 44) { x.beginPath(); x.moveTo(u, 160); x.lineTo(u + 160, 0); x.stroke(); }
    x.fillStyle = 'rgba(14,10,12,.82)'; x.fillRect(92, 50, 328, 60);
    x.fillStyle = '#e6c068'; x.font = 'bold 34px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 82);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function makeShutter(parent, x, y, z, w, h, text, col) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: shutterTex(text, col), transparent: true, opacity: 0, depthWrite: false }));
    m.position.set(x, y, z); m.renderOrder = 8; m.visible = false; parent.add(m); return m;
  }

  const carObj = {};
  function buildCarriage(id) {
    const st = STYLE[id], cx = CAR_X[id];
    OL = true;
    const g = grp(train, cx, 0, 0);
    const C = { id, g, cx, lights: [], plates: [], shutter: null, base: [] };
    carObj[id] = C;
    box(g, 8, .16, 3, 0, .86, 0, '#5a3a28'); box(g, 7.2, .5, 2.2, 0, .38, 0, '#2a1f1a');
    bogie(g, -2.6); bogie(g, 2.6);
    box(g, 1.4, .32, .55, 0, .32, .85, '#1e1a18'); box(g, 1.3, .04, .5, 0, .64, .85, P.brass, { ol: false });
    [-1, 1].forEach((s) => {
      box(g, .42, .05, .32, s * 3.72, .5, 1.42, '#1e1a18'); box(g, .42, .05, .32, s * 3.72, .7, 1.42, '#1e1a18');
      [-.85, .85].forEach((bz) => { add(g, new THREE.CylinderGeometry(.09, .09, .22, 12), mat('#1e1a18'), s * 4.1, .72, bz, { rz: Math.PI / 2 }); add(g, new THREE.CylinderGeometry(.14, .14, .03, 14), mat(P.brass), s * 4.22, .72, bz, { rz: Math.PI / 2, ol: false }); });
    });
    if (id !== 'observation') { box(g, .6, 2.3, 1.9, 4.3, FLOOR - .05, -.45, '#1b1612'); for (let k = 0; k < 6; k++) box(g, .025, 2.32, 1.94, 4.04 + k * .104, FLOOR - .06, -.45, '#3a2e26', { ol: false }); }
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(8, 2.58), wallTex(st)); wall.position.set(0, FLOOR + 1.29, -1.5); wall.receiveShadow = true; g.add(wall);
    box(g, 8.1, .1, .2, 0, 3.58, -1.45, P.shell);
    const small = st.ww < 1;
    st.windows.forEach((wx) => {
      const hw = st.ww / 2 + .1;
      if (!small) {
        box(g, st.ww + .2, .08, .22, wx, 1.83, -1.42, st.trim); box(g, st.ww + .2, .08, .22, wx, 2.97, -1.42, st.trim);
        box(g, .08, 1.2, .2, wx - hw, 1.84, -1.42, st.trim); box(g, .08, 1.2, .2, wx + hw, 1.84, -1.42, st.trim);
        box(g, .3, 1.15, .1, wx - .7, 1.85, -1.36, '#7a1f2a'); box(g, .3, 1.15, .1, wx + .7, 1.85, -1.36, '#7a1f2a');
      } else {
        box(g, st.ww + .14, .06, .2, wx, 2.0, -1.42, st.trim); box(g, st.ww + .14, .06, .2, wx, 2.98 - .1, -1.42, st.trim);
        box(g, .06, 1.0, .2, wx - hw + .02, 2.0, -1.42, st.trim); box(g, .06, 1.0, .2, wx + hw - .02, 2.0, -1.42, st.trim);
      }
    });
    box(g, .12, 2.58, 1.4, -3.94, FLOOR, -.8, P.shell); box(g, .12, 2.58, 1.4, 3.94, FLOOR, -.8, P.shell);
    box(g, 8.1, .14, 1.0, 0, 3.6, -1.0, P.shell); box(g, 8.1, .06, .06, 0, 3.55, -.5, P.brass, { ol: false });
    box(g, 8.1, .1, .1, 0, .84, 1.5, P.shell); box(g, 8.1, .03, .03, 0, .97, 1.52, P.brass, { ol: false });
    pendant(g, -1.9, -.9); pendant(g, 1.9, -.9);
    box(g, 3.6, .03, 1.9, 0, FLOOR, .15, st.carpet, { ol: false, cs: false });

    if (id === 'dining') {
      box(g, 7, .03, 1.0, 0, FLOOR + .03, .6, '#8a2a34', { ol: false, cs: false });
      table(g, -2.2, -.3); table(g, 2.2, -.3);
      [[-2.7, .7], [-1.7, .7], [1.7, .7], [2.7, .7]].forEach(([x, z]) => chair(g, x, z, Math.PI, P.cloth1));
      lamp(g, 0, -1.0);
    }
    if (id === 'observation') {
      armchair(g, -1.4, .55, .5, P.cloth2); armchair(g, 1.5, .55, -.5, '#c9a24a');
      box(g, .9, .35, .6, .05, FLOOR, .6, P.wood);
      lamp(g, 3.0, -.5);
    }
    if (id === 'luggage') {
      lamp(g, 0, -.4, FLOOR, 1.1, false);
      box(g, 7.2, .05, 1.0, 0, FLOOR, -.3, '#2a2018', { ol: false, cs: false });
    }
    if (id === 'sleepers') {
      for (let k = 0; k <= 6; k++) box(g, .06, 2.3, 1.3, -3.9 + k * CAB_W, FLOOR, -.85, '#2a1a22');
      for (let k = 0; k < 6; k++) {
        const x = cabinX(k);
        box(g, CAB_W, .26, .06, x, FLOOR + 2.3, -.2, '#2a1a22');
        const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.0, .25), new THREE.MeshBasicMaterial({ map: plateTexture(''), transparent: true }));
        plate.position.set(x, FLOOR + 2.43, -.16); g.add(plate); C.plates[k] = plate;
        // curtain
        box(g, .22, 1.7, .05, x - .5, FLOOR + .4, -.22, '#4a1a2a', { ol: false, cs: false }); box(g, .22, 1.7, .05, x + .5, FLOOR + .4, -.22, '#4a1a2a', { ol: false, cs: false });
      }
      lamp(g, 0, -.2, FLOOR, 1.3, false);
    }
    OL = false;
    const sp = new THREE.SpotLight('#ffd9a0', 150, 26, .66, .7, 1.5); sp.position.set(cx - 1.5, 6.8, 5.8); sp.target.position.set(cx, 1.2, -.4);
    sp.castShadow = true; sp.shadow.mapSize.set(1024, 1024); sp.shadow.bias = -.0006; sp.shadow.camera.near = 2; sp.shadow.camera.far = 22; scene.add(sp, sp.target);
    // Every toon material evaluates every light per pixel, so fold the pendant/lamp point lights of a carriage into one.
    { const pls = []; g.traverse((o) => { if (o.isPointLight) pls.push(o); });
      if (pls.length) { const keep = pls[0]; const total = pls.reduce((a, l) => a + l.intensity, 0); keep.intensity = total * .85; keep.distance = 10; keep.position.set(0, 3.0, .3); pls.slice(1).forEach((l) => l.parent.remove(l)); } }
    g.traverse((o) => { if (o.isPointLight) C.lights.push([o, o.intensity]); });
    C.lights.push([sp, sp.intensity]); C.spot = sp;
    g.traverse((o) => { if (o.isSprite) { C.glows = C.glows || []; C.glows.push([o, o.material.opacity]); } });
    C.shutter = makeShutter(g, 0, FLOOR + 1.3, 1.75, 8, 2.6, id === 'luggage' ? 'FLOODED' : 'CLOSED', id === 'luggage' ? '#1c3a5a' : '#3a3a40');
    return C;
  }
  CAR_ORDER.forEach(buildCarriage);

  /* ---------- streamlined locomotive + tender ---------- */
  const X0=20.3,TX=16.45,rods={},puffs=[],LIFE=5.5;let fireLight=null;
  function plateTex(){const c=cnv(512,96),x=c.getContext('2d');x.fillStyle='#5a1620';x.fillRect(0,0,512,96);x.strokeStyle='#c9a24a';x.lineWidth=6;x.strokeRect(6,6,500,84);x.lineWidth=2;x.strokeRect(15,15,482,66);
    x.fillStyle='#e6c068';x.font='bold 44px Georgia, serif';x.textAlign='center';x.textBaseline='middle';x.fillText('THE  LAST  TRAIN',256,50);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t}
  function buildEngine(){
    OL=true;const g=grp(train,0,0,0),SC='#1d2724',DK='#141816',OX='#7a1f2a',BR=P.brass;
    box(g,.9,.14,.22,13.0,.66,0,DK);box(g,.9,.14,.22,19.9,.66,0,DK);
    // tender
    box(g,5.8,.45,2.3,TX,.5,0,DK);bogie(g,TX-1.8);bogie(g,TX+1.8);
    box(g,6,1.9,2.9,TX,.95,0,SC);
    box(g,6.06,.1,2.96,TX,2.82,0,BR,{ol:false});[1.3,1.42].forEach(y=>box(g,6.02,.04,2.92,TX,y,0,BR,{ol:false}));
    const pl=new THREE.Mesh(new THREE.PlaneGeometry(2.9,.54),new THREE.MeshBasicMaterial({map:plateTex()}));pl.position.set(TX,2.12,1.453);g.add(pl);
    const q=mk(3);for(let k=0;k<30;k++){const s=.28+q()*.3,m=add(g,new THREE.IcosahedronGeometry(s,0),mat('#1c1c20'),TX-2.5+q()*5,2.85+q()*.2,-1.1+q()*2.2,{ol:false});m.scale.y=.55;m.rotation.y=q()*3}
    // solid frame plates between the wheels (no see-through gap), running board, splasher valance
    box(g,9.8,1.17,1.9,X0+5.1,.55,0,DK);
    box(g,2.5,.82,2.2,X0+1.35,.9,0,DK);                       // ashpan / firebox base under the cab
    box(g,1.15,.55,2.6,X0+9.25,.75,0,DK);                     // cylinder saddle
    box(g,7.4,.1,3.0,X0+6.3,1.72,0,SC);box(g,7.4,.04,3.04,X0+6.3,1.82,0,BR,{ol:false});
    box(g,7.4,.14,3.0,X0+6.3,1.58,0,SC);
    // driving wheels (oxblood centres, counterweights, crank pins) + leading & trailing trucks
    rods.drivers=[];
    [3.4,5.15,6.9].forEach(dx=>{[-1,1].forEach(sd=>{const w=wheelG(g,X0+dx,.85,sd*GAUGE,.85,{centre:OX,spokes:14,counter:1,pin:1});if(sd>0&&dx===3.4)rods.drivers.push(w)});
      add(g,new THREE.CylinderGeometry(.08,.08,2.4,8),mat('#3a3a40'),X0+dx,.85,0,{rx:Math.PI/2,ol:false})});
    [8.5,9.4].forEach(dx=>[-1,1].forEach(sd=>wheelG(g,X0+dx,.45,sd*GAUGE,.45,{centre:OX,spokes:8})));
    [-1,1].forEach(sd=>wheelG(g,X0+1.3,.5,sd*GAUGE,.5,{centre:OX,spokes:8}));
    // cylinders, slide bars, rods
    [-1,1].forEach(sd=>{hcyl(g,.34,1.1,X0+9.25,1.0,sd*1.34,SC,{seg:18});hcyl(g,.37,.06,X0+8.72,1.0,sd*1.34,BR,{ol:false,seg:18});hcyl(g,.37,.06,X0+9.78,1.0,sd*1.34,BR,{ol:false,seg:18})});
    box(g,.95,.03,.05,X0+8.25,1.12,1.46,'#8a8a92',{ol:false});box(g,.95,.03,.05,X0+8.25,.85,1.46,'#8a8a92',{ol:false});
    const rm='#a8a8b0';
    rods.coupling=add(g,new THREE.BoxGeometry(3.74,.1,.06),mat(rm),0,0,0);
    rods.main=add(g,new THREE.BoxGeometry(3.1,.11,.06),mat(rm),0,0,0);
    rods.cross=add(g,new THREE.BoxGeometry(.24,.2,.12),mat('#5a5a62'),0,0,0);
    rods.piston=add(g,new THREE.BoxGeometry(1,.05,.05),mat(rm),0,0,0,{ol:false});
    // boiler + bullet nose + brass bands
    hcyl(g,.95,6.4,X0+5.8,2.75,0,SC,{seg:32});
    [3.0,4.6,6.2,7.8].forEach(dx=>add(g,new THREE.TorusGeometry(.955,.028,6,36),mat(BR),X0+dx,2.75,0,{ry:Math.PI/2,ol:false}));
    lathe(g,[[.95,0],[.94,.3],[.88,.6],[.74,.9],[.54,1.13],[.3,1.3],[0,1.38]],X0+9.0,2.75,0,SC,{geoRot:['z',-Math.PI/2],seg:32});
    add(g,new THREE.TorusGeometry(.952,.03,6,36),mat(BR),X0+9.0,2.75,0,{ry:Math.PI/2,ol:false});
    [2.28,2.4].forEach(y=>{const dz=Math.sqrt(.95*.95-(y-2.75)**2)+.012;box(g,6.2,.035,.03,X0+5.8,y,dz,BR,{ol:false})});
    box(g,1.7,.08,3.0,X0+9.25,1.55,0,SC);
    // headlamp + beam
    hcyl(g,.17,.22,X0+10.3,2.75,0,BR,{seg:18});
    add(g,new THREE.CircleGeometry(.14,20),mat('#fff6d8',{basic:true}),X0+10.415,2.75,0,{ry:Math.PI/2,ol:false});
    glowSprite(g,X0+10.6,2.75,0,3.6,.95,'#fff0c0');
    const beam=new THREE.Mesh(new THREE.ConeGeometry(1.8,12,24,1,true),new THREE.MeshBasicMaterial({color:'#ffe8b8',transparent:true,opacity:.07,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false}));
    beam.rotation.z=Math.PI/2;beam.position.set(X0+16.45,2.6,0);beam.renderOrder=5;g.add(beam);
    const hl=new THREE.SpotLight('#fff0c8',90,40,.4,.6,1.4);hl.position.set(X0+10.5,2.75,0);hl.target.position.set(X0+24,0,0);scene.add(hl,hl.target);
    // chimney, domes, whistle
    cyl(g,.22,.27,.32,X0+8.0,3.6,0,SC,{seg:18});cyl(g,.25,.25,.05,X0+8.0,3.9,0,BR,{ol:false,seg:18});
    sph(g,.4,X0+5.8,3.58,0,SC,{th:Math.PI*.5,seg:20});cyl(g,.41,.41,.04,X0+5.8,3.56,0,BR,{ol:false,seg:20});
    sph(g,.3,X0+4.3,3.6,0,SC,{th:Math.PI*.5,seg:18});
    cyl(g,.035,.045,.25,X0+3.3,3.66,0,BR,{seg:8});
    // open-sided cab (dollhouse cutaway like the carriages)
    box(g,2.6,.12,3.0,X0+1.3,1.72,0,'#3a2a20');
    box(g,2.6,2.45,.1,X0+1.3,1.84,-1.45,SC);box(g,.1,2.45,3.0,X0+.05,1.84,0,SC);
    box(g,2.6,.85,.1,X0+1.3,1.84,1.45,SC);box(g,2.62,.04,.12,X0+1.3,2.69,1.45,BR,{ol:false});
    box(g,2.95,.14,3.3,X0+1.3,4.29,0,SC);box(g,2.97,.04,3.32,X0+1.3,4.26,0,BR,{ol:false});
    [.75,1.85].forEach(dx=>{box(g,.78,.66,.03,X0+dx,2.95,-1.39,BR,{ol:false});box(g,.68,.56,.035,X0+dx,3.0,-1.385,'#2e3e48',{ol:false})});
    box(g,.32,2.2,2.2,X0+2.44,1.84,0,'#2a2420');
    box(g,.04,.4,.55,X0+2.27,2.05,0,'#ff8a2a',{basic:true,ol:false});glowSprite(g,X0+2.1,2.25,0,1.8,.9,'#ff9a40');
    [-.5,0,.5].forEach(zz=>add(g,new THREE.CylinderGeometry(.08,.08,.04,16),mat('#e8e0d0'),X0+2.27,3.2,zz,{rz:Math.PI/2}));
    box(g,.06,.06,1.6,X0+2.26,2.75,0,BR,{ol:false});
    fireLight=new THREE.PointLight('#ff8a30',14,6,2);fireLight.position.set(X0+1.9,2.4,0);g.add(fireLight);
    const cabL=new THREE.PointLight('#ffcf80',6,5,2);cabL.position.set(X0+1.2,3.8,0);g.add(cabL);
    figure(g,X0+1.2,-.2,DRIVER,1.2,1.84);
    // buffer beam + pilot
    box(g,.22,.45,2.8,X0+10.05,.42,0,OX);
    const pil=box(g,.9,.5,2.6,X0+10.45,.02,0,'#2a2420');pil.rotation.z=-.55;
    OL=false;
    // steam
    // steam trail: drawn after the painted scenery layers so they can't paint over it
    for(let k=0;k<90;k++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:SMOKE,color:'#dcd6d0',transparent:true,depthWrite:false,fog:false,opacity:0}));s.renderOrder=6;s.userData={age:k/90*LIFE,seed:Math.random()};g.add(s);puffs.push(s)}
  }
  buildEngine();
  // the driver is an NPC: stand him at the firebox so passengers have room in the cab
  { const drv = figs[figs.length - 1]; drv.position.set(X0 + 1.95, 1.84, -.95); drv.rotation.y = -.5; drv.userData.fixed = true; }
  carObj.engine = { id: 'engine', g: train, cx: CAR_X.engine, lights: [], base: [] };
  carObj.engine.shutter = makeShutter(train, CAR_X.engine, 3.0, 1.75, 3.1, 2.6, 'LOCKED', '#4a1a22');

  // track (static) + sleepers (scrolling)
  const bal=new THREE.Mesh(new THREE.BoxGeometry(220,.14,3.0),mat('#3a342e'));bal.position.set(0,.05,0);bal.receiveShadow=true;stat.add(bal);
  // rails sit exactly under the wheel treads; the whole train is lifted so tread bottoms rest on the rail tops
  train.position.y=.18;
  [-GAUGE,GAUGE].forEach(z=>{const r=new THREE.Mesh(new THREE.BoxGeometry(220,.06,.1),mat('#8a8a92'));r.position.set(0,.15,z);r.receiveShadow=true;stat.add(r);
    const w=new THREE.Mesh(new THREE.BoxGeometry(220,.04,.16),mat('#4a4a50'));w.position.set(0,.1,z);stat.add(w)});
  const sleepers=[];for(let i=0;i<120;i++){const s=new THREE.Mesh(new THREE.BoxGeometry(.3,.07,2.9),mat('#2a1f1a'));s.position.set(-72+i*1.2,.15,0);s.receiveShadow=true;stat.add(s);sleepers.push(s)}

  /* ================================================================ */
  /* props: one visible object per searchable thing                    */
  /* ================================================================ */
  const props = new Map();
  function makeProp(o) {
    OL = true;
    const x = propX(o), cab = o.carriage === 'sleepers', eng = o.carriage === 'engine';
    const parent = grp(train, x, 0, 0);
    const y0 = eng ? 1.84 : FLOOR, z = -1.12;
    const lock = (px, py, pz) => { const l = sph(parent, .07, px, py, pz, P.brass, { seg: 8 }); return l; };
    let lockMesh = null;
    switch (o.kind) {
      case 'trunk': {
        const zz = cab ? -.55 : z;
        box(parent, .72, .42, .46, 0, y0, zz, '#6a3f26'); box(parent, .74, .05, .48, 0, y0 + .2, zz, '#3a2418', { ol: false }); box(parent, .06, .43, .48, -.2, y0, zz, P.brass, { ol: false }); box(parent, .06, .43, .48, .2, y0, zz, P.brass, { ol: false });
        lockMesh = lock(0, y0 + .22, zz + .25); break;
      }
      case 'crate': {
        box(parent, .72, .66, .62, 0, y0, z, '#8a6a44'); for (let k = 0; k < 3; k++) box(parent, .76, .04, .64, 0, y0 + .14 + k * .22, z, '#5a4228', { ol: false });
        box(parent, .04, .68, .64, -.32, y0, z, '#5a4228', { ol: false }); box(parent, .04, .68, .64, .32, y0, z, '#5a4228', { ol: false }); break;
      }
      case 'bag': {
        const b = cap(parent, .22, .32, 0, y0 + .26, z, '#5a3a28'); b.rotation.z = Math.PI / 2; box(parent, .5, .04, .06, 0, y0 + .48, z + .1, '#2a1a12', { ol: false }); box(parent, .06, .1, .05, 0, y0 + .22, z + .24, P.brass, { ol: false }); break;
      }
      case 'shelf': {
        box(parent, .86, 1.7, .36, 0, y0, z - .1, '#4a2f20'); [0, 1, 2].forEach((k) => { box(parent, .8, .04, .3, 0, y0 + .5 + k * .5, z - .08, '#3a2418', { ol: false, cs: false }); books(parent, -.34, y0 + .54 + k * .5, z - .08, .7, 8); }); break;
      }
      case 'drawer': {
        box(parent, .92, .86, .44, 0, y0, z, '#6a3f26'); box(parent, .96, .05, .48, 0, y0 + .86, z, '#3a2418', { ol: false });
        [-.25, .25].forEach((dx) => sph(parent, .03, dx, y0 + .5, z + .23, P.brass, { seg: 6, ol: false })); break;
      }
      case 'lockbox': {
        box(parent, .62, .4, .42, 0, y0, z, '#2a2a30'); box(parent, .64, .05, .44, 0, y0 + .2, z, '#4a4a52', { ol: false }); box(parent, .06, .41, .44, 0, y0, z, P.brass, { ol: false });
        lockMesh = lock(0, y0 + .22, z + .24); break;
      }
      case 'window': { break; }
      case 'lantern': {
        cyl(parent, .012, .012, .5, 0, y0 + 2.45, -.9, '#3a2a22', { seg: 5, ol: false });
        cyl(parent, .1, .14, .32, 0, y0 + 2.1, -.9, '#c9a24a', LIT({ seg: 10, ol: false })); glowSprite(parent, 0, y0 + 2.25, -.85, 1.2, .5); break;
      }
      case 'cabinet': {
        box(parent, .86, 1.8, .42, 0, y0, z - .05, '#4a2f20'); box(parent, .7, 1.5, .02, 0, y0 + .15, z + .17, '#10161a', { ol: false });
        box(parent, .02, 1.5, .03, 0, y0 + .15, z + .185, P.brass, { ol: false }); lockMesh = lock(0, y0 + .9, z + .22); break;
      }
      case 'bunk': {
        box(parent, 1.0, .12, .62, 0, y0 + 1.2, -.9, '#4a2f20'); box(parent, .96, .14, .56, 0, y0 + 1.32, -.9, '#e8e0d0'); box(parent, .4, .1, .4, -.28, y0 + 1.46, -.9, '#fff');
        box(parent, .9, .06, .52, .05, y0 + 1.46, -.9, '#7a1f2a', { ol: false }); box(parent, .05, 1.3, .05, -.48, y0, -.62, '#3a2418', { ol: false }); box(parent, .05, 1.3, .05, .48, y0, -.62, '#3a2418', { ol: false }); break;
      }
      case 'desk': {
        box(parent, .96, .06, .52, 0, y0 + .74, z + .05, '#6a3f26'); [-.42, .42].forEach((dx) => box(parent, .06, .74, .46, dx, y0, z + .05, '#4a2f20', { ol: false }));
        box(parent, .3, .02, .22, -.12, y0 + .8, z + .05, '#e8e0d0', { ol: false }); cyl(parent, .03, .03, .1, .28, y0 + .8, z + .05, '#1b1210', { seg: 6, ol: false }); break;
      }
      case 'coat': {
        cyl(parent, .03, .04, 1.8, 0, y0, z - .1, '#3a2418', { seg: 6 }); box(parent, .8, .04, .04, 0, y0 + 1.75, z - .1, '#3a2418', { ol: false });
        [-.28, 0, .28].forEach((dx, k) => box(parent, .26, .8, .1, dx, y0 + .95, z - .02, ['#3a3d46', '#4e5a3a', '#5b2a55'][k])); break;
      }
      case 'device': default: {
        cyl(parent, .05, .06, 1.0, 0, y0, z, '#3a3a40', { seg: 6 }); const tube = cyl(parent, .06, .09, .8, 0, y0 + 1.0, z, P.brass, { seg: 12 }); tube.rotation.z = Math.PI / 2 - .5; sph(parent, .08, 0, y0 + 1.0, z + .02, P.brass, { seg: 8 }); break;
      }
    }
    OL = false;
    const abs = !!ABSOLUTE_ANCHOR[o.kind];
    const anchor = new THREE.Vector3(x, (abs ? 0 : y0) + (ANCHOR_Y[o.kind] ?? 1) + .18, o.kind === 'bunk' ? -.7 : (o.kind === 'lantern' ? -.9 : (cab && o.kind === 'trunk' ? -.55 : z)));
    const rec = { o, group: parent, anchor, lockMesh, x, y0, z: anchor.z, el: null };
    props.set(o.id, rec);
    return rec;
  }

  /* ================================================================ */
  /* passengers and the conductor                                      */
  /* ================================================================ */
  const people = new Map();
  let conductor = null;
  function makeLabel(cls) {
    const el = document.createElement('div'); el.className = 'pl ' + cls; el.innerHTML = '<span class="nm"></span><span class="st"></span><i class="bar"><b></b></i>';
    layer.appendChild(el); return el;
  }
  function ensurePerson(p) {
    let r = people.get(p.id);
    const idx = CHAR_INDEX[p.characterId];
    if (r && r.idx !== idx) { train.remove(r.g); r.el.remove(); people.delete(p.id); r = null; }
    if (!r) {
      OL = true;
      const cur = SPAWN[p.carriage] ?? { x: CAR_X.sleepers, y: FLOOR, z: .5 };
      const g = figure(train, cur.x, cur.z, CAST[idx], 0, cur.y);
      OL = false;
      figs.splice(figs.indexOf(g), 1);
      r = { id: p.id, idx, g, el: makeLabel('person'), p, pos: new THREE.Vector3(cur.x, cur.y, cur.z), ry: 0, lay: 0, k: 0, n: 1, vis: true };
      people.set(p.id, r);
    }
    return r;
  }
  const SPAWN = { sleepers: { x: CAR_X.sleepers, y: FLOOR, z: .5 }, dining: { x: 0, y: FLOOR, z: .5 } };
  function ensureConductor() {
    if (conductor) return conductor;
    OL = true;
    const g = figure(train, CAR_X.dining + 3.3, .6, CONDUCTOR, 0, FLOOR);
    OL = false;
    figs.splice(figs.indexOf(g), 1);
    conductor = { g, el: makeLabel('conductor'), pos: new THREE.Vector3(CAR_X.dining + 3.3, FLOOR, .6), car: 'dining' };
    conductor.el.querySelector('.nm').textContent = 'Conductor';
    return conductor;
  }

  /* ================================================================ */
  /* painted world                                                     */
  /* ================================================================ */
  const bundles = new Map();
  let active = null;
  // yield to the browser between painted layers; MessageChannel is not throttled in background tabs like setTimeout is
  const tick = () => new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
  async function makeBundle(theme) {
    const S = STN[theme], idx = THEME_ORDER.indexOf(theme), r = mk(idx * 7919 + 101);
    const group = new THREE.Group();
    const B = { theme, S, group, layers: [], points: [], fireLights: [], groundTexRef: null, bg: skyTex(S, mk(idx * 31 + 7)), ready: false };
    await tick();
    B.groundTexRef = groundTex(S.ground, mk(77)); B.groundTexRef.repeat.set(700 / 12, 300 / 12); B.groundTexRef.anisotropy = ANI;
    const wet = !!S.mirror;
    const gm = new THREE.MeshBasicMaterial({ map: B.groundTexRef, transparent: wet, opacity: theme === 'flood' ? .6 : wet ? .8 : 1, depthWrite: true });
    const gr = new THREE.Mesh(new THREE.PlaneGeometry(700, 300), gm); gr.rotation.x = -Math.PI / 2; gr.position.set(0, 0, -105); gr.renderOrder = 2; group.add(gr);
    if (theme === 'flood') { const cw = new THREE.Mesh(new THREE.BoxGeometry(220, .5, 3.6), mat('#3a342e')); cw.position.set(0, -.12, 0); group.add(cw); }
    for (const L of S.layers) {
      await tick();
      let c = cnv(L.W, L.H); const x = c.getContext('2d'); PAINT[L.p](x, L.W, L.H, mk((r() * 1e9) | 0), L.o);
      const bl = L.blur ?? (L.z < -80 ? 1.4 : L.z < -40 ? .7 : 0);
      if (bl) { const c2 = cnv(L.W, L.H), x2 = c2.getContext('2d'); x2.filter = `blur(${bl}px)`;[-L.W, 0, L.W].forEach((o) => x2.drawImage(c, o, 0)); x2.filter = 'none'; c = c2; }
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping; tex.anisotropy = ANI;
      const pw = Math.max(90, 2.5 * (34 - L.z) + 44), tileW = L.h * L.W / L.H; tex.repeat.set(pw / tileW, 1); tex.offset.x = r();
      const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: !L.add, fog: false, blending: L.add ? THREE.AdditiveBlending : THREE.NormalBlending });
      const geo = new THREE.PlaneGeometry(pw, L.h); geo.translate(0, L.h / 2, 0);
      const me = new THREE.Mesh(geo, m); me.position.set(9, L.y ?? -.3, L.z); me.renderOrder = 3; group.add(me);
      const rec = { tex, tileW, still: L.still, mesh: me, flick: L.flick, ph: r() * 6 };
      if (S.mirror && L.z < 0 && !L.still) { const mm = m.clone(); mm.color = new THREE.Color(S.mirror); mm.opacity = L.add ? .45 : .5; mm.depthWrite = false; const mi = new THREE.Mesh(geo, mm); mi.scale.y = -1; mi.position.set(9, -(L.y ?? -.3), L.z); mi.renderOrder = 1; group.add(mi); rec.mirror = mi; }
      B.layers.push(rec);
    }
    const pts = (n, b, col, size, addv, kind, y0 = 0) => {
      const geo = new THREE.BufferGeometry(), a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { a[i * 3] = 9 + (r() - .5) * b[0]; a[i * 3 + 1] = r() * b[1]; a[i * 3 + 2] = b[2] + r() * b[3]; }
      geo.setAttribute('position', new THREE.BufferAttribute(a, 3));
      const p = new THREE.Points(geo, new THREE.PointsMaterial({ color: col, size, transparent: true, depthWrite: false, blending: addv ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false }));
      p.position.y = y0; p.userData = { kind, w: b[0] }; group.add(p); B.points.push(p);
    };
    if (theme === 'snow') pts(1000, [76, 18, -24, 40], '#ffffff', .12, false, 'snow');
    if (theme === 'burning') pts(320, [84, 3, -34, 30], '#ffb040', .15, true, 'ember');
    if (theme === 'forest') pts(80, [52, 4, -14, 12], '#ffe9a0', .14, true, 'fly', 1.2);
    if (theme === 'flood') pts(120, [56, 4, -18, 16], '#ffe0a0', .16, true, 'fly', .6);
    if (theme === 'dark') pts(90, [56, 5, -18, 16], '#9fb4ff', .13, true, 'fly', .8);
    if (S.fire) for (const x of [-7, 7, 22]) { const l = new THREE.PointLight('#ff8a30', 45, 24, 2); l.position.set(x, 4, -7); l.userData.ph = r() * 6; B.fireLights.push(l); }
    B.ready = true;
    return B;
  }
  function disposeBundle(B) {
    B.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
    if (B.bg && B.bg.dispose) B.bg.dispose();
    B.fireLights.forEach((l) => scene.remove(l));
  }
  function prepareStation(theme) {
    if (!bundles.has(theme)) bundles.set(theme, makeBundle(theme));
    return bundles.get(theme);
  }
  async function setStation(theme) {
    const B = await prepareStation(theme);
    if (active === B) return;
    const old = active; active = B;
    if (old) { world.remove(old.group); old.fireLights.forEach((l) => scene.remove(l)); }
    world.add(B.group);
    const S = B.S;
    scene.background = B.bg; scene.fog = new THREE.Fog(S.fog, 60, 230);
    hemi.color.set(S.hemi[0]); hemi.groundColor.set(S.hemi[1]); hemi.intensity = S.hemi[2]; moon.color.set(S.moon[0]); moon.intensity = S.moon[1];
    puffs.forEach((s) => s.material.color.set(SMK[theme]));
    B.fireLights.forEach((l) => scene.add(l));
    api.theme = theme;
    cleanup();
  }
  const keep = new Set();
  // free every cached scenery bundle that is neither the current one nor one we plan to use next
  function cleanup() {
    for (const [k, v] of [...bundles]) if (k !== api.theme && !keep.has(k)) { bundles.delete(k); v.then((b) => disposeBundle(b)); }
  }

  /* ================================================================ */
  /* camera                                                            */
  /* ================================================================ */
  let mode = { kind: 'title' }, aspect = 16 / 9, mx = 0, my = 0;
  const cp = new THREE.Vector3(10, 6, 52), cl = new THREE.Vector3(10, 3.4, 0), tv = new THREE.Vector3(), lv = new THREE.Vector3();
  const TAN = Math.tan(THREE.MathUtils.degToRad(35 / 2));
  const fitZ = (halfW) => THREE.MathUtils.clamp(halfW / (TAN * aspect), 6.5, 64);
  function camGoal(t) {
    if (mode.kind === 'overview') { const z = fitZ(29); return { pos: [5.2 + mx * 3, 7 - my * 1.2, z + 2], look: [5.2, 3.6, 0] }; }
    if (mode.kind === 'car') {
      const id = mode.car, cx = CAR_X[id];
      if (id === 'engine') { const z = fitZ(3.4); return { pos: [cx + 1.4 + mx * 1.2, 4.3 - my * .6, z + 2], look: [cx + .6, 2.8, 0] }; }
      const z = fitZ(4.9);
      return { pos: [cx + .6 + mx * 1.6, 4.6 - my * .8, z + 1.6], look: [cx + .15, 2.45, 0] };
    }
    // title: a slow drift along the whole train
    const sw = Math.sin(t * .045);
    return { pos: [6 + sw * 14, 5.2, fitZ(15) + 4], look: [6 + sw * 14, 3.1, 0] };
  }

  /* ================================================================ */
  /* sync from server state                                            */
  /* ================================================================ */
  let V = null, off = 0, speed = 3, speedGoal = 3, lightScale = {}, shutterOp = {}, speaking = new Set(), showLabels = true;
  const now = () => Date.now() + off;
  const slotLists = {};

  function sync(view, offset) {
    V = view; off = offset;
    // passengers
    const seen = new Set();
    for (const p of view.players) {
      if (!p.characterId) continue;
      seen.add(p.id);
      const r = ensurePerson(p); r.p = p;
      r.el.querySelector('.nm').textContent = p.name + (p.id === view.youId ? ' (you)' : '');
      r.el.classList.toggle('me', p.id === view.youId);
      r.el.classList.toggle('asleep', !p.connected);
    }
    for (const [id, r] of people) if (!seen.has(id)) { train.remove(r.g); r.el.remove(); people.delete(id); }
    // per-carriage ordering for idle slots
    for (const k in slotLists) delete slotLists[k];
    for (const r of people.values()) { const c = r.p.transit ? null : r.p.carriage; if (!c) continue; (slotLists[c] ||= []).push(r); }
    for (const c in slotLists) { slotLists[c].sort((a, b) => (a.p.id < b.p.id ? -1 : 1)); slotLists[c].forEach((r, i) => { r.k = i; r.n = slotLists[c].length; }); }
    // conductor
    if (view.conductor) { const c = ensureConductor(); c.car = view.conductor.carriage; c.on = true; } else if (conductor) conductor.on = false;
    // objects -> props
    const ids = new Set();
    for (const o of view.objects) { ids.add(o.id); let rec = props.get(o.id); if (!rec) rec = makeProp(o); rec.o = o; }
    for (const [id, rec] of props) if (!ids.has(id)) { train.remove(rec.group); rec.el?.remove(); props.delete(id); }
    // sleeper nameplates
    CAR_ORDER.includes('sleepers') && carObj.sleepers.plates.forEach((pl, slot) => {
      const owner = view.objects.find((o) => o.carriage === 'sleepers' && o.slot === slot && o.ownerPlayerId);
      const who = owner ? view.players.find((p) => p.id === owner.ownerPlayerId) : null;
      const label = who?.characterName ?? '';
      if (pl.userData.label !== label) { pl.userData.label = label; pl.material.map?.dispose(); pl.material.map = plateTexture(label); pl.material.needsUpdate = true; }
    });
    // lights out / shutters
    const ef = view.effects;
    for (const id of Object.keys(carObj)) {
      const dark = id === 'sleepers' && ef.lockedSearch.includes('sleepers');
      lightScale[id] = dark ? .12 : 1;
      shutterOp[id] = id === 'engine' ? (ef.engineUnlocked ? 0 : .93) : (ef.closed.includes(id) ? .9 : 0);
    }
    speedGoal = view.phase === 'lobby' ? 3 : view.phase === 'ending' ? (view.ending?.done ? 0 : 1.5) : view.phase === 'finalVote' ? 1.5 : view.phase === 'event' && view.station === 5 ? 2.5 : SPEED_CRUISE;
  }

  /* ================================================================ */
  /* frame                                                              */
  /* ================================================================ */
  let t = 0, running = true, last = performance.now(), W = 1, H = 1, frameNo = 0;
  const v3 = new THREE.Vector3();
  const ease = (u) => u * u * (3 - 2 * u);
  const hsEls = new Map();
  function project(v, out) { v3.copy(v).project(camera); out.x = (v3.x * .5 + .5) * W; out.y = (-v3.y * .5 + .5) * H; out.z = v3.z; return out; }
  const pt = { x: 0, y: 0, z: 0 };
  const placeEl = (el, p) => { if (p.z > 1) { el.style.display = 'none'; return false; } el.style.display = ''; el.style.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px)`; return true; };

  function carSlot(carId, r) {
    if (carId === 'sleepers') { const o = V?.objects.find((q) => q.carriage === 'sleepers' && q.ownerPlayerId === r.p.id); return { x: o ? CAR_X.sleepers + cabinX(o.slot) : CAR_X.sleepers, z: .55, y: FLOOR }; }
    if (carId === 'engine') return { x: CAR_X.engine - .3 + (r.k - (r.n - 1) / 2) * .55, z: .55 + (r.k % 2) * .3, y: 1.84 };
    const sp = Math.min(1.5, 6 / Math.max(1, r.n));
    return { x: CAR_X[carId] + (r.k - (r.n - 1) / 2) * sp, z: .5 + (r.k % 2) * .35, y: FLOOR };
  }

  function update(dt) {
    t += dt;
    // camera
    const goal = camGoal(t), kk = 1 - Math.pow(.001, dt * 1.2);
    tv.set(...goal.pos); cp.lerp(tv, dt ? kk : 1); cl.lerp(lv.set(...goal.look), dt ? kk : 1);
    camera.position.copy(cp); camera.lookAt(cl); camera.updateMatrixWorld();
    speed += (speedGoal - speed) * Math.min(1, dt * 1.5);
    // scenery
    if (active) {
      active.layers.forEach((l) => {
        if (!l.still) l.tex.offset.x += speed * dt / l.tileW;
        if (l.flick) { const f = .8 + .2 * Math.sin(t * 7.3 + l.ph) * Math.sin(t * 3.1 + l.ph * 2); l.mesh.material.opacity = f; l.mesh.scale.y = .95 + .07 * f; if (l.mirror) { l.mirror.material.opacity = f * .45; l.mirror.scale.y = -(.95 + .07 * f); } }
      });
      if (active.groundTexRef) active.groundTexRef.offset.x += speed * dt / 12;
      active.fireLights.forEach((l) => { l.intensity = 45 * (.75 + .25 * Math.sin(t * 9 + l.userData.ph) * Math.sin(t * 4.3 + l.userData.ph)); });
      active.points.forEach((p) => {
        const a = p.geometry.attributes.position, kd = p.userData.kind, Wd = p.userData.w, lo = 9 - Wd / 2;
        for (let i = 0; i < a.count; i++) {
          let x = a.getX(i), y = a.getY(i);
          if (kd === 'snow') { y -= 1.3 * dt; x -= speed * .35 * dt + Math.sin(t + i) * .004; if (y < 0) y = 18; }
          if (kd === 'ember') { y += 1.3 * dt + Math.sin(t * 3 + i) * .01; x -= speed * .5 * dt; if (y > 18) y = 0; }
          if (kd === 'fly') { x += Math.sin(t * .8 + i) * .005 - speed * .15 * dt; y += Math.cos(t * 1.1 + i * 1.7) * .004; }
          if (x < lo) x += Wd;
          a.setX(i, x); a.setY(i, y);
        }
        a.needsUpdate = true;
      });
    }
    sleepers.forEach((s) => { s.position.x -= speed * dt; if (s.position.x < -72) s.position.x += 144; });
    wheels.forEach((w) => { w.rotation.z -= speed / w.userData.r * dt; });
    if (rods.drivers.length) {
      const th = rods.drivers[0].rotation.z, pr = .85 * .45, px = X0 + 5.15 + pr * Math.cos(th), py = .85 + pr * Math.sin(th), Ln = 3.1, xc = px + Math.sqrt(Ln * Ln - (py - 1) ** 2), cr = X0 + 8.7;
      rods.coupling.position.set(px, py, 1.42);
      rods.main.position.set((px + xc) / 2, (py + 1) / 2, 1.5); rods.main.rotation.z = Math.atan2(1 - py, xc - px);
      rods.cross.position.set(xc, 1, 1.47); rods.piston.scale.x = Math.max(.05, cr - xc); rods.piston.position.set((xc + cr) / 2, 1, 1.44);
    }
    if (fireLight) fireLight.intensity = 14 * (.75 + .25 * Math.sin(t * 11) * Math.sin(t * 4.7));
    puffs.forEach((s) => {
      const u = s.userData; u.age += dt; if (u.age > LIFE) u.age -= LIFE; const a = u.age, k2 = a / LIFE;
      s.position.set(X0 + 8.0 - (4.2 * a + .9 * a * a) + (u.seed - .5) * .6, 4.0 + 1.9 * a - .13 * a * a + Math.sin(a * 1.3 + u.seed * 6) * .15, (u.seed - .5) * 2.2 * k2);
      const sc = .7 + 4.6 * k2; s.scale.set(sc, sc * .85, 1); s.material.opacity = .78 * Math.pow(1 - k2, 1.3) * Math.min(1, a * 5); s.material.rotation = u.seed * 6 + a * .25;
    });
    CAR_ORDER.forEach((id, i) => { carObj[id].g.position.y = Math.sin(t * 9 + i * 2) * .006 * Math.min(1, speed / 5); });

    // shadow maps are the most expensive part of a frame: only the carriage on screen needs live shadows
    frameNo++;
    for (const id of CAR_ORDER) { const sh = carObj[id].spot.shadow; sh.autoUpdate = mode.kind === 'car' && mode.car === id; if (mode.kind !== 'car' && frameNo % 10 === 0) sh.needsUpdate = true; }

    // lights and shutters ease toward their goals
    for (const id of Object.keys(carObj)) {
      const C = carObj[id], ls = lightScale[id] ?? 1, cur = C.curLight ?? 1; C.curLight = cur + (ls - cur) * Math.min(1, dt * 3);
      if (id !== 'engine') { C.lights.forEach(([l, base]) => { l.intensity = base * C.curLight; }); C.glows?.forEach(([s, base]) => { s.material.opacity = base * C.curLight; }); }
      const so = shutterOp[id] ?? 0, co = C.shutter.material.opacity;
      const next = co + (so - co) * Math.min(1, dt * 4); C.shutter.material.opacity = next; C.shutter.visible = next > .01;
    }

    // passengers
    if (V) {
      for (const r of people.values()) {
        const p = r.p, g = r.g;
        let target, face = 0, vis = true, bob = 0, lie = false;
        if (p.transit) {
          const a = p.transit.from, b = p.transit.to, u = THREE.MathUtils.clamp((now() - p.transit.startedAt) / Math.max(1, p.transit.arriveAt - p.transit.startedAt), 0, 1);
          const sa = carSlot(a, { ...r, k: 0, n: 1 }), sb = carSlot(b, { ...r, k: 0, n: 1 }), e = ease(u);
          target = new THREE.Vector3(THREE.MathUtils.lerp(sa.x, sb.x, e), THREE.MathUtils.lerp(sa.y, sb.y, e), .6);
          face = Math.sign(sb.x - sa.x) * Math.PI / 2; bob = Math.abs(Math.sin(t * 14)) * .05;
          if (a === 'engine' || b === 'engine') vis = u < .2 || u > .8;
          r.pos.copy(target);
        } else if (!p.connected) {
          const s = carSlot('sleepers', r); lie = true; target = new THREE.Vector3(s.x - .55, FLOOR + 1.0, -.88); r.pos.lerp(target, Math.min(1, dt * 5));
        } else {
          const car = p.carriage, base = carSlot(car, r);
          target = new THREE.Vector3(base.x, base.y, base.z);
          if (p.activity) {
            const rec = props.get(p.activity.objectId);
            if (rec) { target.x = rec.x + (r.k % 2 ? .38 : -.38) * (p.activity.kind === 'gaze' ? 0 : 1); target.z = .15; target.y = base.y; face = Math.PI; }
          }
          r.pos.lerp(target, Math.min(1, dt * 5));
          if (!p.activity) face = 0;
        }
        g.position.set(r.pos.x, r.pos.y + bob + (lie ? 0 : Math.sin(t * 1.6 + r.k) * .012), r.pos.z);
        r.ry += (face - r.ry) * Math.min(1, dt * 8);
        g.rotation.set(0, lie ? 0 : r.ry + (p.activity ? 0 : Math.sin(t * .7 + r.k) * .06), lie ? -Math.PI / 2 : 0);
        g.scale.setScalar(lie ? .6 : 1);
        g.visible = vis;
        r.vis = vis;
      }
      if (conductor) {
        const C = conductor, car = C.car;
        const tgt = new THREE.Vector3(CAR_X[car] + (car === 'engine' ? .75 : 3.1), car === 'engine' ? 1.84 : FLOOR, car === 'engine' ? -.2 : .6);
        C.pos.lerp(tgt, Math.min(1, dt * 1.2)); C.g.position.copy(C.pos); C.g.rotation.y = Math.sin(t * .6) * .12 - .15; C.g.visible = !!C.on;
      }
    }

    // DOM overlays
    if (V) {
      const meId = V.youId, me = V.players.find((p) => p.id === meId);
      for (const r of people.values()) {
        const hp = new THREE.Vector3(r.g.position.x, r.g.position.y + (r.g.scale.x < 1 ? 1.5 : 2.15) + .18, r.g.position.z);
        const p = r.p, el = r.el, vis = r.vis && showLabels;
        if (!vis || !placeEl(el, project(hp, pt))) { if (!vis) el.style.display = 'none'; continue; }
        const act = p.activity;
        el.classList.toggle('busy', !!act);
        el.classList.toggle('talking', speaking.has(p.id));
        el.classList.toggle('walking', !!p.transit);
        if (act) { const u = THREE.MathUtils.clamp((now() - act.startedAt) / Math.max(1, act.endsAt - act.startedAt), 0, 1); el.querySelector('.bar b').style.width = (u * 100).toFixed(0) + '%'; el.querySelector('.st').textContent = act.kind === 'gaze' ? 'gazing' : 'searching'; }
        else el.querySelector('.st').textContent = !p.connected ? 'asleep' : p.confined ? 'locked in' : '';
      }
      if (conductor) { const hp = new THREE.Vector3(conductor.g.position.x, conductor.g.position.y + 2.3, conductor.g.position.z); if (conductor.on && showLabels) placeEl(conductor.el, project(hp, pt)); else conductor.el.style.display = 'none'; }
      // hotspots for the objects in my carriage
      const myCar = me && !me.transit ? me.carriage : null;
      for (const [id, rec] of props) {
        let el = rec.el;
        const o = rec.o, show = !!myCar && mode.kind !== 'overview' && o.carriage === myCar && V.phase !== 'lobby' && !o.dormant && !(V.effects.closed.includes(o.carriage));
        if (!show) { if (el) el.style.display = 'none'; continue; }
        if (!el) {
          el = rec.el = document.createElement('button'); el.className = 'hs'; el.type = 'button';
          el.innerHTML = '<span class="dot"></span><span class="tip"></span><i class="bar"><b></b></i>';
          el.addEventListener('click', (e) => { e.stopPropagation(); handlers.onHotspot(id); });
          layer.appendChild(el);
        }
        const wp = rec.anchor.clone(); if (!placeEl(el, project(wp, pt))) continue;
        const win = o.kind === 'window';
        const locked = !!o.locked, searched = !!o.searched && !win;
        const dark = !win && V.effects.lockedSearch.includes(o.carriage), frost = win && V.effects.lockVision;
        const mine = me?.activity?.objectId === id;
        const others = V.players.filter((p) => p.id !== meId && p.activity?.objectId === id).length;
        el.className = 'hs' + (locked ? ' locked' : '') + (searched ? ' done' : '') + (dark ? ' dark' : '') + (frost ? ' dark' : '') + (win ? ' vision' : '') + (mine ? ' mine' : '') + (others ? ' others' : '');
        if (rec.lockMesh) rec.lockMesh.visible = locked;
        const tip = el.querySelector('.tip'); const txt = o.label + (locked ? ' · locked' : searched ? ' · searched' : dark ? ' · too dark' : frost ? ' · frosted over' : win ? ' · gaze' : ' · search');
        if (tip.textContent !== txt) tip.textContent = txt;
        if (mine) { const a = me.activity, u = THREE.MathUtils.clamp((now() - a.startedAt) / Math.max(1, a.endsAt - a.startedAt), 0, 1); el.querySelector('.bar b').style.width = (u * 100).toFixed(0) + '%'; }
      }
    }
  }

  function loop(ts) {
    if (!running) return;
    const raw = (ts - last) / 1000; const dt = Math.min(raw, .05) || 0; last = ts; if (raw > 0 && raw < 1) stats.fps += ((1 / raw) - stats.fps) * .05;
    const a = performance.now(); update(dt); const b = performance.now(); renderer.render(scene, camera); const c = performance.now();
    stats.update += ((b - a) - stats.update) * .1; stats.render += ((c - b) - stats.render) * .1; stats.calls = renderer.info.render.calls; stats.tris = renderer.info.render.triangles;
    raf = requestAnimationFrame(loop);
  }
  const stats = { update: 0, render: 0, calls: 0, tris: 0, fps: 60 };
  let raf = requestAnimationFrame(loop);

  function resize() {
    const r = canvas.getBoundingClientRect(); W = Math.max(2, r.width | 0); H = Math.max(2, r.height | 0);
    renderer.setSize(W, H, false); camera.aspect = W / H; aspect = W / H; camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();
  const onMove = (e) => { const b = canvas.getBoundingClientRect(); mx = (e.clientX - b.left) / b.width - .5; my = (e.clientY - b.top) / b.height - .5; };
  window.addEventListener('pointermove', onMove);

  const api = {
    theme: null,
    stats,
    sync,
    setStation,
    prepareStation: (theme) => { keep.add(theme); return prepareStation(theme); },
    keepOnly: (themes) => { keep.clear(); themes.forEach((x) => keep.add(x)); cleanup(); },
    setMode: (m) => { mode = m; },
    setSpeaking: (s) => { speaking = s; },
    setLabels: (on) => { showLabels = on; layer.style.display = on ? '' : 'none'; },
    setQuality: (low) => {
      renderer.setPixelRatio(low ? 1 : Math.min(window.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = !low; Object.values(carObj).forEach((c) => c.spot && (c.spot.castShadow = !low));
      OLM.visible = !low; // the ink outlines are about half of all draw calls
      scene.traverse((o) => { if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); } });
      resize();
    },
    snap: () => { update(0); },
    dispose: () => { running = false; cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener('pointermove', onMove); renderer.dispose(); layer.innerHTML = ''; },
  };
  return api;
}
