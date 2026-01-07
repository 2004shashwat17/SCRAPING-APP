const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Service to manage Facebook scraper Docker containers
 */
class ScraperService {
  constructor() {
    this.activeJobs = new Map();
  }

  /**
   * Start Facebook scraper for authenticated user
   * @param {Object} user - User object with Facebook access token
   * @returns {Promise<Object>} Job status
   */
  async startScraping(user) {
    const jobId = `scraper_${user._id}_${Date.now()}`;
    
    console.log(`[ScraperService] Starting scraping job ${jobId} for user ${user.username}`);
    
    // Create output directory for this user
    const outputDir = path.join(__dirname, '../../scraper_output', user._id.toString());
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Docker run command for single container with user's access token
    const containerName = `facebook-scraper-${user._id}`;
    const dockerCommand = `
      docker run -d --platform linux/amd64 --name ${containerName} \
        -e FACEBOOK_ACCESS_TOKEN="${user.facebookAccessToken}" \
        -e USER_ID="${user._id}" \
        -e CONTAINER_INDEX=1 \
        -e TOTAL_CONTAINERS=1 \
        -v ${outputDir}:/app/output \
        shashwats500/facebook-scraper:latest
    `.replace(/\s+/g, ' ').trim();

    return new Promise((resolve, reject) => {
      exec(dockerCommand, (error, stdout, stderr) => {
        if (error) {
          console.error(`[ScraperService] Error starting container: ${error.message}`);
          return reject(error);
        }

        const containerId = stdout.trim();
        console.log(`[ScraperService] Container started: ${containerId}`);

        this.activeJobs.set(jobId, {
          containerId,
          containerName,
          userId: user._id,
          status: 'running',
          startedAt: new Date(),
          outputDir
        });

        resolve({
          jobId,
          containerId,
          status: 'running',
          message: 'Scraping started successfully'
        });
      });
    });
  }

  /**
   * Check status of scraping job
   * @param {string} jobId - Job ID
   * @returns {Promise<Object>} Job status
   */
  async getJobStatus(jobId) {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      return { status: 'not_found', message: 'Job not found' };
    }

    return new Promise((resolve, reject) => {
      exec(`docker ps -a --filter name=${job.containerName} --format "{{.Status}}"`, (error, stdout, stderr) => {
        if (error) {
          return reject(error);
        }

        const status = stdout.trim();
        const isRunning = status.startsWith('Up');
        
        resolve({
          jobId,
          status: isRunning ? 'running' : 'completed',
          containerStatus: status,
          startedAt: job.startedAt,
          outputDir: job.outputDir
        });
      });
    });
  }

  /**
   * Stop scraping job
   * @param {string} jobId - Job ID
   * @returns {Promise<Object>} Result
   */
  async stopJob(jobId) {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      return { status: 'not_found', message: 'Job not found' };
    }

    return new Promise((resolve, reject) => {
      exec(`docker stop ${job.containerName} && docker rm ${job.containerName}`, (error, stdout, stderr) => {
        if (error) {
          return reject(error);
        }

        this.activeJobs.delete(jobId);
        resolve({
          status: 'stopped',
          message: 'Scraping job stopped successfully'
        });
      });
    });
  }

  /**
   * Get logs from scraping job
   * @param {string} jobId - Job ID
   * @returns {Promise<string>} Container logs
   */
  async getJobLogs(jobId) {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    return new Promise((resolve, reject) => {
      exec(`docker logs ${job.containerName} --tail 100`, (error, stdout, stderr) => {
        if (error) {
          return reject(error);
        }
        resolve(stdout + stderr);
      });
    });
  }
}

module.exports = new ScraperService();
