// Add this import after line 3532
const { scrapeRecraftWithSession, getSessionStatus, cleanupSession } = require('./recraft-session-scraper');

// Add these endpoints after line 3667 (before the error handling)

// Session-based Recraft.ai Route
app.post('/api/recraft-session', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { googleEmail, googlePassword, prompt } = req.body;

  if (!googleEmail || !googlePassword) {
    return res.status(400).json({
      ok: false,
      error: 'Google email and password are required for session-based scraping'
    });
  }

  try {
    console.log('🚀 Starting session-based Recraft.ai scraping...');
    console.log('📧 Google Email:', googleEmail);
    console.log('🎨 Prompt:', prompt || 'banana bread in kitchen with sun light');
    
    // Call the session scraper
    const result = await scrapeRecraftWithSession(googleEmail, googlePassword, prompt, io);
    
    res.json(result);
  } catch (error) {
    console.error('❌ Session-based Recraft.ai error:', error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// Get session status
app.get('/api/recraft-session-status', (req, res) => {
  try {
    const status = getSessionStatus();
    res.json({
      ok: true,
      ...status
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// Cleanup session
app.post('/api/recraft-session-cleanup', async (req, res) => {
  try {
    const result = await cleanupSession();
    res.json({
      ok: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// Serve Recraft.ai session test page
app.get('/recraft-session', (req, res) => {
  res.sendFile(path.join(__dirname, 'recraft-session-test.html'));
});
