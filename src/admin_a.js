
/* ---------- admin: edit the catalogue in a working copy, then save it by publishing the page again */
var work = null, dirty = {}, gone = {}, openId = null, afilter = { q: '', sold: false }, saving = false, notice = null;
function clone(p){ var c = JSON.parse(JSON.stringify(p, function(k, v){ return k === '_hay' ? undefined : v; })); return c; }
function wid(id){ for (var i = 0; i < work.length; i++) if (work[i].id === id) return work[i]; return null; }
function dirtyCount(){ return Object.keys(dirty).length; }
function touch(p){
  dirty[p.id] = true;
  var it = document.querySelector('.a-item[data-id="' + p.id + '"]'); if (it) it.classList.add('dirty');
  aFoot();
}
function aStatus(msg, bad){ var s = $('#a-st'); s.textContent = msg; s.classList.toggle('bad', !!bad); }
function aFoot(){
  var n = dirtyCount();
  $('#a-save').textContent = t('aSave', n); $('#a-save').disabled = !n || saving;
  $('#a-discard').disabled = !n || saving;
  if (!saving) aStatus(n ? t('aUnsaved', pl('change', n)) : t('aNone'));
}
function switchH(on, act, label, extra){
  return '<button class="sw" type="button" role="switch" aria-checked="' + on + '" data-act="' + act + '"' + (extra || '') + '><i></i>' + (label ? '<span>' + label + '</span>' : '') + '</button>';
}
function metaOf(p){
  var c = catOf(p.cat), sub = p.sub && subOf(c, p.sub);
  var gone = p.options.filter(function(o){ return !optOn(p, o); }).length;
  var bits = [esc(cl(c)) + (sub ? ' · ' + esc(cl(sub)) : ''), p.price != null ? '<bdi class="n">' + money(p.price) + '</bdi>' : t('askPrice')];
  if (p.options.length) bits.push(pl(kindOf(p), p.options.length));
  var s = bits.join(' · ');
  if (gone) s += ' · <span class="bad">' + t('soldOut') + ': ' + gone + '</span>';
  return s;
}
function rowH(p){
  var on = isOn(p);
  return '<div class="a-row" style="--glow:rgb(' + p.glow.join(',') + ')"><span class="a-th"><img src="' + esc(p.img) + '" alt=""></span>' +
    '<button class="a-main" type="button" data-act="toggle" aria-expanded="' + (openId === p.id) + '"><b>' + esc(p.name || t('aNew')) + '</b><span>' + metaOf(p) + '</span></button>' +
    switchH(on, 'avail', t(on ? 'aOn' : 'aOff')) + '</div>';
}
function optsH(p){
  var live = p.options.length, k = kindOf(p);
  var kinds = [['flavor', 'aKFlavor'], ['color', 'aKColor'], ['combo', 'aKCombo']].map(function(x){ return '<option value="' + x[0] + '"' + (k === x[0] ? ' selected' : '') + '>' + t(x[1]) + '</option>'; }).join('');
  var title = t(k === 'color' ? 'aKColor' : k === 'combo' ? 'aKCombo' : 'aKFlavor');
  var h = '<div class="a-opts"><h4><b>' + title + (live ? ' <span class="cnt">' + live + '</span>' : '') + '</b>' + (live ? '<span>' + t('aOptHint') + '</span>' : '') + '</h4>';
  h += '<label class="a-kind"><b>' + t('aKind') + '</b><select data-f="kind">' + kinds + '</select></label>';
  if (live) {
    h += '<div class="row" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px"><button class="btn sm" type="button" data-act="allon">' + t('aAllOn') + '</button><button class="btn sm" type="button" data-act="alloff">' + t('aAllOff') + '</button></div>';
    p.options.forEach(function(o, i){
      var on = optOn(p, o);
      h += '<div class="a-opt' + (on ? '' : ' gone') + '" data-oi="' + i + '">' + switchH(on, 'optsw', '', ' aria-label="' + esc(o) + '"') +
        '<div class="mid"><input type="text" value="' + esc(o) + '" data-f="opt" data-oi="' + i + '" aria-label="' + esc(title) + '"><small class="st">' + t(on ? 'aOn' : 'aOff') + '</small></div><button class="del" type="button" data-act="optdel" data-oi="' + i + '" aria-label="' + esc(t('aDelOpt')) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>';
    });
  } else h += '<p class="s-sub">' + t('aNoOpts') + '</p>';
  var ph = t(k === 'color' ? 'aPhColor' : k === 'combo' ? 'aPhCombo' : 'aPhFlavor');
  h += '<div class="a-addopts"><label><b>' + t('aAddOpts') + '</b><textarea data-f="addopts" rows="3" placeholder="' + esc(ph) + '"></textarea></label><div><button class="btn sm gold" type="button" data-act="optadd">' + t('aAddOptsBtn') + '</button></div></div></div>';
  return h;
}
function edH(p){
  var c = catOf(p.cat);
  var catOpts = CATS.map(function(x){ return '<option value="' + x.id + '"' + (x.id === p.cat ? ' selected' : '') + '>' + esc(cl(x)) + '</option>'; }).join('');
  var subSel = c.subs.length ? '<label><b>' + t('aSub2') + '</b><select data-f="sub">' + c.subs.map(function(s){ return '<option value="' + esc(s.id) + '"' + (s.id === p.sub ? ' selected' : '') + '>' + esc(cl(s)) + '</option>'; }).join('') + '</select></label>' : '';
  return '<div class="a-ed">' + optsH(p) +
    '<div class="a-photo" style="--glow:rgb(' + p.glow.join(',') + ')"><div class="pv"><img src="' + esc(p.img) + '" alt=""></div><div>' +
      (admin.upload ? '<button class="btn sm" type="button" data-act="photo">' + t('aChangePhoto') + '</button><input type="file" accept="image/*" hidden data-f="photo">' : '') +
      '<p>' + (admin.upload ? t('aPhotoHint') : t('aErrOff')) + '</p></div></div>' +
    '<div class="grid2"><label><b>' + t('aName') + '</b><input type="text" data-f="name" value="' + esc(p.name) + '" autocomplete="off"></label>' +
    '<label><b>' + t('aNameAr') + '</b><input type="text" data-f="nameAr" dir="rtl" lang="ar" value="' + esc(p.nameAr || '') + '" autocomplete="off"></label></div>' +
    '<div class="grid2"><label><b>' + t('aCat') + '</b><select data-f="cat">' + catOpts + '</select></label>' + subSel + '</div>' +
    '<div class="grid2"><label><b>' + t('aPrice') + '</b><input type="number" inputmode="decimal" min="0" step="0.5" data-f="price" value="' + (p.price != null ? p.price : '') + '"></label>' +
    '</div>' +
    '<label><b>' + t('aSpecs') + '</b><input type="text" data-f="specs" value="' + esc(p.specs.join(', ')) + '" autocomplete="off"></label>' +
    '<div class="grid2"><label><b>' + t('aNote') + '</b><textarea data-f="note">' + esc(p.note || '') + '</textarea></label>' +
    '<label><b>' + t('aNoteAr') + '</b><textarea data-f="noteAr" dir="rtl" lang="ar">' + esc(p.noteAr || '') + '</textarea></label></div>' +
    '<div><button class="btn danger sm" type="button" data-act="del">' + t('aDelProd') + '</button></div></div>';
}
function itemH(p){
  return '<div class="a-item' + (dirty[p.id] ? ' dirty' : '') + (openId === p.id ? ' open' : '') + '" data-id="' + esc(p.id) + '">' + rowH(p) + (openId === p.id ? edH(p) : '') + '</div>';
}
function adminList(){
  var toks = tokens(afilter.q);
  var list = work.filter(function(p){
    if (afilter.sold && isOn(p) && liveOpts(p).length === p.options.length) return false;
    return !toks.length || toks.every(function(k){ return fold([p.name, p.nameAr || '', p.sub || ''].concat(p.options).join(' ')).indexOf(k) > -1 || (ALIAS[k] && fold(p.name + ' ' + p.options.join(' ')).indexOf(ALIAS[k]) > -1); });
  });
  list = list.filter(function(p){ return p.isNew; }).concat(list.filter(function(p){ return !p.isNew; }));
  $('#a-list').innerHTML = list.length ? list.map(itemH).join('') : '<p class="empty">' + t('aEmpty') + '</p>';
}
function adminBanner(){
  var b = $('#a-banner');
  if (!notice) { b.hidden = true; return; }
  b.hidden = false;
  b.innerHTML = '<span>' + esc(notice) + '</span><button class="btn sm" type="button" data-act="dropnotice">' + t('aDismiss') + '</button>';
}
function adminRender(){
  if (!work) work = PRODUCTS.map(clone);
  document.querySelectorAll('#admin [data-i]').forEach(function(el){ el.textContent = t(el.dataset.i); });
  $('#a-q').placeholder = t('aSearch');
  $('#a-sub').textContent = admin.me ? t('aSigned', admin.me.name, t(admin.me.role === 'owner' ? 'roleOwner' : 'roleAdmin')) : t('aSub');
  $('#a-people').textContent = t(admin.me && admin.me.role === 'owner' ? 'aBtnPeople' : 'aBtnAccount');
  $('#a-out').textContent = t('aOut'); delete $('#a-out').dataset.armed;
  adminBanner(); adminList(); aFoot();
}
function adminOpen(id){
  if (id) openId = id;
  adminRender(); openD($('#admin'));
  if (id) { var it = document.querySelector('.a-item[data-id="' + id + '"]'); if (it) it.scrollIntoView({ block: 'start' }); }
}
function refreshItem(p){
  var it = document.querySelector('.a-item[data-id="' + p.id + '"]'); if (!it) return;
  it.outerHTML = itemH(p);
}
function refreshRow(p){
  var it = document.querySelector('.a-item[data-id="' + p.id + '"]'); if (!it) return;
  var r = it.querySelector('.a-row'); if (r) r.outerHTML = rowH(p);
}
