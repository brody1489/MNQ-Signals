(function() {
  var cards = document.querySelectorAll('.card');
  if (!cards.length) return;

  // Same threshold in and out: cards fade in when they enter view, fade out when they leave (scroll up)
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      } else {
        entry.target.classList.remove('visible');
      }
    });
  }, {
    root: null,
    rootMargin: '0px',
    threshold: [0, 0.1]
  });

  cards.forEach(function(card) {
    observer.observe(card);
  });
})();
