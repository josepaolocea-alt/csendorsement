(function(){
  'use strict';

  var active = null;
  var menu = null;
  var calendarBody = null;
  var titleButton = null;
  var prevButton = null;
  var nextButton = null;
  var footer = null;
  var clearButton = null;
  var todayButton = null;
  var applyButton = null;
  var timeRow = null;
  var hourInput = null;
  var minuteInput = null;
  var viewDate = null;
  var draftDate = '';
  var viewMode = 'days';
  var uid = 0;
  var positionFrame = 0;
  var activeTime = null;
  var timeMenuPopup = null;
  var timeHourInput = null;
  var timeMinuteInput = null;
  var timeSecondInput = null;
  var timeApplyButton = null;
  var timeClearButton = null;
  var timePositionFrame = 0;
  var nativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');
  var monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var shortMonths = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  function calendarIcon(){
    return '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="2.75" y="4.25" width="14.5" height="13" rx="2.25" stroke="currentColor" stroke-width="1.5"/><path d="M6 2.75v3M14 2.75v3M2.75 8h14.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  }

  function clockIcon(){
    return '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="7.25" stroke="currentColor" stroke-width="1.5"/><path d="M10 5.75v4.6l3.05 1.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function chevronIcon(){
    return '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function arrowIcon(direction){
    var path = direction < 0 ? 'M11 4 6 9l5 5' : 'M7 4l5 5-5 5';
    return '<svg viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="'+path+'" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function pad(value){ return String(value).padStart(2,'0'); }

  function dateString(date){
    return date.getFullYear()+'-'+pad(date.getMonth()+1)+'-'+pad(date.getDate());
  }

  function parseDate(value){
    var match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(!match) return null;
    var date = new Date(Number(match[1]),Number(match[2])-1,Number(match[3]));
    return isNaN(date.getTime()) ? null : date;
  }

  function datePart(input){ return String(input && input.value || '').slice(0,10); }

  function timeParts(value){
    var match = String(value || '').match(/T(\d{2}):(\d{2})/);
    if(match) return {hour:Number(match[1]),minute:Number(match[2])};
    var now = new Date();
    return {hour:now.getHours(),minute:Math.floor(now.getMinutes()/5)*5};
  }

  function clockParts(value){
    var match = String(value || '').match(/^(\d{2}):(\d{2})(?::(\d{2}))?/);
    if(match)return {hour:Number(match[1]),minute:Number(match[2]),second:Number(match[3] || 0)};
    var now = new Date();
    return {hour:now.getHours(),minute:Math.floor(now.getMinutes()/5)*5,second:0};
  }

  function clamp(number,min,max){ return Math.min(max,Math.max(min,number)); }

  function sameDate(a,b){
    return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function labelFor(input){
    if(input.getAttribute('aria-label')) return input.getAttribute('aria-label');
    if(input.id){
      var direct = document.querySelector('label[for="'+CSS.escape(input.id)+'"]');
      if(direct) return direct.textContent.trim();
    }
    var group = input.closest('.fgrp,.cal-field');
    var label = group && group.querySelector('label');
    return label ? label.textContent.trim() : (input.type === 'datetime-local' ? 'Choose date and time' : 'Choose date');
  }

  function formatDisplay(input){
    var date = parseDate(input.value);
    if(!date) return input.type === 'datetime-local' ? 'Select date and time' : 'Select date';
    var text = new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'}).format(date);
    if(input.type === 'datetime-local'){
      var parts = timeParts(input.value);
      var stamp = new Date(2000,0,1,parts.hour,parts.minute);
      text += ' · '+new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}).format(stamp);
    }
    return text;
  }

  function installValueHook(input){
    if(input.dataset.premiumDateHook) return;
    input.dataset.premiumDateHook = 'true';
    try{
      Object.defineProperty(input,'value',{
        configurable:true,
        get:function(){ return nativeValue.get.call(this); },
        set:function(value){ nativeValue.set.call(this,value); queueSync(this); }
      });
    }catch(_){ /* Native change/input events and mutation sync remain available. */ }
  }

  function enhance(input){
    if(!input || input.dataset.premiumDate || (input.type !== 'date' && input.type !== 'datetime-local')) return;
    input.dataset.premiumDate = 'true';
    installValueHook(input);

    var wrapper = document.createElement('span');
    wrapper.className = 'premium-date'+(input.classList.contains('fc')?' is-fc':'');
    input.parentNode.insertBefore(wrapper,input);
    wrapper.appendChild(input);

    var button = document.createElement('button');
    button.type = 'button';
    button.id = 'premium-date-trigger-'+(++uid);
    button.className = 'premium-date-trigger';
    button.setAttribute('aria-haspopup','dialog');
    button.setAttribute('aria-expanded','false');
    button.setAttribute('aria-label',labelFor(input));
    button.innerHTML = '<span class="premium-date-icon">'+calendarIcon()+'</span><span class="premium-date-value"></span><span class="premium-date-chevron">'+chevronIcon()+'</span>';
    wrapper.appendChild(button);

    if(input.tabIndex >= 0) button.tabIndex = input.tabIndex;
    input.tabIndex = -1;
    input.setAttribute('aria-hidden','true');
    button.addEventListener('click',function(event){
      event.preventDefault();event.stopPropagation();
      if(input.disabled || input.readOnly) return;
      active === input ? close(false) : open(input);
    });
    button.addEventListener('keydown',function(event){
      if((event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') && !input.disabled && !input.readOnly){
        event.preventDefault();open(input);
      }
    });
    input.addEventListener('focus',function(){ if(button && !input.disabled) button.focus(); });
    sync(input);
  }

  function queueSync(input){ Promise.resolve().then(function(){ if(input && input.isConnected){sync(input);syncTime(input);} }); }

  function sync(input){
    var wrapper = input && input.closest('.premium-date');
    if(!wrapper) return;
    var button = wrapper.querySelector('.premium-date-trigger');
    var value = button.querySelector('.premium-date-value');
    var hasValue = !!input.value;
    value.textContent = formatDisplay(input);
    button.title = hasValue ? value.textContent : labelFor(input);
    button.disabled = !!input.disabled;
    wrapper.classList.toggle('is-empty',!hasValue);
    wrapper.classList.toggle('is-disabled',input.disabled || input.readOnly);
    wrapper.classList.toggle('is-invalid',input.required && !hasValue);
    wrapper.style.display = input.style.display === 'none' ? 'none' : '';
    if(active === input) render();
  }

  function formatTimeDisplay(input){
    if(!input.value)return 'Select time';
    var parts = clockParts(input.value);
    var stamp = new Date(2000,0,1,parts.hour,parts.minute,parts.second);
    return new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit',second:input.step === '1'?'2-digit':undefined}).format(stamp);
  }

  function enhanceTime(input){
    if(!input || input.dataset.premiumTime || input.type !== 'time' || !input.closest('.reminder-fields'))return;
    input.dataset.premiumTime = 'true';
    installValueHook(input);

    var wrapper = document.createElement('span');
    wrapper.className = 'premium-time'+(input.classList.contains('fc')?' is-fc':'');
    input.parentNode.insertBefore(wrapper,input);
    wrapper.appendChild(input);

    var button = document.createElement('button');
    button.type = 'button';
    button.id = 'premium-time-trigger-'+(++uid);
    button.className = 'premium-time-trigger';
    button.setAttribute('aria-haspopup','dialog');
    button.setAttribute('aria-expanded','false');
    button.setAttribute('aria-label',labelFor(input));
    button.innerHTML = '<span class="premium-time-icon">'+clockIcon()+'</span><span class="premium-time-value"></span><span class="premium-time-chevron">'+chevronIcon()+'</span>';
    wrapper.appendChild(button);

    if(input.tabIndex >= 0)button.tabIndex = input.tabIndex;
    input.tabIndex = -1;
    input.setAttribute('aria-hidden','true');
    button.addEventListener('click',function(event){
      event.preventDefault();event.stopPropagation();
      if(input.disabled || input.readOnly)return;
      activeTime === input ? closeTime(false) : openTime(input);
    });
    button.addEventListener('keydown',function(event){
      if((event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') && !input.disabled && !input.readOnly){
        event.preventDefault();openTime(input);
      }
    });
    input.addEventListener('focus',function(){if(button && !input.disabled)button.focus();});
    syncTime(input);
  }

  function syncTime(input){
    var wrapper = input && input.closest('.premium-time');
    if(!wrapper)return;
    var button = wrapper.querySelector('.premium-time-trigger');
    var value = wrapper.querySelector('.premium-time-value');
    var hasValue = !!input.value;
    value.textContent = formatTimeDisplay(input);
    button.title = hasValue ? value.textContent : labelFor(input);
    button.disabled = !!input.disabled;
    wrapper.classList.toggle('is-empty',!hasValue);
    wrapper.classList.toggle('is-disabled',input.disabled || input.readOnly);
    wrapper.classList.toggle('is-invalid',input.required && !hasValue);
    wrapper.style.display = input.style.display === 'none' ? 'none' : '';
    if(activeTime === input)loadTimeDraft(input.value);
  }

  function timeUnit(label,max){
    var unit = document.createElement('div');
    unit.className = 'premium-time-unit';
    var caption = document.createElement('span');caption.className='premium-time-unit-label';caption.textContent=label;
    var up = document.createElement('button');up.type='button';up.className='premium-time-adjust';up.setAttribute('aria-label','Increase '+label.toLowerCase());up.textContent='+';
    var field = document.createElement('input');field.type='text';field.inputMode='numeric';field.maxLength=2;field.className='premium-time-digit';field.setAttribute('aria-label',label);field.dataset.max=String(max);
    var down = document.createElement('button');down.type='button';down.className='premium-time-adjust';down.setAttribute('aria-label','Decrease '+label.toLowerCase());down.textContent='−';
    up.addEventListener('click',function(){adjustTimeField(field,1);});
    down.addEventListener('click',function(){adjustTimeField(field,-1);});
    field.addEventListener('input',function(){this.value=this.value.replace(/\D/g,'').slice(0,2);});
    field.addEventListener('blur',function(){normalizeClockField(this);});
    field.addEventListener('keydown',function(event){if(event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();adjustTimeField(this,event.key==='ArrowUp'?1:-1);}});
    unit.appendChild(caption);unit.appendChild(up);unit.appendChild(field);unit.appendChild(down);
    return {element:unit,input:field};
  }

  function normalizeClockField(field){field.value=pad(clamp(Number(field.value || 0),0,Number(field.dataset.max)));}
  function adjustTimeField(field,delta){
    var max=Number(field.dataset.max),value=Number(field.value || 0)+delta;
    if(value>max)value=0;if(value<0)value=max;
    field.value=pad(value);field.focus();field.select();
  }

  function ensureTimeMenu(){
    if(timeMenuPopup)return;
    timeMenuPopup=document.createElement('div');
    timeMenuPopup.className='premium-time-menu';
    timeMenuPopup.setAttribute('role','dialog');
    timeMenuPopup.setAttribute('aria-modal','false');

    var head=document.createElement('div');head.className='premium-time-head';
    head.innerHTML='<span class="premium-time-head-icon">'+clockIcon()+'</span><span><strong>Reminder time</strong><small>Set the exact alert time</small></span>';
    var editor=document.createElement('div');editor.className='premium-time-editor';
    var hour=timeUnit('Hour',23),minute=timeUnit('Minute',59),second=timeUnit('Second',59);
    timeHourInput=hour.input;timeMinuteInput=minute.input;timeSecondInput=second.input;
    editor.appendChild(hour.element);editor.appendChild(timeSeparator());editor.appendChild(minute.element);editor.appendChild(timeSeparator());editor.appendChild(second.element);

    var quick=document.createElement('div');quick.className='premium-time-quick';
    var nowButton=document.createElement('button');nowButton.type='button';nowButton.className='premium-time-chip';nowButton.textContent='Use current time';
    nowButton.addEventListener('click',function(){var now=new Date();timeHourInput.value=pad(now.getHours());timeMinuteInput.value=pad(now.getMinutes());timeSecondInput.value=pad(now.getSeconds());});
    quick.appendChild(nowButton);

    var actions=document.createElement('div');actions.className='premium-time-actions';
    timeClearButton=document.createElement('button');timeClearButton.type='button';timeClearButton.className='premium-calendar-action is-clear';timeClearButton.textContent='Clear';
    timeApplyButton=document.createElement('button');timeApplyButton.type='button';timeApplyButton.className='premium-calendar-action is-primary';timeApplyButton.textContent='Apply time';
    actions.appendChild(timeClearButton);actions.appendChild(timeApplyButton);
    timeClearButton.addEventListener('click',function(){commitTime('');});
    timeApplyButton.addEventListener('click',applyTimeDraft);
    timeMenuPopup.addEventListener('keydown',function(event){if(event.key==='Escape'){event.preventDefault();closeTime(true);}else if(event.key==='Enter'&&event.target.classList.contains('premium-time-digit')){event.preventDefault();applyTimeDraft();}});
    timeMenuPopup.appendChild(head);timeMenuPopup.appendChild(editor);timeMenuPopup.appendChild(quick);timeMenuPopup.appendChild(actions);
    document.body.appendChild(timeMenuPopup);
  }

  function timeSeparator(){var separator=document.createElement('span');separator.className='premium-time-separator';separator.textContent=':';return separator;}
  function loadTimeDraft(value){var parts=clockParts(value);timeHourInput.value=pad(parts.hour);timeMinuteInput.value=pad(parts.minute);timeSecondInput.value=pad(parts.second);}

  function openTime(input){
    ensureTimeMenu();close(false);closeTime(false);activeTime=input;loadTimeDraft(input.value);
    var wrapper=input.closest('.premium-time'),trigger=wrapper.querySelector('.premium-time-trigger');
    wrapper.classList.add('is-open');trigger.setAttribute('aria-expanded','true');timeMenuPopup.setAttribute('aria-labelledby',trigger.id);timeMenuPopup.classList.add('is-visible');
    timeClearButton.style.display=input.required?'none':'';positionTime();
    requestAnimationFrame(function(){timeHourInput.focus({preventScroll:true});timeHourInput.select();});
  }

  function closeTime(restoreFocus){
    if(!activeTime){if(timeMenuPopup)timeMenuPopup.classList.remove('is-visible','opens-up');return;}
    var closing=activeTime,wrapper=closing.closest('.premium-time');
    if(wrapper){wrapper.classList.remove('is-open');var trigger=wrapper.querySelector('.premium-time-trigger');if(trigger){trigger.setAttribute('aria-expanded','false');if(restoreFocus)trigger.focus();}}
    activeTime=null;if(timeMenuPopup)timeMenuPopup.classList.remove('is-visible','opens-up');
  }

  function applyTimeDraft(){
    normalizeClockField(timeHourInput);normalizeClockField(timeMinuteInput);normalizeClockField(timeSecondInput);
    commitTime(timeHourInput.value+':'+timeMinuteInput.value+(activeTime && activeTime.step === '1'?':'+timeSecondInput.value:''));
  }

  function commitTime(value){
    if(!activeTime)return;
    var input=activeTime,changed=input.value!==value;
    nativeValue.set.call(input,value);syncTime(input);closeTime(true);
    if(changed){input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}
  }

  function positionTime(){
    if(!activeTime || !timeMenuPopup || !timeMenuPopup.classList.contains('is-visible'))return;
    var trigger=activeTime.closest('.premium-time').querySelector('.premium-time-trigger'),rect=trigger.getBoundingClientRect();
    var space=10,gap=8,viewWidth=document.documentElement.clientWidth,viewHeight=document.documentElement.clientHeight;
    var width=Math.min(344,viewWidth-space*2),left=Math.min(Math.max(space,rect.left),viewWidth-width-space);
    var height=Math.ceil(timeMenuPopup.getBoundingClientRect().height || timeMenuPopup.scrollHeight || 300),below=viewHeight-rect.bottom-gap-space,above=rect.top-gap-space;
    var opensUp=below<height&&above>below;
    timeMenuPopup.style.width=width+'px';timeMenuPopup.style.left=left+'px';timeMenuPopup.classList.toggle('opens-up',opensUp);
    timeMenuPopup.style.top=(opensUp?Math.max(space,rect.top-gap-height):Math.min(viewHeight-space-height,rect.bottom+gap))+'px';
  }

  function scheduleTimePosition(){if(timePositionFrame)return;timePositionFrame=requestAnimationFrame(function(){timePositionFrame=0;positionTime();});}

  function ensureMenu(){
    if(menu) return;
    menu = document.createElement('div');
    menu.className = 'premium-calendar';
    menu.setAttribute('role','dialog');
    menu.setAttribute('aria-modal','false');
    menu.setAttribute('aria-label','Choose a date');

    var header = document.createElement('div');
    header.className = 'premium-calendar-header';
    prevButton = document.createElement('button');
    prevButton.type = 'button';prevButton.className = 'premium-calendar-nav';prevButton.setAttribute('aria-label','Previous month');prevButton.innerHTML = arrowIcon(-1);
    titleButton = document.createElement('button');
    titleButton.type = 'button';titleButton.className = 'premium-calendar-title';
    nextButton = document.createElement('button');
    nextButton.type = 'button';nextButton.className = 'premium-calendar-nav';nextButton.setAttribute('aria-label','Next month');nextButton.innerHTML = arrowIcon(1);
    header.appendChild(prevButton);header.appendChild(titleButton);header.appendChild(nextButton);

    calendarBody = document.createElement('div');
    calendarBody.className = 'premium-calendar-body';

    timeRow = document.createElement('div');
    timeRow.className = 'premium-calendar-time';
    timeRow.innerHTML = '<span class="premium-calendar-time-label">Time</span>';
    hourInput = document.createElement('input');
    hourInput.type = 'text';hourInput.inputMode = 'numeric';hourInput.maxLength = 2;hourInput.className = 'premium-calendar-time-input';hourInput.setAttribute('aria-label','Hour, 24-hour format');
    minuteInput = document.createElement('input');
    minuteInput.type = 'text';minuteInput.inputMode = 'numeric';minuteInput.maxLength = 2;minuteInput.className = 'premium-calendar-time-input';minuteInput.setAttribute('aria-label','Minute');
    var colon = document.createElement('span');colon.className = 'premium-calendar-time-colon';colon.textContent = ':';
    timeRow.appendChild(hourInput);timeRow.appendChild(colon);timeRow.appendChild(minuteInput);

    footer = document.createElement('div');
    footer.className = 'premium-calendar-footer';
    clearButton = document.createElement('button');clearButton.type = 'button';clearButton.className = 'premium-calendar-action is-clear';clearButton.textContent = 'Clear';
    todayButton = document.createElement('button');todayButton.type = 'button';todayButton.className = 'premium-calendar-action';todayButton.textContent = 'Today';
    applyButton = document.createElement('button');applyButton.type = 'button';applyButton.className = 'premium-calendar-action is-primary';applyButton.textContent = 'Apply';
    footer.appendChild(clearButton);footer.appendChild(todayButton);footer.appendChild(applyButton);

    menu.appendChild(header);menu.appendChild(calendarBody);menu.appendChild(timeRow);menu.appendChild(footer);
    document.body.appendChild(menu);

    prevButton.addEventListener('click',function(){ changePeriod(-1); });
    nextButton.addEventListener('click',function(){ changePeriod(1); });
    titleButton.addEventListener('click',function(){ viewMode = viewMode === 'days' ? 'months' : 'days';render(); });
    clearButton.addEventListener('click',clearValue);
    todayButton.addEventListener('click',chooseToday);
    applyButton.addEventListener('click',applyDraft);
    hourInput.addEventListener('input',cleanTimeInput);
    minuteInput.addEventListener('input',cleanTimeInput);
    hourInput.addEventListener('blur',normalizeTimeInput);
    minuteInput.addEventListener('blur',normalizeTimeInput);
    menu.addEventListener('keydown',onMenuKeydown);
  }

  function cleanTimeInput(event){ event.target.value = event.target.value.replace(/\D/g,'').slice(0,2); }
  function normalizeTimeInput(event){
    var max = event.target === hourInput ? 23 : 59;
    event.target.value = pad(clamp(Number(event.target.value || 0),0,max));
  }

  function open(input){
    ensureMenu();
    close(false);
    active = input;
    var selected = parseDate(input.value) || new Date();
    viewDate = new Date(selected.getFullYear(),selected.getMonth(),1);
    draftDate = datePart(input) || dateString(selected);
    viewMode = 'days';
    var parts = timeParts(input.value);
    hourInput.value = pad(parts.hour);minuteInput.value = pad(parts.minute);
    var wrapper = input.closest('.premium-date');
    var trigger = wrapper.querySelector('.premium-date-trigger');
    wrapper.classList.add('is-open');
    trigger.setAttribute('aria-expanded','true');
    menu.setAttribute('aria-labelledby',trigger.id);
    menu.classList.add('is-visible');
    render();position();
    requestAnimationFrame(function(){
      var selectedButton = menu.querySelector('.premium-calendar-day.is-selected:not(:disabled)') || menu.querySelector('.premium-calendar-day.is-today:not(:disabled)') || menu.querySelector('.premium-calendar-day:not(:disabled)');
      if(selectedButton) selectedButton.focus({preventScroll:true});
    });
  }

  function close(restoreFocus){
    if(!active){ if(menu)menu.classList.remove('is-visible','opens-up');return; }
    var closing = active;
    var wrapper = closing.closest('.premium-date');
    if(wrapper){
      wrapper.classList.remove('is-open');
      var trigger = wrapper.querySelector('.premium-date-trigger');
      if(trigger){trigger.setAttribute('aria-expanded','false');if(restoreFocus)trigger.focus();}
    }
    active = null;
    if(menu)menu.classList.remove('is-visible','opens-up');
  }

  function minDate(){ return active && active.min ? String(active.min).slice(0,10) : ''; }
  function maxDate(){ return active && active.max ? String(active.max).slice(0,10) : ''; }
  function dateDisabled(value){ return (minDate() && value < minDate()) || (maxDate() && value > maxDate()); }

  function render(){
    if(!active || !menu) return;
    timeRow.style.display = active.type === 'datetime-local' ? 'flex' : 'none';
    applyButton.style.display = active.type === 'datetime-local' ? '' : 'none';
    clearButton.style.display = active.required ? 'none' : '';
    if(viewMode === 'months') renderMonths(); else renderDays();
    position();
  }

  function renderDays(){
    prevButton.setAttribute('aria-label','Previous month');nextButton.setAttribute('aria-label','Next month');
    titleButton.textContent = monthNames[viewDate.getMonth()]+' '+viewDate.getFullYear();
    titleButton.setAttribute('aria-label','Choose month and year, currently '+titleButton.textContent);
    calendarBody.innerHTML = '';
    var weekdayRow = document.createElement('div');weekdayRow.className = 'premium-calendar-weekdays';
    weekdays.forEach(function(day){var cell=document.createElement('span');cell.textContent=day;weekdayRow.appendChild(cell);});
    calendarBody.appendChild(weekdayRow);
    var grid = document.createElement('div');grid.className = 'premium-calendar-grid';grid.setAttribute('role','grid');
    var first = new Date(viewDate.getFullYear(),viewDate.getMonth(),1);
    var start = new Date(first);start.setDate(1-first.getDay());
    var today = new Date();
    for(var i=0;i<42;i++){
      var date = new Date(start);date.setDate(start.getDate()+i);
      var value = dateString(date);
      var button = document.createElement('button');
      button.type = 'button';button.className = 'premium-calendar-day';button.textContent = String(date.getDate());button.dataset.date = value;
      button.setAttribute('role','gridcell');button.setAttribute('aria-label',new Intl.DateTimeFormat(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(date));
      if(date.getMonth() !== viewDate.getMonth())button.classList.add('is-outside');
      if(sameDate(date,today))button.classList.add('is-today');
      if(value === draftDate){button.classList.add('is-selected');button.setAttribute('aria-selected','true');}
      if(dateDisabled(value))button.disabled = true;
      button.addEventListener('click',function(){chooseDate(this.dataset.date);});
      grid.appendChild(button);
    }
    calendarBody.appendChild(grid);
  }

  function renderMonths(){
    prevButton.setAttribute('aria-label','Previous year');nextButton.setAttribute('aria-label','Next year');
    titleButton.textContent = String(viewDate.getFullYear());
    titleButton.setAttribute('aria-label','Return to calendar for '+viewDate.getFullYear());
    calendarBody.innerHTML = '';
    var grid = document.createElement('div');grid.className = 'premium-calendar-months';
    var selected = parseDate(draftDate);
    shortMonths.forEach(function(month,index){
      var button = document.createElement('button');button.type = 'button';button.className = 'premium-calendar-month';button.textContent = month;button.dataset.month = index;
      if(selected && selected.getFullYear() === viewDate.getFullYear() && selected.getMonth() === index)button.classList.add('is-selected');
      button.addEventListener('click',function(){viewDate = new Date(viewDate.getFullYear(),Number(this.dataset.month),1);viewMode='days';render();});
      grid.appendChild(button);
    });
    calendarBody.appendChild(grid);
  }

  function changePeriod(delta){
    if(viewMode === 'months')viewDate = new Date(viewDate.getFullYear()+delta,viewDate.getMonth(),1);
    else viewDate = new Date(viewDate.getFullYear(),viewDate.getMonth()+delta,1);
    render();
  }

  function chooseDate(value){
    if(dateDisabled(value)) return;
    draftDate = value;
    if(active.type === 'datetime-local'){render();hourInput.focus();hourInput.select();}
    else commit(value);
  }

  function chooseToday(){
    var today = dateString(new Date());
    if(dateDisabled(today)) return;
    draftDate = today;
    viewDate = new Date();viewDate = new Date(viewDate.getFullYear(),viewDate.getMonth(),1);
    if(active.type === 'datetime-local'){render();hourInput.focus();hourInput.select();}
    else commit(today);
  }

  function applyDraft(){
    if(!active || !draftDate || dateDisabled(draftDate)) return;
    var hour = clamp(Number(hourInput.value || 0),0,23);
    var minute = clamp(Number(minuteInput.value || 0),0,59);
    commit(draftDate+'T'+pad(hour)+':'+pad(minute));
  }

  function clearValue(){ if(active && !active.required)commit(''); }

  function commit(value){
    if(!active) return;
    var input = active;
    var changed = input.value !== value;
    nativeValue.set.call(input,value);
    sync(input);close(true);
    if(changed){input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}
  }

  function onMenuKeydown(event){
    if(!active) return;
    if(event.key === 'Escape'){event.preventDefault();close(true);return;}
    var day = event.target.closest && event.target.closest('.premium-calendar-day');
    if(!day) return;
    var offset = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' ? -7 : event.key === 'ArrowDown' ? 7 : 0;
    if(!offset)return;
    event.preventDefault();
    var date = parseDate(day.dataset.date);date.setDate(date.getDate()+offset);
    var targetValue = dateString(date);
    if(dateDisabled(targetValue))return;
    viewDate = new Date(date.getFullYear(),date.getMonth(),1);render();
    requestAnimationFrame(function(){var target=menu.querySelector('[data-date="'+targetValue+'"]');if(target)target.focus();});
  }

  function position(){
    if(!active || !menu || !menu.classList.contains('is-visible')) return;
    var trigger = active.closest('.premium-date').querySelector('.premium-date-trigger');
    var rect = trigger.getBoundingClientRect();
    var padSpace = 10,gap = 7,viewWidth = document.documentElement.clientWidth,viewHeight = document.documentElement.clientHeight;
    var width = Math.min(328,viewWidth-padSpace*2);
    var left = Math.min(Math.max(padSpace,rect.left),viewWidth-width-padSpace);
    var renderedHeight = Math.min(470,Math.ceil(menu.getBoundingClientRect().height || menu.scrollHeight || 410));
    var below = viewHeight-rect.bottom-gap-padSpace,above = rect.top-gap-padSpace;
    var opensUp = below < renderedHeight && above > below;
    menu.style.width = width+'px';menu.style.left = left+'px';menu.classList.toggle('opens-up',opensUp);
    menu.style.top = opensUp ? Math.max(padSpace,rect.top-gap-renderedHeight)+'px' : Math.min(viewHeight-padSpace-renderedHeight,rect.bottom+gap)+'px';
  }

  function schedulePosition(){
    if(positionFrame)return;
    positionFrame=requestAnimationFrame(function(){positionFrame=0;position();});
  }

  function scan(root){
    if(!root)return;
    if(root.matches && root.matches('input[type="date"],input[type="datetime-local"]'))enhance(root);
    if(root.querySelectorAll)root.querySelectorAll('input[type="date"],input[type="datetime-local"]').forEach(enhance);
    if(root.matches && root.matches('.reminder-fields input[type="time"]'))enhanceTime(root);
    if(root.querySelectorAll)root.querySelectorAll('.reminder-fields input[type="time"]').forEach(enhanceTime);
  }

  document.addEventListener('change',function(event){if(event.target.matches && event.target.matches('input[type="date"],input[type="datetime-local"]'))sync(event.target);if(event.target.matches && event.target.matches('.reminder-fields input[type="time"]'))syncTime(event.target);},true);
  document.addEventListener('input',function(event){if(event.target.matches && event.target.matches('input[type="date"],input[type="datetime-local"]'))sync(event.target);if(event.target.matches && event.target.matches('.reminder-fields input[type="time"]'))syncTime(event.target);},true);
  document.addEventListener('reset',function(event){setTimeout(function(){scan(event.target);event.target.querySelectorAll('input[type="date"],input[type="datetime-local"]').forEach(sync);event.target.querySelectorAll('.reminder-fields input[type="time"]').forEach(syncTime);},0);},true);
  document.addEventListener('pointerdown',function(event){if(active && !event.target.closest('.premium-calendar') && !event.target.closest('.premium-date'))close(false);if(activeTime && !event.target.closest('.premium-time-menu') && !event.target.closest('.premium-time'))closeTime(false);},true);
  document.addEventListener('focusin',function(event){if(active && !event.target.closest('.premium-calendar') && !event.target.closest('.premium-date'))close(false);if(activeTime && !event.target.closest('.premium-time-menu') && !event.target.closest('.premium-time'))closeTime(false);});
  document.addEventListener('scroll',function(){schedulePosition();scheduleTimePosition();},true);window.addEventListener('resize',function(){schedulePosition();scheduleTimePosition();},{passive:true});

  var observer = new MutationObserver(function(mutations){
    mutations.forEach(function(mutation){
      if(mutation.type === 'childList')mutation.addedNodes.forEach(function(node){if(node.nodeType===1)scan(node);});
      else if(mutation.target.matches && mutation.target.matches('input[type="date"],input[type="datetime-local"],.reminder-fields input[type="time"]'))queueSync(mutation.target);
    });
  });

  function start(){scan(document);observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled','readonly','required','min','max','style','class']});}
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded',start,{once:true}) : start();
})();
