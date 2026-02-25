(function() {
  var cards = document.querySelectorAll('.card');
  if (!cards.length) return;

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { rootMargin: '0px 0px -40px 0px', threshold: 0.1 });

  cards.forEach(function(card) {
    observer.observe(card);
  });
})();
