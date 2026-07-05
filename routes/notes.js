const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { authenticate } = require('../middleware/auth');

router.get('/notlar/sinif/:id', authenticate, async (req, res) => {
  try {
    const classRes = await db.query('SELECT * FROM classes WHERE id = $1 AND is_active = 1', [req.params.id]);
    const classData = classRes.rows[0];
    if (!classData) return res.status(404).send('Sinif bulunamadi');

    const notesRes = await db.query(`
      SELECT n.*, u.display_name as teacher_name
      FROM teacher_notes n
      JOIN users u ON n.created_by = u.id
      WHERE n.class_id = $1
      ORDER BY n.created_at DESC
    `, [req.params.id]);

    res.render('notes/index', { classData, notes: notesRes.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send('Sistem hatası');
  }
});

router.post('/notlar/sinif/:id/ekle', authenticate, async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).send('Not icerigi gerekli');
  
  try {
    await db.query('INSERT INTO teacher_notes (class_id, content, created_by) VALUES ($1, $2, $3)', [req.params.id, content, req.user.id]);
    res.redirect(`/notlar/sinif/${req.params.id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Sistem hatası');
  }
});

router.post('/notlar/:id/sil', authenticate, async (req, res) => {
  try {
    const noteRes = await db.query('SELECT class_id, created_by FROM teacher_notes WHERE id = $1', [req.params.id]);
    const note = noteRes.rows[0];
    if (!note) return res.status(404).send('Not bulunamadi');
    
    if (note.created_by !== req.user.id && req.user.role !== 'super_admin') {
      return res.status(403).send('Bu notu silme yetkiniz yok');
    }
    
    await db.query('DELETE FROM teacher_notes WHERE id = $1', [req.params.id]);
    res.redirect(`/notlar/sinif/${note.class_id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Sistem hatası');
  }
});

module.exports = router;
