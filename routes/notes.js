const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { authenticate } = require('../middleware/auth');

router.get('/notlar/sinif/:id', authenticate, (req, res) => {
  const classData = db.prepare('SELECT * FROM classes WHERE id = ? AND is_active = 1').get(req.params.id);
  if (!classData) return res.status(404).send('Sinif bulunamadi');

  const notes = db.prepare(`
    SELECT n.*, u.display_name as teacher_name
    FROM teacher_notes n
    JOIN users u ON n.created_by = u.id
    WHERE n.class_id = ?
    ORDER BY n.created_at DESC
  `).all(req.params.id);

  res.render('notes/index', { classData, notes });
});

router.post('/notlar/sinif/:id/ekle', authenticate, (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).send('Not icerigi gerekli');
  db.prepare('INSERT INTO teacher_notes (class_id, content, created_by) VALUES (?, ?, ?)').run(req.params.id, content, req.user.id);
  res.redirect(`/notlar/sinif/${req.params.id}`);
});

router.post('/notlar/:id/sil', authenticate, (req, res) => {
  const note = db.prepare('SELECT class_id, created_by FROM teacher_notes WHERE id = ?').get(req.params.id);
  if (!note) return res.status(404).send('Not bulunamadi');
  if (note.created_by !== req.user.id && req.user.role !== 'super_admin') {
    return res.status(403).send('Bu notu silme yetkiniz yok');
  }
  db.prepare('DELETE FROM teacher_notes WHERE id = ?').run(req.params.id);
  res.redirect(`/notlar/sinif/${note.class_id}`);
});

module.exports = router;
