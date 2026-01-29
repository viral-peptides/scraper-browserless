const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

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
    const currentPage = pageInstance || page;
    if (!currentPage) {
      addDebugStep(description, 'warning', 'No page instance available for screenshot');
      return null;
    }
    
    screenshotCounter++;
    const filename = `recraft-simple-${screenshotCounter}-${description.replace(/[^a-zA-Z0-9]/g, '-')}.png`;
    const filepath = path.join(__dirname, 'screenshots', filename);
    
    // Ensure screenshots directory exists
    if (!fs.existsSync(path.join(__dirname, 'screenshots'))) {
      fs.mkdirSync(path.join(__dirname, 'screenshots'), { recursive: true });
    }
    
    const screenshot = await currentPage.screenshot({ 
      fullPage: true,
      path: filepath 
    });
    
    addDebugStep(description, 'screenshot', `Screenshot saved: ${filename}`, filename);
    return screenshot;
  } catch (error) {
    addDebugStep(description, 'error', 'Failed to take screenshot', null, error.message);
    return null;
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeRecraftSimple(googleEmail, googlePassword, io = null) {
  let browser = null;
  let page = null;
  let finalImageUrl = null;
  
  // Make io available globally in this module
  global.io = io;
  
  try {
    // Initialize debug steps
    debugSteps = [];
    screenshotCounter = 0;
    
    addDebugStep('Initialization', 'info', 'Starting simple Recraft.ai scraper...');
    
    // Launch browser with Railway-compatible settings
    addDebugStep('Browser Launch', 'info', 'Launching browser...');
    
    try {
      browser = await puppeteer.launch({
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
      
      addDebugStep('Browser Launch', 'success', 'Browser launched successfully');
      
    } catch (browserError) {
      addDebugStep('Browser Launch', 'error', 'Failed to launch browser', null, browserError.message);
      throw new Error(`Failed to launch browser: ${browserError.message}. Railway environment may not support browser automation.`);
    }
    
    page = await browser.newPage();
    
    // Basic stealth settings
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });
    
    // Navigate to Recraft.ai login page
    addDebugStep('Navigation', 'info', 'Navigating to Recraft.ai login page...');
    await page.goto('https://www.recraft.ai/auth/login', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    await sleep(3000);
    await takeScreenshot('Recraft.ai Login Page', page);
    
    addDebugStep('Navigation', 'success', 'Successfully navigated to Recraft.ai login page');
    
    // Try to find and click Google login button
    addDebugStep('Google Button', 'info', 'Looking for Google login button...');
    
    try {
      // Wait for Google button to appear
      await page.waitForSelector('a[data-provider="google"]', { timeout: 10000 });
      
      // Click Google button
      await page.click('a[data-provider="google"]');
      addDebugStep('Google Button', 'success', 'Clicked Google login button');
      
      await sleep(3000);
      await takeScreenshot('Google Login Page', page);
      
    } catch (error) {
      addDebugStep('Google Button', 'error', 'Could not find or click Google button', null, error.message);
      throw new Error('Could not find Google login button');
    }
    
    // Fill Google email
    addDebugStep('Google Email', 'info', 'Filling Google email...');
    
    try {
      await page.waitForSelector('input[type="email"]', { timeout: 10000 });
      
      // Clear and fill email
      await page.click('input[type="email"]');
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Control');
      await page.type('input[type="email"]', googleEmail, { delay: 100 });
      
      addDebugStep('Google Email', 'success', 'Email filled successfully');
      
      await sleep(1000);
      await takeScreenshot('After Filling Email', page);
      
    } catch (error) {
      addDebugStep('Google Email', 'error', 'Could not fill email', null, error.message);
      throw new Error('Could not fill Google email');
    }
    
    // Click Next button for email
    addDebugStep('Email Next', 'info', 'Clicking Next button for email...');
    
    try {
      await page.click('#identifierNext');
      addDebugStep('Email Next', 'success', 'Clicked Next button for email');
      
      await sleep(5000);
      await takeScreenshot('After Clicking Email Next', page);
      
    } catch (error) {
      addDebugStep('Email Next', 'error', 'Could not click Next button for email', null, error.message);
      throw new Error('Could not click Next button for email');
    }
    
    // Fill Google password
    addDebugStep('Google Password', 'info', 'Filling Google password...');
    
    try {
      await page.waitForSelector('input[type="password"]', { timeout: 10000 });
      
      // Clear and fill password
      await page.click('input[type="password"]');
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Control');
      await page.type('input[type="password"]', googlePassword, { delay: 100 });
      
      addDebugStep('Google Password', 'success', 'Password filled successfully');
      
      await sleep(1000);
      await takeScreenshot('After Filling Password', page);
      
    } catch (error) {
      addDebugStep('Google Password', 'error', 'Could not fill password', null, error.message);
      throw new Error('Could not fill Google password');
    }
    
    // Click Next button for password
    addDebugStep('Password Next', 'info', 'Clicking Next button for password...');
    
    try {
      await page.click('#passwordNext');
      addDebugStep('Password Next', 'success', 'Clicked Next button for password');
      
      await sleep(5000);
      await takeScreenshot('After Clicking Password Next', page);
      
    } catch (error) {
      addDebugStep('Password Next', 'error', 'Could not click Next button for password', null, error.message);
      throw new Error('Could not click Next button for password');
    }
    
    // Wait for redirect to Recraft.ai
    addDebugStep('Redirect', 'info', 'Waiting for redirect to Recraft.ai...');
    
    try {
      await page.waitForFunction(() => {
        return window.location.href.includes('recraft.ai') && 
               !window.location.href.includes('/auth/login');
      }, { timeout: 30000 });
      
      addDebugStep('Redirect', 'success', 'Successfully redirected to Recraft.ai');
      
      await sleep(3000);
      await takeScreenshot('Recraft.ai Dashboard', page);
      
    } catch (error) {
      addDebugStep('Redirect', 'warning', 'Redirect timeout, checking current URL', null, error.message);
    }
    
    // Handle popups and cookies
    addDebugStep('Popup Handling', 'info', 'Checking for and closing popups...');
    
    try {
      // Wait a bit for popups to appear
      await sleep(2000);
      
      // Close any popups that might appear
      const popupsClosed = await page.evaluate(() => {
        let closedCount = 0;
        
        // Get all buttons on the page
        const allButtons = document.querySelectorAll('button, a, [role="button"]');
        
        for (const button of allButtons) {
          if (button.offsetParent === null) continue; // Skip hidden buttons
          
          const text = (button.innerText || button.textContent || '').trim();
          const lowerText = text.toLowerCase();
          const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
          const className = (button.className || '').toLowerCase();
          
          console.log('Checking button:', text, 'aria-label:', ariaLabel, 'class:', className);
          
          // Look for "Accept All" buttons in cookie popups (exact match first)
          if (text === 'Accept All' || lowerText === 'accept all') {
            button.click();
            closedCount++;
            console.log('Clicked Accept All button:', text);
            continue;
          }
          
          // Look for close buttons (X buttons) in popups
          if (text === '×' || text === '✕' || text === 'Close' || lowerText === 'close' || 
              ariaLabel.includes('close') || className.includes('close')) {
            button.click();
            closedCount++;
            console.log('Closed popup with close button:', text);
            continue;
          }
          
          // Look for other accept buttons
          if (lowerText.includes('accept') || lowerText.includes('ok') || 
              lowerText.includes('got it') || lowerText.includes('agree') || 
              lowerText.includes('continue')) {
            button.click();
            closedCount++;
            console.log('Clicked Accept/OK button:', text);
            continue;
          }
          
          // Look for "Learn more" or similar buttons that might close popups
          if (lowerText.includes('learn more') || lowerText.includes('dismiss') ||
              lowerText.includes('skip') || lowerText.includes('not now')) {
            button.click();
            closedCount++;
            console.log('Clicked Learn more/Dismiss button:', text);
            continue;
          }
        }
        
        return closedCount;
      });
      
      if (popupsClosed > 0) {
        addDebugStep('Popup Handling', 'success', `Closed ${popupsClosed} popup(s)`);
        await sleep(1000);
        await takeScreenshot('After Closing Popups', page);
      } else {
        addDebugStep('Popup Handling', 'info', 'No popups found to close');
      }
      
    } catch (error) {
      addDebugStep('Popup Handling', 'warning', 'Error handling popups', null, error.message);
    }
    
    // Click on "Create new project" button
    addDebugStep('Create Project', 'info', 'Looking for and clicking Create new project button...');
    
    try {
      // Wait a bit for the page to settle after popup handling
      await sleep(2000);
      
      // Look for and click the "Create new project" button
      const createProjectClicked = await page.evaluate(() => {
        // Get all buttons and clickable elements
        const allButtons = document.querySelectorAll('button, a, [role="button"], div[onclick]');
        
        for (const button of allButtons) {
          if (button.offsetParent === null) continue; // Skip hidden elements
          
          const text = (button.innerText || button.textContent || '').trim();
          const lowerText = text.toLowerCase();
          
          console.log('Checking create project button:', text);
          
          // Look for "Create new project" button (exact match)
          if (text === 'Create new project' || lowerText === 'create new project') {
            button.click();
            console.log('Clicked Create new project button:', text);
            return true;
          }
          
          // Look for buttons containing "create" and "project"
          if (lowerText.includes('create') && lowerText.includes('project')) {
            button.click();
            console.log('Clicked Create project button (partial match):', text);
            return true;
          }
          
          // Look for buttons containing "new project"
          if (lowerText.includes('new project')) {
            button.click();
            console.log('Clicked New project button:', text);
            return true;
          }
        }
        
        return false;
      });
      
      if (createProjectClicked) {
        addDebugStep('Create Project', 'success', 'Successfully clicked Create new project button');
        await sleep(2000);
        await takeScreenshot('After Clicking Create Project', page);
        
        // Wait for dashboard to fully load
        addDebugStep('Dashboard Loading', 'info', 'Waiting for dashboard to fully load...');
        
        try {
          // Wait for the dashboard content to load (look for specific elements)
          await page.waitForFunction(() => {
            // Check if we're on a project page and content has loaded
            const hasProjectContent = document.querySelector('[class*="project"], [class*="editor"], [class*="canvas"], [class*="workspace"]');
            const hasLoadedContent = document.querySelector('[class*="loading"]') === null;
            const hasMainContent = document.body.innerText.length > 1000; // Substantial content loaded
            
            return hasProjectContent || (hasLoadedContent && hasMainContent);
          }, { timeout: 30000 });
          
          addDebugStep('Dashboard Loading', 'success', 'Dashboard content loaded successfully');
          
          // Take another screenshot after content loads
          await sleep(2000);
          await takeScreenshot('Dashboard Fully Loaded', page);
          
        } catch (error) {
          addDebugStep('Dashboard Loading', 'warning', 'Dashboard loading timeout, continuing...', null, error.message);
        }
        
        // Try to close any remaining popups after dashboard loads
        addDebugStep('Final Popup Cleanup', 'info', 'Checking for any remaining popups...');
        
        try {
          const remainingPopupsClosed = await page.evaluate(() => {
            let closedCount = 0;
            
            // Get all buttons on the page
            const allButtons = document.querySelectorAll('button, a, [role="button"]');
            
            for (const button of allButtons) {
              if (button.offsetParent === null) continue; // Skip hidden buttons
              
              const text = (button.innerText || button.textContent || '').trim();
              const lowerText = text.toLowerCase();
              const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
              
              // Look for "Accept All" buttons in cookie popups (exact match first)
              if (text === 'Accept All' || lowerText === 'accept all') {
                button.click();
                closedCount++;
                console.log('Clicked Accept All button (final cleanup):', text);
                continue;
              }
              
              // Look for close buttons
              if (text === '×' || text === '✕' || text === 'Close' || lowerText === 'close' || 
                  ariaLabel.includes('close')) {
                button.click();
                closedCount++;
                console.log('Closed popup (final cleanup):', text);
                continue;
              }
            }
            
            return closedCount;
          });
          
          if (remainingPopupsClosed > 0) {
            addDebugStep('Final Popup Cleanup', 'success', `Closed ${remainingPopupsClosed} remaining popup(s)`);
            await sleep(1000);
            await takeScreenshot('After Final Popup Cleanup', page);
          } else {
            addDebugStep('Final Popup Cleanup', 'info', 'No remaining popups found');
          }
          
        } catch (error) {
          addDebugStep('Final Popup Cleanup', 'warning', 'Error in final popup cleanup', null, error.message);
        }
        
        // Click on "Accept All" for privacy policy - TARGET SPECIFIC BUTTON
        addDebugStep('Privacy Accept', 'info', 'TARGETING SPECIFIC BUTTON: button.dg-button.accept_all');
        
        try {
          // Wait for privacy popup to appear
          await sleep(3000);
          
          // Take screenshot to see current state
          await takeScreenshot('Before Privacy Popup Handling', page);
          
          let privacyAccepted = false;
          
          // Method 1: Direct click on specific button using Puppeteer
          addDebugStep('Privacy Accept', 'info', 'Method 1: Direct click on button.dg-button.accept_all...');
          try {
            await page.waitForSelector('button.dg-button.accept_all', { visible: true, timeout: 5000 });
            await page.click('button.dg-button.accept_all');
            privacyAccepted = true;
            addDebugStep('Privacy Accept', 'success', 'Successfully clicked specific Accept All button via Puppeteer');
            await sleep(3000);
            await takeScreenshot('After Direct Accept All Click', page);
          } catch (error) {
            addDebugStep('Privacy Accept', 'warning', `Direct click failed: ${error.message}`);
          }
          
          // Method 2: If direct click failed, try page.evaluate with specific selector
          if (!privacyAccepted) {
            addDebugStep('Privacy Accept', 'info', 'Method 2: Using page.evaluate with specific selector...');
            privacyAccepted = await page.evaluate(() => {
              const specificButton = document.querySelector('button.dg-button.accept_all');
              if (specificButton && specificButton.offsetParent !== null) {
                console.log('Found specific button:', specificButton);
                specificButton.click();
                return true;
              }
              console.log('Specific button not found or not visible');
              return false;
            });
            
            if (privacyAccepted) {
              addDebugStep('Privacy Accept', 'success', 'Successfully clicked specific Accept All button via page.evaluate');
              await sleep(3000);
              await takeScreenshot('After Evaluate Accept All Click', page);
            }
          }
          
          // Method 3: Fallback - look for any button with "Accept All" text
          if (!privacyAccepted) {
            addDebugStep('Privacy Accept', 'info', 'Method 3: Fallback - looking for any Accept All button...');
            privacyAccepted = await page.evaluate(() => {
              const allButtons = document.querySelectorAll('button');
              console.log('All buttons found:', allButtons.length);
              
              for (const button of allButtons) {
                if (button.offsetParent === null) continue;
                const text = (button.innerText || button.textContent || '').trim();
                console.log('Button text:', text, 'classes:', button.className);
                
                if (text === 'Accept All') {
                  console.log('Found Accept All button:', button);
                  button.click();
                  return true;
                }
              }
              return false;
            });
            
            if (privacyAccepted) {
              addDebugStep('Privacy Accept', 'success', 'Successfully clicked Accept All button (fallback)');
              await sleep(3000);
              await takeScreenshot('After Fallback Accept All Click', page);
            } else {
              addDebugStep('Privacy Accept', 'error', 'Could not find or click any Accept All button');
              await takeScreenshot('Accept All Button Not Found', page);
            }
          }
          
          // Verify privacy popup is closed
          if (privacyAccepted) {
            const popupStillVisible = await page.evaluate(() => {
              // Check if the specific button is still visible
              const specificButton = document.querySelector('button.dg-button.accept_all');
              const privacyText = document.body.innerText.toLowerCase();
              return (specificButton && specificButton.offsetParent !== null) || 
                     privacyText.includes('privacy settings') || 
                     privacyText.includes('accept all') || 
                     privacyText.includes('cookies');
            });
            
            if (popupStillVisible) {
              addDebugStep('Privacy Accept', 'warning', 'Privacy popup may still be visible');
            } else {
              addDebugStep('Privacy Accept', 'success', 'Privacy popup successfully closed');
            }
          }
          
        } catch (error) {
          addDebugStep('Privacy Accept', 'error', 'Error clicking Accept All button', null, error.message);
        }
        
        // CRITICAL: Force close any remaining popups before proceeding
        addDebugStep('Force Popup Close', 'info', 'Force closing any remaining popups...');
        try {
          // Try multiple aggressive methods to close popups
          const popupClosed = await page.evaluate(() => {
            // Method 1: Click any visible "Accept All" button
            const acceptButtons = document.querySelectorAll('button[class*="accept"], button:contains("Accept All"), button:contains("Accept")');
            for (const btn of acceptButtons) {
              if (btn.offsetParent !== null) {
                btn.click();
                console.log('Clicked accept button:', btn);
                return true;
              }
            }
            
            // Method 2: Click any close buttons (X, Close, etc.)
            const closeButtons = document.querySelectorAll('button[class*="close"], button:contains("×"), button:contains("✕"), [aria-label*="close"]');
            for (const btn of closeButtons) {
              if (btn.offsetParent !== null) {
                btn.click();
                console.log('Clicked close button:', btn);
                return true;
              }
            }
            
            // Method 3: Press Escape key
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }));
            console.log('Pressed Escape key');
            
            return false;
          });
          
          if (popupClosed) {
            addDebugStep('Force Popup Close', 'success', 'Successfully closed popup');
            await sleep(2000);
            await takeScreenshot('After Force Popup Close', page);
          }
        } catch (error) {
          addDebugStep('Force Popup Close', 'warning', 'Error force closing popup', null, error.message);
        }
        
        // Check if privacy popup is closed
        addDebugStep('Privacy Check', 'info', 'Checking if privacy popup is closed before proceeding...');
        const privacyPopupClosed = await page.evaluate(() => {
          const privacyText = document.body.innerText.toLowerCase();
          const hasPrivacyPopup = privacyText.includes('privacy settings') || 
                                 privacyText.includes('accept all') || 
                                 privacyText.includes('cookies') ||
                                 document.querySelector('[class*="privacy"], [class*="cookie"], [class*="popup"], [class*="modal"]') !== null;
          return !hasPrivacyPopup;
        });
        
        if (!privacyPopupClosed) {
          addDebugStep('Privacy Check', 'warning', 'Privacy popup may still be visible - continuing anyway');
          await takeScreenshot('Privacy Popup May Still Be Visible', page);
        } else {
          addDebugStep('Privacy Check', 'success', 'Privacy popup is closed - proceeding with next steps');
        }
        
        // Click on the "Image" icon
        addDebugStep('Image Icon', 'info', 'Looking for and clicking Image icon...');
        
        try {
          const imageIconClicked = await page.evaluate(() => {
            // First try to find by data-testid (most reliable)
            const imageButton = document.querySelector('button[data-testid="new-raster"]');
            if (imageButton && imageButton.offsetParent !== null) {
              imageButton.click();
              console.log('Clicked Image button by data-testid');
              return true;
            }
            
            // Fallback: Get all clickable elements
            const allElements = document.querySelectorAll('button, a, [role="button"], div[onclick]');
            
            for (const element of allElements) {
              if (element.offsetParent === null) continue; // Skip hidden elements
              
              const text = (element.innerText || element.textContent || '').trim();
              const lowerText = text.toLowerCase();
              const className = element.className || '';
              const tagName = element.tagName.toLowerCase();
              const testId = element.getAttribute('data-testid');
              
              console.log('Checking image element:', text, 'tag:', tagName, 'class:', className, 'testid:', testId);
              
              // Look for "Image" text (exact match)
              if (text === 'Image' || lowerText === 'image') {
                // Check if it's clickable or in a clickable container
                const isClickable = element.onclick || element.getAttribute('role') === 'button' || 
                                  tagName === 'button' || tagName === 'a' || 
                                  element.closest('button, a, [role="button"], [onclick]');
                
                if (isClickable) {
                  element.click();
                  console.log('Clicked Image icon:', text);
                  return true;
                }
              }
              
              // Look for elements with image-related classes or attributes
              if (className.includes('image') || element.getAttribute('data-type') === 'image' ||
                  element.getAttribute('data-name') === 'image' || testId === 'new-raster') {
                element.click();
                console.log('Clicked Image element by class/attribute/testid:', text);
                return true;
              }
              
              // Look for elements containing image icons (SVG, img tags)
              const hasImageIcon = element.querySelector('svg, img') && text.toLowerCase().includes('image');
              if (hasImageIcon) {
                element.click();
                console.log('Clicked Image element with icon:', text);
                return true;
              }
            }
            
            return false;
          });
          
          if (imageIconClicked) {
            addDebugStep('Image Icon', 'success', 'Successfully clicked Image icon');
            await sleep(2000);
            await takeScreenshot('After Clicking Image Icon', page);

            // Skip Recraft V3 Raw - default style is already selected
            await sleep(2000); // Wait for page to settle
            await takeScreenshot('After Image Click', page);

            // --- STEP 1: Adjust image count slider to 1 image ---
                        addDebugStep('Image Count Slider', 'info', 'Adjusting image count slider to 1 image...');
                        try {
                          const sliderAdjusted = await page.evaluate(() => {
                            // Find the range input for numberOfImages
                            const slider = document.querySelector('input[name="numberOfImages"][type="range"]');
                            if (slider) {
                              console.log('Found slider, current value:', slider.value);
                              
                              // Get slider dimensions
                              const rect = slider.getBoundingClientRect();
                              
                              // Method 1: Try clicking on the rounded button in the middle and dragging left
                              const currentPosition = rect.left + (rect.width * 0.75); // Current position (right side for value 2)
                              const targetPosition = rect.left + (rect.width * 0.25); // Target position (left side for value 1)
                              const centerY = rect.top + (rect.height / 2);
                              
                              // Simulate mouse down on current position (middle of slider)
                              const mouseDownEvent = new MouseEvent('mousedown', {
                                bubbles: true,
                                cancelable: true,
                                clientX: currentPosition,
                                clientY: centerY,
                                button: 0
                              });
                              
                              // Simulate mouse move to left (drag)
                              const mouseMoveEvent = new MouseEvent('mousemove', {
                                bubbles: true,
                                cancelable: true,
                                clientX: targetPosition,
                                clientY: centerY,
                                button: 0
                              });
                              
                              // Simulate mouse up at target position
                              const mouseUpEvent = new MouseEvent('mouseup', {
                                bubbles: true,
                                cancelable: true,
                                clientX: targetPosition,
                                clientY: centerY,
                                button: 0
                              });
                              
                              // Dispatch events in sequence to simulate drag
                              slider.dispatchEvent(mouseDownEvent);
                              slider.dispatchEvent(mouseMoveEvent);
                              slider.dispatchEvent(mouseUpEvent);
                              
                              // Set the value to 1 after dragging
                              slider.value = '1';
                              
                              // Trigger change events
                              const changeEvent = new Event('change', { bubbles: true });
                              const inputEvent = new Event('input', { bubbles: true });
                              slider.dispatchEvent(changeEvent);
                              slider.dispatchEvent(inputEvent);
                              
                              console.log('Dragged slider from right to left, new value:', slider.value);
                              return true;
                            }
                            console.log('Slider not found');
                            return false;
                          });

                          if (sliderAdjusted) {
                            addDebugStep('Image Count Slider', 'success', 'Successfully adjusted slider to 1 image');
                            
                            // Wait for UI to update visually
                            await sleep(3000);
                            
                            // Wait for the slider value to be visually updated
                            try {
                              await page.waitForFunction(() => {
                                const slider = document.querySelector('input[name="numberOfImages"][type="range"]');
                                return slider && slider.value === '1';
                              }, { timeout: 5000 });
                            } catch (error) {
                              console.log('Slider value verification timeout, continuing...');
                            }
                            
                            await takeScreenshot('After Slider Adjustment', page);

                            // --- NEW STEP 4: Input prompt text ---
                            addDebugStep('Prompt Input', 'info', 'Clicking on textarea and entering prompt...');
                            try {
                              // First, click and focus the textarea
                              await page.click('textarea[name="prompt"][data-testid="recraft-textarea"]');
                              await sleep(1000);
                              
                              // Clear existing text and type new prompt
                              await page.evaluate(() => {
                                const textarea = document.querySelector('textarea[name="prompt"][data-testid="recraft-textarea"]');
                                if (textarea) {
                                  // Select all text
                                  textarea.select();
                                  // Clear it
                                  textarea.value = '';
                                  // Set new value
                                  textarea.value = 'banana bread in kitchen with sun light';
                                  
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
                              });
                              
                              // Clear the textarea first to avoid duplication
                              await page.evaluate(() => {
                                const textarea = document.querySelector('textarea[name="prompt"][data-testid="recraft-textarea"]');
                                if (textarea) {
                                  textarea.value = '';
                                  textarea.dispatchEvent(new Event('input', { bubbles: true }));
                                }
                              });
                              
                              // Use Puppeteer's type method as backup
                              await page.type('textarea[name="prompt"][data-testid="recraft-textarea"]', 'banana bread in kitchen with sun light', { delay: 100 });
                              
                              const promptEntered = true;

                              if (promptEntered) {
                                addDebugStep('Prompt Input', 'success', 'Successfully entered prompt: banana bread in kitchen with sun light');
                                
                                // Wait for the prompt to be properly registered
                                await sleep(3000);
                                
                                // Verify the prompt was actually entered
                                const promptVerified = await page.evaluate(() => {
                                  const textarea = document.querySelector('textarea[name="prompt"][data-testid="recraft-textarea"]');
                                  if (textarea) {
                                    const currentValue = textarea.value.trim();
                                    console.log('Current prompt value:', currentValue);
                                    return currentValue === 'banana bread in kitchen with sun light';
                                  }
                                  return false;
                                });
                                
                                if (promptVerified) {
                                  addDebugStep('Prompt Verification', 'success', 'Prompt successfully registered in textarea');
                                } else {
                                  addDebugStep('Prompt Verification', 'warning', 'Prompt may not have been properly registered');
                                }
                                
                                await takeScreenshot('After Prompt Input', page);

                                // Check if Generate button is now active
                                const generateButtonActive = await page.evaluate(() => {
                                  const generateBtn = document.querySelector('button[data-testid="recraft-button"]');
                                  if (generateBtn) {
                                    const isDisabled = generateBtn.disabled || generateBtn.classList.contains('disabled') || 
                                                     generateBtn.style.pointerEvents === 'none' || 
                                                     generateBtn.style.opacity === '0.5';
                                    const isClickable = !isDisabled && generateBtn.offsetParent !== null;
                                    console.log('Generate button state:', {
                                      disabled: generateBtn.disabled,
                                      classes: generateBtn.className,
                                      style: generateBtn.style.cssText,
                                      clickable: isClickable
                                    });
                                    return isClickable;
                                  }
                                  return false;
                                });

                                if (generateButtonActive) {
                                  addDebugStep('Generate Button Check', 'success', 'Generate button is now active and clickable');
                                } else {
                                  addDebugStep('Generate Button Check', 'warning', 'Generate button is still not active - may need to close privacy popup');
                                  
                                  // Try to close privacy popup one more time
                                  const popupClosed = await page.evaluate(() => {
                                    const allElements = document.querySelectorAll('button, [role="button"]');
                                    for (const element of allElements) {
                                      if (element.offsetParent === null) continue;
                                      const text = (element.innerText || element.textContent || '').trim();
                                      if (text === 'Accept All' || text.toLowerCase().includes('accept all')) {
                                        element.click();
                                        console.log('Clicked Accept All button (retry)');
                                        return true;
                                      }
                                    }
                                    return false;
                                  });
                                  
                                  if (popupClosed) {
                                    addDebugStep('Privacy Popup Retry', 'success', 'Closed privacy popup on retry');
                                    await sleep(2000);
                                    await takeScreenshot('After Privacy Popup Retry', page);
                                  }
                                }

                                // --- NEW STEP 5: Click Generate button ---
                                addDebugStep('Generate Images', 'info', 'Clicking Generate button...');
                                try {
                                  const generateClicked = await page.evaluate(() => {
                                    // Find the Generate button
                                    const generateBtn = document.querySelector('button[data-testid="recraft-button"]');
                                    if (generateBtn) {
                                      console.log('Found Generate button, clicking...');
                                      generateBtn.click();
                                      return true;
                                    }
                                    console.log('Generate button not found');
                                    return false;
                                  });

                                  if (generateClicked) {
                                    addDebugStep('Generate Images', 'success', 'Clicked Generate button');
                                    
                                    // Wait for generation to start
                                    await sleep(3000);
                                    await takeScreenshot('Generation Started', page);
                                    
                                    // Wait for generation to complete (look for generated images or completion indicators)
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
                                      
                                      // --- NEW STEP 6: Right-click and copy image link ---
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
                                        await sleep(2000); // Wait longer for menu to appear
                                        
                                        // Take screenshot to see if context menu appeared
                                        await takeScreenshot('After Right Click - Context Menu Check', page);
                                        
                                        // STOP HERE FOR TESTING - Check if menu actually opened
                                        addDebugStep('Image Link Extraction', 'info', 'STOPPING HERE FOR TESTING - Checking if context menu opened...');
                                        
                                        // Check if any context menu exists at all
                                        const menuExists = await page.evaluate(() => {
                                          const menus = document.querySelectorAll('[role="menu"], [data-radix-popper-content-wrapper], .context-menu, [class*="menu"]');
                                          console.log(`Found ${menus.length} potential menu elements`);
                                          for (let i = 0; i < menus.length; i++) {
                                            const menu = menus[i];
                                            console.log(`Menu ${i + 1}:`, {
                                              tagName: menu.tagName,
                                              className: menu.className,
                                              role: menu.getAttribute('role'),
                                              dataState: menu.getAttribute('data-state'),
                                              visible: menu.offsetParent !== null,
                                              text: menu.innerText?.substring(0, 100) || 'No text'
                                            });
                                          }
                                          return menus.length > 0;
                                        });
                                        
                                        if (menuExists) {
                                          addDebugStep('Image Link Extraction', 'success', 'Context menu elements found!');
                                        } else {
                                          addDebugStep('Image Link Extraction', 'error', 'NO context menu elements found at all!');
                                        }
                                        
                                        // Return early for testing - don't proceed with menu interaction
                                        return {
                                          success: false,
                                          message: 'Stopped for testing - context menu detection',
                                          finalImageUrl: null,
                                          screenshots: []
                                        };
                                          
                                          // Use XPath to find the menu item by text content within the open menu
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
                                            const copiedLink = await page.evaluate(() => {
                                              return navigator.clipboard.readText();
                                            });
                                            
                                            if (copiedLink) {
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
                                      
                                    } catch (error) {
                                      addDebugStep('Generation Wait', 'warning', 'Generation timeout, continuing...', null, error.message);
                                      await takeScreenshot('Generation Timeout', page);
                                    }
                                  } else {
                                    addDebugStep('Generate Images', 'warning', 'Could not find Generate button');
                                  }
                                  
                                } catch (error) {
                                  addDebugStep('Generate Images', 'error', 'Error clicking Generate button', null, error.message);
                                }

                              } else {
                                addDebugStep('Prompt Input', 'warning', 'Could not find or interact with prompt textarea');
                                await takeScreenshot('Prompt Input Failed', page);
                              }
                            } catch (error) {
                              addDebugStep('Prompt Input', 'error', 'Error entering prompt', null, error.message);
                            }

                          } else {
                            addDebugStep('Image Count Slider', 'warning', 'Could not find or adjust image count slider');
                            await takeScreenshot('Slider Adjustment Failed', page);
                          }
                        } catch (error) {
                          addDebugStep('Image Count Slider', 'error', 'Error adjusting image count slider', null, error.message);
                        }



          } else {
            addDebugStep('Image Icon', 'warning', 'Could not find Image icon');
          }
          
        } catch (error) {
          addDebugStep('Image Icon', 'error', 'Error clicking Image icon', null, error.message);
        }
        
      } else {
        addDebugStep('Create Project', 'warning', 'Could not find Create new project button');
      }
      
    } catch (error) {
      addDebugStep('Create Project', 'error', 'Error clicking Create new project button', null, error.message);
    }
    
    // Final page analysis
    const finalUrl = page.url();
    const finalTitle = await page.title();
    
    addDebugStep('Final Analysis', 'info', `Final URL: ${finalUrl}`);
    addDebugStep('Final Analysis', 'info', `Final Title: ${finalTitle}`);
    
    // Determine success - must be on actual Recraft.ai dashboard, not auth pages
    const isSuccess = finalUrl.includes('recraft.ai') && 
                     (finalUrl.includes('/dashboard') || finalUrl.includes('/workspace') || 
                      finalUrl.includes('/app') || finalUrl.includes('/home')) &&
                     !finalUrl.includes('keycloak') && !finalUrl.includes('auth') &&
                     !finalTitle.toLowerCase().includes('sign in') && !finalTitle.toLowerCase().includes('login');
    
    if (isSuccess) {
      addDebugStep('Result', 'success', 'Simple Recraft.ai login completed successfully!');
    } else {
      addDebugStep('Result', 'warning', 'Simple login completed but may not have reached dashboard');
    }
    
    return {
      ok: true,
      success: isSuccess,
      finalUrl: finalUrl,
      finalTitle: finalTitle,
      finalImageUrl: finalImageUrl,
      steps: debugSteps,
      message: isSuccess ? 'Simple login successful!' : 'Simple login completed with warnings'
    };
    
  } catch (error) {
    addDebugStep('Error', 'error', 'Simple scraper failed', null, error.message);
    console.error('❌ Simple scraper error:', error);
    
    return {
      ok: false,
      success: false,
      error: error.message,
      steps: debugSteps
    };
    
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { scrapeRecraftSimple };
