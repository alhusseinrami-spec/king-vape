
/* ---- list interactions */
function scrollKeep(fn){ var l = $('#a-list'), y = l.scrollTop; fn(); l.scrollTop = y; }
$('#a-list').addEventListener('click', function(e){
  var b = e.target.closest('[data-act]'); if (!b) return;
  var it = b.closest('.a-item'), p = it && wid(it.dataset.id), act = b.dataset.act; if (!p) return;
  var oi = b.closest('.a-opt') ? +b.closest('.a-opt').dataset.oi : -1;
  if (act === 'toggle') {
    var prev = openId; openId = prev === p.id ? null : p.id;
    var pp = prev && wid(prev); if (pp) refreshItem(pp);
    refreshItem(p);
    if (openId) { var n = document.querySelector('.a-item[data-id="' + p.id + '"]'); if (n) n.scrollIntoView({ block: 'nearest' }); }
  } else if (act === 'avail') {
    if (isOn(p)) p.avail = false; else delete p.avail;
    touch(p); refreshRow(p);
  } else if (act === 'optsw') {
    var o = p.options[oi]; p.off = p.off || [];
    var k = p.off.indexOf(o); if (k > -1) p.off.splice(k, 1); else p.off.push(o);
    touch(p); scrollKeep(function(){ refreshItem(p); });
  } else if (act === 'allon' || act === 'alloff') {
    p.off = act === 'alloff' ? p.options.slice() : []; touch(p); scrollKeep(function(){ refreshItem(p); });
  } else if (act === 'optdel') {
    var gone = p.options.splice(oi, 1)[0]; if (p.off) p.off = p.off.filter(function(x){ return x !== gone; });
    touch(p); scrollKeep(function(){ refreshItem(p); });
  } else if (act === 'optadd') {
    var ta = it.querySelector('[data-f="addopts"]'), add = ta.value.split(/[\n,\u060c]+/).map(function(s){ return s.trim(); }).filter(Boolean);
    add.forEach(function(s){ if (p.options.indexOf(s) < 0) p.options.push(s); });
    if (add.length) { touch(p); scrollKeep(function(){ refreshItem(p); }); }
  } else if (act === 'photo') {
    it.querySelector('input[data-f="photo"]').click();
  } else if (act === 'del') {
    if (b.dataset.armed) {
      work.splice(work.indexOf(p), 1); openId = null;
      if (p.isNew) delete dirty[p.id]; else { dirty[p.id] = true; gone[p.id] = p.u | 0; }   /* a product that was never saved needs no delete */
      scrollKeep(adminList); aFoot();
    } else {
      b.dataset.armed = '1'; b.textContent = t('aDelProd2');
      setTimeout(function(){ if (b.isConnected) { delete b.dataset.armed; b.textContent = t('aDelProd'); } }, 3000);
    }
  }
});
$('#a-list').addEventListener('input', function(e){
  var el = e.target, f = el.dataset.f; if (!f) return;
  var it = el.closest('.a-item'), p = it && wid(it.dataset.id); if (!p) return;
  if (f === 'name') { p.name = el.value; var bn = it.querySelector('.a-main b'); if (bn) bn.textContent = p.name || t('aNew'); }
  else if (f === 'nameAr') p.nameAr = el.value;
  else if (f === 'price') { var v = el.value.trim(); p.price = v === '' ? null : Math.max(0, parseFloat(v) || 0); refreshRow(p); }
  else if (f === 'specs') p.specs = el.value.split(/[,،]/).map(function(s){ return s.trim(); }).filter(Boolean);
  else if (f === 'note') p.note = el.value;
  else if (f === 'noteAr') p.noteAr = el.value;
  else if (f === 'opt') {
    var i = +el.dataset.oi, old = p.options[i];
    p.options[i] = el.value;
    if (p.off) { var k = p.off.indexOf(old); if (k > -1) p.off[k] = el.value; }
  } else return;
  touch(p);
});
$('#a-list').addEventListener('change', function(e){
  var el = e.target, f = el.dataset.f; if (!f) return;
  var it = el.closest('.a-item'), p = it && wid(it.dataset.id); if (!p) return;
  if (f === 'cat') { p.cat = el.value; var c = catOf(p.cat); p.sub = c.subs.length ? c.subs[0].id : null; touch(p); refreshItem(p); }
  else if (f === 'sub') { p.sub = el.value; touch(p); refreshRow(p); }
  else if (f === 'kind') { p.kind = el.value; touch(p); scrollKeep(function(){ refreshItem(p); }); }
  else if (f === 'photo') { var file = el.files && el.files[0]; el.value = ''; if (file) pickPhoto(p, file, it); }
  else if (f === 'opt') { scrollKeep(function(){ refreshItem(p); }); }
});
$('#a-q').addEventListener('input', function(e){ afilter.q = e.target.value; adminList(); });
$('#a-soldf').addEventListener('click', function(){ afilter.sold = !afilter.sold; this.setAttribute('aria-pressed', afilter.sold); adminList(); });
$('#a-add').addEventListener('click', function(){
  var id = 'p-' + Math.random().toString(36).slice(2, 8);
  var np = { id: id, name: '', cat: 'puffs', sub: 'Normal puffs', img: NEW_IMG, glow: [120, 110, 90], price: null, specs: [], kind: 'flavor', options: [], isNew: true };
  work.push(np); dirty[id] = true; openId = id;
  afilter.q = ''; afilter.sold = false; $('#a-q').value = ''; $('#a-soldf').setAttribute('aria-pressed', 'false');
  adminList(); aFoot();
  var nm = document.querySelector('.a-item[data-id="' + id + '"] [data-f="name"]'); if (nm) { nm.scrollIntoView({ block: 'center' }); nm.focus(); }
});
$('#a-discard').addEventListener('click', function(){ work = null; dirty = {}; gone = {}; notice = null; openId = null; adminRender(); });
$('#a-banner').addEventListener('click', function(e){
  var b = e.target.closest('[data-act]'); if (!b) return;
  if (b.dataset.act === 'dropnotice') { notice = null; adminBanner(); }
});
$('#a-close').addEventListener('click', function(){ closeD($('#admin')); });
$('#adminbtn').addEventListener('click', function(){ openAdminPanel(); });
$('#s-edit').addEventListener('click', function(){ var id = cur && cur.id; closeD($('#sheet')); if (id) openAdminPanel(id); });
window.addEventListener('beforeunload', function(e){ if (dirtyCount() && !saving) { e.preventDefault(); e.returnValue = ''; } });

/* ---- photos: shrink in the browser, upload to the server, point the product at it */
function hsv(r, g, b){
  r /= 255; g /= 255; b /= 255;
  var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0;
  if (d) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; if (h < 0) h += 1; }
  return [h, mx ? d / mx : 0, mx];
}
function glowOf(img){
  var c = document.createElement('canvas'), s = 64 / Math.max(img.naturalWidth, img.naturalHeight);
  c.width = Math.max(1, Math.round(img.naturalWidth * s)); c.height = Math.max(1, Math.round(img.naturalHeight * s));
  var x = c.getContext('2d'); x.drawImage(img, 0, 0, c.width, c.height);
  var d = x.getImageData(0, 0, c.width, c.height).data, buckets = {}, all = [0, 0, 0, 0], i;
  for (i = 0; i < d.length; i += 4) {
    if (d[i + 3] <= 200) continue;
    all[0] += d[i]; all[1] += d[i + 1]; all[2] += d[i + 2]; all[3]++;
    var q = hsv(d[i], d[i + 1], d[i + 2]);
    if (q[1] < 0.35 || q[2] < 0.35) continue;
    var key = Math.floor(q[0] * 18), w = q[1] * q[2], a = buckets[key] || (buckets[key] = [0, 0, 0, 0]);
    a[0] += d[i] * w; a[1] += d[i + 1] * w; a[2] += d[i + 2] * w; a[3] += w;
  }
  var best = null; Object.keys(buckets).forEach(function(k){ if (!best || buckets[k][3] > best[3]) best = buckets[k]; });
  if (best) return [0, 1, 2].map(function(j){ return Math.round(best[j] / best[3]); });
  if (all[3]) return [0, 1, 2].map(function(j){ return Math.round(all[j] / all[3]); });
  return [120, 90, 160];
}
function pickPhoto(p, file, it){
  var pv = it.querySelector('.a-photo .pv');
  if (!admin.upload) { toast(t('aErrOff'), true); return; }
  pv.classList.add('busy'); pv.dataset.busy = t('aUploading');
  var url = URL.createObjectURL(file), im = new Image();
  function fail(){ pv.classList.remove('busy'); URL.revokeObjectURL(url); aStatus(t('aPhotoFail'), true); }
  im.onerror = fail;
  im.onload = function(){
    var s = Math.min(1, 900 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(im.naturalWidth * s)); c.height = Math.max(1, Math.round(im.naturalHeight * s));
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    var glow = glowOf(im);
    c.toBlob(function(blob){
      if (!blob) return fail();
      admin.upload(blob).then(function(url){
        p.img = url; p.glow = glow; touch(p);
        URL.revokeObjectURL(url);
        scrollKeep(function(){ refreshItem(p); });
      }, fail);
    }, 'image/webp', 0.84);
  };
  im.src = url;
}

/* ---- what the server stores for one product (it checks everything again on its side) */
function cleanProduct(p){
  var c = { id: p.id, name: (p.name || '').trim(), cat: p.cat, sub: p.sub || null, img: p.img === NEW_IMG ? '' : p.img, glow: p.glow, price: p.price == null ? null : p.price,
    specs: (p.specs || []).slice(), kind: p.kind || 'flavor', options: [] }, seen = {};
  (p.options || []).forEach(function(o){ o = String(o).trim(); if (o && !seen[o]) { seen[o] = 1; c.options.push(o); } });
  var off = (p.off || []).map(function(o){ return String(o).trim(); }).filter(function(o){ return c.options.indexOf(o) > -1; });
  if (off.length) c.off = off;
  if (p.avail === false) c.avail = false;
  ['nameAr', 'note', 'noteAr'].forEach(function(k){ if (p[k] && String(p[k]).trim()) c[k] = String(p[k]).trim(); });
  return c;
}
