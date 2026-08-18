(function(){
  'use strict';

  var active = null;
  var menu = null;
  var optionsBox = null;
  var searchWrap = null;
  var searchInput = null;
  var uid = 0;
  var repositionFrame = 0;
  var nativeValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value');
  var nativeIndex = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'selectedIndex');

  function chevron(){
    return '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 6 8 10.5 12.5 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function searchIcon(){
    return '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.25" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m10.25 10.25 3 3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  }

  function ensureMenu(){
    if(menu) return;
    menu = document.createElement('div');
    menu.id = 'premium-select-menu';
    menu.className = 'premium-select-menu';
    menu.setAttribute('role','presentation');

    searchWrap = document.createElement('div');
    searchWrap.className = 'premium-select-search-wrap';
    var icon = document.createElement('span');
    icon.className = 'premium-select-search-icon';
    icon.innerHTML = searchIcon();
    searchInput = document.createElement('input');
    searchInput.className = 'premium-select-search';
    searchInput.type = 'search';
    searchInput.placeholder = 'Search options...';
    searchInput.autocomplete = 'off';
    searchInput.setAttribute('aria-label','Search dropdown options');
    searchWrap.appendChild(icon);
    searchWrap.appendChild(searchInput);

    optionsBox = document.createElement('div');
    optionsBox.className = 'premium-select-options';
    optionsBox.id = 'premium-select-options';
    optionsBox.setAttribute('role','listbox');
    menu.appendChild(searchWrap);
    menu.appendChild(optionsBox);
    document.body.appendChild(menu);

    searchInput.addEventListener('input',function(){ renderOptions(searchInput.value); });
    searchInput.addEventListener('keydown',onMenuKeydown);
    optionsBox.addEventListener('keydown',onMenuKeydown);
  }

  function labelFor(select){
    if(select.getAttribute('aria-label')) return select.getAttribute('aria-label');
    if(select.id){
      var label = document.querySelector('label[for="'+CSS.escape(select.id)+'"]');
      if(label) return label.textContent.trim();
    }
    var group = select.closest('.fgrp');
    var groupLabel = group && group.querySelector('label');
    return groupLabel ? groupLabel.textContent.trim() : 'Choose an option';
  }

  function installValueHooks(select){
    if(select.dataset.premiumHooks) return;
    select.dataset.premiumHooks = 'true';
    try{
      Object.defineProperty(select,'value',{
        configurable:true,
        get:function(){ return nativeValue.get.call(this); },
        set:function(value){ nativeValue.set.call(this,value); queueSync(this); }
      });
      Object.defineProperty(select,'selectedIndex',{
        configurable:true,
        get:function(){ return nativeIndex.get.call(this); },
        set:function(value){ nativeIndex.set.call(this,value); queueSync(this); }
      });
    }catch(_){ /* Older engines still sync through change + mutation events. */ }
  }

  function enhance(select){
    if(!select || select.dataset.premiumSelect || select.multiple || select.size > 1) return;
    select.dataset.premiumSelect = 'true';
    installValueHooks(select);

    var wrapper = document.createElement('span');
    wrapper.className = 'premium-select'+(select.classList.contains('fc')?' is-fc':'')+(select.classList.contains('fsel')?' is-fsel':'');
    select.parentNode.insertBefore(wrapper,select);
    wrapper.appendChild(select);

    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'premium-select-trigger';
    button.id = 'premium-select-trigger-'+(++uid);
    button.setAttribute('aria-haspopup','listbox');
    button.setAttribute('aria-expanded','false');
    button.setAttribute('aria-controls','premium-select-options');
    button.setAttribute('aria-label',labelFor(select));
    button.innerHTML = '<span class="premium-select-value"></span><span class="premium-select-chevron">'+chevron()+'</span>';
    wrapper.appendChild(button);

    if(select.tabIndex >= 0) button.tabIndex = select.tabIndex;
    select.tabIndex = -1;
    select.setAttribute('aria-hidden','true');
    button.addEventListener('click',function(e){
      e.preventDefault();
      e.stopPropagation();
      if(select.disabled) return;
      active === select ? closeMenu(true) : openMenu(select);
    });
    button.addEventListener('keydown',function(e){ onTriggerKeydown(e,select); });
    sync(select);
  }

  function queueSync(select){
    Promise.resolve().then(function(){ if(select && select.isConnected) sync(select); });
  }

  function sync(select){
    var wrapper = select && select.closest('.premium-select');
    if(!wrapper) return;
    var button = wrapper.querySelector('.premium-select-trigger');
    var value = button.querySelector('.premium-select-value');
    var option = select.options[select.selectedIndex];
    var text = option ? option.textContent.trim() : 'Select an option';
    value.textContent = text;
    button.title = text;
    button.disabled = !!select.disabled;
    wrapper.classList.toggle('is-disabled',!!select.disabled);
    wrapper.classList.toggle('is-placeholder',!option || option.value === '');
    wrapper.classList.toggle('is-invalid',select.required && !select.value);
    wrapper.style.display = select.style.display === 'none' ? 'none' : '';
    if(active === select){
      renderOptions(searchInput ? searchInput.value : '');
      positionMenu();
    }
  }

  function optionRows(select){
    var rows = [];
    Array.prototype.forEach.call(select.children,function(child){
      if(child.tagName === 'OPTGROUP'){
        rows.push({kind:'group',label:child.label});
        Array.prototype.forEach.call(child.children,function(option){
          rows.push({kind:'option',option:option,index:Array.prototype.indexOf.call(select.options,option)});
        });
      }else if(child.tagName === 'OPTION'){
        rows.push({kind:'option',option:child,index:Array.prototype.indexOf.call(select.options,child)});
      }
    });
    return rows;
  }

  function renderOptions(query){
    if(!active || !optionsBox) return;
    var normalized = String(query || '').trim().toLocaleLowerCase();
    var rows = optionRows(active);
    var matches = {};
    rows.forEach(function(row){
      if(row.kind === 'option') matches[row.index] = !normalized || row.option.textContent.toLocaleLowerCase().indexOf(normalized) !== -1;
    });
    optionsBox.innerHTML = '';
    var groupHasMatch = false;
    var pendingGroup = null;
    var count = 0;

    rows.forEach(function(row){
      if(row.kind === 'group'){
        pendingGroup = row.label;
        groupHasMatch = false;
        return;
      }
      if(!matches[row.index]) return;
      if(pendingGroup && !groupHasMatch){
        var heading = document.createElement('div');
        heading.className = 'premium-select-group';
        heading.textContent = pendingGroup;
        optionsBox.appendChild(heading);
        groupHasMatch = true;
      }
      var option = row.option;
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'premium-select-option'+(row.index === active.selectedIndex?' is-selected':'');
      item.textContent = option.textContent.trim();
      item.dataset.index = row.index;
      item.disabled = option.disabled || (option.parentElement.tagName === 'OPTGROUP' && option.parentElement.disabled);
      item.setAttribute('role','option');
      item.setAttribute('aria-selected',row.index === active.selectedIndex ? 'true' : 'false');
      item.tabIndex = -1;
      item.addEventListener('click',function(){ choose(row.index); });
      optionsBox.appendChild(item);
      count++;
    });

    if(!count){
      var empty = document.createElement('div');
      empty.className = 'premium-select-empty';
      empty.textContent = 'No matching options';
      optionsBox.appendChild(empty);
    }
    positionMenu();
  }

  function openMenu(select,typed){
    ensureMenu();
    closeMenu(false);
    active = select;
    sync(select);
    var wrapper = select.closest('.premium-select');
    var trigger = wrapper.querySelector('.premium-select-trigger');
    wrapper.classList.add('is-open');
    trigger.setAttribute('aria-expanded','true');
    optionsBox.setAttribute('aria-labelledby',trigger.id);
    searchInput.value = typed || '';
    searchWrap.style.display = select.options.length >= 8 ? '' : 'none';
    menu.classList.add('is-visible');
    renderOptions(searchInput.value);
    positionMenu();

    requestAnimationFrame(function(){
      if(!active) return;
      if(searchWrap.style.display !== 'none'){
        searchInput.focus();
        if(typed) searchInput.setSelectionRange(searchInput.value.length,searchInput.value.length);
      }else{
        focusSelectedOrFirst();
      }
    });
  }

  function closeMenu(restoreFocus){
    if(!active){ if(menu) menu.classList.remove('is-visible','opens-up'); return; }
    var closing = active;
    var wrapper = closing.closest('.premium-select');
    if(wrapper){
      wrapper.classList.remove('is-open');
      var button = wrapper.querySelector('.premium-select-trigger');
      if(button){
        button.setAttribute('aria-expanded','false');
        if(restoreFocus) button.focus();
      }
    }
    active = null;
    if(menu) menu.classList.remove('is-visible','opens-up');
  }

  function choose(index){
    if(!active) return;
    var select = active;
    var option = select.options[index];
    if(!option || option.disabled) return;
    var changed = select.selectedIndex !== index;
    nativeIndex.set.call(select,index);
    sync(select);
    closeMenu(true);
    if(changed){
      select.dispatchEvent(new Event('input',{bubbles:true}));
      select.dispatchEvent(new Event('change',{bubbles:true}));
    }
  }

  function visibleItems(){
    return optionsBox ? Array.prototype.slice.call(optionsBox.querySelectorAll('.premium-select-option:not(:disabled)')) : [];
  }

  function focusSelectedOrFirst(){
    var selected = optionsBox && optionsBox.querySelector('.premium-select-option.is-selected:not(:disabled)');
    var target = selected || visibleItems()[0];
    if(target){ target.tabIndex = 0; target.focus(); target.scrollIntoView({block:'nearest'}); }
  }

  function moveFocus(delta){
    var items = visibleItems();
    if(!items.length) return;
    var current = document.activeElement;
    var index = items.indexOf(current);
    index = index < 0 ? (delta > 0 ? -1 : 0) : index;
    index = Math.max(0,Math.min(items.length - 1,index + delta));
    items.forEach(function(item){ item.tabIndex = -1; });
    items[index].tabIndex = 0;
    items[index].focus();
    items[index].scrollIntoView({block:'nearest'});
  }

  function onTriggerKeydown(e,select){
    if(select.disabled) return;
    if(e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' '){
      e.preventDefault();
      openMenu(select);
      if(e.key === 'ArrowUp') requestAnimationFrame(function(){ moveFocus(-1); });
    }else if(e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey){
      e.preventDefault();
      openMenu(select,e.key);
    }
  }

  function onMenuKeydown(e){
    if(!active) return;
    if(e.key === 'Escape' || (e.key === 'Tab' && !e.shiftKey)){
      e.preventDefault();
      closeMenu(true);
    }else if(e.key === 'ArrowDown'){
      e.preventDefault(); moveFocus(1);
    }else if(e.key === 'ArrowUp'){
      e.preventDefault(); moveFocus(-1);
    }else if(e.key === 'Home'){
      e.preventDefault(); var first = visibleItems()[0]; if(first) first.focus();
    }else if(e.key === 'End'){
      e.preventDefault(); var items = visibleItems(); if(items.length) items[items.length-1].focus();
    }else if((e.key === 'Enter' || e.key === ' ') && document.activeElement.classList.contains('premium-select-option')){
      e.preventDefault(); choose(Number(document.activeElement.dataset.index));
    }
  }

  function positionMenu(){
    if(!active || !menu || !menu.classList.contains('is-visible')) return;
    var trigger = active.closest('.premium-select').querySelector('.premium-select-trigger');
    var rect = trigger.getBoundingClientRect();
    var pad = 10;
    var gap = 7;
    var viewW = document.documentElement.clientWidth;
    var viewH = document.documentElement.clientHeight;
    var width = Math.min(Math.max(rect.width,220),Math.min(380,viewW-pad*2));
    var left = Math.min(Math.max(pad,rect.left),viewW-width-pad);
    var below = viewH-rect.bottom-gap-pad;
    var above = rect.top-gap-pad;
    var opensUp = below < 190 && above > below;
    var available = Math.max(130,opensUp ? above : below);
    var maxHeight = Math.min(340,available);

    menu.style.width = width+'px';
    menu.style.left = left+'px';
    menu.style.maxHeight = maxHeight+'px';
    optionsBox.style.maxHeight = Math.max(80,maxHeight-(searchWrap.style.display === 'none'?14:57))+'px';
    menu.classList.toggle('opens-up',opensUp);
    menu.style.top = opensUp ? Math.max(pad,rect.top-gap-maxHeight)+'px' : Math.min(viewH-pad-maxHeight,rect.bottom+gap)+'px';
  }

  function schedulePosition(){
    if(repositionFrame) return;
    repositionFrame = requestAnimationFrame(function(){ repositionFrame = 0; positionMenu(); });
  }

  function scan(root){
    if(!root) return;
    if(root.matches && root.matches('select')) enhance(root);
    if(root.querySelectorAll) root.querySelectorAll('select').forEach(enhance);
  }

  document.addEventListener('change',function(e){ if(e.target.matches && e.target.matches('select')) sync(e.target); },true);
  document.addEventListener('input',function(e){ if(e.target.matches && e.target.matches('select')) sync(e.target); },true);
  document.addEventListener('reset',function(e){ setTimeout(function(){ scan(e.target); },0); },true);
  document.addEventListener('pointerdown',function(e){
    if(active && !e.target.closest('.premium-select-menu') && !e.target.closest('.premium-select')) closeMenu(false);
  },true);
  document.addEventListener('focusin',function(e){
    if(active && !e.target.closest('.premium-select-menu') && !e.target.closest('.premium-select')) closeMenu(false);
  });
  window.addEventListener('resize',schedulePosition,{passive:true});
  document.addEventListener('scroll',schedulePosition,true);

  var observer = new MutationObserver(function(mutations){
    mutations.forEach(function(mutation){
      if(mutation.type === 'childList'){
        mutation.addedNodes.forEach(function(node){ if(node.nodeType === 1) scan(node); });
        var owner = mutation.target.closest && mutation.target.closest('select');
        if(owner) queueSync(owner);
      }else{
        var target = mutation.target;
        if(target.tagName === 'SELECT') queueSync(target);
        else if(target.tagName === 'OPTION' || target.tagName === 'OPTGROUP') queueSync(target.closest('select'));
      }
    });
  });

  function start(){
    scan(document);
    observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled','selected','style','class','label']});
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded',start,{once:true}) : start();
})();
