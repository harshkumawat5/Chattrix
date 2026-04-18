const { Queue, Worker } = require("bullmq");
const IORedis = require("ioredis");

let reportQueue = null;
let reportWorker = null;

/**
 * Initialize BullMQ report queue.
 * Offloads report processing, auto-ban checks, and log writes off the socket event loop.
 * If UPSTASH_REDIS_URL is not set, falls back to inline processing.
 */
const initReportQueue = (processCallback) => {
  const url = process.env.UPSTASH_REDIS_URL;

  if (!url) {
    console.warn("[Queue] UPSTASH_REDIS_URL not set — reports will be processed inline");
    return null;
  }

  try {
    // BullMQ needs ioredis, not node-redis
    const connection = new IORedis(url, {
      maxRetriesPerRequest: null, // required by BullMQ
      enableReadyCheck: false,
      tls: url.startsWith("rediss://") ? {} : undefined,
    });

    reportQueue = new Queue("reports", { connection });

    reportWorker = new Worker(
      "reports",
      async (job) => {
        if (processCallback) {
          await processCallback(job.name, job.data);
        }
      },
      {
        connection: new IORedis(url, {
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
          tls: url.startsWith("rediss://") ? {} : undefined,
        }),
        concurrency: 3,
      }
    );

    reportWorker.on("failed", (job, err) => {
      console.error(`[Queue] Job ${job?.id} failed:`, err.message);
    });

    console.log("[Queue] BullMQ report queue initialized");
    return reportQueue;
  } catch (err) {
    console.error("[Queue] Failed to init BullMQ:", err.message);
    return null;
  }
};

/**
 * Add a report job to the queue (or process inline if queue unavailable).
 */
const enqueueReport = async (jobName, data, inlineFallback) => {
  if (reportQueue) {
    await reportQueue.add(jobName, data, {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 200,
    });
  } else if (inlineFallback) {
    // No Redis — process synchronously (original behavior)
    await inlineFallback(jobName, data);
  }
};

const closeReportQueue = async () => {
  try {
    if (reportWorker) await reportWorker.close();
    if (reportQueue) await reportQueue.close();
  } catch { /* silent */ }
  reportWorker = null;
  reportQueue = null;
};

module.exports = { initReportQueue, enqueueReport, closeReportQueue };

