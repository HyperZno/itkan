const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const db = new Database(path.join(__dirname, 'itkan.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initialize() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      password_changes INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_by INTEGER REFERENCES users(id),
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      surname TEXT DEFAULT '',
      tc_kimlik TEXT DEFAULT '',
      age INTEGER DEFAULT 0,
      class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
      school_grade TEXT DEFAULT '',
      parent_name TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      address TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS attendance_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS attendance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER REFERENCES attendance_sessions(id) ON DELETE CASCADE,
      student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'present',
      UNIQUE(session_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS surahs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      ayah_count INTEGER NOT NULL,
      order_index INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS elifba_topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      lesson_number INTEGER NOT NULL,
      description TEXT DEFAULT '',
      url TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS homework (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'surah',
      surah_id INTEGER REFERENCES surahs(id),
      elifba_topic_id INTEGER REFERENCES elifba_topics(id),
      start_ayah INTEGER DEFAULT 1,
      end_ayah INTEGER,
      status TEXT NOT NULL DEFAULT 'not_started',
      assigned_by INTEGER REFERENCES users(id),
      checked_by INTEGER REFERENCES users(id),
      assigned_date DATE NOT NULL,
      due_date DATE,
      notes TEXT DEFAULT '',
      checked_date DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS teacher_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  try {
    db.exec("ALTER TABLE elifba_topics ADD COLUMN url TEXT DEFAULT ''");
  } catch (e) {}

  try {
    db.exec("ALTER TABLE students ADD COLUMN school_grade TEXT DEFAULT ''");
  } catch (e) {}

  try {
    db.exec("ALTER TABLE users ADD COLUMN password_changes INTEGER DEFAULT 0");
  } catch (e) {}

  const surahCount = db.prepare('SELECT COUNT(*) as count FROM surahs').get();
  if (surahCount.count === 0) seedSurahs();

  const elifbaCount = db.prepare('SELECT COUNT(*) as count FROM elifba_topics').get();
  if (elifbaCount.count !== 30) seedElifbaTopics();

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('super_admin');
  if (userCount.count === 0) seedSuperAdmin();
}

function seedSurahs() {
  const surahs = [
    ["Fatiha",7,1],["Bakara",286,2],["Al-i İmran",200,3],["Nisa",176,4],["Maide",120,5],
    ["En'am",165,6],["A'raf",206,7],["Enfal",75,8],["Tevbe",129,9],["Yunus",109,10],
    ["Hud",123,11],["Yusuf",111,12],["Ra'd",43,13],["İbrahim",52,14],["Hicr",99,15],
    ["Nahl",128,16],["İsra",111,17],["Kehf",110,18],["Meryem",98,19],["Taha",135,20],
    ["Enbiya",112,21],["Hac",78,22],["Mü'minun",118,23],["Nur",64,24],["Furkan",77,25],
    ["Şu'ara",227,26],["Neml",93,27],["Kasas",88,28],["Ankebut",69,29],["Rum",60,30],
    ["Lokman",34,31],["Secde",30,32],["Ahzab",73,33],["Sebe'",54,34],["Fatır",45,35],
    ["Yasin",83,36],["Saffat",182,37],["Sad",88,38],["Zümer",75,39],["Mü'min",85,40],
    ["Fussilet",54,41],["Şura",53,42],["Zuhruf",89,43],["Duhan",59,44],["Casiye",37,45],
    ["Ahkaf",35,46],["Muhammed",38,47],["Fetih",29,48],["Hucurat",18,49],["Kaf",45,50],
    ["Zariyat",60,51],["Tur",49,52],["Necm",62,53],["Kamer",55,54],["Rahman",78,55],
    ["Vakıa",96,56],["Hadid",29,57],["Mücadele",22,58],["Haşr",24,59],["Mümtehine",13,60],
    ["Saff",14,61],["Cuma",11,62],["Münafikun",11,63],["Teğabun",18,64],["Talâk",12,65],
    ["Tahrim",12,66],["Mülk",30,67],["Kalem",52,68],["Hakka",52,69],["Mearic",44,70],
    ["Nuh",28,71],["Cin",28,72],["Müzzemmil",20,73],["Müddessir",56,74],["Kıyamet",40,75],
    ["İnsan",31,76],["Mürselat",50,77],["Nebe'",40,78],["Naziat",46,79],["Abese",42,80],
    ["Tekvir",29,81],["İnfitar",19,82],["Mutaffifin",36,83],["İnşikak",25,84],["Büruc",22,85],
    ["Tarık",17,86],["A'la",19,87],["Gaşiye",26,88],["Fecr",30,89],["Beled",20,90],
    ["Şems",15,91],["Leyl",21,92],["Duha",11,93],["İnşirah",8,94],["Tin",8,95],
    ["Alak",19,96],["Kadir",5,97],["Beyyine",8,98],["Zilzal",8,99],["Adiyat",11,100],
    ["Karia",11,101],["Tekasür",8,102],["Asr",3,103],["Hümeze",9,104],["Fil",5,105],
    ["Kureyş",4,106],["Maun",7,107],["Kevser",3,108],["Kafirun",6,109],["Nasr",3,110],
    ["Tebbet",5,111],["İhlas",4,112],["Felak",5,113],["Nas",6,114]
  ];
  const insert = db.prepare('INSERT INTO surahs (name, ayah_count, order_index) VALUES (?, ?, ?)');
  const batch = db.transaction(() => { for (const s of surahs) insert.run(s[0], s[1], s[2]); });
  batch();
}

function seedElifbaTopics() {
  db.prepare('DELETE FROM elifba_topics').run();

  const topics = [
    [1, 'HARFLER', 'Kuran-ı Kerim harflerini tanıma', 'https://kuran.diyanet.gov.tr/elifba/#/elifba/harfler'],
    [2, 'FETHA', 'Üstün harekesi ve okunuşu', 'https://kuran.diyanet.gov.tr/elifba/#/elifba/fetha'],
    [3, 'FETHA’NIN UZATILMASI', 'Fethanın uzatılarak okunuşu', 'https://kuran.diyanet.gov.tr/elifba/#/elifba/fethanin-uzatilmasi'],
    [4, 'FETHA’NIN TENVİNİ (İki Fetha)', 'Çift üstün tenvin okunuşu', 'https://kuran.diyanet.gov.tr/elifba/#/elifba/fetha-tenvin'],
    [5, 'KESRA', 'Esre harekesi ve okunuşu', 'https://kuran.diyanet.gov.tr/elifba/#/elifba/kesra'],
    [6, 'KESRA’NIN UZATILMASI', 'Kesranın uzatılarak okunuşu', 'https://kuran.diyanet.gov.tr/elifba/#/elifba/kesranin-uzatilmasi'],
    [7, 'KESRA’NIN TENVİNİ (İki Kesra)', 'Çift esre tenvin okunuşu', 'https://kuran.diyanet.gov.tr/elifba/#/elifba/kesranin-tenvini'],
    [8, 'DAMME', 'Ötre harekesi ve okunuşu', 'https://kuran.diyanet.gov.tr/elifba/#/elifba/damme'],
    [9, 'DAMME’NİN UZATILMASI', 'Dammenin uzatılarak okunuşu', 'https://kuran.diyanet.gov.tr/elifba/#/elifba/dammenin-uzatilmasi'],
    [10, 'DAMME’NİN TENVİNİ (İki Damme)', 'Çift ötre tenvin okunuşu', 'https://kuran.diyanet.gov.tr/elifba/#/elifba/dammenin-tenvini'],
    [11, 'CEZM (Harflerin Birleştirilmesi)', 'Sükun işareti ve birleştirme', 'https://kuran.diyanet.gov.tr/elifba/#/elifba/cezm'],
    [12, 'ŞEDDE', 'Çift okutma işareti', 'https://kuran.diyanet.gov.tr/elifba/#/elifba/sedde'],
    [13, 'PEKİŞTİRME', 'Genel alıştırmalar ve tekrar', 'https://kuran.diyanet.gov.tr/elifba/#/elifba/pekistirme'],
    [14, 'ZAMİR (Hâ Harfi)', 'Zamir olan he harfinin uzatılması', 'https://kuran.diyanet.gov.tr/elifba/#/tecvid/zamir'],
    [15, 'VAKF', 'Duraklarda durma kuralları', 'https://kuran.diyanet.gov.tr/elifba/#/tecvid/vakf'],
    [16, 'RÂ HARFİ', 'Ra harfinin kalın ve ince okunuşları', 'https://kuran.diyanet.gov.tr/elifba/#/tecvid/ra-harfi'],
    [17, 'LAFZATULLAH’IN LÂM’I', 'Allah kelimesindeki lamın okunuşu', 'https://kuran.diyanet.gov.tr/elifba/#/tecvid/lafzatullahin-lami'],
    [18, 'İHFÂ - İZHAR', 'Tenvin ve nun-u sakin kuralları', 'https://kuran.diyanet.gov.tr/elifba/#/tecvid/ihfa-izhar'],
    [19, 'İDĞÂM-I BİLA ĞUNNE', 'Ğunnesiz idğam kuralı', 'https://kuran.diyanet.gov.tr/elifba/#/tecvid/idgami-bila-gunne'],
    [20, 'İDĞÂM-I MEA’L–ĞUNNE', 'Ğunmeli idğam kuralı', 'https://kuran.diyanet.gov.tr/elifba/#/tecvid/idgami-meal-gunne'],
    [21, 'İDĞÂM-I MİSLEYN MEA’L–ĞUNNE', 'Misleyn meal ğunne kuralı', 'https://kuran.diyanet.gov.tr/elifba/#/tecvid/idgami-misleyn-meal-gunne'],
    [22, 'İKLÂB - İHFÂ-İ ŞEFEVİYYE', 'Nunun mime çevrilmesi ve dudak ihfası', 'https://kuran.diyanet.gov.tr/elifba/#/tecvid/iklab-ihfai-sefevviyye'],
    [23, 'İDĞÂM-I MİSLEYN BİLÂ ĞUNNE', 'Misleyn bila ğunne kuralı', 'https://kuran.diyanet.gov.tr/elifba/#/tecvid/idgami-misleyn-bila-gunne'],
    [24, 'İDĞÂM-I MÜTEKÂRİBEYN İDĞÂM-I MÜTECÂNİSEYN', 'Mütekaribeyn ve mütecaniseyn idğamları', 'https://kuran.diyanet.gov.tr/elifba/#/tecvid/idgami-mutekaribeyn-idgami-mütecaniseyn'],
    [25, 'KALKALE', 'Kalkale harfleri ve okunuşu', 'https://kuran.diyanet.gov.tr/elifba/#/tecvid/kalkale'],
    [26, 'MEDD-İ TABÎÎ - MEDD-İ MUTTASIL-MEDD-İ MUNFASIL', 'Asli med ve uzatma çeşitleri 1', 'https://kuran.diyanet.gov.tr/elifba/#/tecvid/meddi-tabii-muttasil-munfasil'],
    [27, 'MEDD-İ LÂZIM - MEDD-İ ÂRIZ-MEDD-İ LÎN', 'Uzatma çeşitleri 2', 'https://kuran.diyanet.gov.tr/elifba/#/tecvid/meddi-lazim-ariz-lin'],
    [28, 'HURÛF-U MUKATTAA', 'Sure başlarındaki mukattaa harfleri', 'https://kuran.diyanet.gov.tr/elifba/#/tecvid/hurufu-mukattaa'],
    [29, 'TENVİNLİ KELİMELERDEN GEÇİŞ', 'Tenvinden sonra geçiş vaslı', 'https://kuran.diyanet.gov.tr/elifba/#/tecvid/tenvinli-kelimelerden-gecis'],
    [30, 'UYGULAMA', 'Genel Kur\'an okuma uygulamaları', 'https://kuran.diyanet.gov.tr/elifba/#/tecvid/uygulama']
  ];
  const insert = db.prepare('INSERT INTO elifba_topics (lesson_number, name, description, url) VALUES (?, ?, ?, ?)');
  const batch = db.transaction(() => { for (const t of topics) insert.run(t[0], t[1], t[2], t[3]); });
  batch();
}

function seedSuperAdmin() {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (username, password, display_name, role) VALUES (?, ?, ?, ?)').run('admin', hash, 'Süper Admin', 'super_admin');
  console.log('Süper admin: admin / admin123');
}

module.exports = { db, initialize };
