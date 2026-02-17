const CONFIG = {
    targetDomain: "mail.google.com",
    targetPath: "#inbox/",
    contentSelector: ".ii"
};

function isTargetURL() {
    const hash = window.location.hash;
    const currentDomain = window.location.hostname;

    if (!currentDomain.includes(CONFIG.targetDomain)) {
      return false;
    }

    return hash.includes(CONFIG.targetPath);
}

function readContent() {
    const element = document.querySelector(CONFIG.contentSelector);
    
    if (element) {
        const text = element.textContent.trim();
        return text;
    }
    
    return null;
}

function showDialog(message) {
    const existingDialog = document.getElementById('url-detector-dialog');
    if (existingDialog) {
        existingDialog.remove();
    }

    const dialog = document.createElement('div');
    dialog.id = 'url-detector-dialog';
    dialog.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        border: 2px solid #4CAF50;
        border-radius: 8px;
        padding: 20px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 10000;
        max-width: 400px;
        font-family: Arial, sans-serif;
    `;
    
    dialog.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
            <h3 style="margin: 0; color: #4CAF50; font-size: 16px;">URL Content Detector</h3>
            <button id="close-dialog" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #666;">&times;</button>
        </div>
        <p style="margin: 10px 0; color: #333; font-size: 14px;">${message}</p>
    `;
    
    document.body.appendChild(dialog);

    document.getElementById('close-dialog').addEventListener('click', () => {
        dialog.remove();
    });
    
    setTimeout(() => {
        if (dialog.parentElement) {
            dialog.remove();
        }
    }, 5000);
}

function checkAndRead() {
    if (isTargetURL()) {
        console.log('Target URL detected!');

        setTimeout(() => {
            const content = readContent();
            
            if (content) {
                const preview = content.substring(0, 100) + (content.length > 100 ? '...' : '');
                showDialog(`I checked this text:<br><br><em>"${preview}"</em>`);
                console.log('Full content:', content);
            } else {
                showDialog(`Element with selector "${CONFIG.contentSelector}" not found on this page.`);
                console.log('Element not found:', CONFIG.contentSelector);
            }
        }, 500);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndRead);
} else {
    checkAndRead();
}

let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        checkAndRead();
    }
}).observe(document, { subtree: true, childList: true });
