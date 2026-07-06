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

module.exports = router;
