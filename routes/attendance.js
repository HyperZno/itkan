const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { authenticate } = require('../middleware/auth');

router.get('/yoklama/sinif/:id', authenticate, async (req, res) => {
  try {
    const classRes = await db.query('SELECT * FROM classes WHERE id = $1 AND is_active = 1', [req.params.id]);
    const classData = classRes.rows[0];
    if (!classData) return res.status(404).send('Sinif bulunamadi');

    // Fetch all existing attendance session dates for this class
    const sessionsRes = await db.query('SELECT date FROM attendance_sessions WHERE class_id = $1', [req.params.id]);
    
    // Format dates to YYYY-MM-DD
    const sessionDates = sessionsRes.rows.map(s => {
      // Postgres Date objects might return as standard JS Date; we convert to ISO string date portion
      if (s.date instanceof Date) {
        return s.date.toISOString().split('T')[0];
      }
      return s.date;
    });

    res.render('attendance/calendar', { classData, sessionDates });
  } catch (err) {
    console.error(err);
    res.status(500).send('Sistem hatası');
  }
});

router.get('/yoklama/sinif/:id/tarih/:date', authenticate, async (req, res) => {
  try {
    const classRes = await db.query('SELECT * FROM classes WHERE id = $1 AND is_active = 1', [req.params.id]);
    const classData = classRes.rows[0];
    if (!classData) return res.status(404).send('Sinif bulunamadi');

    const studentsRes = await db.query('SELECT * FROM students WHERE class_id = $1 ORDER BY name ASC', [req.params.id]);
    const selectedDate = req.params.date;

    const sessionRes = await db.query('SELECT * FROM attendance_sessions WHERE class_id = $1 AND date = $2', [req.params.id, selectedDate]);
    const existingSession = sessionRes.rows[0];
    
    let records = [];
    if (existingSession) {
      const recordsRes = await db.query('SELECT * FROM attendance_records WHERE session_id = $1', [existingSession.id]);
      records = recordsRes.rows;
    }

    res.render('attendance/take', { 
      classData, 
      students: studentsRes.rows, 
      records, 
      existingSession, 
      date: selectedDate 
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Sistem hatası');
  }
});

router.post('/yoklama/sinif/:id/tarih/:date', authenticate, async (req, res) => {
  const selectedDate = req.params.date;
  const { present_students } = req.body;

  try {
    const sessionRes = await db.query('SELECT * FROM attendance_sessions WHERE class_id = $1 AND date = $2', [req.params.id, selectedDate]);
    let session = sessionRes.rows[0];
    
    if (!session) {
      const result = await db.query('INSERT INTO attendance_sessions (class_id, date, created_by) VALUES ($1, $2, $3) RETURNING id', [req.params.id, selectedDate, req.user.id]);
      session = { id: result.rows[0].id };
    }

    const studentsRes = await db.query('SELECT id FROM students WHERE class_id = $1', [req.params.id]);
    const students = studentsRes.rows;

    if (students.length > 0) {
      const presentSet = new Set();
      if (present_students) {
        if (Array.isArray(present_students)) {
          present_students.forEach(id => presentSet.add(parseInt(id, 10)));
        } else {
          presentSet.add(parseInt(present_students, 10));
        }
      }

      let placeholders = [];
      let values = [];
      let idx = 1;
      for (const student of students) {
        const s = presentSet.has(student.id) ? 'present' : 'absent';
        placeholders.push(`($${idx}, $${idx+1}, $${idx+2})`);
        values.push(session.id, student.id, s);
        idx += 3;
      }
      
      const query = `
        INSERT INTO attendance_records (session_id, student_id, status)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (session_id, student_id) DO UPDATE SET status = EXCLUDED.status
      `;
      await db.query(query, values);
    }

    res.redirect(`/yoklama/seans/${session.id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Sistem hatası');
  }
});

router.get('/yoklama/gecmis/sinif/:id', authenticate, async (req, res) => {
  try {
    const classRes = await db.query('SELECT * FROM classes WHERE id = $1 AND is_active = 1', [req.params.id]);
    const classData = classRes.rows[0];
    if (!classData) return res.status(404).send('Sinif bulunamadi');

    const sessionsRes = await db.query(`
      SELECT ass.*, u.display_name as teacher_name,
      (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = ass.id AND ar.status = 'present') as present_count,
      (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = ass.id AND ar.status = 'absent') as absent_count
      FROM attendance_sessions ass
      JOIN users u ON ass.created_by = u.id
      WHERE ass.class_id = $1
      ORDER BY ass.date DESC
    `, [req.params.id]);

    res.render('attendance/history', { classData, sessions: sessionsRes.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send('Sistem hatası');
  }
});

router.get('/yoklama/detay/:sessionId', authenticate, async (req, res) => {
  try {
    const sessionRes = await db.query(`
      SELECT ass.*, c.name as class_name, u.display_name as teacher_name
      FROM attendance_sessions ass
      JOIN classes c ON ass.class_id = c.id
      JOIN users u ON ass.created_by = u.id
      WHERE ass.id = $1
    `, [req.params.sessionId]);
    const session = sessionRes.rows[0];
    if (!session) return res.status(404).send('Yoklama bulunamadi');

    const recordsRes = await db.query(`
      SELECT ar.*, s.name as student_name, s.surname as student_surname, s.phone as student_phone, s.parent_name as student_parent
      FROM attendance_records ar
      JOIN students s ON ar.student_id = s.id
      WHERE ar.session_id = $1
      ORDER BY s.name ASC
    `, [req.params.sessionId]);

    res.render('attendance/detail', { session, records: recordsRes.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send('Sistem hatası');
  }
});

module.exports = router;
