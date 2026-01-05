let isRunning = false;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'start_clicking') {
        if (isRunning) return; // Already running
        isRunning = true;
        processQueue(request.selectors, request.delay, request.loop, request.repeats);
    } else if (request.action === 'stop_clicking') {
        isRunning = false;
    } else if (request.action === 'start_picking') {
        enablePickerMode(request.smart);
    }
});

let isPicking = false;
let isSmartPicking = false; // New flag
let hoveredElement = null;

function enablePickerMode(smart = false) {
    if (isPicking) return;
    isPicking = true;
    isSmartPicking = smart;

    // Add overlay or just listeners? Listeners are cleaner.
    document.addEventListener('mouseover', onHover, true);
    document.addEventListener('click', onPick, true);
    document.addEventListener('keydown', onKeyExit, true);

    showToast(`Picker Active (${smart ? 'Smart' : 'Simple'}). Click element. ESC to cancel.`);
}

function disablePickerMode() {
    isPicking = false;
    if (hoveredElement) {
        hoveredElement.style.outline = '';
        hoveredElement = null;
    }
    document.removeEventListener('mouseover', onHover, true);
    document.removeEventListener('click', onPick, true);
    document.removeEventListener('keydown', onKeyExit, true);

    const toast = document.getElementById('sac-toast');
    if (toast) toast.remove();
}

function onHover(e) {
    if (!isPicking) return;

    const target = e.target;
    if (target === hoveredElement) return;

    if (hoveredElement) {
        hoveredElement.style.outline = '';
    }

    hoveredElement = target;
    // Visually highlight
    hoveredElement.style.outline = '2px dashed #f39c12';

    // Stop propagation to prevent triggering other hovers
    e.stopPropagation();
}

function onPick(e) {
    if (!isPicking) return;

    e.preventDefault();
    e.stopPropagation();

    const target = e.target;
    // Pass the flag
    const selector = generateSelector(target, isSmartPicking);

    console.log('Picked:', selector);
    saveSelector(selector);

    disablePickerMode();
    showToast(`Saved: ${selector}`, 2000);
}

function onKeyExit(e) {
    if (e.key === 'Escape') {
        disablePickerMode();
        showToast('Picker Cancelled', 1000);
    }
}

function generateSelector(element, smart = false) {
    if (!smart) {
        // Simple Mode: Full path with nth-of-type
        return getFullPath(element);
    }

    // --- SMART MODE: Optimized Selector Generation ---

    // 1. Try ID (always best if unique)
    if (element.id && isUnique(`#${CSS.escape(element.id)}`)) {
        return `#${CSS.escape(element.id)}`;
    }

    // 2. High-Priority Attributes (data-*, ARIA, form attributes)
    const priorityAttrs = [
        'data-testid', 'data-test', 'data-cy', 'data-qa',
        'aria-label', 'aria-labelledby', 'name', 'placeholder',
        'for', 'role', 'type', 'value'
    ];

    for (const attr of priorityAttrs) {
        if (element.hasAttribute(attr)) {
            const val = element.getAttribute(attr);
            if (val) {
                const sel = `[${attr}="${CSS.escape(val)}"]`;
                if (isUnique(sel)) return sel;

                const tagSel = `${element.tagName.toLowerCase()}${sel}`;
                if (isUnique(tagSel)) return tagSel;
            }
        }
    }

    // 3. Special handling for Links and Images
    if (element.tagName === 'A' && element.hasAttribute('href')) {
        const href = element.getAttribute('href');
        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
            const sel = `a[href="${CSS.escape(href)}"]`;
            if (isUnique(sel)) return sel;
        }
    }

    if (element.tagName === 'IMG' && element.hasAttribute('alt')) {
        const sel = `img[alt="${CSS.escape(element.getAttribute('alt'))}"]`;
        if (isUnique(sel)) return sel;
    }

    // 4. Shortest Unique Path Algorithm
    // Build selector from element upward, stopping when unique
    let current = element;
    let path = [];

    while (current && current.nodeType === Node.ELEMENT_NODE) {
        let part = getOptimalPart(current);
        path.unshift(part);

        // Test if current path is unique
        const testSel = path.join(' > ');
        if (isUnique(testSel)) {
            return testSel;
        }

        current = current.parentNode;
    }

    // Fallback to full path
    return getFullPath(element);
}

function getOptimalPart(element) {
    let tag = element.tagName.toLowerCase();

    // If element has unique ID, use it
    if (element.id && isUnique(`#${CSS.escape(element.id)}`)) {
        return `#${CSS.escape(element.id)}`;
    }

    // Try to find a unique class
    if (element.className && typeof element.className === 'string') {
        const classes = element.className.trim().split(/\s+/).filter(c => c);
        for (const cls of classes) {
            const sel = `${tag}.${CSS.escape(cls)}`;
            // Check if this combo is unique among siblings
            if (element.parentNode) {
                const siblings = Array.from(element.parentNode.children);
                const matches = siblings.filter(s => s.matches(sel));
                if (matches.length === 1) return sel;
            }
        }
    }

    // Use nth-of-type as fallback
    if (element.parentNode) {
        const siblings = Array.from(element.parentNode.children);
        const sameTag = siblings.filter(s => s.tagName === element.tagName);
        if (sameTag.length > 1) {
            const index = sameTag.indexOf(element) + 1;
            return `${tag}:nth-of-type(${index})`;
        }
    }

    return tag;
}

function getFullPath(element) {
    const path = [];
    while (element && element.nodeType === Node.ELEMENT_NODE) {
        let selector = element.nodeName.toLowerCase();
        if (element.id) {
            selector = `#${CSS.escape(element.id)}`;
            path.unshift(selector);
            break;
        } else {
            let sibling = element;
            let nth = 1;
            while (sibling = sibling.previousElementSibling) {
                if (sibling.nodeName === element.nodeName) nth++;
            }
            if (nth > 1) selector += `:nth-of-type(${nth})`;
        }
        path.unshift(selector);
        element = element.parentNode;
    }
    return path.join(' > ');
}

function isUnique(selector) {
    try {
        return document.querySelectorAll(selector).length === 1;
    } catch (e) {
        return false;
    }
}

function saveSelector(newSelector) {
    chrome.storage.local.get(['selectors'], (result) => {
        let current = result.selectors || '';
        if (current) current += '\n';
        current += newSelector;
        chrome.storage.local.set({ selectors: current });
    });
}

function showToast(text, duration = 0) {
    let toast = document.getElementById('sac-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'sac-toast';
        toast.style.position = 'fixed';
        toast.style.top = '10px';
        toast.style.right = '10px';
        toast.style.padding = '10px 20px';
        toast.style.backgroundColor = 'rgba(0,0,0,0.8)';
        toast.style.color = 'white';
        toast.style.zIndex = '9999999';
        toast.style.borderRadius = '5px';
        toast.style.fontFamily = 'sans-serif';
        document.body.appendChild(toast);
    }
    toast.textContent = text;

    if (duration > 0) {
        setTimeout(() => {
            toast.remove();
        }, duration);
    }
}

async function processQueue(items, delay, isInfinite, repeats) {
    const totalRuns = isInfinite ? Infinity : (repeats || 1);
    console.log(`Auto Clicker Started. Runs: ${isInfinite ? 'Infinite' : totalRuns}, Items: ${items.length}`);

    let runCount = 0;

    while (isRunning && (isInfinite || runCount < totalRuns)) {
        runCount++;
        console.log(`--- Sequence Run ${runCount} ---`);

        for (let i = 0; i < items.length; i++) {
            if (!isRunning) break;

            const item = items[i];
            console.log(`Processing item ${i + 1}/${items.length}: ${item}`);

            try {
                if (item.includes(',')) {
                    // Coordinate handling
                    const [x, y] = item.split(',').map(num => parseInt(num.trim(), 10));
                    if (!isNaN(x) && !isNaN(y)) {
                        clickAtCoordinates(x, y);
                    } else {
                        console.warn(`Invalid coordinates: ${item}`);
                    }
                } else {
                    // Selector handling
                    await clickElement(item);
                }
            } catch (e) {
                console.error(`Error processing ${item}:`, e);
            }

            // Wait for delay before next click
            // If it's the last item AND we are going to loop again, we usually wait too?
            // Let's wait after every click for consistency.
            if (isRunning) await wait(delay);
        }

        // Optional: Extra delay between full sequences? 
        // For now, simpler to just treat the end of sequence same as step delay.
    }

    if (isRunning) {
        // Only if we finished naturally (not stopped by user)
        isRunning = false;
        console.log('Auto Clicker Finished All Runs');
        chrome.runtime.sendMessage({ action: 'clicking_finished' });
    } else {
        console.log('Auto Clicker Stopped by user.');
        chrome.runtime.sendMessage({ action: 'clicking_stopped' });
    }
}

async function clickElement(selector) {
    const element = document.querySelector(selector);
    if (element) {
        // Scroll into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Highlight briefly for visibility (optional but helpful)
        const originalOutline = element.style.outline;
        element.style.outline = '2px solid red';
        setTimeout(() => { element.style.outline = originalOutline; }, 500);

        simulateClick(element);
        console.log(`Clicked element: ${selector}`);
    } else {
        console.warn(`Element not found: ${selector}`);
    }
}

function clickAtCoordinates(x, y) {
    const element = document.elementFromPoint(x, y);
    if (element) {
        // Scroll if needed (might be tricky with fixed coords, assuming user wants to click viewport coords)
        // If coords are absolute page coords, we'd need to scroll to them. 
        // Usually "Action" based clickers assume relative to viewport or they scroll to it.
        // For simplicity, we assume click at viewport X,Y.

        // Visual indicator
        showClickIndicator(x, y);

        simulateClick(element, x, y);
        console.log(`Clicked at ${x},${y}`);
    } else {
        console.warn(`No element at ${x},${y}`);
    }
}

function simulateClick(element, clientX = 0, clientY = 0) {
    // Create mouse events to simulate a real user click
    const events = ['mousedown', 'mouseup', 'click'];

    // If we have an element but no specific coords, try to get its center for "better" event data
    if (element && clientX === 0 && clientY === 0) {
        const rect = element.getBoundingClientRect();
        clientX = rect.left + rect.width / 2;
        clientY = rect.top + rect.height / 2;
    }

    events.forEach(eventType => {
        const event = new MouseEvent(eventType, {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: clientX,
            clientY: clientY,
            buttons: 1 // Left mouse button
        });
        element.dispatchEvent(event);
    });
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function showClickIndicator(x, y) {
    const indicator = document.createElement('div');
    indicator.style.position = 'fixed';
    indicator.style.left = `${x - 5}px`;
    indicator.style.top = `${y - 5}px`;
    indicator.style.width = '10px';
    indicator.style.height = '10px';
    indicator.style.backgroundColor = 'red';
    indicator.style.borderRadius = '50%';
    indicator.style.zIndex = '999999';
    indicator.style.pointerEvents = 'none';

    document.body.appendChild(indicator);
    setTimeout(() => indicator.remove(), 500);
}
