const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { authenticate } = require('../middleware/auth');

router.get('/odevler', authenticate, (req, res) => {
  const students = db.prepare(`
    SELECT s.*, c.name as class_name 
    FROM students s 
    JOIN classes c ON s.class_id = c.id 
    WHERE c.is_active = 1 
    ORDER BY s.name ASC, s.surname ASC
  `).all();

  const activeHomeworks = db.prepare(`
    SELECT h.*, su.name as surah_name, el.name as elifba_topic_name, el.lesson_number, el.url as elifba_url 
    FROM homework h 
    LEFT JOIN surahs su ON h.surah_id = su.id 
    LEFT JOIN elifba_topics el ON h.elifba_topic_id = el.id 
    WHERE h.status != 'completed'
  `).all();

  const studentMap = {};
  students.forEach(s => {
    studentMap[s.id] = {
      ...s,
      homeworks: []
    };
  });

  activeHomeworks.forEach(hw => {
    if (studentMap[hw.student_id]) {
      studentMap[hw.student_id].homeworks.push(hw);
    }
  });

  const studentsWithHomework = Object.values(studentMap).sort((a, b) => {
    return a.name.localeCompare(b.name, 'tr');
  });

  res.render('homework/index', { students: studentsWithHomework });
});

router.get('/odev/ogrenci/:studentId/ekle', authenticate, (req, res) => {
  const student = db.prepare('SELECT s.*, c.name as class_name FROM students s JOIN classes c ON s.class_id = c.id WHERE s.id = ?').get(req.params.studentId);
  if (!student) return res.status(404).send('Ogrenci bulunamadi');
  const surahs = db.prepare('SELECT * FROM surahs ORDER BY order_index ASC').all();
  const elifbaTopics = db.prepare('SELECT * FROM elifba_topics ORDER BY lesson_number ASC').all();
  res.render('homework/create', { student, surahs, elifbaTopics });
});

router.post('/odev/ogrenci/:studentId/ekle', authenticate, (req, res) => {
  const { type, surah_id, elifba_topic_id, start_ayah, end_ayah, due_date, notes } = req.body;
  const today = new Date().toISOString().split('T')[0];

  if (type === 'surah') {
    if (!surah_id) return res.status(400).send('Sure secimi gerekli');
    const surah = db.prepare('SELECT * FROM surahs WHERE id = ?').get(surah_id);
    db.prepare(`
      INSERT INTO homework (student_id, type, surah_id, start_ayah, end_ayah, assigned_by, assigned_date, due_date, notes, status)
      VALUES (?, 'surah', ?, ?, ?, ?, ?, ?, ?, 'not_started')
    `).run(req.params.studentId, surah_id, start_ayah || 1, end_ayah || surah.ayah_count, req.user.id, today, due_date || null, notes || '');
  } else {
    if (!elifba_topic_id) return res.status(400).send('Elifba konusu secimi gerekli');
    db.prepare(`
      INSERT INTO homework (student_id, type, elifba_topic_id, assigned_by, assigned_date, due_date, notes, status)
      VALUES (?, 'elifba', ?, ?, ?, ?, ?, 'not_started')
    `).run(req.params.studentId, elifba_topic_id, req.user.id, today, due_date || null, notes || '');
  }

  res.redirect(`/ogrenci/${req.params.studentId}`);
});

router.post('/odev/:id/guncelle', authenticate, (req, res) => {
  const { status } = req.body;
  const homework = db.prepare('SELECT student_id FROM homework WHERE id = ?').get(req.params.id);
  if (!homework) return res.status(404).send('Odev bulunamadi');
  db.prepare('UPDATE homework SET status = ?, checked_by = ?, checked_date = CURRENT_TIMESTAMP WHERE id = ?')
    .run(status, req.user.id, req.params.id);
  res.redirect(`/ogrenci/${homework.student_id}`);
});

router.post('/odev/:id/sil', authenticate, (req, res) => {
  const homework = db.prepare('SELECT student_id FROM homework WHERE id = ?').get(req.params.id);
  if (!homework) return res.status(404).send('Odev bulunamadi');
  db.prepare('DELETE FROM homework WHERE id = ?').run(req.params.id);
  res.redirect(`/ogrenci/${homework.student_id}`);
});

module.exports = router;
