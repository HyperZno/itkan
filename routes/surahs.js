const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { authenticate } = require('../middleware/auth');

router.get('/sureler', authenticate, async (req, res) => {
  try {
    const surahsRes = await db.query('SELECT * FROM surahs ORDER BY order_index ASC');
    res.render('surahs/index', { surahs: surahsRes.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send('Sistem hatası');
  }
});

router.get('/api/sureler', authenticate, async (req, res) => {
  try {
    const surahsRes = await db.query('SELECT * FROM surahs ORDER BY order_index ASC');
    res.json(surahsRes.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sistem hatası' });
  }
});

router.get('/api/sure/:id', authenticate, async (req, res) => {
  try {
    const surahRes = await db.query('SELECT * FROM surahs WHERE id = $1', [req.params.id]);
    const surah = surahRes.rows[0];
    if (!surah) return res.status(404).json({ error: 'Sure bulunamadi' });
    res.json(surah);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sistem hatası' });
  }
});

module.exports = router;
