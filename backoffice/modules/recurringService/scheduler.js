const recurringService = require('./service');

let intervalHandle = null;
let running = false;

async function runOnce() {
  if (running) return;
  running = true;
  try {
    const result = await recurringService.generateDueWorkOrders({ source: 'scheduler' });
    if (result.generated.length || result.skipped.length) {
      console.log(`[recurring-scheduler] horizon=${result.horizon} generated=${result.generated.length} skipped=${result.skipped.length}`);
      result.skipped.forEach((s) => console.warn(`[recurring-scheduler] skipped plan=${s.planId}: ${s.error}`));
    }
  } catch (e) {
    // Do not crash the web process because a scheduler run failed.
    console.error('[recurring-scheduler] failed', e);
  } finally {
    running = false;
  }
}

function startRecurringScheduler() {
  if (intervalHandle || process.env.RECURRING_SCHEDULER_ENABLED === 'false') return;
  const minutes = Math.max(5, Number(process.env.RECURRING_SCHEDULER_INTERVAL_MINUTES || 60));
  setTimeout(runOnce, 5000).unref?.();
  intervalHandle = setInterval(runOnce, minutes * 60 * 1000);
  intervalHandle.unref?.();
  console.log(`[recurring-scheduler] enabled interval=${minutes}m lookahead=${process.env.RECURRING_LOOKAHEAD_DAYS || 14}d`);
}

module.exports = { startRecurringScheduler, runOnce };
