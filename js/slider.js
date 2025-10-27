(function () {
  var slider = document.getElementById('my-slider');
  if (!slider) return;

  var slidesEl = slider.querySelector('.slides');
  var slides = slider.querySelectorAll('.slide');
  var prevBtn = slider.querySelector('.prev');
  var nextBtn = slider.querySelector('.next');
  var dotsWrap = slider.querySelector('.dots');

  var index = 0;
  var total = slides.length;
  var startX = 0;
  var deltaX = 0;
  var threshold = 40; // px swipe to change

  // build dots
  for (var i = 0; i < total; i++) {
    var d = document.createElement('button');
    d.type = 'button';
    d.className = 'dot' + (i === 0 ? ' active' : '');
    d.setAttribute('data-index', i);
    d.addEventListener('click', function (e) {
      goTo(+e.currentTarget.getAttribute('data-index'));
    });
    dotsWrap.appendChild(d);
  }

  function update() {
    slidesEl.style.transform = 'translateX(' + (-index * 100) + '%)';
    // update dots
    var dots = dotsWrap.querySelectorAll('.dot');
    for (var i = 0; i < dots.length; i++) {
      dots[i].classList.toggle('active', i === index);
    }
    // disable/enable nav
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === total - 1;
  }

  function goTo(i) {
    index = Math.max(0, Math.min(i, total - 1));
    update();
  }

  prevBtn.addEventListener('click', function () { goTo(index - 1); });
  nextBtn.addEventListener('click', function () { goTo(index + 1); });

  // touch support for mobile (simple)
  slidesEl.addEventListener('touchstart', function (e) {
    startX = e.touches[0].clientX;
    deltaX = 0;
    slidesEl.style.transition = 'none';
  }, { passive: true });

  slidesEl.addEventListener('touchmove', function (e) {
    deltaX = e.touches[0].clientX - startX;
    var percent = (deltaX / slider.clientWidth) * 100;
    slidesEl.style.transform = 'translateX(' + ((-index * 100) + percent) + '%)';
  }, { passive: true });

  slidesEl.addEventListener('touchend', function () {
    slidesEl.style.transition = ''; // restore
    if (Math.abs(deltaX) > threshold) {
      if (deltaX < 0) goTo(index + 1);
      else goTo(index - 1);
    } else {
      update(); // snap back
    }
  });

  // keyboard support
  slider.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') goTo(index - 1);
    if (e.key === 'ArrowRight') goTo(index + 1);
  });

  // init
  update();
})();