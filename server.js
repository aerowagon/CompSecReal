const express = require('express');
const mysql = require('mysql2');
const path = require('path');

const app = express();
const port = 3000;

// Middleware to read JSON from POST requests
app.use(express.json());

// Serve static files (HTML, CSS, JS, images) from current folder
app.use(express.static(path.join(__dirname)));

// MySQL connection setup
const db = mysql.createConnection({
  host: 'localhost',
  user: 'user',        //  change this
  password: 'password', //  change this
  database: 'database',  // change this
});

db.connect(err => {
  if (err) {
    console.error(' Database connection failed:', err.stack);
    return;
  }
  console.log(' Connected to database.');
});

// POST /login handler
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  const sql = 'SELECT * FROM authentication WHERE email = ? AND password = ?';
  db.query(sql, [email, password], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      res.status(500).json({ message: 'Server error' });
      return;
    }

    if (results.length > 0) {
      res.json({ message: 'Login successful!' });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  });
});

// Start the server
app.listen(port, () => {
  console.log(`\ Server running at http://localhost:${port}/`);
});
