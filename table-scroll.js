(function(){
  'use strict';

  function start(){
    var wrap=document.getElementById('main-table-wrap');
    var scroll=wrap&&wrap.querySelector('.table-scroll');
    var table=document.getElementById('main-table');
    var rail=document.getElementById('main-table-pan');
    var range=document.getElementById('main-table-pan-range');
    var previous=document.getElementById('main-table-pan-prev');
    var next=document.getElementById('main-table-pan-next');
    var status=document.getElementById('main-table-pan-status');
    if(!wrap||!scroll||!table||!rail||!range||!previous||!next||!status)return;

    var frame=0;
    var hideTimer=0;
    function hideWhenIdle(){
      clearTimeout(hideTimer);
      hideTimer=setTimeout(function(){
        if(rail.matches(':hover')||rail.contains(document.activeElement)){hideWhenIdle();return;}
        rail.classList.remove('is-active');
      },1400);
    }
    function showTemporarily(){
      if(maximum()<2)return;
      rail.classList.add('is-active');
      hideWhenIdle();
    }
    function maximum(){return Math.max(0,scroll.scrollWidth-scroll.clientWidth);}
    function sync(){
      frame=0;
      var max=maximum();
      var left=Math.min(max,Math.max(0,scroll.scrollLeft));
      var wasNeeded=rail.classList.contains('is-needed');
      range.max=String(Math.max(1,Math.round(max)));
      range.value=String(Math.round(left));
      range.disabled=max<2;
      previous.disabled=left<1||max<2;
      next.disabled=left>=max-1||max<2;
      rail.classList.toggle('is-needed',max>=2);
      if(max<2){clearTimeout(hideTimer);rail.classList.remove('is-active');}
      else if(!wasNeeded)showTemporarily();
      rail.style.setProperty('--table-pan-progress',max?((left/max)*100)+'%':'0%');
      status.textContent=max<2?'All columns visible':left<2?'Start':left>=max-2?'Right edge':Math.round((left/max)*100)+'% across';
    }
    function schedule(){if(frame)return;frame=requestAnimationFrame(sync);}
    function move(amount){
      var max=maximum();
      scroll.scrollTo({left:Math.min(max,Math.max(0,scroll.scrollLeft+amount)),behavior:'smooth'});
    }

    range.addEventListener('input',function(){showTemporarily();scroll.scrollLeft=Number(range.value)||0;sync();});
    previous.addEventListener('click',function(){showTemporarily();move(-Math.max(260,scroll.clientWidth*.72));});
    next.addEventListener('click',function(){showTemporarily();move(Math.max(260,scroll.clientWidth*.72));});
    rail.addEventListener('wheel',function(event){
      if(maximum()<2)return;
      var amount=Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY;
      if(!amount)return;
      event.preventDefault();showTemporarily();scroll.scrollLeft+=amount;sync();
    },{passive:false});
    scroll.addEventListener('scroll',function(){schedule();showTemporarily();},{passive:true});
    wrap.addEventListener('pointermove',showTemporarily,{passive:true});
    wrap.addEventListener('pointerdown',showTemporarily,{passive:true});
    wrap.addEventListener('touchstart',showTemporarily,{passive:true});
    rail.addEventListener('mouseenter',showTemporarily);
    rail.addEventListener('mouseleave',hideWhenIdle);
    rail.addEventListener('focusin',function(){clearTimeout(hideTimer);rail.classList.add('is-active');});
    rail.addEventListener('focusout',hideWhenIdle);

    if(window.ResizeObserver)new ResizeObserver(schedule).observe(scroll);
    new MutationObserver(schedule).observe(table,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});
    window.addEventListener('resize',schedule,{passive:true});
    document.addEventListener('visibilitychange',schedule);
    sync();setTimeout(sync,250);setTimeout(sync,1000);
  }

  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start,{once:true}):start();
})();
