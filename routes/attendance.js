const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { authenticate } = require('../middleware/auth');

router.get('/yoklama/sinif/:id', authenticate, (req, res) => {
  const classData = db.prepare('SELECT * FROM classes WHERE id = ? AND is_active = 1').get(req.params.id);
  if (!classData) return res.status(404).send('Sinif bulunamadi');

  // Fetch all existing attendance session dates for this class
  const sessions = db.prepare('SELECT date FROM attendance_sessions WHERE class_id = ?').all(req.params.id);
  const sessionDates = sessions.map(s => s.date);

  res.render('attendance/calendar', { classData, sessionDates });
});

router.get('/yoklama/sinif/:id/tarih/:date', authenticate, (req, res) => {
  const classData = db.prepare('SELECT * FROM classes WHERE id = ? AND is_active = 1').get(req.params.id);
  if (!classData) return res.status(404).send('Sinif bulunamadi');

  const students = db.prepare('SELECT * FROM students WHERE class_id = ? ORDER BY name ASC').all(req.params.id);
  const selectedDate = req.params.date;

  const existingSession = db.prepare('SELECT * FROM attendance_sessions WHERE class_id = ? AND date = ?').get(req.params.id, selectedDate);
  
  let records = [];
  if (existingSession) {
    records = db.prepare('SELECT * FROM attendance_records WHERE session_id = ?').all(existingSession.id);
  }

  res.render('attendance/take', { classData, students, records, existingSession, date: selectedDate });
});

router.post('/yoklama/sinif/:id/tarih/:date', authenticate, (req, res) => {
  const selectedDate = req.params.date;
  const { status } = req.body;

  let session = db.prepare('SELECT * FROM attendance_sessions WHERE class_id = ? AND date = ?').get(req.params.id, selectedDate);
  
  if (!session) {
    const result = db.prepare('INSERT INTO attendance_sessions (class_id, date, created_by) VALUES (?, ?, ?)').run(req.params.id, selectedDate, req.user.id);
    session = { id: result.lastInsertRowid };
  }

  const students = db.prepare('SELECT id FROM students WHERE class_id = ?').all(req.params.id);
  const upsert = db.prepare(`
    INSERT INTO attendance_records (session_id, student_id, status)
    VALUES (?, ?, ?)
    ON CONFLICT(session_id, student_id) DO UPDATE SET status = excluded.status
  `);

  const batch = db.transaction(() => {
    for (const student of students) {
      const s = status && status[student.id] ? 'present' : 'absent';
      upsert.run(session.id, student.id, s);
    }
  });
  batch();

  res.redirect(`/yoklama/sinif/${req.params.id}/tarih/${selectedDate}`);
});

router.get('/yoklama/gecmis/sinif/:id', authenticate, (req, res) => {
  const classData = db.prepare('SELECT * FROM classes WHERE id = ? AND is_active = 1').get(req.params.id);
  if (!classData) return res.status(404).send('Sinif bulunamadi');

  const sessions = db.prepare(`
    SELECT ass.*, u.display_name as teacher_name,
    (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = ass.id AND ar.status = 'present') as present_count,
    (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = ass.id AND ar.status = 'absent') as absent_count
    FROM attendance_sessions ass
    JOIN users u ON ass.created_by = u.id
    WHERE ass.class_id = ?
    ORDER BY ass.date DESC
  `).all(req.params.id);

  res.render('attendance/history', { classData, sessions });
});

router.get('/yoklama/detay/:sessionId', authenticate, (req, res) => {
  const session = db.prepare(`
    SELECT ass.*, c.name as class_name, u.display_name as teacher_name
    FROM attendance_sessions ass
    JOIN classes c ON ass.class_id = c.id
    JOIN users u ON ass.created_by = u.id
    WHERE ass.id = ?
  `).get(req.params.sessionId);
  if (!session) return res.status(404).send('Yoklama bulunamadi');

  const records = db.prepare(`
    SELECT ar.*, s.name as student_name, s.surname as student_surname, s.phone as student_phone, s.parent_name as student_parent
    FROM attendance_records ar
    JOIN students s ON ar.student_id = s.id
    WHERE ar.session_id = ?
    ORDER BY s.name ASC
  `).all(req.params.sessionId);

  res.render('attendance/detail', { session, records });
});

module.exports = router;
