const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { authenticate } = require('../middleware/auth');

router.get('/siniflar', authenticate, async (req, res) => {
  try {
    const classesRes = await db.query(`
      SELECT c.*, u.display_name as teacher_name,
      (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id) as student_count,
      (SELECT COUNT(*) FROM attendance_sessions ass WHERE ass.class_id = c.id) as session_count
      FROM classes c LEFT JOIN users u ON c.created_by = u.id
      WHERE c.is_active = 1 ORDER BY c.created_at DESC
    `);
    res.render('classes/index', { classes: classesRes.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send('Sistem hatası');
  }
});

router.get('/sinif-ekle', authenticate, (req, res) => {
  res.render('classes/create');
});

router.post('/sinif-ekle', authenticate, async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).send('Sinif adi gerekli');
  try {
    await db.query('INSERT INTO classes (name, description, created_by) VALUES ($1, $2, $3)', [name, description || '', req.user.id]);
    res.redirect('/siniflar');
  } catch (err) {
    console.error(err);
    res.status(500).send('Sistem hatası');
  }
});

router.get('/ogrenci-ekle', authenticate, async (req, res) => {
  try {
    const classesRes = await db.query('SELECT * FROM classes WHERE is_active = 1 ORDER BY name ASC');
    const selectedClassId = req.query.class_id || '';
    const studentsRes = await db.query(`
      SELECT s.*, c.name as class_name 
      FROM students s 
      JOIN classes c ON s.class_id = c.id 
      ORDER BY s.name ASC
    `);
    res.render('students/create', { 
      classes: classesRes.rows, 
      selectedClassId, 
      students: studentsRes.rows 
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Sistem hatası');
  }
});

router.post('/ogrenci-ekle', authenticate, async (req, res) => {
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

  try {
    const result = await db.query(`
      INSERT INTO students (name, surname, tc_kimlik, age, class_id, school_grade, parent_name, phone, address)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [
      name.trim(),
      finalSurname,
      finalTc,
      finalAge,
      class_id,
      finalGrade,
      finalParent,
      finalPhone,
      finalAddress
    ]);
    
    const studentId = result.rows[0].id;
    res.redirect(`/ogrenci/${studentId}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Sistem hatası');
  }
});

router.get('/sinif/:id', authenticate, async (req, res) => {
  try {
    const classRes = await db.query('SELECT c.*, u.display_name as teacher_name FROM classes c LEFT JOIN users u ON c.created_by = u.id WHERE c.id = $1', [req.params.id]);
    const classData = classRes.rows[0];
    if (!classData) return res.status(404).send('Sinif bulunamadi');

    const studentsRes = await db.query('SELECT * FROM students WHERE class_id = $1 ORDER BY name ASC', [req.params.id]);
    const notesRes = await db.query(`
      SELECT n.*, u.display_name as teacher_name FROM teacher_notes n
      JOIN users u ON n.created_by = u.id WHERE n.class_id = $1
      ORDER BY n.created_at DESC LIMIT 5
    `, [req.params.id]);

    res.render('classes/detail', { 
      classData, 
      students: studentsRes.rows, 
      notes: notesRes.rows 
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Sistem hatası');
  }
});

router.post('/sinif/:id/ogrenci-ekle', authenticate, async (req, res) => {
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
  
  try {
    if (names.length > 0) {
      let placeholders = [];
      let values = [];
      let idx = 1;
      for (const n of names) {
        placeholders.push(`($${idx}, $${idx+1}, $${idx+2}, $${idx+3}, $${idx+4}, $${idx+5}, $${idx+6}, $${idx+7}, $${idx+8})`);
        values.push(n.trim(), finalSurname, finalTc, finalAge, req.params.id, finalGrade, finalParent, finalPhone, finalAddress);
        idx += 9;
      }
      const query = `INSERT INTO students (name, surname, tc_kimlik, age, class_id, school_grade, parent_name, phone, address) VALUES ${placeholders.join(', ')}`;
      await db.query(query, values);
    }
    res.redirect(`/sinif/${req.params.id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Sistem hatası');
  }
});

router.get('/ogrenci/:id', authenticate, async (req, res) => {
  try {
    const studentRes = await db.query(`
      SELECT s.*, c.name as class_name, c.id as class_id FROM students s
      JOIN classes c ON s.class_id = c.id WHERE s.id = $1
    `, [req.params.id]);
    const student = studentRes.rows[0];
    if (!student) return res.status(404).send('Ogrenci bulunamadi');

    const homeworkRes = await db.query(`
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
      WHERE h.student_id = $1
      ORDER BY h.created_at DESC
    `, [req.params.id]);

    const surahsRes = await db.query('SELECT * FROM surahs ORDER BY order_index ASC');

    res.render('students/detail', { 
      student, 
      homework: homeworkRes.rows, 
      surahs: surahsRes.rows 
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Sistem hatası');
  }
});

router.get('/ogrenci/:id/duzenle', authenticate, async (req, res) => {
  try {
    const studentRes = await db.query('SELECT * FROM students WHERE id = $1', [req.params.id]);
    const student = studentRes.rows[0];
    if (!student) return res.status(404).send('Ogrenci bulunamadi');

    const classesRes = await db.query('SELECT * FROM classes WHERE is_active = 1');
    res.render('students/edit', { student, classes: classesRes.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send('Sistem hatası');
  }
});

router.post('/ogrenci/:id/duzenle', authenticate, async (req, res) => {
  const { name, surname, tc_kimlik, age, class_id, school_grade, parent_name, phone, address } = req.body;
  
  const finalTc = (tc_kimlik && tc_kimlik.trim()) ? tc_kimlik.trim() : '11111111111';
  const finalSurname = (surname && surname.trim()) ? surname.trim() : 'Belirtilmedi';
  const finalParent = (parent_name && parent_name.trim()) ? parent_name.trim() : 'Belirtilmedi';
  const finalPhone = (phone && phone.trim()) ? phone.trim() : '5555555555';
  const finalAddress = (address && address.trim()) ? address.trim() : 'Belirtilmedi';
  const finalAge = age ? parseInt(age, 10) : 0;
  const finalGrade = school_grade ? school_grade : 'Yok / Mezun';

  try {
    await db.query(`
      UPDATE students 
      SET name=$1, surname=$2, tc_kimlik=$3, age=$4, class_id=$5, school_grade=$6, parent_name=$7, phone=$8, address=$9 
      WHERE id=$10
    `, [name, finalSurname, finalTc, finalAge, class_id, finalGrade, finalParent, finalPhone, finalAddress, req.params.id]);
    res.redirect(`/ogrenci/${req.params.id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Sistem hatası');
  }
});

router.post('/ogrenci/:id/sil', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).send('Bu işlem için yetkiniz yok. Sadece yöneticiler öğrenci silebilir.');
    }

    const studentRes = await db.query('SELECT class_id FROM students WHERE id = $1', [req.params.id]);
    const student = studentRes.rows[0];
    if (!student) return res.status(404).send('Ogrenci bulunamadi');

    await db.query('DELETE FROM students WHERE id = $1', [req.params.id]);
    res.redirect(`/sinif/${student.class_id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Sistem hatası');
  }
});

router.post('/sinif/:id/sil', authenticate, async (req, res) => {
  try {
    await db.query('UPDATE classes SET is_active = 0 WHERE id = $1', [req.params.id]);
    res.redirect('/siniflar');
  } catch (err) {
    console.error(err);
    res.status(500).send('Sistem hatası');
  }
});

module.exports = router;
