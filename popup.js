document.addEventListener('DOMContentLoaded', () => {
  const selectorsInput = document.getElementById('selectors');
  const delayInput = document.getElementById('delay');
  const infiniteCheckbox = document.getElementById('infinite');
  const repeatsInput = document.getElementById('repeats');
  const smartSelectorCheckbox = document.getElementById('smart-selector');
  const startBtn = document.getElementById('start');
  const stopBtn = document.getElementById('stop');
  const statusDiv = document.getElementById('status');

  // Toggle Repeats input visibility
  infiniteCheckbox.addEventListener('change', () => {
    repeatsInput.disabled = infiniteCheckbox.checked;
    repeatsInput.parentElement.style.opacity = infiniteCheckbox.checked ? '0.5' : '1';
  });

  // Load saved settings
  chrome.storage.local.get(['selectors', 'delay', 'infinite', 'repeats', 'smartSelector'], (result) => {
    if (result.selectors) selectorsInput.value = result.selectors;
    if (result.delay) delayInput.value = result.delay;
    if (result.infinite !== undefined) {
      infiniteCheckbox.checked = result.infinite;
      repeatsInput.disabled = result.infinite;
      repeatsInput.parentElement.style.opacity = result.infinite ? '0.5' : '1';
    }
    if (result.repeats) repeatsInput.value = result.repeats;
    if (result.smartSelector !== undefined) smartSelectorCheckbox.checked = result.smartSelector;
  });

  // Pick Element button handler
  const pickBtn = document.getElementById('pick');
  if (pickBtn) {
    pickBtn.addEventListener('click', async () => {
      const isSmart = smartSelectorCheckbox.checked;

      // Save picking preference
      chrome.storage.local.set({ smartSelector: isSmart });

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        statusDiv.textContent = 'No active tab.';
        return;
      }

      // Inject content script to ensure it's there
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });

        // Send start_picking message
        chrome.tabs.sendMessage(tab.id, {
          action: 'start_picking',
          smart: isSmart
        });

        // Close popup to unblock view
        window.close();
      } catch (err) {
        console.error('Pick error:', err);
        statusDiv.textContent = 'Error starting picker.';
      }
    });
  }

  // Start button handler
  startBtn.addEventListener('click', async () => {
    const selectors = selectorsInput.value.trim();
    const delay = parseInt(delayInput.value, 10) || 1000;
    const loop = infiniteCheckbox.checked;
    const repeats = parseInt(repeatsInput.value, 10) || 1;

    if (!selectors) {
      statusDiv.textContent = 'Please enter selectors.';
      return;
    }

    // Save settings
    chrome.storage.local.set({ selectors, delay, infinite: loop, repeats });

    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      statusDiv.textContent = 'No active tab found.';
      return;
    }

    // Inject content script if not already there (though manifest usually handles this, specific injection ensures freshness or manual control)
    // For MV3 with scripting permission
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });

      // Send start message
      chrome.tabs.sendMessage(tab.id, {
        action: 'start_clicking',
        selectors: selectors.split('\n').map(s => s.trim()).filter(s => s),
        delay: delay,
        loop: loop,
        repeats: repeats
      });

      statusDiv.textContent = 'Running...';
      toggleButtons(true);
    } catch (err) {
      console.error('Injection failed:', err);
      statusDiv.textContent = 'Error: Check console permissions?';
    }
  });

  // Stop button handler
  stopBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { action: 'stop_clicking' });
    }
    statusDiv.textContent = 'Stopped.';
    toggleButtons(false);
  });

  function toggleButtons(isRunning) {
    if (isRunning) {
      startBtn.classList.add('hidden');
      stopBtn.classList.remove('hidden');
      selectorsInput.disabled = true;
      delayInput.disabled = true;
    } else {
      startBtn.classList.remove('hidden');
      stopBtn.classList.add('hidden');
      selectorsInput.disabled = false;
      delayInput.disabled = false;
    }
  }

  // Listen for messages from content script (e.g., when done)
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'clicking_finished' || message.action === 'clicking_stopped') {
      statusDiv.textContent = message.action === 'clicking_finished' ? 'Finished!' : 'Stopped.';
      toggleButtons(false);
    }
  });
});
