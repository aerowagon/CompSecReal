const express = require('express');
const mysql = require('mysql');
const path = require('path');
const app = express();
const port = 3000;

// Parse form and JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the current directory
app.use(express.static(path.join(__dirname)));

// Connect to MySQL
const db = mysql.createConnection({
  host: 'localhost',
  user: 'user',
  password: '',       // If you set a password during install, use it here
  database: 'compsec'
});

db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err);
  } else {
    console.log('Connected to MySQL database.');
  }
});

// Handle login POST request
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  const query = 'SELECT * FROM authentication WHERE email = ? AND password = ?';
  db.query(query, [email, password], (err, results) => {
    if (err) {
      console.error('Query error:', err);
      return res.status(500).send('Server error');
    }

    if (results.length > 0) {
      res.send('Login successful!');
    } else {
      res.status(401).send('Invalid email or password.');
    }
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});


 /** 
  * MySQLRoot Password: 1qaz
  * user name = user
  * password =       (it is blank)
  * 
  * port = 3000;
  * http://localhost:3000/login.html
  * 
  * */   
