require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const uploadDir = path.join(ROOT, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });

const db = new Database(path.join(ROOT, 'data', 'site.db'));
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS puppies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  gender TEXT NOT NULL,
  age TEXT NOT NULL,
  price TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Available',
  description TEXT DEFAULT '',
  image TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS site_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slot TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  image TEXT DEFAULT ''
);
`);

const imageSlots = [
  ['hero', 'Homepage hero image'],
  ['about', 'About section image'],
  ['process', 'Adoption process image'],
  ['contact', 'Contact section image']
];
const insertSlot = db.prepare('INSERT OR IGNORE INTO site_images (slot,label,image) VALUES (?,?,?)');
for (const s of imageSlots) insertSlot.run(...s);

const count = db.prepare('SELECT COUNT(*) c FROM puppies').get().c;
if (!count) {
  const add = db.prepare('INSERT INTO puppies (name,gender,age,price,status,description,image) VALUES (?,?,?,?,?,?,?)');
  add.run('Max', 'Male', '10 weeks', '$1,800', 'Available', 'Friendly, playful Rottweiler puppy. Replace this text with your real puppy information.', '');
  add.run('Bella', 'Female', '10 weeks', '$1,800', 'Available', 'Sweet, confident Rottweiler puppy. Replace this text with your real puppy information.', '');
}

app.set('view engine', 'ejs');
app.set('views', path.join(ROOT, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(ROOT, 'public')));
app.use('/uploads', express.static(uploadDir));
app.use(session({
  secret: process.env.SESSION_SECRET || 'development-only-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 1000 * 60 * 60 * 4 }
}));

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPG, PNG, WEBP, or GIF images are allowed.'));
  }
});

function requireAdmin(req, res, next) {
  if (req.session.admin) return next();
  res.redirect('/admin/login');
}
function imageUrl(filename) { return filename ? `/uploads/${filename}` : ''; }

app.get('/', (req, res) => {
  const puppies = db.prepare("SELECT * FROM puppies WHERE status != 'Adopted' ORDER BY id DESC").all();
  const images = Object.fromEntries(db.prepare('SELECT slot,image FROM site_images').all().map(x => [x.slot, imageUrl(x.image)]));
  res.render('index', { puppies, images });
});

app.get('/puppy/:id', (req, res) => {
  const puppy = db.prepare('SELECT * FROM puppies WHERE id=?').get(req.params.id);
  if (!puppy) return res.status(404).send('Puppy not found');
  res.render('puppy', { puppy });
});

app.get('/admin/login', (req, res) => res.render('login', { error: null }));
app.post('/admin/login', async (req, res) => {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'change-this-password';
  const ok = req.body.username === username && req.body.password === password;
  if (!ok) return res.status(401).render('login', { error: 'Incorrect username or password.' });
  req.session.admin = true;
  res.redirect('/admin');
});
app.post('/admin/logout', requireAdmin, (req, res) => req.session.destroy(() => res.redirect('/')));

app.get('/admin', requireAdmin, (req, res) => {
  const puppies = db.prepare('SELECT * FROM puppies ORDER BY id DESC').all();
  const images = db.prepare('SELECT * FROM site_images ORDER BY id').all();
  res.render('admin', { puppies, images, message: req.query.message || '' });
});

app.post('/admin/puppies/add', requireAdmin, upload.single('image'), (req, res) => {
  const { name, gender, age, price, status, description } = req.body;
  if (!name || !gender || !age || !price) return res.redirect('/admin?message=Please+fill+all+required+puppy+fields');
  db.prepare('INSERT INTO puppies (name,gender,age,price,status,description,image) VALUES (?,?,?,?,?,?,?)')
    .run(name, gender, age, price, status || 'Available', description || '', req.file?.filename || '');
  res.redirect('/admin?message=Puppy+added');
});

app.post('/admin/puppies/:id/edit', requireAdmin, upload.single('image'), (req, res) => {
  const old = db.prepare('SELECT * FROM puppies WHERE id=?').get(req.params.id);
  if (!old) return res.redirect('/admin?message=Puppy+not+found');
  const image = req.file?.filename || old.image;
  db.prepare('UPDATE puppies SET name=?,gender=?,age=?,price=?,status=?,description=?,image=? WHERE id=?')
    .run(req.body.name, req.body.gender, req.body.age, req.body.price, req.body.status, req.body.description || '', image, req.params.id);
  res.redirect('/admin?message=Puppy+updated');
});

app.post('/admin/puppies/:id/delete', requireAdmin, (req, res) => {
  const puppy = db.prepare('SELECT image FROM puppies WHERE id=?').get(req.params.id);
  db.prepare('DELETE FROM puppies WHERE id=?').run(req.params.id);
  if (puppy?.image) fs.rm(path.join(uploadDir, puppy.image), { force: true }, () => {});
  res.redirect('/admin?message=Puppy+deleted');
});

app.post('/admin/images/:slot', requireAdmin, upload.single('image'), (req, res) => {
  if (!req.file) return res.redirect('/admin?message=Please+choose+an+image');
  const old = db.prepare('SELECT image FROM site_images WHERE slot=?').get(req.params.slot);
  db.prepare('UPDATE site_images SET image=? WHERE slot=?').run(req.file.filename, req.params.slot);
  if (old?.image) fs.rm(path.join(uploadDir, old.image), { force: true }, () => {});
  res.redirect('/admin?message=Website+image+updated');
});

app.use((err, req, res, next) => {
  if (err) return res.status(400).send(`<h1>Upload error</h1><p>${String(err.message)}</p><p><a href="/admin">Back to admin</a></p>`);
  next();
});

app.listen(PORT, () => console.log(`Michael Robert site running at http://localhost:${PORT}`));
