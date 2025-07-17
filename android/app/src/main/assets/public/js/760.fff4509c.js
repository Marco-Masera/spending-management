"use strict";(self["webpackChunkspending_management"]=self["webpackChunkspending_management"]||[]).push([[760],{8379:function(e,t,n){n.r(t),n.d(t,{createSwipeBackGesture:function(){return s}});var r=n(9185),i=n(3183),a=n(2635);
/*!
 * (C) Ionic http://ionicframework.com - MIT License
 */
const s=(e,t,n,s,o)=>{const c=e.ownerDocument.defaultView;let u=(0,i.i)(e);const d=e=>{const t=50,{startX:n}=e;return u?n>=c.innerWidth-t:n<=t},l=e=>u?-e.deltaX:e.deltaX,h=e=>u?-e.velocityX:e.velocityX,f=n=>(u=(0,i.i)(e),d(n)&&t()),g=e=>{const t=l(e),n=t/c.innerWidth;s(n)},m=e=>{const t=l(e),n=c.innerWidth,i=t/n,a=h(e),s=n/2,u=a>=0&&(a>.2||t>s),d=u?1-i:i,f=d*n;let g=0;if(f>5){const e=f/Math.abs(a);g=Math.min(e,540)}o(u,i<=0?.01:(0,r.f)(0,i,.9999),g)};return(0,a.G)({el:e,gestureName:"goback-swipe",gesturePriority:101,threshold:10,canStart:f,onStart:n,onMove:g,onEnd:m})}}}]);
//# sourceMappingURL=760.fff4509c.js.map