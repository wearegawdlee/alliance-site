const express = require('express');
const service = require('./service');

const router = express.Router();
const attempts = new Map();

router.post('/leads', rateLimit, async (req, res, next) => {
  try {
    const result = await service.createWebsiteLead(req.body, req);

    // For honeypot hits, act successful but do not reveal filtering behavior.
    if (result.ignored) {
      return res.status(202).json({ ok: true });
    }

    return res.status(201).json({
      ok: true,
      customerId: result.customerId,
      message: 'Lead received'
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ ok: false, error: error.message });
    }
    next(error);
  }
});

function rateLimit(req, res, next) {
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = 8;
  const key = req.ip || 'unknown';
  const now = Date.now();
  const current = attempts.get(key) || { count: 0, resetAt: now + windowMs };

  if (now > current.resetAt) {
    current.count = 0;
    current.resetAt = now + windowMs;
  }

  current.count += 1;
  attempts.set(key, current);

  if (current.count > maxAttempts) {
    return res.status(429).json({ ok: false, error: 'Too many submissions. Please try again later.' });
  }

  next();
}

module.exports = router;
