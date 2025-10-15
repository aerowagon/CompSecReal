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

app.post('/add-user', (req, res) => {
  const {
    email,
    password,
    f_name,
    l_name,
    blugold_ID,
    address,
    city,
    add_city,
    zip_code,
    role
  } = req.body;

  if (!email || !password || !f_name || !l_name || !role) {
    return res.status(400).json({ message: 'Missing required fields.' });
  }

  // Step 1: Insert into `users`
  const insertUser = 'INSERT INTO users (email) VALUES (?)';
  db.query(insertUser, [email], (err, userResult) => {
    if (err) {
      console.error('Insert user error:', err);
      return res.status(500).json({ message: 'Failed to insert user' });
    }

    const sys_ID = userResult.insertId;

    // Step 2: Insert into `authentication`
    const insertAuth = 'INSERT INTO authentication (email, password) VALUES (?, ?)';
    db.query(insertAuth, [email, password], (err, authResult) => {
      if (err) {
        console.error('Insert auth error:', err);
        return res.status(500).json({ message: 'Failed to insert authentication' });
      }

      // Step 3: Insert into role-specific table
      let roleQuery = '';
      const commonParams = [sys_ID, email, f_name, l_name, null, address || '', city || '', add_city || '', zip_code || null];

      if (role === 'student') {
        roleQuery = 'INSERT INTO students (sys_ID, blugold_ID, email, f_name, l_name, GPA, address, city, add_city, zip_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
        commonParams.splice(1, 0, blugold_ID); // insert blugold_ID after sys_ID
      } else if (role === 'faculty') {
        roleQuery = 'INSERT INTO professors (sys_ID, email, f_name, l_name, GPA, address, city, add_city, zip_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
      } else {
        return res.status(400).json({ message: 'Invalid role specified' });
      }

      db.query(roleQuery, commonParams, (err, roleResult) => {
        if (err) {
          console.error('Insert role error:', err);
          return res.status(500).json({ message: 'Failed to insert into role table' });
        }

        return res.status(200).json({ message: 'User successfully added' });
      });
    });
  });
});

app.get('/list-users', (req, res) => {
  const query = 'SELECT * FROM users';

  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching users:', err);
      return res.status(500).json({ message: 'Error fetching users' });
    }

    console.log('All users:', results); // Log to server console
    res.status(200).json(results);      // Send to client
  });
});






 /** 
  * MySQLRoot Password: 1qaz
  * user name = user
  * password =       (it is blank)
  * 
  * port = 3000;
  * http://localhost:3000/login.html
  * http://localhost:3000/admin.html
  * 
  * /// mySQL  /////
  * C:\Users\Hagard>cd C:\Program Files\MySQL\MySQL Server 8.0\bin
  * mysql -u user -p
  * 
  * /// Node.js  ///////
  * cd C:\Users\Hagard\Documents\GitHub\CompSecReal
  * node server.js
  * 
  * */   
