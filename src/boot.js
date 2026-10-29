
/* ---------- start: show the built-in list at once (or the server's list if it answers within a blink), then keep it fresh */
(function(){
  var started = false;
  function start(cat){
    if (started) return;
    started = true;
    if (cat) applyCatalog(cat);
    applyLang();
    if (dropped) toast(t('tDropped'), true);
    var staffPage = location.pathname.replace(/\/+$/, '') === '/admin';
    if (!staffPage && store.get('kv-18') !== 'yes') { $('#gate').showModal(); document.documentElement.classList.add('lock'); }
    initStaff(staffPage);
  }
  var timer = setTimeout(function(){ start(null); }, 350);
  fetchCatalog().then(function(cat){
    if (!started) { clearTimeout(timer); start(cat); }
    else if (cat) applyCatalog(cat);
  });
  document.addEventListener('visibilitychange', function(){
    if (document.visibilityState === 'visible' && started && Date.now() - lastCatalog > 60000) fetchCatalog().then(function(cat){ if (cat) applyCatalog(cat); });
  });
})();
