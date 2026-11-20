(function(){
  // mobile menu
  var btn=document.querySelector('.menu-btn'),nav=document.querySelector('.nav');
  if(btn&&nav){btn.addEventListener('click',function(){var o=nav.classList.toggle('open');btn.setAttribute('aria-expanded',o?'true':'false');btn.textContent=o?'Close':'Menu';});}

  // hero: play the gig video if it exists, otherwise draw a live EQ
  var media=document.querySelector('.hero-media');
  if(media){
    var v=media.querySelector('video'),c=media.querySelector('canvas');
    var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function eq(){
      if(!c)return;c.hidden=false;var x=c.getContext('2d'),w,h,bars=64,t=0,dpr=Math.min(window.devicePixelRatio||1,2);
      function size(){w=c.clientWidth;h=c.clientHeight;c.width=w*dpr;c.height=h*dpr;x.setTransform(dpr,0,0,dpr,0,0);}
      size();window.addEventListener('resize',size);
      function draw(){
        x.clearRect(0,0,w,h);var bw=w/bars;
        for(var i=0;i<bars;i++){
          var p=i/bars,beat=Math.pow(Math.max(0,Math.sin(t*2.1)),6);
          var v1=0.35+0.3*Math.sin(t*1.3+i*0.35)+0.2*Math.sin(t*2.7+i*0.11)+beat*0.35*(1-p);
          var bh=Math.max(4,v1*h*0.55*(0.4+0.6*Math.sin(p*Math.PI)));
          var g=x.createLinearGradient(0,h,0,h-bh);g.addColorStop(0,'rgba(177,77,255,0.05)');g.addColorStop(1,'rgba(177,77,255,0.55)');
          x.fillStyle=g;x.fillRect(i*bw+bw*0.2,h-bh,bw*0.6,bh);
        }
        t+=0.016;if(!reduce)requestAnimationFrame(draw);
      }
      draw();
    }
    if(v){
      v.addEventListener('error',function(){v.remove();eq();},true);
      var src=v.querySelector('source');if(src)src.addEventListener('error',function(){v.remove();eq();});
      v.addEventListener('loadeddata',function(){if(c)c.hidden=true;});
      setTimeout(function(){if(v.isConnected&&v.readyState<2){v.remove();eq();}},2500);
    }else eq();
  }

  // catalogue filters
  var fbar=document.querySelector('.filters');
  if(fbar){
    fbar.addEventListener('click',function(e){
      var b=e.target.closest('button');if(!b)return;
      fbar.querySelectorAll('button').forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false');});
      var k=b.dataset.k;
      document.querySelectorAll('[data-kind]').forEach(function(el){el.hidden=!(k==='all'||el.dataset.kind===k);});
    });
  }

  // booking form: sends the request to info@djowmusic.com (FormSubmit), falls back to email / WhatsApp
  var form=document.getElementById('booking-form');
  if(form){
    var out=document.getElementById('form-out'),pre=out.querySelector('pre'),ok=document.getElementById('form-ok'),btn=form.querySelector('button[type=submit]');
    form.addEventListener('submit',function(e){
      e.preventDefault();var d=new FormData(form);
      if(d.get('_honey'))return;
      var lines=['Booking request for DJOW','','Name: '+d.get('name'),'Email: '+d.get('email'),'Phone: '+(d.get('phone')||'-'),'Event type: '+d.get('type'),'Date: '+(d.get('date')||'-'),'City / venue: '+(d.get('city')||'-'),'Guests: '+(d.get('guests')||'-'),'Set length: '+(d.get('length')||'-'),'','Details:',(d.get('details')||'-')];
      var text=lines.join('\n');pre.textContent=text;
      var subject='New booking inquiry - '+d.get('type')+' - '+(d.get('date')||'date tbc')+' - '+d.get('name');
      out.querySelector('.mail').href='mailto:info@djowmusic.com?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(text);
      out.querySelector('.wa').href='https://wa.me/971545188640?text='+encodeURIComponent(text);
      btn.disabled=true;var label=btn.textContent;btn.textContent='Sending…';
      var payload={'Name':d.get('name'),'email':d.get('email'),'Phone / WhatsApp':d.get('phone')||'-','Event type':d.get('type'),'Event date':d.get('date')||'-','City / venue':d.get('city')||'-','Guests':d.get('guests')||'-','Set length':d.get('length')||'-','Details':d.get('details')||'-',
        '_subject':subject,'_template':'table','_replyto':d.get('email'),
        '_autoresponse':'Thanks for your booking request. We have your details and will reply with availability and a quote. - DJOW'};
      fetch('https://formsubmit.co/ajax/info@djowmusic.com',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(payload)})
        .then(function(r){return r.json();})
        .then(function(j){
          if(String(j.success)!=='true')throw new Error(j.message||'not sent');
          form.hidden=true;out.classList.remove('show');ok.hidden=false;ok.scrollIntoView({behavior:'smooth',block:'center'});
          try{if(window.fbq)fbq('track','Lead',{content_name:'Booking request',content_category:d.get('type')});}catch(x){}
          try{if(window.gtag)gtag('event','generate_lead',{method:'website_form',event_type:d.get('type')});}catch(x){}
        })
        .catch(function(){
          btn.disabled=false;btn.textContent=label;
          out.classList.add('show');out.scrollIntoView({behavior:'smooth',block:'center'});
        });
    });
    var cp=out.querySelector('.copy');
    if(cp)cp.addEventListener('click',function(){
      if(navigator.clipboard){navigator.clipboard.writeText(pre.textContent).then(function(){cp.textContent='Copied';},function(){cp.textContent='Select the text to copy';});}
    });
  }
})();

// ---------- player ----------
(function(){
  var bar=document.getElementById('player');if(!bar)return;
  var au=bar.querySelector('audio'),list=[].slice.call(document.querySelectorAll('[data-track]')),cur=-1;
  if(!list.length)return;
  var $=function(s){return bar.querySelector(s)};
  function fmt(s){s=Math.floor(s||0);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}
  function mark(){
    list.forEach(function(el,i){var b=el.querySelector('.play-btn');var on=(el.dataset.src===(list[cur]||{}).dataset?.src)&&!au.paused;if(b)b.classList.toggle('is-playing',on);el.classList.toggle('now',el.dataset.src===(list[cur]||{dataset:{}}).dataset.src);});
    $('.p-play').classList.toggle('on',!au.paused);
  }
  function load(i){
    cur=i;var d=list[i].dataset;
    if(au.getAttribute('src')!==d.src){au.src=d.src;}
    $('.p-title').textContent=d.title;$('.p-credit').textContent=d.credit;
    var c=$('.p-cover');if(d.cover){c.src=d.cover;c.style.visibility='visible'}else c.style.visibility='hidden';
    var dl=$('.p-dl');dl.href=d.src;dl.setAttribute('download','DJOW - '+d.title+'.mp3');
    bar.hidden=false;document.body.classList.add('has-player');
  }
  function play(i){
    var same=cur>=0&&list[i].dataset.src===list[cur].dataset.src;
    if(same&&!au.paused){au.pause();return}
    load(i);var p=au.play();if(p&&p.catch)p.catch(function(){});
  }
  list.forEach(function(el,i){var b=el.querySelector('.play-btn');if(b)b.addEventListener('click',function(e){e.preventDefault();play(i)})});
  $('.p-play').addEventListener('click',function(){if(cur<0)return play(0);if(au.paused){var p=au.play();if(p&&p.catch)p.catch(function(){})}else au.pause()});
  $('.p-next').addEventListener('click',function(){play((cur+1)%list.length)});
  $('.p-prev').addEventListener('click',function(){if(au.currentTime>3)au.currentTime=0;else play((cur-1+list.length)%list.length)});
  au.addEventListener('play',mark);au.addEventListener('pause',mark);
  au.addEventListener('ended',function(){play((cur+1)%list.length)});
  au.addEventListener('timeupdate',function(){$('.p-cur').textContent=fmt(au.currentTime);$('.p-dur').textContent=fmt(au.duration);if(au.duration)$('.p-seek').value=Math.round(au.currentTime/au.duration*1000)});
  $('.p-seek').addEventListener('input',function(){if(au.duration)au.currentTime=this.value/1000*au.duration});
})();

// ---------- Meta pixel events ----------
(function(){
  function fb(){if(window.fbq)try{fbq.apply(null,arguments)}catch(e){}}
  if(/shop\.html$/.test(location.pathname))fb('track','ViewContent',{content_name:'DJOW Shop'});
  document.addEventListener('click',function(e){
    var a=e.target.closest('a,button');if(!a)return;
    var h=a.getAttribute('href')||'';
    if(/gumroad\.com/.test(h))fb('track','InitiateCheckout',{content_name:a.textContent.trim()});
    else if(a.classList.contains('dl'))fb('trackCustom','TrackDownload',{track:(a.getAttribute('download')||'').replace('.mp3','')});
    else if(a.classList.contains('play-btn'))fb('trackCustom','TrackPlay');
    else if(/wa\.me|mailto:/.test(h)&&a.closest('#form-out'))fb('track','Lead',{content_name:'Booking request'});
  },true);
})();

// ---------- GA4 events ----------
document.addEventListener('click',function(e){
  var a=e.target.closest('a,button');if(!a||!window.gtag)return;
  var h=a.getAttribute('href')||'';
  if(/gumroad\.com/.test(h))gtag('event','begin_checkout',{item_name:a.textContent.trim()});
  else if(a.classList.contains('dl'))gtag('event','file_download',{file_name:a.getAttribute('download')||''});
  else if(a.classList.contains('play-btn'))gtag('event','track_play');
  else if(/wa\.me|mailto:/.test(h)&&a.closest('#form-out'))gtag('event','generate_lead',{method:/wa\.me/.test(h)?'whatsapp':'email'});
},true);

// only one thing plays at a time (reels and the track player)
document.addEventListener('play',function(e){
  document.querySelectorAll('audio,video').forEach(function(m){
    if(m!==e.target&&!m.muted&&!m.paused)m.pause();
  });
},true);
