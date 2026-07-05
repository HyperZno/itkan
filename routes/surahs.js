const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { authenticate } = require('../middleware/auth');

router.get('/sureler', authenticate, (req, res) => {
  const surahs = db.prepare('SELECT * FROM surahs ORDER BY order_index ASC').all();
  res.render('surahs/index', { surahs });
});

router.get('/api/sureler', authenticate, (req, res) => {
  const surahs = db.prepare('SELECT * FROM surahs ORDER BY order_index ASC').all();
  res.json(surahs);
});

router.get('/api/sure/:id', authenticate, (req, res) => {
  const surah = db.prepare('SELECT * FROM surahs WHERE id = ?').get(req.params.id);
  if (!surah) return res.status(404).json({ error: 'Sure bulunamadi' });
  res.json(surah);
});

module.exports = router;
