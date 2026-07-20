const express = require('express');
const router = express.Router();
const { db, logActivity } = require('../database');
const { authenticate } = require('../middleware/auth');

// List announcements
router.get('/duyurular', authenticate, async (req, res) => {
  try {
    const announcementsRes = await db.query(`
      SELECT a.*, u.display_name as author_name FROM announcements a
      JOIN users u ON a.created_by = u.id
      ORDER BY a.created_at DESC
    `);
    
    const teachersRes = await db.query('SELECT id, display_name, role FROM users ORDER BY display_name ASC');

    res.render('announcements/index', { 
      announcements: announcementsRes.rows,
      teachers: teachersRes.rows
    });
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
    await logActivity(req.user.id, 'announcement_publish', `${req.user.display_name} kullanıcısı yeni bir duyuru yayınladı: "${title.trim()}"`);
    res.redirect(req.query.redirect || '/duyurular');
  } catch (err) {
    console.error(err);
    res.status(500).send('Sistem hatası');
  }
});

// Delete announcement
router.post('/duyurular/sil/:id', authenticate, async (req, res) => {
  try {
    const annRes = await db.query('SELECT created_by, title FROM announcements WHERE id = $1', [req.params.id]);
    const ann = annRes.rows[0];
    if (!ann) return res.redirect('/duyurular');

    if (req.user.role !== 'super_admin' && req.user.id !== ann.created_by) {
      return res.status(403).send('Bu duyuruyu silme yetkiniz yok');
    }

    await db.query('DELETE FROM announcements WHERE id = $1', [req.params.id]);
    await logActivity(req.user.id, 'announcement_delete', `${req.user.display_name} kullanıcısı "${ann.title}" başlıklı duyuruyu sildi.`);
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
