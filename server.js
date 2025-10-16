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

///////////////////  admin page ////////////////////////////////

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

/////////// faculty page////////////////////////

//to get names of students for 
app.get('/get-students', (req, res) => {
  const query = 'SELECT f_name, l_name, blugold_ID FROM students';

  db.query(query, (err, results) => {
    if (err) {
      console.error('Failed to fetch students:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    res.json(results); // returns an array of student objects
  });
});



/////////// login page  /////////////

app.post('/login', (req, res) => {
  const { email, password } = req.body;

  // Step 1: Check authentication
  const authQuery = 'SELECT * FROM authentication WHERE email = ? AND password = ?';
  db.query(authQuery, [email, password], (err, authResults) => {
    if (err) {
      console.error('Auth error:', err);
      return res.status(500).json({ message: 'Server error during login.' });
    }

    if (authResults.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Step 2: Get sys_ID from users table
    const userQuery = 'SELECT sys_ID FROM users WHERE email = ?';
    db.query(userQuery, [email], (err, userResults) => {
      if (err) {
        console.error('User lookup error:', err);
        return res.status(500).json({ message: 'Server error during user lookup.' });
      }

      if (userResults.length === 0) {
        return res.status(403).json({ message: 'User not registered in system.' });
      }

      const sysID = userResults[0].sys_ID;

      // Step 3: Check if sys_ID is in students
      const studentQuery = 'SELECT * FROM students WHERE sys_ID = ?';
      db.query(studentQuery, [sysID], (err, studentResults) => {
        if (err) {
          console.error('Student lookup error:', err);
          return res.status(500).json({ message: 'Server error checking student role.' });
        }

        if (studentResults.length > 0) {
          return res.json({
            message: 'Login successful as student',
            redirectTo: 'student.html'
          });
        }

        // Step 4: Check if sys_ID is in professors
        const profQuery = 'SELECT * FROM professors WHERE sys_ID = ?';
        db.query(profQuery, [sysID], (err, profResults) => {
          if (err) {
            console.error('Professor lookup error:', err);
            return res.status(500).json({ message: 'Server error checking professor role.' });
          }

          if (profResults.length > 0) {
            return res.json({
              message: 'Login successful as faculty',
              redirectTo: 'faculty.html'
            });
          }

          // If sys_ID found but not tied to student or professor
          return res.status(403).json({ message: 'User has no associated role.' });
        });
      });
    });
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
  * cd  C:\Program Files\MySQL\MySQL Server 8.0\bin
  * mysql -u user -p
  * 
  * /// Node.js  ///////
  * cd C:\Users\Hagard\Documents\GitHub\CompSecReal
  * node server.js
  * 
  * */   
