// Sync layer — Firebase (Google sign-in + Firestore).
// localStorage stays the working copy (offline, place-keeping unchanged).
// When signed in: pull the cloud copy, merge it with this device's data,
// push the merged result back, and keep pushing as data changes.
(function () {
  var firebaseConfig = {
    apiKey: "AIzaSyBzbTvEvQqGYWPMu8EPQr4SPk_rWZhvsEA",
    authDomain: "exams-sync.firebaseapp.com",
    projectId: "exams-sync",
    storageBucket: "exams-sync.firebasestorage.app",
    messagingSenderId: "534075148283",
    appId: "1:534075148283:web:8d7d1110bbd561dcc0ed5e"
  };

  var EXACT_KEYS = ['examHistory', 'examProgress', 'notepadNotes', 'notepadCleared', 'qualityNotes', 'qualityCleared'];
  var PREFIXES = ['workoutNotes:', 'ladderDates:', 'ladderAdded:'];

  // ---- sync bar UI ----
  var bar = document.createElement('div');
  bar.className = 'sync-bar';
  bar.innerHTML = '<span id="sync-status">Sync: loading…</span><button type="button" id="sync-btn" hidden></button>';
  document.body.insertBefore(bar, document.body.firstChild);
  var statusEl = document.getElementById('sync-status');
  var btn = document.getElementById('sync-btn');
  function setStatus(t) { statusEl.textContent = t; }

  var SDK = [
    'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js'
  ];
  function loadSdk(i, done) {
    if (i >= SDK.length) return done();
    var s = document.createElement('script');
    s.src = SDK[i];
    s.onload = function () { loadSdk(i + 1, done); };
    s.onerror = function () { setStatus('Sync unavailable (offline)'); };
    document.head.appendChild(s);
  }

  var auth = null, db = null, uid = null, applying = false, pushTimer = null;
  var origSet = localStorage.setItem.bind(localStorage);

  function isSyncKey(k) {
    if (EXACT_KEYS.indexOf(k) !== -1) return true;
    return PREFIXES.some(function (p) { return k.indexOf(p) === 0; });
  }
  function collectState() {
    var st = {};
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (!isSyncKey(k)) continue;
      try { st[k] = JSON.parse(localStorage.getItem(k)); } catch (e) { st[k] = localStorage.getItem(k); }
    }
    return st;
  }
  function mergeHistory(local, remote) {
    var out = {};
    var keys = {};
    Object.keys(local || {}).forEach(function (k) { keys[k] = 1; });
    Object.keys(remote || {}).forEach(function (k) { keys[k] = 1; });
    Object.keys(keys).forEach(function (k) {
      var byTs = {};
      (local && local[k] || []).forEach(function (a) { byTs[a.ts] = a; });
      (remote && remote[k] || []).forEach(function (a) { if (!byTs[a.ts]) byTs[a.ts] = a; });
      out[k] = Object.keys(byTs).map(function (t) { return byTs[t]; })
        .sort(function (a, b) { return a.ts < b.ts ? 1 : -1; }).slice(0, 20);
    });
    return out;
  }
  function mergeProgress(local, remote) {
    var out = {};
    Object.keys(remote || {}).forEach(function (k) { out[k] = remote[k]; });
    Object.keys(local || {}).forEach(function (k) {
      if (!out[k] || (local[k].ts || 0) >= (out[k].ts || 0)) out[k] = local[k];
    });
    return out;
  }
  function mergeCleared(local, remote) {
    var out = {};
    Object.keys(remote || {}).forEach(function (k) { out[k] = remote[k]; });
    Object.keys(local || {}).forEach(function (k) {
      var L = local[k], R = out[k];
      if (!R) { out[k] = L; return; }
      if ((L.ts || '') > (R.ts || '')) out[k] = L;
      else if (L.ts === R.ts) {
        var qs = (R.questions || []).slice();
        (L.questions || []).forEach(function (q) { if (qs.indexOf(q) === -1) qs.push(q); });
        out[k] = { ts: R.ts, questions: qs };
      }
    });
    return out;
  }
  function mergeGeneric(local, remote) { // local wins on conflict, remote fills gaps
    var out = {};
    Object.keys(remote || {}).forEach(function (k) { out[k] = remote[k]; });
    Object.keys(local || {}).forEach(function (k) { out[k] = local[k]; });
    return out;
  }
  function mergeState(local, remote) {
    var out = {};
    var keys = {};
    Object.keys(local || {}).forEach(function (k) { keys[k] = 1; });
    Object.keys(remote || {}).forEach(function (k) { keys[k] = 1; });
    Object.keys(keys).forEach(function (k) {
      var L = local ? local[k] : undefined, R = remote ? remote[k] : undefined;
      if (L === undefined) { out[k] = R; return; }
      if (R === undefined) { out[k] = L; return; }
      if (k === 'examHistory') out[k] = mergeHistory(L, R);
      else if (k === 'examProgress') out[k] = mergeProgress(L, R);
      else if (k === 'notepadCleared' || k === 'qualityCleared') out[k] = mergeCleared(L, R);
      else out[k] = mergeGeneric(L, R);
    });
    return out;
  }
  function applyState(st) {
    applying = true;
    Object.keys(st).forEach(function (k) { origSet(k, JSON.stringify(st[k])); });
    applying = false;
  }
  function push() {
    if (!uid || applying) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      setStatus('Sync: saving…');
      db.collection('users').doc(uid).set({ state: collectState(), updatedAt: Date.now() })
        .then(function () { setStatus('Synced ✓'); })
        .catch(function () { setStatus('Sync: save failed, will retry'); });
    }, 1200);
  }
  localStorage.setItem = function (k, v) {
    origSet(k, v);
    if (isSyncKey(k)) push();
  };
  window.addEventListener('pagehide', function () {
    if (!uid) return;
    clearTimeout(pushTimer);
    try { db.collection('users').doc(uid).set({ state: collectState(), updatedAt: Date.now() }); } catch (e) {}
  });

  loadSdk(0, function () {
    try {
      firebase.initializeApp(firebaseConfig);
      auth = firebase.auth();
      db = firebase.firestore();
    } catch (e) { setStatus('Sync unavailable'); return; }
    auth.onAuthStateChanged(function (user) {
      if (!user) {
        uid = null;
        setStatus('Sync: off — your data is on this device only');
        btn.hidden = false; btn.textContent = 'Sign in to sync';
        btn.onclick = function () {
          var prov = new firebase.auth.GoogleAuthProvider();
          auth.signInWithPopup(prov).catch(function () { auth.signInWithRedirect(prov); });
        };
        return;
      }
      uid = user.uid;
      setStatus('Sync: loading your data…');
      btn.hidden = false; btn.textContent = 'Sign out';
      btn.onclick = function () { auth.signOut(); };
      db.collection('users').doc(uid).get().then(function (snap) {
        var remote = snap.exists ? (snap.data().state || {}) : {};
        var before = JSON.stringify(collectState());
        var merged = mergeState(collectState(), remote);
        applyState(merged);
        setStatus('Synced ✓ · ' + (user.email || 'signed in'));
        push();
        // Pages render from localStorage at load; refresh once if the merge
        // actually changed this device's data (merges are idempotent, so the
        // reload lands on equal data and does not loop).
        if (JSON.stringify(merged) !== before) setTimeout(function () { location.reload(); }, 350);
      }).catch(function () { setStatus('Sync: could not load cloud data'); });
    });
  });
})();
