const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../database');
const { authenticate, SECRET } = require('../middleware/auth');

router.get('/giris', (req, res) => {
  const token = req.cookies.token;
  if (token) {
    try {
      jwt.verify(token, SECRET);
      return res.redirect('/dashboard');
    } catch {}
  }
  res.render('login', { error: null });
});

router.post('/giris', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.render('login', { error: 'Kullanıcı adı ve şifre gerekli' });
  }

  try {
    const result = await db.query('SELECT * FROM users WHERE LOWER(username) = LOWER($1)', [username.trim()]);
    const user = result.rows[0];
    if (!user) {
      return res.render('login', { error: 'Kullanıcı bulunamadı' });
    }

    if (!bcrypt.compareSync(password, user.password)) {
      return res.render('login', { error: 'Hatalı şifre' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, display_name: user.display_name, role: user.role },
      SECRET,
      { expiresIn: '365d' }
    );

    res.cookie('token', token, { httpOnly: true, maxAge: 365 * 24 * 60 * 60 * 1000 });
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.render('login', { error: 'Sistem hatası oluştu.' });
  }
});

router.get('/cikis', (req, res) => {
  res.clearCookie('token');
  res.redirect('/giris');
});

router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const classesRes = await db.query(`
      SELECT c.*, u.display_name as teacher_name 
      FROM classes c 
      LEFT JOIN users u ON c.created_by = u.id 
      WHERE c.is_active = 1 
      ORDER BY c.created_at DESC
    `);

    const recentHwRes = await db.query(`
      SELECT h.*, 
        c.name as class_name, 
        st.name as student_name, 
        st.surname as student_surname, 
        su.name as surah_name, 
        u.display_name as teacher_name
      FROM homework h
      JOIN students st ON h.student_id = st.id
      JOIN classes c ON st.class_id = c.id
      LEFT JOIN surahs su ON h.surah_id = su.id
      JOIN users u ON h.assigned_by = u.id
      ORDER BY h.created_at DESC LIMIT 10
    `);

    const recentNotesRes = await db.query(`
      SELECT n.*, c.name as class_name, u.display_name as teacher_name
      FROM teacher_notes n
      JOIN classes c ON n.class_id = c.id
      JOIN users u ON n.created_by = u.id
      ORDER BY n.created_at DESC LIMIT 10
    `);

    const teachersRes = await db.query('SELECT id, display_name, role FROM users ORDER BY display_name ASC');

    res.render('dashboard', { 
      classes: classesRes.rows, 
      recentHomework: recentHwRes.rows, 
      recentNotes: recentNotesRes.rows,
      teachers: teachersRes.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Sistem hatası');
  }
});

router.get('/sifre-degistir', authenticate, async (req, res) => {
  try {
    const userRes = await db.query('SELECT password_changes, role FROM users WHERE id = $1', [req.user.id]);
    const user = userRes.rows[0];
    
    if (user.role === 'admin' && user.password_changes > 0) {
      return res.render('change-password', { 
        error: 'Şifrenizi daha önce değiştirdiniz. Tekrar şifre değişimi için Süper Admin ile iletişime geçin.',
        success: null,
        canChange: false
      });
    }
    
    res.render('change-password', { error: null, success: null, canChange: true });
  } catch (err) {
    console.error(err);
    res.status(500).send('Sistem hatası');
  }
});

router.post('/sifre-degistir', authenticate, async (req, res) => {
  const { current_password, new_password, confirm_password } = req.body;
  
  try {
    const userRes = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = userRes.rows[0];
    
    if (user.role === 'admin' && user.password_changes > 0) {
      return res.render('change-password', { 
        error: 'Şifrenizi daha önce değiştirdiniz. Tekrar şifre değişimi için Süper Admin ile iletişime geçin.',
        success: null,
        canChange: false
      });
    }
    
    if (!current_password || !new_password || !confirm_password) {
      return res.render('change-password', { error: 'Tüm alanları doldurmak zorunludur.', success: null, canChange: true });
    }
    
    if (new_password !== confirm_password) {
      return res.render('change-password', { error: 'Yeni şifreler uyuşmuyor.', success: null, canChange: true });
    }
    
    if (!bcrypt.compareSync(current_password, user.password)) {
      return res.render('change-password', { error: 'Mevcut şifreniz hatalı.', success: null, canChange: true });
    }
    
    const newHash = bcrypt.hashSync(new_password, 10);
    await db.query('UPDATE users SET password = $1, password_changes = password_changes + 1 WHERE id = $2', [newHash, req.user.id]);
    
    res.render('change-password', { 
      error: null, 
      success: 'Şifreniz başarıyla güncellendi.', 
      canChange: user.role === 'super_admin'
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Sistem hatası');
  }
});

module.exports = router;
