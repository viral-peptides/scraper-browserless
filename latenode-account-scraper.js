const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Genius DOM extraction function - no AI needed!
// Extracts confirmation code using multiple robust methods
async function extractCodeWithDOMAnalysis(page) {
  addDebugStep('Code Extraction', 'info', 'Using genius DOM extraction methods...');
  
  let confirmationCode = null;
  
  try {
    // Method 1: Look specifically in the shadow DOM content area (most specific)
    addDebugStep('Code Extraction', 'info', 'Method 1: Looking in shadow DOM content area...');
    
    const codeFromShadowDOM = await page.evaluate(() => {
      // Look for the specific content div with shadow DOM
      const contentDiv = document.querySelector('div.content.show#content');
      if (contentDiv) {
        // Check if there's a shadow root
        const shadowRoot = contentDiv.shadowRoot;
        if (shadowRoot) {
          // Look for the exact pattern: "Confirmation code:" followed by span with font-size:48px
          const text = shadowRoot.textContent || shadowRoot.innerText || '';
          if (text.includes('Confirmation code:')) {
            // Look for span with font-size:48px
            const spans = shadowRoot.querySelectorAll('span[style*="font-size:48px"]');
            for (const span of spans) {
              const code = span.textContent || span.innerText || '';
              if (/^\d{4}$/.test(code)) {
                return { code: code.trim(), method: 'shadow-dom-48px-span' };
              }
            }
            
            // Fallback: look for any 4-digit number in the shadow DOM
            const matches = text.match(/\b\d{4}\b/g);
            if (matches && matches.length > 0) {
              // Filter out years and timestamp numbers
              const validCodes = matches.filter(code => {
                return !['2025', '2024', '2023', '2022', '2021', '2020'].includes(code) &&
                       !code.startsWith('18') && !code.startsWith('19') && !code.startsWith('20') &&
                       !code.startsWith('21') && !code.startsWith('22') && !code.startsWith('23');
              });
              
              if (validCodes.length > 0) {
                return { code: validCodes[0], method: 'shadow-dom-4-digit' };
              }
            }
          }
        } else {
          // If no shadow root, look in the content div itself
          const text = contentDiv.textContent || contentDiv.innerText || '';
          if (text.includes('Confirmation code:')) {
            // Look for span with font-size:48px
            const spans = contentDiv.querySelectorAll('span[style*="font-size:48px"]');
            for (const span of spans) {
              const code = span.textContent || span.innerText || '';
              if (/^\d{4}$/.test(code)) {
                return { code: code.trim(), method: 'content-div-48px-span' };
              }
            }
          }
        }
      }
      return null;
    });
    
    if (codeFromShadowDOM) {
      confirmationCode = codeFromShadowDOM.code;
      addDebugStep('Code Extraction', 'success', `✅ Method 1 SUCCESS: Found code in shadow DOM: ${confirmationCode}`);
      return confirmationCode;
    }
    
    // Method 2: Look for span with font-size:48px (the exact pattern from the image)
    addDebugStep('Code Extraction', 'info', 'Method 2: Looking for span with font-size:48px...');
    
    const codeFromSpan = await page.evaluate(() => {
      const spans = document.querySelectorAll('span[style*="font-size:48px"]');
      for (const span of spans) {
        const text = span.textContent || span.innerText || '';
        const code = text.trim();
        if (/^\d{4}$/.test(code)) {
          return { code, method: '48px-span' };
        }
      }
      return null;
    });
    
    if (codeFromSpan) {
      confirmationCode = codeFromSpan.code;
      addDebugStep('Code Extraction', 'success', `✅ Method 1 SUCCESS: Found code in 48px span: ${confirmationCode}`);
      return confirmationCode;
    }
    
    // Method 2: Look for "Confirmation code:" text and get the next element
    addDebugStep('Code Extraction', 'info', 'Method 2: Looking for "Confirmation code:" text...');
    
    const codeFromText = await page.evaluate(() => {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      
      let node;
      while (node = walker.nextNode()) {
        if (node.textContent.includes('Confirmation code:')) {
          // Look for the next sibling element or parent's next sibling
          let parent = node.parentElement;
          while (parent) {
            // Check if parent has a span with large font size
            const spans = parent.querySelectorAll('span');
            for (const span of spans) {
              const style = span.getAttribute('style') || '';
              if (style.includes('font-size:48px') || style.includes('font-size: 48px')) {
                const text = span.textContent || span.innerText || '';
                const code = text.trim();
                if (/^\d{4}$/.test(code)) {
                  return { code, method: 'confirmation-text-sibling' };
                }
              }
            }
            
            // Check next sibling
            const nextSibling = parent.nextElementSibling;
            if (nextSibling) {
              const spans = nextSibling.querySelectorAll('span');
              for (const span of spans) {
                const text = span.textContent || span.innerText || '';
                const code = text.trim();
                if (/^\d{4}$/.test(code)) {
                  return { code, method: 'confirmation-text-next-sibling' };
                }
              }
            }
            
            parent = parent.parentElement;
          }
        }
      }
      return null;
    });
    
    if (codeFromText) {
      confirmationCode = codeFromText.code;
      addDebugStep('Code Extraction', 'success', `✅ Method 2 SUCCESS: Found code after "Confirmation code:" text: ${confirmationCode}`);
      return confirmationCode;
    }
    
    // Method 3: Look for any span with large font size containing 4 digits
    addDebugStep('Code Extraction', 'info', 'Method 3: Looking for large font spans...');
    
    const codeFromLargeSpan = await page.evaluate(() => {
      const spans = document.querySelectorAll('span');
      for (const span of spans) {
        const style = span.getAttribute('style') || '';
        const text = span.textContent || span.innerText || '';
        const code = text.trim();
        
        // Check if it's a large font size and contains 4 digits
        if ((style.includes('font-size:48px') || style.includes('font-size: 48px') || 
             style.includes('font-size:36px') || style.includes('font-size: 36px') ||
             style.includes('font-size:32px') || style.includes('font-size: 32px')) &&
            /^\d{4}$/.test(code)) {
          return { code, method: 'large-font-span' };
        }
      }
      return null;
    });
    
    if (codeFromLargeSpan) {
      confirmationCode = codeFromLargeSpan.code;
      addDebugStep('Code Extraction', 'success', `✅ Method 3 SUCCESS: Found code in large font span: ${confirmationCode}`);
      return confirmationCode;
    }
    
    // Method 4: Look for 4-digit numbers in email content (avoiding timestamps/years)
    addDebugStep('Code Extraction', 'info', 'Method 4: Looking for 4-digit numbers in email content...');
    
    const codeFromEmailContent = await page.evaluate(() => {
      // Look specifically in email content areas, not the entire page
      const emailSelectors = [
        '.detail-box',
        '.detail',
        '.email-content',
        '.message-content',
        '[class*="email"]',
        '[class*="message"]',
        'table',
        'td',
        'div[style*="font-family"]'
      ];
      
      for (const selector of emailSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          const text = element.textContent || element.innerText || '';
          
          // Skip if it contains timestamp patterns or year patterns
          if (text.includes('2025') || text.includes('2024') || text.includes('2023') || 
              text.includes('18:') || text.includes('19:') || text.includes('20:') ||
              text.includes('21:') || text.includes('22:') || text.includes('23:') ||
              text.includes('Code Extraction:') || text.includes('Method') ||
              text.includes('SUCCESS:') || text.includes('ERROR:')) {
            continue;
          }
          
          // Look for 4-digit numbers that are likely confirmation codes
          const matches = text.match(/\b\d{4}\b/g);
          if (matches && matches.length > 0) {
            // Filter out common years and timestamp numbers
            const validCodes = matches.filter(code => {
              const num = parseInt(code);
              return num >= 1000 && num <= 9999 && 
                     !['2025', '2024', '2023', '2022', '2021', '2020'].includes(code) &&
                     !code.startsWith('18') && !code.startsWith('19') && !code.startsWith('20') &&
                     !code.startsWith('21') && !code.startsWith('22') && !code.startsWith('23');
            });
            
            if (validCodes.length > 0) {
              return { code: validCodes[0], method: 'email-content-4-digit' };
            }
          }
        }
      }
      return null;
    });
    
    if (codeFromEmailContent) {
      confirmationCode = codeFromEmailContent.code;
      addDebugStep('Code Extraction', 'success', `✅ Method 4 SUCCESS: Found code in email content: ${confirmationCode}`);
      return confirmationCode;
    }
    
    // Method 5: Look for table structure (email is often in tables)
    addDebugStep('Code Extraction', 'info', 'Method 5: Looking in table structure...');
    
    const codeFromTable = await page.evaluate(() => {
      const tables = document.querySelectorAll('table');
      for (const table of tables) {
        const text = table.textContent || table.innerText || '';
        if (text.includes('Confirmation code:')) {
          const matches = text.match(/\b\d{4}\b/g);
          if (matches && matches.length > 0) {
            // Filter out years and timestamp numbers
            const validCodes = matches.filter(code => {
              const num = parseInt(code);
              return num >= 1000 && num <= 9999 && 
                     !['2025', '2024', '2023', '2022', '2021', '2020'].includes(code) &&
                     !code.startsWith('18') && !code.startsWith('19') && !code.startsWith('20') &&
                     !code.startsWith('21') && !code.startsWith('22') && !code.startsWith('23');
            });
            
            if (validCodes.length > 0) {
              return { code: validCodes[0], method: 'table-structure' };
            }
          }
        }
      }
      return null;
    });
    
    if (codeFromTable) {
      confirmationCode = codeFromTable.code;
      addDebugStep('Code Extraction', 'success', `✅ Method 5 SUCCESS: Found code in table: ${confirmationCode}`);
      return confirmationCode;
    }
    
    
    addDebugStep('Code Extraction', 'error', '❌ All DOM extraction methods failed');
    return null;
    
  } catch (extractionError) {
    addDebugStep('Code Extraction', 'error', 'Error in DOM extraction methods', null, extractionError.message);
    return null;
  }
}

// === Latenode / TempMail100 confirmation code extractor ======================
async function extractCodeTempmail100(page, { timeout = 30000, log = () => {} } = {}) {
  // 1) Email view should be visible (header "Confirm your email address - Latenode")
  const rootSel = '.detail-box, .detail';
  await page.waitForSelector(rootSel, { visible: true, timeout }).catch(() => {});
  const root = await page.$(rootSel).catch(() => null);

  // 2) Frames to try: every non-ad/non-recaptcha frame. We DO NOT require ancestry.
  const bad = /googleads|doubleclick|recaptcha|googlesyndication|gstatic/i;
  const frames = page.frames().filter(f => !bad.test(f.url() || ''));

  // Sort to try most likely first: about:blank/srcdoc frames, then others.
  frames.sort((a, b) => {
    const ua = a.url(); const ub = b.url();
    const sa = !ua || ua === 'about:blank'; 
    const sb = !ub || ub === 'about:blank';
    return (sa === sb) ? 0 : (sa ? -1 : 1);
  });

  // 3) Try frames
  for (const f of frames) {
    try {
      // Quick same-origin content probe (fast; avoids 30s waits)
      const hasContent = await f.evaluate(() => {
        const b = document.body;
        if (!b) return false;
        const htmlLen = (b.innerHTML || '').length;
        const textLen = (b.innerText || '').length;
        return htmlLen > 50 || textLen > 20;
      }).catch(() => false);

      if (!hasContent) {
        log(`Frame skip (no content): ${f.url() || 'about:blank'}`);
        continue;
      }

      // Short wait for any text to settle (no long timeouts)
      await f.waitForFunction(
        () => !!(document.body && (document.body.innerText || '').trim().length),
        { timeout: Math.min(2500, timeout) }
      ).catch(() => {});

      // Try extracting (no dependency on exact "Confirmation code" wording)
      const code = await tryExtractFromFrame(f).catch(() => null);
      if (code) {
        log(`Frame OK: ${f.url() || 'about:blank'} -> ${code}`);
        return code;
      } else {
        // For debugging: peek a snippet so you can see what it contained
        const preview = await f.evaluate(() => (document.body?.innerText || '').slice(0, 120)).catch(() => '');
        log(`Frame tried but no code: ${f.url() || 'about:blank'} | text="${preview}"`);
      }
    } catch (e) {
      log(`Frame error ${f.url() || 'about:blank'}: ${e.message}`);
    }
  }

  // 4) Fallback: inline container (no frames case)
  if (root) {
    const inline = await tryExtractFromContainer(page, root).catch(() => null);
    if (inline) {
      log(`Inline container -> ${inline}`);
      return inline;
    }
  }

  throw new Error('Code not found in any email frame or container');
}

// ── helpers ───────────────────────────────────────────────────────────────────
const digits = s => String(s || '').replace(/\D+/g, '');
const isOtp  = s => /^\d{4,8}$/.test(s || '');

async function tryExtractFromFrame(frame) {
  // A) label → next span (works for Latenode template)
  const [el] = await frame.$x(
    "//div[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'confirmation code')]/following::span[1] | " +
    "//td/div[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'confirmation code')]/following::span[1]"
  );
  if (el) {
    const raw = (await frame.evaluate(e => e.textContent, el) || '').trim();
    const c = digits(raw);
    if (isOtp(c)) return c;
  }

  // B) biggest-font span that contains 4–8 digits (very reliable for this email)
  const big = await frame.evaluate(() => {
    let best = null, bestSize = 0;
    const spans = Array.from(document.querySelectorAll('span'));
    for (const s of spans) {
      const txt = (s.textContent || '').trim();
      const m = txt.match(/\b(\d{4,8})\b/);
      if (!m) continue;
      const fs = parseFloat(getComputedStyle(s).fontSize || '0');
      if (fs > bestSize) { best = m[1]; bestSize = fs; }
    }
    return best;
  });
  if (isOtp(big)) return big;

  // C) loose text search (handles colon / nbsp / newlines)
  const txt = await frame.evaluate(() => document.body?.innerText || '');
  const m = txt.match(/confirmation\s*code[\s:\u00A0]*[\r\n\s]*?(\b\d{4,8}\b)/i);
  if (m && isOtp(m[1])) return m[1];

  return null;
}

async function tryExtractFromContainer(page, rootEl) {
  // A) label → next span inside container
  const codeA = await page.evaluate(el => {
    const label = Array.from(el.querySelectorAll('div, td')).find(n =>
      /confirmation\s*code/i.test(n.innerText || '')
    );
    const span = label && (label.querySelector('span') || label.parentElement?.querySelector('span'));
    const raw  = (span?.textContent || '').trim();
    const num  = (raw || '').replace(/\D+/g, '');
    return /^\d{4,8}$/.test(num) ? num : null;
  }, rootEl);
  if (codeA) return codeA;

  // B) biggest-font span with digits
  const codeB = await page.evaluate(el => {
    let best = null, bestFs = 0;
    for (const s of el.querySelectorAll('span')) {
      const m = (s.textContent || '').trim().match(/\b(\d{4,8})\b/);
      if (!m) continue;
      const fs = parseFloat(getComputedStyle(s).fontSize || '0');
      if (fs > bestFs) { best = m[1]; bestFs = fs; }
    }
    return best;
  }, rootEl);
  if (codeB) return codeB;

  // C) container text
  const codeC = await page.evaluate(el => {
    const t = el.innerText || '';
    const m = t.match(/confirmation\s*code[\s:\u00A0]*[\r\n\s]*?(\b\d{4,8}\b)/i);
    return m ? m[1] : null;
  }, rootEl);
  return codeC || null;
}

// Global variable for io instance
let io = null;

// Function to add debug step with real-time logging
function addDebugStep(step, status, message, screenshot = null, error = null) {
  const timestamp = new Date().toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const logEntry = {
    step,
    status,
    message,
    timestamp,
    screenshot,
    error
  };

  console.log(`[${status.toUpperCase()}] ${step}: ${message} ${timestamp}`);
  
  // Emit to WebSocket clients if available
  if (global.io) {
    global.io.emit('debug-log', logEntry);
  }
}

// Function to take screenshot
async function takeScreenshot(step, page) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `latenode-account-${Date.now()}-${step.replace(/[^a-zA-Z0-9]/g, '-')}.png`;
    const screenshotPath = path.join(__dirname, 'screenshots', filename);
    
    // Ensure screenshots directory exists
    if (!fs.existsSync(path.join(__dirname, 'screenshots'))) {
      fs.mkdirSync(path.join(__dirname, 'screenshots'), { recursive: true });
    }
    
    await page.screenshot({ 
      path: screenshotPath, 
      fullPage: true,
      type: 'png'
    });
    
    addDebugStep(step, 'screenshot', `Screenshot saved: ${filename}`, filename);
    return filename;
  } catch (error) {
    addDebugStep(step, 'error', 'Failed to take screenshot', null, error.message);
    return null;
  }
}

// Sleep function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function createLatenodeAccount(ioInstance = null, emailOrPassword = null, password = null) {
  let browser = null;
  let page = null;
  let tempEmail = null;
  let confirmationCode = null;
  
  // Handle different parameter patterns:
  // Pattern 1: createLatenodeAccount(io, password) - old pattern
  // Pattern 2: createLatenodeAccount(io, email, password) - new pattern with email
  let providedEmail = null;
  let generatedPassword = null;
  
  if (password !== null && password !== undefined) {
    // Pattern 2: emailOrPassword is email, password is password
    providedEmail = emailOrPassword;
    generatedPassword = password;
  } else {
    // Pattern 1: emailOrPassword is actually password
    generatedPassword = emailOrPassword;
  }
  
  generatedPassword = generatedPassword || `TempPass${Math.random().toString(36).substring(2, 8)}!123`;
  
  // Initialize global variables
  global.credits = null;
  global.webhookUrl = null;
  
  try {
    addDebugStep('Initialization', 'info', '🚀 Starting Latenode account creation process...');
    
    // Set global.io for WebSocket logging
    if (ioInstance) {
      global.io = ioInstance;
    }
    
    // Launch browser
    addDebugStep('Browser Launch', 'info', 'Launching browser...');
    browser = await puppeteer.launch({
      headless: true, // Changed to true for Railway compatibility
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--single-process',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    });
    
    page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1280, height: 720 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    addDebugStep('Browser Launch', 'success', 'Browser launched successfully');
    
    // Step 1: Get email (either provided or from TempMail100)
    if (providedEmail && providedEmail.trim()) {
      // Use provided email, skip TempMail100
      tempEmail = providedEmail.trim();
      addDebugStep('Email Input', 'info', `Using provided email: ${tempEmail}`);
      addDebugStep('Email Input', 'success', 'Skipping TempMail100, using provided email');
    } else {
      // Step 1: Navigate to TempMail100
      addDebugStep('Temp Email', 'info', 'Navigating to TempMail100...');
      await page.goto('https://tempmail100.com/', { 
        waitUntil: 'networkidle2', 
        timeout: 30000 
      });
      
      await takeScreenshot('TempMail100-Loaded', page);
      addDebugStep('Temp Email', 'success', 'Successfully navigated to TempMail100');
      
      // Wait for page to fully load
      await sleep(2000);
      
      // Handle any ads that might appear
      addDebugStep('Ad Handling', 'info', 'Checking for ads and clicking in empty space...');
      try {
        // Click in empty space to dismiss any ads
        await page.mouse.click(100, 100);
        await sleep(1000);
        addDebugStep('Ad Handling', 'success', 'Clicked in empty space to dismiss ads');
      } catch (error) {
        addDebugStep('Ad Handling', 'warning', 'No ads detected or ad handling failed', null, error.message);
      }
      
      // Step 2: Copy the temporary email
      addDebugStep('Email Copy', 'info', 'Looking for copy button to copy temporary email...');
      
      try {
        // Wait for the copy button to be available
        await page.waitForSelector('svg[onclick="copyAddress()"]', { timeout: 10000 });
        
        // Click the copy button
        await page.click('svg[onclick="copyAddress()"]');
        addDebugStep('Email Copy', 'success', 'Clicked copy button');
        
        await sleep(1000);
      } catch (error) {
        addDebugStep('Email Copy', 'warning', 'Could not click copy button, proceeding with direct extraction', null, error.message);
      }
      
      // Skip clipboard reading in headless mode and go directly to input field extraction
      addDebugStep('Email Copy', 'info', 'Extracting temporary email from input field (headless mode)...');
      
      // Get email directly from the input field since clipboard doesn't work in headless mode
      tempEmail = await page.evaluate(() => {
        // Try multiple selectors for the email input
        const selectors = [
          'input[type="text"]',
          'input[type="email"]',
          'input[placeholder*="email" i]',
          'input[placeholder*="mail" i]',
          '.email-input input',
          'input[name*="email" i]',
          'input[class*="email"]',
          'input[class*="mail"]'
        ];
        
        for (const selector of selectors) {
          const input = document.querySelector(selector);
          if (input && input.value && input.value.includes('@')) {
            console.log('Found email in input:', input.value);
            return input.value;
          }
        }
        
        // Look for any input with email-like content
        const allInputs = document.querySelectorAll('input');
        for (const input of allInputs) {
          if (input.value && input.value.includes('@') && input.value.includes('.')) {
            console.log('Found email-like text:', input.value);
            return input.value;
          }
        }
        
        // Look for email in any text content or data attributes
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
        const bodyText = document.body.innerText;
        const emailMatch = bodyText.match(emailRegex);
        if (emailMatch) {
          console.log('Found email in page text:', emailMatch[0]);
          return emailMatch[0];
        }
        
        return null;
      });
      
      if (tempEmail && tempEmail.trim()) {
        addDebugStep('Email Copy', 'success', `Temporary email extracted: ${tempEmail}`);
      } else {
        // Fallback: generate a temporary email
        addDebugStep('Email Copy', 'warning', 'Could not extract email from page, generating fallback email...');
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 8);
        tempEmail = `temp${randomId}${timestamp}@tempmail100.com`;
        addDebugStep('Email Copy', 'success', `Generated fallback email: ${tempEmail}`);
      }
      
      await takeScreenshot('Email-Copied', page);
    }
    
    // Step 3: Navigate to Latenode
    addDebugStep('Latenode Navigation', 'info', 'Navigating to Latenode account creation page...');
    await page.goto('https://app.latenode.com/auth', { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });
    
    await takeScreenshot('Latenode-Loaded', page);
    addDebugStep('Latenode Navigation', 'success', 'Successfully navigated to Latenode');
    
    // Wait for page to fully load
    await sleep(2000);
    
    // Step 4: Fill in the email field
    addDebugStep('Email Input', 'info', 'Looking for email input field...');
    
    // Wait for the email input field
    await page.waitForSelector('input[data-test-id="authEmailInput"]', { timeout: 10000 });
    
    // Clear and fill the email field with smart validation
    addDebugStep('Email Input', 'info', `Filling email field with: ${tempEmail}`);
    
    // First, clear the field completely
    await page.evaluate(() => {
      const emailInput = document.querySelector('input[data-test-id="authEmailInput"]');
      if (emailInput) {
        emailInput.focus();
        emailInput.select();
        emailInput.value = '';
        // Trigger events to clear any validation state
        emailInput.dispatchEvent(new Event('input', { bubbles: true }));
        emailInput.dispatchEvent(new Event('change', { bubbles: true }));
        emailInput.dispatchEvent(new Event('blur', { bubbles: true }));
      }
    });
    
    await sleep(500);
    
    // Now type the email character by character to ensure proper validation
    addDebugStep('Email Input', 'info', 'Typing email character by character...');
    await page.type('input[data-test-id="authEmailInput"]', tempEmail, { delay: 100 });
    
    await sleep(1000);
    
    // Verify the email was entered and check if Next button is now visible
    const emailValidation = await page.evaluate((expectedEmail) => {
      const emailInput = document.querySelector('input[data-test-id="authEmailInput"]');
      const enteredEmail = emailInput ? emailInput.value : null;
      
      // Check if Next button is visible and enabled
      const nextButton = document.querySelector('button[data-test-id="authEmailButton"]');
      const isNextButtonVisible = nextButton && nextButton.offsetParent !== null;
      const isNextButtonEnabled = nextButton && !nextButton.disabled && !nextButton.classList.contains('disabled');
      
      // Check for any validation errors
      const hasValidationError = document.querySelector('.error, .invalid, [class*="error"], [class*="invalid"]') !== null;
      
      return {
        enteredEmail: enteredEmail,
        isCorrect: enteredEmail === expectedEmail,
        isNextButtonVisible: isNextButtonVisible,
        isNextButtonEnabled: isNextButtonEnabled,
        hasValidationError: hasValidationError,
        nextButtonText: nextButton ? nextButton.innerText : null
      };
    }, tempEmail);
    
    addDebugStep('Email Input', 'info', `Email validation results:`, null, JSON.stringify(emailValidation, null, 2));
    
    if (emailValidation.isCorrect) {
      addDebugStep('Email Input', 'success', `Email successfully entered: ${emailValidation.enteredEmail}`);
    } else {
      addDebugStep('Email Input', 'error', `❌ CRITICAL: Email verification failed. Expected: ${tempEmail}, Got: ${emailValidation.enteredEmail} - stopping process`);
      throw new Error('Email input failed - this step is obligatory');
    }
    
    if (emailValidation.hasValidationError) {
      addDebugStep('Email Input', 'warning', 'Validation error detected on page');
    }
    
    if (emailValidation.isNextButtonVisible && emailValidation.isNextButtonEnabled) {
      addDebugStep('Email Input', 'success', 'Next button is visible and enabled - email validation successful!');
    } else {
      addDebugStep('Email Input', 'warning', `Next button status - Visible: ${emailValidation.isNextButtonVisible}, Enabled: ${emailValidation.isNextButtonEnabled}`);
      
      // Try alternative email input method if Next button is not visible
      addDebugStep('Email Input', 'info', 'Trying alternative email input method...');
      
      await page.evaluate((email) => {
        const emailInput = document.querySelector('input[data-test-id="authEmailInput"]');
        if (emailInput) {
          // Clear and set value using different approach
          emailInput.focus();
          emailInput.value = '';
          
          // Simulate typing
          for (let i = 0; i < email.length; i++) {
            emailInput.value = email.substring(0, i + 1);
            emailInput.dispatchEvent(new Event('input', { bubbles: true }));
            emailInput.dispatchEvent(new Event('keyup', { bubbles: true }));
          }
          
          // Final validation events
          emailInput.dispatchEvent(new Event('change', { bubbles: true }));
          emailInput.dispatchEvent(new Event('blur', { bubbles: true }));
          emailInput.dispatchEvent(new Event('focus', { bubbles: true }));
          
          // Force validation
          if (emailInput.checkValidity) {
            emailInput.checkValidity();
          }
        }
      }, tempEmail);
      
      await sleep(2000);
      
      // Check again after alternative method
      const revalidation = await page.evaluate(() => {
        const nextButton = document.querySelector('button[data-test-id="authEmailButton"]');
        return {
          isNextButtonVisible: nextButton && nextButton.offsetParent !== null,
          isNextButtonEnabled: nextButton && !nextButton.disabled && !nextButton.classList.contains('disabled')
        };
      });
      
      if (revalidation.isNextButtonVisible && revalidation.isNextButtonEnabled) {
        addDebugStep('Email Input', 'success', 'Next button is now visible after alternative input method!');
      } else {
        addDebugStep('Email Input', 'error', '❌ CRITICAL: Next button still not visible after alternative input method - stopping process');
        throw new Error('Email validation failed - Next button not becoming visible - this step is obligatory');
      }
    }
    
    await takeScreenshot('Email-Entered', page);
    
    // Step 5: Click Next button to proceed (we already verified it's visible and enabled)
    addDebugStep('Next Button', 'info', 'Clicking Next button...');
    
    try {
      // Since we already verified the Next button is visible and enabled, just click it
      await page.click('button[data-test-id="authEmailButton"]');
      addDebugStep('Next Button', 'success', 'Clicked Next button successfully');
      
      await sleep(1000);
      
      // Wait for page to update to confirmation code page
      addDebugStep('Next Button', 'info', 'Waiting for page to transition to confirmation code step...');
      
      try {
        // Wait for either confirmation code input OR a redirect to a different page
        await page.waitForFunction(() => {
          // Check for confirmation code input with more selectors
          const selectors = [
            'input[placeholder*="code" i]',
            'input[placeholder*="confirmation" i]',
            'input[data-test-id*="code" i]',
            'input[type="text"][maxlength="4"]',
            'input[type="text"][maxlength="6"]',
            'input[type="text"][maxlength="8"]',
            'input[name*="code" i]',
            'input[name*="verification" i]',
            'input[id*="code" i]',
            'input[id*="verification" i]'
          ];
          
          for (const selector of selectors) {
            if (document.querySelector(selector)) return true;
          }
          
          // Check if URL changed (might be redirecting)
          const url = window.location.href;
          if (url.includes('confirm') || url.includes('verification') || url.includes('code') || 
              url.includes('dashboard') || url.includes('console') || url.includes('success')) {
            return true;
          }
          
          // Check for any text mentioning confirmation or code
          const bodyText = document.body.innerText.toLowerCase();
          if (bodyText.includes('confirmation code') || bodyText.includes('verification code') || 
              bodyText.includes('enter code') || bodyText.includes('welcome') || 
              bodyText.includes('dashboard') || bodyText.includes('success')) {
            return true;
          }
          
          return false;
        }, { timeout: 30000 }); // Increased timeout to 30 seconds
        
        addDebugStep('Next Button', 'success', 'Page transition detected');
        
      } catch (error) {
        addDebugStep('Next Button', 'warning', 'Page transition timeout, checking current state...');
        
        // Take a screenshot to see what's on the page
        await takeScreenshot('After-Next-Click', page);
        
        // Check if we're on a different page or if there's any confirmation-related content
        const currentUrl = await page.url();
        const pageContent = await page.evaluate(() => document.body.innerText);
        
        addDebugStep('Next Button', 'info', `Current URL: ${currentUrl}`);
        addDebugStep('Next Button', 'info', `Page contains confirmation text: ${pageContent.toLowerCase().includes('confirmation') || pageContent.toLowerCase().includes('code')}`);
        
        // If we can't find confirmation code input, this might be a different flow
        const hasCodeInput = await page.evaluate(() => {
          // Try multiple selectors for confirmation code input
          const selectors = [
            'input[placeholder*="code" i]',
            'input[placeholder*="confirmation" i]',
            'input[data-test-id*="code" i]',
            'input[type="text"][maxlength="4"]',
            'input[type="text"][maxlength="6"]',
            'input[type="text"][maxlength="8"]',
            'input[name*="code" i]',
            'input[name*="verification" i]',
            'input[id*="code" i]',
            'input[id*="verification" i]',
            'input[class*="code" i]',
            'input[class*="verification" i]',
            'input[type="text"]', // Any text input
            'input[type="number"]' // Any number input
          ];
          
          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
              console.log('Found confirmation code input with selector:', selector);
              return true;
            }
          }
          
          // Also check for any input that might be a code field
          const allInputs = document.querySelectorAll('input');
          for (const input of allInputs) {
            const placeholder = (input.placeholder || '').toLowerCase();
            const name = (input.name || '').toLowerCase();
            const id = (input.id || '').toLowerCase();
            const className = (input.className || '').toLowerCase();
            
            if (placeholder.includes('code') || placeholder.includes('verification') || 
                name.includes('code') || name.includes('verification') ||
                id.includes('code') || id.includes('verification') ||
                className.includes('code') || className.includes('verification')) {
              console.log('Found confirmation code input by text matching:', input);
              return true;
            }
          }
          
          return false;
        });
        
        if (!hasCodeInput) {
          // Let's also check if we're on a different page that might indicate success
          const currentUrl = await page.url();
          const pageTitle = await page.title();
          const pageContent = await page.evaluate(() => document.body.innerText);
          
          addDebugStep('Next Button', 'info', `Current URL: ${currentUrl}`);
          addDebugStep('Next Button', 'info', `Page title: ${pageTitle}`);
          addDebugStep('Next Button', 'info', `Page content preview: ${pageContent.substring(0, 200)}...`);
          
          // Check if we're on a success page or dashboard
          if (currentUrl.includes('dashboard') || currentUrl.includes('console') || 
              pageContent.toLowerCase().includes('welcome') || pageContent.toLowerCase().includes('dashboard') ||
              pageContent.toLowerCase().includes('success') || pageContent.toLowerCase().includes('account created')) {
            addDebugStep('Next Button', 'success', 'Account creation appears to be successful - no confirmation code needed');
            return { success: true, email, password: generatedPassword, message: 'Account created successfully without confirmation code' };
          }
          
          // Try to re-interact with email field to trigger email sending
          addDebugStep('Next Button', 'info', 'No confirmation code found - trying to re-interact with email field...');
          
          try {
            // Find and click on email field again
            const emailField = await page.$('input[type="email"], input[name="email"], input[data-test-id="authEmailInput"]');
            if (emailField) {
              // Click to focus the field
              await emailField.click();
              await sleep(500);
              
              // Clear and re-enter email
              await emailField.click({ clickCount: 3 });
              await sleep(200);
              await emailField.type(email);
              await sleep(500);
              
              // Click Next button again
              const nextButton = await page.$('button[data-test-id="authEmailButton"]');
              if (nextButton) {
                await nextButton.click();
                addDebugStep('Next Button', 'info', 'Re-clicked Next button after re-entering email');
                
                // Wait a bit more for email to be sent
                await sleep(5000);
                
                // Check again for confirmation code
                const hasCodeInputRetry = await page.evaluate(() => {
                  const selectors = [
                    'input[placeholder*="code" i]',
                    'input[placeholder*="confirmation" i]',
                    'input[data-test-id*="code" i]',
                    'input[type="text"][maxlength="4"]',
                    'input[type="text"][maxlength="6"]',
                    'input[type="text"][maxlength="8"]',
                    'input[name*="code" i]',
                    'input[name*="verification" i]',
                    'input[id*="code" i]',
                    'input[id*="verification" i]'
                  ];
                  
                  for (const selector of selectors) {
                    if (document.querySelector(selector)) return true;
                  }
                  return false;
                });
                
                if (hasCodeInputRetry) {
                  addDebugStep('Next Button', 'success', 'Confirmation code input found after retry');
                } else {
                  addDebugStep('Next Button', 'error', '❌ CRITICAL: No confirmation code input found after retry - stopping process');
                  throw new Error('Confirmation code page not loaded after retry - this step is obligatory');
                }
              } else {
                addDebugStep('Next Button', 'error', '❌ CRITICAL: No confirmation code input found after Next button click - stopping process');
                throw new Error('Confirmation code page not loaded - this step is obligatory');
              }
            } else {
              addDebugStep('Next Button', 'error', '❌ CRITICAL: No confirmation code input found after Next button click - stopping process');
              throw new Error('Confirmation code page not loaded - this step is obligatory');
            }
          } catch (retryError) {
            addDebugStep('Next Button', 'error', '❌ CRITICAL: No confirmation code input found after Next button click - stopping process');
            throw new Error('Confirmation code page not loaded - this step is obligatory');
          }
        }
      }
      
      addDebugStep('Next Button', 'success', 'Page updated to confirmation code step');
      await takeScreenshot('Confirmation-Code-Page', page);
      
    } catch (error) {
      addDebugStep('Next Button', 'error', '❌ CRITICAL: Next button step failed - stopping process', null, error.message);
      throw new Error(`Next button step failed: ${error.message}`);
    }
    
    // Step 6: Retry loop for email sending (max 3 attempts)
    let emailFound = false;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (!emailFound && retryCount < maxRetries) {
      retryCount++;
      addDebugStep('Email Check', 'info', `Attempt ${retryCount}/${maxRetries} - Checking for confirmation email...`);
      
      // Switch back to TempMail100 tab to get confirmation code
      addDebugStep('Email Check', 'info', 'Switching to TempMail100 tab to check for confirmation email...');
      
      // Wait a bit for the email to be sent (if Next button was clicked)
      addDebugStep('Email Check', 'info', 'Waiting for email to be sent...');
      await sleep(10000); // Wait 10 seconds for email to arrive
    
    // Get all pages and find the TempMail100 tab
    const pages = await browser.pages();
    let tempMailPage = null;
    
    for (const p of pages) {
      const url = p.url();
      if (url.includes('tempmail100.com')) {
        tempMailPage = p;
        break;
      }
    }
    
    if (!tempMailPage) {
      // If no TempMail100 tab found, create a new one
      tempMailPage = await browser.newPage();
      await tempMailPage.goto('https://tempmail100.com/', { waitUntil: 'networkidle2', timeout: 30000 });
    }
    
    // Switch to TempMail100 tab
    await tempMailPage.bringToFront();
    await sleep(2000);
    await takeScreenshot('TempMail100-Inbox', tempMailPage);
    
    // Handle consent dialog if it appears
    addDebugStep('Consent Dialog', 'info', 'Checking for consent dialog...');
    try {
      // Wait for consent dialog to appear with multiple selectors
      const consentSelectors = [
        'button:has-text("Consent")',
        'button:has-text("Accept")', 
        'button:has-text("Agree")',
        'button:has-text("I agree")',
        'button:has-text("Accept All")',
        'button:has-text("Accept all")',
        'button:has-text("Allow")',
        'button:has-text("OK")',
        'button:has-text("Continue")',
        'button:has-text("I consent")',
        'button:has-text("Accept cookies")',
        'button:has-text("Accept all cookies")',
        '[class*="consent"] button',
        '[class*="cookie"] button',
        '[class*="gdpr"] button',
        'button[class*="accept"]',
        'button[class*="consent"]',
        // More specific selectors for the actual consent button
        'button[type="button"]:has-text("Consent")',
        'button[class*="primary"]:has-text("Consent")',
        'button[class*="btn"]:has-text("Consent")',
        // Avoid clicking "Learn more" or "Manage options" buttons
        'button:not(:has-text("Learn more")):not(:has-text("Manage options")):has-text("Consent")'
      ];
      
      let consentClicked = false;
      for (const selector of consentSelectors) {
        try {
          await tempMailPage.waitForSelector(selector, { timeout: 2000 });
          
          // Check if button is visible and clickable
          const buttonInfo = await tempMailPage.evaluate((sel) => {
            const button = document.querySelector(sel);
            if (!button) return { found: false };
            
            const text = (button.innerText || button.textContent || '').trim();
            
            // Avoid clicking "Learn more", "Manage options", or other non-consent buttons
            const avoidTexts = ['Learn more', 'Manage options', 'Settings', 'Preferences', 'Details', 'More info'];
            const shouldAvoid = avoidTexts.some(avoidText => text.toLowerCase().includes(avoidText.toLowerCase()));
            
            return {
              found: true,
              visible: button.offsetParent !== null,
              enabled: !button.disabled && !button.classList.contains('disabled'),
              text: text,
              shouldAvoid: shouldAvoid
            };
          }, selector);
          
          if (buttonInfo.found && buttonInfo.visible && buttonInfo.enabled && !buttonInfo.shouldAvoid) {
            await tempMailPage.click(selector);
            addDebugStep('Consent Dialog', 'success', `Clicked consent button: "${buttonInfo.text}"`);
            consentClicked = true;
            break;
          } else if (buttonInfo.shouldAvoid) {
            addDebugStep('Consent Dialog', 'warning', `Skipping button "${buttonInfo.text}" - not a consent button`);
          }
        } catch (e) {
          // Try next selector
          continue;
        }
      }
      
      if (consentClicked) {
        await sleep(2000);
        await takeScreenshot('TempMail100-After-Consent', tempMailPage);
      } else {
        addDebugStep('Consent Dialog', 'info', 'No consent dialog found or already handled');
      }
      
    } catch (error) {
      addDebugStep('Consent Dialog', 'info', 'No consent dialog found or already handled');
    }
    
    // Look for the Latenode confirmation email
    addDebugStep('Email Check', 'info', 'Looking for Latenode confirmation email...');
    
    try {
      // Wait for the email to appear with multiple attempts
      let emailFound = false;
      const maxAttempts = 10;
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        addDebugStep('Email Check', 'info', `Attempt ${attempt}/${maxAttempts} - Looking for Latenode email...`);
        
        // Refresh the inbox
        try {
          await tempMailPage.click('button:has-text("Refresh"), [class*="refresh"]');
          await sleep(2000);
        } catch (e) {
          // Refresh button not found, continue
        }
        
        // Debug: Check what elements are available on the page
        if (attempt === 1) {
          const pageInfo = await tempMailPage.evaluate(() => {
            const allLinks = document.querySelectorAll('a');
            const allDivs = document.querySelectorAll('div');
            const allElements = document.querySelectorAll('*');
            
            const emailRelated = Array.from(allElements).filter(el => {
              const text = (el.innerText || el.textContent || '').toLowerCase();
              return text.includes('latenode') || text.includes('confirm') || text.includes('email');
            });
            
            return {
              totalLinks: allLinks.length,
              totalDivs: allDivs.length,
              totalElements: allElements.length,
              emailRelatedElements: emailRelated.length,
              emailRelatedTexts: emailRelated.map(el => (el.innerText || el.textContent || '').substring(0, 50)).slice(0, 10)
            };
          });
          
          addDebugStep('Email Check', 'info', `Page debug info:`, null, JSON.stringify(pageInfo, null, 2));
        }
        
        // Try multiple selectors for the email
        const emailSelectors = [
          'a.email-item:has-text("Latenode")',
          'a.email-item:has-text("Confirm your email")',
          'a.email-item:has-text("latenode")',
          'a.email-item:has-text("confirm")',
          'a[href*="detail"]:has-text("Latenode")',
          'a[href*="detail"]:has-text("Confirm")',
          // More specific selectors for the email item
          'a:has-text("Latenode")',
          'a:has-text("Confirm your email address")',
          'a:has-text("Confirm your email")',
          'a:has-text("confirm")',
          // Look for any clickable element containing Latenode
          '[class*="email"]:has-text("Latenode")',
          '[class*="item"]:has-text("Latenode")',
          '[class*="mail"]:has-text("Latenode")',
          // Generic selectors for email items
          'a[href*="detail"]',
          '.email-item',
          '[class*="email-item"]'
        ];
        
        for (const selector of emailSelectors) {
          try {
            await tempMailPage.waitForSelector(selector, { timeout: 3000 });
            await tempMailPage.click(selector);
            addDebugStep('Email Check', 'success', `Clicked on Latenode email using selector: ${selector}`);
            emailFound = true;
            break;
          } catch (e) {
            // Try next selector
            continue;
          }
        }
        
        if (emailFound) break;
        
        // If not found, wait a bit and try again
        if (attempt < maxAttempts) {
          addDebugStep('Email Check', 'info', `Email not found yet, waiting 5 seconds before retry...`);
          await sleep(5000);
        }
      }
      
      if (!emailFound) {
        // Last resort: try JavaScript evaluation with more comprehensive search
        const emailClicked = await tempMailPage.evaluate(() => {
          // Try multiple selectors for email items
          const selectors = [
            'a.email-item',
            'a[href*="detail"]',
            '[class*="email"]',
            '[class*="item"]',
            'a[class*="email"]',
            'div[class*="email"]',
            'div[class*="item"]'
          ];
          
          let allItems = [];
          for (const selector of selectors) {
            const items = document.querySelectorAll(selector);
            allItems = allItems.concat(Array.from(items));
          }
          
          // Remove duplicates
          allItems = [...new Set(allItems)];
          
          console.log('Found', allItems.length, 'potential email items');
          
          for (const item of allItems) {
            const text = (item.innerText || item.textContent || '').toLowerCase();
            console.log('Checking item with text:', text.substring(0, 100));
            
            if (text.includes('latenode') || text.includes('confirm')) {
              console.log('Found Latenode email, clicking...');
              item.click();
              return true;
            }
          }
          
          // If no specific match, try clicking the first clickable email item
          for (const item of allItems) {
            if (item.tagName === 'A' || item.onclick || item.getAttribute('href')) {
              console.log('Clicking first available email item');
              item.click();
              return true;
            }
          }
          
          return false;
        });
        
        if (emailClicked) {
          addDebugStep('Email Check', 'success', 'Clicked on Latenode email using JavaScript evaluation');
          emailFound = true;
        }
      }
      
      if (!emailFound) {
        addDebugStep('Email Check', 'error', '❌ CRITICAL: Could not find Latenode confirmation email after multiple attempts - stopping process');
        throw new Error('Latenode confirmation email not found - this step is obligatory');
      }
      
      await sleep(3000);
      await takeScreenshot('Email-Opened', tempMailPage);
      
      // Extract the confirmation code with scrolling
      addDebugStep('Code Extraction', 'info', 'Extracting confirmation code from email...');
      
      // First, scroll down in the email to make sure we see all content
      addDebugStep('Code Extraction', 'info', 'Scrolling down in email to find confirmation code...');
      
      // Use Puppeteer's scrolling method for more reliable scrolling
      await tempMailPage.evaluate(() => {
        window.scrollTo(0, 0); // Start at top
      });
      
      // Scroll down gradually using Puppeteer
      for (let i = 0; i < 10; i++) {
        await tempMailPage.mouse.wheel({ deltaY: 200 });
        await sleep(200);
      }
      
      // Scroll down gradually to ensure all content is loaded
      await tempMailPage.evaluate(() => {
        // First scroll to the very bottom
        window.scrollTo(0, document.body.scrollHeight);
      });
      
      await sleep(1000);
      
      // Scroll up to find the confirmation code area
      await tempMailPage.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight - 800);
        
        // Try to find and scroll to the confirmation code specifically
        const confirmationElements = document.querySelectorAll('*');
        for (const element of confirmationElements) {
          const text = element.textContent || element.innerText || '';
          if (text.toLowerCase().includes('confirmation code') || text.toLowerCase().includes('confirm your email')) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            break;
          }
        }
      });
      
      await sleep(3000); // Wait longer for scrolling to complete
      
      // Take a screenshot after scrolling to see the full email content
      await takeScreenshot('Email-After-Scroll', tempMailPage);
      
      // Debug: Capture modal structure for ChatGPT
      addDebugStep('Code Extraction', 'info', 'Debugging modal structure...');
      const modalDebugInfo = await tempMailPage.evaluate(() => {
        // Find all potential modal containers
        const modalSelectors = [
          'div[role="dialog"]',
          '.modal',
          '.ReactModal__Content',
          '[class*="modal"]',
          '[class*="Modal"]',
          '[class*="dialog"]',
          '[class*="Dialog"]',
          '[class*="popup"]',
          '[class*="Popup"]',
          '[class*="overlay"]',
          '[class*="Overlay"]'
        ];
        
        const modals = [];
        for (const selector of modalSelectors) {
          const elements = document.querySelectorAll(selector);
          for (const el of elements) {
            const text = el.innerText || el.textContent || '';
            if (text.includes('Back to home') || text.includes('Delete') || text.includes('Confirmation code')) {
              modals.push({
                selector: selector,
                tagName: el.tagName,
                className: el.className,
                id: el.id,
                role: el.getAttribute('role'),
                textContent: text.substring(0, 200),
                hasIframe: !!el.querySelector('iframe'),
                iframeCount: el.querySelectorAll('iframe').length
              });
            }
          }
        }
        
        // Also check for any iframes
        const iframes = Array.from(document.querySelectorAll('iframe')).map(iframe => ({
          src: iframe.src,
          id: iframe.id,
          className: iframe.className,
          hasContent: iframe.contentDocument ? true : false
        }));
        
        return {
          modals: modals,
          iframes: iframes,
          allElementsWithText: Array.from(document.querySelectorAll('*')).filter(el => {
            const text = el.innerText || el.textContent || '';
            return text.includes('Confirmation code') || text.includes('Back to home') || text.includes('Delete');
          }).map(el => {
            const text = el.innerText || el.textContent || '';
            return {
              tagName: el.tagName,
              className: el.className,
              id: el.id,
              role: el.getAttribute('role'),
              textContent: text.substring(0, 100)
            };
          }).slice(0, 10)
        };
      });
      
      addDebugStep('Code Extraction', 'info', 'Modal debug info:', null, JSON.stringify(modalDebugInfo, null, 2));
      
      // Extract confirmation code using genius DOM analysis
      addDebugStep('Code Extraction', 'info', 'Using genius DOM extraction methods...');
      try {
        confirmationCode = await extractCodeWithDOMAnalysis(tempMailPage);
        if (confirmationCode) {
          addDebugStep('Code Extraction', 'success', `✅ Confirmation code extracted via DOM analysis: ${confirmationCode}`);
        } else {
          addDebugStep('Code Extraction', 'error', `❌ DOM extraction failed - no code found`);
        }
      } catch (error) {
        addDebugStep('Code Extraction', 'error', `❌ DOM extraction failed: ${error.message}`);
        // Fallback to basic text search
        addDebugStep('Code Extraction', 'info', 'Falling back to basic text search...');
        try {
          confirmationCode = await extractCodeTempmail100(tempMailPage, { 
            timeout: 30000,
            log: (msg) => addDebugStep('Code Extraction', 'info', msg)
          });
          addDebugStep('Code Extraction', 'success', `✅ Confirmation code extracted via DOM: ${confirmationCode}`);
        } catch (domError) {
          addDebugStep('Code Extraction', 'error', `❌ DOM extraction also failed: ${domError.message}`);
          confirmationCode = null;
        }
      }
      
      if (confirmationCode) {
        addDebugStep('Code Extraction', 'success', `Confirmation code extracted: ${confirmationCode}`);
        // Break out of the retry loop since we found the confirmation code
        break;
      } else {
        addDebugStep('Code Extraction', 'error', '❌ CRITICAL: Could not extract confirmation code from email - stopping process');
        throw new Error('Confirmation code extraction failed - this step is obligatory');
      }
      
    } catch (error) {
      addDebugStep('Email Check', 'error', 'Could not find or open Latenode email', null, error.message);
      
      // If this is not the last retry, try again
      if (retryCount < maxRetries) {
        addDebugStep('Email Check', 'info', `Retrying Latenode email sending process (attempt ${retryCount + 1}/${maxRetries})...`);
        
        // Go back to Latenode tab
        const latenodePage = await browser.pages().find(p => p.url().includes('latenode.com'));
        if (latenodePage) {
          await latenodePage.bringToFront();
          addDebugStep('Email Check', 'info', 'Switched back to Latenode tab');
          
          // Re-enter email and click Next
          addDebugStep('Email Check', 'info', 'Re-entering email and clicking Next...');
          
          // Find email field and re-enter
          const emailField = await latenodePage.$('input[type="email"], input[name="email"], input[data-test-id="authEmailInput"]');
          if (emailField) {
            await emailField.click();
            await emailField.click({ clickCount: 3 }); // Select all
            await sleep(200);
            await emailField.type(email);
            await sleep(500);
            
            // Click Next button again
            const nextButton = await latenodePage.$('button[data-test-id="authEmailButton"]');
            if (nextButton) {
              await nextButton.click();
              addDebugStep('Email Check', 'info', 'Re-clicked Next button to resend email');
              await sleep(3000);
            }
          }
        }
        
        // Continue to next iteration of the retry loop
        continue;
      } else {
        // Last retry failed, throw error
        throw new Error(`Email check failed after ${maxRetries} retries: ${error.message}`);
      }
    }
    } // End of retry loop
    
    // Step 7: Switch back to Latenode tab and enter confirmation code
    addDebugStep('Code Entry', 'info', 'Switching back to Latenode tab to enter confirmation code...');
    
    // Switch back to the original Latenode page
    await page.bringToFront();
    await sleep(2000);
    
    // Find and fill the confirmation code field with smart validation
    addDebugStep('Code Entry', 'info', `Entering confirmation code: ${confirmationCode}`);
    
    // First, clear the field completely
    await page.evaluate(() => {
      const codeInput = document.querySelector('input[placeholder*="code" i], input[placeholder*="confirmation" i], input[data-test-id*="code" i], input[type="text"][maxlength="4"]');
      if (codeInput) {
        codeInput.focus();
        codeInput.select();
        codeInput.value = '';
        // Trigger events to clear any validation state
        codeInput.dispatchEvent(new Event('input', { bubbles: true }));
        codeInput.dispatchEvent(new Event('change', { bubbles: true }));
        codeInput.dispatchEvent(new Event('blur', { bubbles: true }));
      }
    });
    
    await sleep(500);
    
    // Now type the code character by character to ensure proper validation
    addDebugStep('Code Entry', 'info', 'Typing confirmation code character by character...');
    
    // Find the code input field first
    const codeInputSelector = await page.evaluate(() => {
      const selectors = [
        'input[placeholder*="code" i]',
        'input[placeholder*="confirmation" i]',
        'input[data-test-id*="code" i]',
        'input[type="text"][maxlength="4"]',
        'input[type="text"]'
      ];
      
      for (const selector of selectors) {
        const input = document.querySelector(selector);
        if (input) {
          return selector;
        }
      }
      return null;
    });
    
    if (!codeInputSelector) {
      addDebugStep('Code Entry', 'error', '❌ CRITICAL: Could not find confirmation code input field - stopping process');
      throw new Error('Confirmation code input field not found - this step is obligatory');
    }
    
    addDebugStep('Code Entry', 'info', `Found code input with selector: ${codeInputSelector}`);
    
    // Type the code character by character
    await page.type(codeInputSelector, confirmationCode, { delay: 200 });
    
    await sleep(1000);
    
    // Verify the code was entered and check if Verify button is now visible
    const codeValidation = await page.evaluate((expectedCode) => {
      const codeInput = document.querySelector('input[placeholder*="code" i], input[placeholder*="confirmation" i], input[data-test-id*="code" i], input[type="text"][maxlength="4"]');
      const enteredCode = codeInput ? codeInput.value : null;
      
      // Check if Verify button is visible and enabled
      const verifyButtonSelectors = [
        'button[type="submit"]',
        'button',
        'input[type="submit"]',
        '[role="button"]'
      ];
      
      let verifyButton = null;
      for (const selector of verifyButtonSelectors) {
        const button = document.querySelector(selector);
        if (button) {
          const text = (button.innerText || button.textContent || '').toLowerCase();
          if (text.includes('verify') || text.includes('vérifier') || text.includes('submit') || text.includes('continue')) {
            verifyButton = button;
            break;
          }
        }
      }
      
      const isVerifyButtonVisible = verifyButton && verifyButton.offsetParent !== null;
      const isVerifyButtonEnabled = verifyButton && !verifyButton.disabled && !verifyButton.classList.contains('disabled');
      
      // Check for any validation errors
      const hasValidationError = document.querySelector('.error, .invalid, [class*="error"], [class*="invalid"]') !== null;
      
      return {
        enteredCode: enteredCode,
        isCorrect: enteredCode === expectedCode,
        isVerifyButtonVisible: isVerifyButtonVisible,
        isVerifyButtonEnabled: isVerifyButtonEnabled,
        hasValidationError: hasValidationError,
        verifyButtonText: verifyButton ? verifyButton.innerText : null
      };
    }, confirmationCode);
    
    addDebugStep('Code Entry', 'info', `Code validation results:`, null, JSON.stringify(codeValidation, null, 2));
    
    if (codeValidation.isCorrect) {
      addDebugStep('Code Entry', 'success', `Confirmation code successfully entered: ${codeValidation.enteredCode}`);
    } else {
      addDebugStep('Code Entry', 'error', `❌ CRITICAL: Code verification failed. Expected: ${confirmationCode}, Got: ${codeValidation.enteredCode} - stopping process`);
      throw new Error('Confirmation code input failed - this step is obligatory');
    }
    
    if (codeValidation.hasValidationError) {
      addDebugStep('Code Entry', 'warning', 'Validation error detected on page');
    }
    
    if (codeValidation.isVerifyButtonVisible && codeValidation.isVerifyButtonEnabled) {
      addDebugStep('Code Entry', 'success', 'Verify button is visible and enabled - code validation successful!');
    } else {
      addDebugStep('Code Entry', 'warning', `Verify button status - Visible: ${codeValidation.isVerifyButtonVisible}, Enabled: ${codeValidation.isVerifyButtonEnabled}`);
      
      // Try alternative code input method if Verify button is not visible
      addDebugStep('Code Entry', 'info', 'Trying alternative code input method...');
      
      await page.evaluate((code) => {
        const codeInput = document.querySelector('input[placeholder*="code" i], input[placeholder*="confirmation" i], input[data-test-id*="code" i], input[type="text"][maxlength="4"]');
        if (codeInput) {
          // Clear and set value using different approach
          codeInput.focus();
          codeInput.value = '';
          
          // Simulate typing
          for (let i = 0; i < code.length; i++) {
            codeInput.value = code.substring(0, i + 1);
            codeInput.dispatchEvent(new Event('input', { bubbles: true }));
            codeInput.dispatchEvent(new Event('keyup', { bubbles: true }));
          }
          
          // Final validation events
          codeInput.dispatchEvent(new Event('change', { bubbles: true }));
          codeInput.dispatchEvent(new Event('blur', { bubbles: true }));
          codeInput.dispatchEvent(new Event('focus', { bubbles: true }));
          
          // Force validation
          if (codeInput.checkValidity) {
            codeInput.checkValidity();
          }
        }
      }, confirmationCode);
      
      await sleep(2000);
      
      // Check again after alternative method
      const revalidation = await page.evaluate(() => {
        const verifyButtonSelectors = [
          'button[type="submit"]',
          'button',
          'input[type="submit"]',
          '[role="button"]'
        ];
        
        let verifyButton = null;
        for (const selector of verifyButtonSelectors) {
          const button = document.querySelector(selector);
          if (button) {
            const text = (button.innerText || button.textContent || '').toLowerCase();
            if (text.includes('verify') || text.includes('vérifier') || text.includes('submit') || text.includes('continue')) {
              verifyButton = button;
              break;
            }
          }
        }
        
        return {
          isVerifyButtonVisible: verifyButton && verifyButton.offsetParent !== null,
          isVerifyButtonEnabled: verifyButton && !verifyButton.disabled && !verifyButton.classList.contains('disabled')
        };
      });
      
      if (revalidation.isVerifyButtonVisible && revalidation.isVerifyButtonEnabled) {
        addDebugStep('Code Entry', 'success', 'Verify button is now visible after alternative input method!');
      } else {
        addDebugStep('Code Entry', 'error', '❌ CRITICAL: Verify button still not visible after alternative input method - stopping process');
        throw new Error('Confirmation code validation failed - Verify button not becoming visible - this step is obligatory');
      }
    }
    
    await takeScreenshot('Code-Entered', page);
    
    // Click Verify button (we already verified it's visible and enabled)
    addDebugStep('Code Entry', 'info', 'Clicking Verify button...');
    
    // Take a screenshot before attempting to click the Verify button
    await takeScreenshot('Before-Verify-Click', page);
    
    try {
      // Find and click the Verify button using proper selectors
      const verifyButtonClicked = await page.evaluate(() => {
        const verifyButtonSelectors = [
          'button[type="submit"]',
          'button',
          'input[type="submit"]',
          '[role="button"]'
        ];
        
        for (const selector of verifyButtonSelectors) {
          const buttons = document.querySelectorAll(selector);
          for (const button of buttons) {
            const text = (button.innerText || button.textContent || '').toLowerCase();
            if (text.includes('verify') || text.includes('vérifier') || text.includes('submit') || text.includes('continue')) {
              button.click();
              return true;
            }
          }
        }
        return false;
      });
      
      if (verifyButtonClicked) {
        addDebugStep('Code Entry', 'success', 'Clicked Verify button successfully');
      } else {
        addDebugStep('Code Entry', 'error', '❌ CRITICAL: Could not find or click Verify button - stopping process');
        throw new Error('Verify button not found or not clickable - this step is obligatory');
      }
      
      // Wait for page to update to password creation
      await page.waitForFunction(() => {
        return document.querySelector('input[type="password"], input[name="password"]') !== null;
      }, { timeout: 15000 });
      
      addDebugStep('Code Entry', 'success', 'Page updated to password creation step');
      await takeScreenshot('Password-Creation-Page', page);
      
    } catch (error) {
      // Take a screenshot before throwing the error to help with debugging
      await takeScreenshot('Code-Entry-Error', page);
      addDebugStep('Code Entry', 'error', '❌ CRITICAL: Could not find Verify button or page did not update - stopping process', null, error.message);
      throw new Error(`Code verification failed: ${error.message}`);
    }
    
    // Step 8: Fill in password fields with smart logic
    addDebugStep('Password Entry', 'info', 'Filling in password fields...');
    
    // Wait for password form to be visible
    await page.waitForSelector('input[type="password"], input[name*="password"], input[placeholder*="password" i]', { timeout: 10000 });
    
    addDebugStep('Password Entry', 'info', `Entering password: ${generatedPassword}`);
    
    // Fill password fields using page.type for character-by-character typing
    addDebugStep('Password Entry', 'info', 'Filling password field 1 (password)...');
    
    // Fill first password field with character-by-character typing
    await page.waitForSelector('input[name="password"], input[data-test-id="passwordInput"]', { timeout: 5000 });
    
    // Clear the field first
    await page.evaluate(() => {
      const field = document.querySelector('input[name="password"], input[data-test-id="passwordInput"]');
      if (field) {
        field.focus();
        field.value = '';
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    
    // Type character by character
    await page.type('input[name="password"], input[data-test-id="passwordInput"]', generatedPassword, { delay: 100 });
    
    // Verify first field
    const field1Value = await page.evaluate(() => {
      const field = document.querySelector('input[name="password"], input[data-test-id="passwordInput"]');
      return field ? field.value : '';
    });
    addDebugStep('Password Entry', 'info', `Password field 1 value: ${field1Value ? 'FILLED' : 'EMPTY'}`);
    
    await page.waitForTimeout(500);
    
    addDebugStep('Password Entry', 'info', 'Filling password field 2 (newPassword)...');
    
    // Fill second password field with character-by-character typing
    await page.waitForSelector('input[name="newPassword"], input[data-test-id="newPasswordInput"]', { timeout: 5000 });
    
    // Clear the field first
    await page.evaluate(() => {
      const field = document.querySelector('input[name="newPassword"], input[data-test-id="newPasswordInput"]');
      if (field) {
        field.focus();
        field.value = '';
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    
    // Type character by character
    await page.type('input[name="newPassword"], input[data-test-id="newPasswordInput"]', generatedPassword, { delay: 100 });
    
    // Verify second field
    const field2Value = await page.evaluate(() => {
      const field = document.querySelector('input[name="newPassword"], input[data-test-id="newPasswordInput"]');
      return field ? field.value : '';
    });
    addDebugStep('Password Entry', 'info', `Password field 2 value: ${field2Value ? 'FILLED' : 'EMPTY'}`);
    
    await page.waitForTimeout(500);
    
    // Final verification using specific selectors
    const field1Final = await page.evaluate(() => {
      const field = document.querySelector('input[name="password"], input[data-test-id="passwordInput"]');
      return field ? field.value : '';
    });
    
    const field2Final = await page.evaluate(() => {
      const field = document.querySelector('input[name="newPassword"], input[data-test-id="newPasswordInput"]');
      return field ? field.value : '';
    });
    
    addDebugStep('Password Entry', 'info', `Final verification - Field 1: ${field1Final ? 'FILLED' : 'EMPTY'}, Field 2: ${field2Final ? 'FILLED' : 'EMPTY'}`);
    
    if (!field1Final || !field2Final) {
      addDebugStep('Password Entry', 'warning', 'Some fields still empty, attempting final fill...');
      
      // Final attempt to fill empty fields using page.type
      if (!field1Final) {
        addDebugStep('Password Entry', 'info', 'Refilling password field 1 with page.type...');
        await page.evaluate(() => {
          const field = document.querySelector('input[name="password"], input[data-test-id="passwordInput"]');
          if (field) {
            field.focus();
            field.value = '';
          }
        });
        await page.type('input[name="password"], input[data-test-id="passwordInput"]', generatedPassword, { delay: 100 });
      }
      
      if (!field2Final) {
        addDebugStep('Password Entry', 'info', 'Refilling password field 2 with page.type...');
        await page.evaluate(() => {
          const field = document.querySelector('input[name="newPassword"], input[data-test-id="newPasswordInput"]');
          if (field) {
            field.focus();
            field.value = '';
          }
        });
        await page.type('input[name="newPassword"], input[data-test-id="newPasswordInput"]', generatedPassword, { delay: 100 });
      }
    }
    
    addDebugStep('Password Entry', 'success', 'All password fields filled successfully');
    
    await sleep(1000);
    await takeScreenshot('Password-Entered', page);
    
    // Step 9: Click Save button
    addDebugStep('Registration', 'info', 'Looking for Save button...');
    
    try {
      // Look for Save button span first, then fallback to button itself
      const saveButtonSelectors = [
        'button[data-test-id="saveNewPassword"] span',
        'button[data-test-id="saveNewPassword"]',
        'button:has-text("Save")',
        'button:has-text("Register")',
        'button:has-text("Sign Up")',
        'button:has-text("Enregistrer")',
        'button[type="submit"]'
      ];
      
      let saveButton = null;
      let usedSelector = '';
      
      for (const selector of saveButtonSelectors) {
        try {
          saveButton = await page.$(selector);
          if (saveButton) {
            usedSelector = selector;
            addDebugStep('Registration', 'info', `Found Save button with selector: ${selector}`);
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      if (!saveButton) {
        throw new Error('Could not find Save button');
      }
      
      await saveButton.click();
      addDebugStep('Registration', 'success', `Clicked Save button using selector: ${usedSelector}`);
      
      // Wait for successful registration or dashboard
      await page.waitForFunction(() => {
        const url = window.location.href;
        return url.includes('dashboard') || url.includes('home') || url.includes('projects') || 
               document.querySelector('[class*="dashboard"], [class*="welcome"], [class*="success"]') !== null;
      }, { timeout: 30000 });
      
      addDebugStep('Registration', 'success', 'Successfully registered and reached dashboard');
      await takeScreenshot('Registration-Success', page);
      
      // Step 8: Upload JSON scenario file
      addDebugStep('File Upload', 'info', 'Starting JSON scenario file upload...');
      
      try {
        // Wait for page to fully load
        await sleep(5000);
        
        // Take a screenshot to see the current state of the page
        await takeScreenshot('Before-Import-Button-Search', page);
        
        // Wait for the dashboard to be fully loaded - check for common elements
        try {
          await page.waitForFunction(() => {
            return document.querySelector('button') !== null || 
                   document.body.innerText.includes('scenario') ||
                   document.body.innerText.includes('Import');
          }, { timeout: 10000 });
          addDebugStep('File Upload', 'info', 'Page appears to be loaded');
        } catch (e) {
          addDebugStep('File Upload', 'warning', 'Could not confirm page load, proceeding anyway');
        }
        
        // Look for the import button using proper Puppeteer selectors
        let importButton = null;
        
        // Try multiple methods to find "Import a folder or scenario" button
        // Method 1: Use data-test-id (most reliable)
        try {
          await page.waitForSelector('button[data-test-id="importFolderOrScenarioButton"]', { timeout: 5000, visible: true });
          importButton = await page.$('button[data-test-id="importFolderOrScenarioButton"]');
          if (importButton) {
            addDebugStep('File Upload', 'info', 'Found "Import a folder or scenario" button using data-test-id');
          }
        } catch (e) {
          addDebugStep('File Upload', 'info', 'data-test-id selector not found, trying other methods...');
        }
        
        // Method 2: Try text-based search using page.evaluate
        if (!importButton) {
          const buttonInfo = await page.evaluate(() => {
            const buttons = document.querySelectorAll('button, [role="button"]');
            for (const button of buttons) {
              const text = (button.innerText || button.textContent || '').trim();
              const dataTestId = button.getAttribute('data-test-id') || '';
              
              // Look for "Import a folder or scenario" text or data-test-id
              if (dataTestId === 'importFolderOrScenarioButton' || 
                  text.toLowerCase().includes('import a folder') ||
                  (text.toLowerCase().includes('import') && text.toLowerCase().includes('scenario'))) {
                // Return button information so we can find it with selectors
                return {
                  found: true,
                  dataTestId: dataTestId,
                  text: text,
                  hasDataTestId: dataTestId === 'importFolderOrScenarioButton'
                };
              }
            }
            return { found: false };
          });
          
          if (buttonInfo && buttonInfo.found) {
            addDebugStep('File Upload', 'info', `Button found via evaluate: "${buttonInfo.text}"`);
            
            // Try to get the button using data-test-id first
            if (buttonInfo.hasDataTestId) {
              importButton = await page.$('button[data-test-id="importFolderOrScenarioButton"]');
              if (importButton) {
                addDebugStep('File Upload', 'info', 'Found button using data-test-id after evaluate');
              }
            }
            
            // If not found, try XPath by text
            if (!importButton) {
              const elements = await page.$x('//button[contains(., "Import a folder or scenario")] | //button[contains(., "Import") and contains(., "scenario")]');
              if (elements.length > 0) {
                importButton = elements[0];
                addDebugStep('File Upload', 'info', 'Found "Import a folder or scenario" button using XPath text search');
              }
            }
          }
        }
        
        // Method 3: Try XPath selectors
        if (!importButton) {
          try {
            const xpathSelectors = [
              '//button[@data-test-id="importFolderOrScenarioButton"]',
              '//button[contains(., "Import a folder or scenario")]',
              '//button[contains(., "Import") and contains(., "scenario")]'
            ];
            
            for (const xpath of xpathSelectors) {
              const elements = await page.$x(xpath);
              if (elements.length > 0) {
                importButton = elements[0];
                addDebugStep('File Upload', 'info', `Found import button with XPath: ${xpath}`);
                break;
              }
            }
          } catch (e) {
            addDebugStep('File Upload', 'warning', 'XPath search failed', null, e.message);
          }
        }
        
        if (importButton) {
          addDebugStep('File Upload', 'info', 'Found import button, clicking...');
          await importButton.click();
          await sleep(3000);
          
          // Take screenshot after clicking to see what appeared
          await takeScreenshot('After-Import-Click', page);
          
          // Wait for modal/dialog to appear (if any)
          try {
            await page.waitForSelector('div[role="dialog"], div.ant-modal, div[class*="modal"], div[class*="Modal"]', { timeout: 5000 });
            addDebugStep('File Upload', 'info', 'Modal/dialog detected after clicking import');
            await sleep(2000);
          } catch (e) {
            addDebugStep('File Upload', 'info', 'No modal detected, checking for file input directly');
          }
          
          // Try multiple selectors and wait strategies for file input
          let fileInput = null;
          const fileInputSelectors = [
            'input[type="file"]',
            'input[accept*="json"]',
            'input[accept*=".json"]',
            'input[type="file"][accept*="json"]',
            'div[role="dialog"] input[type="file"]',
            'div.ant-modal input[type="file"]',
            'div[class*="modal"] input[type="file"]',
            'div[class*="Modal"] input[type="file"]'
          ];
          
          for (const selector of fileInputSelectors) {
            try {
              await page.waitForSelector(selector, { timeout: 3000, visible: true });
              fileInput = await page.$(selector);
              if (fileInput) {
                addDebugStep('File Upload', 'info', `File input found with selector: ${selector}`);
                break;
              }
            } catch (e) {
              continue;
            }
          }
          
          // If still no file input, try to find it in the page using evaluate
          if (!fileInput) {
            addDebugStep('File Upload', 'info', 'File input not found with selectors, trying evaluate method...');
            const inputFound = await page.evaluate(() => {
              const inputs = document.querySelectorAll('input');
              for (const input of inputs) {
                if (input.type === 'file') {
                  return true;
                }
              }
              return false;
            });
            
            if (inputFound) {
              fileInput = await page.$('input[type="file"]');
              addDebugStep('File Upload', 'info', 'File input found using evaluate method');
            }
          }
          
          if (!fileInput) {
            addDebugStep('File Upload', 'warning', 'File input not found after clicking import button');
            throw new Error('File input not found - modal may not have appeared or selector changed');
          }
          
          addDebugStep('File Upload', 'info', 'File input found, preparing to upload JSON...');
          
          // Read JSON file from filesystem
          const jsonFilePath = path.join(__dirname, 'public', 'latenode-scenario.json');
          
          let jsonContent;
          try {
            jsonContent = fs.readFileSync(jsonFilePath, 'utf8');
            addDebugStep('File Upload', 'info', 'JSON file read from filesystem successfully');
          } catch (error) {
            addDebugStep('File Upload', 'error', `Failed to read JSON file: ${error.message}`);
            throw new Error(`Failed to read JSON file: ${error.message}`);
          }
          
          // Upload the JSON file using file input directly
          try {
            await fileInput.uploadFile(jsonFilePath);
            addDebugStep('File Upload', 'info', 'JSON file uploaded using uploadFile method');
            await sleep(1000);
            
            // Trigger change event multiple ways to ensure it's detected
            await page.evaluate(() => {
              const fileInput = document.querySelector('input[type="file"]');
              if (fileInput) {
                fileInput.dispatchEvent(new Event('change', { bubbles: true }));
                fileInput.dispatchEvent(new Event('input', { bubbles: true }));
                // Also try to trigger any attached handlers
                if (fileInput.onchange) {
                  fileInput.onchange();
                }
              }
            });
            await sleep(2000);
          } catch (uploadError) {
            addDebugStep('File Upload', 'warning', `uploadFile method failed: ${uploadError.message}, trying alternative method...`);
            
            // Fallback: use evaluate method with file content
            const uploadSuccess = await page.evaluate(async (content) => {
              try {
                const blob = new Blob([content], { type: 'application/json' });
                const file = new File([blob], 'latenode-scenario.json', { type: 'application/json' });
                
                const fileInput = document.querySelector('input[type="file"]');
                if (fileInput) {
                  const dataTransfer = new DataTransfer();
                  dataTransfer.items.add(file);
                  fileInput.files = dataTransfer.files;
                  
                  // Trigger multiple events
                  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
                  fileInput.dispatchEvent(new Event('input', { bubbles: true }));
                  
                  if (fileInput.onchange) {
                    fileInput.onchange();
                  }
                  
                  console.log('JSON file uploaded successfully');
                  return true;
                } else {
                  throw new Error('File input not found');
                }
              } catch (error) {
                console.error('Error uploading JSON file:', error);
                return false;
              }
            }, jsonContent);
            
            if (!uploadSuccess) {
              throw new Error('Failed to upload JSON file using both methods');
            }
            addDebugStep('File Upload', 'info', 'JSON file uploaded using alternative method');
          }
          
          addDebugStep('File Upload', 'success', 'JSON scenario file uploaded successfully!');
          await takeScreenshot('JSON-File-Uploaded', page);
          
          // Wait a bit for the upload to process
          await sleep(3000);
          
          // Step 8b: Click "Ready" button in the import modal
          addDebugStep('Import Ready', 'info', 'Looking for "Ready" button in import modal...');
          
          try {
            // Wait for the import modal to appear with the "Ready" button
            await page.waitForSelector('div[role="dialog"], div.ant-modal', { timeout: 10000 });
            await sleep(2000);
            
            // Look for "Ready" button
            const readyButtonClicked = await page.evaluate(() => {
              const buttons = document.querySelectorAll('button, [role="button"]');
              for (const button of buttons) {
                const text = (button.innerText || button.textContent || '').trim().toLowerCase();
                if (text === 'ready' || text.includes('ready')) {
                  button.click();
                  return true;
                }
              }
              return false;
            });
            
            if (readyButtonClicked) {
              addDebugStep('Import Ready', 'success', 'Clicked "Ready" button successfully');
              await sleep(3000); // Wait for modal to close and page to update
            } else {
              addDebugStep('Import Ready', 'warning', 'Could not find or click "Ready" button');
            }
          } catch (error) {
            addDebugStep('Import Ready', 'warning', 'Import modal or Ready button not found', null, error.message);
          }
          
          await takeScreenshot('After-Ready-Click', page);
          
        } else {
          // Last resort: try to find and click import button directly using page.evaluate()
          addDebugStep('File Upload', 'info', 'Trying to find and click import button directly using page.evaluate()...');
          
          try {
            // First take a screenshot to see what's on the page
            await takeScreenshot('Before-Import-Button-Search', page);
            
            const buttonInfo = await page.evaluate(() => {
              // First try the specific data-test-id selector
              const specificButton = document.querySelector('button[data-test-id="importFolderOrScenarioButton"]');
              if (specificButton && specificButton.offsetParent !== null) {
                specificButton.click();
                return { clicked: true, method: 'data-test-id', text: specificButton.innerText || specificButton.textContent || '' };
              }
              
              // Look for buttons with import-related text - be more specific
              const buttons = document.querySelectorAll('button, [role="button"]');
              
              for (const button of buttons) {
                if (button.offsetParent === null) continue; // Skip hidden buttons
                
                const text = (button.innerText || button.textContent || '').trim().toLowerCase();
                const title = (button.title || '').toLowerCase();
                const className = (button.className || '').toLowerCase();
                const dataTestId = button.getAttribute('data-test-id') || '';
                
                // More specific matching
                if (dataTestId === 'importFolderOrScenarioButton' ||
                    text.includes('import a folder') ||
                    (text.includes('import') && text.includes('scenario')) ||
                    (text.includes('import') && text.includes('folder'))) {
                  button.click();
                  return { clicked: true, method: 'text-match', text: button.innerText || button.textContent || '' };
                }
              }
              
              return { clicked: false, error: 'No matching button found' };
            });
            
            if (buttonInfo && buttonInfo.clicked) {
              addDebugStep('File Upload', 'success', `Found and clicked import button using ${buttonInfo.method}: "${buttonInfo.text}"`);
              await sleep(3000);
              
              // Take screenshot after clicking
              await takeScreenshot('After-Import-Click-Evaluate', page);
              
              // Wait for modal/dialog to appear (if any)
              try {
                await page.waitForSelector('div[role="dialog"], div.ant-modal, div[class*="modal"], div[class*="Modal"]', { timeout: 5000 });
                addDebugStep('File Upload', 'info', 'Modal/dialog detected after clicking import');
                await sleep(2000);
              } catch (e) {
                addDebugStep('File Upload', 'info', 'No modal detected, checking for file input directly');
              }
              
              // Try multiple selectors for file input
              let fileInput = null;
              const fileInputSelectors = [
                'input[type="file"]',
                'input[accept*="json"]',
                'input[accept*=".json"]',
                'input[type="file"][accept*="json"]',
                'div[role="dialog"] input[type="file"]',
                'div.ant-modal input[type="file"]',
                'div[class*="modal"] input[type="file"]',
                'div[class*="Modal"] input[type="file"]'
              ];
              
              for (const selector of fileInputSelectors) {
                try {
                  await page.waitForSelector(selector, { timeout: 3000, visible: true });
                  fileInput = await page.$(selector);
                  if (fileInput) {
                    addDebugStep('File Upload', 'info', `File input found with selector: ${selector}`);
                    break;
                  }
                } catch (e) {
                  continue;
                }
              }
              
              if (!fileInput) {
                addDebugStep('File Upload', 'warning', 'File input not found after clicking import button');
                throw new Error('File input not found - modal may not have appeared or selector changed');
              }
              
              addDebugStep('File Upload', 'info', 'File input found, preparing to upload JSON...');
              
              // Read JSON file from filesystem
              const jsonFilePath = path.join(__dirname, 'public', 'latenode-scenario.json');
              
              let jsonContent;
              try {
                jsonContent = fs.readFileSync(jsonFilePath, 'utf8');
                addDebugStep('File Upload', 'info', 'JSON file read from filesystem successfully');
              } catch (error) {
                addDebugStep('File Upload', 'error', `Failed to read JSON file: ${error.message}`);
                throw new Error(`Failed to read JSON file: ${error.message}`);
              }
              
              // Upload the JSON file using file input directly
              try {
                await fileInput.uploadFile(jsonFilePath);
                addDebugStep('File Upload', 'info', 'JSON file uploaded using uploadFile method');
                await sleep(1000);
                
                // Trigger change event multiple ways
                await page.evaluate(() => {
                  const fileInput = document.querySelector('input[type="file"]');
                  if (fileInput) {
                    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
                    fileInput.dispatchEvent(new Event('input', { bubbles: true }));
                    if (fileInput.onchange) {
                      fileInput.onchange();
                    }
                  }
                });
                await sleep(2000);
              } catch (uploadError) {
                addDebugStep('File Upload', 'warning', `uploadFile method failed: ${uploadError.message}, trying alternative method...`);
                
                // Fallback: use evaluate method with file content
                const uploadSuccess = await page.evaluate(async (content) => {
                  try {
                    const blob = new Blob([content], { type: 'application/json' });
                    const file = new File([blob], 'latenode-scenario.json', { type: 'application/json' });
                    
                    const fileInput = document.querySelector('input[type="file"]');
                    if (fileInput) {
                      const dataTransfer = new DataTransfer();
                      dataTransfer.items.add(file);
                      fileInput.files = dataTransfer.files;
                      
                      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
                      fileInput.dispatchEvent(new Event('input', { bubbles: true }));
                      
                      if (fileInput.onchange) {
                        fileInput.onchange();
                      }
                      
                      console.log('JSON file uploaded successfully');
                      return true;
                    } else {
                      throw new Error('File input not found');
                    }
                  } catch (error) {
                    console.error('Error uploading JSON file:', error);
                    return false;
                  }
                }, jsonContent);
                
                if (!uploadSuccess) {
                  throw new Error('Failed to upload JSON file using both methods');
                }
                addDebugStep('File Upload', 'info', 'JSON file uploaded using alternative method');
              }
              
              addDebugStep('File Upload', 'success', 'JSON scenario file uploaded successfully!');
              await takeScreenshot('JSON-File-Uploaded', page);
              
              // Wait a bit for the upload to process
              await sleep(3000);
              
              // Step 8b: Click "Ready" button in the import modal
              addDebugStep('Import Ready', 'info', 'Looking for "Ready" button in import modal...');
              
              try {
                // Wait for the import modal to appear with the "Ready" button
                await page.waitForSelector('div[role="dialog"], div.ant-modal', { timeout: 10000 });
                await sleep(2000);
                
                // Look for "Ready" button
                const readyButtonClicked = await page.evaluate(() => {
                  const buttons = document.querySelectorAll('button, [role="button"]');
                  for (const button of buttons) {
                    const text = (button.innerText || button.textContent || '').trim().toLowerCase();
                    if (text === 'ready' || text.includes('ready')) {
                      button.click();
                      return true;
                    }
                  }
                  return false;
                });
                
                if (readyButtonClicked) {
                  addDebugStep('Import Ready', 'success', 'Clicked "Ready" button successfully');
                  await sleep(3000); // Wait for modal to close and page to update
                } else {
                  addDebugStep('Import Ready', 'warning', 'Could not find or click "Ready" button');
                }
              } catch (error) {
                addDebugStep('Import Ready', 'warning', 'Import modal or Ready button not found', null, error.message);
              }
              
              await takeScreenshot('After-Ready-Click', page);
            } else {
              // Debug: log what buttons were found
              const buttonList = await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
                return buttons.map(btn => ({
                  text: (btn.innerText || btn.textContent || '').trim(),
                  dataTestId: btn.getAttribute('data-test-id') || '',
                  visible: btn.offsetParent !== null,
                  className: btn.className || ''
                })).filter(btn => btn.visible);
              });
              
              addDebugStep('File Upload', 'warning', `Import button not found. Found ${buttonList.length} visible buttons:`, null, JSON.stringify(buttonList.slice(0, 10), null, 2));
              addDebugStep('File Upload', 'warning', 'Skipping file upload - import button could not be located');
            }
          } catch (evaluateError) {
            addDebugStep('File Upload', 'warning', 'page.evaluate() method also failed', null, evaluateError.message);
          }
        }
        
      } catch (uploadError) {
        addDebugStep('File Upload', 'warning', 'File upload failed, but account creation was successful', null, uploadError.message);
      }
      
      // Step 9: Extract credits information
      addDebugStep('Credits Check', 'info', 'Checking for credits information...');
      
      try {
        // Wait for page to fully load after upload
        await sleep(2000);
        
        // First, hover over the progress circle to reveal the tooltip
        addDebugStep('Credits Check', 'info', 'Hovering over progress circle to reveal credits tooltip...');
        
        try {
          // Find the progress circle path element
          const progressCircle = await page.$('path.ant-progress-circle-path');
          if (progressCircle) {
            addDebugStep('Credits Check', 'info', 'Found progress circle, hovering over it...');
            
            // Hover over the progress circle to trigger the tooltip
            await progressCircle.hover();
            await sleep(2000); // Wait for tooltip to appear
            
            addDebugStep('Credits Check', 'info', 'Hovered over progress circle, waiting for tooltip...');
          } else {
            addDebugStep('Credits Check', 'warning', 'Progress circle not found, trying alternative approach...');
          }
        } catch (hoverError) {
          addDebugStep('Credits Check', 'warning', 'Error hovering over progress circle', null, hoverError.message);
        }
        
        // Look for credits information in the progress circle
        const creditsInfo = await page.evaluate(() => {
          // Method 1: Look for the progress circle percentage text
          const progressTextSelectors = [
            '.ant-progress-text',
            'span.ant-progress-text',
            '.ant-progress .ant-progress-text',
            '[class*="progress-text"]'
          ];
          
          for (const selector of progressTextSelectors) {
            const element = document.querySelector(selector);
            if (element) {
              const text = (element.innerText || element.textContent || '').trim();
              // Look for percentage pattern (e.g., "100%", "99%", "50%")
              if (/^\d+%$/.test(text)) {
                return {
                  found: true,
                  selector: selector,
                  text: text,
                  html: element.outerHTML,
                  source: 'progress-circle'
                };
              }
            }
          }
          
          // Method 2: Look for progress circle container and extract text
          const progressCircleSelectors = [
            '.ant-progress-circle',
            '.ant-progress.ant-progress-circle',
            '[class*="progress-circle"]'
          ];
          
          for (const selector of progressCircleSelectors) {
            const element = document.querySelector(selector);
            if (element) {
              const text = (element.innerText || element.textContent || '').trim();
              // Look for percentage pattern
              const percentageMatch = text.match(/(\d+%)/);
              if (percentageMatch) {
                return {
                  found: true,
                  selector: selector,
                  text: percentageMatch[1],
                  html: element.outerHTML,
                  source: 'progress-circle-container'
                };
              }
            }
          }
          
          // Method 3: Look for any element containing percentage
          const allElements = document.querySelectorAll('*');
          for (const element of allElements) {
            const text = (element.innerText || element.textContent || '').trim();
            // Look for percentage pattern that's not a date
            if (/^\d+%$/.test(text) && !text.includes('/') && !text.includes('-')) {
              return {
                found: true,
                selector: element.tagName.toLowerCase(),
                text: text,
                html: element.outerHTML,
                source: 'percentage-search'
              };
            }
          }
          
          return { found: false };
        });
        
        if (creditsInfo.found) {
          addDebugStep('Credits Check', 'success', `Credits found: ${creditsInfo.text}`);
          addDebugStep('Credits Check', 'info', `Using selector: ${creditsInfo.selector} (source: ${creditsInfo.source})`);
          
          // Extract the credit percentage (e.g., "100%", "99%")
          const creditMatch = creditsInfo.text.match(/(\d+%)/);
          if (creditMatch) {
            const credits = creditMatch[1];
            addDebugStep('Credits Check', 'success', `Credits extracted: ${credits}`);
            
            // Store credits for return
            global.credits = credits;
          } else {
            addDebugStep('Credits Check', 'warning', 'Could not extract credit percentage from text');
            global.credits = creditsInfo.text;
          }
          
          await takeScreenshot('Credits-Found', page);
        } else {
          addDebugStep('Credits Check', 'warning', 'Credits information not found on dashboard');
          global.credits = 'Not found';
        }
        
      } catch (creditsError) {
        addDebugStep('Credits Check', 'warning', 'Error checking credits', null, creditsError.message);
        global.credits = 'Error checking credits';
      }
      
    } catch (error) {
      addDebugStep('Registration', 'error', '❌ CRITICAL: Could not find Save button or registration failed - stopping process', null, error.message);
      throw new Error(`Registration failed: ${error.message}`);
    }
    
    addDebugStep('Account Creation', 'success', '✅ Latenode account creation process completed successfully!');
    addDebugStep('Account Creation', 'info', `📧 Email: ${tempEmail}`);
    addDebugStep('Account Creation', 'info', `🔑 Password: ${generatedPassword}`);
    addDebugStep('Account Creation', 'info', `🔢 Confirmation Code: ${confirmationCode}`);
    addDebugStep('Account Creation', 'info', `💰 Credits: ${global.credits || 'Not found'}`);
    
    // Step 10: Click on "Untitled" scenario to enter it
    addDebugStep('Scenario Entry', 'info', 'Looking for "Untitled" scenario to click...');
    
    try {
      await sleep(2000);
      
      // Wait for the scenario list to be visible
      await page.waitForSelector('div.nameCellWrapper_JCLK1, [class*="nameCell"], [class*="scenario"]', { timeout: 10000 }).catch(() => {});
      
      // Click on the Untitled scenario
      const untitledClicked = await page.evaluate(() => {
        // Method 1: Look for div with nameCellWrapper class
        const wrapperDivs = document.querySelectorAll('div.nameCellWrapper_JCLK1, div[class*="nameCell"], div[class*="scenario"]');
        for (const wrapper of wrapperDivs) {
          const text = (wrapper.innerText || wrapper.textContent || '').trim();
          if (text.toLowerCase().includes('untitled')) {
            wrapper.click();
            return true;
          }
        }
        
        // Method 2: Look for any clickable element containing "Untitled"
        const allElements = document.querySelectorAll('*');
        for (const element of allElements) {
          const text = (element.innerText || element.textContent || '').trim();
          if (text.toLowerCase() === 'untitled' && element.offsetParent !== null) {
            element.click();
            return true;
          }
        }
        
        return false;
      });
      
      if (untitledClicked) {
        addDebugStep('Scenario Entry', 'success', 'Clicked on "Untitled" scenario successfully');
        await sleep(3000); // Wait for scenario to load
      } else {
        addDebugStep('Scenario Entry', 'warning', 'Could not find or click "Untitled" scenario');
      }
    } catch (error) {
      addDebugStep('Scenario Entry', 'warning', 'Could not find "Untitled" scenario', null, error.message);
    }
    
    // Step 11: Take final screenshot to show where we are
    addDebugStep('Final Screenshot', 'info', 'Taking final screenshot to show current location...');
    await takeScreenshot('Final-Scenario-View', page);
    
    // Step 13: Right-click on the black Recraft node
    addDebugStep('Node Interaction', 'info', 'Right-clicking on the black Recraft node...');
    
    try {
      // Wait for the Recraft node to be visible
      await page.waitForSelector('svg.svgBackgroundIcon_szvXq[fill="#000000"]', { timeout: 10000 });
      
      // Right-click on the Recraft node
      await page.click('svg.svgBackgroundIcon_szvXq[fill="#000000"]', { button: 'right' });
      addDebugStep('Node Interaction', 'success', 'Right-clicked on Recraft node successfully');
      await sleep(2000); // Wait for context menu to appear
    } catch (error) {
      addDebugStep('Node Interaction', 'warning', 'Could not right-click Recraft node', null, error.message);
    }
    
    // Step 14: Click "Exécuter le nœud une fois" (Run node once)
    addDebugStep('Node Execution', 'info', 'Looking for "Exécuter le nœud une fois" in context menu...');
    
    try {
      // Wait for the context menu item
      await page.waitForSelector('div.menuItemContainer_fSy4s', { timeout: 10000 });
      
      // Click on "Exécuter le nœud une fois"
      const runNodeClicked = await page.evaluate(() => {
        const menuItems = document.querySelectorAll('div.menuItemContainer_fSy4s');
        for (const item of menuItems) {
          const text = item.innerText || item.textContent || '';
          if (text.includes('Exécuter le nœud une fois') || text.includes('Run node once')) {
            item.click();
            return true;
          }
        }
        return false;
      });
      
      if (runNodeClicked) {
        addDebugStep('Node Execution', 'success', 'Clicked "Exécuter le nœud une fois" successfully');
        await sleep(3000); // Wait for node to start running
      } else {
        addDebugStep('Node Execution', 'warning', 'Could not find or click "Exécuter le nœud une fois"');
      }
    } catch (error) {
      addDebugStep('Node Execution', 'warning', 'Error clicking run node once', null, error.message);
    }
    
    // Step 15: Wait for node to finish running and show counter
    addDebugStep('Node Execution', 'info', 'Waiting for node to finish running and show counter...');
    
    try {
      // Wait for the counter to appear
      await page.waitForSelector('div.counter_mFATl', { timeout: 30000 }); // Wait up to 30 seconds
      
      // Get the counter value
      const counterValue = await page.evaluate(() => {
        const counter = document.querySelector('div.counter_mFATl');
        return counter ? counter.textContent : null;
      });
      
      addDebugStep('Node Execution', 'success', `Node finished running! Counter shows: ${counterValue}`);
      await sleep(2000); // Wait a bit more
    } catch (error) {
      addDebugStep('Node Execution', 'warning', 'Node execution timeout or counter not found', null, error.message);
    }
    
    // Step 16: Click on the pink Trigger on Webhook node
    addDebugStep('Webhook Node', 'info', 'Clicking on the pink Trigger on Webhook node...');
    
    try {
      // Wait for the webhook node to be visible
      await page.waitForSelector('svg.svgBackgroundIcon_szvXq[fill="#C13584"]', { timeout: 10000 });
      
      // Click on the webhook node
      await page.click('svg.svgBackgroundIcon_szvXq[fill="#C13584"]');
      addDebugStep('Webhook Node', 'success', 'Clicked on Trigger on Webhook node successfully');
      await sleep(2000); // Wait for properties panel to open
    } catch (error) {
      addDebugStep('Webhook Node', 'warning', 'Could not click Trigger on Webhook node', null, error.message);
    }
    
    // Step 17: Extract webhook URL from input field
    addDebugStep('Webhook URL', 'info', 'Looking for webhook URL in input field...');
    
    let webhookUrl = null;
    try {
      // Wait for the webhook URL input field to be visible
      await page.waitForSelector('span.ant-input-affix-wrapper input[name="path"]', { timeout: 10000 });
      
      // Extract the webhook URL from the input field and prefix
      webhookUrl = await page.evaluate(() => {
        const inputField = document.querySelector('input[name="path"]');
        const prefixDiv = document.querySelector('span.ant-input-prefix div');
        
        if (inputField && prefixDiv) {
          const prefix = prefixDiv.textContent || prefixDiv.innerText || '';
          const path = inputField.value || '';
          const fullUrl = prefix + path;
          
          if (fullUrl.startsWith('https://webhook.latenode.com')) {
            return fullUrl;
          }
        }
        return null;
      });
      
      if (webhookUrl && webhookUrl.startsWith('https://webhook.latenode.com')) {
        global.webhookUrl = webhookUrl;
        addDebugStep('Webhook URL', 'success', `Webhook URL extracted: ${webhookUrl}`);
      } else {
        addDebugStep('Webhook URL', 'warning', 'Could not extract valid webhook URL from input field');
      }
    } catch (error) {
      addDebugStep('Webhook URL', 'warning', 'Error extracting webhook URL', null, error.message);
    }
    
    // Step 18: Click deploy button
    addDebugStep('Deployment', 'info', 'Clicking deploy button...');
    
    try {
      // Wait for the deploy button to be visible
      await page.waitForSelector('button[data-button-main="deploy"]', { timeout: 10000 });
      
      // Click the deploy button
      await page.click('button[data-button-main="deploy"]');
      addDebugStep('Deployment', 'success', 'Clicked deploy button successfully');
      await sleep(3000); // Wait for deployment to initiate
    } catch (error) {
      addDebugStep('Deployment', 'warning', 'Could not click deploy button', null, error.message);
    }
    
    // Final screenshot after all interactions
    addDebugStep('Final Screenshot', 'info', 'Taking final screenshot after all interactions...');
    await takeScreenshot('Final-Complete-Workflow', page);
    
    return {
      success: true,
      tempEmail: tempEmail,
      password: generatedPassword,
      confirmationCode: confirmationCode,
      credits: global.credits || 'Not found',
      webhookUrl: global.webhookUrl || 'Not found',
      message: 'Latenode account creation process completed successfully with JSON scenario uploaded, accessed, node executed, webhook URL extracted, and scenario deployed!'
    };
    
  } catch (error) {
    addDebugStep('Account Creation', 'error', '❌ Latenode account creation failed', null, error.message);
    
    // Return a more user-friendly error message for Railway
    if (error.message.includes('Failed to launch the browser process')) {
      throw new Error('Browser launch failed. This may be due to server environment limitations. Please try again or contact support.');
    } else if (error.message.includes('Missing X server')) {
      throw new Error('Display server not available. This is a server environment limitation.');
    } else {
      throw new Error(`Latenode account creation failed: ${error.message}`);
    }
  } finally {
    if (browser) {
      try {
        // Clean browser completely - close all pages and clear data
        addDebugStep('Cleanup', 'info', 'Cleaning browser completely...');
        
        // Close all pages first
        const pages = await browser.pages();
        for (const page of pages) {
          try {
            await page.close();
          } catch (e) {
            // Ignore errors when closing pages
          }
        }
        
        // Clear browser data
        try {
          const context = browser.defaultBrowserContext();
          await context.clearCookies();
          await context.clearPermissions();
        } catch (e) {
          // Ignore errors when clearing data
        }
        
        // Close browser
        await browser.close();
        addDebugStep('Cleanup', 'success', 'Browser cleaned and closed completely');
      } catch (closeError) {
        addDebugStep('Cleanup', 'warning', 'Error cleaning browser', null, closeError.message);
      }
    }
  }
}

module.exports = { createLatenodeAccount };
