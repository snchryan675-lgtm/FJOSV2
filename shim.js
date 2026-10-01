// Browser replacement for the Electron preload: window.fjos on top of IndexedDB
(function () {
  window.px = function (u) { return /^https?:\/\//i.test(u) ? '/proxy?u=' + encodeURIComponent(u) : u; };
  var DB = new Promise(function (ok, no) {
    var q = indexedDB.open('fjos-vfs', 1);
    q.onupgradeneeded = function () { q.result.createObjectStore('f', { keyPath: 'p' }); };
    q.onsuccess = function () { ok(q.result); }; q.onerror = function () { no(q.error); };
  });
  var run = function (m, fn) { return DB.then(function (d) { return new Promise(function (ok, no) {
    var t = d.transaction('f', m), s = t.objectStore('f'), out; try { out = fn(s); } catch (e) { return no(e); }
    t.oncomplete = function () { ok(out && out.result !== undefined ? out.result : out); }; t.onerror = function () { no(t.error); }; }); }); };
  var norm = function (p) { return String(p || '').replace(/\\/g, '/').split('/').filter(function (x) { return x && x !== '.' && x !== '..'; }).join('/'); };
  var par = function (p) { return p.slice(0, Math.max(0, p.lastIndexOf('/'))); };
  var TYPES = { html: 'text/html', htm: 'text/html', js: 'text/javascript', css: 'text/css', json: 'application/json', txt: 'text/plain', md: 'text/plain' };
  var typeOf = function (p) { return TYPES[(p.split('.').pop() || '').toLowerCase()] || 'application/octet-stream'; };
  var put = function (s, p, blob) { for (var d = par(p); d; d = par(d)) s.put({ p: d, dir: true, size: 0 }); s.put({ p: p, dir: false, blob: blob, size: blob.size }); };
  var all = function () { return run('readonly', function (s) { return s.getAll(); }); };
  var get = function (p) { return run('readonly', function (s) { return s.get(p); }); };
  ['Programs', 'Games', 'Documents', 'Downloads'].forEach(function (d) { run('readwrite', function (s) { s.put({ p: d, dir: true, size: 0 }); }); });
  var pick = function (kind, multi) { return new Promise(function (ok) {
    var i = document.createElement('input'); i.type = 'file'; i.multiple = !!multi;
    if (kind === 'folder') i.webkitdirectory = true; if (kind === 'image') i.accept = 'image/*'; if (kind === 'video') i.accept = 'video/*';
    i.onchange = function () { ok([].slice.call(i.files)); }; i.oncancel = function () { ok([]); }; i.click(); }); };
  var url = function (rel) { return get(norm(rel)).then(function (r) { if (!r || r.dir) throw new Error('Not a file'); var b = r.blob; if (!b.type) b = new Blob([b], { type: typeOf(r.p) }); return URL.createObjectURL(b); }); };

  window.fjos = {
    list: function (rel) { rel = norm(rel); return all().then(function (a) { return a.filter(function (r) { return r.p !== rel && par(r.p) === rel && (rel === '' ? r.p.indexOf('/') < 0 : true); })
      .map(function (r) { return { name: r.p.split('/').pop(), dir: !!r.dir, size: r.size || 0 }; }).sort(function (x, y) { return (y.dir - x.dir) || x.name.localeCompare(y.name); }); }); },
    mkdir: function (rel) { rel = norm(rel); return run('readwrite', function (s) { for (var d = rel; d; d = par(d)) s.put({ p: d, dir: true, size: 0 }); }).then(function () { return true; }); },
    del: function (rel) { rel = norm(rel); return all().then(function (a) { return run('readwrite', function (s) { a.forEach(function (r) { if (r.p === rel || r.p.indexOf(rel + '/') === 0) s.delete(r.p); }); }); }).then(function () { return true; }); },
    rename: function (a, b) { a = norm(a); b = norm(b); return all().then(function (rs) { return run('readwrite', function (s) { rs.forEach(function (r) { if (r.p === a || r.p.indexOf(a + '/') === 0) { s.delete(r.p); r.p = b + r.p.slice(a.length); if (r.p === b || !r.dir) { for (var d = par(r.p); d; d = par(d)) s.put({ p: d, dir: true, size: 0 }); } s.put(r); } }); }); }).then(function () { return true; }); },
    import: function (rel, kind) { rel = norm(rel); return pick(kind, true).then(function (fs) { if (!fs.length) return 0;
      return run('readwrite', function (s) { fs.forEach(function (f) { put(s, norm((rel ? rel + '/' : '') + (f.webkitRelativePath || f.name)), f); }); }).then(function () { return fs.length; }); }); },
    read: function (rel) { return get(norm(rel)).then(function (r) { if (!r || r.dir) throw new Error('Not a file'); if (r.size > 5 * 1048576) throw new Error('File is too large to edit'); return r.blob.text(); }); },
    write: function (rel, text) { rel = norm(rel); return run('readwrite', function (s) { put(s, rel, new Blob([String(text)], { type: typeOf(rel) })); }).then(function () { return true; }); },
    fileUrl: url,
    liveStart: function (rel) { return url(rel).then(function (u) { return { url: u }; }); }, liveStop: function () { return Promise.resolve(true); },
    open: function (rel) { return url(rel).then(function (u) { var a = document.createElement('a'); a.href = u; a.download = norm(rel).split('/').pop(); a.click(); return 'opened'; }); },
    dosBundle: function (rel) { rel = norm(rel); return get(rel).then(function (r) { if (r && /\.(jsdos|zip)$/i.test(rel)) return r.blob.arrayBuffer().then(function (b) { return { ok: true, data: new Uint8Array(b) }; }); return { ok: false, reason: 'windows' }; }); },
    wallImport: function (kind) { return pick(kind).then(function (fs) { var f = fs[0]; if (!f) return null; if (kind === 'video') return URL.createObjectURL(f);
      return new Promise(function (ok) { var r = new FileReader(); r.onload = function () { ok(r.result); }; r.readAsDataURL(f); }); }); },
    setProxy: function () { return Promise.resolve(true); }, clearData: function () { return Promise.resolve(true); }, reveal: function () { return Promise.resolve(true); },
    onDownload: function () {}, robloxStatus: function () { return Promise.resolve({ player: false, store: false }); }, steamStatus: function () { return Promise.resolve({ dir: null, games: [] }); }
  };
})();
