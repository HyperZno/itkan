const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { db } = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/admin', authenticate, requireRole('super_admin'), (req, res) => {
  const admins = db.prepare('SELECT id, username, display_name, role, created_at FROM users ORDER BY created_at DESC').all();
  res.render('admin/index', { admins });
});

router.get('/admin/olustur', authenticate, requireRole('super_admin'), (req, res) => {
  res.render('admin/create', { error: null });
});

router.post('/admin/olustur', authenticate, requireRole('super_admin'), (req, res) => {
  const { username, password, display_name, role } = req.body;
  if (!username || !password || !display_name) {
    return res.render('admin/create', { error: 'Tum alanlar gerekli' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.render('admin/create', { error: 'Bu kullanici adi zaten var' });
  }

  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (username, password, display_name, role) VALUES (?, ?, ?, ?)').run(
    username, hash, display_name, role || 'admin'
  );
  res.redirect('/admin');
});

router.post('/admin/sil/:id', authenticate, requireRole('super_admin'), (req, res) => {
  const targetUser = db.prepare('SELECT id, role FROM users WHERE id = ?').get(req.params.id);
  if (!targetUser) return res.status(404).send('Kullanici bulunamadi');
  if (targetUser.role === 'super_admin') {
    return res.status(400).send('Super admin silinemez');
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.redirect('/admin');
});

router.post('/admin/sifre-sifirla/:id', authenticate, requireRole('super_admin'), (req, res) => {
  const { new_password } = req.body;
  if (!new_password) return res.status(400).send('Yeni sifre gerekli');
  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password = ?, password_changes = 0 WHERE id = ?').run(hash, req.params.id);
  res.redirect('/admin');
});

module.exports = router;
