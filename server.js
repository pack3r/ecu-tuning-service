const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure data folders exist
const dataDir = path.join(__dirname, 'data');
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Database setup
const dbFile = path.join(dataDir, 'app.db');
const db = new sqlite3.Database(dbFile);

db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'client'
    )`
  );

  db.run(
    `CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      original_filename TEXT NOT NULL,
      stored_filename TEXT NOT NULL,
      options TEXT NOT NULL,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      processed_filename TEXT,
      vehicle_make TEXT,
      vehicle_model TEXT,
      vehicle_year INTEGER,
      ecu_controller TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`
  );

  // Add vehicle columns if they don't exist (for existing databases)
  // SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we catch errors silently
  db.run(`ALTER TABLE jobs ADD COLUMN vehicle_make TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding vehicle_make column:', err);
    }
  });
  db.run(`ALTER TABLE jobs ADD COLUMN vehicle_model TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding vehicle_model column:', err);
    }
  });
  db.run(`ALTER TABLE jobs ADD COLUMN vehicle_year INTEGER`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding vehicle_year column:', err);
    }
  });
  db.run(`ALTER TABLE jobs ADD COLUMN ecu_controller TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding ecu_controller column:', err);
    }
  });
  db.run(`ALTER TABLE jobs ADD COLUMN client_message TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding client_message column:', err);
    }
  });

  // Create default admin if not exists
  db.get(`SELECT * FROM users WHERE role = 'admin' LIMIT 1`, (err, row) => {
    if (err) {
      console.error('Error checking admin user', err);
      return;
    }
    if (!row) {
      const email = 'admin@example.com';
      const password = 'admin123';
      const hash = bcrypt.hashSync(password, 10);
      db.run(
        `INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'admin')`,
        [email, hash],
        (insertErr) => {
          if (insertErr) {
            console.error('Error creating default admin', insertErr);
          } else {
            console.log(`Default admin created: ${email} / ${password}`);
          }
        }
      );
    }
  });
});

// View engine and middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    store: new SQLiteStore({ db: 'sessions.db', dir: dataDir }),
    secret: 'change_this_secret',
    resave: false,
    saveUninitialized: false,
  })
);

app.use(express.static(path.join(__dirname, 'public')));

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// Helpers
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).send('Forbidden');
  }
  next();
}

// Expose user to views
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  next();
});

// Routes
app.get('/', (req, res) => {
  if (!req.session.user) {
    return res.render('index');
  }
  if (req.session.user.role === 'admin') {
    return res.redirect('/admin/jobs');
  }
  // Clients go to the dedicated welcome page
  return res.redirect('/home');
});

app.get('/register', (req, res) => {
  res.render('register', { error: null });
});

app.post('/register', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.render('register', { error: 'Email i hasło są wymagane.' });
  }
  const hash = bcrypt.hashSync(password, 10);
  db.run(
    `INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'client')`,
    [email, hash],
    function (err) {
      if (err) {
        console.error(err);
        return res.render('register', { error: 'Email jest już w użyciu lub wystąpił błąd.' });
      }
      req.session.user = { id: this.lastID, email, role: 'client' };
      // After registration, show the welcome page
      res.redirect('/home');
    }
  );
});

app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.render('login', { error: 'Email i hasło są wymagane.' });
  }
  db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
    if (err || !user) {
      return res.render('login', { error: 'Nieprawidłowe dane logowania.' });
    }
    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      return res.render('login', { error: 'Nieprawidłowe dane logowania.' });
    }
    req.session.user = { id: user.id, email: user.email, role: user.role };
    if (user.role === 'admin') {
      return res.redirect('/admin/jobs');
    }
    // For clients, go to the welcome page
    res.redirect('/home');
  });
});

// Client welcome page
app.get('/home', requireAuth, (req, res) => {
  if (req.session.user.role === 'admin') {
    return res.redirect('/admin/jobs');
  }
  res.render('home');
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Client dashboard (kept for backward compatibility, redirect to new job page)
app.get('/dashboard', requireAuth, (req, res) => {
  return res.redirect('/jobs/new');
});

// New job page
app.get('/jobs/new', requireAuth, (req, res) => {
  res.render('jobs_new');
});

// Job history page
app.get('/jobs/history', requireAuth, (req, res) => {
  const userId = req.session.user.id;
  db.all(
    `SELECT * FROM jobs WHERE user_id = ? ORDER BY created_at DESC`,
    [userId],
    (err, jobs) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Database error');
      }
      res.render('jobs_history', { jobs });
    }
  );
});

app.post('/upload', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('File is required');
  }
  const options = {
    dpf_off: !!req.body.dpf_off,
    egr_off: !!req.body.egr_off,
    adblue_off: !!req.body.adblue_off,
    dtc_off: !!req.body.dtc_off,
    dtc_codes: req.body.dtc_codes || '',
    immo_off: !!req.body.immo_off,
  };
  const notes = req.body.notes || '';
  const vehicle_make = req.body.vehicle_make || '';
  const vehicle_model = req.body.vehicle_model || '';
  const vehicle_year = req.body.vehicle_year ? parseInt(req.body.vehicle_year) : null;
  const ecu_controller = req.body.ecu_controller;

  db.run(
    `INSERT INTO jobs (user_id, original_filename, stored_filename, options, notes, status, vehicle_make, vehicle_model, vehicle_year, ecu_controller)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
    [
      req.session.user.id,
      req.file.originalname,
      req.file.filename,
      JSON.stringify(options),
      notes,
      vehicle_make,
      vehicle_model,
      vehicle_year,
      ecu_controller,
    ],
    (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Database error');
      }
      // After creating a job, go to the history page
      res.redirect('/jobs/history');
    }
  );
});

// Edit job page
app.get('/jobs/:id/edit', requireAuth, (req, res) => {
  const jobId = req.params.id;
  const userId = req.session.user.id;
  db.get(
    `SELECT * FROM jobs WHERE id = ? AND user_id = ?`,
    [jobId, userId],
    (err, job) => {
      if (err || !job) {
        return res.status(404).send('Job not found');
      }
      if (job.status !== 'pending') {
        return res.status(403).send('Można edytować tylko oczekujące zadania');
      }
      res.render('jobs_edit', { job });
    }
  );
});

// Handle job edit submission
app.post('/jobs/:id/edit', requireAuth, (req, res) => {
  const jobId = req.params.id;
  const userId = req.session.user.id;

  // First check if job exists and belongs to user
  db.get(
    `SELECT * FROM jobs WHERE id = ? AND user_id = ?`,
    [jobId, userId],
    (err, existingJob) => {
      if (err || !existingJob) {
        return res.status(404).send('Job not found');
      }
      if (existingJob.status !== 'pending') {
        return res.status(403).send('Można edytować tylko oczekujące zadania');
      }

      // Update the job
      const options = {
        dpf_off: !!req.body.dpf_off,
        egr_off: !!req.body.egr_off,
        adblue_off: !!req.body.adblue_off,
        dtc_off: !!req.body.dtc_off,
        dtc_codes: req.body.dtc_codes || '',
        immo_off: !!req.body.immo_off,
      };
      const notes = req.body.notes || '';
      const vehicle_make = req.body.vehicle_make || '';
      const vehicle_model = req.body.vehicle_model || '';
      const vehicle_year = req.body.vehicle_year ? parseInt(req.body.vehicle_year) : null;
      const ecu_controller = req.body.ecu_controller;

      db.run(
        `UPDATE jobs SET
          options = ?,
          notes = ?,
          vehicle_make = ?,
          vehicle_model = ?,
          vehicle_year = ?,
          ecu_controller = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?`,
        [
          JSON.stringify(options),
          notes,
          vehicle_make,
          vehicle_model,
          vehicle_year,
          ecu_controller,
          jobId,
          userId,
        ],
        (updateErr) => {
          if (updateErr) {
            console.error(updateErr);
            return res.status(500).send('Database error');
          }
          res.redirect('/jobs/history');
        }
      );
    }
  );
});

// Client job detail
app.get('/jobs/:id', requireAuth, (req, res) => {
  const jobId = req.params.id;
  const userId = req.session.user.id;
  db.get(
    `SELECT * FROM jobs WHERE id = ? AND user_id = ?`,
    [jobId, userId],
    (err, job) => {
      if (err || !job) {
        return res.status(404).send('Job not found');
      }
      res.render('jobs_detail', { job });
    }
  );
});

// Download processed file for client
app.get('/jobs/:id/download', requireAuth, (req, res) => {
  const jobId = req.params.id;
  const userId = req.session.user.id;
  db.get(
    `SELECT * FROM jobs WHERE id = ? AND user_id = ?`,
    [jobId, userId],
    (err, job) => {
      if (err || !job) {
        return res.status(404).send('Job not found');
      }
      if (!job.processed_filename) {
        return res.status(400).send('File not ready yet');
      }
      const filePath = path.join(uploadDir, job.processed_filename);

      // Build filename with suffixes
      let suffix = '';
      const opts = JSON.parse(job.options || '{}');
      if (opts.dpf_off) {
        suffix += '(DPF_OFF)';
      }
      if (opts.dtc_off) {
        suffix += `(DTC_P${opts.dtc_codes}_OFF)`;
      }

      // Split filename to insert suffix before extension
      const parts = job.original_filename.split('.');
      const ext = parts.pop();
      const base = parts.join('.');
      const downloadFilename = `processed_${base}${suffix}.${ext}`;

      res.download(filePath, downloadFilename);
    }
  );
});

// Admin routes
app.get('/admin/jobs', requireAdmin, (req, res) => {
  db.all(
    `SELECT jobs.*, users.email AS user_email
     FROM jobs
     JOIN users ON jobs.user_id = users.id
     ORDER BY created_at DESC`,
    [],
    (err, jobs) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Database error');
      }
      res.render('admin_jobs', { jobs });
    }
  );
});

// Admin view job details
app.get('/admin/jobs/:id', requireAdmin, (req, res) => {
  const jobId = req.params.id;
  db.get(
    `SELECT jobs.*, users.email AS user_email
     FROM jobs
     JOIN users ON jobs.user_id = users.id
     WHERE jobs.id = ?`,
    [jobId],
    (err, job) => {
      if (err || !job) {
        return res.status(404).send('Job not found');
      }

      // Get file size information
      let fileSize = 'Nieznany';
      try {
        const filePath = path.join(uploadDir, job.stored_filename);
        const stats = fs.statSync(filePath);
        const sizeKB = Math.round(stats.size / 1024);
        fileSize = `${sizeKB} KB`;
      } catch (fileErr) {
        // File doesn't exist or can't be accessed
      }

      res.render('admin_job_detail', { job, fileSize });
    }
  );
});

// Admin download original
app.get('/admin/jobs/:id/original', requireAdmin, (req, res) => {
  const jobId = req.params.id;
  db.get(`SELECT * FROM jobs WHERE id = ?`, [jobId], (err, job) => {
    if (err || !job) {
      return res.status(404).send('Job not found');
    }
    const filePath = path.join(uploadDir, job.stored_filename);
    res.download(filePath, job.original_filename);
  });
});

// Admin download processed
app.get('/admin/jobs/:id/processed', requireAdmin, (req, res) => {
  const jobId = req.params.id;
  db.get(`SELECT * FROM jobs WHERE id = ?`, [jobId], (err, job) => {
    if (err || !job) {
      return res.status(404).send('Job not found');
    }
    if (!job.processed_filename) {
      return res.status(400).send('Processed file not available');
    }
    const filePath = path.join(uploadDir, job.processed_filename);
    res.download(filePath, `processed_${job.original_filename}`);
  });
});

// Admin upload processed file and update status
const adminUpload = upload.single('processed_file');

app.post('/admin/jobs/:id/complete', requireAdmin, (req, res) => {
  adminUpload(req, res, (err) => {
    if (err) {
      console.error(err);
      return res.status(400).send('File upload error');
    }
    const jobId = req.params.id;
    if (!req.file) {
      return res.status(400).send('Processed file is required');
    }
    db.run(
      `UPDATE jobs
       SET status = 'completed',
           processed_filename = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [req.file.filename, jobId],
      (updateErr) => {
        if (updateErr) {
          console.error(updateErr);
          return res.status(500).send('Database error');
        }
        res.redirect('/admin/jobs');
      }
    );
  });
});

// Admin cancel job
app.post('/admin/jobs/:id/cancel', requireAdmin, (req, res) => {
  const jobId = req.params.id;
  db.run(
    `UPDATE jobs SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [jobId],
    (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Database error');
      }
      res.redirect('/admin/jobs');
    }
  );
});

// Admin update client message
app.post('/admin/jobs/:id/update_message', requireAdmin, (req, res) => {
  const jobId = req.params.id;
  const client_message = req.body.client_message || '';
  db.run(
    `UPDATE jobs SET client_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [client_message, jobId],
    (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Database error');
      }
      res.redirect(`/admin/jobs/${jobId}`);
    }
  );
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
