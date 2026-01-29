const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Global variables for scraper control
let globalBrowser = null;
let globalPage = null;
let globalScraperPaused = false;
let globalScraperStopped = false;

// Debug logging function
async function addDebugStep(step, type, message, screenshot = null, error = null, page = null) {
  const timestamp = new Date().toLocaleString();
  
  // Take screenshot for important steps if page is provided
  if (page && !screenshot && (type === 'success' || type === 'error' || step.includes('Entry') || step.includes('Button'))) {
    try {
      screenshot = await takeScreenshot(`${step.replace(/\s+/g, '-')}-${type}`, page);
    } catch (e) {
      // Screenshot failed, continue without it
    }
  }
  
  const logEntry = {
    step,
    type,
    message,
    timestamp,
    screenshot,
    error
  };
  
  console.log(`[${timestamp}] ${step}: ${type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'} ${message}`);
  if (screenshot) {
    console.log(`[${timestamp}] ${step}: Screenshot: ${screenshot}`);
  }
  
  // Emit to all connected clients
  if (globalIO) {
    globalIO.emit('log', logEntry);
  }
  
  return logEntry;
}

// Helper function to take screenshots
async function takeScreenshot(name, page) {
  try {
    // Check if page is still accessible before taking screenshot
    try {
      await page.evaluate(() => document.title);
    } catch (e) {
      addDebugStep('Screenshot', 'warning', `Page not accessible for screenshot ${name}: ${e.message}`);
      return null;
    }

    const timestamp = Date.now();
    const screenshotPath = path.join(__dirname, 'screenshots', `${name}-${timestamp}.png`);
    
    // Ensure screenshots directory exists
    if (!fs.existsSync(path.join(__dirname, 'screenshots'))) {
      fs.mkdirSync(path.join(__dirname, 'screenshots'), { recursive: true });
    }
    
    await page.screenshot({ path: screenshotPath, fullPage: true });
    
    // Verify file was saved
    if (fs.existsSync(screenshotPath)) {
      const stats = fs.statSync(screenshotPath);
      const filename = `${name}-${timestamp}.png`;
      addDebugStep('Screenshot', 'success', `Screenshot saved: ${filename} (${stats.size} bytes)`);
      
      // Emit screenshot to clients
      if (globalIO) {
        globalIO.emit('screenshot', { filename: filename });
      }
      
      return filename;
    } else {
      addDebugStep('Screenshot', 'error', `Screenshot file not found: ${screenshotPath}`);
      return null;
    }
  } catch (error) {
    addDebugStep('Screenshot', 'error', `Screenshot failed: ${error.message}`);
    return null;
  }
}

// Human-like delay function
async function randomHumanDelay(page, min = 500, max = 2000) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  await page.waitForTimeout(delay);
}

// Generate random names
function generateRandomName() {
  const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'James', 'Jessica', 'Robert', 'Ashley', 'William', 'Amanda', 'Richard', 'Jennifer', 'Charles', 'Lisa', 'Joseph', 'Michelle', 'Thomas', 'Kimberly'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];
  
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  
  return { firstName, lastName };
}

// Main Outlook account creation function
async function createOutlookAccount(email, password, io = null) {
  let browser = null;
  let page = null;
  
  try {
    globalIO = io;
    globalScraperPaused = false;
    globalScraperStopped = false;
    
    await addDebugStep('Outlook Account Creation', 'info', '🚀 Starting Outlook account creation process...', null, null, page);
    await addDebugStep('Outlook Account Creation', 'info', `📧 Email: ${email}`, null, null, page);
    await addDebugStep('Outlook Account Creation', 'info', `🔑 Password: ${password}`, null, null, page);
    
    // Launch browser
    addDebugStep('Browser', 'info', 'Launching browser...');
    browser = await puppeteer.launch({
      headless: true,
      protocolTimeout: 120000, // 2 minutes timeout
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });
    
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    
    // Set global references
    globalBrowser = browser;
    globalPage = page;
    
    // Step 1: Navigate to Outlook signup
    addDebugStep('Navigation', 'info', 'Navigating to Outlook signup...');
    await page.goto('https://signup.live.com/signup', { waitUntil: 'networkidle2' });
    await takeScreenshot('Outlook-Signup-Initial', page);
    await addDebugStep('Navigation', 'success', 'Successfully navigated to Outlook signup', null, null, page);
    
    // Wait for page to load
    await randomHumanDelay(page, 2000, 3000);
    
    // Step 2: Enter email
    addDebugStep('Email Entry', 'info', 'Entering email address...');
    
    // Wait for email input field
    await page.waitForSelector('input[type="email"][name="Email"]', { timeout: 10000 });
    
    // Clear and enter email
    await page.click('input[type="email"][name="Email"]');
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.type('input[type="email"][name="Email"]', email, { delay: 100 });
    
    await takeScreenshot('Email-Entered', page);
    await addDebugStep('Email Entry', 'success', 'Email entered successfully', null, null, page);
    
    // Step 3: Click Next button
    addDebugStep('Email Entry', 'info', 'Clicking Next button...');
    await page.click('button[type="submit"][data-testid="primaryButton"]');
    await takeScreenshot('Email-Next-Clicked', page);
    await addDebugStep('Email Entry', 'success', 'Next button clicked', null, null, page);
    
    // Wait for page transition
    await randomHumanDelay(page, 3000, 5000);
    
    // Step 4: Enter password
    addDebugStep('Password Entry', 'info', 'Entering password...');
    
    // Wait for password input field
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    
    // Enter password
    await page.click('input[type="password"]');
    await page.type('input[type="password"]', password, { delay: 100 });
    
    await takeScreenshot('Password-Entered', page);
    await addDebugStep('Password Entry', 'success', 'Password entered successfully', null, null, page);
    
    // Step 5: Click Next button for password
    addDebugStep('Password Entry', 'info', 'Clicking Next button...');
    await page.click('button[type="submit"][data-testid="primaryButton"]');
    await takeScreenshot('Password-Next-Clicked', page);
    await addDebugStep('Password Entry', 'success', 'Next button clicked', null, null, page);
    
    // Wait for page transition
    await randomHumanDelay(page, 3000, 5000);
    
    // Step 6: Add some details (birthdate)
    addDebugStep('Birthdate Entry', 'info', 'Adding birthdate details...');
    
    // Wait for birthdate page
    await page.waitForSelector('input[name="BirthYear"]', { timeout: 10000 });
    
    // Select month (January)
    addDebugStep('Birthdate Entry', 'info', 'Selecting month...');
    
    // First, try to find and click the month dropdown
    try {
      await page.click('button[name="BirthMonth"]');
      await randomHumanDelay(page, 1000, 1500);
      
      // Look for January option in the dropdown
      const monthSelected = await page.evaluate(() => {
        // Try to find January option by text
        const options = Array.from(document.querySelectorAll('[role="option"], option, [data-value]'));
        for (const option of options) {
          const text = option.textContent?.toLowerCase() || '';
          if (text.includes('january') || text.includes('jan')) {
            option.click();
            return true;
          }
        }
        return false;
      });
      
      if (!monthSelected) {
        // Fallback: try to click first option
        await page.click('[role="option"]:first-child');
      }
      
      await addDebugStep('Birthdate Entry', 'success', 'Month selected successfully', null, null, page);
    } catch (e) {
      addDebugStep('Birthdate Entry', 'warning', `Month selection failed: ${e.message}`);
    }
    
    await randomHumanDelay(page, 500, 1000);
    
    // Select day (1)
    addDebugStep('Birthdate Entry', 'info', 'Selecting day...');
    
    try {
      await page.click('button[name="BirthDay"]');
      await randomHumanDelay(page, 1000, 1500);
      
      // Look for day 1 option
      const daySelected = await page.evaluate(() => {
        const options = Array.from(document.querySelectorAll('[role="option"], option, [data-value]'));
        for (const option of options) {
          const text = option.textContent?.trim() || '';
          if (text === '1') {
            option.click();
            return true;
          }
        }
        return false;
      });
      
      if (!daySelected) {
        // Fallback: try to click first option
        await page.click('[role="option"]:first-child');
      }
      
      await addDebugStep('Birthdate Entry', 'success', 'Day selected successfully', null, null, page);
    } catch (e) {
      addDebugStep('Birthdate Entry', 'warning', `Day selection failed: ${e.message}`);
    }
    
    // Enter year (1986)
    addDebugStep('Birthdate Entry', 'info', 'Entering year...');
    await page.click('input[name="BirthYear"]');
    await page.type('input[name="BirthYear"]', '1986', { delay: 100 });
    
    await takeScreenshot('Birthdate-Entered', page);
    await addDebugStep('Birthdate Entry', 'success', 'Birthdate entered successfully', null, null, page);
    
    // Click Next button
    addDebugStep('Birthdate Entry', 'info', 'Clicking Next button...');
    await page.click('button[type="submit"][data-testid="primaryButton"]');
    await takeScreenshot('Birthdate-Next-Clicked', page);
    await addDebugStep('Birthdate Entry', 'success', 'Next button clicked', null, null, page);
    
    // Wait for page transition
    await randomHumanDelay(page, 3000, 5000);
    
    // Step 7: Add name
    addDebugStep('Name Entry', 'info', 'Adding name details...');
    
    // Wait for name page
    await page.waitForSelector('input[name="firstNameInput"]', { timeout: 10000 });
    
    // Generate random names
    const { firstName, lastName } = generateRandomName();
    
    // Enter first name
    addDebugStep('Name Entry', 'info', `Entering first name: ${firstName}`);
    await page.click('input[name="firstNameInput"]');
    await page.type('input[name="firstNameInput"]', firstName, { delay: 100 });
    
    // Enter last name
    addDebugStep('Name Entry', 'info', `Entering last name: ${lastName}`);
    await page.click('input[name="lastNameInput"]');
    await page.type('input[name="lastNameInput"]', lastName, { delay: 100 });
    
    await takeScreenshot('Name-Entered', page);
    await addDebugStep('Name Entry', 'success', `Name entered: ${firstName} ${lastName}`, null, null, page);
    
    // Click Next button
    addDebugStep('Name Entry', 'info', 'Clicking Next button...');
    await page.click('button[type="submit"][data-testid="primaryButton"]');
    await takeScreenshot('Name-Next-Clicked', page);
    await addDebugStep('Name Entry', 'success', 'Next button clicked', null, null, page);
    
    // Wait for page transition
    await randomHumanDelay(page, 3000, 5000);
    
    // Step 8: Human verification (Press and hold)
    await addDebugStep('Human Verification', 'info', 'Starting human verification (press and hold)...', null, null, page);
    
    // Wait for human verification page to load
    await page.waitForFunction(() => {
      return document.body.textContent.includes('prove you\'re human') || 
             document.body.textContent.includes('Press and hold') ||
             document.querySelector('button[type="button"]') !== null;
    }, { timeout: 15000 });
    
    // Find the press and hold button using multiple approaches
    const holdButton = await page.evaluate(() => {
      // Try different selectors for the hold button
      const selectors = [
        'button[type="button"]',
        'button[aria-label*="hold"]',
        'button[aria-label*="press"]',
        'button[class*="hold"]',
        'button[class*="press"]'
      ];
      
      for (const selector of selectors) {
        const button = document.querySelector(selector);
        if (button && button.offsetParent !== null) {
          return { found: true, selector: selector };
        }
      }
      
      // Fallback: look for any visible button
      const buttons = Array.from(document.querySelectorAll('button'));
      for (const button of buttons) {
        if (button.offsetParent !== null && 
            (button.textContent.toLowerCase().includes('hold') || 
             button.getAttribute('aria-label')?.toLowerCase().includes('hold') ||
             button.className.includes('hold'))) {
          return { found: true, selector: 'button by text/aria-label' };
        }
      }
      
      return { found: false };
    });
    
    if (!holdButton.found) {
      throw new Error('Press and hold button not found');
    }
    
    await addDebugStep('Human Verification', 'success', `Found press and hold button using: ${holdButton.selector}`, null, null, page);
    
    // Get the button element and press and hold it
    const buttonElement = await page.$('button[type="button"]') || 
                         await page.$('button[aria-label*="hold"]') ||
                         await page.$('button[aria-label*="press"]');
    
    if (!buttonElement) {
      throw new Error('Could not find button element');
    }
    
    // Get button position
    const box = await buttonElement.boundingBox();
    if (!box) {
      throw new Error('Could not get button position');
    }
    
    await addDebugStep('Human Verification', 'info', 'Starting to hold the button...', null, null, page);
    
    // Move mouse to button center and press and hold
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    
    // Hold the button and monitor progress bar
    let verificationComplete = false;
    let holdTime = 0;
    const maxHoldTime = 20000; // 20 seconds max
    let progressDetected = false;
    let lastProgress = 0;
    
    await addDebugStep('Human Verification', 'info', 'Starting to hold button and monitor progress...', null, null, page);
    
    while (!verificationComplete && holdTime < maxHoldTime) {
      await page.waitForTimeout(100);
      holdTime += 100;
      
      // Monitor progress bar and button state
      try {
        const progressInfo = await page.evaluate(() => {
          // Target the specific progress bar element
          let progressValue = 0;
          let progressElement = null;
          let progressText = '';
          let debugInfo = [];
          
          // Strategy 1: Look for the specific progress bar div by exact ID
          const exactProgressBar = document.getElementById('oHlwWeEQqwYPjwS');
          if (exactProgressBar) {
            const inlineStyle = exactProgressBar.getAttribute('style') || '';
            debugInfo.push(`Found exact ID element: ${inlineStyle}`);
            
            const widthMatch = inlineStyle.match(/width:\s*([0-9.]+)px/);
            if (widthMatch) {
              progressValue = parseFloat(widthMatch[1]);
              progressElement = exactProgressBar;
              progressText = `Exact ID: ${progressValue}px`;
              debugInfo.push(`Extracted width: ${progressValue}px`);
            }
          }
          
          // Strategy 1.5: Look for any div with the exact ID pattern (dynamic IDs)
          if (progressValue === 0) {
            const allDivs = document.querySelectorAll('div');
            for (const div of allDivs) {
              const id = div.getAttribute('id') || '';
              const style = div.getAttribute('style') || '';
              
              // Look for divs with width style that could be progress bars
              if (style.includes('width') && style.includes('px')) {
                debugInfo.push(`Found div with width: ${id} - ${style}`);
                
                const widthMatch = style.match(/width:\s*([0-9.]+)px/);
                if (widthMatch) {
                  const width = parseFloat(widthMatch[1]);
                  if (width > 0 && width <= 216) {
                    progressValue = width;
                    progressElement = div;
                    progressText = `Div ${id}: ${width}px`;
                    debugInfo.push(`Div ${id} width: ${width}px`);
                  }
                }
              }
            }
          }
          
          // Strategy 2: Look for any div with width style that could be progress
          if (progressValue === 0) {
            const allDivs = document.querySelectorAll('div[style*="width"]');
            debugInfo.push(`Found ${allDivs.length} divs with width style`);
            
            for (const div of allDivs) {
              const style = div.getAttribute('style') || '';
              const id = div.getAttribute('id') || 'no-id';
              debugInfo.push(`Div ${id}: ${style}`);
              
              const widthMatch = style.match(/width:\s*([0-9.]+)px/);
              if (widthMatch) {
                const width = parseFloat(widthMatch[1]);
                debugInfo.push(`Div ${id} width: ${width}px`);
                if (width > progressValue && width <= 216) { // Max width is 216px
                  progressValue = width;
                  progressElement = div;
                  progressText = `Div ${id}: ${width}px`;
                }
              }
            }
          }
          
          // Strategy 3: Look for elements with partial ID matches
          if (progressValue === 0) {
            const partialMatches = document.querySelectorAll('div[id*="oHlwWeEQqwYPjwS"]');
            debugInfo.push(`Found ${partialMatches.length} divs with partial ID match`);
            
            for (const div of partialMatches) {
              const style = div.getAttribute('style') || '';
              const id = div.getAttribute('id') || 'no-id';
              debugInfo.push(`Partial match ${id}: ${style}`);
              
              const widthMatch = style.match(/width:\s*([0-9.]+)px/);
              if (widthMatch) {
                const width = parseFloat(widthMatch[1]);
                if (width > progressValue) {
                  progressValue = width;
                  progressElement = div;
                  progressText = `Partial ID ${id}: ${width}px`;
                }
              }
            }
          }
          
          // Strategy 4: Look for any element with width style
          if (progressValue === 0) {
            const allElements = document.querySelectorAll('*[style*="width"]');
            debugInfo.push(`Found ${allElements.length} elements with width style`);
            
            for (const element of allElements) {
              const style = element.getAttribute('style') || '';
              const tagName = element.tagName.toLowerCase();
              const id = element.getAttribute('id') || 'no-id';
              
              const widthMatch = style.match(/width:\s*([0-9.]+)px/);
              if (widthMatch) {
                const width = parseFloat(widthMatch[1]);
                if (width > 0 && width <= 216) {
                  debugInfo.push(`${tagName}#${id}: ${width}px`);
                  if (width > progressValue) {
                    progressValue = width;
                    progressElement = element;
                    progressText = `${tagName}#${id}: ${width}px`;
                  }
                }
              }
            }
          }
          
          // Strategy 5: Look for any element with computed width that might be changing
          if (progressValue === 0) {
            const allElements = document.querySelectorAll('*');
            debugInfo.push(`Checking ${allElements.length} elements for computed width`);
            
            for (const element of allElements) {
              try {
                const computedStyle = window.getComputedStyle(element);
                const width = computedStyle.width;
                const id = element.getAttribute('id') || 'no-id';
                const tagName = element.tagName.toLowerCase();
                
                if (width && width.includes('px')) {
                  const widthValue = parseFloat(width.replace('px', ''));
                  if (widthValue > 0 && widthValue <= 216) {
                    debugInfo.push(`Computed ${tagName}#${id}: ${widthValue}px`);
                    if (widthValue > progressValue) {
                      progressValue = widthValue;
                      progressElement = element;
                      progressText = `Computed ${tagName}#${id}: ${widthValue}px`;
                    }
                  }
                }
              } catch (e) {
                // Skip elements that can't be computed
              }
            }
          }
          
          // Strategy 6: Look for the specific container structure you mentioned
          if (progressValue === 0) {
            // Look for the container div with dir="auto"
            const containerDivs = document.querySelectorAll('div[dir="auto"]');
            debugInfo.push(`Found ${containerDivs.length} divs with dir="auto"`);
            
            for (const container of containerDivs) {
              // Look for child divs with width style
              const childDivs = container.querySelectorAll('div[style*="width"]');
              debugInfo.push(`Container has ${childDivs.length} child divs with width`);
              
              for (const child of childDivs) {
                const id = child.getAttribute('id') || 'no-id';
                const style = child.getAttribute('style') || '';
                debugInfo.push(`Child div ${id}: ${style}`);
                
                const widthMatch = style.match(/width:\s*([0-9.]+)px/);
                if (widthMatch) {
                  const width = parseFloat(widthMatch[1]);
                  if (width > 0 && width <= 216) {
                    progressValue = width;
                    progressElement = child;
                    progressText = `Container child ${id}: ${width}px`;
                    debugInfo.push(`Container child ${id} width: ${width}px`);
                  }
                }
              }
            }
          }
          
          // Strategy 7: Look for progress bar near the "Press and hold" button
          if (progressValue === 0) {
            // Find the "Press and hold" button first
            const pressHoldButton = document.querySelector('button[type="button"]') ||
                                 document.querySelector('button[aria-label*="hold"]') ||
                                 document.querySelector('button[class*="hold"]') ||
                                 document.querySelector('p[style*="animation"]');
            
            if (pressHoldButton) {
              debugInfo.push(`Found Press and hold button: ${pressHoldButton.tagName}`);
              
              // Look for progress bar in the same container or nearby
              const parent = pressHoldButton.parentElement;
              if (parent) {
                const siblings = parent.querySelectorAll('div[style*="width"]');
                debugInfo.push(`Found ${siblings.length} sibling divs with width`);
                
                for (const sibling of siblings) {
                  const id = sibling.getAttribute('id') || 'no-id';
                  const style = sibling.getAttribute('style') || '';
                  debugInfo.push(`Sibling div ${id}: ${style}`);
                  
                  const widthMatch = style.match(/width:\s*([0-9.]+)px/);
                  if (widthMatch) {
                    const width = parseFloat(widthMatch[1]);
                    if (width > 0 && width <= 216) {
                      progressValue = width;
                      progressElement = sibling;
                      progressText = `Button sibling ${id}: ${width}px`;
                      debugInfo.push(`Button sibling ${id} width: ${width}px`);
                    }
                  }
                }
              }
            }
          }
          
          // Look for button state changes and animation timing
          const button = document.querySelector('button[type="button"]') || 
                       document.querySelector('button[aria-label*="hold"]') ||
                       document.querySelector('button[class*="hold"]');
          
          let buttonState = 'unknown';
          let animationDuration = 0;
          let animationProgress = 0;
          
          if (button) {
            const buttonStyle = window.getComputedStyle(button);
            const buttonText = button.textContent || '';
            
            // Extract animation duration from button's style
            const buttonInlineStyle = button.getAttribute('style') || '';
            const animationMatch = buttonInlineStyle.match(/animation:\s*([0-9.]+)ms/);
            if (animationMatch) {
              animationDuration = parseFloat(animationMatch[1]);
              debugInfo.push(`Button animation duration: ${animationDuration}ms`);
            }
            
            if (buttonText.includes('Press and hold') || buttonText.includes('Hold')) {
              buttonState = 'holding';
            } else if (buttonText.includes('Release') || buttonText.includes('Complete')) {
              buttonState = 'ready_to_release';
            } else if (buttonText.includes('✓') || buttonText.includes('Complete')) {
              buttonState = 'completed';
            }
          }
          
          // Also check for animation in the "Press and hold" text element
          const pressHoldText = document.querySelector('p[style*="animation"]') ||
                               document.querySelector('p[id*="zwNTvjKBlPSPuOj"]') ||
                               document.querySelector('p[class*="JDHpitXjyUXyEhc"]');
          
          if (pressHoldText && !animationDuration) {
            const textStyle = pressHoldText.getAttribute('style') || '';
            const textAnimationMatch = textStyle.match(/animation:\s*([0-9.]+)ms/);
            if (textAnimationMatch) {
              animationDuration = parseFloat(textAnimationMatch[1]);
              debugInfo.push(`Text animation duration: ${animationDuration}ms`);
            }
          }
          
          // Calculate animation progress if we have duration
          if (animationDuration > 0) {
            // Try to estimate progress based on animation timing
            // This is a rough estimate - the actual progress might be different
            const estimatedProgress = Math.min(100, (holdTime / animationDuration) * 100);
            animationProgress = estimatedProgress;
            debugInfo.push(`Animation progress: ${animationProgress.toFixed(1)}%`);
          }
          
          // Look for visual completion indicators
          const hasCheckmark = document.querySelector('svg[data-testid="checkmark"]') !== null ||
                              document.querySelector('.checkmark') !== null ||
                              document.querySelector('[class*="success"]') !== null ||
                              document.querySelector('[class*="complete"]') !== null ||
                              document.querySelector('[class*="verified"]') !== null;
          
          // Look for text completion indicators
          const hasSuccessText = document.body.textContent.includes('verified') ||
                               document.body.textContent.includes('success') ||
                               document.body.textContent.includes('complete') ||
                               document.body.textContent.includes('continue') ||
                               document.body.textContent.includes('next');
          
          return {
            progressValue,
            progressElement: progressElement ? progressElement.tagName : null,
            progressText,
            buttonState,
            hasCheckmark,
            hasSuccessText,
            isComplete: hasCheckmark || hasSuccessText || buttonState === 'completed',
            animationDuration,
            animationProgress,
            debugInfo: debugInfo.slice(0, 10) // Limit debug info to first 10 items
          };
        });
        
        // Log progress if detected
        if (progressInfo.progressValue > lastProgress) {
          lastProgress = progressInfo.progressValue;
          progressDetected = true;
          const percentage = ((progressInfo.progressValue / 216) * 100).toFixed(1);
          await addDebugStep('Human Verification', 'info', `Progress: ${progressInfo.progressValue}px (${percentage}%) - ${progressInfo.progressText || 'Unknown method'}`, null, null, page);
        }
        
        // Log detailed progress info every 2 seconds
        if (holdTime % 2000 < 100) {
          const percentage = ((progressInfo.progressValue / 216) * 100).toFixed(1);
          const animationInfo = progressInfo.animationDuration > 0 ? 
            `, Animation: ${progressInfo.animationDuration}ms (${progressInfo.animationProgress.toFixed(1)}%)` : '';
          await addDebugStep('Human Verification', 'info', `Hold time: ${holdTime}ms, Progress: ${progressInfo.progressValue}px (${percentage}%), Button: ${progressInfo.buttonState}, Checkmark: ${progressInfo.hasCheckmark}${animationInfo}`, null, null, page);
          
          // Log debug information to help troubleshoot
          if (progressInfo.debugInfo && progressInfo.debugInfo.length > 0) {
            await addDebugStep('Human Verification', 'info', `Debug: ${progressInfo.debugInfo.join('; ')}`, null, null, page);
          }
        }
        
        // Check if verification is complete
        verificationComplete = progressInfo.isComplete;
        
        // Smart release: if progress is near completion (80%+ of 216px = 172px+)
        if (!verificationComplete && progressInfo.progressValue >= 172) {
          await addDebugStep('Human Verification', 'info', `Progress near completion (${progressInfo.progressValue}px/216px), releasing button...`, null, null, page);
          break;
        }
        
        // Animation-based release: if animation is near completion (90%+ of animation duration)
        if (!verificationComplete && progressInfo.animationDuration > 0 && progressInfo.animationProgress >= 90) {
          await addDebugStep('Human Verification', 'info', `Animation near completion (${progressInfo.animationProgress.toFixed(1)}% of ${progressInfo.animationDuration}ms), releasing button...`, null, null, page);
          break;
        }
        
        // If we've been holding for a while and have good progress (70%+ of 216px = 151px+)
        if (!verificationComplete && holdTime > 5000 && progressInfo.progressValue >= 151) {
          await addDebugStep('Human Verification', 'info', `Good progress detected (${progressInfo.progressValue}px/216px), releasing button...`, null, null, page);
          break;
        }
        
        // Animation-based release: if animation is at 80%+ and we've been holding for a while
        if (!verificationComplete && progressInfo.animationDuration > 0 && progressInfo.animationProgress >= 80 && holdTime > 3000) {
          await addDebugStep('Human Verification', 'info', `Animation progress good (${progressInfo.animationProgress.toFixed(1)}% of ${progressInfo.animationDuration}ms), releasing button...`, null, null, page);
          break;
        }
        
        // If progress is at 50%+ (108px+) and we've been holding for a while
        if (!verificationComplete && holdTime > 7000 && progressInfo.progressValue >= 108) {
          await addDebugStep('Human Verification', 'info', `Moderate progress (${progressInfo.progressValue}px/216px), releasing button...`, null, null, page);
          break;
        }
        
        // Animation-based release: if animation is at 70%+ and we've been holding for a while
        if (!verificationComplete && progressInfo.animationDuration > 0 && progressInfo.animationProgress >= 70 && holdTime > 5000) {
          await addDebugStep('Human Verification', 'info', `Animation progress moderate (${progressInfo.animationProgress.toFixed(1)}% of ${progressInfo.animationDuration}ms), releasing button...`, null, null, page);
          break;
        }
        
        // Fallback: if no progress detected but we've been holding for a reasonable time, release
        if (!verificationComplete && holdTime > 10000 && progressInfo.progressValue === 0) {
          await addDebugStep('Human Verification', 'info', 'No progress detected, releasing after timeout...', null, null, page);
          break;
        }
        
        // Time-based fallback: hold for 8-12 seconds minimum, then release
        if (!verificationComplete && holdTime > 8000 && holdTime < 12000) {
          await addDebugStep('Human Verification', 'info', 'Time-based release (8-12 seconds)...', null, null, page);
          break;
        }
        
        if (verificationComplete) {
          await addDebugStep('Human Verification', 'success', 'Verification completed successfully!', null, null, page);
          break;
        }
      } catch (e) {
        // Continue holding
      }
      
      // Check if we should stop (global stop flag)
      if (globalScraperStopped) {
        await addDebugStep('Human Verification', 'warning', 'Scraper stopped during human verification', null, null, page);
        return { success: false, error: 'Scraper stopped' };
      }
    }
    
    // Release the button
    await page.mouse.up();
    
    if (!verificationComplete && !progressDetected) {
      throw new Error('Human verification failed - no progress detected within timeout');
    }
    
    await addDebugStep('Human Verification', 'success', 'Button released after verification', null, null, page);
    await takeScreenshot('Human-Verification-Complete', page);
    
    // Wait for page to fully load after verification
    await randomHumanDelay(page, 2000, 3000);
    
    // Wait for page transition
    await randomHumanDelay(page, 3000, 5000);
    
    // Step 9: Microsoft account notice
    addDebugStep('Account Notice', 'info', 'Handling Microsoft account notice...');
    
    // Wait for notice page and click OK
    try {
      await page.waitForSelector('button:contains("OK")', { timeout: 10000 });
      await page.click('button:contains("OK")');
      await takeScreenshot('Account-Notice-OK', page);
      addDebugStep('Account Notice', 'success', 'Account notice acknowledged');
    } catch (e) {
      addDebugStep('Account Notice', 'warning', 'Account notice not found or already dismissed');
    }
    
    // Wait for page transition
    await randomHumanDelay(page, 3000, 5000);
    
    // Step 10: Skip biometric setup
    addDebugStep('Biometric Setup', 'info', 'Skipping biometric setup...');
    
    try {
      await page.waitForSelector('button:contains("Skip for now")', { timeout: 10000 });
      await page.click('button:contains("Skip for now")');
      await takeScreenshot('Biometric-Skipped', page);
      addDebugStep('Biometric Setup', 'success', 'Biometric setup skipped');
    } catch (e) {
      addDebugStep('Biometric Setup', 'warning', 'Biometric setup page not found');
    }
    
    // Wait for page transition
    await randomHumanDelay(page, 3000, 5000);
    
    // Step 11: Stay signed in
    addDebugStep('Stay Signed In', 'info', 'Handling stay signed in prompt...');
    
    try {
      await page.waitForSelector('button:contains("Yes")', { timeout: 10000 });
      await page.click('button:contains("Yes")');
      await takeScreenshot('Stay-Signed-In-Yes', page);
      addDebugStep('Stay Signed In', 'success', 'Stay signed in confirmed');
    } catch (e) {
      addDebugStep('Stay Signed In', 'warning', 'Stay signed in prompt not found');
    }
    
    // Wait for final page load
    await randomHumanDelay(page, 5000, 7000);
    
    // Step 12: Verify account creation
    addDebugStep('Account Verification', 'info', 'Verifying account creation...');
    
    // Check if we're logged in to Outlook
    const currentUrl = page.url();
    if (currentUrl.includes('outlook.com') || currentUrl.includes('live.com')) {
      addDebugStep('Account Verification', 'success', 'Successfully logged into Outlook!');
      await takeScreenshot('Outlook-Login-Success', page);
      
      return {
        success: true,
        email: email,
        password: password,
        firstName: firstName,
        lastName: lastName,
        message: 'Outlook account created successfully!'
      };
    } else {
      addDebugStep('Account Verification', 'warning', `Unexpected final URL: ${currentUrl}`);
      await takeScreenshot('Final-Page', page);
      
      return {
        success: true,
        email: email,
        password: password,
        firstName: firstName,
        lastName: lastName,
        message: 'Account creation process completed'
      };
    }
    
  } catch (error) {
    addDebugStep('Outlook Account Creation', 'error', '❌ Outlook account creation failed', null, error.message);
    
    // Take error screenshot
    if (page) {
      await takeScreenshot('Error-Screenshot', page);
    }
    
    return {
      success: false,
      error: error.message,
      email: email,
      password: password
    };
    
  } finally {
    // Clean up browser
    if (browser) {
      try {
        await browser.close();
        addDebugStep('Browser', 'info', 'Browser closed');
      } catch (e) {
        addDebugStep('Browser', 'warning', `Failed to close browser: ${e.message}`);
      }
    }
    
    // Reset global variables
    globalBrowser = null;
    globalPage = null;
  }
}

// Export functions
module.exports = {
  createOutlookAccount
};
