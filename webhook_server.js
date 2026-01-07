/**
 * Local Webhook Server - Receives triggers from Render backend and runs Docker scraper
 * Run: node webhook_server.js
 */

const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const PORT = 3001;
const OUTPUT_BASE_DIR = path.join(__dirname, 'scraper_output');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_BASE_DIR)) {
  fs.mkdirSync(OUTPUT_BASE_DIR, { recursive: true });
}

// Store active jobs
const activeJobs = new Map();

/**
 * Webhook endpoint - receives scraping requests from backend
 */
app.post('/webhook/start-scraping', async (req, res) => {
  const { userId, accessToken, username } = req.body;

  if (!userId || !accessToken) {
    return res.status(400).json({ 
      error: 'Missing required fields: userId and accessToken' 
    });
  }

  console.log('\n🎯 Webhook received!');
  console.log(`User: ${username || userId}`);
  console.log(`Access Token: ${accessToken.substring(0, 20)}...`);

  const jobId = `scraper_${userId}_${Date.now()}`;
  const containerName = `facebook-scraper-${userId.replace(/[^a-zA-Z0-9]/g, '-')}`;
  const outputDir = path.join(OUTPUT_BASE_DIR, userId);

  // Create user-specific output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`\n🚀 Starting Docker container: ${containerName}`);
  console.log(`📁 Output directory: ${outputDir}`);

  // Docker command to run scraper
  const dockerCommand = `
    docker run -d --platform linux/amd64 --name ${containerName} \
      -e FACEBOOK_ACCESS_TOKEN="${accessToken}" \
      -e USER_ID="${userId}" \
      -e USERNAME="${username || 'unknown'}" \
      -e CONTAINER_INDEX=1 \
      -e TOTAL_CONTAINERS=1 \
      -v "${outputDir}:/app/output" \
      shashwats500/facebook-scraper:latest
  `.replace(/\s+/g, ' ').trim();

  exec(dockerCommand, (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ Error starting container: ${error.message}`);
      console.error(stderr);
      return;
    }

    const containerId = stdout.trim();
    console.log(`✅ Container started successfully!`);
    console.log(`Container ID: ${containerId}`);
    
    activeJobs.set(jobId, {
      containerId,
      containerName,
      userId,
      username,
      startedAt: new Date(),
      outputDir,
      status: 'running'
    });

    // Monitor container status
    setTimeout(() => checkContainerStatus(jobId), 5000);
  });

  // Respond immediately
  res.json({
    success: true,
    jobId,
    message: 'Scraping job started',
    containerName,
    outputDir
  });
});

/**
 * Check status of a scraping job
 */
app.get('/webhook/status/:jobId', (req, res) => {
  const job = activeJobs.get(req.params.jobId);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  exec(`docker ps -a --filter name=${job.containerName} --format "{{.Status}}"`, (error, stdout) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const containerStatus = stdout.trim();
    const isRunning = containerStatus.startsWith('Up');

    res.json({
      jobId: req.params.jobId,
      status: isRunning ? 'running' : 'completed',
      containerStatus,
      startedAt: job.startedAt,
      outputDir: job.outputDir,
      username: job.username
    });
  });
});

/**
 * Get logs from a scraping job
 */
app.get('/webhook/logs/:jobId', (req, res) => {
  const job = activeJobs.get(req.params.jobId);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  exec(`docker logs ${job.containerName} --tail 50`, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({
      jobId: req.params.jobId,
      logs: stdout + stderr
    });
  });
});

/**
 * Stop a scraping job
 */
app.post('/webhook/stop/:jobId', (req, res) => {
  const job = activeJobs.get(req.params.jobId);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  exec(`docker stop ${job.containerName} && docker rm ${job.containerName}`, (error) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }

    activeJobs.delete(req.params.jobId);
    res.json({
      success: true,
      message: 'Job stopped successfully'
    });
  });
});

/**
 * Helper: Check container status periodically
 */
function checkContainerStatus(jobId) {
  const job = activeJobs.get(jobId);
  if (!job) return;

  exec(`docker ps -a --filter name=${job.containerName} --format "{{.Status}}"`, (error, stdout) => {
    if (error) {
      console.error(`Error checking container ${jobId}:`, error.message);
      return;
    }

    const status = stdout.trim();
    console.log(`\n📊 Container ${job.containerName}: ${status}`);

    if (status.startsWith('Up')) {
      // Still running, check again in 10 seconds
      setTimeout(() => checkContainerStatus(jobId), 10000);
    } else {
      // Container finished
      console.log(`\n✅ Container ${job.containerName} finished!`);
      console.log(`📁 Output saved to: ${job.outputDir}`);
      job.status = 'completed';
    }
  });
}

// Health check endpoint
app.get('/webhook/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    activeJobs: activeJobs.size,
    timestamp: new Date()
  });
});

app.listen(PORT, () => {
  console.log('\n🎯 Webhook Server Started!');
  console.log(`📡 Listening on port ${PORT}`);
  console.log(`\n📝 Endpoints:`);
  console.log(`   POST   http://localhost:${PORT}/webhook/start-scraping`);
  console.log(`   GET    http://localhost:${PORT}/webhook/status/:jobId`);
  console.log(`   GET    http://localhost:${PORT}/webhook/logs/:jobId`);
  console.log(`   POST   http://localhost:${PORT}/webhook/stop/:jobId`);
  console.log(`   GET    http://localhost:${PORT}/webhook/health`);
  console.log(`\n💡 Ready to receive scraping requests!`);
  console.log(`\n🔗 After starting ngrok, update your backend with the ngrok URL\n`);
});
