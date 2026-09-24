/* ==========================================================================
   MASTER SITE SCRIPT — PromptOps AI / OmniPrompt Marketing
   Handles: nav, reveals, counters, marquee, calculators, pricing toggle,
   lead forms, tilt, parallax, copy-to-clipboard, toasts.
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Toast ---------- */
  var toastEl = null, toastTimer = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    requestAnimationFrame(function () { toastEl.classList.add('show'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 3600);
  }

  /* ---------- Nav ---------- */
  var nav = $('.nav');
  function onScroll() {
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 12);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var menuBtn = $('.menu-btn');
  if (menuBtn) {
    menuBtn.addEventListener('click', function () {
      document.body.classList.toggle('menu-open');
    });
    $$('.mobile-menu a').forEach(function (a) {
      a.addEventListener('click', function () { document.body.classList.remove('menu-open'); });
    });
  }

  /* ---------- Reveal on scroll ---------- */
  // auto stagger children inside [data-stagger] first, so they get observed
  $$('[data-stagger]').forEach(function (parent) {
    $$(':scope > *', parent).forEach(function (child, i) {
      if (!child.hasAttribute('data-reveal')) child.setAttribute('data-reveal', '');
      child.style.setProperty('--d', (i * 80) + 'ms');
    });
  });
  var revealEls = $$('[data-reveal]');
  if ('IntersectionObserver' in window && !reduced) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- Counters ---------- */
  function animateCount(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var suffix = el.getAttribute('data-suffix') || '';
    var dur = 1300, start = null;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      var val = Math.round(target * eased);
      el.textContent = val + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var counters = $$('[data-count]');
  if ('IntersectionObserver' in window && !reduced) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { animateCount(e.target); cio.unobserve(e.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { cio.observe(el); });
  } else {
    counters.forEach(function (el) {
      el.textContent = el.getAttribute('data-count') + (el.getAttribute('data-suffix') || '');
    });
  }

  /* ---------- Marquee: duplicate track for seamless loop ---------- */
  $$('.marquee-track').forEach(function (track) {
    if (!reduced) track.innerHTML += track.innerHTML;
    $$('a, button', track).forEach(function (el) { el.tabIndex = -1; el.setAttribute('aria-hidden', 'true'); });
  });

  /* ---------- Pricing toggle ---------- */
  $$('.price-toggle').forEach(function (toggle) {
    var segs = $$('.seg', toggle);
    segs.forEach(function (seg) {
      seg.addEventListener('click', function () {
        segs.forEach(function (s) { s.classList.toggle('active', s === seg); });
        var group = seg.getAttribute('data-group');
        $$('.price-group').forEach(function (g) {
          g.hidden = g.getAttribute('data-group') !== group;
        });
      });
    });
  });

  /* ---------- Range fill helper ---------- */
  function paintRange(input) {
    var min = parseFloat(input.min), max = parseFloat(input.max), val = parseFloat(input.value);
    var pct = ((val - min) / (max - min)) * 100;
    input.style.setProperty('--fill', pct + '%');
  }
  $$('input[type=range]').forEach(function (r) {
    paintRange(r);
    r.addEventListener('input', function () { paintRange(r); });
  });

  /* ---------- Currency helpers ---------- */
  function money(n) {
    return '$' + Math.round(n).toLocaleString('en-US');
  }

  /* ---------- Calculators ---------- */
  $$('[data-calc]').forEach(function (calc) {
    var mode = calc.getAttribute('data-calc');

    function recPlan(volume) {
      if (mode === 'ops') {
        if (volume < 15000) return { name: 'Automation Sprint', price: '$3,000 one-time' };
        if (volume < 45000) return { name: 'AI Ops Build', price: '$7,500 one-time' };
        return { name: 'Enterprise Agent Platform', price: 'from $10,000' };
      }
      if (volume <= 50) return { name: 'Launch retainer', price: '$2,000/mo' };
      if (volume <= 150) return { name: 'Scale retainer', price: '$3,500/mo' };
      return { name: 'Dominate retainer', price: '$5,000/mo' };
    }

    function update() {
      if (mode === 'ops') {
        var hours = parseFloat($('#calcHours').value);
        var rate = parseFloat($('#calcRate').value);
        var annual = hours * 52 * rate;
        var savings = annual * 0.7;
        var hoursBack = hours * 52 * 0.7;
        $('#calcHoursOut').textContent = hours + ' h';
        $('#calcRateOut').textContent = '$' + rate + '/h';
        $('#calcBig').textContent = money(savings);
        $('#calcSub').textContent = 'estimated annual cost of work an agent can absorb';
        $('#calcCurrent').textContent = money(annual);
        $('#calcHoursBack').textContent = Math.round(hoursBack).toLocaleString('en-US') + ' h';
        var rec = recPlan(savings);
        $('#calcRec').innerHTML = 'Recommended starting point: <strong>' + rec.name + '</strong> · ' + rec.price + ' — then keep it tuned with the <strong>$500/mo Prompt-as-a-Service</strong> retainer.';
      } else {
        var pieces = parseFloat($('#calcPieces').value);
        var cost = parseFloat($('#calcCost').value);
        var currentAnnual = pieces * cost * 12;
        var plan = recPlan(pieces);
        var retainerMonth = pieces <= 50 ? 2000 : (pieces <= 150 ? 3500 : 5000);
        var runAnnual = retainerMonth * 12 + pieces * 12 * 6; // retainer + est. API usage
        var savings = Math.max(currentAnnual - runAnnual, 0);
        $('#calcPiecesOut').textContent = pieces + ' /mo';
        $('#calcCostOut').textContent = '$' + cost;
        $('#calcBig').textContent = money(savings);
        $('#calcSub').textContent = 'projected annual savings vs. your current cost per asset';
        $('#calcCurrent').textContent = money(currentAnnual);
        $('#calcRun').textContent = money(runAnnual);
        $('#calcRec').innerHTML = 'Recommended: <strong>' + plan.name + '</strong> · ' + plan.price + ' — includes pipeline ops, tuning and reporting.';
      }
    }

    $$('input[type=range]', calc).forEach(function (r) { r.addEventListener('input', update); });
    update();
  });

  /* ---------- Lead forms ---------- */
  $$('form[data-lead]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = form.getAttribute('data-toast') || 'Thanks — we\u2019ll be in touch within one business day.';
      toast(msg);
      form.reset();
      $$('input[type=range]', form).forEach(paintRange);
    });
  });

  /* ---------- Copy to clipboard ---------- */
  $$('[data-copy]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      var text = el.getAttribute('data-copy');
      function done() { toast('Copied: ' + text); }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, done);
      } else {
        var ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); } catch (err) { /* noop */ }
        document.body.removeChild(ta); done();
      }
    });
  });

  /* ---------- Parallax blobs ---------- */
  if (!reduced && window.matchMedia('(pointer:fine)').matches) {
    var blobs = $$('.blob[data-parallax]');
    if (blobs.length) {
      var mx = 0, my = 0, raf = null;
      window.addEventListener('mousemove', function (e) {
        mx = (e.clientX / window.innerWidth - 0.5) * 2;
        my = (e.clientY / window.innerHeight - 0.5) * 2;
        if (!raf) raf = requestAnimationFrame(function () {
          raf = null;
          blobs.forEach(function (b) {
            var f = parseFloat(b.getAttribute('data-parallax')) || 14;
            b.style.marginLeft = (mx * f) + 'px';
            b.style.marginTop = (my * f) + 'px';
          });
        });
      }, { passive: true });
    }
  }

  /* ---------- Subtle tilt ---------- */
  if (!reduced && window.matchMedia('(pointer:fine)').matches) {
    $$('.tilt').forEach(function (el) {
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        var rx = ((e.clientY - r.top) / r.height - 0.5) * -5;
        var ry = ((e.clientX - r.left) / r.width - 0.5) * 5;
        el.style.transform = 'perspective(900px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) translateY(-3px)';
      });
      el.addEventListener('mouseleave', function () { el.style.transform = ''; });
    });
  }

  /* ---------- Year ---------- */
  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

})();