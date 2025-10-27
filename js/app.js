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

    tab.addEventListener('keydown', (e)=>{
      const key = e.key;
      let newIdx = null;
      if(key === 'ArrowRight' || key === 'ArrowDown') newIdx = (idx + 1) % tabs.length;
      if(key === 'ArrowLeft' || key === 'ArrowUp') newIdx = (idx - 1 + tabs.length) % tabs.length;
      if(key === 'Home') newIdx = 0;
      if(key === 'End') newIdx = tabs.length -1;
      if(newIdx !== null){
        e.preventDefault();
        activateTab(tabs[newIdx]);
      }
      if(key === 'Enter' || key === ' '){
        e.preventDefault();
        activateTab(tab);
      }
    });

    document.getElementById('button-assessment').addEventListener('click', () => document.getElementById('tab-assessment').click());
  });

  // set current year in footer
  const y = new Date().getFullYear();
  const yearEl = document.getElementById('year');
  if(yearEl) yearEl.textContent = y;


})();

function validate_settings() {
    // Check if all 3 fields in the form are filled in and if so: enable the "New Assessment" tab
    const fullName = document.getElementById('full-name').value.trim();
    const email = document.getElementById('email-address').value.trim();
    const assessmentType = document.getElementById('location').value;

    const assessmentTab = document.getElementById('tab-assessment');
    const assessmentButton = document.getElementById('button-assessment');
    assessmentButton.removeAttribute('hidden');

    if(fullName !== '' && email !== '' && assessmentType !== '') {
        assessmentTab.removeAttribute('disabled');
        u(assessmentButton).removeClass('hidden');
        assessmentButton.removeAttribute('disabled');
    } else {
        assessmentTab.setAttribute('disabled', 'disabled');
        u(assessmentButton).addClass('hidden');
    }
}