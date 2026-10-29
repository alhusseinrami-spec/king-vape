
/* ---------- the website's own admin: sign in, load the newest list, save through the server, manage admins */
var API = {
  call: function(method, url, body, raw){
    var opt = { method: method, credentials: 'same-origin', headers: { 'X-KV': '1' } };
    if (body !== undefined) {
      if (raw) { opt.body = body; opt.headers['Content-Type'] = body.type || 'application/octet-stream'; }
      else { opt.body = JSON.stringify(body); opt.headers['Content-Type'] = 'application/json'; }
    }
    return fetch(url, opt).then(function(r){
      return r.json().then(function(d){ return d; }, function(){ return {}; }).then(function(d){
        if (r.ok) return d;
        var e = new Error(d.error || ('http_' + r.status));
        e.status = r.status; e.code = d.error || ('http_' + r.status); e.data = d;
        throw e;
      });
    }, function(){ var e = new Error('network'); e.code = 'network'; throw e; });
  }
};

function errText(e){
  var c = e && e.code, d = (e && e.data) || {};
  if (c === 'network') return t('eNet');
  if (c === 'bad_login') return t('eBadLogin');
  if (c === 'locked') return t('eLocked', d.retry || 60);
  if (c === 'weak_password') return t('eWeak');
  if (c === 'bad_username') return t('eUsername');
  if (c === 'name_taken') return t('eTaken');
  if (c === 'too_many_admins') return t('eTooMany');
  if (c === 'owner_only') return t('eOwnerOnly');
  if (c === 'cannot_remove_self') return t('eSelf');
  if (c === 'no_such_admin') return t('eNoAdmin');
  if (c === 'signed_out') return t('eSignedOut');
  if (c === 'bad_code') return t('eBadCode');
  if (c === 'setup_disabled') return t('eSetupOff');
  if (c === 'already_setup') return t('eAlready');
  if (c === 'missing') return t('eMissing');
  if (c === 'busy') return t('eBusy');
  if (c === 'too_large') return t('aErrLarge');
  if (c === 'bad_product') { var bp = d.id && work && wid(d.id); return t('eBadProduct', bp && bp.name); }
  return t('eGeneric');
}

/* ---- who is signed in */
function setMe(m){
  admin.me = m; admin.on = !!m; admin.upload = m ? uploadPhoto : null;
  $('#adminbtn').hidden = !m;
  $('#s-edit').hidden = !m;
  if (m) store.set('kv-staff', '1'); else store.del('kv-staff');
}
function onSignedOut(){ setMe(null); }
function uploadPhoto(blob){
  return API.call('POST', '/api/admin?a=photo', blob, true).then(function(d){ return d.url; }, function(e){ if (e.status === 401) onSignedOut(); throw e; });
}

/* ---- sign-in / first-time setup dialog */
var authMode = 'login', authThen = null, authBusy = false;
function authMsg(text){ var m = $('#au-msg'); m.hidden = !text; m.textContent = text || ''; }
function showLabel(b){ var inp = document.getElementById(b.dataset.show); b.textContent = t(inp && inp.type === 'text' ? 'auHide' : 'auShow'); }
function renderAuth(){
  var setup = authMode === 'setup';
  $('#au-title').textContent = t(setup ? 'suTitle' : 'auTitle');
  $('#au-sub').textContent = t(setup ? 'suSub' : 'auSub');
  document.querySelectorAll('#au-form .f-setup').forEach(function(el){ el.hidden = !setup; });
  $('#au-user-l').textContent = t(setup ? 'suUser' : 'auUser');
  $('#au-pass-l').textContent = t(setup ? 'suPass' : 'auPass');
  $('#au-pass').autocomplete = setup ? 'new-password' : 'current-password';
  $('#au-go span').textContent = t(authBusy ? 'auWait' : setup ? 'suGo' : 'auGo');
  $('#au-forgot').textContent = t('auForgot'); $('#au-forgot').hidden = setup;
  document.querySelectorAll('#auth [data-show]').forEach(showLabel);
}
function openAuth(then){
  authThen = then || null; authMode = 'login'; authBusy = false;
  ['au-code', 'au-name', 'au-user', 'au-pass', 'au-pass2'].forEach(function(id){ document.getElementById(id).value = ''; });
  ['au-pass', 'au-pass2'].forEach(function(id){ document.getElementById(id).type = 'password'; });
  $('#au-go').disabled = false; authMsg(''); renderAuth(); openD($('#auth'));
  API.call('GET', '/api/auth').then(function(s){
    if (s.me) { setMe(s.me); closeD($('#auth')); var f = authThen; authThen = null; if (f) f(); return; }
    var want = s.setup ? 'setup' : 'login';
    if (want !== authMode) { authMode = want; renderAuth(); }
    var first = $(want === 'setup' ? '#au-code' : '#au-user'); if (first && $('#auth').open) first.focus();
  }, function(e){ authMsg(errText(e)); });
}
$('#au-form').addEventListener('submit', function(e){
  e.preventDefault();
  if (authBusy) return;
  var user = $('#au-user').value.trim(), pass = $('#au-pass').value, body;
  authMsg('');
  if (!user || !pass) { authMsg(t('eMissing')); return; }
  if (authMode === 'setup') {
    if (pass !== $('#au-pass2').value) { authMsg(t('suMismatch')); return; }
    body = { a: 'setup', code: $('#au-code').value, name: $('#au-name').value, username: user, password: pass };
  } else body = { a: 'login', username: user, password: pass };
  authBusy = true; $('#au-go').disabled = true; renderAuth();
  API.call('POST', '/api/auth', body).then(function(d){
    authBusy = false; $('#au-go').disabled = false;
    $('#au-pass').value = ''; $('#au-pass2').value = '';
    setMe(d.me); closeD($('#auth'));
    var f = authThen; authThen = null; if (f) f();
  }, function(err){
    authBusy = false; $('#au-go').disabled = false;
    if (err.code === 'already_setup') authMode = 'login';
    renderAuth(); authMsg(errText(err));
    if (err.code === 'bad_login') { $('#au-pass').value = ''; $('#au-pass').focus(); }
  });
});
$('#au-close').addEventListener('click', function(){ closeD($('#auth')); });
$('#auth').addEventListener('click', function(e){ if (e.target === this) closeD(this); });
$('#auth').addEventListener('close', function(){ $('#au-pass').value = ''; $('#au-pass2').value = ''; authThen = null; });
document.addEventListener('click', function(e){
  var b = e.target.closest && e.target.closest('[data-show]'); if (!b) return;
  var inp = document.getElementById(b.dataset.show); if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password'; showLabel(b);
});
$('#staff').addEventListener('click', function(){
  if (admin.on) openAdminPanel(); else openAuth(function(){ openAdminPanel(); });
});

/* ---- the product editor: load the newest list, save, handle two people editing at once */
function setWork(cat){
  work = cat.products.map(normProduct).filter(Boolean).map(clone);
  dirty = {}; gone = {};
}
function openAdminPanel(id){
  if (!admin.on) { openAuth(function(){ openAdminPanel(id); }); return; }
  if (work && dirtyCount()) { adminOpen(id); return; }
  API.call('GET', '/api/admin?a=catalog').then(function(cat){
    setWork(cat); notice = null; applyCatalog(cat); adminOpen(id);
  }, function(e){
    if (e.status === 401) { onSignedOut(); openAuth(function(){ openAdminPanel(id); }); return; }
    work = null; dirty = {}; gone = {}; notice = t('aLoadFail'); adminOpen(id);
  });
}
function mergeConflict(res){
  var conflicts = {}, names = [];
  res.ids.forEach(function(id){
    conflicts[id] = 1;
    var mine = wid(id), theirs = res.catalog.products.filter(function(p){ return p.id === id; })[0];
    names.push('“' + ((theirs && theirs.name) || (mine && mine.name) || id) + '”');
  });
  var srv = res.catalog.products.map(normProduct).filter(Boolean).map(clone), out = [], seen = {}, nd = {}, ng = {};
  srv.forEach(function(sp){
    seen[sp.id] = 1;
    if (dirty[sp.id] && !conflicts[sp.id]) {
      var mine = wid(sp.id);
      if (mine) out.push(mine); else ng[sp.id] = sp.u | 0;   /* my edit (or my delete) still applies: nobody else touched it */
      nd[sp.id] = true;
    } else out.push(sp);
  });
  work.forEach(function(p){ if (p.isNew && dirty[p.id] && !seen[p.id]) { out.push(p); nd[p.id] = true; } });
  work = out; dirty = nd; gone = ng;
  if (openId && !wid(openId)) openId = null;
  notice = t('aConflict', names.join(', '));
  applyCatalog(res.catalog, true);
  saving = false; adminRender(); aStatus(t('aErrConflict'), true);
}
function adminSave(){
  if (saving || !work) return;
  var bad = work.filter(function(p){ return !(p.name || '').trim(); })[0];
  if (bad) { openId = bad.id; adminList(); aStatus(t('aNeedName'), true); return; }
  var changes = [];
  Object.keys(dirty).forEach(function(id){
    var p = wid(id);
    if (p) changes.push({ id: id, base: p.isNew ? null : (p.u | 0), product: cleanProduct(p) });
    else if (gone[id] !== undefined) changes.push({ id: id, base: gone[id], product: null });
  });
  if (!changes.length) { dirty = {}; gone = {}; aFoot(); return; }
  saving = true; aStatus(t('aSaving')); $('#a-save').disabled = true; $('#a-discard').disabled = true;
  API.call('POST', '/api/admin', { a: 'save', changes: changes }).then(function(d){
    saving = false;
    setWork(d.catalog); notice = null; applyCatalog(d.catalog, true);
    adminRender(); aStatus(t('aSaved'));
  }, function(err){
    if (err.code === 'conflict') { mergeConflict(err.data); return; }
    saving = false; aFoot();
    if (err.status === 401) { onSignedOut(); aStatus(t('eSignedOut'), true); openAuth(); return; }
    aStatus(err.code === 'network' ? t('eNet') : errText(err), true);
  });
}
$('#a-save').addEventListener('click', adminSave);

function signOut(){
  function done(){
    setMe(null); work = null; dirty = {}; gone = {}; notice = null; openId = null;
    closeD($('#people')); closeD($('#admin')); closeD($('#auth')); toast(t('aOutDone'));
  }
  API.call('POST', '/api/auth', { a: 'logout' }).then(done, done);
}
$('#a-out').addEventListener('click', function(){
  var b = this;
  if (dirtyCount() && !b.dataset.armed) {
    b.dataset.armed = '1'; b.textContent = t('aOut2');
    setTimeout(function(){ if (b.isConnected) { delete b.dataset.armed; b.textContent = t('aOut'); } }, 4000);
    return;
  }
  signOut();
});
$('#a-people').addEventListener('click', function(){ openPeople(); });

/* ---- admins and my account */
var team = null, credText = '';
function genPass(){
  var A = 'abcdefghjkmnpqrstuvwxyz23456789', out = '', a = new Uint32Array(12);   /* no look-alike letters */
  window.crypto.getRandomValues(a);
  for (var i = 0; i < 12; i++) { out += A.charAt(a[i] % A.length); if (i % 4 === 3 && i < 11) out += '-'; }
  return out;
}
function copyText(text){
  return new Promise(function(res){
    function fallback(){
      try {
        var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:0;opacity:0'; $('#people').appendChild(ta); ta.select();
        var ok = document.execCommand('copy'); ta.remove(); res(ok);
      } catch (e) { res(false); }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function(){ res(true); }, fallback); else fallback();
  });
}
function pfield(label, id, auto, gen){
  return '<label for="' + id + '"><b>' + label + '</b><span class="pw"><input id="' + id + '" type="password" autocomplete="' + auto + '" autocapitalize="none" autocorrect="off" spellcheck="false">' +
    (gen ? '<button class="gen" type="button" data-act="gen" data-for="' + id + '">' + t('pGen') + '</button>' : '') +
    '<button class="show" type="button" data-show="' + id + '">' + t('auShow') + '</button></span></label>';
}
function teamRows(){
  if (!team) return '<li class="p-row"><span class="s-sub">' + t('pLoading') + '</span></li>';
  return team.map(function(a){
    var you = a.u === admin.me.u, owner = a.role === 'owner';
    return '<li class="p-row" data-u="' + esc(a.u) + '"><div class="pr-top"><div class="who"><b>' + esc(a.name) + '<span class="role">' + t(owner ? 'roleOwner' : 'roleAdmin') + '</span>' +
      (you ? '<span class="role">' + t('pYou') + '</span>' : '') + '</b><span><bdi dir="ltr">@' + esc(a.u) + '</bdi></span></div>' +
      (owner ? '' : '<div class="acts"><button class="btn sm" type="button" data-act="reset">' + t('pReset') + '</button><button class="btn sm danger" type="button" data-act="remove">' + t('pRemove') + '</button></div>') + '</div>' +
      (owner ? '' : '<form class="p-reset" data-form="reset" data-u="' + esc(a.u) + '" hidden novalidate>' + pfield(t('pNew'), 'rp-' + esc(a.u), 'new-password', true) + '<button class="btn gold" type="submit">' + t('pResetGo') + '</button></form>') + '</li>';
  }).join('');
}
function peopleHtml(){
  var me = admin.me, owner = me.role === 'owner';
  var h = '<p class="msg" id="pe-msg" role="status" hidden></p>';
  h += '<section class="p-card"><h3 class="p-h">' + t('pAccount') + '</h3><div class="p-me"><b>' + esc(me.name) + '</b><span><bdi dir="ltr">@' + esc(me.u) + '</bdi> · ' + t(owner ? 'roleOwner' : 'roleAdmin') + '</span></div>' +
    '<details class="p-pw"><summary>' + t('pChangePw') + '</summary><form data-form="pw" novalidate>' + pfield(t('pCur'), 'pw-cur', 'current-password') + pfield(t('pNew'), 'pw-new', 'new-password') +
    pfield(t('pNew2'), 'pw-new2', 'new-password') + '<button class="btn gold" type="submit">' + t('pSavePw') + '</button></form></details></section>';
  if (owner) {
    h += '<section class="p-card"><h3 class="p-h">' + t('pTeam') + '</h3><p class="s-sub">' + t('pTeamSub') + '</p><ul class="p-list" id="pe-list">' + teamRows() + '</ul></section>';
    h += '<section class="p-card"><h3 class="p-h">' + t('pAdd') + '</h3><form data-form="add" novalidate>' +
      '<label for="ad-name"><b>' + t('pName') + '</b><input id="ad-name" type="text" autocomplete="off"></label>' +
      '<label for="ad-user"><b>' + t('pUser') + '</b><input id="ad-user" type="text" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false"></label>' +
      pfield(t('pPass'), 'ad-pass', 'new-password', true) + '<small class="s-sub">' + t('passHint') + '</small>' +
      '<button class="btn gold" type="submit">' + t('pAddGo') + '</button><div class="p-cred" id="pe-cred" hidden></div></form></section>';
  }
  return h;
}
function peopleRender(){
  $('#pe-title').textContent = t('pTitle');
  var keep = $('#pe-msg') && !$('#pe-msg').hidden ? { t: $('#pe-msg').textContent, c: $('#pe-msg').className } : null;
  $('#pe-body').innerHTML = peopleHtml();
  if (keep) { var m = $('#pe-msg'); m.textContent = keep.t; m.className = keep.c; m.hidden = false; }
  credShow();
}
function teamRefresh(){ var l = $('#pe-list'); if (l) l.innerHTML = teamRows(); }
function pmsg(text, bad){
  var m = $('#pe-msg'); if (!m) return;
  m.textContent = text; m.className = 'msg ' + (bad ? 'bad' : 'ok'); m.hidden = false;
  try { m.scrollIntoView({ block: 'nearest' }); } catch (e) {}
}
function credShow(){
  var box = $('#pe-cred'); if (!box) return;
  if (!credText) { box.hidden = true; box.innerHTML = ''; return; }
  box.hidden = false;
  box.innerHTML = '<p>' + esc(t('pShare')) + '</p><pre>' + esc(credText) + '</pre><button class="btn sm gold" type="button" data-act="copycred">' + t('pCopy') + '</button>';
}
function openPeople(){
  if (!admin.on) return;
  team = null; credText = ''; peopleRender(); openD($('#people'));
  if (admin.me.role === 'owner') loadTeam();
}
function loadTeam(){
  return API.call('GET', '/api/admin?a=team').then(function(d){ team = d.team; teamRefresh(); }, function(e){
    if (e.status === 401) { onSignedOut(); closeD($('#people')); openAuth(); } else pmsg(errText(e), true);
  });
}
function peopleFail(e){
  if (e.status === 401 && e.code === 'signed_out') { onSignedOut(); closeD($('#people')); openAuth(); return; }
  pmsg(e.code === 'bad_login' && e.data && e.data.error ? t('eCurrent') : errText(e), true);
}
$('#pe-body').addEventListener('click', function(e){
  var b = e.target.closest('[data-act]'); if (!b) return;
  var act = b.dataset.act, row = b.closest('.p-row');
  if (act === 'gen') {
    var inp = document.getElementById(b.dataset.for); inp.value = genPass(); inp.type = 'text';
    var sh = inp.parentNode.querySelector('[data-show]'); if (sh) showLabel(sh);
  } else if (act === 'reset') {
    var f = row.querySelector('.p-reset'); f.hidden = !f.hidden;
    if (!f.hidden) f.querySelector('input').focus();
  } else if (act === 'remove') {
    var u = row.dataset.u;
    if (!b.dataset.armed) {
      b.dataset.armed = '1'; b.textContent = t('pRemove2');
      setTimeout(function(){ if (b.isConnected) { delete b.dataset.armed; b.textContent = t('pRemove'); } }, 3000);
      return;
    }
    API.call('POST', '/api/admin', { a: 'removeAdmin', username: u }).then(function(d){ team = d.team; teamRefresh(); pmsg(t('pRemoved', u)); }, peopleFail);
  } else if (act === 'copycred') {
    copyText(credText).then(function(ok){ pmsg(t(ok ? 'pCopied' : 'pCopyFail'), !ok); });
  }
});
$('#pe-body').addEventListener('submit', function(e){
  e.preventDefault();
  var f = e.target, kind = f.dataset.form, btn = f.querySelector('[type=submit]');
  function val(id){ return document.getElementById(id).value; }
  function busy(on){ btn.disabled = on; }
  if (kind === 'pw') {
    if (val('pw-new') !== val('pw-new2')) { pmsg(t('pMismatch'), true); return; }
    busy(true);
    API.call('POST', '/api/admin', { a: 'changePw', current: val('pw-cur'), password: val('pw-new') }).then(function(){
      busy(false); f.reset(); f.querySelectorAll('input').forEach(function(i){ i.type = 'password'; }); f.parentNode.open = false; pmsg(t('pPwDone'));
    }, function(err){ busy(false); if (err.code === 'bad_login') pmsg(t('eCurrent'), true); else peopleFail(err); });
  } else if (kind === 'add') {
    var u = val('ad-user').trim().toLowerCase(), p = val('ad-pass');
    busy(true);
    API.call('POST', '/api/admin', { a: 'addAdmin', name: val('ad-name'), username: u, password: p }).then(function(d){
      busy(false); team = d.team; teamRefresh();
      credText = t('pShareTxt', location.origin + '/admin', u, p);
      f.reset(); document.getElementById('ad-pass').type = 'password'; credShow(); pmsg(t('pAdded', u));
    }, function(err){ busy(false); peopleFail(err); });
  } else if (kind === 'reset') {
    var ru = f.dataset.u, rp = f.querySelector('input').value;
    busy(true);
    API.call('POST', '/api/admin', { a: 'resetPw', username: ru, password: rp }).then(function(d){
      busy(false); team = d.team; teamRefresh();
      credText = t('pShareTxt', location.origin + '/admin', ru, rp); credShow(); pmsg(t('pResetDone', ru));
    }, function(err){ busy(false); peopleFail(err); });
  }
});
$('#pe-close').addEventListener('click', function(){ closeD($('#people')); });
$('#people').addEventListener('click', function(e){ if (e.target === this) closeD(this); });
$('#people').addEventListener('close', function(){ credText = ''; team = null; });

/* ---- on every page load: staff who signed in before are recognised again (the cookie does the real work) */
function initStaff(staffPage){
  var hint = store.get('kv-staff') === '1';
  if (!staffPage && !hint) return;
  API.call('GET', '/api/auth').then(function(s){
    if (s.me) { setMe(s.me); if (staffPage) openAdminPanel(); }
    else { store.del('kv-staff'); if (staffPage) openAuth(function(){ openAdminPanel(); }); }
  }, function(){ if (staffPage) openAuth(function(){ openAdminPanel(); }); });
}
