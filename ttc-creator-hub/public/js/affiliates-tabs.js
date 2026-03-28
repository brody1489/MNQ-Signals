(function () {
  var tabs = document.querySelectorAll('.seg-toggle [role="tab"]');
  var panels = document.querySelectorAll('.panel[role="tabpanel"]');

  function activate(id) {
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-panel') === id;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    panels.forEach(function (p) {
      var on = p.id === id;
      p.classList.toggle('is-active', on);
      p.hidden = !on;
    });
    if (id === 'panel-become' && location.hash !== '#become') {
      history.replaceState(null, '', '#become');
    }
    if (id === 'panel-partners') {
      history.replaceState(null, '', location.pathname);
    }
  }

  tabs.forEach(function (btn) {
    btn.addEventListener('click', function () {
      activate(btn.getAttribute('data-panel'));
    });
  });

  if (location.hash === '#become') {
    activate('panel-become');
  }
})();
