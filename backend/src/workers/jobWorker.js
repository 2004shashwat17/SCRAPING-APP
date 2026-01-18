const Job = require('../models/Job');
const User = require('../models/User');
const Cookie = require('../models/Cookie');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const POLL_INTERVAL = parseInt(process.env.JOB_POLL_INTERVAL_MS || '3000', 10);

async function claimNextJob() {
  // Atomically find and claim a queued job
  const job = await Job.findOneAndUpdate({ status: 'queued' }, { $set: { status: 'running', startedAt: new Date() } }, { sort: { createdAt: 1 }, new: true });
  return job;
}

async function claimCookie(lockMs = parseInt(process.env.JOB_COOKIE_LOCK_MS || '1800000', 10)) {
  const now = new Date();
  const assignedUntil = new Date(Date.now() + lockMs);
  const filter = { status: 'ready', $or: [{ assignedUntil: null }, { assignedUntil: { $lt: now } }] };
  const update = { $set: { status: 'in_use', assignedUntil, lastUsedAt: now }, $inc: { usageCount: 1 } };
  const cookie = await Cookie.findOneAndUpdate(filter, update, { sort: { updatedAt: 1 }, new: true });
  return cookie;
}

function appendJobLog(job, entry) {
  job.logs = job.logs || [];
  job.logs.push({ t: new Date().toISOString(), entry });
  return job.save().catch(e => console.error('Failed to save job log:', e));
}

async function processJob(job) {
  try {
    await appendJobLog(job, 'Job claimed by worker');

    const user = await User.findById(job.userId).select('facebookAccessToken username');
    if (!user) {
      job.status = 'failed';
      job.error = 'User not found';
      await job.save();
      return;
    }

    const mountHost = job.outputPath;
    const mountContainer = '/app/output';
    const image = process.env.SCRAPER_IMAGE || 'shashwats500/facebook-scraper';

    // Ensure output dir exists
    try { fs.mkdirSync(mountHost, { recursive: true }); } catch (e) { }

    // Claim a cookie from the pool
    const cookie = await claimCookie();
    if (!cookie) {
      await appendJobLog(job, 'No cookie available, re-queueing job');
      // Re-queue job and let poll pick it up later
      job.status = 'queued';
      job.startedAt = undefined;
      await job.save();
      return;
    }

    await appendJobLog(job, `Assigned cookie ${cookie.filename}`);

    const cookieMount = `${cookie.path}:/app/cookies/cookie.json:ro`;

    let dockerArgs = [
      'run', '--rm',
      '--name', `scraper-${job.jobId}`,
      '-e', `COOKIE_ID=${cookie._id}`,
      '-e', `FBID=${job.fbid}`,
      '-e', `JOB_ID=${job.jobId}`,
      '-v', cookieMount,
      '-v', `${mountHost}:${mountContainer}`,
      image
    ];

    // Optional: if configured to pass the user's access token securely, write a temp env-file
    if (process.env.WORKER_PASS_TOKEN === 'true') {
      const accessToken = user.facebookAccessToken;
      if (accessToken) {
        const os = require('os');
        const tmpPath = path.join(os.tmpdir(), `env_${job.jobId}_${Date.now()}.env`);
        try {
          fs.writeFileSync(tmpPath, `ACCESS_TOKEN=${accessToken}\n`, { mode: 0o600 });
          // pass via --env-file (safer than -e in commandline since it won't be visible via ps args)
          dockerArgs = ['run', '--rm', '--env-file', tmpPath, '--name', `scraper-${job.jobId}`, '-e', `COOKIE_ID=${cookie._id}`, '-e', `FBID=${job.fbid}`, '-e', `JOB_ID=${job.jobId}`, '-v', cookieMount, '-v', `${mountHost}:${mountContainer}`, image];
        } catch (e) {
          console.error('Failed to write tmp env file:', e.message || e);
        }
      }
    }

    await appendJobLog(job, `Starting container: ${image}`);

    const dockerCmd = process.env.DOCKER_CMD || 'docker';
    const child = spawn(dockerCmd, dockerArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

    child.stdout.on('data', async (d) => {
      const s = d.toString();
      await appendJobLog(job, `out: ${s}`);
    });
    child.stderr.on('data', async (d) => {
      const s = d.toString();
      await appendJobLog(job, `err: ${s}`);
    });

    child.on('close', async (code) => {
      job.exitCode = code;
      job.finishedAt = new Date();

      // Basic cookie failure detection
      let cookieFailed = false;
      let cookieFailReason = null;

      if (code === 100) {
        cookieFailed = true;
        cookieFailReason = 'cookie invalid (exit 100)';
      }

      // scan last logs for common auth failure keywords
      const recentLogs = (job.logs || []).slice(-10).map(l => (l.entry || '').toLowerCase()).join('\n');
      if (!cookieFailed && /login required|invalid cookie|authentication failed/.test(recentLogs)) {
        cookieFailed = true;
        cookieFailReason = 'cookie invalid (log match)';
      }

      if (cookieFailed) {
        await appendJobLog(job, `Cookie failure detected: ${cookieFailReason}`);
        try {
          cookie.status = 'disabled';
          cookie.lastError = cookieFailReason;
          await cookie.save();
        } catch (e) { console.error('Failed to disable cookie:', e); }
      } else {
        // Release cookie with cooldown
        try {
          const cooldownMs = parseInt(process.env.COOKIE_COOLDOWN_MS || String(60*60*1000), 10); // 1 hour
          cookie.status = 'ready';
          cookie.assignedUntil = new Date(Date.now() + cooldownMs);
          await cookie.save();
        } catch (e) { console.error('Failed to release cookie:', e); }
      }

      if (code === 0) {
        job.status = 'completed';
        await appendJobLog(job, `Container finished successfully (code ${code})`);
      } else {
        job.attempts = (job.attempts || 0) + 1;
        const maxAttempts = parseInt(process.env.JOB_MAX_ATTEMPTS || '3', 10);
        if (job.attempts < maxAttempts && !cookieFailed) {
          // transient failure — requeue
          job.status = 'queued';
          job.startedAt = undefined;
          job.error = `Transient container error (code ${code}), attempts ${job.attempts}`;
          await appendJobLog(job, `Transient failure, re-queueing (attempt ${job.attempts})`);
        } else if (job.attempts < maxAttempts && cookieFailed) {
          // cookie failed — requeue but don't assign same cookie (it is disabled)
          job.status = 'queued';
          job.startedAt = undefined;
          job.error = `Cookie failure, re-queued for another cookie (attempt ${job.attempts})`;
          await appendJobLog(job, `Re-queued due to cookie failure (attempt ${job.attempts})`);
        } else {
          job.status = 'failed';
          job.error = `Container exit code ${code}`;
          await appendJobLog(job, `Job failed after ${job.attempts} attempts`);
        }
      }

      await job.save();
    });
  } catch (e) {
    console.error('Job processing failed:', e.message || e);
    job.status = 'failed';
    job.error = String(e.message || e);
    await job.save().catch(() => {});
  }
}

let running = false;

async function pollLoop() {
  if (running) return;
  running = true;
  try {
    const job = await claimNextJob();
    if (job) {
      processJob(job).catch(err => console.error('processJob error:', err));
    }
  } catch (e) {
    console.error('Worker poll error:', e);
  } finally {
    running = false;
  }
}

function start() {
  setInterval(pollLoop, POLL_INTERVAL);
  console.log('[jobWorker] Started, polling every', POLL_INTERVAL, 'ms');
}

module.exports = { start };
