(function initTargetPopupModule() {
  function renderTimeline(container, workflow, stepConfig) {
    container.innerHTML = '';
    let completed = 0;
    for (let i = 1; i <= 7; i += 1) {
      if (workflow[`q${i}_is_valid`]) completed += 1;
    }
    const current = Math.min(completed + 1, 7);

    for (let index = 1; index <= 7; index += 1) {
      const cfg = stepConfig[index - 1];
      const answer = (workflow[`q${index}_answer`] || '').trim();
      const valid = Boolean(workflow[`q${index}_is_valid`]);
      const isCurrent = index === current && !valid;

      const item = document.createElement('div');
      item.className = 'timeline-item';
      item.classList.toggle('is-valid', valid);
      item.classList.toggle('is-current', isCurrent);
      item.classList.toggle('is-filled', Boolean(answer));
      item.setAttribute('draggable', answer ? 'true' : 'false');
      item.dataset.dragMessage = `${cfg.label} (Q${index}): ${answer || 'Noch keine Antwort vorhanden'}`;
      item.innerHTML = `
        <div class="timeline-label">${cfg.label}</div>
        <div class="timeline-answer">${answer || 'Noch keine Antwort vorhanden'}</div>
      `;
      container.appendChild(item);
    }
  }

  window.TargetPopup = {
    renderTimeline,
  };
})();
