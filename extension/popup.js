chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const currentTab = tabs[0];
  
  chrome.scripting.executeScript({
    target: { tabId: currentTab.id },
    func: () => {
      if (typeof CONFIG !== 'undefined') {
        return CONFIG;
      }
      return null;
    }
  }).then((results) => {
    if (results && results[0] && results[0].result) {
      const config = results[0].result;
      
      document.getElementById('domain').textContent = config.targetDomain || 'Not set';
      document.getElementById('path').textContent = config.targetPath || 'All paths';
      document.getElementById('selector').textContent = config.contentSelector || 'Not set';
      
      const currentURL = new URL(currentTab.url);
      const matches = currentURL.hostname.includes(config.targetDomain);
      
      const statusEl = document.getElementById('status');
      if (matches) {
        statusEl.textContent = 'Monitoring this page';
        statusEl.className = 'status active';
      } else {
        statusEl.textContent = 'Not monitoring this page';
        statusEl.className = 'status inactive';
      }
    } else {
      document.getElementById('domain').textContent = 'example.com';
      document.getElementById('path').textContent = '/specific-page';
      document.getElementById('selector').textContent = '#main-content';
    }
  }).catch((error) => {
    console.error('Error getting config:', error);
    document.getElementById('domain').textContent = 'example.com';
    document.getElementById('path').textContent = '/specific-page';
    document.getElementById('selector').textContent = '#main-content';
  });
});
