const express = require('express');
const pool = require('../../db/pool');

const router = express.Router();

router.get('/', async (req, res) => {
  const startedAt = Date.now();

  try {
    const dbResult = await pool.query('SELECT 1 AS ok');
    const dbOk = dbResult.rows[0]?.ok === 1;
    const payload = {
      ok: dbOk,
      service: 'backoffice',
      uptimeSeconds: Math.floor(process.uptime()),
      db: dbOk ? 'ok' : 'error',
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    };

    return res.status(dbOk ? 200 : 503).json(payload);
  } catch (error) {
    console.error('Health check failed:', error);
    return res.status(503).json({
      ok: false,
      service: 'backoffice',
      uptimeSeconds: Math.floor(process.uptime()),
      db: 'error',
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
