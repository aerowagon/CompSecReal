const express = require('express');
const mysql = require('mysql');
const path = require('path');
const app = express();
const cookieParser = require('cookie-parser');
const port = 3000;

// Parse form and JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the current directory
app.use(express.static(path.join(__dirname)));

//use cookie parser to parse cookies yay
app.use(cookieParser());

// Connect to MySQL
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',        // your root password if needed
  database: 'compsec_project' /*Database 1*/
});

const authdb = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',        // same here
  database: 'compsec_project_auth'  /*Database 2*/
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
   /* blugold_ID,*/
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
    authdb.query(insertAuth, [email, password], (err, authResult) => {
      if (err) {
        console.error('Insert auth error:', err);
        return res.status(500).json({ message: 'Failed to insert authentication' });
      }

      // Step 3: Insert into role-specific table
      let roleQuery = '';
      const commonParams = [sys_ID, email, f_name, l_name, 0, address || '', city || '', add_city || '', zip_code || null];

      /*if (role === 'student') {
        roleQuery = 'INSERT INTO students (sys_ID, f_name, l_name, GPA, address, city, add_city, zip_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
        commonParams.splice(1, 0, blugold_ID); // insert blugold_ID after sys_ID
      } else if (role === 'faculty') {
        roleQuery = 'INSERT INTO professors (sys_ID, email, f_name, l_name, GPA, address, city, add_city, zip_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
      } else {
        return res.status(400).json({ message: 'Invalid role specified' });
      }*/

        /////I replaced the above commented out code with this://////

        if (role === 'student') {
  // Students table doesn’t need blugold_ID manually — MySQL handles it
      roleQuery = `
        INSERT INTO students (sys_ID, email, f_name, l_name, GPA, address, city, add_city, zip_code)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
    } else if (role === 'faculty') {
      roleQuery = `
        INSERT INTO professors (sys_ID, email, f_name, l_name, GPA, address, city, add_city, zip_code)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
    } else {
      return res.status(400).json({ message: 'Invalid role specified' });
    }


      db.query(roleQuery, commonParams, (err, roleResult) => {
        if (err) {
          console.error('Insert role error:', err);
          return res.status(500).json({ message: 'Failed to insert into role table' });
        }

        // If user is a student, also insert into bank table
       if (role === 'student') {
        const insertBank = 'INSERT INTO bank (sys_ID, credit) VALUES (?, ?)';
        db.query(insertBank, [sys_ID, 0], (err, bankResult) => {
          if (err) {
            console.error('Insert bank error:', err);
          } else {
            console.log('Bank row inserted:', bankResult);
          }
        });
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


// get faculty info 
app.get('/faculty-info/:sys_ID', (req, res) => {
  const { sys_ID } = req.params;
  const query = `
    SELECT * FROM professors WHERE sys_ID = ?
  `;

  db.query(query, [sys_ID], (err, results) => {
    if (err) {
      console.error('Failed to fetch faculty:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'Faculty not found' });
    }

    res.json(results[0]);
  });
});



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

// Goto student page
app.get('/student/:blugold_ID', (req, res) => {
  const { blugold_ID } = req.params;
  const query = `
    SELECT s.*, b.credit 
    FROM students s 
    LEFT JOIN bank b ON s.sys_ID = b.sys_ID 
    WHERE blugold_ID = ?
  `;

  db.query(query, [blugold_ID], (err, results) => {
    if (err) {
      console.error('Failed to fetch student by ID:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.json(results[0]);
  });
});



/////////// login page  /////////////

app.post('/login', (req, res) => {
  const { email, password } = req.body;

  // Step 1: Check authentication
  const authQuery = 'SELECT * FROM authentication WHERE email = ? AND password = ?';
  authdb.query(authQuery, [email, password], (err, authResults) => {
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

      const sys_ID = userResults[0].sys_ID;

      // Step 3: Check if sys_ID is in students
      const studentQuery = 'SELECT * FROM students WHERE sys_ID = ?';
      db.query(studentQuery, [sys_ID], (err, studentResults) => {
        if (err) {
          console.error('Student lookup error:', err);
          return res.status(500).json({ message: 'Server error checking student role.' });
        }

        if (studentResults.length > 0) {
          //create session token
          let sess_token = Math.random(1000000,999999);
          //create session
          db.query('INSERT INTO sessions (email, sess_token, permissions) VALUES (?,?,?);', [email, sess_token, 0], (err, authResult) => {
            if (err) {
            console.error('Session error:', err);
          } else {
            console.log('Session created:', authResult);
          }
          });

          res.cookie("session", sess_token);

          return res.json({
            message: 'Login successful as student',
            redirectTo: 'student.html',
            email,
            sys_ID
          });
        }

        // Step 4: Check if sys_ID is in professors
        const profQuery = 'SELECT * FROM professors WHERE sys_ID = ?';
        db.query(profQuery, [sys_ID], (err, profResults) => {
          if (err) {
            console.error('Professor lookup error:', err);
            return res.status(500).json({ message: 'Server error checking professor role.' });
          }

          if (profResults.length > 0) {
            //create session token
          let sess_token = Math.random(1000000,999999);
          //create session
          db.query('INSERT INTO sessions (email, sess_token, permissions) VALUES (?,?,?);', [email, sess_token, 1], (err, authResult) => {
            if (err) {
            console.error('Session error:', err);
          } else {
            console.log('Session created:', authResult);
          }
          });

          res.cookie("session", sess_token);


            return res.json({
              message: 'Login successful as faculty',
              redirectTo: 'faculty.html',
              email,
              sys_ID
            });
          }

          // If sys_ID found but not tied to student or professor
          return res.status(403).json({ message: 'User has no associated role.' });
        });
      });
    });
  });
});

////// faculty personal info ///////

app.put('/update-faculty/:sys_ID', (req, res) => {
  const { sys_ID } = req.params;
  const { email, address, city, add_city, zip_code, phone } = req.body;

const updateQuery = `
  UPDATE professors
  SET email = ?, address = ?, city = ?, add_city = ?, zip_code = ?, phone = ?
  WHERE sys_ID = ?
`;


  db.query(updateQuery, [email, address, city, add_city, zip_code, phone, sys_ID], (err, result) => {
    if (err) {
      console.error('Failed to update faculty info:', err);
      return res.status(500).json({ message: 'Failed to update faculty info' });
    }

    return res.json({ message: 'Faculty information updated successfully' });
  });
});


////// student personal info ///////

app.put('/update-student-info/:sys_ID', (req, res) => {
  const { sys_ID } = req.params;
  const { email, address, city, add_city, zip_code, phone } = req.body;

  const updateQuery = `
    UPDATE students
    SET email = ?, address = ?, city = ?, add_city = ?, zip_code = ?, phone = ?
    WHERE sys_ID = ?
  `;

  db.query(updateQuery, [email, address, city, add_city, zip_code, phone, sys_ID], (err, result) => {
    if (err) {
      console.error('Failed to update student info:', err);
      return res.status(500).json({ message: 'Failed to update student info' });
    }

    return res.json({ message: 'Student information updated successfully' });
  });
});





////////////////// editStudent.html ////////////////////////

app.put('/update-student/:blugold_ID', (req, res) => {
  const { blugold_ID } = req.params;
  const { GPA, credit } = req.body;

  // Update GPA in students table
  const updateStudent = 'UPDATE students SET GPA = ? WHERE blugold_ID = ?';
  db.query(updateStudent, [GPA, blugold_ID], (err) => {
    if (err) {
      console.error('Failed to update GPA:', err);
      return res.status(500).json({ message: 'Failed to update GPA' });
    }

    // Update credit in bank table
    const updateBank = `
      UPDATE bank 
      JOIN students ON bank.sys_ID = students.sys_ID 
      SET credit = ? 
      WHERE students.blugold_ID = ?
    `;
    db.query(updateBank, [credit, blugold_ID], (err) => {
      if (err) {
        console.error('Failed to update credits:', err);
        return res.status(500).json({ message: 'Failed to update credits' });
      }

      res.json({ message: 'Student updated successfully' });
    });
  });
});

/////////////////// Student.html page  /////////////////


app.get('/student-by-sysid/:sys_ID', (req, res) => {
  const { sys_ID } = req.params;
  const query = `
    SELECT s.*, b.credit 
    FROM students s 
    LEFT JOIN bank b ON s.sys_ID = b.sys_ID 
    WHERE s.sys_ID = ?
  `;

  db.query(query, [sys_ID], (err, results) => {
    if (err) {
      console.error('Failed to fetch student by sys_ID:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.json(results[0]);
  });
});








  
