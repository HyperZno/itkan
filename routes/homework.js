const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { authenticate } = require('../middleware/auth');

router.get('/odevler', authenticate, async (req, res) => {
  try {
    const studentsRes = await db.query(`
      SELECT s.*, c.name as class_name 
      FROM students s 
      JOIN classes c ON s.class_id = c.id 
      WHERE c.is_active = 1 
      ORDER BY s.name ASC, s.surname ASC
    `);

    const activeHomeworksRes = await db.query(`
      SELECT h.*, su.name as surah_name, el.name as elifba_topic_name, el.lesson_number, el.url as elifba_url 
      FROM homework h 
      LEFT JOIN surahs su ON h.surah_id = su.id 
      LEFT JOIN elifba_topics el ON h.elifba_topic_id = el.id 
      WHERE h.status != 'completed'
    `);

    const students = studentsRes.rows;
    const activeHomeworks = activeHomeworksRes.rows;

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
  } catch (err) {
    console.error(err);
    res.status(500).send('Sistem hatası');
  }
});

router.get('/odev/ogrenci/:studentId/ekle', authenticate, async (req, res) => {
  try {
    const studentRes = await db.query('SELECT s.*, c.name as class_name FROM students s JOIN classes c ON s.class_id = c.id WHERE s.id = $1', [req.params.studentId]);
    const student = studentRes.rows[0];
    if (!student) return res.status(404).send('Ogrenci bulunamadi');

    const surahsRes = await db.query('SELECT * FROM surahs ORDER BY order_index ASC');
    const elifbaTopicsRes = await db.query('SELECT * FROM elifba_topics ORDER BY lesson_number ASC');
    res.render('homework/create', { 
      student, 
      surahs: surahsRes.rows, 
      elifbaTopics: elifbaTopicsRes.rows 
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Sistem hatası');
  }
});

router.post('/odev/ogrenci/:studentId/ekle', authenticate, async (req, res) => {
  const { type, surah_id, elifba_topic_id, start_ayah, end_ayah, due_date, notes } = req.body;
  const today = new Date().toISOString().split('T')[0];

  try {
    if (type === 'surah') {
      if (!surah_id) return res.status(400).send('Sure secimi gerekli');
      
      const surahRes = await db.query('SELECT * FROM surahs WHERE id = $1', [surah_id]);
      const surah = surahRes.rows[0];
      if (!surah) return res.status(404).send('Sure bulunamadi');

      await db.query(`
        INSERT INTO homework (student_id, type, surah_id, start_ayah, end_ayah, assigned_by, assigned_date, due_date, notes, status)
        VALUES ($1, 'surah', $2, $3, $4, $5, $6, $7, $8, 'not_started')
      `, [
        req.params.studentId, 
        surah_id, 
        start_ayah || 1, 
        end_ayah || surah.ayah_count, 
        req.user.id, 
        today, 
        due_date || null, 
        notes || ''
      ]);
    } else {
      if (!elifba_topic_id) return res.status(400).send('Elifba konusu secimi gerekli');
      await db.query(`
        INSERT INTO homework (student_id, type, elifba_topic_id, assigned_by, assigned_date, due_date, notes, status)
        VALUES ($1, 'elifba', $2, $3, $4, $5, $6, 'not_started')
      `, [
        req.params.studentId, 
        elifba_topic_id, 
        req.user.id, 
        today, 
        due_date || null, 
        notes || ''
      ]);
    }

    res.redirect(`/ogrenci/${req.params.studentId}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Sistem hatası');
  }
});

router.post('/odev/:id/guncelle', authenticate, async (req, res) => {
  const { status } = req.body;
  
  try {
    const homeworkRes = await db.query('SELECT student_id FROM homework WHERE id = $1', [req.params.id]);
    const homework = homeworkRes.rows[0];
    if (!homework) return res.status(404).send('Odev bulunamadi');

    await db.query('UPDATE homework SET status = $1, checked_by = $2, checked_date = NOW() WHERE id = $3', [status, req.user.id, req.params.id]);
    res.redirect(`/ogrenci/${homework.student_id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Sistem hatası');
  }
});

router.post('/odev/:id/sil', authenticate, async (req, res) => {
  try {
    const homeworkRes = await db.query('SELECT student_id FROM homework WHERE id = $1', [req.params.id]);
    const homework = homeworkRes.rows[0];
    if (!homework) return res.status(404).send('Odev bulunamadi');

    await db.query('DELETE FROM homework WHERE id = $1', [req.params.id]);
    res.redirect(`/ogrenci/${homework.student_id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Sistem hatası');
  }
});

module.exports = router;
