const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

let globalIO = null;
let aiPaused = false;
let aiStopped = false;
let currentGuidance = null;
let guidancePromise = null;
let guidanceResolve = null;

// Conversation history for GPT-5 memory
let conversationHistory = [];

// Initialize guidance promise
function initializeGuidance() {
    guidancePromise = new Promise((resolve) => {
        guidanceResolve = resolve;
    });
}

// Wait for guidance from user
async function waitForGuidance() {
    if (aiPaused || aiStopped) {
        addDebugStep('AI Control', 'info', 'Waiting for user guidance...');
        return await guidancePromise;
    }
    return null;
}

// Set guidance from user
function setGuidance(guidance) {
    currentGuidance = guidance;
    
    // Add user guidance to conversation history
    addToConversationHistory('user', guidance, {
        timestamp: new Date().toISOString(),
        type: 'guidance'
    });
    
    if (guidanceResolve) {
        guidanceResolve(guidance);
        initializeGuidance(); // Reset for next guidance
    }
    addDebugStep('AI Control', 'info', `Received guidance: "${guidance}"`);
}

// Clear guidance
function clearGuidance() {
    currentGuidance = null;
    if (guidanceResolve) {
        guidanceResolve(null);
        initializeGuidance();
    }
}

// Pause AI
function pauseAI() {
    aiPaused = true;
    addDebugStep('AI Control', 'info', 'AI paused by user');
    
    // Emit status update to UI
    if (globalIO) {
        globalIO.emit('ai-status', { status: 'paused' });
    }
}

// Resume AI
function resumeAI() {
    aiPaused = false;
    addDebugStep('AI Control', 'info', 'AI resumed by user');
    
    // Emit status update to UI
    if (globalIO) {
        globalIO.emit('ai-status', { status: 'running' });
    }
}

// Stop AI
function stopAI() {
    aiStopped = true;
    aiPaused = false;
    addDebugStep('AI Control', 'info', 'AI stopped by user');
    
    // Emit status update to UI
    if (globalIO) {
        globalIO.emit('ai-status', { status: 'stopped' });
    }
}

// Take manual screenshot
async function takeManualScreenshot(page) {
    try {
        // Use global page if no page provided
        const targetPage = page || globalPage;
        
        if (!targetPage) {
            console.log('No page available for manual screenshot');
            return null;
        }
        
        const screenshot = await takeScreenshot('Manual-Screenshot', targetPage);
        if (globalIO && screenshot) {
            globalIO.emit('screenshot', { screenshot });
        }
        return screenshot;
    } catch (error) {
        addDebugStep('Screenshot', 'error', `Manual screenshot failed: ${error.message}`);
        return null;
    }
}

// Global page reference for manual screenshots
let globalPage = null;

// Set global page reference
function setGlobalPage(page) {
    globalPage = page;
}

// Add message to conversation history
function addToConversationHistory(role, content, context = {}) {
    conversationHistory.push({
        role: role,
        content: content,
        context: context,
        timestamp: new Date().toISOString()
    });
    
    // Keep only last 20 messages to avoid token limits
    if (conversationHistory.length > 20) {
        conversationHistory = conversationHistory.slice(-20);
    }
}

// Get conversation history for AI
function getConversationHistory() {
    return conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
    }));
}

// Clear conversation history
function clearConversationHistory() {
    conversationHistory = [];
}

// Enhanced AI decision making with guidance integration
async function getAIDecision(page, context, step, email = '', password = '') {
    try {
        // Check if AI is paused and wait for guidance
        if (aiPaused) {
            const guidance = await waitForGuidance();
            if (guidance) {
                return {
                    action: 'guidance',
                    target: 'user_guidance',
                    coordinates: { x: 0, y: 0 },
                    text: guidance,
                    reasoning: `Following user guidance: ${guidance}`,
                    nextStep: 'Execute user guidance'
                };
            }
        }

        // Check if AI is stopped
        if (aiStopped) {
            return {
                action: 'stop',
                target: 'ai_stopped',
                coordinates: { x: 0, y: 0 },
                text: 'AI stopped by user',
                reasoning: 'User requested AI to stop',
                nextStep: 'End process'
            };
        }

        // Take screenshot for AI analysis
        const screenshot = await takeScreenshot(`AI-Decision-${step}`, page);
        
        // Get page information
        const pageInfo = await page.evaluate(() => {
            return {
                title: document.title,
                url: window.location.href,
                bodyText: document.body.innerText.substring(0, 1000),
                buttons: Array.from(document.querySelectorAll('button, a, [role="button"]')).map(btn => ({
                    text: btn.innerText.trim(),
                    tagName: btn.tagName,
                    className: btn.className,
                    id: btn.id
                })).filter(btn => btn.text.length > 0),
                inputs: Array.from(document.querySelectorAll('input')).map(input => ({
                    type: input.type,
                    name: input.name,
                    id: input.id,
                    placeholder: input.placeholder
                }))
            };
        });

        // Enhanced system prompt with collaborative features
        const systemPrompt = `You are an AI assistant helping to create a Kie.ai account through a collaborative process. 

SCENARIO: Kie.ai Account Creation
CURRENT STEP: ${step}
EMAIL: ${email}
PASSWORD: ${password}

PAGE INFORMATION:
- Title: ${pageInfo.title}
- URL: ${pageInfo.url}
- Available buttons: ${JSON.stringify(pageInfo.buttons, null, 2)}
- Available inputs: ${JSON.stringify(pageInfo.inputs, null, 2)}

COLLABORATIVE MODE: You are working with a human who can provide real-time guidance. If you're unsure about what to do, you can pause and wait for guidance.

STEP-BY-STEP INSTRUCTIONS:
1. If you see "Get Started" button, click it immediately
2. If you see a sign-in popup, look for "Sign in with Microsoft" or "Sign in with Google"
3. If you see email field (loginfmt, i0116, or type="email"), enter the email: ${email}
4. If you see password field, enter the password: ${password}
5. If you see "Next", "Continue", "Sign in", "Login" buttons, click them
6. If you see popups asking to save password, click "Never" or "Skip"
7. If you see "Stay signed in" popup, click "Yes"
8. If you see "Let this app access your info" popup, click "Accept"
9. If you see "I am human" checkbox, click it
10. If you see CAPTCHA, analyze the image and click the correct option
11. If you reach the dashboard, you're done!

IMPORTANT:
- Look for the most obvious and relevant button/field to click
- If multiple options exist, choose the most likely one
- If you're unsure, pause and wait for human guidance
- Always provide exact coordinates for clicking
- Be specific about what you're looking for

Return your response as JSON with this exact format:
{
    "action": "click|type|wait|pause|success|error",
    "target": "button_text_or_selector",
    "coordinates": {"x": number, "y": number},
    "text": "text_to_type_if_typing",
    "reasoning": "why_you_chose_this_action",
    "nextStep": "what_should_happen_next"
}`;

        const userPrompt = `Analyze this screenshot and page information. Tell me exactly what to do next. Look for:
- "Get Started" button
- Sign-in popup or buttons
- Email input fields
- Password input fields
- "Next", "Continue", "Sign in" buttons
- Any popups or modals
- CAPTCHA challenges

CONVERSATION HISTORY:
${conversationHistory.length > 0 ? 'Previous instructions and context:\n' + conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n') : 'No previous conversation history.'}

Provide exact coordinates and clear instructions.`;

        // Call OpenAI API - Using GPT-5 for decision making/guiding
        // (GPT-4o is used for visual analysis in other parts of the system)
        const { default: fetch } = await import('node-fetch');
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-5',  // Using GPT-5 for guiding/decision making
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt
                    },
                    ...getConversationHistory(), // Include conversation history
                    {
                        role: 'user',
                        content: userPrompt
                    }
                ],
                max_tokens: 500,
                temperature: 0.3
            })
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const aiResponse = data.choices[0].message.content.trim();
        
        // Log AI response
        addDebugStep('AI Decision', 'info', `AI Response: ${aiResponse}`);
        
        // Add AI decision to conversation history
        addToConversationHistory('assistant', aiResponse, {
            step: step,
            pageTitle: pageInfo.title,
            pageUrl: pageInfo.url
        });
        
        if (globalIO) {
            globalIO.emit('log', {
                step: 'AI Decision',
                message: `AI Response: ${aiResponse}`,
                type: 'info',
                timestamp: new Date().toLocaleString(),
                screenshot: screenshot
            });
        }

        // Parse AI response
        let aiDecision;
        try {
            aiDecision = JSON.parse(aiResponse);
        } catch (parseError) {
            // If JSON parsing fails, create a fallback decision
            aiDecision = {
                action: 'wait',
                target: 'parse_error',
                coordinates: { x: 0, y: 0 },
                text: '',
                reasoning: `Failed to parse AI response: ${aiResponse}`,
                nextStep: 'Wait for better response'
            };
        }

        return aiDecision;

    } catch (error) {
        addDebugStep('AI Decision', 'error', `AI decision failed: ${error.message}`);
        
        if (globalIO) {
            globalIO.emit('log', {
                step: 'AI Decision',
                message: `AI decision failed: ${error.message}`,
                type: 'error',
                timestamp: new Date().toLocaleString()
            });
        }

        return {
            action: 'error',
            target: 'ai_error',
            coordinates: { x: 0, y: 0 },
            text: '',
            reasoning: `AI decision failed: ${error.message}`,
            nextStep: 'Fallback to manual process'
        };
    }
}

// Enhanced collaborative account creation
async function createKieAccountCollaborative(io, email, password) {
    globalIO = io;
    aiPaused = false;
    aiStopped = false;
    currentGuidance = null;
    
    // Clear conversation history for new session
    clearConversationHistory();
    
    initializeGuidance();

    let browser;
    let page;

    try {
        addDebugStep('Initialization', 'info', 'Starting collaborative AI scraper...');
        
        // Emit AI status
        if (globalIO) {
            globalIO.emit('ai-status', { status: 'running' });
        }

        // Launch browser
        browser = await puppeteer.launch({
            headless: true,
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
        
        // Set global page reference for manual screenshots
        setGlobalPage(page);

        // Navigate to Kie.ai
        addDebugStep('Navigation', 'info', 'Navigating to Kie.ai...');
        await page.goto('https://kie.ai/', { waitUntil: 'networkidle2', timeout: 30000 });
        
        const screenshot = await takeScreenshot('Initial-Page', page);
        if (globalIO) {
            globalIO.emit('screenshot', { screenshot });
        }

        // AI-powered decision making loop
        let step = 1;
        let maxSteps = 20;
        let currentContext = 'initial';

        while (step <= maxSteps && !aiStopped) {
            addDebugStep('AI Loop', 'info', `Step ${step}: Getting AI decision...`);
            
            // Get AI decision
            const aiDecision = await getAIDecision(page, currentContext, step, email, password);
            
            addDebugStep('AI Decision', 'info', `Action: ${aiDecision.action}, Target: ${aiDecision.target}`);
            
            if (globalIO) {
                globalIO.emit('log', {
                    step: 'AI Decision',
                    message: `Action: ${aiDecision.action}, Target: ${aiDecision.target}, Reasoning: ${aiDecision.reasoning}`,
                    type: 'info',
                    timestamp: new Date().toLocaleString()
                });
            }

            // Execute AI decision
            try {
                switch (aiDecision.action) {
                    case 'click':
                        await executeClick(page, aiDecision, step);
                        // Add action result to conversation history
                        addToConversationHistory('assistant', `Clicked: ${aiDecision.target} at coordinates (${aiDecision.coordinates.x}, ${aiDecision.coordinates.y})`, {
                            action: 'click',
                            target: aiDecision.target,
                            coordinates: aiDecision.coordinates
                        });
                        break;
                    case 'type':
                        await executeType(page, aiDecision, step);
                        // Add action result to conversation history
                        addToConversationHistory('assistant', `Typed: "${aiDecision.text}" into ${aiDecision.target}`, {
                            action: 'type',
                            target: aiDecision.target,
                            text: aiDecision.text
                        });
                        break;
                    case 'wait':
                        await executeWait(page, aiDecision, step);
                        // Add action result to conversation history
                        addToConversationHistory('assistant', `Waited: ${aiDecision.reasoning}`, {
                            action: 'wait',
                            reasoning: aiDecision.reasoning
                        });
                        break;
                    case 'pause':
                        addDebugStep('AI Control', 'info', 'AI paused - waiting for guidance');
                        addToConversationHistory('assistant', 'Paused for user guidance', {
                            action: 'pause'
                        });
                        if (globalIO) {
                            globalIO.emit('ai-status', { status: 'paused' });
                        }
                        await waitForGuidance();
                        break;
                    case 'success':
                        addDebugStep('Success', 'success', aiDecision.reasoning);
                        addToConversationHistory('assistant', `Success: ${aiDecision.reasoning}`, {
                            action: 'success',
                            reasoning: aiDecision.reasoning
                        });
                        if (globalIO) {
                            globalIO.emit('ai-status', { status: 'waiting' });
                        }
                        return {
                            success: true,
                            email: email,
                            password: password,
                            message: 'Account created successfully with collaborative AI assistance!'
                        };
                    case 'error':
                        addToConversationHistory('assistant', `Error: ${aiDecision.reasoning}`, {
                            action: 'error',
                            reasoning: aiDecision.reasoning
                        });
                        throw new Error(aiDecision.reasoning);
                    case 'guidance':
                        addDebugStep('Guidance', 'info', `Following user guidance: ${aiDecision.text}`);
                        await executeGuidance(page, aiDecision, step);
                        // Add action result to conversation history
                        addToConversationHistory('assistant', `Executed guidance: ${aiDecision.text}`, {
                            action: 'guidance',
                            guidance: aiDecision.text
                        });
                        break;
                    case 'stop':
                        addDebugStep('AI Control', 'info', 'AI stopped by user');
                        addToConversationHistory('assistant', 'Stopped by user', {
                            action: 'stop'
                        });
                        return {
                            success: false,
                            email: email,
                            password: password,
                            message: 'Process stopped by user'
                        };
                    default:
                        addDebugStep('AI Decision', 'warning', `Unknown action: ${aiDecision.action}`);
                        addToConversationHistory('assistant', `Unknown action: ${aiDecision.action}`, {
                            action: 'unknown',
                            actionType: aiDecision.action
                        });
                }
            } catch (actionError) {
                addDebugStep('Action Error', 'error', `Action failed: ${actionError.message}`);
                
                if (globalIO) {
                    globalIO.emit('log', {
                        step: 'Action Error',
                        message: `Action failed: ${actionError.message}`,
                        type: 'error',
                        timestamp: new Date().toLocaleString()
                    });
                }
            }

            // Take screenshot after each action
            const actionScreenshot = await takeScreenshot(`Step-${step}-After-Action`, page);
            if (globalIO && actionScreenshot) {
                globalIO.emit('screenshot', { screenshot: actionScreenshot });
            }

            step++;
            await sleep(2000); // Wait between steps
        }

        if (step > maxSteps) {
            throw new Error('Maximum steps reached - process may be stuck');
        }

        return {
            success: false,
            email: email,
            password: password,
            message: 'Process completed but account creation status unknown'
        };

    } catch (error) {
        addDebugStep('Error', 'error', `Collaborative scraper failed: ${error.message}`);
        
        if (globalIO) {
            globalIO.emit('log', {
                step: 'Error',
                message: `Collaborative scraper failed: ${error.message}`,
                type: 'error',
                timestamp: new Date().toLocaleString()
            });
        }

        return {
            success: false,
            email: email,
            password: password,
            message: `Account creation failed: ${error.message}`
        };
    } finally {
        if (browser) {
            await browser.close();
        }
        
        // Clear global page reference
        globalPage = null;
        
        if (globalIO) {
            globalIO.emit('ai-status', { status: 'stopped' });
        }
    }
}

// Execute click action
async function executeClick(page, decision, step) {
    try {
        const { target, coordinates } = decision;
        
        if (coordinates && coordinates.x > 0 && coordinates.y > 0) {
            // Click at specific coordinates
            await page.mouse.click(coordinates.x, coordinates.y);
            addDebugStep('Click Action', 'success', `Clicked at coordinates (${coordinates.x}, ${coordinates.y})`);
        } else {
            // Try to find and click element
            const element = await page.$(target) || await page.$x(`//button[contains(text(), "${target}")]`) || await page.$x(`//a[contains(text(), "${target}")]`);
            
            if (element) {
                if (Array.isArray(element)) {
                    await element[0].click();
                } else {
                    await element.click();
                }
                addDebugStep('Click Action', 'success', `Clicked element: ${target}`);
            } else {
                throw new Error(`Element not found: ${target}`);
            }
        }
    } catch (error) {
        addDebugStep('Click Action', 'error', `Click failed: ${error.message}`);
        throw error;
    }
}

// Execute type action
async function executeType(page, decision, step) {
    try {
        const { target, text } = decision;
        
        const element = await page.$(target) || await page.$x(`//input[@name="${target}"]`) || await page.$x(`//input[@id="${target}"]`);
        
        if (element) {
            const inputElement = Array.isArray(element) ? element[0] : element;
            await inputElement.click();
            await inputElement.type(text, { delay: 100 });
            addDebugStep('Type Action', 'success', `Typed "${text}" into ${target}`);
        } else {
            throw new Error(`Input element not found: ${target}`);
        }
    } catch (error) {
        addDebugStep('Type Action', 'error', `Type failed: ${error.message}`);
        throw error;
    }
}

// Execute wait action
async function executeWait(page, decision, step) {
    try {
        const waitTime = 3000; // Default 3 seconds
        addDebugStep('Wait Action', 'info', `Waiting ${waitTime}ms...`);
        await sleep(waitTime);
    } catch (error) {
        addDebugStep('Wait Action', 'error', `Wait failed: ${error.message}`);
        throw error;
    }
}

// Execute user guidance
async function executeGuidance(page, decision, step) {
    try {
        const guidance = decision.text;
        addDebugStep('Guidance Execution', 'info', `Executing guidance: ${guidance}`);
        
        // Enhanced guidance parsing for better element detection
        if (guidance.toLowerCase().includes('click')) {
            // Try multiple approaches to find the element
            let element = null;
            let foundMethod = '';
            
            // Method 1: Look for specific button text
            const buttonMatch = guidance.match(/click\s+(?:the\s+)?(.+?)(?:\s+button)?/i);
            if (buttonMatch) {
                const buttonText = buttonMatch[1];
                console.log(`Looking for button with text: "${buttonText}"`);
                
                // Try different XPath patterns
                const patterns = [
                    `//button[contains(text(), "${buttonText}")]`,
                    `//a[contains(text(), "${buttonText}")]`,
                    `//*[contains(text(), "${buttonText}")]`,
                    `//button[contains(., "${buttonText}")]`,
                    `//*[contains(., "${buttonText}")]`
                ];
                
                for (const pattern of patterns) {
                    try {
                        element = await page.$x(pattern);
                        if (element && element.length > 0) {
                            foundMethod = pattern;
                            break;
                        }
                    } catch (e) {
                        // Continue to next pattern
                    }
                }
            }
            
            // Method 2: Look for HTML elements in guidance
            const htmlMatch = guidance.match(/<[^>]+>([^<]+)<\/[^>]+>/);
            if (htmlMatch && !element) {
                const innerText = htmlMatch[1];
                console.log(`Looking for element with inner text: "${innerText}"`);
                
                const patterns = [
                    `//*[contains(text(), "${innerText}")]`,
                    `//button[contains(text(), "${innerText}")]`,
                    `//a[contains(text(), "${innerText}")]`
                ];
                
                for (const pattern of patterns) {
                    try {
                        element = await page.$x(pattern);
                        if (element && element.length > 0) {
                            foundMethod = pattern;
                            break;
                        }
                    } catch (e) {
                        // Continue to next pattern
                    }
                }
            }
            
            if (element && element.length > 0) {
                await element[0].click();
                addDebugStep('Guidance Execution', 'success', `Clicked element using: ${foundMethod}`);
            } else {
                // Get page content for debugging
                const pageContent = await page.evaluate(() => {
                    return {
                        title: document.title,
                        url: window.location.href,
                        buttons: Array.from(document.querySelectorAll('button, a')).map(btn => ({
                            text: btn.innerText.trim(),
                            tagName: btn.tagName,
                            className: btn.className
                        })).filter(btn => btn.text.length > 0)
                    };
                });
                
                addDebugStep('Guidance Execution', 'error', `Could not find element. Available buttons: ${JSON.stringify(pageContent.buttons)}`);
                throw new Error(`Could not find element. Page title: ${pageContent.title}`);
            }
        } else if (guidance.toLowerCase().includes('type')) {
            // Extract text to type from guidance
            const typeMatch = guidance.match(/type\s+(.+)/i);
            if (typeMatch) {
                const textToType = typeMatch[1];
                const input = await page.$('input[type="email"], input[type="password"], input[type="text"]');
                if (input) {
                    await input.click();
                    await input.type(textToType, { delay: 100 });
                    addDebugStep('Guidance Execution', 'success', `Typed: ${textToType}`);
                } else {
                    throw new Error('No input field found for typing');
                }
            }
        }
    } catch (error) {
        addDebugStep('Guidance Execution', 'error', `Guidance execution failed: ${error.message}`);
        throw error;
    }
}

// Take screenshot function
async function takeScreenshot(name, page) {
    try {
        // Check if page is still accessible
        try {
            await page.evaluate(() => document.title);
        } catch (e) {
            addDebugStep('Screenshot', 'warning', `Page not accessible for screenshot ${name}: ${e.message}`);
            return null;
        }
        
        const timestamp = Date.now();
        const filename = `kie-collaborative-${timestamp}-${name}.png`;
        const screenshotPath = path.join(__dirname, 'screenshots', filename);
        
        // Ensure screenshots directory exists
        const screenshotsDir = path.join(__dirname, 'screenshots');
        if (!fs.existsSync(screenshotsDir)) {
            fs.mkdirSync(screenshotsDir, { recursive: true });
        }
        
        await page.screenshot({ path: screenshotPath, fullPage: true });
        addDebugStep('Screenshot', 'info', `Screenshot saved: ${filename}`, filename);
        return filename;
    } catch (error) {
        addDebugStep('Screenshot', 'error', `Failed to take screenshot: ${error.message}`);
        return null;
    }
}

// Add debug step function
function addDebugStep(step, type, message, screenshot = null) {
    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] ${step}: ${message}`);
    
    if (globalIO) {
        globalIO.emit('log', {
            step: step,
            message: message,
            type: type,
            timestamp: timestamp,
            screenshot: screenshot
        });
    }
}

// Sleep function
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Export functions for external control
module.exports = {
    createKieAccountCollaborative,
    setGuidance,
    clearGuidance,
    pauseAI,
    resumeAI,
    stopAI,
    takeManualScreenshot,
    setGlobalPage,
    addToConversationHistory,
    getConversationHistory,
    clearConversationHistory
};
