(function(){
'use strict';
var D=window.IG_DAILY;if(!D||!D.values)return;
var vals=D.values,N=vals.length,SI=D.startedIndex||30;
var START=Date.UTC(2026,8,4),DAY=864e5;
var DOW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var RM=window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches;
function dt(i){return new Date(START+i*DAY);}
function short(i){var d=dt(i);return d.getUTCDate()+' '+MON[d.getUTCMonth()];}
function long(i){var d=dt(i);return DOW[d.getUTCDay()]+' '+d.getUTCDate()+' '+MON[d.getUTCMonth()];}
function fmt(n){return Math.round(n).toLocaleString('en');}
function $(id){return document.getElementById(id);}

/* ---------- sound (Web Audio, no files) ---------- */
var SFX=(function(){
  var ctx=null,on=true,unlocked=false,last=0,nb=null;
  try{on=localStorage.getItem('tori-sfx')!=='0';}catch(e){}
  function ac(){
    if(!unlocked)return null;
    if(!ctx){var A=window.AudioContext||window.webkitAudioContext;if(!A)return null;ctx=new A();}
    if(ctx.state==='suspended')ctx.resume();
    return ctx;
  }
  function noise(c){
    if(nb)return nb;var n=Math.floor(c.sampleRate*0.06),b=c.createBuffer(1,n,c.sampleRate),d=b.getChannelData(0);
    for(var i=0;i<n;i++)d[i]=Math.random()*2-1;nb=b;return b;
  }
  function env(g,t,a,peak,dec){g.gain.cancelScheduledValues(t);g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+a);g.gain.exponentialRampToValueAtTime(0.0001,t+a+dec);}
  function tone(c,type,f0,f1,t,a,peak,dec){
    var o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(f0,t);
    if(f1!==f0)o.frequency.exponentialRampToValueAtTime(f1,t+a+dec);
    env(g,t,a,peak,dec);o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+a+dec+0.05);
  }
  function click(c,t,freq,peak){
    var s=c.createBufferSource();s.buffer=noise(c);var f=c.createBiquadFilter();f.type='bandpass';f.frequency.value=freq;f.Q.value=1.3;
    var g=c.createGain();env(g,t,0.001,peak,0.02);s.connect(f);f.connect(g);g.connect(c.destination);s.start(t);s.stop(t+0.05);
  }
  return {
    unlock:function(){unlocked=true;},
    get on(){return on;},
    set:function(v){on=v;try{localStorage.setItem('tori-sfx',v?'1':'0');}catch(e){}},
    tick:function(pos){ // pos 0..1 along the slider
      if(!on)return;var c=ac();if(!c)return;var t=c.currentTime,n=performance.now();
      var vel=Math.min(1,Math.max(0.4,1-(n-last)/220));last=n;
      click(c,t,2600+pos*1800,0.07*vel);
      tone(c,'sine',620+pos*620,540+pos*520,t,0.001,0.05*vel,0.045);
    },
    detent:function(){
      if(!on)return;var c=ac();if(!c)return;var t=c.currentTime;
      tone(c,'sine',190,60,t,0.002,0.32,0.16);
      click(c,t,1800,0.12);
      tone(c,'sine',1319,1319,t+0.02,0.003,0.07,0.5);
      tone(c,'sine',1976,1976,t+0.05,0.003,0.05,0.55);
      if(navigator.vibrate){try{navigator.vibrate(12);}catch(e){}}
    },
    release:function(up){
      if(!on)return;var c=ac();if(!c)return;var t=c.currentTime,n=up?[523,659,784]:[784,659,523];
      for(var i=0;i<3;i++)tone(c,'triangle',n[i],n[i],t+i*0.06,0.004,0.06,0.28);
    },
    pop:function(i){
      if(!on)return;var c=ac();if(!c)return;var t=c.currentTime;
      tone(c,'sine',720+i*170,420+i*90,t,0.002,0.12,0.14);click(c,t,3200,0.05);
    }
  };
})();
['pointerdown','keydown','touchstart'].forEach(function(e){window.addEventListener(e,function(){SFX.unlock();},{passive:true,once:false});});

var sndBtn=$('sndBtn');
function paintSnd(){sndBtn.setAttribute('aria-pressed',SFX.on?'true':'false');sndBtn.querySelector('span').textContent=SFX.on?'Sound on':'Sound off';}
paintSnd();
sndBtn.addEventListener('click',function(){SFX.unlock();SFX.set(!SFX.on);paintSnd();if(SFX.on)SFX.pop(1);});

/* ---------- chart ---------- */
var cw=$('cw'),svg=$('chart'),tip=$('tip'),split=$('split'),win=$('win'),flag=document.querySelector('.an-flag');
var PAD=17,NS='http://www.w3.org/2000/svg',bars=[],geo={},cur=SI,lastV=SI,grown=1;
function el(n,a,p){var e=document.createElementNS(NS,n);for(var k in a)e.setAttribute(k,a[k]);(p||svg).appendChild(e);return e;}
function X(i){return PAD+i*(geo.w-2*PAD)/(N-1);}
var maxV=Math.max.apply(null,vals);
function draw(){
  var w=Math.max(300,cw.clientWidth),h=w<560?250:320,top=34,bot=36;
  geo={w:w,h:h,top:top,bot:bot};svg.setAttribute('viewBox','0 0 '+w+' '+h);svg.innerHTML='';bars=[];
  var ph=h-top-bot,ymax=maxV*1.08;
  // after-start tint
  var xs=X(SI)-((geo.w-2*PAD)/(N-1))/2;
  el('rect',{x:xs,y:top-14,width:w-xs,height:ph+14,fill:'rgba(74,71,245,0.07)'});
  // grid
  [0,0.5,1].forEach(function(f){var y=top+ph-f*ph*(maxV/ymax);
    el('line',{x1:PAD,x2:w-PAD,y1:y,y2:y,stroke:'rgba(17,17,17,0.12)','stroke-width':1});
    if(f>0){var t=el('text',{x:PAD+2,y:y-5,'font-size':11,fill:'#6b6b6b','font-family':'Inter,sans-serif'});t.textContent=fmt(maxV*f);}});
  // bars
  var step=(w-2*PAD)/(N-1),bw=Math.max(3,step*0.62);
  for(var i=0;i<N;i++){
    var bh=Math.max(vals[i]>0?2:0,vals[i]/ymax*ph);
    var r=el('rect',{x:X(i)-bw/2,y:top+ph-bh*grown,width:bw,height:bh*grown,rx:Math.min(2.5,bw/2),fill:'#111'});
    r._h=bh;r._i=i;bars.push(r);
  }
  // labels
  var idx=w<600?[0,14,30,44,57]:[0,7,14,22,30,37,44,51,57];
  idx.forEach(function(i){
    var t=el('text',{x:X(i),y:h-10,'text-anchor':i===0?'start':(i===N-1?'end':'middle'),'font-size':11.5,'font-family':'Inter,sans-serif',fill:i===SI?'#4A47F5':'#444','font-weight':i===SI?700:500});
    t.textContent=short(i);
  });
  // start marker (fixed)
  var sx=X(SI);
  el('line',{x1:sx,x2:sx,y1:top-16,y2:top+ph,stroke:'#4A47F5','stroke-width':3});
  var ft=el('text',{x:sx+10,y:top-4,'font-size':11,'font-weight':700,'font-family':'Inter,sans-serif',fill:'#F3EBDD','letter-spacing':'0.06em'});
  ft.textContent=w<600?'4 OCT · I STARTED':'4 OCT · I STARTED WORKING WITH TORI';
  var fw=Math.min((ft.getComputedTextLength?ft.getComputedTextLength():170)+20,w-sx-2);
  var fr=el('rect',{x:sx,y:top-18,width:fw,height:18,fill:'#4A47F5'});svg.insertBefore(fr,ft);
  // calendar week 1 marker (12 Oct): first week of the content calendar
  var cx=X(38);
  el('line',{x1:cx,x2:cx,y1:top+22,y2:top+ph,stroke:'#4A47F5','stroke-width':1.5,'stroke-dasharray':'3 4',opacity:0.7});
  var ct=el('text',{x:cx+5,y:top+34,'font-size':10.5,'font-weight':700,'font-family':'Inter,sans-serif',fill:'#4A47F5','letter-spacing':'0.05em'});
  ct.textContent=w<600?'12 OCT · WEEK 1':'12 OCT · CONTENT CALENDAR WEEK 1';
  // before / after captions
  var c1=el('text',{x:Math.max(PAD,sx-10),y:top+14,'text-anchor':'end','font-size':11,'font-weight':700,'font-family':'Inter,sans-serif',fill:'#555','letter-spacing':'0.1em'});c1.textContent='BEFORE';
  // split marker (draggable proxy)
  geo.sl=el('line',{y1:top-6,y2:top+ph+8,stroke:'#111','stroke-width':2,'stroke-dasharray':'5 4'});
  geo.sd=el('circle',{r:6,cy:top+ph+8,fill:'#111'});
  paint(cur);
}
function windows(v){
  var w=+win.value;
  var a0=w?Math.max(0,v-w):0,a1=v-1,b0=v,b1=w?Math.min(N-1,v+w-1):N-1;
  return {a0:a0,a1:a1,b0:b0,b1:b1};
}
function sum(a,b){var s=0;for(var i=a;i<=b;i++)s+=vals[i];return s;}
var shown={a:0,b:0,x:0},raf=null;
function tween(to){
  if(RM){shown=to;write(to);return;}
  var from={a:shown.a,b:shown.b,x:shown.x},t0=performance.now();
  cancelAnimationFrame(raf);
  (function step(n){var p=Math.min(1,(n-t0)/260),e=1-Math.pow(1-p,3);
    shown={a:from.a+(to.a-from.a)*e,b:from.b+(to.b-from.b)*e,x:from.x+(to.x-from.x)*e};write(shown);
    if(p<1)raf=requestAnimationFrame(step);})(t0);
}
function write(s){$('aV').textContent=fmt(s.a);$('bV').textContent=fmt(s.b);$('xV').textContent=(s.x>=0?s.x.toFixed(1):'0.0')+'×';}
function paint(v){
  cur=v;var W=windows(v),w=+win.value;
  bars.forEach(function(r,i){
    var inA=i>=W.a0&&i<=W.a1,inB=i>=W.b0&&i<=W.b1;
    r.setAttribute('fill',i<v?'#111':'#4A47F5');r.setAttribute('opacity',(inA||inB)?1:0.22);
  });
  var sx=X(v)-((geo.w-2*PAD)/(N-1))/2;
  if(geo.sl){geo.sl.setAttribute('x1',sx);geo.sl.setAttribute('x2',sx);geo.sd.setAttribute('cx',sx);}
  var la=W.a1-W.a0+1,lb=W.b1-W.b0+1,ta=sum(W.a0,W.a1),tb=sum(W.b0,W.b1);
  var aa=ta/la,ab=tb/lb,x=aa>0?ab/aa:0;
  $('aK').textContent=(w?w+' days before ':'Before ')+short(v);
  $('bK').textContent=(w?w+' days from ':'From ')+short(v);
  $('aS').textContent='views · '+aa.toFixed(1).replace(/\.0$/,'')+' a day over '+la+' days';
  $('bS').textContent='views · '+ab.toFixed(1).replace(/\.0$/,'')+' a day over '+lb+' days';
  $('xS').textContent=aa>0?'more views a day from '+short(v)+' than before':'No views before this date';
  tween({a:ta,b:tb,x:x});
  var st=$('state');
  if(v===SI&&!w){st.textContent='This is the day I started working with Tori Stores.';}
  else if(v===SI){st.textContent='Centred on the day I started.';}
  else{st.textContent=long(v)+' · '+(v<SI?Math.abs(SI-v)+' days before I started':(v-SI)+' days after I started');}
  split.setAttribute('aria-valuetext',long(v)+(v===SI?', the day I started':''));
  var pct=((v-1)/(N-2));split.style.setProperty('--p','calc(17px + (100% - 34px) * '+pct.toFixed(4)+')');
}
function set(v,quiet){
  v=Math.max(1,Math.min(N-1,v));
  if(v!==lastV){
    var crossed=(lastV<SI&&v>=SI)||(lastV>SI&&v<=SI);
    if(!quiet){SFX.tick(v/N);if(crossed){SFX.detent();flag.classList.remove('flash');void flag.offsetWidth;flag.classList.add('flash');}}
  }
  lastV=v;split.value=v;paint(v);
}
split.addEventListener('input',function(){set(+split.value);});
split.addEventListener('change',function(){
  var W=windows(cur),aa=sum(W.a0,W.a1)/(W.a1-W.a0+1),ab=sum(W.b0,W.b1)/(W.b1-W.b0+1);SFX.release(ab>=aa);
});
win.addEventListener('change',function(){SFX.tick(0.5);paint(cur);});
$('jump').addEventListener('click',function(){SFX.unlock();var from=cur;set(SI);if(from===SI){SFX.detent();}else{SFX.release(true);}});
// tap chart
cw.addEventListener('click',function(e){
  var r=svg.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*geo.w;
  var i=Math.round((x-PAD)/((geo.w-2*PAD)/(N-1)));if(i<1||i>N-1)return;SFX.unlock();set(i);
});
// tooltip
cw.addEventListener('pointermove',function(e){
  var r=svg.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*geo.w;
  var i=Math.round((x-PAD)/((geo.w-2*PAD)/(N-1)));i=Math.max(0,Math.min(N-1,i));
  var px=X(i)/geo.w*r.width,bh=bars[i]?bars[i]._h:0;
  tip.innerHTML='<b>'+long(i)+'</b>about '+fmt(vals[i])+' views'+(i>=SI?'':' ');
  tip.style.left=Math.max(60,Math.min(r.width-60,px))+'px';tip.style.top=Math.max(34,(geo.top+(geo.h-geo.top-geo.bot)-bh*grown)-8)+'px';tip.style.opacity=1;
});
cw.addEventListener('pointerleave',function(){tip.style.opacity=0;});
window.addEventListener('resize',function(){draw();});
draw();

// intro: bars grow, then thumb sweeps to 4 Oct
var played=false;
function intro(){
  if(played)return;played=true;
  if(RM)return;
  grown=0;lastV=1;set(1,true);draw();
  var t0=performance.now();
  (function step(n){var p=Math.min(1,(n-t0)/1500),e=1-Math.pow(1-p,3);
    grown=Math.min(1,p*1.6);draw();
    set(Math.round(1+(SI-1)*e),true);
    if(p<1)requestAnimationFrame(step);else{grown=1;draw();set(SI,true);}
  })(t0);
}
if('IntersectionObserver' in window){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){intro();io.disconnect();}});},{threshold:0.35});io.observe(cw);}

/* ---------- tabs + facebook ---------- */
var tabIG=$('tabIG'),tabFB=$('tabFB'),pIG=$('panelIG'),pFB=$('panelFB');
function tab(which){
  var ig=which==='ig';
  tabIG.setAttribute('aria-selected',ig);tabFB.setAttribute('aria-selected',!ig);tabIG.tabIndex=ig?0:-1;tabFB.tabIndex=ig?-1:0;
  pIG.hidden=!ig;pFB.hidden=ig;
  if(ig){draw();}else{playFB();}
}
tabIG.addEventListener('click',function(){SFX.unlock();SFX.tick(0.3);tab('ig');});
tabFB.addEventListener('click',function(){SFX.unlock();SFX.tick(0.7);tab('fb');});
[tabIG,tabFB].forEach(function(b){b.addEventListener('keydown',function(e){if(e.key==='ArrowRight'||e.key==='ArrowLeft'){var t=b===tabIG?'fb':'ig';tab(t);(t==='ig'?tabIG:tabFB).focus();}});});
var FB=[
 {n:'Views',p:1211,l:2200,pl:'about 1.2K',ll:'2.2K',d:'+81.6%'},
 {n:'Content interactions',p:14,l:39,pl:'14',ll:'39',d:'+179%'},
 {n:'Messaging contacts',p:1,l:2,pl:'1',ll:'2',d:'+100%'},
 {n:'Follows',p:3,l:4,pl:'3',ll:'4',d:'+33.3%'}
];
var fbul=$('fbrows');
fbul.innerHTML=FB.map(function(r,i){return '<li><span class="nm">'+r.n+'</span><span class="chip">'+r.d+'</span><div class="bars">'
 +'<div class="bar p"><span>Previous 28 days</span><div class="track"><div class="fill" data-w="'+(r.p/Math.max(r.p,r.l)*100)+'"></div></div><b>'+r.pl+'</b></div>'
 +'<div class="bar l"><span>Last 28 days</span><div class="track"><div class="fill" data-w="'+(r.l/Math.max(r.p,r.l)*100)+'"></div></div><b>'+r.ll+'</b></div></div></li>';}).join('');
function playFB(){
  var fills=fbul.querySelectorAll('.fill');
  fills.forEach(function(f){f.style.transition='none';f.style.width='0';});
  void fbul.offsetWidth;
  FB.forEach(function(r,i){setTimeout(function(){
    var a=fills[i*2],b=fills[i*2+1];a.style.transition='';b.style.transition='';
    a.style.width=a.dataset.w+'%';setTimeout(function(){b.style.width=b.dataset.w+'%';SFX.pop(i);},RM?0:260);
  },RM?0:i*420);});
}
$('fbReplay').addEventListener('click',function(){SFX.unlock();playFB();});
})();
