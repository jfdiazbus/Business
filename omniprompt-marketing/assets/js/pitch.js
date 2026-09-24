/* ==========================================================================
   MASTER PITCH ENGINE — PromptOps AI / OmniPrompt Marketing
   Keyboard / dots / buttons / swipe navigation, speaker notes, help overlay,
   progress bar, hash routing, fullscreen, PDF-export friendly.
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var deck = $('#deck');
  if (!deck) return;
  var slides = $$('.slide', deck);
  var total = slides.length;
  var current = 0;

  /* ---------- Build dots ---------- */
  var dotsWrap = $('#dots');
  var dots = [];
  if (dotsWrap) {
    slides.forEach(function (s, i) {
      var d = document.createElement('button');
      d.className = 'dot-seg';
      d.type = 'button';
      d.setAttribute('aria-label', 'Go to slide ' + (i + 1) + (s.getAttribute('data-title') ? ': ' + s.getAttribute('data-title') : ''));
      d.title = (i + 1) + '. ' + (s.getAttribute('data-title') || 'Slide');
      d.addEventListener('click', function () { go(i); });
      dotsWrap.appendChild(d);
      dots.push(d);
    });
  }

  /* ---------- Notes ---------- */
  var notesPanel = $('#notesPanel');
  var notesContent = $('#notesContent');
  var notesBtn = $('#notesBtn');
  function updateNotes() {
    if (!notesContent) return;
    var aside = $('aside.notes', slides[current]);
    notesContent.innerHTML = aside ? aside.innerHTML : '<p class="muted">No speaker notes for this slide.</p>';
  }
  if (notesBtn) {
    notesBtn.addEventListener('click', function () {
      var open = document.body.classList.toggle('notes-open');
      notesBtn.classList.toggle('on', open);
      if (open) updateNotes();
    });
  }

  /* ---------- Core navigation ---------- */
  var bar = $('#progressBar');
  var curEl = $('#cur');
  var totalEl = $('#total');
  if (totalEl) totalEl.textContent = total;

  function go(n, opts) {
    opts = opts || {};
    if (n < 0 || n >= total || (n === current && !opts.force)) return;
    var dir = n > current ? 1 : -1;
    var prevSlide = slides[current];
    var nextSlide = slides[n];

    slides.forEach(function (s) { s.classList.remove('active'); });
    nextSlide.classList.toggle('rewind', dir === -1);
    // force reflow so the entry transition always replays
    void nextSlide.offsetWidth;
    nextSlide.classList.add('active');
    if (prevSlide && prevSlide !== nextSlide && dir === -1) prevSlide.classList.add('rewind');
    if (prevSlide && prevSlide !== nextSlide && dir === 1) prevSlide.classList.remove('rewind');

    nextSlide.scrollTop = 0;
    current = n;

    if (bar) bar.style.width = (((n + 1) / total) * 100).toFixed(2) + '%';
    if (curEl) curEl.textContent = n + 1;
    dots.forEach(function (d, i) { d.classList.toggle('active', i === n); });
    if (location.protocol !== 'file:') {
      try {
        history.replaceState(null, '', '#s' + (n + 1));
      } catch (err) { /* history API unavailable — deep links still work on load */ }
    }
    if (document.body.classList.contains('notes-open')) updateNotes();
  }
  window.__deckGo = go;

  var prevBtn = $('#prevBtn');
  var nextBtn = $('#nextBtn');
  if (prevBtn) prevBtn.addEventListener('click', function () { go(current - 1); });
  if (nextBtn) nextBtn.addEventListener('click', function () { go(current + 1); });

  /* ---------- Help overlay ---------- */
  var help = $('#helpOverlay');
  var helpBtn = $('#helpBtn');
  function toggleHelp(force) {
    if (!help) return;
    var show = typeof force === 'boolean' ? force : help.hidden;
    help.hidden = !show;
    if (helpBtn) helpBtn.classList.toggle('on', show);
  }
  if (helpBtn) helpBtn.addEventListener('click', function () { toggleHelp(); });
  if (help) {
    help.addEventListener('click', function (e) {
      if (e.target === help) toggleHelp(false);
    });
    var closeBtn = $('.help-close button', help);
    if (closeBtn) closeBtn.addEventListener('click', function () { toggleHelp(false); });
  }

  /* ---------- Fullscreen ---------- */
  var fsBtn = $('#fsBtn');
  function fsActive() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  if (fsBtn) {
    fsBtn.addEventListener('click', function () {
      if (fsActive()) {
        (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      } else {
        var el = document.documentElement;
        var req = el.requestFullscreen || el.webkitRequestFullscreen;
        if (req) req.call(el);
      }
    });
    document.addEventListener('fullscreenchange', function () {
      fsBtn.textContent = fsActive() ? '⤢ Exit' : '⛶ Present';
      fsBtn.classList.toggle('on', fsActive());
    });
  }

  /* ---------- Keyboard ---------- */
  document.addEventListener('keydown', function (e) {
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ':
        e.preventDefault(); go(current + 1); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp':
        e.preventDefault(); go(current - 1); break;
      case 'Home': e.preventDefault(); go(0); break;
      case 'End': e.preventDefault(); go(total - 1); break;
      case 'n': case 'N':
        if (notesBtn) notesBtn.click(); break;
      case 'f': case 'F':
        if (fsBtn) fsBtn.click(); break;
      case '?': toggleHelp(); break;
      case 'Escape':
        toggleHelp(false);
        document.body.classList.remove('notes-open');
        if (notesBtn) notesBtn.classList.remove('on');
        break;
      default: break;
    }
  });

  /* ---------- Touch swipe ---------- */
  var tx = 0, ty = 0, tracking = false;
  deck.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return;
    tx = e.touches[0].clientX; ty = e.touches[0].clientY; tracking = true;
  }, { passive: true });
  deck.addEventListener('touchend', function (e) {
    if (!tracking) return;
    tracking = false;
    var dx = e.changedTouches[0].clientX - tx;
    var dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      go(current + (dx < 0 ? 1 : -1));
    }
  }, { passive: true });

  /* ---------- Boot ---------- */
  var m = /^#s(\d+)$/.exec(window.location.hash);
  var start = m ? Math.min(Math.max(parseInt(m[1], 10) - 1, 0), total - 1) : 0;
  go(start, { force: true });

})();