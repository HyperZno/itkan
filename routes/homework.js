const express = require('express');
const router = express.Router();
const { db, logActivity } = require('../database');
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
      WHERE h.status NOT IN ('completed', 'repeated')
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

    const activeHwRes = await db.query(`
      SELECT h.*, su.name as surah_name 
      FROM homework h 
      LEFT JOIN surahs su ON h.surah_id = su.id 
      WHERE h.student_id = $1 AND h.status = 'in_progress'
    `, [req.params.studentId]);

    const surahsRes = await db.query('SELECT * FROM surahs ORDER BY order_index ASC');
    const elifbaTopicsRes = await db.query('SELECT * FROM elifba_topics ORDER BY lesson_number ASC');
    res.render('homework/create', { 
      student, 
      surahs: surahsRes.rows, 
      elifbaTopics: elifbaTopicsRes.rows,
      activeHomeworks: activeHwRes.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Sistem hatası');
  }
});

router.post('/odev/ogrenci/:studentId/ekle', authenticate, async (req, res) => {
  const { type, surah_id, elifba_topic_text, ezber_topic_text, page_number, page_detail, due_date, notes } = req.body;
  const today = new Date().toISOString().split('T')[0];

  try {
    const studentRes = await db.query('SELECT s.name, s.surname, c.name as class_name FROM students s JOIN classes c ON s.class_id = c.id WHERE s.id = $1', [req.params.studentId]);
    const student = studentRes.rows[0];
    if (!student) return res.status(404).send('Öğrenci bulunamadı');
    const studentName = `${student.name} ${student.surname}`;

    if (type === 'surah') {
      if (!surah_id) return res.status(400).send('Sure seçimi gerekli');
      
      const surahRes = await db.query('SELECT * FROM surahs WHERE id = $1', [surah_id]);
      const surah = surahRes.rows[0];
      if (!surah) return res.status(404).send('Sure bulunamadı');

      await db.query(`
        INSERT INTO homework (student_id, type, surah_id, page_number, page_detail, assigned_by, assigned_date, due_date, notes, status)
        VALUES ($1, 'surah', $2, $3, $4, $5, $6, $7, $8, 'in_progress')
      `, [
        req.params.studentId, 
        surah_id, 
        page_number || '', 
        page_detail || '', 
        req.user.id, 
        today, 
        due_date || null, 
        notes || ''
      ]);

      const detailText = page_number ? `Sayfa: ${page_number}${page_detail ? ' (' + page_detail + ')' : ''}` : 'Tümü';
      await logActivity(req.user.id, 'homework_assign', `${req.user.display_name} öğretmeni, ${studentName} isimli öğrenciye yeni bir Sure ödevi verdi: ${surah.name} Suresi (${detailText}) [Sınıf: ${student.class_name}]`);
    } else if (type === 'ezber') {
      const topic = ezber_topic_text || elifba_topic_text;
      if (!topic) return res.status(400).send('Ezber konusu seçilmesi veya yazılması gerekli');
      await db.query(`
        INSERT INTO homework (student_id, type, elifba_topic_text, assigned_by, assigned_date, due_date, notes, status)
        VALUES ($1, 'ezber', $2, $3, $4, $5, $6, 'in_progress')
      `, [
        req.params.studentId, 
        topic, 
        req.user.id, 
        today, 
        due_date || null, 
        notes || ''
      ]);

      await logActivity(req.user.id, 'homework_assign', `${req.user.display_name} öğretmeni, ${studentName} isimli öğrenciye yeni bir Ezber ödevi verdi: ${topic} [Sınıf: ${student.class_name}]`);
    } else {
      if (!elifba_topic_text) return res.status(400).send('Elifba konusu yazılması gerekli');
      await db.query(`
        INSERT INTO homework (student_id, type, elifba_topic_text, assigned_by, assigned_date, due_date, notes, status)
        VALUES ($1, 'elifba', $2, $3, $4, $5, $6, 'in_progress')
      `, [
        req.params.studentId, 
        elifba_topic_text, 
        req.user.id, 
        today, 
        due_date || null, 
        notes || ''
      ]);

      await logActivity(req.user.id, 'homework_assign', `${req.user.display_name} öğretmeni, ${studentName} isimli öğrenciye yeni bir Elifba ödevi verdi: ${elifba_topic_text} [Sınıf: ${student.class_name}]`);
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
    const homeworkRes = await db.query(`
      SELECT h.*, s.name as student_name, s.surname as student_surname, su.name as surah_name 
      FROM homework h 
      JOIN students s ON h.student_id = s.id 
      LEFT JOIN surahs su ON h.surah_id = su.id 
      WHERE h.id = $1
    `, [req.params.id]);
    const homework = homeworkRes.rows[0];
    if (!homework) return res.status(404).send('Odev bulunamadi');

    await db.query('UPDATE homework SET status = $1, checked_by = $2, checked_date = NOW() WHERE id = $3', [status, req.user.id, req.params.id]);

    let statusText = status === 'completed' ? (homework.type === 'ezber' ? 'Ezberledi' : 'Yaptı') : 'Çalışıyor';
    let hwDetail = homework.type === 'surah' ? `${homework.surah_name} Suresi` : homework.elifba_topic_text;

    await logActivity(req.user.id, 'homework_update', `${req.user.display_name} öğretmeni, ${homework.student_name} ${homework.student_surname} isimli öğrencinin ${hwDetail} ödevinin durumunu "${statusText}" olarak güncelledi.`);

    res.redirect(`/ogrenci/${homework.student_id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Sistem hatası');
  }
});

router.post('/odev/:id/sil', authenticate, async (req, res) => {
  try {
    const homeworkRes = await db.query(`
      SELECT h.*, s.name as student_name, s.surname as student_surname, su.name as surah_name 
      FROM homework h 
      JOIN students s ON h.student_id = s.id 
      LEFT JOIN surahs su ON h.surah_id = su.id 
      WHERE h.id = $1
    `, [req.params.id]);
    const homework = homeworkRes.rows[0];
    if (!homework) return res.status(404).send('Odev bulunamadi');

    await db.query('DELETE FROM homework WHERE id = $1', [req.params.id]);

    let hwDetail = homework.type === 'surah' ? `${homework.surah_name} Suresi` : homework.elifba_topic_text;
    await logActivity(req.user.id, 'homework_delete', `${req.user.display_name} öğretmeni, ${homework.student_name} ${homework.student_surname} isimli öğrencinin ${hwDetail} ödevini sildi.`);

    res.redirect(`/ogrenci/${homework.student_id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Sistem hatası');
  }
});

router.post('/odev/:id/tekrarla', authenticate, async (req, res) => {
  const { due_date, notes } = req.body;
  const today = new Date().toISOString().split('T')[0];

  try {
    const oldHwRes = await db.query(`
      SELECT h.*, s.name as student_name, s.surname as student_surname, su.name as surah_name 
      FROM homework h 
      JOIN students s ON h.student_id = s.id 
      LEFT JOIN surahs su ON h.surah_id = su.id 
      WHERE h.id = $1
    `, [req.params.id]);
    const oldHw = oldHwRes.rows[0];
    if (!oldHw) return res.status(404).send('Odev bulunamadi');

    // 1. Mark old homework as 'repeated'
    await db.query('UPDATE homework SET status = \'repeated\', checked_by = $1, checked_date = NOW() WHERE id = $2', [req.user.id, req.params.id]);

    // 2. Insert new repeated homework with parent_id set to old homework's ID
    const newNotes = notes ? notes.trim() : '';
    await db.query(`
      INSERT INTO homework (student_id, type, surah_id, elifba_topic_id, elifba_topic_text, page_number, page_detail, start_ayah, end_ayah, assigned_by, assigned_date, due_date, notes, status, parent_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'in_progress', $14)
    `, [
      oldHw.student_id,
      oldHw.type,
      oldHw.surah_id,
      oldHw.elifba_topic_id,
      oldHw.elifba_topic_text,
      oldHw.page_number,
      oldHw.page_detail,
      oldHw.start_ayah,
      oldHw.end_ayah,
      req.user.id,
      today,
      due_date || null,
      newNotes,
      oldHw.id
    ]);

    let hwDetail = oldHw.type === 'surah' ? `${oldHw.surah_name} Suresi` : oldHw.elifba_topic_text;
    let dueStr = due_date ? new Date(due_date).toLocaleDateString('tr-TR') : 'Belirtilmedi';
    await logActivity(req.user.id, 'homework_repeat', `${req.user.display_name} öğretmeni, ${oldHw.student_name} ${oldHw.student_surname} isimli öğrencinin yapmadığı ${hwDetail} ödevini tekrarlattı (Yeni teslim tarihi: ${dueStr}).`);

    res.redirect(`/ogrenci/${oldHw.student_id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Sistem hatası');
  }
});

module.exports = router;
