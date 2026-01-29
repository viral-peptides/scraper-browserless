const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Global session storage
let activeSessions = {
  recraft: {
    browser: null,
    page: null,
    isLoggedIn: false,
    lastActivity: null,
    sessionId: null,
    userEmail: null
  }
};

// Session timeout (30 minutes)
const SESSION_TIMEOUT = 30 * 60 * 1000;

// Debug steps storage
let debugSteps = [];
let screenshotCounter = 0;

function addDebugStep(step, status, message, screenshot = null, error = null) {
  const stepData = {
    step: step,
    status: status,
    message: message,
    timestamp: new Date().toISOString(),
    screenshot: screenshot,
    error: error
  };
  
  debugSteps.push(stepData);
  console.log(`[${status.toUpperCase()}] ${step}: ${message}`);
  
  // Emit real-time log to connected clients
  if (global.io) {
    global.io.emit('scraper-log', stepData);
  }
  
  if (error) {
    console.error(`Error: ${error}`);
  }
}

async function takeScreenshot(description, pageInstance = null) {
  try {
    const currentPage = pageInstance || activeSessions.recraft.page;
    if (!currentPage) {
      addDebugStep(description, 'warning', 'No page instance available for screenshot');
      return null;
    }
    
    screenshotCounter++;
    const filename = `recraft-session-${screenshotCounter}-${description.replace(/[^a-zA-Z0-9]/g, '-')}.png`;
    const filepath = path.join(__dirname, 'screenshots', filename);
    
    // Ensure screenshots directory exists
    if (!fs.existsSync(path.join(__dirname, 'screenshots'))) {
      fs.mkdirSync(path.join(__dirname, 'screenshots'), { recursive: true });
    }
    
    const screenshot = await currentPage.screenshot({ 
      fullPage: true,
      path: filepath 
    });
    
    addDebugStep(description, 'screenshot', `Screenshot saved: ${filename}`, `/screenshots/${filename}`);
    return screenshot;
  } catch (error) {
    addDebugStep(description, 'error', 'Failed to take screenshot', null, error.message);
    return null;
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Check if session is valid and not expired
function isSessionValid() {
  const session = activeSessions.recraft;
  if (!session.browser || !session.page || !session.lastActivity) {
    return false;
  }
  
  const now = Date.now();
  const timeSinceLastActivity = now - session.lastActivity;
  
  return timeSinceLastActivity < SESSION_TIMEOUT;
}

// Update session activity timestamp
function updateSessionActivity() {
  activeSessions.recraft.lastActivity = Date.now();
}

// Cleanup expired sessions
async function cleanupExpiredSessions() {
  const session = activeSessions.recraft;
  
  if (!isSessionValid() && session.browser) {
    try {
      addDebugStep('Session Cleanup', 'info', 'Cleaning up expired session...');
      await session.browser.close();
      activeSessions.recraft = {
        browser: null,
        page: null,
        isLoggedIn: false,
        lastActivity: null,
        sessionId: null,
        userEmail: null
      };
      addDebugStep('Session Cleanup', 'success', 'Expired session cleaned up');
    } catch (error) {
      addDebugStep('Session Cleanup', 'error', 'Error cleaning up session', null, error.message);
    }
  }
}

// Get or create browser session
async function getOrCreateSession(googleEmail, googlePassword, io = null) {
  // Make io available globally
  global.io = io;
  
  // Initialize debug steps
  debugSteps = [];
  screenshotCounter = 0;
  
  // Clean up expired sessions first
  await cleanupExpiredSessions();
  
  const session = activeSessions.recraft;
  
  // Check if we have a valid existing session
  if (isSessionValid() && session.isLoggedIn && session.userEmail === googleEmail) {
    addDebugStep('Session Check', 'success', `♻️ Reusing existing session for ${googleEmail}`);
    updateSessionActivity();
    
    try {
      // Verify the page is still accessible
      await session.page.evaluate(() => document.title);
      await takeScreenshot('Existing Session');
      
      return {
        browser: session.browser,
        page: session.page,
        isNewSession: false
      };
    } catch (error) {
      addDebugStep('Session Check', 'warning', 'Existing session is invalid, creating new one');
      // Fall through to create new session
    }
  }
  
  // Create new session
  addDebugStep('Session Creation', 'info', '🚀 Creating new browser session...');
  
  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-field-trial-config',
        '--disable-back-forward-cache',
        '--disable-ipc-flooding-protection',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--hide-scrollbars',
        '--mute-audio',
        '--no-default-browser-check',
        '--no-pings',
        '--disable-logging',
        '--disable-permissions-api',
        '--disable-presentation-api',
        '--disable-print-preview',
        '--disable-speech-api',
        '--disable-file-system',
        '--disable-notifications',
        '--disable-geolocation',
        '--disable-media-session',
        '--disable-client-side-phishing-detection',
        '--disable-component-extensions-with-background-pages',
        '--disable-background-networking',
        '--disable-features=TranslateUI,BlinkGenPropertyTrees',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ],
      defaultViewport: { width: 1366, height: 768 },
      ignoreDefaultArgs: ['--disable-extensions'],
      ignoreHTTPSErrors: true,
      timeout: 60000
    });
    
    const page = await browser.newPage();
    
    // Basic stealth settings
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });
    
    // Store session
    activeSessions.recraft = {
      browser: browser,
      page: page,
      isLoggedIn: false,
      lastActivity: Date.now(),
      sessionId: `session_${Date.now()}`,
      userEmail: googleEmail
    };
    
    addDebugStep('Session Creation', 'success', 'New browser session created successfully');
    
    return {
      browser: browser,
      page: page,
      isNewSession: true
    };
    
  } catch (error) {
    addDebugStep('Session Creation', 'error', 'Failed to create browser session', null, error.message);
    throw new Error(`Failed to create browser session: ${error.message}`);
  }
}

// Login to Recraft.ai (only if not already logged in)
async function loginToRecraft(googleEmail, googlePassword, browser, page, isNewSession) {
  if (!isNewSession && activeSessions.recraft.isLoggedIn) {
    addDebugStep('Login Check', 'success', '✅ Already logged in to Recraft.ai');
    
    // Navigate directly to projects page if already logged in
    const currentUrl = await page.url();
    if (!currentUrl.includes('recraft.ai/projects')) {
      addDebugStep('Navigation', 'info', 'Navigating directly to Recraft.ai projects page...');
      await page.goto('https://www.recraft.ai/projects', { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(3000);
      await takeScreenshot('Projects Page Navigation');
    }
    
    // Verify we're actually logged in by checking for user elements
    try {
      await page.waitForFunction(() => {
        return document.querySelector('[class*="user"], [class*="profile"], [class*="avatar"]') !== null ||
               document.body.innerText.includes('Dashboard') ||
               document.body.innerText.includes('Create') ||
               document.body.innerText.includes('New');
      }, { timeout: 5000 });
      addDebugStep('Login Verification', 'success', '✅ Login verified - user elements found');
    } catch (error) {
      addDebugStep('Login Verification', 'warning', 'Login verification failed, may need to re-login');
      // Mark session as not logged in to force re-login
      activeSessions.recraft.isLoggedIn = false;
    }
    
    return true;
  }
  
  // Perform login process
  addDebugStep('Login Process', 'info', '🔐 Starting login process...');
  
  try {
    // Navigate to Recraft.ai login page
    addDebugStep('Navigation', 'info', 'Navigating to Recraft.ai login page...');
    await page.goto('https://recraft.ai/auth/login', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    await sleep(3000);
    await takeScreenshot('Login Page');
    
    // Click Google login button
    addDebugStep('Google Button', 'info', 'Looking for Google login button...');
    await page.waitForSelector('a[data-provider="google"]', { timeout: 10000 });
    await page.click('a[data-provider="google"]');
    addDebugStep('Google Button', 'success', 'Clicked Google login button');
    
    await sleep(3000);
    await takeScreenshot('Google Login Page');
    
    // Fill Google email
    addDebugStep('Google Email', 'info', 'Filling Google email...');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.click('input[type="email"]');
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.type('input[type="email"]', googleEmail, { delay: 100 });
    addDebugStep('Google Email', 'success', 'Email filled successfully');
    
    await sleep(1000);
    await takeScreenshot('After Email');
    
    // Click Next button for email
    addDebugStep('Email Next', 'info', 'Clicking Next button for email...');
    await page.click('#identifierNext');
    await sleep(3000);
    await takeScreenshot('Password Page');
    
    // Fill Google password
    addDebugStep('Google Password', 'info', 'Filling Google password...');
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await page.click('input[type="password"]');
    await page.type('input[type="password"]', googlePassword, { delay: 100 });
    addDebugStep('Google Password', 'success', 'Password filled successfully');
    
    await sleep(1000);
    await takeScreenshot('After Password');
    
    // Click Next button for password
    addDebugStep('Password Next', 'info', 'Clicking Next button for password...');
    await page.click('#passwordNext');
    await sleep(5000);
    
    // Wait for redirect to Recraft.ai
    addDebugStep('Login Completion', 'info', 'Waiting for login completion...');
    await page.waitForFunction(() => {
      return window.location.href.includes('recraft.ai') && !window.location.href.includes('login');
    }, { timeout: 30000 });
    
    await sleep(3000);
    await takeScreenshot('Login Complete');
    
    // Mark session as logged in
    activeSessions.recraft.isLoggedIn = true;
    updateSessionActivity();
    
    addDebugStep('Login Process', 'success', '✅ Successfully logged in to Recraft.ai');
    return true;
    
  } catch (error) {
    addDebugStep('Login Process', 'error', 'Login failed', null, error.message);
    throw new Error(`Login failed: ${error.message}`);
  }
}

// Generate image using existing session
async function generateImageWithSession(prompt = 'banana bread in kitchen with sun light') {
  const session = activeSessions.recraft;
  const page = session.page;
  let finalImageUrl = null;
  
  addDebugStep('Image Generation', 'info', `🎨 Starting image generation with prompt: "${prompt}"`);
  
  try {
    // Check if we're already in a project editor
    const currentUrl = await page.url();
    const isInEditor = currentUrl.includes('editor') || currentUrl.includes('project/') || currentUrl.includes('new');
    
    if (!isInEditor) {
      addDebugStep('Navigation', 'info', 'Navigating to new project...');
      
      // Handle privacy popup if present
      try {
        const acceptButton = await page.$('button.dg-button.accept_all');
        if (acceptButton) {
          await acceptButton.click();
          addDebugStep('Privacy Popup', 'success', 'Closed privacy popup');
          await sleep(2000);
        }
      } catch (error) {
        // Privacy popup not found, continue
      }
      
      // Click "Create new project" or "+" button
      try {
        await page.click('button:has-text("Create new project"), [class*="create"], [class*="new-project"]');
        await sleep(3000);
      } catch (error) {
        // Try alternative selectors
        await page.click('button, [role="button"]');
        await sleep(3000);
      }
    } else {
      addDebugStep('Navigation', 'info', 'Already in project editor, skipping navigation');
    }
      
    await takeScreenshot('New Project');
    
    // Click Image button
    addDebugStep('Image Button', 'info', 'Clicking Image button...');
    try {
          // Wait for the image button to appear
          await page.waitForSelector('button[data-testid="new-raster"]', { timeout: 10000 });
          await page.click('button[data-testid="new-raster"]');
          addDebugStep('Image Button', 'success', 'Successfully clicked Image button');
        } catch (error) {
          addDebugStep('Image Button', 'warning', 'Primary selector failed, trying alternatives...');
          
          // Try alternative selectors
          const imageButtonClicked = await page.evaluate(() => {
            const selectors = [
              'button[data-testid="new-raster"]',
              'button:has-text("Image")',
              '[class*="new-raster"]',
              'button[class*="raster"]',
              'button:has(svg)',
              'button[aria-label*="Image"]'
            ];
            
            for (const selector of selectors) {
              const button = document.querySelector(selector);
              if (button && button.offsetParent !== null) {
                button.click();
                console.log('Clicked image button with selector:', selector);
                return true;
              }
            }
            return false;
          });
          
          if (!imageButtonClicked) {
            throw new Error('Could not find Image button with any selector');
          }
        }
        
        await sleep(3000);
        await takeScreenshot('Image Selection');
    
       // Skip Recraft V3 Raw - default style is already selected
       await sleep(2000); // Wait for page to settle
       
      // Skip Photorealism Apply - default style is already Photorealism
      await sleep(2000); // Wait for page to settle
      await takeScreenshot('Style Applied');
    
    // Adjust slider to 1 image
    addDebugStep('Slider Adjustment', 'info', 'Adjusting image count to 1...');
    await page.evaluate(() => {
      const slider = document.querySelector('input[name="numberOfImages"]');
      if (slider) {
        slider.value = '1';
        slider.dispatchEvent(new Event('input', { bubbles: true }));
        slider.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await sleep(1000);
    
    // Enter prompt - using robust method from simple scraper
    addDebugStep('Prompt Input', 'info', 'Clicking on textarea and entering prompt...');
    try {
      // First, click and focus the textarea
      await page.click('textarea[name="prompt"][data-testid="recraft-textarea"]');
      await sleep(1000);
      
      // Clear existing text and type new prompt
      await page.evaluate((promptText) => {
        const textarea = document.querySelector('textarea[name="prompt"][data-testid="recraft-textarea"]');
        if (textarea) {
          // Select all text
          textarea.select();
          // Clear it
          textarea.value = '';
          // Set new value
          textarea.value = promptText;
          
          // Trigger events
          const events = ['input', 'change', 'keyup', 'keydown'];
          events.forEach(eventType => {
            const event = new Event(eventType, { bubbles: true, cancelable: true });
            textarea.dispatchEvent(event);
          });
          
          console.log('Set prompt value to:', textarea.value);
          return true;
        }
        return false;
      }, prompt);
      
      // Clear the textarea first to avoid duplication
      await page.evaluate((promptText) => {
        const textarea = document.querySelector('textarea[name="prompt"][data-testid="recraft-textarea"]');
        if (textarea) {
          textarea.value = '';
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, prompt);
      
      // Use Puppeteer's type method as backup
      await page.type('textarea[name="prompt"][data-testid="recraft-textarea"]', prompt, { delay: 100 });
      
      const promptEntered = true;

      if (promptEntered) {
        addDebugStep('Prompt Input', 'success', `Successfully entered prompt: ${prompt}`);
        
        // Wait for the prompt to be properly registered
        await sleep(3000);
        
        // Verify the prompt was actually entered
        const promptVerified = await page.evaluate((promptText) => {
          const textarea = document.querySelector('textarea[name="prompt"][data-testid="recraft-textarea"]');
          if (textarea) {
            const currentValue = textarea.value.trim();
            console.log('Current prompt value:', currentValue);
            return currentValue === promptText;
          }
          return false;
        }, prompt);
        
        if (promptVerified) {
          addDebugStep('Prompt Verification', 'success', 'Prompt successfully registered in textarea');
        } else {
          addDebugStep('Prompt Verification', 'warning', 'Prompt may not have been properly registered');
        }
        
        await takeScreenshot('Prompt Entered', page);
      } else {
        addDebugStep('Prompt Input', 'warning', 'Could not find or interact with prompt textarea');
        await takeScreenshot('Prompt Input Failed', page);
      }
    } catch (error) {
      addDebugStep('Prompt Input', 'error', 'Error entering prompt', null, error.message);
    }
    
    // Click Generate button
    addDebugStep('Generate Button', 'info', 'Clicking Generate button...');
    await page.click('button[data-testid="recraft-button"]');
    await sleep(3000);
    await takeScreenshot('Generation Started');
    
    // Wait for generation to complete - using robust method from simple scraper
    addDebugStep('Generation Wait', 'info', 'Waiting for image generation to complete...');
    
    try {
      // Wait for generation to start first
      await page.waitForFunction(() => {
        const generatingText = document.body.innerText.toLowerCase().includes('generating');
        const generatingIndicator = document.querySelector('[class*="generating"], [class*="loading"], [class*="progress"]');
        return generatingText || generatingIndicator;
      }, { timeout: 10000 });
      
      addDebugStep('Generation Wait', 'info', 'Generation started, waiting for completion...');
      
      // Wait for generation to complete
      await page.waitForFunction(() => {
        // Look for generated images
        const images = document.querySelectorAll('img[src*="recraft"], [class*="generated"] img, [class*="result"] img, canvas img, [class*="preview"] img');
        const hasVisibleImages = Array.from(images).some(img => img.offsetParent !== null);
        
        // Check if generating indicators are gone
        const generatingText = document.body.innerText.toLowerCase().includes('generating');
        const generatingIndicator = document.querySelector('[class*="generating"], [class*="loading"], [class*="progress"]');
        
        // Check for canvas or image containers with content
        const canvas = document.querySelector('canvas, [class*="canvas"], [class*="preview"], [class*="result"]');
        const hasCanvasContent = canvas && canvas.children.length > 0;
        
        console.log('Generation check:', {
          hasVisibleImages,
          generatingText,
          hasGeneratingIndicator: !!generatingIndicator,
          hasCanvasContent
        });
        
        return (hasVisibleImages || hasCanvasContent) && !generatingText && !generatingIndicator;
      }, { timeout: 60000 }); // Wait up to 60 seconds
      
      addDebugStep('Generation Wait', 'success', 'Image generation completed');
      await sleep(2000);
      await takeScreenshot('Generation Completed', page);
      
    } catch (error) {
      addDebugStep('Generation Wait', 'warning', 'Generation timeout, continuing...', null, error.message);
      await takeScreenshot('Generation Timeout', page);
    }
    
    // --- NEW STEP: Right-click and copy image link ---
    addDebugStep('Image Link Extraction', 'info', 'Right-clicking on generated image to copy link...');
    let finalImageUrl = null;
    try {
      // Find the editor's image-like element using ChatGPT's heuristic approach
      addDebugStep('Image Link Extraction', 'info', 'Looking for the editor canvas/image element...');
      
      let imageElement = null;
      try {
        // Use ChatGPT's heuristic to find the largest image-like element
        imageElement = await page.evaluateHandle(() => {
          // Helper functions
          const isVisible = (el) => {
            const rect = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            return rect.width > 50 && rect.height > 50 &&
                   style.visibility !== 'hidden' &&
                   style.display !== 'none' &&
                   rect.bottom > 0 && rect.right > 0 &&
                   rect.top < (window.innerHeight || 1e6) &&
                   rect.left < (window.innerWidth || 1e6);
          };

          // Candidates: elements with background-image, <canvas>, large <img>, role="img"
          const all = [
            ...document.querySelectorAll('[style*="background-image"], [style*="background:"]'),
            ...document.querySelectorAll('canvas, img, [role="img"]'),
            ...document.querySelectorAll('[class*="canvas"], [class*="editor"], [class*="image"]')
          ];

          console.log(`Found ${all.length} potential image-like elements`);

          // Score by area; prefer ones with data:image or large background images
          const scored = [];
          for (const el of all) {
            if (!isVisible(el)) continue;
            const rect = el.getBoundingClientRect();
            const area = rect.width * rect.height;

            const style = getComputedStyle(el);
            const bg = style.backgroundImage || style.background || '';
            const hasDataUrl = /data:image\/|image\/svg\+xml/i.test(bg);
            const isHuge = area > 200 * 200;

            // Give extra weight if it looks like the editor canvas
            let score = area;
            if (hasDataUrl) score *= 2;
            if (style.cursor === 'url' || style.cursor === 'crosshair') score *= 1.2;

            console.log(`Element: ${el.tagName}.${el.className}, area: ${area}, score: ${score}, hasDataUrl: ${hasDataUrl}`);

            if (isHuge) scored.push({ el, score });
          }

          if (!scored.length) {
            console.log('No large image-like elements found');
            return null;
          }
          
          scored.sort((a, b) => b.score - a.score);
          console.log(`Selected element with score: ${scored[0].score}`);
          return scored[0].el;
        });
        
        if (imageElement && imageElement.asElement) {
          imageElement = imageElement.asElement();
        }
        
        addDebugStep('Image Link Extraction', 'success', `Found editor canvas/image element: ${imageElement ? 'Yes' : 'No'}`);
      } catch (error) {
        addDebugStep('Image Link Extraction', 'error', 'Error finding editor canvas element', null, error.message);
        throw error;
      }
      
      if (imageElement) {
        // Try a normal element right-click first
        try {
          await imageElement.click({ button: 'right' });
          addDebugStep('Image Link Extraction', 'info', 'Right-clicked on canvas element');
        } catch (error) {
          // If a normal click fails (overlay/transform), right-click by coordinates
          addDebugStep('Image Link Extraction', 'warning', 'Normal click failed, trying coordinate-based click...');
          const box = await imageElement.boundingBox();
          if (!box) {
            addDebugStep('Image Link Extraction', 'error', 'Element has no bounding box');
            throw new Error('Element has no bounding box.');
          }
          const x = Math.round(box.x + box.width / 2);
          const y = Math.round(box.y + box.height / 2);
          await page.mouse.move(x, y);
          await page.mouse.click(x, y, { button: 'right' });
          addDebugStep('Image Link Extraction', 'info', `Right-clicked at coordinates (${x}, ${y})`);
        }
        
        await sleep(2000); // Wait for menu to appear
        
        // Take screenshot to see if context menu appeared
        await takeScreenshot('After Right Click - Context Menu Check', page);
        
        // Wait for the Radix menu (it's portaled into <body>)
        try {
          await page.waitForSelector('[role="menu"][data-state="open"]', { visible: true, timeout: 3000 });
          addDebugStep('Image Link Extraction', 'success', 'Radix context menu opened successfully');
        } catch (error) {
          addDebugStep('Image Link Extraction', 'warning', 'Radix menu not found, trying alternative approach...');
        }
        
        // Click the menu item by its visible label (scope to the OPEN menu)
        const copyImageLinkClicked = await page.evaluate(() => {
          console.log('=== RADIX UI CONTEXT MENU DETECTION ===');
          
          // First, try to find the open menu
          const openMenu = document.querySelector('[role="menu"][data-state="open"]');
          if (!openMenu) {
            console.log('No open menu found, trying to find any menu...');
            const anyMenu = document.querySelector('[role="menu"]');
            if (!anyMenu) {
              console.log('No menu found at all');
              return false;
            }
            console.log('Found menu without data-state="open"');
          } else {
            console.log('Found open menu with data-state="open"');
          }
          
          // Use XPath to find the menu item with exact text match
          const xpathResult = document.evaluate(
            "//div[@role='menu']//div[@role='menuitem']//div[normalize-space()='Copy image link']",
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          );
          
          if (xpathResult.singleNodeValue) {
            console.log('Found "Copy image link" via XPath exact match');
            xpathResult.singleNodeValue.click();
            return true;
          }
          
          // Fallback: partial text match
          console.log('Trying partial text match...');
          const partialXpathResult = document.evaluate(
            "//div[@role='menu']//div[@role='menuitem']//div[contains(normalize-space(), 'Copy image link')]",
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          );
          
          if (partialXpathResult.singleNodeValue) {
            console.log('Found "Copy image link" via XPath partial match');
            partialXpathResult.singleNodeValue.click();
            return true;
          }
          
          // Last resort: search all menuitems
          console.log('Trying to find any menuitem with "Copy image link"...');
          const menuItems = document.querySelectorAll('[role="menuitem"]');
          console.log(`Found ${menuItems.length} menu items`);
          
          for (const menuItem of menuItems) {
            const text = (menuItem.innerText || menuItem.textContent || '').trim();
            console.log(`Menu item text: "${text}"`);
            
            if (text.includes('Copy image link')) {
              console.log('Found "Copy image link" in menu item, clicking...');
              menuItem.click();
              return true;
            }
          }
          
          console.log('❌ All methods failed to find/click "Copy image link"');
          return false;
        });
        
        if (copyImageLinkClicked) {
          addDebugStep('Image Link Extraction', 'success', 'Clicked "Copy image link" from context menu');
          await sleep(1000);
          
          // Get the copied link from clipboard
          addDebugStep('Image Link Extraction', 'info', 'Reading from clipboard...');
          let copiedLink = null;
          try {
            copiedLink = await page.evaluate(async () => {
              try {
                const text = await navigator.clipboard.readText();
                console.log('Clipboard content:', text);
                return text;
              } catch (error) {
                console.log('Clipboard read error:', error.message);
                return null;
              }
            });
            addDebugStep('Image Link Extraction', 'info', `Clipboard read result: ${copiedLink ? 'Success' : 'Failed'}`);
          } catch (error) {
            addDebugStep('Image Link Extraction', 'error', 'Error reading from clipboard', null, error.message);
          }
          
          if (copiedLink && copiedLink.trim()) {
            addDebugStep('Image Link Extraction', 'success', `Copied image link: ${copiedLink}`);
            
            // Open the copied link in a new tab
            addDebugStep('Image Link Extraction', 'info', 'Opening copied link in new tab...');
            const newPage = await browser.newPage();
            await newPage.goto(copiedLink, { waitUntil: 'networkidle2', timeout: 30000 });
            await sleep(2000);
            await takeScreenshot('Opened Image in New Tab', newPage);
            
            // Right-click on the image in the new tab to get final address
            addDebugStep('Image Link Extraction', 'info', 'Right-clicking on image in new tab to copy address...');
            const newImageElement = await newPage.waitForSelector('img', { timeout: 10000 });
            await newImageElement.click({ button: 'right' });
            await sleep(1000);
            
            // Look for "Copy image address" or similar option
            const copyImageAddressClicked = await newPage.evaluate(() => {
              const contextMenuItems = document.querySelectorAll('[role="menuitem"], [role="option"], .context-menu-item, [class*="context-menu"], [class*="menu-item"]');
              for (const item of contextMenuItems) {
                const text = (item.innerText || item.textContent || '').toLowerCase();
                if (text.includes('copy') && text.includes('image') && text.includes('address')) {
                  item.click();
                  console.log('Clicked "Copy image address" from context menu');
                  return true;
                }
              }
              return false;
            });
            
            if (copyImageAddressClicked) {
              addDebugStep('Image Link Extraction', 'success', 'Clicked "Copy image address" from context menu');
              await sleep(1000);
              
              // Get the final copied address from clipboard
              finalImageUrl = await newPage.evaluate(() => {
                return navigator.clipboard.readText();
              });
              
              if (finalImageUrl) {
                addDebugStep('Image Link Extraction', 'success', `Final image address: ${finalImageUrl}`);
              } else {
                addDebugStep('Image Link Extraction', 'warning', 'Could not get final image address from clipboard');
              }
            } else {
              addDebugStep('Image Link Extraction', 'warning', 'Could not find "Copy image address" option in context menu');
            }
            
            await newPage.close();
          } else {
            addDebugStep('Image Link Extraction', 'warning', 'Could not get copied link from clipboard');
            
            // Fallback: Try to get the image URL directly from the page
            addDebugStep('Image Link Extraction', 'info', 'Trying fallback method to get image URL...');
            try {
              const fallbackUrl = await page.evaluate(() => {
                // Look for any image elements that might contain the generated image URL
                const images = document.querySelectorAll('img[src*="recraft"], [style*="background-image"]');
                for (const img of images) {
                  if (img.src && img.src.includes('recraft')) {
                    console.log('Found image URL:', img.src);
                    return img.src;
                  }
                  const style = getComputedStyle(img);
                  if (style.backgroundImage && style.backgroundImage.includes('recraft')) {
                    const url = style.backgroundImage.replace(/url\(['"]?(.*?)['"]?\)/, '$1');
                    console.log('Found background image URL:', url);
                    return url;
                  }
                }
                return null;
              });
              
              if (fallbackUrl) {
                addDebugStep('Image Link Extraction', 'success', `Fallback URL found: ${fallbackUrl}`);
                finalImageUrl = fallbackUrl;
              } else {
                addDebugStep('Image Link Extraction', 'warning', 'No fallback URL found');
              }
            } catch (error) {
              addDebugStep('Image Link Extraction', 'error', 'Fallback method failed', null, error.message);
            }
          }
        } else {
          addDebugStep('Image Link Extraction', 'warning', 'Could not find "Copy image link" option in context menu');
        }
      } else {
        addDebugStep('Image Link Extraction', 'warning', 'Could not find generated image to right-click');
      }
    } catch (error) {
      addDebugStep('Image Link Extraction', 'error', 'Error extracting image link via right-click', null, error.message);
    }
    
    updateSessionActivity();
    
    return {
      success: true,
      imageUrl: finalImageUrl,
      prompt: prompt,
      sessionReused: !session.isNewSession
    };
    
  } catch (error) {
    addDebugStep('Image Generation', 'error', 'Image generation failed', null, error.message);
    throw new Error(`Image generation failed: ${error.message}`);
  }
}

// Main session-based scraping function
async function scrapeRecraftWithSession(googleEmail, googlePassword, prompt = 'banana bread in kitchen with sun light', io = null) {
  try {
    // Get or create session
    const { browser, page, isNewSession } = await getOrCreateSession(googleEmail, googlePassword, io);
    
    // Login if needed
    await loginToRecraft(googleEmail, googlePassword, browser, page, isNewSession);
    
    // Generate image
    const result = await generateImageWithSession(prompt);
    
    const finalUrl = await page.url();
    const finalTitle = await page.title();
    
    return {
      ok: true,
      success: true,
      message: `Session-based scraping completed! ${isNewSession ? 'New session created.' : 'Existing session reused.'}`,
      finalUrl: finalUrl,
      finalTitle: finalTitle,
      finalImageUrl: result.imageUrl,
      steps: debugSteps,
      imageUrl: result.imageUrl,
      prompt: result.prompt,
      sessionReused: !isNewSession,
      sessionId: activeSessions.recraft.sessionId
    };
    
  } catch (error) {
    console.error('❌ Session-based scraping error:', error);
    
    return {
      ok: false,
      success: false,
      message: 'Session-based scraping failed',
      error: error.message,
      steps: debugSteps,
      finalUrl: null,
      finalTitle: null
    };
  }
}

// Get session status
function getSessionStatus() {
  const session = activeSessions.recraft;
  return {
    hasActiveSession: isSessionValid(),
    isLoggedIn: session.isLoggedIn,
    userEmail: session.userEmail,
    sessionId: session.sessionId,
    lastActivity: session.lastActivity,
    timeRemaining: session.lastActivity ? Math.max(0, SESSION_TIMEOUT - (Date.now() - session.lastActivity)) : 0
  };
}

// Manually cleanup session
async function cleanupSession() {
  await cleanupExpiredSessions();
  return { success: true, message: 'Session cleaned up successfully' };
}

module.exports = {
  scrapeRecraftWithSession,
  getSessionStatus,
  cleanupSession,
  cleanupExpiredSessions
};
