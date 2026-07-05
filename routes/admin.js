const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { db } = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/admin', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const adminsRes = await db.query('SELECT id, username, display_name, role, created_at FROM users ORDER BY created_at DESC');
    res.render('admin/index', { admins: adminsRes.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send('Sistem hatası');
  }
});

router.get('/admin/olustur', authenticate, requireRole('super_admin'), (req, res) => {
  res.render('admin/create', { error: null });
});

router.post('/admin/olustur', authenticate, requireRole('super_admin'), async (req, res) => {
  const { username, password, display_name, role } = req.body;
  if (!username || !password || !display_name) {
    return res.render('admin/create', { error: 'Tüm alanlar gerekli' });
  }

  try {
    const existingRes = await db.query('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [username.trim()]);
    const existing = existingRes.rows[0];
    if (existing) {
      return res.render('admin/create', { error: 'Bu kullanıcı adı zaten var' });
    }

    const hash = bcrypt.hashSync(password, 10);
    await db.query('INSERT INTO users (username, password, display_name, role) VALUES ($1, $2, $3, $4)', [
      username.trim(), hash, display_name.trim(), role || 'admin'
    ]);
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.render('admin/create', { error: 'Sistem hatası oluştu.' });
  }
});

router.post('/admin/sil/:id', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const targetUserRes = await db.query('SELECT id, role FROM users WHERE id = $1', [req.params.id]);
    const targetUser = targetUserRes.rows[0];
    if (!targetUser) return res.status(404).send('Kullanıcı bulunamadı');
    
    if (targetUser.role === 'super_admin') {
      return res.status(400).send('Süper admin silinemez');
    }
    
    await db.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.status(500).send('Sistem hatası');
  }
});

router.post('/admin/sifre-sifirla/:id', authenticate, requireRole('super_admin'), async (req, res) => {
  const { new_password } = req.body;
  if (!new_password) return res.status(400).send('Yeni şifre gerekli');
  
  try {
    const hash = bcrypt.hashSync(new_password, 10);
    await db.query('UPDATE users SET password = $1, password_changes = 0 WHERE id = $2', [hash, req.params.id]);
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.status(500).send('Sistem hatası');
  }
});

module.exports = router;
