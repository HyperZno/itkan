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

router.get('/admin/ogretmen/:id', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const teacherId = req.params.id;
    
    const teacherRes = await db.query('SELECT id, username, display_name, role, created_at FROM users WHERE id = $1', [teacherId]);
    const teacher = teacherRes.rows[0];
    if (!teacher) return res.status(404).send('Öğretmen bulunamadı');

    const classesCountRes = await db.query('SELECT COUNT(*) as count FROM classes WHERE created_by = $1', [teacherId]);
    const classesCount = parseInt(classesCountRes.rows[0].count, 10);

    const studentsCountRes = await db.query(`
      SELECT COUNT(DISTINCT s.id) as count FROM students s
      JOIN classes c ON s.class_id = c.id
      WHERE c.created_by = $1 AND s.is_active = 1
    `, [teacherId]);
    const studentsCount = parseInt(studentsCountRes.rows[0].count, 10);

    const homeworkCountRes = await db.query('SELECT COUNT(*) as count FROM homework WHERE assigned_by = $1', [teacherId]);
    const homeworkCount = parseInt(homeworkCountRes.rows[0].count, 10);

    const homeworkStatusRes = await db.query(`
      SELECT status, COUNT(*) as count FROM homework 
      WHERE assigned_by = $1 
      GROUP BY status
    `, [teacherId]);
    
    const homeworkStats = { completed: 0, in_progress: 0, not_started: 0 };
    homeworkStatusRes.rows.forEach(r => {
      homeworkStats[r.status] = parseInt(r.count, 10);
    });

    const sessionsCountRes = await db.query('SELECT COUNT(*) as count FROM attendance_sessions WHERE created_by = $1', [teacherId]);
    const sessionsCount = parseInt(sessionsCountRes.rows[0].count, 10);

    const notesCountRes = await db.query('SELECT COUNT(*) as count FROM teacher_notes WHERE created_by = $1', [teacherId]);
    const notesCount = parseInt(notesCountRes.rows[0].count, 10);

    const recentHomeworksRes = await db.query(`
      SELECT h.*, 
             s.name as student_name, s.surname as student_surname,
             c.name as class_name,
             su.name as surah_name, 
             e.name as elifba_name
      FROM homework h
      JOIN students s ON h.student_id = s.id
      JOIN classes c ON s.class_id = c.id
      LEFT JOIN surahs su ON h.surah_id = su.id
      LEFT JOIN elifba_topics e ON h.elifba_topic_id = e.id
      WHERE h.assigned_by = $1
      ORDER BY h.assigned_date DESC, h.id DESC LIMIT 10
    `, [teacherId]);

    res.render('admin/teacher_detail', {
      teacher,
      classesCount,
      studentsCount,
      homeworkCount,
      homeworkStats,
      sessionsCount,
      notesCount,
      recentHomeworks: recentHomeworksRes.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Sistem hatası');
  }
});

router.get('/admin/ogretmen/:id/duzenle', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const teacherRes = await db.query('SELECT id, username, display_name, role FROM users WHERE id = $1', [req.params.id]);
    const teacher = teacherRes.rows[0];
    if (!teacher) return res.status(404).send('Öğretmen bulunamadı');
    
    res.render('admin/edit', { teacher, error: null });
  } catch (err) {
    console.error(err);
    res.status(500).send('Sistem hatası');
  }
});

router.post('/admin/ogretmen/:id/duzenle', authenticate, requireRole('super_admin'), async (req, res) => {
  const { username, display_name, password, role } = req.body;
  if (!username || !display_name) {
    return res.status(400).send('Kullanıcı adı ve Ad Soyad gereklidir');
  }

  try {
    const teacherRes = await db.query('SELECT id FROM users WHERE id = $1', [req.params.id]);
    const teacher = teacherRes.rows[0];
    if (!teacher) return res.status(404).send('Öğretmen bulunamadı');

    const existingRes = await db.query('SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND id <> $2', [username.trim(), req.params.id]);
    if (existingRes.rows[0]) {
      return res.render('admin/edit', { teacher: { id: req.params.id, username, display_name, role }, error: 'Bu kullanıcı adı başka bir hesap tarafından kullanılıyor' });
    }

    if (password && password.trim()) {
      const hash = bcrypt.hashSync(password, 10);
      await db.query('UPDATE users SET username = $1, display_name = $2, password = $3, role = $4 WHERE id = $5', [
        username.trim(), display_name.trim(), hash, role || 'admin', req.params.id
      ]);
    } else {
      await db.query('UPDATE users SET username = $1, display_name = $2, role = $3 WHERE id = $4', [
        username.trim(), display_name.trim(), role || 'admin', req.params.id
      ]);
    }
    
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.status(500).send('Sistem hatası');
  }
});

router.get('/admin/raporlar', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const classesCountRes = await db.query('SELECT COUNT(*) as count FROM classes WHERE is_active = 1');
    const studentsCountRes = await db.query('SELECT COUNT(*) as count FROM students WHERE is_active = 1');
    const homeworkCountRes = await db.query('SELECT COUNT(*) as count FROM homework');
    const sessionsCountRes = await db.query('SELECT COUNT(*) as count FROM attendance_sessions');

    const metrics = {
      classes: parseInt(classesCountRes.rows[0].count, 10),
      students: parseInt(studentsCountRes.rows[0].count, 10),
      homeworks: parseInt(homeworkCountRes.rows[0].count, 10),
      sessions: parseInt(sessionsCountRes.rows[0].count, 10)
    };

    const topStudentsRes = await db.query(`
      SELECT s.id, s.name, s.surname, c.name as class_name, COUNT(h.id) as completed_count
      FROM students s
      JOIN classes c ON s.class_id = c.id
      JOIN homework h ON h.student_id = s.id
      WHERE h.status = 'completed' AND s.is_active = 1
      GROUP BY s.id, s.name, s.surname, c.name
      ORDER BY completed_count DESC LIMIT 5
    `);

    const topCheckerRes = await db.query(`
      SELECT u.id, u.display_name, COUNT(h.id) as check_count
      FROM users u
      JOIN homework h ON h.checked_by = u.id
      GROUP BY u.id, u.display_name
      ORDER BY check_count DESC LIMIT 1
    `);
    const topChecker = topCheckerRes.rows[0] || null;

    const topTakerRes = await db.query(`
      SELECT u.id, u.display_name, COUNT(a.id) as session_count
      FROM users u
      JOIN attendance_sessions a ON a.created_by = u.id
      GROUP BY u.id, u.display_name
      ORDER BY session_count DESC LIMIT 1
    `);
    const topTaker = topTakerRes.rows[0] || null;

    const personalId = req.user.id;
    const personalClassesRes = await db.query('SELECT COUNT(*) as count FROM classes WHERE created_by = $1', [personalId]);
    const personalStudentsRes = await db.query(`
      SELECT COUNT(DISTINCT s.id) as count FROM students s
      JOIN classes c ON s.class_id = c.id
      WHERE c.created_by = $1 AND s.is_active = 1
    `, [personalId]);
    const personalHomeworksRes = await db.query('SELECT COUNT(*) as count FROM homework WHERE assigned_by = $1', [personalId]);
    const personalSessionsRes = await db.query('SELECT COUNT(*) as count FROM attendance_sessions WHERE created_by = $1', [personalId]);
    const personalNotesRes = await db.query('SELECT COUNT(*) as count FROM teacher_notes WHERE created_by = $1', [personalId]);

    const personalStats = {
      classes: parseInt(personalClassesRes.rows[0].count, 10),
      students: parseInt(personalStudentsRes.rows[0].count, 10),
      homeworks: parseInt(personalHomeworksRes.rows[0].count, 10),
      sessions: parseInt(personalSessionsRes.rows[0].count, 10),
      notes: parseInt(personalNotesRes.rows[0].count, 10)
    };

    res.render('admin/reports', {
      metrics,
      topStudents: topStudentsRes.rows,
      topChecker,
      topTaker,
      personalStats
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Sistem hatası');
  }
});

module.exports = router;
