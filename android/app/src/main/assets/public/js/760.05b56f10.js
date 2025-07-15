"use strict";(self["webpackChunkspending_management"]=self["webpackChunkspending_management"]||[]).push([[760],{8379:function(e,t,n){n.r(t),n.d(t,{createSwipeBackGesture:function(){return s}});var r=n(9185),a=n(3183),i=n(4692);
/*!
 * (C) Ionic http://ionicframework.com - MIT License
 */
const s=(e,t,n,s,o)=>{const c=e.ownerDocument.defaultView,u=(0,a.i)(e),d=e=>{const t=50,{startX:n}=e;return u?n>=c.innerWidth-t:n<=t},h=e=>u?-e.deltaX:e.deltaX,l=e=>u?-e.velocityX:e.velocityX,g=e=>d(e)&&t(),m=e=>{const t=h(e),n=t/c.innerWidth;s(n)},p=e=>{const t=h(e),n=c.innerWidth,a=t/n,i=l(e),s=n/2,u=i>=0&&(i>.2||t>s),d=u?1-a:a,g=d*n;let m=0;if(g>5){const e=g/Math.abs(i);m=Math.min(e,540)}o(u,a<=0?.01:(0,r.h)(0,a,.9999),m)};return(0,i.G)({el:e,gestureName:"goback-swipe",gesturePriority:40,threshold:10,canStart:g,onStart:n,onMove:m,onEnd:p})}}}]);
//# sourceMappingURL=760.05b56f10.js.map