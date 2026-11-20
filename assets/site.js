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

  // booking form: compose the request, then send by email or WhatsApp
  var form=document.getElementById('booking-form');
  if(form){
    var out=document.getElementById('form-out'),pre=out.querySelector('pre');
    form.addEventListener('submit',function(e){
      e.preventDefault();var d=new FormData(form);
      var lines=['Booking request for DJOW','','Name: '+d.get('name'),'Email: '+d.get('email'),'Phone: '+(d.get('phone')||'-'),'Event type: '+d.get('type'),'Date: '+(d.get('date')||'-'),'City / venue: '+(d.get('city')||'-'),'Guests: '+(d.get('guests')||'-'),'Set length: '+(d.get('length')||'-'),'','Details:',(d.get('details')||'-')];
      var text=lines.join('\n');pre.textContent=text;
      out.querySelector('.mail').href='mailto:info@djowmusic.com?subject='+encodeURIComponent('Booking request - '+d.get('type')+' - '+(d.get('date')||'date tbc'))+'&body='+encodeURIComponent(text);
      out.querySelector('.wa').href='https://wa.me/971545188640?text='+encodeURIComponent(text);
      out.classList.add('show');out.scrollIntoView({behavior:'smooth',block:'center'});
    });
    var cp=out.querySelector('.copy');
    if(cp)cp.addEventListener('click',function(){
      if(navigator.clipboard){navigator.clipboard.writeText(pre.textContent).then(function(){cp.textContent='Copied';},function(){cp.textContent='Select the text to copy';});}
    });
  }
})();
