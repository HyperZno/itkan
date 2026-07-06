const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { authenticate } = require('../middleware/auth');

// List announcements
router.get('/duyurular', authenticate, async (req, res) => {
  try {
    const announcementsRes = await db.query(`
      SELECT a.*, u.display_name as author_name FROM announcements a
      JOIN users u ON a.created_by = u.id
      ORDER BY a.created_at DESC
    `);
    res.render('announcements/index', { announcements: announcementsRes.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send('Sistem hatası');
  }
});

// Publish a new announcement
router.post('/duyurular/yayinla', authenticate, async (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) {
    return res.status(400).send('Başlık ve duyuru içeriği gerekli');
  }

  try {
    await db.query('INSERT INTO announcements (title, content, created_by) VALUES ($1, $2, $3)', [
      title.trim(), content.trim(), req.user.id
    ]);
    res.redirect('/duyurular');
  } catch (err) {
    console.error(err);
    res.status(500).send('Sistem hatası');
  }
});

// API endpoint to fetch the latest announcement
router.get('/api/duyurular/son', authenticate, async (req, res) => {
  try {
    const latestRes = await db.query(`
      SELECT a.id, a.title, a.content, u.display_name as author_name 
      FROM announcements a
      JOIN users u ON a.created_by = u.id
      ORDER BY a.created_at DESC LIMIT 1
    `);
    
    if (latestRes.rows.length === 0) {
      return res.json(null);
    }
    
    res.json(latestRes.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// API endpoint to fetch the latest 5 announcements
router.get('/api/duyurular/liste', authenticate, async (req, res) => {
  try {
    const listRes = await db.query(`
      SELECT a.id, a.title, a.content, a.created_at, u.display_name as author_name 
      FROM announcements a
      JOIN users u ON a.created_by = u.id
      ORDER BY a.created_at DESC LIMIT 5
    `);
    res.json(listRes.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
