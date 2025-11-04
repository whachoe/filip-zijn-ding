(function(){
  const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
  const panels = Array.from(document.querySelectorAll('[role="tabpanel"]'));

  function activateTab(tab){
    // deactivate others
    tabs.forEach(t=>{
      t.setAttribute('aria-selected','false');
      t.setAttribute('tabindex','-1');
    });
    panels.forEach(p=>{ p.hidden = true; p.classList.add('hidden'); });

    // activate chosen
    tab.setAttribute('aria-selected','true');
    tab.setAttribute('tabindex','0');
    const id = tab.getAttribute('aria-controls');
    const panel = document.getElementById(id);
    if(panel){ panel.hidden = false; panel.classList.remove('hidden'); }
    tab.focus();
  }

  tabs.forEach((tab, idx)=>{
    tab.addEventListener('click', ()=> activateTab(tab));

    // Disabled keyboard navigation for now so we can get the slider working properly. slider uses the same keys.
    // tab.addEventListener('keydown', (e)=>{
    //   const key = e.key;
    //   let newIdx = null;
    //   if(key === 'ArrowRight' || key === 'ArrowDown') newIdx = (idx + 1) % tabs.length;
    //   if(key === 'ArrowLeft' || key === 'ArrowUp') newIdx = (idx - 1 + tabs.length) % tabs.length;
    //   if(key === 'Home') newIdx = 0;
    //   if(key === 'End') newIdx = tabs.length -1;
    //   if(newIdx !== null){
    //     e.preventDefault();
    //     activateTab(tabs[newIdx]);
    //   }
    //   if(key === 'Enter' || key === ' '){
    //     e.preventDefault();
    //     activateTab(tab);
    //   }
    // });    
  });

  // Make the assessment button activate the assessment tab
    document.getElementById('button-assessment').addEventListener('click', () => document.getElementById('tab-assessment').click());

  // Fill in the contact info form if data exists in localStorage
  const contactInfo = localStorage.getItem('contactInfo');
  if(contactInfo) {
      const info = JSON.parse(contactInfo);
      console.log("Loading contactinfo from localstorage", info);
      document.getElementById('full-name').value = info.fullName || '';
      document.getElementById('email-address').value = info.email || '';
      document.getElementById('location').value = info.location || '';

      // Check if all 3 fields in the form are filled in and if so: enable the "New Assessment" tab
      save_settings();
  }

  // set current year in footer
  const y = new Date().getFullYear();
  const yearEl = document.getElementById('year');
  if(yearEl) yearEl.textContent = y;
})();

function save_settings() {
    // Check if all 3 fields in the form are filled in and if so: enable the "New Assessment" tab
    const fullName = document.getElementById('full-name').value.trim();
    const email = document.getElementById('email-address').value.trim();
    const location = document.getElementById('location').value;

    const assessmentTab = document.getElementById('tab-assessment');
    const assessmentButton = document.getElementById('button-assessment');
    assessmentButton.removeAttribute('hidden');

    // Save contact info
    localStorage.setItem('contactInfo', JSON.stringify({
        fullName: fullName,
        email: email,
        location: location
    }));

    if(fullName !== '' && email !== '' && location !== '') {
        assessmentTab.removeAttribute('disabled');
        u(assessmentButton).removeClass('hidden');
        assessmentButton.removeAttribute('disabled');
    } else {
        assessmentTab.setAttribute('disabled', 'disabled');
        u(assessmentButton).addClass('hidden');
    }
}

function callNTimes(func, num, delay) {
    if (!num) return;
    func();
    setTimeout(function() { callNTimes(func, num - 1, delay); }, delay);
}

function generateRandomDate(from, to) {
  return new Date(
    from.getTime() +
      Math.random() * (to.getTime() - from.getTime()),
  );
}