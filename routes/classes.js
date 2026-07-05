const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { authenticate } = require('../middleware/auth');

router.get('/siniflar', authenticate, (req, res) => {
  const classes = db.prepare(`
    SELECT c.*, u.display_name as teacher_name,
    (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id) as student_count,
    (SELECT COUNT(*) FROM attendance_sessions ass WHERE ass.class_id = c.id) as session_count
    FROM classes c LEFT JOIN users u ON c.created_by = u.id
    WHERE c.is_active = 1 ORDER BY c.created_at DESC
  `).all();
  res.render('classes/index', { classes });
});

router.get('/sinif-ekle', authenticate, (req, res) => {
  res.render('classes/create');
});

router.post('/sinif-ekle', authenticate, (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).send('Sinif adi gerekli');
  db.prepare('INSERT INTO classes (name, description, created_by) VALUES (?, ?, ?)').run(name, description || '', req.user.id);
  res.redirect('/siniflar');
});

router.get('/ogrenci-ekle', authenticate, (req, res) => {
  const classes = db.prepare('SELECT * FROM classes WHERE is_active = 1 ORDER BY name ASC').all();
  const selectedClassId = req.query.class_id || '';
  const students = db.prepare(`
    SELECT s.*, c.name as class_name 
    FROM students s 
    JOIN classes c ON s.class_id = c.id 
    ORDER BY s.name ASC
  `).all();
  res.render('students/create', { classes, selectedClassId, students });
});

router.post('/ogrenci-ekle', authenticate, (req, res) => {
  const { name, surname, tc_kimlik, age, class_id, school_grade, parent_name, phone, address } = req.body;
  if (!name) return res.status(400).send('Ogrenci adi gerekli');
  if (!class_id) return res.status(400).send('Sinif secimi gerekli');

  const finalTc = (tc_kimlik && tc_kimlik.trim()) ? tc_kimlik.trim() : '11111111111';
  const finalSurname = (surname && surname.trim()) ? surname.trim() : 'Belirtilmedi';
  const finalParent = (parent_name && parent_name.trim()) ? parent_name.trim() : 'Belirtilmedi';
  const finalPhone = (phone && phone.trim()) ? phone.trim() : '5555555555';
  const finalAddress = (address && address.trim()) ? address.trim() : 'Belirtilmedi';
  const finalAge = age ? parseInt(age, 10) : 0;
  const finalGrade = school_grade ? school_grade : 'Yok / Mezun';

  const result = db.prepare(`
    INSERT INTO students (name, surname, tc_kimlik, age, class_id, school_grade, parent_name, phone, address)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name.trim(),
    finalSurname,
    finalTc,
    finalAge,
    class_id,
    finalGrade,
    finalParent,
    finalPhone,
    finalAddress
  );
  
  const studentId = result.lastInsertRowid;
  res.redirect(`/ogrenci/${studentId}`);
});

router.get('/sinif/:id', authenticate, (req, res) => {
  const classData = db.prepare('SELECT c.*, u.display_name as teacher_name FROM classes c LEFT JOIN users u ON c.created_by = u.id WHERE c.id = ?').get(req.params.id);
  if (!classData) return res.status(404).send('Sinif bulunamadi');

  const students = db.prepare('SELECT * FROM students WHERE class_id = ? ORDER BY name ASC').all(req.params.id);
  const notes = db.prepare(`
    SELECT n.*, u.display_name as teacher_name FROM teacher_notes n
    JOIN users u ON n.created_by = u.id WHERE n.class_id = ?
    ORDER BY n.created_at DESC LIMIT 5
  `).all(req.params.id);

  res.render('classes/detail', { classData, students, notes });
});

router.post('/sinif/:id/ogrenci-ekle', authenticate, (req, res) => {
  const { name, surname, tc_kimlik, age, school_grade, parent_name, phone, address } = req.body;
  if (!name) return res.status(400).send('Ogrenci adi gerekli');

  const finalTc = (tc_kimlik && tc_kimlik.trim()) ? tc_kimlik.trim() : '11111111111';
  const finalSurname = (surname && surname.trim()) ? surname.trim() : 'Belirtilmedi';
  const finalParent = (parent_name && parent_name.trim()) ? parent_name.trim() : 'Belirtilmedi';
  const finalPhone = (phone && phone.trim()) ? phone.trim() : '5555555555';
  const finalAddress = (address && address.trim()) ? address.trim() : 'Belirtilmedi';
  const finalAge = age ? parseInt(age, 10) : 0;
  const finalGrade = school_grade ? school_grade : 'Yok / Mezun';

  const names = name.split('\n').filter(n => n.trim());
  const insert = db.prepare('INSERT INTO students (name, surname, tc_kimlik, age, class_id, school_grade, parent_name, phone, address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const batch = db.transaction(() => {
    for (const n of names) {
      insert.run(n.trim(), finalSurname, finalTc, finalAge, req.params.id, finalGrade, finalParent, finalPhone, finalAddress);
    }
  });
  batch();
  res.redirect(`/sinif/${req.params.id}`);
});

router.get('/ogrenci/:id', authenticate, (req, res) => {
  const student = db.prepare(`
    SELECT s.*, c.name as class_name, c.id as class_id FROM students s
    JOIN classes c ON s.class_id = c.id WHERE s.id = ?
  `).get(req.params.id);
  if (!student) return res.status(404).send('Ogrenci bulunamadi');

  const homework = db.prepare(`
    SELECT h.*, 
      s.name as surah_name, 
      e.name as elifba_topic_name,
      e.lesson_number,
      e.url as elifba_url,
      u.display_name as teacher_name,
      u2.display_name as checker_name
    FROM homework h
    LEFT JOIN surahs s ON h.surah_id = s.id
    LEFT JOIN elifba_topics e ON h.elifba_topic_id = e.id
    JOIN users u ON h.assigned_by = u.id
    LEFT JOIN users u2 ON h.checked_by = u2.id
    WHERE h.student_id = ?
    ORDER BY h.created_at DESC
  `).all(req.params.id);

  const surahs = db.prepare('SELECT * FROM surahs ORDER BY order_index ASC').all();

  res.render('students/detail', { student, homework, surahs });
});

router.get('/ogrenci/:id/duzenle', authenticate, (req, res) => {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  if (!student) return res.status(404).send('Ogrenci bulunamadi');
  const classes = db.prepare('SELECT * FROM classes WHERE is_active = 1').all();
  res.render('students/edit', { student, classes });
});

router.post('/ogrenci/:id/duzenle', authenticate, (req, res) => {
  const { name, surname, tc_kimlik, age, class_id, school_grade, parent_name, phone, address } = req.body;
  
  const finalTc = (tc_kimlik && tc_kimlik.trim()) ? tc_kimlik.trim() : '11111111111';
  const finalSurname = (surname && surname.trim()) ? surname.trim() : 'Belirtilmedi';
  const finalParent = (parent_name && parent_name.trim()) ? parent_name.trim() : 'Belirtilmedi';
  const finalPhone = (phone && phone.trim()) ? phone.trim() : '5555555555';
  const finalAddress = (address && address.trim()) ? address.trim() : 'Belirtilmedi';
  const finalAge = age ? parseInt(age, 10) : 0;
  const finalGrade = school_grade ? school_grade : 'Yok / Mezun';

  db.prepare('UPDATE students SET name=?, surname=?, tc_kimlik=?, age=?, class_id=?, school_grade=?, parent_name=?, phone=?, address=? WHERE id=?')
    .run(name, finalSurname, finalTc, finalAge, class_id, finalGrade, finalParent, finalPhone, finalAddress, req.params.id);
  res.redirect(`/ogrenci/${req.params.id}`);
});

router.post('/ogrenci/:id/sil', authenticate, (req, res) => {
  const student = db.prepare('SELECT class_id FROM students WHERE id = ?').get(req.params.id);
  if (!student) return res.status(404).send('Ogrenci bulunamadi');
  db.prepare('DELETE FROM students WHERE id = ?').run(req.params.id);
  res.redirect(`/sinif/${student.class_id}`);
});

router.post('/sinif/:id/sil', authenticate, (req, res) => {
  db.prepare('UPDATE classes SET is_active = 0 WHERE id = ?').run(req.params.id);
  res.redirect('/siniflar');
});

module.exports = router;
