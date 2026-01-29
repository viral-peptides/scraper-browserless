const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Global variable for Socket.IO instance
let globalIO = null;

// Global scraper control variables (will be set by server)
// These will be accessed from the global scope when available

// Helper function to add debug steps
function addDebugStep(step, type, message, screenshot = null, error = null) {
  const timestamp = new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' });
  const logEntry = {
    timestamp,
    step,
    type,
    message,
    screenshot,
    error
  };
  
  console.log(`[${timestamp}] ${step}: ${message}`);
  
  if (globalIO) {
    globalIO.emit('debugStep', logEntry);
  }
  
  return logEntry;
}

// Helper function to handle Stay Signed In step
async function handleStaySignedInStep(targetPage) {
  addDebugStep('Stay Signed In', 'info', 'Handling Stay Signed In step...');
  
  // Try multiple selectors for Yes/Next button (Microsoft uses "Next" for Yes)
  const yesSelectors = [
    '//button[contains(text(), "Yes")]',
    '//button[contains(text(), "Next")]',
    '//button[@data-testid="primaryButton"]',
    '//button[contains(@class, "fui-Button") and contains(@class, "___jsyn8q0")]',
    '//button[contains(text(), "Yes, keep me signed in")]',
    '//button[contains(text(), "Keep me signed in")]',
    '//button[contains(text(), "Stay signed in")]',
    '//input[@type="submit" and @value="Yes"]',
    '//button[@type="submit"]',
    '//button[contains(@class, "primary")]',
    '//button[contains(@class, "submit")]'
  ];
  
  let yesButtonClicked = false;
  
  // First try direct JavaScript approach for Yes/Next button
  try {
    addDebugStep('Stay Signed In', 'info', 'Trying direct JavaScript click on Yes/Next button...');
    
    // Check if the button exists
    const buttonExists = await targetPage.evaluate(() => {
      const primaryButton = document.querySelector('button[data-testid="primaryButton"]');
      const yesButton = document.querySelector('button[textContent="Yes"]');
      const nextButton = document.querySelector('button[textContent="Next"]');
      
      return {
        primaryButton: !!primaryButton,
        yesButton: !!yesButton,
        nextButton: !!nextButton,
        allButtons: Array.from(document.querySelectorAll('button')).map(b => ({
          text: b.textContent?.trim() || '',
          testId: b.getAttribute('data-testid'),
          type: b.type,
          className: b.className,
          visible: b.offsetParent !== null
        })).filter(b => b.text.length > 0).slice(0, 5)
      };
    });
    
    addDebugStep('Stay Signed In', 'info', `Button check: ${JSON.stringify(buttonExists)}`);
    
    // Try to click the Yes button directly
    const clicked = await targetPage.evaluate(() => {
      const yesButton = document.querySelector('button[textContent="Yes"]');
      if (yesButton && yesButton.offsetParent !== null) {
        yesButton.click();
        return true;
      }
      
      // Fallback: look for primary button
      const primaryButton = document.querySelector('button[data-testid="primaryButton"]');
      if (primaryButton && primaryButton.offsetParent !== null) {
        primaryButton.click();
        return true;
      }
      
      return false;
    });
    
    if (clicked) {
      addDebugStep('Stay Signed In', 'success', 'Clicked Yes button using JavaScript');
      await takeScreenshot('Stay-Signed-In-Yes', targetPage);
      yesButtonClicked = true;
      
      // Wait for page navigation after clicking Yes
      addDebugStep('Stay Signed In', 'info', 'Waiting for page navigation after Yes click...');
      try {
        await targetPage.waitForNavigation({ timeout: 10000 });
        addDebugStep('Stay Signed In', 'success', 'Page navigation completed');
        
        // Take screenshot of the new page
        await takeScreenshot('After-Yes-Navigation', targetPage);
        
        // Update targetPage to the current page after navigation
        targetPage = targetPage;
        addDebugStep('Stay Signed In', 'info', `New page URL: ${await targetPage.evaluate(() => window.location.href)}`);
        
        // After Stay signed in popup closes, return to original Kie.ai page
        addDebugStep('Stay Signed In', 'info', 'Stay signed in popup closed - returning to original Kie.ai page...');
        
        // Navigate back to Kie.ai main page
        try {
          await targetPage.goto('https://kie.ai', { waitUntil: 'networkidle2', timeout: 30000 });
          addDebugStep('Stay Signed In', 'success', 'Returned to Kie.ai main page');
          await takeScreenshot('Kie-Main-Page-After-Stay-Signed-In', targetPage);
          
          // Wait for page to fully load
          addDebugStep('Stay Signed In', 'info', 'Waiting for Kie.ai page to load completely...');
          await randomHumanDelay(targetPage, 3000, 5000);
          
          // Look for Get Started button in top right corner
          addDebugStep('Stay Signed In', 'info', 'Looking for Get Started button in top right corner...');
          
          // Try to find Get Started button
          const getStartedFound = await targetPage.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, a'));
            for (const button of buttons) {
              const text = button.textContent?.toLowerCase() || '';
              if (text.includes('get started') || text.includes('getstarted')) {
                return {
                  found: true,
                  text: button.textContent,
                  tagName: button.tagName,
                  className: button.className
                };
              }
            }
            return { found: false };
          });
          
          if (getStartedFound.found) {
            addDebugStep('Stay Signed In', 'success', `Found Get Started button: ${getStartedFound.text}`);
            
            // Click Get Started button
            await targetPage.click('button:contains("Get Started"), a:contains("Get Started")');
            addDebugStep('Stay Signed In', 'success', 'Clicked Get Started button');
            await takeScreenshot('Get-Started-After-Stay-Signed-In', targetPage);
            
            // Check if Microsoft popup appears after Get Started click
            addDebugStep('Stay Signed In', 'info', 'Checking for Microsoft popup after Get Started click...');
            try {
              await targetPage.waitForSelector('button:contains("Sign in with Microsoft"), button:contains("Inloggen met Microsoft")', { timeout: 5000 });
              addDebugStep('Stay Signed In', 'success', 'Microsoft popup detected after Get Started');
              await takeScreenshot('Microsoft-Popup-After-Get-Started', targetPage);
              
              // Click Sign in with Microsoft
              await targetPage.click('button:contains("Sign in with Microsoft"), button:contains("Inloggen met Microsoft")');
              addDebugStep('Stay Signed In', 'success', 'Clicked Sign in with Microsoft after Get Started');
              await takeScreenshot('Microsoft-Login-After-Get-Started', targetPage);
              
            } catch (microsoftError) {
              addDebugStep('Stay Signed In', 'info', 'No Microsoft popup appeared after Get Started click');
            }
            
          } else {
            addDebugStep('Stay Signed In', 'warning', 'Get Started button not found on Kie.ai page');
          }
          
        } catch (kieError) {
          addDebugStep('Stay Signed In', 'error', `Failed to return to Kie.ai page: ${kieError.message}`);
        }
        
      } catch (navError) {
        addDebugStep('Stay Signed In', 'warning', `Navigation timeout: ${navError.message}`);
        
        // Try to recover page context by finding the new page
        addDebugStep('Stay Signed In', 'info', 'Attempting to recover page context...');
        try {
          const allPages = await targetPage.browser().pages();
          let newTargetPage = null;
          
          for (let i = 0; i < allPages.length; i++) {
            const page = allPages[i];
            try {
              const url = await page.url();
              const title = await page.title();
              addDebugStep('Stay Signed In', 'info', `Checking page ${i}: ${url} - ${title}`);
              
              // Look for any page that's not blank and not the old login page
              if (url !== 'about:blank' && 
                  !url.includes('login.live.com/ppsecure/post.srf') &&
                  (url.includes('account.live.com') || 
                   url.includes('Consent') || 
                   url.includes('appConsent') ||
                   url.includes('login.live.com') ||
                   url.includes('kie.ai') ||
                   url.includes('login.microsoftonline.com') ||
                   title.includes('app access') ||
                   title.includes('Let this app') ||
                   title.includes('needs your permission') ||
                   title.includes('Kie.ai') ||
                   title.includes('One API for All'))) {
                newTargetPage = page;
                addDebugStep('Stay Signed In', 'success', `Found new page: ${url} - ${title}`);
                break;
              }
            } catch (pageError) {
              addDebugStep('Stay Signed In', 'info', `Page ${i} not accessible: ${pageError.message}`);
            }
          }
          
          if (newTargetPage) {
            targetPage = newTargetPage;
            addDebugStep('Stay Signed In', 'success', 'Page context recovered successfully');
            await takeScreenshot('After-Yes-Navigation-Recovered', targetPage);
            
            // Check if we're on the Kie.ai main page - this might mean authentication is complete
            const currentUrl = await targetPage.url();
            const currentTitle = await targetPage.title();
            
            if (currentUrl.includes('kie.ai') && !currentUrl.includes('dashboard')) {
              addDebugStep('Stay Signed In', 'info', 'Recovered to Kie.ai main page - waiting for page to load fully');
              
              // Wait for page to load completely
              await randomHumanDelay(targetPage, 3000, 5000);
              addDebugStep('Stay Signed In', 'info', 'Page loaded, checking for login popup...');
              
              // Check for "Sign in with Microsoft" popup (sometimes appears at bottom of page)
              addDebugStep('Stay Signed In', 'info', 'Looking for Sign in with Microsoft popup...');
              
            // First check if popup is visible without scrolling
            let microsoftPopupFound = false;
            try {
              // Use proper XPath selectors for Microsoft popup detection
              await targetPage.waitForXPath('//button[contains(text(), "Sign in with Microsoft")] | //button[contains(text(), "Inloggen met Microsoft")] | //*[contains(@data-testid, "microsoft")] | //*[contains(@class, "microsoft")]', { timeout: 3000 });
              addDebugStep('Stay Signed In', 'success', 'Sign in with Microsoft popup detected at top');
              await takeScreenshot('Microsoft-Popup-Top', targetPage);
              microsoftPopupFound = true;
            } catch (topError) {
              addDebugStep('Stay Signed In', 'info', 'No Microsoft popup found at top - scrolling down to check bottom of page');
              
              // Scroll down to look for popup at bottom of page
              await targetPage.evaluate(() => {
                window.scrollTo(0, document.body.scrollHeight);
              });
              await randomHumanDelay(targetPage, 2000, 3000);
              await takeScreenshot('Scrolled-Down-Looking-For-Popup', targetPage);
              
              // Check again after scrolling with multiple methods
              try {
                // Try XPath first
                await targetPage.waitForXPath('//button[contains(text(), "Sign in with Microsoft")] | //button[contains(text(), "Inloggen met Microsoft")] | //*[contains(@data-testid, "microsoft")] | //*[contains(@class, "microsoft")]', { timeout: 3000 });
                addDebugStep('Stay Signed In', 'success', 'Sign in with Microsoft popup detected at bottom after scrolling');
                await takeScreenshot('Microsoft-Popup-Bottom', targetPage);
                microsoftPopupFound = true;
              } catch (bottomError) {
                // Try alternative detection methods
                addDebugStep('Stay Signed In', 'info', 'XPath detection failed, trying alternative methods...');
                
                // Check for any popup or modal elements
                const popupDetected = await targetPage.evaluate(() => {
                  // Look for common popup indicators
                  const popups = document.querySelectorAll('[role="dialog"], [class*="popup"], [class*="modal"], [class*="overlay"], [class*="popup"], [class*="dialog"]');
                  if (popups.length > 0) {
                    return {
                      found: true,
                      count: popups.length,
                      elements: Array.from(popups).map(el => ({
                        tagName: el.tagName,
                        className: el.className,
                        textContent: el.textContent?.substring(0, 100)
                      }))
                    };
                  }
                  
                  // Look for Microsoft-related text anywhere on page
                  const microsoftElements = document.querySelectorAll('*');
                  for (const el of microsoftElements) {
                    const text = el.textContent?.toLowerCase() || '';
                    if (text.includes('sign in with microsoft') || text.includes('inloggen met microsoft') || text.includes('microsoft')) {
                      return {
                        found: true,
                        element: {
                          tagName: el.tagName,
                          className: el.className,
                          textContent: el.textContent?.substring(0, 100)
                        }
                      };
                    }
                  }
                  
                  return { found: false };
                });
                
                if (popupDetected.found) {
                  addDebugStep('Stay Signed In', 'success', `Microsoft popup detected using alternative method: ${JSON.stringify(popupDetected)}`);
                  await takeScreenshot('Microsoft-Popup-Alternative', targetPage);
                  microsoftPopupFound = true;
                } else {
                  addDebugStep('Stay Signed In', 'info', 'No Microsoft popup found at bottom either');
                }
              }
            }
              
              if (microsoftPopupFound) {
                // Click "Sign in with Microsoft" button using proper selectors
                addDebugStep('Stay Signed In', 'info', 'Clicking Sign in with Microsoft button...');
                
                try {
                  // Try XPath first
                  await targetPage.waitForXPath('//button[contains(text(), "Sign in with Microsoft")] | //button[contains(text(), "Inloggen met Microsoft")] | //*[contains(@data-testid, "microsoft")] | //*[contains(@class, "microsoft")]', { timeout: 5000 });
                  await targetPage.click('//button[contains(text(), "Sign in with Microsoft")] | //button[contains(text(), "Inloggen met Microsoft")] | //*[contains(@data-testid, "microsoft")] | //*[contains(@class, "microsoft")]');
                  addDebugStep('Stay Signed In', 'success', 'Clicked Sign in with Microsoft button using XPath');
                } catch (xpathError) {
                  // Fallback to evaluate method
                  addDebugStep('Stay Signed In', 'info', 'XPath click failed, trying evaluate method...');
                  
                  const clicked = await targetPage.evaluate(() => {
                    // Look for Microsoft button by text content
                    const buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
                    for (const button of buttons) {
                      const text = button.textContent?.toLowerCase() || '';
                      if (text.includes('sign in with microsoft') || text.includes('inloggen met microsoft') || text.includes('microsoft')) {
                        button.click();
                        return true;
                      }
                    }
                    return false;
                  });
                  
                  if (clicked) {
                    addDebugStep('Stay Signed In', 'success', 'Clicked Sign in with Microsoft button using evaluate method');
                  } else {
                    addDebugStep('Stay Signed In', 'warning', 'Could not click Microsoft button with any method');
                  }
                }
                
                await takeScreenshot('Microsoft-Login-Clicked', targetPage);
                
                // Wait for popup to appear and analyze what opens
                addDebugStep('Microsoft Login Popup', 'info', 'Waiting for Microsoft login popup to appear...');
                await randomHumanDelay(targetPage, 3000, 5000);
                
                // Check what pages/tabs are now open
                addDebugStep('Microsoft Login Popup', 'info', 'Analyzing all open pages after Microsoft login click...');
                
                try {
                  const allPages = await Promise.race([
                    targetPage.browser().pages(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Browser pages timeout')), 5000))
                  ]);
                  addDebugStep('Microsoft Login Popup', 'info', `Total pages open: ${allPages.length}`);
                  
                  for (let i = 0; i < allPages.length; i++) {
                    const page = allPages[i];
                    try {
                      const pageInfo = await Promise.race([
                        page.evaluate(() => {
                          return {
                            url: window.location.href,
                            title: document.title,
                            domain: window.location.hostname,
                            pathname: window.location.pathname,
                            hasEmailInput: document.querySelectorAll('input[name="loginfmt"], input[id="i0116"], input[type="email"]').length > 0,
                            hasPasswordInput: document.querySelectorAll('input[name="passwd"], input[type="password"]').length > 0,
                            buttonCount: document.querySelectorAll('button, a, [role="button"]').length,
                            inputCount: document.querySelectorAll('input, textarea, select').length,
                            visibleText: document.body.textContent?.substring(0, 200) || '',
                            isMicrosoftLogin: window.location.hostname.includes('login.live.com') || 
                                           window.location.hostname.includes('microsoft.com') ||
                                           document.body.textContent.toLowerCase().includes('microsoft') ||
                                           document.querySelectorAll('input[name="loginfmt"]').length > 0
                          };
                        }),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Page analysis timeout')), 3000))
                      ]);
                      
                      addDebugStep('Microsoft Login Popup', 'info', `Page ${i + 1}:`);
                      addDebugStep('Microsoft Login Popup', 'info', `  - URL: ${pageInfo.url}`);
                      addDebugStep('Microsoft Login Popup', 'info', `  - Title: ${pageInfo.title}`);
                      addDebugStep('Microsoft Login Popup', 'info', `  - Domain: ${pageInfo.domain}`);
                      addDebugStep('Microsoft Login Popup', 'info', `  - Buttons: ${pageInfo.buttonCount}, Inputs: ${pageInfo.inputCount}`);
                      addDebugStep('Microsoft Login Popup', 'info', `  - Email Input: ${pageInfo.hasEmailInput}, Password Input: ${pageInfo.hasPasswordInput}`);
                      addDebugStep('Microsoft Login Popup', 'info', `  - Is Microsoft Login: ${pageInfo.isMicrosoftLogin}`);
                      addDebugStep('Microsoft Login Popup', 'info', `  - Text: "${pageInfo.visibleText}"`);
                      
                      // If this is a Microsoft login page, switch to it
                      if (pageInfo.isMicrosoftLogin && page !== targetPage) {
                        addDebugStep('Microsoft Login Popup', 'success', `Found Microsoft login page, switching to it...`);
                        targetPage = page;
                        await takeScreenshot('Microsoft-Login-Page-Detected', targetPage);
                        break;
                      }
                    } catch (pageError) {
                      addDebugStep('Microsoft Login Popup', 'warning', `Could not analyze page ${i + 1}: ${pageError.message}`);
                    }
                  }
                } catch (browserError) {
                  addDebugStep('Microsoft Login Popup', 'warning', `Could not get browser pages: ${browserError.message}`);
                }
                
                // If no Microsoft login page was found, wait a bit more and try again
                if (!targetPage || targetPage.url().includes('kie.ai')) {
                  addDebugStep('Microsoft Login Popup', 'info', 'No Microsoft login page found, waiting for popup to appear...');
                  await randomHumanDelay(targetPage, 2000, 3000);
                  
                  // Try to detect new popup using the existing popup detection logic
                  try {
                    const allPages = await targetPage.browser().pages();
                    addDebugStep('Microsoft Login Popup', 'info', `Re-checking pages after delay: ${allPages.length} pages open`);
                    
                    for (const page of allPages) {
                      try {
                        const url = page.url();
                        const title = await page.title();
                        
                        if (url.includes('login.live.com') || url.includes('microsoft.com') || 
                            title.toLowerCase().includes('sign in') || title.toLowerCase().includes('microsoft')) {
                          addDebugStep('Microsoft Login Popup', 'success', `Found Microsoft login page on second check: ${url}`);
                          targetPage = page;
                          await takeScreenshot('Microsoft-Login-Page-Second-Check', targetPage);
                          break;
                        }
                      } catch (pageError) {
                        // Continue to next page
                      }
                    }
                  } catch (secondCheckError) {
                    addDebugStep('Microsoft Login Popup', 'warning', `Second check failed: ${secondCheckError.message}`);
                  }
                }
              } else {
                // No Microsoft popup found, look for Get Started button
                addDebugStep('Stay Signed In', 'info', 'No Microsoft popup found - looking for Get Started button');
                
                // Scroll back to top to look for Get Started button
                await targetPage.evaluate(() => {
                  window.scrollTo(0, 0);
                });
                await randomHumanDelay(targetPage, 1000, 2000);
                
                // Look for Get Started button in top right corner
                addDebugStep('Stay Signed In', 'info', 'Looking for Get Started button in top right corner...');
                
                // Try to find Get Started button
                const getStartedFound = await targetPage.evaluate(() => {
                  const buttons = Array.from(document.querySelectorAll('button, a'));
                  for (const button of buttons) {
                    const text = button.textContent?.toLowerCase() || '';
                    if (text.includes('get started') || text.includes('getstarted')) {
                      return {
                        found: true,
                        text: button.textContent,
                        tagName: button.tagName,
                        className: button.className
                      };
                    }
                  }
                  return { found: false };
                });
                
                if (getStartedFound.found) {
                  addDebugStep('Stay Signed In', 'success', `Found Get Started button: ${getStartedFound.text}`);
                  
                  // Click Get Started button using proper selectors
                  try {
                    // Try multiple selectors for Get Started button
                    const getStartedSelectors = [
                      'button:contains("Get Started")',
                      'a:contains("Get Started")',
                      'button[class*="Get Started"]',
                      'a[class*="Get Started"]',
                      '[data-testid*="get-started"]',
                      '[data-testid*="getStarted"]'
                    ];
                    
                    let getStartedButton = null;
                    let usedSelector = '';
                    
                    for (const selector of getStartedSelectors) {
                      try {
                        if (selector.includes(':contains')) {
                          // Use XPath for text-based selectors
                          const xpathSelector = selector.includes('button') ? 
                            '//button[contains(text(), "Get Started")]' : 
                            '//a[contains(text(), "Get Started")]';
                          getStartedButton = await targetPage.waitForXPath(xpathSelector, { timeout: 3000 });
                        } else {
                          getStartedButton = await targetPage.waitForSelector(selector, { timeout: 3000 });
                        }
                        
                        if (getStartedButton) {
                          usedSelector = selector;
                          addDebugStep('Stay Signed In', 'info', `Found Get Started button with selector: ${selector}`);
                          break;
                        }
                      } catch (e) {
                        // Continue to next selector
                        addDebugStep('Stay Signed In', 'info', `Selector ${selector} failed: ${e.message}`);
                      }
                    }
                    
                    if (getStartedButton) {
                      // Click the found button
                      if (usedSelector.includes(':contains') || usedSelector.includes('//')) {
                        await getStartedButton.click();
                      } else {
                        await targetPage.click(usedSelector);
                      }
                      addDebugStep('Stay Signed In', 'success', `Clicked Get Started button using selector: ${usedSelector}`);
                      await takeScreenshot('Get-Started-After-Recovery', targetPage);
                    } else {
                      // Fallback: try to find by text content using evaluate
                      addDebugStep('Stay Signed In', 'info', 'Trying fallback method to find Get Started button...');
                      
                      const buttonFound = await targetPage.evaluate(() => {
                        const buttons = Array.from(document.querySelectorAll('button, a'));
                        const getStartedBtn = buttons.find(btn => 
                          btn.textContent && btn.textContent.trim().toLowerCase().includes('get started')
                        );
                        if (getStartedBtn) {
                          getStartedBtn.click();
                          return true;
                        }
                        return false;
                      });
                      
                      if (buttonFound) {
                        addDebugStep('Stay Signed In', 'success', 'Clicked Get Started button using fallback method');
                        await takeScreenshot('Get-Started-After-Recovery', targetPage);
                      } else {
                        addDebugStep('Stay Signed In', 'warning', 'Could not find Get Started button with any method');
                      }
                    }
                  } catch (clickError) {
                    addDebugStep('Stay Signed In', 'warning', `Failed to click Get Started button: ${clickError.message}`);
                  }
                  
                } else {
                  addDebugStep('Stay Signed In', 'warning', 'Get Started button not found on Kie.ai page');
                }
              }
              
              // Try to navigate to dashboard to see if we're logged in
              try {
                await targetPage.goto('https://kie.ai/dashboard', { waitUntil: 'networkidle2', timeout: 60000 });
                await takeScreenshot('Dashboard-After-Recovery', targetPage);
                addDebugStep('Stay Signed In', 'success', 'Successfully navigated to dashboard - authentication complete');
                return { success: true, message: 'Account created successfully' };
              } catch (dashboardError) {
                addDebugStep('Stay Signed In', 'warning', `Dashboard navigation failed: ${dashboardError.message}`);
                // Try alternative navigation methods
                try {
                  addDebugStep('Stay Signed In', 'info', 'Trying alternative dashboard navigation...');
                  await targetPage.goto('https://kie.ai/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
                  await takeScreenshot('Dashboard-Alternative', targetPage);
                  addDebugStep('Stay Signed In', 'success', 'Successfully navigated to dashboard with alternative method');
                  return { success: true, message: 'Account created successfully' };
                } catch (altError) {
                  addDebugStep('Stay Signed In', 'warning', `Alternative dashboard navigation also failed: ${altError.message}`);
                  // Continue with normal flow
                }
              }
            }
          } else {
            addDebugStep('Stay Signed In', 'warning', 'Could not recover page context, trying to navigate to dashboard...');
            // Try to navigate to dashboard as fallback
            try {
              await targetPage.goto('https://kie.ai/dashboard', { waitUntil: 'networkidle2' });
              addDebugStep('Stay Signed In', 'success', 'Successfully navigated to dashboard as fallback');
              await takeScreenshot('Dashboard-Fallback', targetPage);
            } catch (dashboardError) {
              addDebugStep('Stay Signed In', 'error', `Dashboard fallback failed: ${dashboardError.message}`);
            }
          }
        } catch (recoveryError) {
          addDebugStep('Stay Signed In', 'warning', `Page recovery failed: ${recoveryError.message}`);
        }
      }
    }
  } catch (e) {
    addDebugStep('Stay Signed In', 'info', `JavaScript click failed: ${e.message}`);
  }
  
  // If JavaScript approach failed, try selectors
  if (!yesButtonClicked) {
    for (const selector of yesSelectors) {
      try {
        addDebugStep('Stay Signed In', 'info', `Trying Yes selector: ${selector}`);
        await targetPage.waitForSelector(selector, { timeout: 2000 });
        await targetPage.click(selector);
        addDebugStep('Stay Signed In', 'success', `Clicked Yes button using selector: ${selector}`);
        await takeScreenshot('Stay-Signed-In-Yes', targetPage);
        yesButtonClicked = true;
        
        // Wait for page navigation after clicking Yes
        addDebugStep('Stay Signed In', 'info', 'Waiting for page navigation after Yes click...');
        try {
          await targetPage.waitForNavigation({ timeout: 10000 });
          addDebugStep('Stay Signed In', 'success', 'Page navigation completed');
          
          // Take screenshot of the new page
          await takeScreenshot('After-Yes-Navigation', targetPage);
          
          // Update targetPage to the current page after navigation
          targetPage = targetPage;
          addDebugStep('Stay Signed In', 'info', `New page URL: ${await targetPage.evaluate(() => window.location.href)}`);
        } catch (navError) {
          addDebugStep('Stay Signed In', 'warning', `Navigation timeout: ${navError.message}`);
          
          // Try to recover page context by finding the new page
          addDebugStep('Stay Signed In', 'info', 'Attempting to recover page context...');
          try {
            const allPages = await targetPage.browser().pages();
            let newTargetPage = null;
            
            for (let i = 0; i < allPages.length; i++) {
              const page = allPages[i];
              try {
                const url = await page.url();
                const title = await page.title();
                addDebugStep('Stay Signed In', 'info', `Checking page ${i}: ${url} - ${title}`);
                
                // Look for any page that's not blank and not the old login page
                if (url !== 'about:blank' && 
                    !url.includes('login.live.com/ppsecure/post.srf') &&
                    (url.includes('account.live.com') || 
                     url.includes('Consent') || 
                     url.includes('appConsent') ||
                     url.includes('login.live.com') ||
                     url.includes('kie.ai') ||
                     url.includes('login.microsoftonline.com') ||
                     title.includes('app access') ||
                     title.includes('Let this app') ||
                     title.includes('needs your permission') ||
                     title.includes('Kie.ai') ||
                     title.includes('One API for All'))) {
                  newTargetPage = page;
                  addDebugStep('Stay Signed In', 'success', `Found new page: ${url} - ${title}`);
                  break;
                }
              } catch (pageError) {
                addDebugStep('Stay Signed In', 'info', `Page ${i} not accessible: ${pageError.message}`);
              }
            }
            
            if (newTargetPage) {
              targetPage = newTargetPage;
              addDebugStep('Stay Signed In', 'success', 'Page context recovered successfully');
              await takeScreenshot('After-Yes-Navigation-Recovered', targetPage);
              
              // Check if we're on the Kie.ai main page - this might mean authentication is complete
              const currentUrl = await targetPage.url();
              const currentTitle = await targetPage.title();
              
              if (currentUrl.includes('kie.ai') && !currentUrl.includes('dashboard')) {
                addDebugStep('Stay Signed In', 'info', 'Recovered to Kie.ai main page - checking for human verification popup');
                
                // Check for human verification popup first
                try {
                  const humanVerification = await targetPage.evaluate(() => {
                    const popup = document.querySelector('[class*="popup"], [class*="modal"], [class*="verification"]');
                    const humanCheckbox = document.querySelector('input[type="checkbox"][id*="human"], input[type="checkbox"][class*="human"], input[type="checkbox"][name*="human"]');
                    const hcaptcha = document.querySelector('[class*="hcaptcha"], [id*="hcaptcha"]');
                    const humanText = document.body.textContent.includes('human') || document.body.textContent.includes('Human');
                    const verificationText = document.body.textContent.includes('verification') || document.body.textContent.includes('Please complete');
                    
                    return {
                      popupExists: !!popup,
                      humanCheckbox: !!humanCheckbox,
                      hcaptcha: !!hcaptcha,
                      humanText: humanText,
                      verificationText: verificationText,
                      allCheckboxes: Array.from(document.querySelectorAll('input[type="checkbox"]')).map(cb => ({
                        id: cb.id,
                        name: cb.name,
                        className: cb.className,
                        checked: cb.checked,
                        visible: cb.offsetParent !== null
                      }))
                    };
                  });
                  
                  addDebugStep('Stay Signed In', 'info', `Human verification check: ${JSON.stringify(humanVerification)}`);
                  
                  if (humanVerification.humanCheckbox || humanVerification.hcaptcha || humanVerification.verificationText) {
                    addDebugStep('Stay Signed In', 'success', 'Human verification popup detected on main page');
                    await takeScreenshot('Human-Verification-Popup-Main', targetPage);
                    
                    // Try to find and click the human checkbox
                    const checkboxClicked = await targetPage.evaluate(() => {
                      const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
                      for (const checkbox of checkboxes) {
                        if (checkbox.id.includes('human') || 
                            checkbox.name.includes('human') || 
                            checkbox.className.includes('human') ||
                            checkbox.closest('label')?.textContent?.toLowerCase().includes('human')) {
                          checkbox.click();
                          return true;
                        }
                      }
                      return false;
                    });
                    
                    if (checkboxClicked) {
                      addDebugStep('Stay Signed In', 'success', 'Clicked human verification checkbox on main page');
                      await takeScreenshot('Human-Verification-Checked-Main', targetPage);
                      
                      // Wait for automatic redirect
                      addDebugStep('Stay Signed In', 'info', 'Waiting for automatic redirect after verification...');
                      try {
                        await targetPage.waitForNavigation({ timeout: 15000 });
                        addDebugStep('Stay Signed In', 'success', 'Redirected after human verification');
                        await takeScreenshot('After-Human-Verification-Main', targetPage);
                      } catch (navError) {
                        addDebugStep('Stay Signed In', 'warning', `Navigation timeout after verification: ${navError.message}`);
                      }
                    } else {
                      addDebugStep('Stay Signed In', 'warning', 'Human verification checkbox not found on main page');
                    }
                  } else {
                    addDebugStep('Stay Signed In', 'info', 'No human verification popup detected on main page');
                  }
                } catch (verificationError) {
                  addDebugStep('Stay Signed In', 'warning', `Human verification check failed: ${verificationError.message}`);
                }
                
                // Try to navigate to dashboard to see if we're logged in
                try {
                  await targetPage.goto('https://kie.ai/dashboard', { waitUntil: 'networkidle2' });
                  await takeScreenshot('Dashboard-After-Recovery', targetPage);
                  addDebugStep('Stay Signed In', 'success', 'Successfully navigated to dashboard - authentication complete');
                  return { success: true, message: 'Account created successfully' };
                } catch (dashboardError) {
                  addDebugStep('Stay Signed In', 'warning', `Dashboard navigation failed: ${dashboardError.message}`);
                  // Continue with normal flow
                }
              }
            } else {
              addDebugStep('Stay Signed In', 'warning', 'Could not recover page context, trying to navigate to dashboard...');
              // Try to navigate to dashboard as fallback
              try {
                await targetPage.goto('https://kie.ai/dashboard', { waitUntil: 'networkidle2' });
                addDebugStep('Stay Signed In', 'success', 'Successfully navigated to dashboard as fallback');
                await takeScreenshot('Dashboard-Fallback', targetPage);
              } catch (dashboardError) {
                addDebugStep('Stay Signed In', 'error', `Dashboard fallback failed: ${dashboardError.message}`);
              }
            }
          } catch (recoveryError) {
            addDebugStep('Stay Signed In', 'warning', `Page recovery failed: ${recoveryError.message}`);
          }
        }
        
        break;
      } catch (e) {
        addDebugStep('Stay Signed In', 'info', `Yes selector ${selector} failed: ${e.message}`);
      }
    }
  }
  
  if (!yesButtonClicked) {
    addDebugStep('Stay Signed In', 'warning', 'No Yes button found - continuing without clicking');
    await takeScreenshot('No-Yes-Button-Found', targetPage);
  }
  
  // Continue to App Access step
  await handleAppAccessStep(targetPage);
}

// Helper function to handle App Access step
async function handleAppAccessStep(targetPage) {
  addDebugStep('App Access', 'info', 'Handling App Access step...');
  
  // Check if the page is still accessible
  try {
    await targetPage.evaluate(() => document.title);
    addDebugStep('App Access', 'info', 'Page is accessible, proceeding...');
  } catch (pageError) {
    addDebugStep('App Access', 'warning', `Page not accessible: ${pageError.message}`);
    
    // Try to find a valid page
    try {
      const allPages = await targetPage.browser().pages();
      let validPage = null;
      
      for (let i = 0; i < allPages.length; i++) {
        const page = allPages[i];
        try {
          const url = await page.url();
          const title = await page.title();
          if (url !== 'about:blank' && !url.includes('kie.ai')) {
            validPage = page;
            addDebugStep('App Access', 'info', `Found valid page: ${url} - ${title}`);
            break;
          }
        } catch (e) {
          // Skip inaccessible pages
        }
      }
      
      if (validPage) {
        targetPage = validPage;
        addDebugStep('App Access', 'success', 'Switched to valid page context');
      } else {
        addDebugStep('App Access', 'error', 'No valid page found, cannot continue');
        return;
      }
    } catch (recoveryError) {
      addDebugStep('App Access', 'error', `Page recovery failed: ${recoveryError.message}`);
      return;
    }
  }
  
  // First, scroll down to make sure the Accept button is visible
  addDebugStep('App Access', 'info', 'Scrolling down to find Accept button...');
  await targetPage.evaluate(() => {
    // Try to scroll the specific scrollable container first
    const scrollableContainer = document.querySelector('[data-scrollable="true"]');
    if (scrollableContainer) {
      scrollableContainer.scrollTop = scrollableContainer.scrollHeight;
    } else {
      // Fallback to window scroll
      window.scrollTo(0, document.body.scrollHeight);
    }
  });
  
  // Wait a moment for the scroll to complete
  await randomHumanDelay(targetPage, 1000, 2000);
  
  // Take a screenshot to see the current state after scrolling
  await takeScreenshot('App-Access-After-Scroll', targetPage);
  
  // Check if Accept button is visible after scrolling
  const buttonVisibility = await targetPage.evaluate(() => {
    const acceptButton = document.querySelector('button[data-testid="appConsentPrimaryButton"]');
    return {
      exists: !!acceptButton,
      visible: acceptButton ? acceptButton.offsetParent !== null : false,
      inViewport: acceptButton ? acceptButton.getBoundingClientRect().top >= 0 && acceptButton.getBoundingClientRect().bottom <= window.innerHeight : false
    };
  });
  
  addDebugStep('App Access', 'info', `Accept button visibility after scroll: ${JSON.stringify(buttonVisibility)}`);
  
  // Try multiple selectors for Accept button, including the specific data-testid
  const acceptSelectors = [
    '//button[@data-testid="appConsentPrimaryButton"]',  // Specific selector from user
    '//button[contains(text(), "Accept")]',
    '//button[contains(text(), "Allow")]',
    '//button[contains(text(), "Continue")]',
    '//button[@data-testid="primaryButton"]',
    '//button[@type="submit"]',
    '//button[contains(@class, "primary")]'
  ];
  
  let acceptButtonClicked = false;
  
  // First try direct JavaScript approach for Accept button
  try {
    addDebugStep('App Access', 'info', 'Trying direct JavaScript click on Accept button...');
    
    // First scroll the button into view
    await targetPage.evaluate(() => {
      const acceptButton = document.querySelector('button[data-testid="appConsentPrimaryButton"]');
      if (acceptButton) {
        acceptButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    
    // Wait for scroll to complete
    await randomHumanDelay(targetPage, 1000, 1500);
    
    // Now try to click the button
    const clicked = await targetPage.evaluate(() => {
      // Try the specific data-testid first
      const acceptButton = document.querySelector('button[data-testid="appConsentPrimaryButton"]');
      if (acceptButton && acceptButton.offsetParent !== null) {
        acceptButton.click();
        return true;
      }
      
      // Fallback: look for any button with "Accept" text
      const acceptButtons = Array.from(document.querySelectorAll('button'));
      const acceptBtn = acceptButtons.find(b => b.textContent?.trim() === 'Accept' && b.offsetParent !== null);
      if (acceptBtn) {
        acceptBtn.click();
        return true;
      }
      
      return false;
    });
    
    if (clicked) {
      addDebugStep('App Access', 'success', 'Clicked Accept button using JavaScript');
      await takeScreenshot('App-Access-Accepted', targetPage);
      acceptButtonClicked = true;
    }
  } catch (e) {
    addDebugStep('App Access', 'info', `JavaScript click failed: ${e.message}`);
  }
  
  // If JavaScript approach failed, try selectors
  if (!acceptButtonClicked) {
    for (const selector of acceptSelectors) {
      try {
        addDebugStep('App Access', 'info', `Trying Accept selector: ${selector}`);
        await targetPage.waitForSelector(selector, { timeout: 3000 });
        await targetPage.click(selector);
        addDebugStep('App Access', 'success', `Clicked Accept button using selector: ${selector}`);
        await takeScreenshot('App-Access-Accepted', targetPage);
        acceptButtonClicked = true;
        break;
      } catch (e) {
        addDebugStep('App Access', 'info', `Accept selector ${selector} failed: ${e.message}`);
      }
    }
  }
  
  if (!acceptButtonClicked) {
    addDebugStep('App Access', 'warning', 'No Accept button found - continuing without clicking');
    await takeScreenshot('No-Accept-Button-Found', targetPage);
  }
  
  // Wait for navigation after Accept button click
  addDebugStep('Navigation', 'info', 'Waiting for navigation after Accept button click...');
  try {
    await targetPage.waitForNavigation({ timeout: 10000 });
    addDebugStep('Navigation', 'success', 'Navigation completed after Accept click');
    await takeScreenshot('After-Accept-Navigation', targetPage);
  } catch (navError) {
    addDebugStep('Navigation', 'warning', `Navigation timeout after Accept: ${navError.message}`);
    // Continue anyway, the page might have already navigated
  }
  
  // After Accept click, the permission page closes and we need to go back to the original Kie.ai page
  addDebugStep('App Access', 'info', 'Permission page closed - returning to original Kie.ai page...');
  
  // Try to find the original Kie.ai page among all open pages
  let originalKiePage = null;
  try {
    const allPages = await targetPage.browser().pages();
    addDebugStep('App Access', 'info', `Found ${allPages.length} open pages, looking for original Kie.ai page...`);
    
    for (const page of allPages) {
      try {
        const url = await page.url();
        const title = await page.title();
        addDebugStep('App Access', 'info', `Checking page: ${url} - ${title}`);
        
        // Look for the original Kie.ai main page
        if (url.includes('kie.ai') && !url.includes('dashboard') && !url.includes('login')) {
          originalKiePage = page;
          addDebugStep('App Access', 'success', `Found original Kie.ai page: ${url}`);
          break;
        }
      } catch (pageError) {
        addDebugStep('App Access', 'warning', `Could not check page: ${pageError.message}`);
      }
    }
    
    if (originalKiePage) {
      // Switch to the original Kie.ai page
      targetPage = originalKiePage;
      addDebugStep('App Access', 'success', 'Switched to original Kie.ai page');
      await takeScreenshot('Original-Kie-Page-After-Accept', targetPage);
    } else {
      addDebugStep('App Access', 'warning', 'Original Kie.ai page not found, trying to navigate to Kie.ai...');
      // If we can't find the original page, try to navigate to Kie.ai
      try {
        await targetPage.goto('https://kie.ai', { waitUntil: 'networkidle2' });
        addDebugStep('App Access', 'success', 'Navigated to Kie.ai main page');
        await takeScreenshot('Kie-Main-Page-After-Accept', targetPage);
      } catch (navError) {
        addDebugStep('App Access', 'error', `Failed to navigate to Kie.ai: ${navError.message}`);
      }
    }
  } catch (browserError) {
    addDebugStep('App Access', 'error', `Failed to find original page: ${browserError.message}`);
  }
  
  // Human verification step removed as requested
  addDebugStep('Human Verification', 'info', 'Human verification step skipped - proceeding to dashboard');
  
  // Final step - navigate to Kie.ai dashboard
  addDebugStep('Dashboard', 'info', 'Navigating to Kie.ai dashboard...');
  try {
    await targetPage.goto('https://kie.ai/dashboard', { waitUntil: 'networkidle2', timeout: 60000 });
    await takeScreenshot('Dashboard-Reached', targetPage);
    addDebugStep('Dashboard', 'success', 'Successfully reached Kie.ai dashboard');
  } catch (dashboardError) {
    addDebugStep('Dashboard', 'warning', `Dashboard navigation failed: ${dashboardError.message}`);
    // Try alternative navigation methods
    try {
      addDebugStep('Dashboard', 'info', 'Trying alternative dashboard navigation...');
      await targetPage.goto('https://kie.ai/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await takeScreenshot('Dashboard-Alternative', targetPage);
      addDebugStep('Dashboard', 'success', 'Successfully reached Kie.ai dashboard with alternative method');
    } catch (altError) {
      addDebugStep('Dashboard', 'error', `Alternative dashboard navigation also failed: ${altError.message}`);
      // Try to take screenshot of current page to see what happened
      await takeScreenshot('Dashboard-Error', targetPage);
      throw new Error(`Dashboard navigation failed: ${dashboardError.message}`);
    }
  }
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
    const filename = `kie-account-${timestamp}-${name}.png`;
    const screenshotPath = path.join(__dirname, 'screenshots', filename);
    
    // Ensure screenshots directory exists
    const screenshotsDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    
    await page.screenshot({ path: screenshotPath, fullPage: true });
    
    // Verify screenshot was actually saved
    if (fs.existsSync(screenshotPath)) {
      const stats = fs.statSync(screenshotPath);
      addDebugStep('Screenshot', 'info', `Screenshot saved: ${filename} (${stats.size} bytes)`, filename);
    } else {
      addDebugStep('Screenshot', 'error', `Screenshot file not found after saving: ${filename}`);
    }
    
    return filename;
  } catch (error) {
    addDebugStep('Screenshot', 'error', `Failed to take screenshot: ${error.message}`);
    return null;
  }
}

// Human-like mouse movement and behavior functions
async function humanLikeMouseMove(page, fromX, fromY, toX, toY) {
  const steps = Math.floor(Math.random() * 10) + 5; // 5-15 steps
  const stepDelay = Math.random() * 50 + 20; // 20-70ms between steps
  
  for (let i = 0; i <= steps; i++) {
    const progress = i / steps;
    // Add some randomness to the path
    const randomOffsetX = (Math.random() - 0.5) * 20;
    const randomOffsetY = (Math.random() - 0.5) * 20;
    
    const currentX = fromX + (toX - fromX) * progress + randomOffsetX;
    const currentY = fromY + (toY - fromY) * progress + randomOffsetY;
    
    await page.mouse.move(currentX, currentY);
    await page.waitForTimeout(stepDelay);
  }
}

async function humanLikeClick(page, x, y, element = null) {
  // Move mouse to element first if provided
  if (element) {
    const box = await element.boundingBox();
    if (box) {
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;
      await humanLikeMouseMove(page, 0, 0, centerX, centerY);
      await page.waitForTimeout(Math.random() * 200 + 100); // 100-300ms pause
    }
  } else if (x && y) {
    await humanLikeMouseMove(page, 0, 0, x, y);
    await page.waitForTimeout(Math.random() * 200 + 100);
  }
  
  // Click with slight delay
  await page.mouse.click(x || 0, y || 0, { 
    delay: Math.random() * 50 + 50 // 50-100ms delay
  });
}

async function humanLikeType(page, selector, text, options = {}) {
  const element = await page.$(selector);
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  
  // Focus the element
  await element.focus();
  await page.waitForTimeout(Math.random() * 100 + 50);
  
  // Clear existing text
  await element.click({ clickCount: 3 }); // Select all
  await page.waitForTimeout(Math.random() * 50 + 25);
  
  // Type character by character with human-like delays
  for (let i = 0; i < text.length; i++) {
    await element.type(text[i], { 
      delay: Math.random() * 100 + 50 // 50-150ms per character
    });
    
    // Occasional longer pauses (like human thinking)
    if (Math.random() < 0.1) {
      await page.waitForTimeout(Math.random() * 500 + 200);
    }
  }
  
  // Trigger events to simulate real typing
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el) {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));
    }
  }, selector);
}

async function humanLikeScroll(page, direction = 'down', distance = 300) {
  const scrollSteps = Math.floor(Math.random() * 5) + 3; // 3-8 steps
  const stepDistance = distance / scrollSteps;
  const stepDelay = Math.random() * 100 + 50; // 50-150ms between steps
  
  for (let i = 0; i < scrollSteps; i++) {
    await page.mouse.wheel({ 
      deltaY: direction === 'down' ? stepDistance : -stepDistance 
    });
    await page.waitForTimeout(stepDelay);
  }
}

async function randomHumanDelay(page, min = 500, max = 2000) {
  if (!page) {
    console.warn('No page instance available for randomHumanDelay. Skipping human-like delay.');
    return;
  }
  const delay = Math.random() * (max - min) + min;
  await page.waitForTimeout(delay);
}

// Sleep function for delays
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// AI-powered decision making using GPT Vision
async function getAIDecision(page, context, step, email = '', password = '') {
  try {
    addDebugStep('AI Decision', 'info', `Getting AI decision for: ${context}`);
    
    // Take screenshot
    const screenshot = await page.screenshot({ fullPage: true });
    const base64 = screenshot.toString('base64');
    
    // Get page content for additional context
    const pageInfo = await page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        bodyText: document.body.textContent.substring(0, 1000),
        allButtons: Array.from(document.querySelectorAll('button, a, input[type="submit"]')).map(b => ({
          text: b.textContent?.trim() || b.value || '',
          tagName: b.tagName,
          classes: b.className,
          id: b.id
        })).filter(b => b.text.length > 0)
      };
    });
    
    // Call OpenAI API
    const { default: fetch } = await import('node-fetch');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an AI assistant helping with web scraping for Kie.ai account creation. 

SCENARIO: We are creating a Kie.ai account by following these EXACT steps:
1. Go to https://kie.ai/ (DONE)
2. Look for and click the "Get Started" button (usually in top-right corner or main hero section)
3. Wait for a popup/modal to appear with sign-in options
4. Look for either "Sign in with Microsoft" or "Sign in with Google" button in the popup
5. Click the sign-in button (Microsoft preferred, Google as fallback)
6. Wait for the sign-in page to load
7. Fill in the email field with the provided email
8. Click Next/Continue button
9. Fill in the password field
10. Complete the account creation process

CURRENT STEP: ${step}
CONTEXT: ${context}

CREDENTIALS TO USE:
- Email: ${email}
- Password: ${password}

Page Information:
- Title: ${pageInfo.title}
- URL: ${pageInfo.url}
- Available buttons: ${JSON.stringify(pageInfo.allButtons, null, 2)}

IMPORTANT INSTRUCTIONS:
- Look for buttons with text like "Get Started", "Start", "Sign Up", "Create Account" (usually in top-right corner or main hero section)
- Look for sign-in buttons with "Microsoft", "Google", "Sign in with" (usually in a popup/modal)
- If you see a popup/modal, look inside it for sign-in options
- If you see email/password fields, fill them with the provided credentials
- Always provide coordinates for clicking when possible
- Be very specific about what you're looking for and why
- If you see "Get Started" button, click it immediately
- If you see sign-in options, prefer Microsoft over Google
- If you see email field, type the provided email
- If you see password field, type the provided password

Please analyze the screenshot and page information, then respond with a JSON object containing:
{
  "action": "click" | "type" | "wait" | "error" | "success",
  "target": "button text or selector",
  "coordinates": {"x": number, "y": number} (if clicking),
  "text": "text to type" (if typing),
  "reasoning": "detailed explanation of what you see and what you're clicking",
  "nextStep": "what should happen next"
}

Be very specific about what element to click and provide coordinates if possible.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Please analyze this screenshot of the Kie.ai website and tell me exactly what to do next. 

Look for:
1. "Get Started" button (if we haven't clicked it yet)
2. Sign-in popup with Microsoft/Google options (if popup is visible)
3. Email/password input fields (if we're on a sign-in page)
4. Any other relevant buttons or forms

Be very specific about what you see and what you want to click. Provide exact coordinates if possible.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${base64}`
                }
              }
            ]
          }
        ],
        max_tokens: 500
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const aiResponse = data.choices[0].message.content.trim();
    
    addDebugStep('AI Decision', 'info', `AI Response: ${aiResponse}`);
    
    // Parse JSON response
    try {
      const decision = JSON.parse(aiResponse);
      addDebugStep('AI Decision', 'success', `AI Decision: ${decision.action} - ${decision.reasoning}`);
      
      // Take screenshot for AI decision
      const screenshotPath = await takeScreenshot('AI-Decision', page);
      
      // Emit AI decision with screenshot to UI
      if (globalIO) {
        globalIO.emit('log', {
          step: 'AI Decision',
          type: 'info',
          message: `AI wants to ${decision.action}: ${decision.reasoning}`,
          timestamp: new Date().toLocaleString(),
          screenshot: screenshotPath
        });
      }
      
      return decision;
    } catch (parseError) {
      addDebugStep('AI Decision', 'error', `Failed to parse AI response: ${parseError.message}`);
      return null;
    }
    
  } catch (error) {
    addDebugStep('AI Decision', 'error', `AI decision failed: ${error.message}`);
    return null;
  }
}

// AI-powered CAPTCHA solving using GPT Vision
async function solveCaptchaWithAI(page) {
  try {
    addDebugStep('CAPTCHA', 'info', 'Taking screenshot for AI analysis...');
    
    // Take screenshot of the CAPTCHA
    const screenshotPath = await takeScreenshot('CAPTCHA-Challenge', page);
    if (!screenshotPath) {
      throw new Error('Failed to take CAPTCHA screenshot');
    }
    
    // Read the screenshot file
    const screenshotBuffer = fs.readFileSync(path.join(__dirname, 'screenshots', screenshotPath));
    const base64Image = screenshotBuffer.toString('base64');
    
    // Call OpenAI GPT Vision API
    const { default: fetch } = await import('node-fetch');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Look at this CAPTCHA image. The instruction says "Tap on the item that you can turn on and off". Analyze the 3x3 grid of images and tell me which items can be turned on and off. Return ONLY the numbers (1-9) of the correct items, separated by commas if multiple. For example: "5,9" if items 5 and 9 can be turned on and off.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 50
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const aiResponse = data.choices[0].message.content.trim();
    
    addDebugStep('CAPTCHA', 'info', `AI Analysis: ${aiResponse}`);
    
    // Parse the AI response to get item numbers
    const itemNumbers = aiResponse.split(',').map(num => parseInt(num.trim())).filter(num => !isNaN(num) && num >= 1 && num <= 9);
    
    if (itemNumbers.length === 0) {
      throw new Error('AI could not identify any clickable items');
    }
    
    addDebugStep('CAPTCHA', 'info', `Clicking on items: ${itemNumbers.join(', ')}`);
    
    // Click on the identified items
    for (const itemNumber of itemNumbers) {
      try {
        // Calculate grid position (1-based to 0-based)
        const row = Math.floor((itemNumber - 1) / 3);
        const col = (itemNumber - 1) % 3;
        
        // Find the image grid container
        const gridContainer = await page.$('[class*="grid"], [class*="captcha"], [class*="challenge"]');
        if (!gridContainer) {
          throw new Error('Could not find CAPTCHA grid container');
        }
        
        // Get grid dimensions
        const gridBox = await gridContainer.boundingBox();
        if (!gridBox) {
          throw new Error('Could not get grid dimensions');
        }
        
        // Calculate click position within the grid
        const itemWidth = gridBox.width / 3;
        const itemHeight = gridBox.height / 3;
        const clickX = gridBox.x + (col * itemWidth) + (itemWidth / 2);
        const clickY = gridBox.y + (row * itemHeight) + (itemHeight / 2);
        
        // Click on the calculated position
        await page.mouse.click(clickX, clickY);
        addDebugStep('CAPTCHA', 'info', `Clicked item ${itemNumber} at position (${Math.round(clickX)}, ${Math.round(clickY)})`);
        
        // Small delay between clicks
        await sleep(500);
        
      } catch (error) {
        addDebugStep('CAPTCHA', 'error', `Failed to click item ${itemNumber}: ${error.message}`);
      }
    }
    
    return true;
    
  } catch (error) {
    addDebugStep('CAPTCHA', 'error', `AI CAPTCHA solving failed: ${error.message}`);
    return false;
  }
}

// Main function to create Kie.ai account
// AI-powered Kie.ai account creation
async function createKieAccountAI(io, email, password) {
  let browser = null;
  let page = null;
  
  try {
    // Set global IO instance for logging
    globalIO = io;
    
    addDebugStep('AI Account Creation', 'info', 'Starting AI-powered Kie.ai account creation...');
    
    // Launch browser
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
        '--disable-gpu'
      ]
    });
    
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    
    // Step 1: Navigate to Kie.ai
    addDebugStep('Navigation', 'info', 'Navigating to Kie.ai...');
    await page.goto('https://kie.ai/', { waitUntil: 'networkidle2', timeout: 30000 });
    addDebugStep('Navigation', 'success', 'Successfully navigated to Kie.ai');
    
    // Human-like behavior: random delay after page load
    await randomHumanDelay(page, 1000, 3000);
    
    const homepageScreenshot = await takeScreenshot('Kie-Homepage', page);
    addDebugStep('Navigation', 'info', `Homepage screenshot: ${homepageScreenshot || 'Failed to take screenshot'}`);
    
    // AI Decision Loop
    let step = 1;
    let maxSteps = 20; // Prevent infinite loops
    let currentContext = "We're on the Kie.ai homepage and need to start the account creation process";
    
    while (step <= maxSteps) {
      // Check for pause/stop flags
      if (global.globalScraperPaused) {
        addDebugStep('AI Loop', 'info', 'Scraper paused by user');
        await sleep(1000); // Wait 1 second before checking again
        continue;
      }
      
      if (global.globalScraperStopped) {
        addDebugStep('AI Loop', 'info', 'Scraper stopped by user');
        break;
      }
      addDebugStep('AI Loop', 'info', `Step ${step}: Getting AI decision...`);
      
      // Emit AI loop step with screenshot
      const loopScreenshot = await takeScreenshot(`AI-Loop-Step-${step}`, page);
      if (globalIO) {
        globalIO.emit('log', {
          step: 'AI Loop',
          type: 'info',
          message: `Step ${step}: Getting AI decision for: ${currentContext}`,
          timestamp: new Date().toLocaleString(),
          screenshot: loopScreenshot
        });
      }
      
      const aiDecision = await getAIDecision(page, currentContext, step, email, password);
      
      if (!aiDecision) {
        addDebugStep('AI Loop', 'error', 'AI decision failed, falling back to manual process');
        
        // Emit error with screenshot
        const errorScreenshot = await takeScreenshot('AI-Decision-Failed', page);
        if (globalIO) {
          globalIO.emit('log', {
            step: 'AI Loop',
            type: 'error',
            message: 'AI decision failed, falling back to manual process',
            timestamp: new Date().toLocaleString(),
            screenshot: errorScreenshot
          });
        }
        break;
      }
      
      addDebugStep('AI Loop', 'info', `AI wants to: ${aiDecision.action} - ${aiDecision.reasoning}`);
      
      try {
        switch (aiDecision.action) {
          case 'click':
            if (aiDecision.coordinates) {
              // Human-like click at specific coordinates
              await humanLikeClick(page, aiDecision.coordinates.x, aiDecision.coordinates.y);
              addDebugStep('AI Action', 'success', `Human-like clicked at coordinates (${aiDecision.coordinates.x}, ${aiDecision.coordinates.y})`);
              
              // Take screenshot after click action
              const clickScreenshot = await takeScreenshot(`AI-Click-${step}`, page);
              addDebugStep('AI Action', 'info', `Screenshot after click: ${clickScreenshot || 'Failed'}`);
              
              if (globalIO) {
                globalIO.emit('log', {
                  step: 'AI Action',
                  type: 'success',
                  message: `Human-like clicked at coordinates (${aiDecision.coordinates.x}, ${aiDecision.coordinates.y})`,
                  timestamp: new Date().toLocaleString(),
                  screenshot: clickScreenshot
                });
              }
            } else if (aiDecision.target) {
              // Human-like click by selector
              const element = await page.$(aiDecision.target);
              if (element) {
                await humanLikeClick(page, null, null, element);
              } else {
                await page.click(aiDecision.target);
              }
              addDebugStep('AI Action', 'success', `Human-like clicked: ${aiDecision.target}`);
              
              // Take screenshot after click action
              const clickScreenshot = await takeScreenshot(`AI-Click-${step}`, page);
              addDebugStep('AI Action', 'info', `Screenshot after click: ${clickScreenshot || 'Failed'}`);
              
              if (globalIO) {
                globalIO.emit('log', {
                  step: 'AI Action',
                  type: 'success',
                  message: `Human-like clicked: ${aiDecision.target}`,
                  timestamp: new Date().toLocaleString(),
                  screenshot: clickScreenshot
                });
              }
            }
            break;
            
          case 'type':
            if (aiDecision.text && aiDecision.target) {
              await humanLikeType(page, aiDecision.target, aiDecision.text);
              addDebugStep('AI Action', 'success', `Human-like typed: ${aiDecision.text} into ${aiDecision.target}`);
              
              // Take screenshot after typing action
              const typeScreenshot = await takeScreenshot(`AI-Type-${step}`, page);
              addDebugStep('AI Action', 'info', `Screenshot after typing: ${typeScreenshot || 'Failed'}`);
              
              if (globalIO) {
                globalIO.emit('log', {
                  step: 'AI Action',
                  type: 'success',
                  message: `Typed: ${aiDecision.text} into ${aiDecision.target}`,
                  timestamp: new Date().toLocaleString(),
                  screenshot: typeScreenshot
                });
              }
            }
            break;
            
          case 'wait':
            await randomHumanDelay(page, 1000, 3000);
            addDebugStep('AI Action', 'info', 'Human-like waited as requested by AI');
            
            // Take screenshot after wait action
            const waitScreenshot = await takeScreenshot(`AI-Wait-${step}`, page);
            addDebugStep('AI Action', 'info', `Screenshot after wait: ${waitScreenshot || 'Failed'}`);
            
            if (globalIO) {
              globalIO.emit('log', {
                step: 'AI Action',
                type: 'info',
                message: 'Waited as requested by AI',
                timestamp: new Date().toLocaleString(),
                screenshot: waitScreenshot
              });
            }
            break;
            
          case 'success':
            addDebugStep('AI Action', 'success', 'AI reports success!');
            
            // Emit success with screenshot
            const successScreenshot = await takeScreenshot('AI-Success', page);
            if (globalIO) {
              globalIO.emit('log', {
                step: 'AI Action',
                type: 'success',
                message: 'AI reports success! Account created successfully with AI assistance',
                timestamp: new Date().toLocaleString(),
                screenshot: successScreenshot
              });
            }
            
            return {
              success: true,
              email: email,
              password: password,
              message: 'Account created successfully with AI assistance'
            };
            
          case 'error':
            addDebugStep('AI Action', 'error', `AI reports error: ${aiDecision.reasoning}`);
            
            // Emit error with screenshot
            const errorScreenshot = await takeScreenshot('AI-Error', page);
            if (globalIO) {
              globalIO.emit('log', {
                step: 'AI Action',
                type: 'error',
                message: `AI reports error: ${aiDecision.reasoning}`,
                timestamp: new Date().toLocaleString(),
                screenshot: errorScreenshot
              });
            }
            
            throw new Error(`AI detected error: ${aiDecision.reasoning}`);
        }
        
        // Update context for next step
        currentContext = aiDecision.nextStep || "Continue with the next step in the account creation process";
        step++;
        
        // Small delay between steps
        await sleep(1000);
        
      } catch (actionError) {
        addDebugStep('AI Action', 'error', `Action failed: ${actionError.message}`);
        
        // Emit action error with screenshot
        const actionErrorScreenshot = await takeScreenshot(`AI-Action-Error-${step}`, page);
        if (globalIO) {
          globalIO.emit('log', {
            step: 'AI Action',
            type: 'error',
            message: `Action failed: ${actionError.message}`,
            timestamp: new Date().toLocaleString(),
            screenshot: actionErrorScreenshot
          });
        }
        
        // Try to continue with next step
        step++;
      }
    }
    
    addDebugStep('AI Loop', 'warning', 'Reached maximum steps, falling back to manual process');
    
    // Emit fallback warning with screenshot
    const fallbackScreenshot = await takeScreenshot('AI-Fallback', page);
    if (globalIO) {
      globalIO.emit('log', {
        step: 'AI Loop',
        type: 'warning',
        message: 'Reached maximum steps, falling back to manual process',
        timestamp: new Date().toLocaleString(),
        screenshot: fallbackScreenshot
      });
    }
    
    // Fallback to manual process if AI loop completes
    return await createKieAccount(io, email, password);
    
  } catch (error) {
    addDebugStep('AI Account Creation', 'error', `AI account creation failed: ${error.message}`);
    
    // Emit final error with screenshot if page is still available
    try {
      if (page) {
        const finalErrorScreenshot = await takeScreenshot('AI-Final-Error', page);
        if (globalIO) {
          globalIO.emit('log', {
            step: 'AI Account Creation',
            type: 'error',
            message: `AI account creation failed: ${error.message}`,
            timestamp: new Date().toLocaleString(),
            screenshot: finalErrorScreenshot
          });
        }
      }
    } catch (screenshotError) {
      // Screenshot failed, just emit the error without screenshot
      if (globalIO) {
        globalIO.emit('log', {
          step: 'AI Account Creation',
          type: 'error',
          message: `AI account creation failed: ${error.message}`,
          timestamp: new Date().toLocaleString()
        });
      }
    }
    
    return {
      success: false,
      error: error.message,
      message: 'AI-powered account creation failed'
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function createKieAccount(io, email, password) {
  let browser = null;
  let page = null;
  
  try {
    // Set global IO instance
    globalIO = io;
    
    addDebugStep('Account Creation', 'info', '🚀 Starting Kie.ai account creation process...');
    
    // Generate password if not provided
    const generatedPassword = password || Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12).toUpperCase() + '123!';
    
    addDebugStep('Account Creation', 'info', `📧 Email: ${email}`);
    addDebugStep('Account Creation', 'info', `🔑 Password: ${generatedPassword}`);
    
    // Launch browser with timeout
    addDebugStep('Browser', 'info', 'Launching browser...');
    
    const browserPromise = puppeteer.launch({
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
    
    // Add timeout to browser launch
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Browser launch timeout after 30 seconds')), 30000)
    );
    
    browser = await Promise.race([browserPromise, timeoutPromise]);
    
    addDebugStep('Browser', 'success', 'Browser launched successfully');
    
    // Create new page
    addDebugStep('Browser', 'info', 'Creating new page...');
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    addDebugStep('Browser', 'success', 'Page created and viewport set');
    
    // Debug: Verify page is created properly
    console.log('DEBUG: Page created successfully:', typeof page, page);
    console.log('DEBUG: Page URL after creation:', await page.url());
    
    // Verify page is created
    if (!page) {
      throw new Error('Page was not created successfully');
    }
    
    // Step 1: Navigate to Kie.ai
    addDebugStep('Navigation', 'info', 'Navigating to Kie.ai...');
    await page.goto('https://kie.ai/', { waitUntil: 'networkidle2', timeout: 30000 });
    addDebugStep('Navigation', 'success', 'Successfully navigated to Kie.ai');
    
    // Human-like behavior: random delay after page load
    await randomHumanDelay(page, 1000, 3000);
    
    // Debug: Check page variable before screenshot
    console.log('DEBUG: page variable before takeScreenshot:', typeof page, page);
    
    let homepageScreenshot = null;
    try {
      homepageScreenshot = await takeScreenshot('Kie-Homepage', page);
      console.log('DEBUG: Screenshot taken successfully:', homepageScreenshot);
    } catch (screenshotError) {
      console.log('DEBUG: Screenshot failed:', screenshotError.message);
      addDebugStep('Navigation', 'error', `Screenshot failed: ${screenshotError.message}`);
    }
    
    addDebugStep('Navigation', 'info', `Homepage screenshot: ${homepageScreenshot || 'Failed to take screenshot'}`);
    
    // Debug: Check page variable after screenshot
    console.log('DEBUG: page variable after takeScreenshot:', typeof page, page);
    
    // Step 2: Look for Kie.ai login popup and click "Sign in with Microsoft"
    addDebugStep('Kie Login', 'info', 'Looking for Kie.ai login popup...');
    
    // Wait for login popup to appear
    try {
      await page.waitForSelector('button:contains("Sign in with Microsoft"), button:contains("Inloggen met Microsoft"), [data-testid*="microsoft"], [class*="microsoft"]', { timeout: 10000 });
      addDebugStep('Kie Login', 'success', 'Kie.ai login popup detected');
      await takeScreenshot('Kie-Login-Popup', page);
      
      // Click "Sign in with Microsoft" button
      addDebugStep('Kie Login', 'info', 'Clicking Sign in with Microsoft button...');
      await page.click('button:contains("Sign in with Microsoft"), button:contains("Inloggen met Microsoft"), [data-testid*="microsoft"], [class*="microsoft"]');
      addDebugStep('Kie Login', 'success', 'Clicked Sign in with Microsoft button');
      await takeScreenshot('Microsoft-Login-Clicked', page);
      
    } catch (popupError) {
      addDebugStep('Kie Login', 'warning', `Login popup not found: ${popupError.message} - trying Get Started button instead`);
      
      // Fallback to Get Started button if no login popup
      addDebugStep('Get Started', 'info', 'Looking for Get Started button...');
    
    // Debug: Check page variable before Get Started click
    console.log('DEBUG: page variable before Get Started click:', typeof page, page);
    
    // Verify page is still available
    if (!page) {
      console.log('ERROR: Page is undefined before Get Started click!');
      throw new Error('Page became undefined before Get Started click');
    }
    
    // Wait for the page to be fully loaded
    await sleep(3000);
    
    // Try multiple selectors for the Get Started button
    const getStartedSelectors = [
      '//button[contains(text(), "Get Started")]',
      '//a[contains(text(), "Get Started")]',
      'button[class*="Get Started"]',
      'a[class*="Get Started"]'
    ];
    
    let getStartedButton = null;
    let usedSelector = '';
    
    for (const selector of getStartedSelectors) {
      try {
        if (selector.startsWith('//')) {
          // XPath selector
          getStartedButton = await page.waitForXPath(selector, { timeout: 5000 });
        } else {
          // CSS selector
          getStartedButton = await page.waitForSelector(selector, { timeout: 5000 });
        }
        
        if (getStartedButton) {
          usedSelector = selector;
          addDebugStep('Get Started', 'info', `Found Get Started button with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue to next selector
        addDebugStep('Get Started', 'info', `Selector ${selector} failed: ${e.message}`);
      }
    }
    
    if (!getStartedButton) {
      // Fallback: try to find by text content using evaluate
      addDebugStep('Get Started', 'info', 'Trying fallback method to find Get Started button...');
      
      const buttonFound = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, a'));
        const getStartedBtn = buttons.find(btn => 
          btn.textContent && btn.textContent.trim().toLowerCase().includes('get started')
        );
        
        if (getStartedBtn) {
          getStartedBtn.click();
          return true;
        }
        return false;
      });
      
      if (buttonFound) {
        addDebugStep('Get Started', 'success', 'Clicked Get Started button using fallback method');
      } else {
        throw new Error('Could not find Get Started button with any method');
      }
    } else {
      // Click the found button
      if (usedSelector.startsWith('//')) {
        await getStartedButton.click();
      } else {
        await page.click(selector);
      }
      addDebugStep('Get Started', 'success', `Clicked Get Started button using selector: ${usedSelector}`);
    }
    
    // Take screenshot after Get Started click
    const getStartedScreenshot = await takeScreenshot('Get-Started-Clicked', page);
    addDebugStep('Get Started', 'info', `Screenshot after Get Started click: ${getStartedScreenshot || 'Failed'}`);
    } // Close the catch block for popupError
    
    // Step 3: Wait for popup to appear and load fully
    addDebugStep('Popup Wait', 'info', 'Waiting for popup to appear after Get Started click...');
    
    // Wait for any popup/modal to appear with multiple detection methods
    await page.waitForFunction(() => {
      // Check for common popup indicators
      const modals = document.querySelectorAll('[role="dialog"], [role="modal"], .modal, .popup, .overlay');
      const hasVisibleModal = Array.from(modals).some(modal => {
        const style = window.getComputedStyle(modal);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      });
      
      // Check for Google sign-in specific elements
      const googleElements = document.querySelectorAll('[class*="google"], [class*="signin"], [class*="login"]');
      const hasGoogleElements = googleElements.length > 0;
      
      // Check for the specific Google span we're looking for
      const specificSpan = document.querySelector('span.nsm7Bb-HzV7m-LgbsSe-BPrWId');
      const hasSpecificSpan = specificSpan !== null;
      
      // Check for any text containing "inloggen" or "sign in"
      const signInText = document.body.textContent.toLowerCase();
      const hasSignInText = signInText.includes('inloggen') || signInText.includes('sign in') || signInText.includes('google');
      
      return hasVisibleModal || hasGoogleElements || hasSpecificSpan || hasSignInText;
    }, { timeout: 20000 });
    
    addDebugStep('Popup Wait', 'success', 'Popup detected, waiting for full load...');
    
    // Additional wait for content to fully load
    await sleep(5000);
    
    // Take screenshot of the popup
    await takeScreenshot('Popup-Appeared', page);
    
    // Debug: Check what's actually on the page
    const pageContent = await page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        bodyText: document.body.textContent.substring(0, 500),
        allSpans: Array.from(document.querySelectorAll('span')).map(s => s.textContent.trim()).filter(t => t.length > 0).slice(0, 10),
        allButtons: Array.from(document.querySelectorAll('button, a')).map(b => b.textContent.trim()).filter(t => t.length > 0).slice(0, 10)
      };
    });
    
    addDebugStep('Popup Wait', 'info', `Page content: ${JSON.stringify(pageContent, null, 2)}`);
    
    // Step 4: Click "Sign in with Microsoft" button (using fallback method directly)
    addDebugStep('Microsoft Sign-in', 'info', 'Looking for Sign in with Microsoft button using fallback method...');
    
    // Debug: Check what elements are available
    const debugInfo = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('span')).filter(s => 
        s.textContent && s.textContent.toLowerCase().includes('microsoft')
      );
      const buttons = Array.from(document.querySelectorAll('button, a, div[role="button"]')).filter(b => 
        b.textContent && b.textContent.toLowerCase().includes('microsoft')
      );
      
      return {
        microsoftSpans: spans.map(s => ({
          text: s.textContent.trim(),
          classes: s.className,
          tagName: s.tagName
        })),
        microsoftButtons: buttons.map(b => ({
          text: b.textContent.trim(),
          tagName: b.tagName,
          classes: b.className
        }))
      };
    });
    
    addDebugStep('Microsoft Sign-in', 'info', `Debug info: ${JSON.stringify(debugInfo, null, 2)}`);
    
    try {
      // Use fallback method with human-like mouse movement
      const buttonFound = await page.evaluate(() => {
        // Try to find Microsoft sign-in button by text content
        const buttons = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
        const microsoftBtn = buttons.find(btn => 
          btn.textContent && (
            btn.textContent.trim().toLowerCase().includes('sign in with microsoft') ||
            btn.textContent.trim().toLowerCase().includes('microsoft') ||
            btn.textContent.trim().toLowerCase().includes('sign in')
          )
        );
        
        if (microsoftBtn) {
          // Get button position for human-like movement
          const rect = microsoftBtn.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          
          // Store position for mouse movement
          window.microsoftButtonPosition = { x: centerX, y: centerY };
          return true;
        }
        
        // Fallback: try to find any element containing "microsoft" or "sign in"
        const allElements = Array.from(document.querySelectorAll('*'));
        const microsoftElement = allElements.find(el => 
          el.textContent && (
            el.textContent.trim().toLowerCase().includes('sign in with microsoft') ||
            el.textContent.trim().toLowerCase().includes('microsoft')
          )
        );
        
        if (microsoftElement) {
          const rect = microsoftElement.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          
          // Store position for mouse movement
          window.microsoftButtonPosition = { x: centerX, y: centerY };
          return true;
        }
        
        return false;
      });
      
      if (buttonFound) {
        // Human-like mouse movement to the button
        const buttonPos = await page.evaluate(() => window.microsoftButtonPosition);
        
        // Move mouse to button with human-like path
        await page.mouse.move(buttonPos.x - 50, buttonPos.y - 20, { steps: 10 });
        await sleep(200);
        await page.mouse.move(buttonPos.x - 20, buttonPos.y - 10, { steps: 5 });
        await sleep(100);
        await page.mouse.move(buttonPos.x, buttonPos.y, { steps: 3 });
        await sleep(300);
        
        // Click the button
        await page.mouse.click(buttonPos.x, buttonPos.y);
        
        addDebugStep('Microsoft Sign-in', 'success', 'Clicked Microsoft sign-in button with human-like movement');
        
        // Take screenshot immediately after clicking
        await takeScreenshot('Microsoft-Signin-Clicked', page);
        
        // Wait a bit for any redirects or new windows
        await sleep(2000);
        
        // Check if page is still accessible
        try {
          await page.evaluate(() => document.title);
          addDebugStep('Microsoft Sign-in', 'info', 'Page is still accessible after Microsoft sign-in click');
        } catch (e) {
          addDebugStep('Microsoft Sign-in', 'warning', 'Page became inaccessible after Microsoft sign-in click - this is normal for redirects');
        }
        
      } else {
        throw new Error('Could not find Sign in with Microsoft button with fallback method');
      }
      
    } catch (error) {
      addDebugStep('Microsoft Sign-in', 'error', `Microsoft sign-in failed: ${error.message}`);
      
      // Try to take screenshot even if there's an error
      try {
        await takeScreenshot('Microsoft-Signin-Error', page);
      } catch (screenshotError) {
        addDebugStep('Microsoft Sign-in', 'error', `Screenshot failed: ${screenshotError.message}`);
      }
      
      throw error;
    }
    
    // Step 5: Wait for Microsoft login popup to appear and switch to it
    addDebugStep('Microsoft Login Popup', 'info', 'Waiting for Microsoft login popup to appear...');
    
    let popupPage = null;
    
    try {
      // Wait for a new popup window to appear
      const popupPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('No popup window appeared within 15 seconds'));
        }, 15000);
        
        browser.on('targetcreated', async (target) => {
          if (target.type() === 'page') {
            clearTimeout(timeout);
            try {
              const newPage = await target.page();
              if (newPage && newPage !== page) {
                addDebugStep('Microsoft Login Popup', 'info', 'New popup window detected, checking if it\'s Microsoft login...');
                
                // Wait a moment for the popup to load
                await sleep(2000);
                
                // Analyze popup content without taking screenshots (to avoid timeout issues)
                addDebugStep('Microsoft Login Popup', 'info', 'Analyzing popup content...');
                
                // Get comprehensive popup details for debugging with timeout protection
                let popupDetails;
                try {
                  popupDetails = await Promise.race([
                    newPage.evaluate(() => {
                      // Get all text content
                      const allText = document.body.textContent || '';
                      const visibleText = allText.replace(/\s+/g, ' ').trim();
                      
                      // Get all buttons and clickable elements
                      const buttons = Array.from(document.querySelectorAll('button, a, [role="button"], [onclick], input[type="submit"], input[type="button"]'));
                      const buttonDetails = buttons.map(btn => ({
                        tagName: btn.tagName,
                        text: btn.textContent?.trim() || '',
                        className: btn.className,
                        id: btn.id,
                        type: btn.type || '',
                        visible: btn.offsetParent !== null,
                        disabled: btn.disabled || false
                      })).filter(btn => btn.text || btn.className || btn.id);
                      
                      // Get all input fields
                      const inputs = Array.from(document.querySelectorAll('input, textarea, select'));
                      const inputDetails = inputs.map(input => ({
                        tagName: input.tagName,
                        type: input.type,
                        name: input.name,
                        id: input.id,
                        placeholder: input.placeholder,
                        value: input.value,
                        visible: input.offsetParent !== null,
                        required: input.required || false
                      }));
                      
                      // Get all links
                      const links = Array.from(document.querySelectorAll('a'));
                      const linkDetails = links.map(link => ({
                        text: link.textContent?.trim() || '',
                        href: link.href,
                        className: link.className,
                        visible: link.offsetParent !== null
                      })).filter(link => link.text);
                      
                      // Check for specific Microsoft elements
                      const microsoftElements = document.querySelectorAll('[class*="microsoft"], [class*="login"], [class*="signin"], [data-testid*="microsoft"]');
                      const microsoftDetails = Array.from(microsoftElements).map(el => ({
                        tagName: el.tagName,
                        className: el.className,
                        text: el.textContent?.trim() || '',
                        id: el.id
                      }));
                      
                      return {
                        url: window.location.href,
                        title: document.title,
                        domain: window.location.hostname,
                        pathname: window.location.pathname,
                        visibleText: visibleText.substring(0, 500),
                        allText: allText.substring(0, 1000),
                        buttonCount: buttons.length,
                        buttons: buttonDetails,
                        inputCount: inputs.length,
                        inputs: inputDetails,
                        linkCount: links.length,
                        links: linkDetails,
                        microsoftElementCount: microsoftElements.length,
                        microsoftElements: microsoftDetails,
                        hasEmailInput: document.querySelectorAll('input[name="loginfmt"], input[id="i0116"], input[type="email"]').length > 0,
                        hasPasswordInput: document.querySelectorAll('input[name="passwd"], input[type="password"]').length > 0,
                        hasMicrosoftText: visibleText.toLowerCase().includes('microsoft') || visibleText.toLowerCase().includes('sign in') || visibleText.toLowerCase().includes('login'),
                        pageHeight: document.body.scrollHeight,
                        pageWidth: document.body.scrollWidth
                      };
                    }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Popup analysis timeout')), 10000))
                  ]);
                } catch (analysisError) {
                  addDebugStep('Microsoft Login Popup', 'warning', `Popup analysis failed: ${analysisError.message}`);
                  // Create minimal popup details if analysis fails
                  popupDetails = {
                    url: 'unknown',
                    title: 'unknown',
                    domain: 'unknown',
                    hasEmailInput: false,
                    hasPasswordInput: false,
                    hasMicrosoftText: false,
                    buttonCount: 0,
                    inputCount: 0,
                    microsoftElementCount: 0
                  };
                }
                
                addDebugStep('Microsoft Login Popup', 'info', `Popup Analysis Complete:`);
                addDebugStep('Microsoft Login Popup', 'info', `- URL: ${popupDetails.url}`);
                addDebugStep('Microsoft Login Popup', 'info', `- Title: ${popupDetails.title}`);
                addDebugStep('Microsoft Login Popup', 'info', `- Domain: ${popupDetails.domain}`);
                addDebugStep('Microsoft Login Popup', 'info', `- Buttons Found: ${popupDetails.buttonCount}`);
                addDebugStep('Microsoft Login Popup', 'info', `- Inputs Found: ${popupDetails.inputCount}`);
                addDebugStep('Microsoft Login Popup', 'info', `- Links Found: ${popupDetails.linkCount}`);
                addDebugStep('Microsoft Login Popup', 'info', `- Microsoft Elements: ${popupDetails.microsoftElementCount}`);
                addDebugStep('Microsoft Login Popup', 'info', `- Has Email Input: ${popupDetails.hasEmailInput}`);
                addDebugStep('Microsoft Login Popup', 'info', `- Has Password Input: ${popupDetails.hasPasswordInput}`);
                addDebugStep('Microsoft Login Popup', 'info', `- Has Microsoft Text: ${popupDetails.hasMicrosoftText}`);
                
                // Log button details
                if (popupDetails.buttons.length > 0) {
                  addDebugStep('Microsoft Login Popup', 'info', `Buttons found:`);
                  popupDetails.buttons.forEach((btn, index) => {
                    addDebugStep('Microsoft Login Popup', 'info', `  ${index + 1}. ${btn.tagName} - "${btn.text}" (${btn.className}) - Visible: ${btn.visible} - Disabled: ${btn.disabled}`);
                  });
                }
                
                // Log input details
                if (popupDetails.inputs.length > 0) {
                  addDebugStep('Microsoft Login Popup', 'info', `Inputs found:`);
                  popupDetails.inputs.forEach((input, index) => {
                    addDebugStep('Microsoft Login Popup', 'info', `  ${index + 1}. ${input.tagName}[${input.type}] - Name: "${input.name}" - ID: "${input.id}" - Placeholder: "${input.placeholder}" - Visible: ${input.visible}`);
                  });
                }
                
                // Log visible text content
                if (popupDetails.visibleText) {
                  addDebugStep('Microsoft Login Popup', 'info', `Visible text content: "${popupDetails.visibleText}"`);
                }
                
                // Determine if this is Microsoft login popup based on detailed analysis
                const isMicrosoftPopup = popupDetails.hasEmailInput || 
                                       popupDetails.hasMicrosoftText || 
                                       popupDetails.microsoftElementCount > 0 ||
                                       popupDetails.domain.includes('microsoft') ||
                                       popupDetails.domain.includes('live.com') ||
                                       popupDetails.domain.includes('login.live.com') ||
                                       popupDetails.url.includes('microsoft') ||
                                       popupDetails.url.includes('live.com');
                
                addDebugStep('Microsoft Login Popup', 'info', `Microsoft popup detection result: ${isMicrosoftPopup}`);
                addDebugStep('Microsoft Login Popup', 'info', `Detection criteria: EmailInput=${popupDetails.hasEmailInput}, MicrosoftText=${popupDetails.hasMicrosoftText}, MicrosoftElements=${popupDetails.microsoftElementCount}, Domain=${popupDetails.domain}`);
                
                if (isMicrosoftPopup) {
                  addDebugStep('Microsoft Login Popup', 'success', 'Microsoft login popup confirmed, switching to popup window...');
                  
                  // Try to take screenshot with short timeout, but don't fail if it times out
                  try {
                    await Promise.race([
                      takeScreenshot('Microsoft-Popup-Confirmed', newPage),
                      new Promise((_, reject) => setTimeout(() => reject(new Error('Screenshot timeout')), 5000))
                    ]);
                  } catch (screenshotError) {
                    addDebugStep('Microsoft Login Popup', 'warning', `Screenshot failed but continuing: ${screenshotError.message}`);
                  }
                  
                  resolve(newPage);
                } else {
                  addDebugStep('Microsoft Login Popup', 'warning', `Popup detected but not Microsoft login. URL: ${popupDetails.url}, Title: ${popupDetails.title}`);
                  
                  // Try to take screenshot with short timeout, but don't fail if it times out
                  try {
                    await Promise.race([
                      takeScreenshot('Non-Microsoft-Popup', newPage),
                      new Promise((_, reject) => setTimeout(() => reject(new Error('Screenshot timeout')), 5000))
                    ]);
                  } catch (screenshotError) {
                    addDebugStep('Microsoft Login Popup', 'warning', `Screenshot failed but continuing: ${screenshotError.message}`);
                  }
                  
                  // Close this popup if it's not Microsoft login
                  try {
                    await newPage.close();
                    addDebugStep('Microsoft Login Popup', 'info', 'Closed non-Microsoft popup window');
                  } catch (closeError) {
                    addDebugStep('Microsoft Login Popup', 'warning', `Failed to close popup: ${closeError.message}`);
                  }
                }
              }
            } catch (e) {
              addDebugStep('Microsoft Login Popup', 'warning', `Error checking popup: ${e.message}`);
            }
          }
        });
      });
      
      popupPage = await popupPromise;
      
      // Additional wait for content to fully load
      await sleep(3000);
      
      // Take screenshot of the Microsoft login popup
      await takeScreenshot('Microsoft-Login-Popup', popupPage);
      
    } catch (error) {
      addDebugStep('Microsoft Login Popup', 'error', `Microsoft login popup wait failed: ${error.message}`);
      
      // Try to find popup in existing pages
      addDebugStep('Microsoft Login Popup', 'info', 'Trying to find popup in existing pages...');
      
      try {
        const pages = await browser.pages();
        for (let i = 0; i < pages.length; i++) {
          const testPage = pages[i];
          if (testPage !== page) {
            try {
              const isMicrosoftPopup = await testPage.evaluate(() => {
                const microsoftElements = document.querySelectorAll('input[name="loginfmt"], input[id="i0116"], input[type="email"]');
                const hasMicrosoftLogin = microsoftElements.length > 0;
                
                const microsoftPageIndicators = document.querySelectorAll('[class*="microsoft"], [class*="login"], [class*="signin"]');
                const hasMicrosoftPage = microsoftPageIndicators.length > 0;
                
                const microsoftText = document.body.textContent.toLowerCase();
                const hasMicrosoftText = microsoftText.includes('microsoft') || microsoftText.includes('outlook') || microsoftText.includes('account');
                
                return hasMicrosoftLogin || hasMicrosoftPage || hasMicrosoftText;
              });
              
              if (isMicrosoftPopup) {
                popupPage = testPage;
                addDebugStep('Microsoft Login Popup', 'success', 'Found Microsoft login popup in existing pages');
                break;
              }
            } catch (e) {
              // Page might be closed or inaccessible
            }
          }
        }
        
        if (!popupPage) {
          // Take screenshot to see what's happening after timeout
          await takeScreenshot('Microsoft-Login-Timeout', page);
          addDebugStep('Microsoft Login Popup', 'info', 'Attempting to continue on main page...');
        }
      } catch (e) {
        addDebugStep('Microsoft Login Popup', 'error', `Error checking existing pages: ${e.message}`);
      }
    }
    
    // Step 6: Enter email
    addDebugStep('Email Entry', 'info', 'Entering email address...');
    
    try {
      // Use popup page if available, otherwise fall back to main page
      let targetPage = popupPage || page;
      
      if (popupPage) {
        addDebugStep('Email Entry', 'info', 'Using Microsoft login popup page for email entry');
      } else {
        addDebugStep('Email Entry', 'warning', 'No popup found, using main page for email entry');
      }
      
      // First check if target page is still accessible
      try {
        await targetPage.evaluate(() => document.title);
        addDebugStep('Email Entry', 'info', 'Target page is accessible, proceeding with email entry');
      } catch (e) {
        addDebugStep('Email Entry', 'error', 'Target page is not accessible - session may have closed');
        throw new Error('Target page session closed - cannot proceed with email entry');
      }
      
      // Take screenshot to see current page state
      await takeScreenshot('Before-Email-Entry', targetPage);
      
      // Get all input fields on the page for debugging
      const allInputs = await targetPage.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        return inputs.map(input => ({
          type: input.type,
          name: input.name,
          id: input.id,
          placeholder: input.placeholder,
          className: input.className,
          visible: input.offsetParent !== null,
          value: input.value
        }));
      });
      
      addDebugStep('Email Entry', 'info', `Found ${allInputs.length} input fields on page: ${JSON.stringify(allInputs)}`);
      
      // Comprehensive email field detection
      const emailSelectors = [
        // Microsoft-specific selectors
        'input[name="loginfmt"]',
        'input[id="i0116"]',
        'input[name="email"]',
        'input[id="email"]',
        
        // Generic email selectors
        'input[type="email"]',
        'input[type="text"][name*="email" i]',
        'input[type="text"][id*="email" i]',
        'input[type="text"][class*="email" i]',
        
        // Placeholder-based selectors
        'input[placeholder*="email" i]',
        'input[placeholder*="Email" i]',
        'input[placeholder*="mail" i]',
        'input[placeholder*="Mail" i]',
        'input[placeholder*="e-mail" i]',
        'input[placeholder*="E-mail" i]',
        'input[placeholder*="Enter your email" i]',
        
        // Aria-label based selectors
        'input[aria-label*="email" i]',
        'input[aria-label*="Email" i]',
        'input[aria-label*="mail" i]',
        'input[aria-label*="Mail" i]',
        'input[aria-label*="e-mail" i]',
        'input[aria-label*="E-mail" i]',
        
        // Google-specific selectors
        'input[name="identifier"]',
        'input[id="identifierId"]',
        
        // Generic text input selectors (fallback)
        'input[type="text"]',
        'input:not([type])'
      ];
      
      let emailField = null;
      let usedEmailSelector = '';
      
      // Try each selector with shorter timeout
      for (const selector of emailSelectors) {
        try {
          addDebugStep('Email Entry', 'info', `Trying email selector: ${selector}`);
          
          // Wait for selector with shorter timeout
          emailField = await targetPage.waitForSelector(selector, { timeout: 2000 });
          
          if (emailField) {
            // Check if element is visible and interactable
            const isVisible = await emailField.isIntersectingViewport();
            const isEnabled = await emailField.evaluate(el => !el.disabled);
            
            if (isVisible && isEnabled) {
              usedEmailSelector = selector;
              addDebugStep('Email Entry', 'success', `Found visible and enabled email field with selector: ${selector}`);
              break;
            } else {
              addDebugStep('Email Entry', 'info', `Email field found but not visible/enabled: ${selector}`);
              emailField = null;
            }
          }
        } catch (e) {
          addDebugStep('Email Entry', 'info', `Email selector ${selector} failed: ${e.message}`);
        }
      }
      
      // If no specific email field found, try to find any text input
      if (!emailField) {
        addDebugStep('Email Entry', 'info', 'No specific email field found, looking for any text input...');
        
        const textInputs = await targetPage.$$('input[type="text"], input:not([type])');
        for (let i = 0; i < textInputs.length; i++) {
          const input = textInputs[i];
          const isVisible = await input.isIntersectingViewport();
          const isEnabled = await input.evaluate(el => !el.disabled);
          
          if (isVisible && isEnabled) {
            emailField = input;
            usedEmailSelector = `text-input-${i}`;
            addDebugStep('Email Entry', 'info', `Using text input ${i} as email field`);
            break;
          }
        }
      }
      
      if (!emailField) {
        // Fallback: try to find by attributes using evaluate
        addDebugStep('Email Entry', 'info', 'Trying fallback method to find email field...');
        
        try {
          const emailFieldFound = await targetPage.evaluate((email) => {
            const inputs = Array.from(document.querySelectorAll('input'));
            const emailInput = inputs.find(input => 
              input.type === 'email' || 
              input.name === 'loginfmt' || 
              input.id === 'i0116' ||
              input.placeholder && input.placeholder.toLowerCase().includes('email')
            );
            
            if (emailInput) {
              emailInput.focus();
              emailInput.value = email;
              emailInput.dispatchEvent(new Event('input', { bubbles: true }));
              emailInput.dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            }
            return false;
          }, email);
          
          if (emailFieldFound) {
            addDebugStep('Email Entry', 'success', 'Email entered using fallback method');
          } else {
            // Try XPath fallback
            addDebugStep('Email Entry', 'info', 'Trying XPath fallback for email field...');
            const xpathResult = await targetPage.$x('//input[@type="text" or @type="email" or not(@type)]');
            if (xpathResult.length > 0) {
              const xpathField = xpathResult[0];
              const isVisible = await xpathField.isIntersectingViewport();
              const isEnabled = await xpathField.evaluate(el => !el.disabled);
              
              if (isVisible && isEnabled) {
                emailField = xpathField;
                usedEmailSelector = 'xpath-fallback';
                addDebugStep('Email Entry', 'info', 'Found email field using XPath fallback');
              }
            }
            
            if (!emailField) {
              throw new Error('Could not find email field with any method');
            }
          }
        } catch (e) {
          addDebugStep('Email Entry', 'error', `Fallback method failed: ${e.message}`);
          throw e;
        }
      } else {
        // Human-like email entry
        try {
          // Get element position for human-like interaction
          const box = await emailField.boundingBox();
          if (box) {
            const centerX = box.x + box.width / 2;
            const centerY = box.y + box.height / 2;
            
            // Human-like mouse movement to field
            await humanLikeMouseMove(targetPage, 0, 0, centerX, centerY);
            await randomHumanDelay(targetPage, 200, 500);
          }
          
          // Click to focus the field
          await emailField.click();
          await randomHumanDelay(targetPage, 100, 300);
          
          // Clear any existing text
          await emailField.click({ clickCount: 3 });
          await randomHumanDelay(targetPage, 50, 150);
          
          // Use human-like typing
          await humanLikeType(targetPage, usedEmailSelector, email);
          addDebugStep('Email Entry', 'success', `Human-like entered email using selector: ${usedEmailSelector}`);
          
          // Take screenshot after email entry
          const emailScreenshot = await takeScreenshot('Email-Entered', targetPage);
          addDebugStep('Email Entry', 'info', `Screenshot after email entry: ${emailScreenshot || 'Failed'}`);
          
          // Trigger events to ensure validation
          await targetPage.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (el) {
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
              el.dispatchEvent(new Event('blur', { bubbles: true }));
              el.dispatchEvent(new Event('keyup', { bubbles: true }));
              el.dispatchEvent(new Event('keydown', { bubbles: true }));
            }
          }, usedEmailSelector);
          
          // Wait a bit for validation
          await randomHumanDelay(targetPage, 500, 1000);
          
        } catch (e) {
          addDebugStep('Email Entry', 'error', `Human-like email entry failed: ${e.message}`);
          throw e;
        }
      }
      
      // Take screenshot after successful email entry
      try {
        await takeScreenshot('Email-Entered', targetPage);
      } catch (screenshotError) {
        addDebugStep('Email Entry', 'warning', `Screenshot failed: ${screenshotError.message}`);
      }
      
      // Click Next button
      addDebugStep('Email Entry', 'info', 'Clicking Next button...');
      
      // Try multiple selectors for the Next button
      const nextButtonSelectors = [
        'button[type="submit"]',
        'button[data-testid="primaryButton"]',
        '//button[contains(text(), "Next")]',
        'button[type="submit"][textContent="Next"]',
        'input[type="submit"][value="Next"]',
        'input[id="idSIButton9"]',
        'input[type="submit"]',
        '//input[@value="Next"]'
      ];
      
      let nextButtonClicked = false;
      for (const selector of nextButtonSelectors) {
        try {
          addDebugStep('Email Entry', 'info', `Trying Next button selector: ${selector}`);
          await targetPage.waitForSelector(selector, { timeout: 2000 });
          await targetPage.click(selector);
          addDebugStep('Email Entry', 'success', `Clicked Next button using selector: ${selector}`);
          nextButtonClicked = true;
          break;
        } catch (e) {
          addDebugStep('Email Entry', 'info', `Next button selector ${selector} failed: ${e.message}`);
        }
      }
      
      if (!nextButtonClicked) {
        throw new Error('Could not find or click Next button with any selector');
      }
      await takeScreenshot('Email-Next-Clicked', targetPage);
      
      // Wait for page transition and take immediate screenshot
      addDebugStep('Page Transition', 'info', 'Waiting for page transition to password step...');
      await randomHumanDelay(targetPage, 2000, 4000);
      
      // Take immediate screenshot to see what happened after Next click
      addDebugStep('Page Transition', 'info', 'Taking screenshot to see current page state...');
      await takeScreenshot('After-Email-Next-Click', targetPage);
      
      // Verify targetPage is still accessible
      try {
        await targetPage.evaluate(() => document.title);
        addDebugStep('Page Transition', 'success', 'Target page is still accessible after Next click');
      } catch (e) {
        addDebugStep('Page Transition', 'error', 'Target page is no longer accessible - may have closed or redirected');
        throw new Error('Target page became inaccessible after Next button click');
      }
      
    } catch (error) {
      addDebugStep('Email Entry', 'error', `Email entry failed: ${error.message}`);
      
      // Try to take screenshot even if there's an error
      try {
        await takeScreenshot('Email-Entry-Failed', targetPage);
      } catch (screenshotError) {
        addDebugStep('Email Entry', 'error', `Screenshot failed: ${screenshotError.message}`);
      }
      
      throw error;
    }
    
    // Step 5: Enter password
    addDebugStep('Password Entry', 'info', 'Entering password...');
    
    // Use the same targetPage reference
    let targetPage = popupPage || page;
    
    await targetPage.waitForSelector('input[name="passwd"], input[id="passwordEntry"]', { timeout: 10000 });
    await targetPage.type('input[name="passwd"], input[id="passwordEntry"]', generatedPassword, { delay: 100 });
    addDebugStep('Password Entry', 'success', 'Password entered successfully');
    await takeScreenshot('Password-Entered', targetPage);
    
    // Wait a bit for the button to become enabled after password entry
    addDebugStep('Password Entry', 'info', 'Waiting for Next button to become enabled...');
    await randomHumanDelay(targetPage, 1000, 2000);
    
    // Click Next button
    addDebugStep('Password Entry', 'info', 'Clicking Next button...');
    
    // First, let's debug what buttons are available on the page
    const allButtons = await targetPage.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('input[type="submit"], button'));
      return buttons.map(btn => ({
        tagName: btn.tagName,
        type: btn.type,
        id: btn.id,
        value: btn.value,
        textContent: btn.textContent,
        className: btn.className,
        visible: btn.offsetParent !== null,
        disabled: btn.disabled
      }));
    });
    
    addDebugStep('Password Entry', 'info', `Found ${allButtons.length} buttons on page: ${JSON.stringify(allButtons)}`);
    
    // Try multiple selectors for the Next button
    const passwordNextButtonSelectors = [
      'button[type="submit"]',
      'button[data-testid="primaryButton"]',
      '//button[contains(text(), "Next")]',
      'button[type="submit"][textContent="Next"]',
      'input[type="submit"][value="Next"]',
      'input[id="idSIButton9"]',
      'input[type="submit"]',
      '//input[@value="Next"]'
    ];
    
    let passwordNextButtonClicked = false;
    for (const selector of passwordNextButtonSelectors) {
      try {
        addDebugStep('Password Entry', 'info', `Trying Next button selector: ${selector}`);
        
        // Wait for selector and check if it's visible and enabled
        const button = await targetPage.waitForSelector(selector, { timeout: 2000 });
        const isVisible = await button.isIntersectingViewport();
        const isEnabled = await button.evaluate(el => !el.disabled);
        
        addDebugStep('Password Entry', 'info', `Button found - visible: ${isVisible}, enabled: ${isEnabled}`);
        
        if (isVisible && isEnabled) {
          await button.click();
          addDebugStep('Password Entry', 'success', `Clicked Next button using selector: ${selector}`);
          passwordNextButtonClicked = true;
          break;
        } else {
          addDebugStep('Password Entry', 'info', `Button found but not visible/enabled: ${selector}`);
        }
      } catch (e) {
        addDebugStep('Password Entry', 'info', `Next button selector ${selector} failed: ${e.message}`);
      }
    }
    
    if (!passwordNextButtonClicked) {
      throw new Error('Could not find or click Next button with any selector');
    }
    await takeScreenshot('Password-Next-Clicked', targetPage);
    
    // Wait for page transition after password Next click
    addDebugStep('Page Transition', 'info', 'Waiting for page transition after password Next click...');
    await randomHumanDelay(targetPage, 2000, 4000);
    
    // Take screenshot to see current page state
    addDebugStep('Page Transition', 'info', 'Taking screenshot to see current page after password Next click...');
    await takeScreenshot('After-Password-Next-Click', targetPage);
    
    // Check current page info
    const currentPageInfo = await targetPage.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        bodyText: document.body.textContent.substring(0, 500),
        allButtons: Array.from(document.querySelectorAll('button, a')).map(b => ({
          text: b.textContent?.trim() || '',
          tagName: b.tagName,
          className: b.className,
          visible: b.offsetParent !== null
        })).filter(b => b.text.length > 0).slice(0, 10)
      };
    });
    
    addDebugStep('Page Transition', 'info', `Current page after password Next: ${JSON.stringify(currentPageInfo)}`);
    
    // Check if we're on a different page/tab
    const allPages = await page.browser().pages();
    addDebugStep('Page Transition', 'info', `Found ${allPages.length} pages in browser`);
    
    let targetPageAfterRedirect = targetPage;
    for (let i = 0; i < allPages.length; i++) {
      const pageInfo = await allPages[i].evaluate(() => {
        return {
          title: document.title,
          url: window.location.href,
          bodyText: document.body.textContent.substring(0, 200)
        };
      });
      
      addDebugStep('Page Transition', 'info', `Page ${i}: ${JSON.stringify(pageInfo)}`);
      
      // Check if this page has account protection or skip buttons
      const hasSkipButtons = await allPages[i].evaluate(() => {
        const skipElements = document.querySelectorAll('*');
        for (let el of skipElements) {
          if (el.textContent && el.textContent.toLowerCase().includes('skip for now')) {
            return true;
          }
        }
        return false;
      });
      
      if (hasSkipButtons) {
        addDebugStep('Page Transition', 'success', `Found page with Skip buttons at index ${i}`);
        targetPageAfterRedirect = allPages[i];
        break;
      }
    }
    
    // Update targetPage to the correct page
    if (targetPageAfterRedirect) {
      targetPage = targetPageAfterRedirect;
      addDebugStep('Page Transition', 'info', `Using page: ${await targetPage.evaluate(() => window.location.href)}`);
      
      // Wait for the page to be fully loaded (Puppeteer equivalent)
      addDebugStep('Page Transition', 'info', 'Waiting for page to be fully loaded...');
      try {
        await targetPage.waitForFunction(() => document.readyState === 'complete', { timeout: 10000 });
        addDebugStep('Page Transition', 'success', 'Page loaded completely');
      } catch (e) {
        addDebugStep('Page Transition', 'warning', 'Page load timeout, continuing anyway');
      }
      
      // Wait a bit more for dynamic content
      await randomHumanDelay(targetPage, 2000, 3000);
      
      // Take a screenshot to see the current state
      await takeScreenshot('Page-After-Redirect', targetPage);
      
      // Smart page detection - determine which step to execute based on current page
      const pageInfo = await targetPage.evaluate(() => {
        return {
          title: document.title,
          url: window.location.href,
          hasYesNoButtons: document.querySelector('button[textContent="Yes"]') || document.querySelector('button[textContent="No"]'),
          hasSkipLink: document.getElementById('iShowSkip'),
          hasAcceptButton: document.querySelector('button[textContent="Accept"]'),
          allButtons: Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim()).filter(t => t && t.length > 0)
        };
      });
      
      addDebugStep('Page Detection', 'info', `Page analysis: ${JSON.stringify(pageInfo)}`);
      
      // Determine which step to execute based on page content
      if (pageInfo.title.includes('Stay signed in') || pageInfo.allButtons.includes('Yes') || pageInfo.allButtons.includes('No')) {
        addDebugStep('Page Detection', 'success', 'Detected Stay Signed In page - skipping to Stay Signed In step');
        // Skip directly to Stay Signed In step
        await handleStaySignedInStep(targetPage);
        return; // Exit early, don't continue with Account Protection steps
      } else if (pageInfo.title.includes('protect your account') || pageInfo.hasSkipLink) {
        addDebugStep('Page Detection', 'success', 'Detected Account Protection page - continuing with normal flow');
        // Continue with normal Account Protection flow
      } else if (pageInfo.hasAcceptButton) {
        addDebugStep('Page Detection', 'success', 'Detected App Access page - skipping to App Access step');
        // Skip directly to App Access step
        await handleAppAccessStep(targetPage);
        return; // Exit early
      } else if (pageInfo.title.includes('needs your permission') || pageInfo.title.includes('Let this app access')) {
        addDebugStep('Page Detection', 'success', 'Detected App Access permission page - skipping to App Access step');
        // Skip directly to App Access step
        await handleAppAccessStep(targetPage);
        return; // Exit early
      } else if (pageInfo.title.includes('Sign in to your account') || pageInfo.url.includes('login.microsoftonline.com')) {
        addDebugStep('Page Detection', 'success', 'Detected Microsoft OAuth sign-in page - this means authentication is complete');
        // This page indicates the authentication flow is complete, navigate to dashboard
        addDebugStep('Dashboard', 'info', 'Authentication complete, navigating to Kie.ai dashboard...');
        try {
          await targetPage.goto('https://kie.ai/dashboard', { waitUntil: 'networkidle2' });
          await takeScreenshot('Dashboard-Reached', targetPage);
          addDebugStep('Dashboard', 'success', 'Successfully reached Kie.ai dashboard');
          return { success: true, message: 'Account created successfully' };
        } catch (dashboardError) {
          addDebugStep('Dashboard', 'error', `Failed to navigate to dashboard: ${dashboardError.message}`);
          return { success: false, error: `Dashboard navigation failed: ${dashboardError.message}` };
        }
      } else {
        addDebugStep('Page Detection', 'warning', 'Unknown page detected - continuing with normal flow');
      }
    } else {
      addDebugStep('Page Transition', 'warning', 'No page with skip buttons found, using current page');
    }
    
    // Step 6: Handle "Save password?" popup - click "Never"
    try {
      addDebugStep('Password Save', 'info', 'Checking for password save popup...');
      await targetPage.waitForSelector('//button[contains(text(), "Never")] | //button[contains(text(), "Don\'t save")]', { timeout: 5000 });
      await targetPage.click('//button[contains(text(), "Never")] | //button[contains(text(), "Don\'t save")]');
      addDebugStep('Password Save', 'success', 'Clicked Never on password save popup');
      await takeScreenshot('Password-Save-Never', targetPage);
    } catch (error) {
      addDebugStep('Password Save', 'info', 'No password save popup appeared');
    }
    
    // Step 6.5: Handle repeated Account Protection pages - click skip multiple times if needed
    let accountProtectionAttempts = 0;
    const maxAccountProtectionAttempts = 3;
    
    while (accountProtectionAttempts < maxAccountProtectionAttempts) {
      // Check if we're still on Account Protection page
      const currentPageInfo = await targetPage.evaluate(() => {
        const title = document.title;
        const url = window.location.href;
        const hasSkipLink = document.querySelector('a[href*="Skip"], a:contains("Skip for now")') !== null;
        const skipLinkText = document.querySelector('a[href*="Skip"], a:contains("Skip for now")')?.textContent || '';
        
        return {
          title: title,
          url: url,
          hasSkipLink: hasSkipLink,
          skipLinkText: skipLinkText
        };
      });
      
      if (currentPageInfo.title.includes('protect your account') || currentPageInfo.hasSkipLink) {
        accountProtectionAttempts++;
        addDebugStep('Account Protection', 'info', `Account Protection page detected (attempt ${accountProtectionAttempts}/${maxAccountProtectionAttempts}) - ${currentPageInfo.skipLinkText}`);
        
        // Try to click the skip link again
        try {
          const skipClicked = await targetPage.evaluate(() => {
            const skipLinks = Array.from(document.querySelectorAll('a')).filter(a => 
              a.textContent.includes('Skip for now') || 
              a.textContent.includes('Skip') ||
              a.href.includes('Skip')
            );
            
            for (const link of skipLinks) {
              if (link.offsetParent !== null) {
                link.click();
                return true;
              }
            }
            return false;
          });
          
          if (skipClicked) {
            addDebugStep('Account Protection', 'success', `Clicked skip link (attempt ${accountProtectionAttempts})`);
            await takeScreenshot(`Account-Protection-Skip-Attempt-${accountProtectionAttempts}`, targetPage);
            
            // Wait for navigation
            try {
              await targetPage.waitForNavigation({ timeout: 5000 });
              addDebugStep('Account Protection', 'success', 'Navigation completed after skip click');
            } catch (navError) {
              addDebugStep('Account Protection', 'warning', `Navigation timeout: ${navError.message}`);
            }
          } else {
            addDebugStep('Account Protection', 'warning', 'No skip link found to click');
            break;
          }
        } catch (skipError) {
          addDebugStep('Account Protection', 'warning', `Skip link click failed: ${skipError.message}`);
          break;
        }
      } else {
        addDebugStep('Account Protection', 'info', 'No longer on Account Protection page - continuing');
        break;
      }
    }
    
    if (accountProtectionAttempts >= maxAccountProtectionAttempts) {
      addDebugStep('Account Protection', 'warning', `Reached maximum attempts (${maxAccountProtectionAttempts}) for Account Protection - continuing`);
    }
    
    // Step 7: Handle "Let's protect your account" - click "Skip for now"
    addDebugStep('Account Protection', 'info', 'Looking for account protection popup...');
    
    // Try multiple selectors for Skip buttons (prioritize anchor tags)
    const skipSelectors = [
      '//a[contains(text(), "Skip for now")]',
      '//a[@id="iShowSkip"]',
      '//a[contains(@class, "secondary-text")]',
      '//button[contains(text(), "Skip for now")]',
      '//a[contains(text(), "Skip")]',
      '//button[contains(text(), "Skip")]',
      '//a[contains(text(), "Not now")]',
      '//button[contains(text(), "Not now")]',
      '//a[contains(text(), "Later")]',
      '//button[contains(text(), "Later")]',
      '//a[contains(text(), "Continue")]',
      '//button[contains(text(), "Continue")]'
    ];
    
    let skipButtonClicked = false;
    
    // First try direct JavaScript approach
    try {
      addDebugStep('Account Protection', 'info', 'Trying direct JavaScript click on skip link...');
      
      // First check if the element exists
      const elementExists = await targetPage.evaluate(() => {
        const skipLink = document.getElementById('iShowSkip');
        return {
          exists: !!skipLink,
          visible: skipLink ? skipLink.offsetParent !== null : false,
          text: skipLink ? skipLink.textContent : '',
          href: skipLink ? skipLink.href : ''
        };
      });
      
      addDebugStep('Account Protection', 'info', `Skip link check: ${JSON.stringify(elementExists)}`);
      
      if (elementExists.exists && elementExists.visible) {
        // Try multiple click methods
        const clickMethods = [
          () => document.getElementById('iShowSkip').click(),
          () => document.getElementById('iShowSkip').dispatchEvent(new MouseEvent('click', { bubbles: true })),
          () => {
            const link = document.getElementById('iShowSkip');
            const event = new MouseEvent('mousedown', { bubbles: true });
            link.dispatchEvent(event);
            const event2 = new MouseEvent('mouseup', { bubbles: true });
            link.dispatchEvent(event2);
            const event3 = new MouseEvent('click', { bubbles: true });
            link.dispatchEvent(event3);
          }
        ];
        
        let clicked = false;
        for (let i = 0; i < clickMethods.length; i++) {
          try {
            await targetPage.evaluate(clickMethods[i]);
            addDebugStep('Account Protection', 'success', `Clicked skip link using method ${i + 1}`);
            clicked = true;
            break;
          } catch (e) {
            addDebugStep('Account Protection', 'info', `Click method ${i + 1} failed: ${e.message}`);
          }
        }
        
        if (clicked) {
          await takeScreenshot('Account-Protection-Skipped', targetPage);
          skipButtonClicked = true;
          
          // Wait for page navigation after clicking skip
          addDebugStep('Account Protection', 'info', 'Waiting for page navigation after skip click...');
          try {
            await targetPage.waitForNavigation({ timeout: 10000 });
            addDebugStep('Account Protection', 'success', 'Page navigation completed after skip');
            await takeScreenshot('After-Skip-Navigation', targetPage);
          } catch (navError) {
            addDebugStep('Account Protection', 'warning', `Navigation timeout after skip: ${navError.message}`);
            // Continue anyway, the page might have already navigated
          }
        }
      } else {
        addDebugStep('Account Protection', 'warning', `Skip link not found or not visible: exists=${elementExists.exists}, visible=${elementExists.visible}`);
      }
    } catch (e) {
      addDebugStep('Account Protection', 'info', `JavaScript click failed: ${e.message}`);
    }
    
    // If JavaScript approach failed, try selectors
    if (!skipButtonClicked) {
      for (const selector of skipSelectors) {
        try {
          addDebugStep('Account Protection', 'info', `Trying skip selector: ${selector}`);
          await targetPage.waitForSelector(selector, { timeout: 2000 });
          await targetPage.click(selector);
          addDebugStep('Account Protection', 'success', `Clicked skip button using selector: ${selector}`);
          await takeScreenshot('Account-Protection-Skipped', targetPage);
          skipButtonClicked = true;
          
          // Wait for page navigation after clicking skip
          addDebugStep('Account Protection', 'info', 'Waiting for page navigation after skip click...');
          try {
            await targetPage.waitForNavigation({ timeout: 10000 });
            addDebugStep('Account Protection', 'success', 'Page navigation completed after skip');
            await takeScreenshot('After-Skip-Navigation', targetPage);
          } catch (navError) {
            addDebugStep('Account Protection', 'warning', `Navigation timeout after skip: ${navError.message}`);
            // Continue anyway, the page might have already navigated
          }
          
          break;
        } catch (e) {
          addDebugStep('Account Protection', 'info', `Skip selector ${selector} failed: ${e.message}`);
        }
      }
    }
    
    if (!skipButtonClicked) {
      addDebugStep('Account Protection', 'warning', 'No skip button found - continuing without skipping');
      await takeScreenshot('No-Skip-Button-Found', targetPage);
    }
    
    // Step 8: Handle "Sign in faster" popup - click "Skip for now"
    addDebugStep('Sign-in Faster', 'info', 'Looking for sign-in faster popup...');
    
    // Check for stop flag before starting
    if (global.globalScraperStopped) {
      addDebugStep('Sign-in Faster', 'info', 'Scraper stopped by user');
      return { success: false, error: 'Scraper stopped by user' };
    }
    
    let signinFasterSkipped = false;
    for (const selector of skipSelectors) {
      // Check for stop flag in each iteration
      if (global.globalScraperStopped) {
        addDebugStep('Sign-in Faster', 'info', 'Scraper stopped by user');
        return { success: false, error: 'Scraper stopped by user' };
      }
      
      try {
        addDebugStep('Sign-in Faster', 'info', `Trying signin faster selector: ${selector}`);
        await targetPage.waitForSelector(selector, { timeout: 3000 });
        await targetPage.click(selector);
        addDebugStep('Sign-in Faster', 'success', `Clicked signin faster button using selector: ${selector}`);
        await takeScreenshot('Signin-Faster-Skipped', targetPage);
        signinFasterSkipped = true;
        break;
      } catch (e) {
        addDebugStep('Sign-in Faster', 'info', `Signin faster selector ${selector} failed: ${e.message}`);
      }
    }
    
    if (!signinFasterSkipped) {
      addDebugStep('Sign-in Faster', 'warning', 'No signin faster skip button found - continuing');
    }
    
    // Step 9: Handle "Stay signed in?" - click "Yes"
    addDebugStep('Stay Signed In', 'info', 'Looking for stay signed in popup...');
    
    // Check for stop flag before starting
    if (global.globalScraperStopped) {
      addDebugStep('Stay Signed In', 'info', 'Scraper stopped by user');
      return { success: false, error: 'Scraper stopped by user' };
    }
    
    // Try multiple selectors for Yes/Next button (Microsoft uses "Next" for Yes)
    const yesSelectors = [
      '//button[contains(text(), "Yes")]',
      '//button[contains(text(), "Next")]',
      '//button[@data-testid="primaryButton"]',
      '//button[contains(@class, "fui-Button") and contains(@class, "___jsyn8q0")]',
      '//button[contains(text(), "Yes, keep me signed in")]',
      '//button[contains(text(), "Keep me signed in")]',
      '//button[contains(text(), "Stay signed in")]',
      '//input[@type="submit" and @value="Yes"]',
      '//button[@type="submit"]',
      '//button[contains(@class, "primary")]',
      '//button[contains(@class, "submit")]'
    ];
    
    let yesButtonClicked = false;
    
    // First try direct JavaScript approach for Yes/Next button
    try {
      addDebugStep('Stay Signed In', 'info', 'Trying direct JavaScript click on Yes/Next button...');
      
      // Check if the button exists
      const buttonExists = await targetPage.evaluate(() => {
        const nextButton = document.querySelector('button[data-testid="primaryButton"]');
        const yesButton = document.querySelector('button[contains(text(), "Yes")]');
        const anyNextButton = document.querySelector('button[contains(text(), "Next")]');
        
        return {
          primaryButton: !!nextButton,
          yesButton: !!yesButton,
          nextButton: !!anyNextButton,
          allButtons: Array.from(document.querySelectorAll('button')).map(b => ({
            text: b.textContent?.trim() || '',
            testId: b.getAttribute('data-testid'),
            type: b.type,
            className: b.className,
            visible: b.offsetParent !== null
          })).filter(b => b.text.length > 0).slice(0, 5)
        };
      });
      
      addDebugStep('Stay Signed In', 'info', `Button check: ${JSON.stringify(buttonExists)}`);
      
      // Try to click the primary button
      const clicked = await targetPage.evaluate(() => {
        const primaryButton = document.querySelector('button[data-testid="primaryButton"]');
        if (primaryButton && primaryButton.offsetParent !== null) {
          primaryButton.click();
          return true;
        }
        
        // Fallback: look for any button with "Next" text
        const nextButtons = Array.from(document.querySelectorAll('button'));
        const nextButton = nextButtons.find(b => b.textContent?.trim() === 'Next' && b.offsetParent !== null);
        if (nextButton) {
          nextButton.click();
          return true;
        }
        
        return false;
      });
      
      if (clicked) {
        addDebugStep('Stay Signed In', 'success', 'Clicked Yes/Next button using JavaScript');
        await takeScreenshot('Stay-Signed-In-Yes', targetPage);
        yesButtonClicked = true;
      }
    } catch (e) {
      addDebugStep('Stay Signed In', 'info', `JavaScript click failed: ${e.message}`);
    }
    
    // If JavaScript approach failed, try selectors
    if (!yesButtonClicked) {
      for (const selector of yesSelectors) {
        try {
          addDebugStep('Stay Signed In', 'info', `Trying Yes selector: ${selector}`);
          await targetPage.waitForSelector(selector, { timeout: 2000 });
          await targetPage.click(selector);
          addDebugStep('Stay Signed In', 'success', `Clicked Yes button using selector: ${selector}`);
          await takeScreenshot('Stay-Signed-In-Yes', targetPage);
          yesButtonClicked = true;
          break;
        } catch (e) {
          addDebugStep('Stay Signed In', 'info', `Yes selector ${selector} failed: ${e.message}`);
        }
      }
    }
    
    if (!yesButtonClicked) {
      addDebugStep('Stay Signed In', 'warning', 'No Yes button found - continuing without clicking');
      await takeScreenshot('No-Yes-Button-Found', targetPage);
    }
    
    // Step 10: Handle "Let this app access your info?" - scroll and click "Accept"
    addDebugStep('App Access', 'info', 'Looking for app access consent popup...');
    
    // Check for stop flag before starting
    if (global.globalScraperStopped) {
      addDebugStep('App Access', 'info', 'Scraper stopped by user');
      return { success: false, error: 'Scraper stopped by user' };
    }
    
    await targetPage.waitForSelector('//button[contains(text(), "Accept")]', { timeout: 10000 });
    
    // Scroll down to make sure Accept button is visible
    await targetPage.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await sleep(1000);
    
    await targetPage.click('//button[contains(text(), "Accept")]');
    addDebugStep('App Access', 'success', 'Clicked Accept on app access consent');
    await takeScreenshot('App-Access-Accepted', targetPage);
    
    // Step 11: Handle "I am human" checkbox
    addDebugStep('Human Verification', 'info', 'Looking for I am human checkbox...');
    await targetPage.waitForSelector('//input[@type="checkbox" and contains(text(), "I am human")] | //label[contains(text(), "I am human")]', { timeout: 10000 });
    await targetPage.click('//input[@type="checkbox" and contains(text(), "I am human")] | //label[contains(text(), "I am human")]');
    addDebugStep('Human Verification', 'success', 'Clicked I am human checkbox');
    await takeScreenshot('Human-Verification-Checked', targetPage);
    
    // Step 12: Handle CAPTCHA challenges
    let captchaAttempts = 0;
    const maxCaptchaAttempts = 3;
    
    while (captchaAttempts < maxCaptchaAttempts) {
      try {
        addDebugStep('CAPTCHA', 'info', `CAPTCHA attempt ${captchaAttempts + 1}/${maxCaptchaAttempts}`);
        
        // Check if CAPTCHA challenge is present
        const captchaPresent = await targetPage.$('text="Tap on the item that you can turn on and off"') !== null;
        
        if (captchaPresent) {
          addDebugStep('CAPTCHA', 'info', 'CAPTCHA challenge detected, solving with AI...');
          
          const solved = await solveCaptchaWithAI(targetPage);
          if (solved) {
            // Click Next button after solving CAPTCHA
            await targetPage.click('//button[contains(text(), "Next")] | //button[contains(text(), "Continue")]');
            addDebugStep('CAPTCHA', 'success', 'CAPTCHA solved and Next clicked');
            await takeScreenshot('CAPTCHA-Solved', targetPage);
            break;
          } else {
            captchaAttempts++;
            if (captchaAttempts < maxCaptchaAttempts) {
              addDebugStep('CAPTCHA', 'warning', 'CAPTCHA solving failed, retrying...');
              await sleep(2000);
            }
          }
        } else {
          addDebugStep('CAPTCHA', 'info', 'No CAPTCHA challenge detected');
          break;
        }
      } catch (error) {
        addDebugStep('CAPTCHA', 'error', `CAPTCHA handling error: ${error.message}`);
        captchaAttempts++;
        if (captchaAttempts < maxCaptchaAttempts) {
          await sleep(2000);
        }
      }
    }
    
    if (captchaAttempts >= maxCaptchaAttempts) {
      throw new Error('Failed to solve CAPTCHA after maximum attempts');
    }
    
    // Step 13: Final "I am human" checkbox
    try {
      addDebugStep('Final Verification', 'info', 'Looking for final I am human checkbox...');
      await targetPage.waitForSelector('//input[@type="checkbox" and contains(text(), "I am human")] | //label[contains(text(), "I am human")]', { timeout: 5000 });
      await targetPage.click('//input[@type="checkbox" and contains(text(), "I am human")] | //label[contains(text(), "I am human")]');
      addDebugStep('Final Verification', 'success', 'Clicked final I am human checkbox');
      await takeScreenshot('Final-Human-Verification', targetPage);
    } catch (error) {
      addDebugStep('Final Verification', 'info', 'No final human verification needed');
    }
    
    // Step 14: Wait for dashboard
    addDebugStep('Dashboard', 'info', 'Waiting for dashboard...');
    
    await targetPage.waitForFunction(() => {
      const url = window.location.href;
      return url.includes('kie.ai') && (url.includes('dashboard') || url.includes('home') || url.includes('console') || 
             document.querySelector('[class*="dashboard"], [class*="welcome"], [class*="console"]') !== null);
    }, { timeout: 30000 });
    
    addDebugStep('Dashboard', 'success', 'Successfully reached Kie.ai dashboard');
    await takeScreenshot('Dashboard-Reached', targetPage);
    
    addDebugStep('Account Creation', 'success', '✅ Kie.ai account creation process completed successfully!');
    addDebugStep('Account Creation', 'info', `📧 Email: ${email}`);
    addDebugStep('Account Creation', 'info', `🔑 Password: ${generatedPassword}`);
    
    return {
      success: true,
      email: email,
      password: generatedPassword,
      message: 'Kie.ai account creation process completed successfully!'
    };
    
  } catch (error) {
    addDebugStep('Account Creation', 'error', '❌ Kie.ai account creation failed', null, error.message);
    
    // Add more detailed error logging
    console.error('Detailed error:', error);
    console.error('Error stack:', error.stack);
    
    // Check if page was created
    if (!page) {
      addDebugStep('Account Creation', 'error', 'Page was never created - browser launch or page creation failed');
    }
    
    // Check if browser was created
    if (!browser) {
      addDebugStep('Account Creation', 'error', 'Browser was never created - puppeteer launch failed');
    }
    
    // Return a more user-friendly error message for Railway
    if (error.message.includes('Failed to launch the browser process')) {
      throw new Error('Browser launch failed. This may be due to server environment limitations. Please try again or contact support.');
    } else if (error.message.includes('Missing X server')) {
      throw new Error('Display server not available. This is a server environment limitation.');
    } else if (error.message.includes('page is not defined')) {
      throw new Error('Page creation failed. Browser may not have launched properly. Please try again.');
    } else {
      throw new Error(`Kie.ai account creation failed: ${error.message}`);
    }
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (error) {
        console.error('Error closing browser:', error);
      }
    }
  }
}

module.exports = { createKieAccount, createKieAccountAI };
