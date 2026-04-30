/**
 * Agent Headless Node - Entrypoint
 * 
 * This service runs as a Docker container and:
 * 1. Sends heartbeats to the database
 * 2. Polls for tasks assigned to this node
 * 3. Executes browser automation via Playwright
 * 4. Reports results back to the database
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cron = require('node-cron');
const { chromium } = require('playwright');
require('dotenv').config();

const app = express();
app.use(express.json({ limit: '50mb' }));

// Configuration
const NODE_ID = process.env.AGENT_NODE_ID || 'unknown-node';
const PORT = process.env.PORT || 3002;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const HEARTBEAT_INTERVAL = 30; // seconds

// Validate environment
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(`[${NODE_ID}] ERROR: Missing Supabase credentials`);
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Global browser instance (lazy initialization)
let browser = null;

/**
 * Get or create browser instance
 */
async function getBrowser() {
  if (!browser) {
    console.log(`[${NODE_ID}] Initializing browser...`);
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
  }
  return browser;
}

/**
 * Send heartbeat to database
 */
async function sendHeartbeat() {
  try {
    // Get device ID from database
    const { data: device, error: deviceError } = await supabase
      .from('agent_devices')
      .select('id')
      .eq('device_key', NODE_ID)
      .single();

    if (deviceError || !device) {
      console.error(`[${NODE_ID}] Device not found in database:`, deviceError?.message);
      return;
    }

    // Prepare heartbeat data
    const heartbeat = {
      device_id: device.id,
      status: 'online',
      cpu_percent: Math.random() * 30 + 10,  // Simulated - replace with real metrics
      memory_percent: Math.random() * 40 + 20, // Simulated
      active_tasks: 0,  // Will be updated by task processing
      queue_depth: 0,
      metadata: { 
        node_version: process.version,
        timestamp: new Date().toISOString()
      },
      recorded_at: new Date().toISOString()
    };

    // Insert heartbeat
    const { error: heartbeatError } = await supabase
      .from('agent_device_heartbeats')
      .insert(heartbeat);

    if (heartbeatError) {
      console.error(`[${NODE_ID}] Heartbeat insert failed:`, heartbeatError.message);
      return;
    }

    // Update device last_seen
    await supabase
      .from('agent_devices')
      .update({ 
        last_seen_at: new Date().toISOString(),
        status: 'online'
      })
      .eq('id', device.id);

    console.log(`[${NODE_ID}] Heartbeat sent at ${new Date().toISOString()}`);

  } catch (err) {
    console.error(`[${NODE_ID}] Heartbeat error:`, err.message);
  }
}

/**
 * Poll for pending tasks
 */
async function pollTasks() {
  try {
    // Get device ID
    const { data: device } = await supabase
      .from('agent_devices')
      .select('id')
      .eq('device_key', NODE_ID)
      .single();

    if (!device) return;

    // Find tasks assigned to this device
    const { data: tasks, error } = await supabase
      .from('agent_tasks')
      .select('*')
      .eq('device_id', device.id)
      .eq('status', 'queued')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1);

    if (error || !tasks || tasks.length === 0) return;

    // Execute each task
    for (const task of tasks) {
      await executeTask(task);
    }

  } catch (err) {
    console.error(`[${NODE_ID}] Task polling error:`, err.message);
  }
}

/**
 * Execute a task
 */
async function executeTask(task) {
  console.log(`[${NODE_ID}] Executing task ${task.id} (${task.task_type})`);

  // Update status to running
  await supabase
    .from('agent_tasks')
    .update({ 
      status: 'running', 
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', task.id);

  let result = { success: false, error: null, data: null };
  let logs = [];

  try {
    switch (task.task_type) {
      case 'browser_navigate':
        result = await taskBrowserNavigate(task.context, logs);
        break;
      
      case 'browser_screenshot':
        result = await taskBrowserScreenshot(task.context, logs);
        break;
      
      case 'browser_scrape':
        result = await taskBrowserScrape(task.context, logs);
        break;
      
      case 'research':
        result = await taskResearch(task.context, logs);
        break;
      
      case 'download':
        result = await taskDownload(task.context, logs);
        break;
      
      default:
        result = { 
          success: false, 
          error: `Unknown task type: ${task.task_type}`,
          data: null 
        };
    }

  } catch (err) {
    result = {
      success: false,
      error: err.message,
      data: null
    };
    logs.push(`Error: ${err.message}`);
  }

  // Record task run
  await supabase.from('agent_task_runs').insert({
    task_id: task.id,
    device_id: task.device_id,
    status: result.success ? 'completed' : 'failed',
    started_at: task.started_at || new Date().toISOString(),
    ended_at: new Date().toISOString(),
    result: result.data,
    error_message: result.error,
    logs: logs
  });

  // Update task status
  await supabase
    .from('agent_tasks')
    .update({ 
      status: result.success ? 'completed' : 'failed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', task.id);

  console.log(`[${NODE_ID}] Task ${task.id} ${result.success ? 'completed' : 'failed'}`);
}

/**
 * Task: Browser Navigate
 */
async function taskBrowserNavigate(context, logs) {
  const url = context?.url;
  if (!url) throw new Error('URL not provided');

  logs.push(`Navigating to ${url}`);
  
  const browser = await getBrowser();
  const page = await browser.newPage();
  
  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    const title = await page.title();
    logs.push(`Page loaded: ${title}`);
    
    await page.close();
    
    return {
      success: true,
      error: null,
      data: { title, url }
    };
  } catch (err) {
    await page.close();
    throw err;
  }
}

/**
 * Task: Browser Screenshot
 */
async function taskBrowserScreenshot(context, logs) {
  const url = context?.url;
  if (!url) throw new Error('URL not provided');

  logs.push(`Taking screenshot of ${url}`);
  
  const browser = await getBrowser();
  const page = await browser.newPage();
  
  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    const screenshot = await page.screenshot({ 
      fullPage: context?.fullPage || false,
      type: 'png'
    });
    
    // Convert to base64 for storage
    const base64Image = screenshot.toString('base64');
    
    await page.close();
    
    return {
      success: true,
      error: null,
      data: { 
        screenshot_base64: base64Image,
        url 
      }
    };
  } catch (err) {
    await page.close();
    throw err;
  }
}

/**
 * Task: Browser Scrape
 */
async function taskBrowserScrape(context, logs) {
  const url = context?.url;
  const selector = context?.selector;
  
  if (!url) throw new Error('URL not provided');

  logs.push(`Scraping ${url}`);
  
  const browser = await getBrowser();
  const page = await browser.newPage();
  
  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    
    let data;
    if (selector) {
      // Scrape specific element
      const element = await page.$(selector);
      data = element ? await element.textContent() : null;
    } else {
      // Get page info
      data = await page.evaluate(() => ({
        title: document.title,
        url: window.location.href,
        description: document.querySelector('meta[name="description"]')?.content || null
      }));
    }
    
    await page.close();
    
    return {
      success: true,
      error: null,
      data
    };
  } catch (err) {
    await page.close();
    throw err;
  }
}

/**
 * Task: Research (simple web search simulation)
 */
async function taskResearch(context, logs) {
  const query = context?.query;
  if (!query) throw new Error('Query not provided');

  logs.push(`Researching: ${query}`);
  
  // For now, this is a placeholder
  // In production, you'd integrate with a search API
  
  return {
    success: true,
    error: null,
    data: {
      query,
      results: [],
      note: 'Research task placeholder - integrate search API for full functionality'
    }
  };
}

/**
 * Task: Download
 */
async function taskDownload(context, logs) {
  const url = context?.url;
  if (!url) throw new Error('URL not provided');

  logs.push(`Downloading from ${url}`);
  
  // Placeholder - would use axios or similar to download
  
  return {
    success: true,
    error: null,
    data: { url, downloaded: false, note: 'Download placeholder' }
  };
}

// ===========================================
// EXPRESS ROUTES
// ===========================================

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    node: NODE_ID,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Status
app.get('/status', async (req, res) => {
  try {
    const { data: device } = await supabase
      .from('agent_devices')
      .select('id, status, last_seen_at')
      .eq('device_key', NODE_ID)
      .single();
    
    res.json({
      node: NODE_ID,
      device: device || null,
      browser_ready: !!browser
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Execute task endpoint (for manual triggering)
app.post('/execute', async (req, res) => {
  const { task_id } = req.body;
  
  try {
    const { data: task } = await supabase
      .from('agent_tasks')
      .select('*')
      .eq('id', task_id)
      .single();
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    await executeTask(task);
    
    res.json({ success: true, task_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===========================================
// SCHEDULED JOBS
// ===========================================

// Send heartbeat every 30 seconds
cron.schedule('*/30 * * * * *', sendHeartbeat);

// Poll for tasks every 10 seconds
cron.schedule('*/10 * * * * *', pollTasks);

// ===========================================
// START SERVER
// ===========================================

app.listen(PORT, () => {
  console.log(`[${NODE_ID}] Agent node running on port ${PORT}`);
  console.log(`[${NODE_ID}] Supabase URL: ${SUPABASE_URL}`);
  console.log(`[${NODE_ID}] Health check: http://localhost:${PORT}/health`);
  
  // Send initial heartbeat
  sendHeartbeat();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log(`[${NODE_ID}] SIGTERM received, shutting down...`);
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log(`[${NODE_ID}] SIGINT received, shutting down...`);
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});
