// Card deck: one card at a time, swipe left/right. Built on native scroll-snap, so it can never go past the first or last card
// (nothing to the left of card 1, nothing to the right of the last card) and vertical page scrolling keeps working.
//   var d = Deck.create({ slides: [node, ...], index: 0, onChange: function (i) {} });  parent.appendChild(d.el);  d.mount();
//   d.go(i) moves to card i; d.index() is the card now showing; d.count is the number of cards.
(function () {
  'use strict';
  var h = U.h;
  function create(o) {
    var slides = o.slides || [], idx = Math.max(0, Math.min(slides.length - 1, o.index || 0)), raf = 0, locked = false;
    var track = h('div', { class: 'deck-track', tabindex: '-1' });
    slides.forEach(function (s) { track.appendChild(h('div', { class: 'deck-slide' }, s)); });
    var el = h('div', { class: 'deck' }, track);
    function left(i) { var c = track.children[i]; return c ? c.offsetLeft - track.children[0].offsetLeft : 0; }
    function nearest() {
      var best = 0, dist = 1e9, x = track.scrollLeft;
      for (var i = 0; i < track.children.length; i++) { var d = Math.abs(left(i) - x); if (d < dist) { dist = d; best = i; } }
      return best;
    }
    track.addEventListener('scroll', function () {
      if (raf) { return; }
      raf = requestAnimationFrame(function () {
        raf = 0; if (locked) { return; }
        var i = nearest(); if (i !== idx) { idx = i; if (o.onChange) { o.onChange(i); } }
      });
    }, { passive: true });
    var api = {
      el: el, count: slides.length,
      index: function () { return idx; },
      go: function (i, instant) {
        i = Math.max(0, Math.min(slides.length - 1, i)); var changed = i !== idx; idx = i;
        track.scrollTo({ left: left(i), behavior: 'auto' });
        if (changed && o.onChange) { o.onChange(i); }
      },
      mount: function () { locked = true; var go = function () { track.scrollLeft = left(idx); setTimeout(function () { locked = false; }, 60); }; requestAnimationFrame(go); setTimeout(go, 120); }
    };
    return api;
  }
  window.Deck = { create: create };
})();
