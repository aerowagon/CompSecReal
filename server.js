const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const app = express();
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const axios = require('axios');

//https additions
const https = require('https');
const fs = require('fs');


const port = 3000;

// Parse form and JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the current directory
app.use(express.static(path.join(__dirname)));

//use cookie parser to parse cookies yay
app.use(cookieParser());



// UPDATE LAST_SEEN ON EVERY REQUEST (heartbeat)
app.use((req, res, next) => {
  const sess = req.cookies['session'];
  if (sess) {
    db.query(
      "UPDATE sessions SET last_seen = NOW() WHERE sess_token = ? AND valid = 1",
      [sess]
    );
  }
  next();
});

// SECURITY: Prevent caching of authenticated pages
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

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

// ADD THIS EMAIL CONFIGURATION AFTER YOUR DATABASE CONNECTIONS
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com', // or your SMTP server
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'your_email@uwec.edu',
    pass: process.env.SMTP_PASS || 'your_app_password'
  }
});

// Start the server
//app.listen(port, () => {
  //console.log(`Server running at http://localhost:${port}/`);
//});

//https update
const httpsOptions = {
  key: fs.readFileSync(path.join(__dirname, 'certs', 'localhost-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'certs', 'localhost.pem')),
};

https.createServer(httpsOptions, app).listen(port, () => {
  console.log(`HTTPS server running at https://localhost:${port}/`);
});



async function updateInfo(table, sys_ID, sess_token) {
  console.log('updating table ' + table + ' row ' + sys_ID + ' in session ' + sess_token);

  const query = `INSERT INTO updates
                (sess_token, updated_table, sys_ID_edited)
                VALUES (?, ?, ?);`

  db.query(query, [sess_token, table, sys_ID], (err, results) => {
    if (err) {
          console.error('Update error:', err);
        }
  })

}

async function hashPassword(password) {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    return hashedPassword;
}

async function checkPassword(password, hashedPassword) {
    const match = await bcrypt.compare(password, hashedPassword);
    return match;
}

async function hashUsername(username) {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(username, saltRounds);
    return hashedPassword;
}

async function checkUsername(username, hashedUsername) {
    const match = await bcrypt.compare(username, hashedUsername);
    return match;
}


app.post('/add-user', (req, res) => {
  const {
    email,
    password,
    f_name,
    l_name,
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
  let sys_ID = null;
  let sess_token = req.cookies['session'];

  // Step 1: Insert into `users`
  const insertUser = 'INSERT INTO users (email) VALUES (?)';
  db.query(insertUser, [email], (err, userResult) => {
    if (err) {
      console.error('Insert user error:', err);
      return res.status(500).json({ message: 'Failed to insert user' });
    }

    hashUsername(email).then((hashedUsername) => {

    hashPassword(password).then((hashedPassword) => {

    // Step 2: Insert into `authentication`
    const insertAuth = 'INSERT INTO authentication (email, password) VALUES (?, ?)';
    authdb.query(insertAuth, [hashedUsername, hashedPassword], (err, authResult) => {
      if (err) {
        console.error('Insert auth error:', err);
        return res.status(500).json({ message: 'Failed to insert authentication' });
      }

      idQuery = `SELECT sys_ID from users WHERE email = ?`;
      console.log(email);
      db.query(idQuery, [email], (err, emailResult) => {
        console.log(emailResult);
        let table = 'authentication';
        sys_ID = emailResult[0].sys_ID;
        updateInfo(table, sys_ID, sess_token);
        table = 'users';
        updateInfo(table, sys_ID, sess_token);
      
      //insert into update table

      // Step 3: Insert into role-specific table
      let roleQuery = '';
      const commonParams = [sys_ID, email, f_name, l_name, address || '', city || '', add_city || '', zip_code || null];

      db.query("SET @session_user = ?, @session_email = ?", [sess_token, email])

    if (role === 'student') {
  // Students table doesn’t need blugold_ID manually — MySQL handles it
      roleQuery = `
        INSERT INTO students (sys_ID, email, f_name, l_name, GPA, address, city, add_city, zip_code)
        VALUES (?, ?, ?, ?, 0.00, ?, ?, ?, ?)
      `;
      table = 'students';
      updateInfo(table, sys_ID, sess_token);
    } else if (role === 'faculty') {
      roleQuery = `
        INSERT INTO professors (sys_ID, email, f_name, l_name, GPA, address, city, add_city, zip_code)
        VALUES (?, ?, ?, ?, 0.00, ?, ?, ?, ?)
      `;
      table = 'professors';
      updateInfo(table, sys_ID, sess_token);
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
      console.log('Student role detected, inserting into bank. sys_ID:', sys_ID);


        const insertBank = 'INSERT INTO bank (sys_ID, account_balance) VALUES (?, ?)';
        db.query(insertBank, [sys_ID, 0], (err, bankResult) => {
          if (err) {
            console.error('Insert bank error:', err);
          } else {
            table = 'bank';
            updateInfo(table, sys_ID, sess_token);
          }
        });
      }

        return res.status(200).json({ message: 'User successfully added' });
      });
      });
    });
    });
  });
  })
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
    SELECT s.*, b.account_balance 
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

///autologin for page
app.get('/session', (req, res) => {
  const cookie = req.cookies['session'];

  if (!cookie) {
    console.log('no cookie found');
    return res.json({
      status: 'false',
      info: 'https://localhost:3000/login.html'
    });
  }

  else {
    const sess_token = cookie;
    let permissions = null;

    // Check for session token AND validity
    const query = 'SELECT permissions, email, valid FROM sessions WHERE sess_token = ? AND valid = 1;';
    db.query(query, [sess_token], (err, authResults) => {
      if(err) {
        console.error('Auth error:', err);
        return res.status(500).json({ message: 'Server error during session verification.' });
      }

      // If no valid session found, clear the cookie
      if (authResults.length === 0) {
        res.clearCookie("session");
        return res.json({
          status: 'false',
          info: 'https://localhost:3000/login.html'
        });
      }

      permissions = authResults[0].permissions;
      
      // Check to see if user is a professor
      if (permissions == 1) {
        const query = 'SELECT sys_ID FROM professors WHERE email = ?';
        db.query(query, [authResults[0].email], (error, result) => {
          if(error) {
            console.error('DB error:', error);
            return res.status(500).json({ message: 'Server error during sys_ID retrieval.' });
          }

          id = result[0].sys_ID;
          return res.json({
            status: 'true',
            permissions,
            id,
            info: 'https://localhost:3000/login.html'
          });
        });
      }

      // See if user is a student
      if (permissions == 0) {
        const query = 'SELECT sys_ID FROM students WHERE email = ?';
        db.query(query, [authResults[0].email], (error, result) => { 
          if(error) {
            console.error('DB error:', error);
            return res.status(500).json({ message: 'Server error during permissions retrieval.' });
          }
          
          id = result[0].sys_ID;
          return res.json({
            status: 'true',
            permissions,
            id,
            info: 'https://localhost:3000/login.html'
          });
        });
      }
    });
  }
});

/////////// login page  /////////////

app.post('/login', (req, res) => {
  const { email, password } = req.body;

  // Step 1: Check authentication
  const authQuery = 'SELECT * FROM authentication';
  authdb.query(authQuery, [email], (err, authResults) => {
    if (err) {
      console.error('Auth error:', err);
      return res.status(500).json({ message: 'Server error during login.' });
    }

    if (authResults.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    authResults.forEach((pair) => {
      let hPassword = pair.password;
      let hUsername = pair.email;

      checkUsername(email, hUsername).then((matchUsername) => {
        if (matchUsername) {
        checkPassword(password, hPassword).then((matchPassword) => {

        if(matchPassword) {
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
                // Create session token
                let sess_token = crypto.randomBytes(16).toString('base64');

                // Create session
                db.query(
                  'INSERT INTO sessions (email, sess_token, permissions, valid) VALUES (?,?,?,1);',
                  [email, sess_token, 0],
                  (err, authResult) => {
                    if (err) console.error('Session error:', err);
                    else console.log('Session created:', authResult);
                  }
                );

                db.query(
                  'INSERT INTO login_log (sys_ID, email, session_token) VALUES (?, ?, ?)',
                  [sys_ID, email, sess_token],
                  (logErr) => {
                    if (logErr) console.error("Failed to write login_log entry:", logErr);
                  }
                );

                res.cookie("session", sess_token, { expire: 5000000000 + Date.now() });

                return res.json({
                  message: 'Login successful as student',
                  redirectTo: 'student.html',
                  email,
                  sys_ID
                });
              }

              // Step 4: Check professors
              const profQuery = 'SELECT * FROM professors WHERE sys_ID = ?';
              db.query(profQuery, [sys_ID], (err, profResults) => {
                if (err) {
                  console.error('Professor lookup error:', err);
                  return res.status(500).json({ message: 'Server error checking professor role.' });
                }

                if (profResults.length > 0) {
                  let sess_token = crypto.randomBytes(4).toString('hex');

                  // Create session entry
                  db.query(
                    'INSERT INTO sessions (email, sess_token, permissions, valid) VALUES (?,?,?,1);',
                    [email, sess_token, 1],
                    (err, authResult) => {
                      if (err) console.error('Session error:', err);
                      else console.log('Session created:', authResult);
                    }
                  );

                  db.query(
                    'INSERT INTO login_log (sys_ID, email, session_token) VALUES (?, ?, ?)',
                    [sys_ID, email, sess_token],
                    (logErr) => {
                      if (logErr) console.error("Failed to write login_log entry:", logErr);
                    }
                  );

                  res.cookie("session", sess_token, { expire: 5000000000 + Date.now() });

                  return res.json({
                    message: 'Login successful as faculty',
                    redirectTo: 'faculty.html',
                    email,
                    sys_ID
                  });
                }

                // sys_ID found but no role
                return res.status(403).json({ message: 'User has no associated role.' });
              });
            });
          });
        }
        });
      }
      });
    });
  });
});

////// faculty personal info ///////

app.put('/update-faculty/:sys_ID', (req, res) => {
  const { sys_ID } = req.params;
  const { email, address, city, add_city, zip_code } = req.body;
  const sess_token = req.cookies['session'];

  // Set session variable for MySQL triggers
  // Get the email of the current session
db.query('SELECT email FROM sessions WHERE sess_token = ? AND valid = 1', [sess_token], (err, results) => {
    if (err || results.length === 0) return res.status(500).json({ message: 'Session error' });
    const email = results[0].email;

    // Set session variables for triggers
    db.query('SET @session_user = ?, @session_email = ?', [sess_token, email], (err) => {
      if (err) return res.status(500).json({ message: 'Failed to set session variables' });

      
      const updateQuery = `
        UPDATE professors
        SET email = ?, address = ?, city = ?, add_city = ?, zip_code = ?
        WHERE sys_ID = ?
      `;

      db.query(updateQuery, [email, address, city, add_city, zip_code, sys_ID], (err) => {
        if (err) {
          console.error('Failed to update faculty info:', err);
          return res.status(500).json({ message: 'Failed to update faculty info' });
        }

        res.json({ message: 'Faculty information updated successfully' });
      });
    });
  });
});


////// student personal info ///////

app.put('/update-student-info/:sys_ID', (req, res) => {
  const { sys_ID } = req.params;
  const { email, address, city, add_city, zip_code } = req.body;
  const sess_token = req.cookies['session'];

  // Get email of the session
  db.query('SELECT email FROM sessions WHERE sess_token = ? AND valid = 1', [sess_token], (err, results) => {
    if (err || results.length === 0) {
      return res.status(500).json({ message: 'Session invalid or DB error' });
    }

    const session_email = results[0].email;

    // Set session variables for triggers
   // Get the email of the current session
  db.query('SELECT email FROM sessions WHERE sess_token = ? AND valid = 1', [sess_token], (err, results) => {
    if (err || results.length === 0) return res.status(500).json({ message: 'Session error' });
    const email = results[0].email;

    // Set session variables for triggers
    db.query('SET @session_user = ?, @session_email = ?', [sess_token, email], (err) => {
      if (err) return res.status(500).json({ message: 'Failed to set session variables' });

        
        const updateQuery = `
          UPDATE students
          SET email = ?, address = ?, city = ?, add_city = ?, zip_code = ?
          WHERE sys_ID = ?
        `;

        db.query(updateQuery, [email, address, city, add_city, zip_code, sys_ID], (err) => {
          if (err) {
            console.error('Failed to update student info:', err);
            return res.status(500).json({ message: 'Failed to update student info' });
          }

          res.json({ message: 'Student information updated successfully' });
        });
      });
    });
  });
});




////////////////// editStudent.html ////////////////////////

app.put('/update-student/:blugold_ID', (req, res) => {
  const { blugold_ID } = req.params;
  const { GPA, account_balance, total_credits } = req.body;
  const sess_token = req.cookies['session'];

  // Validate input
  if (GPA !== undefined && (isNaN(GPA) || GPA < 0 || GPA > 5)) {
    return res.status(400).json({ message: 'Update failed', reason: 'Invalid GPA' });
  }
  if (total_credits !== undefined && (isNaN(total_credits) || total_credits < 0)) {
    return res.status(400).json({ message: 'Update failed', reason: 'Invalid total credits' });
  }
  if (account_balance !== undefined && isNaN(account_balance)) {
    return res.status(400).json({ message: 'Update failed', reason: 'Invalid account balance' });
  }

  // Set session user for triggers
  // Get the email of the current session
  db.query('SELECT email FROM sessions WHERE sess_token = ? AND valid = 1', [sess_token], (err, results) => {
    if (err || results.length === 0) return res.status(500).json({ message: 'Session error' });
    const email = results[0].email;

    // Set session variables for triggers
    db.query('SET @session_user = ?, @session_email = ?', [sess_token, email], (err) => {
          if (err) return res.status(500).json({ message: 'Failed to set session variables' });

      
      // Update students table
      const updateStudent = `
        UPDATE students
        SET GPA = ?, total_credits = ?
        WHERE blugold_ID = ?
      `;
      db.query(updateStudent, [GPA, total_credits, blugold_ID], (err) => {
        if (err) {
          console.error('Failed to update student info:', err);
          return res.status(500).json({ message: 'Failed to update student info' });
        }

        // Update bank table
        const updateBank = `
          UPDATE bank
          JOIN students ON bank.sys_ID = students.sys_ID
          SET account_balance = ?
          WHERE students.blugold_ID = ?
        `;
        db.query(updateBank, [account_balance, blugold_ID], (err) => {
          if (err) {
            console.error('Failed to update account_balance:', err);
            return res.status(500).json({ message: 'Failed to update account_balance' });
          }

          res.json({ message: 'Student updated successfully' });
        });
      });
    });
  });
});




/////////////////// Student.html page  /////////////////


app.get('/student-by-sysid/:sys_ID', (req, res) => {
  console.log('getting by ID');
  const { sys_ID } = req.params;
  const query = `
    SELECT s.*, b.account_balance, s.total_credits
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


//////logout////
app.get('/logout', (req, res) => {
  const sess = req.cookies['session'];
  
  // Clear cookie immediately
  res.clearCookie("session");
  
  if (sess) {
    const query = `UPDATE sessions SET valid = 0 WHERE sess_token = ?`;

    db.query(query, [sess], (err, results) => {
      if (err) {
        console.error('Failed to log out', err);
        return res.status(500).json({ message: 'Database error' });
      }

      db.query(
        `UPDATE login_log
        SET logout_time = NOW(), logout_reason = 'button'
        WHERE session_token = ? AND logout_time IS NULL`,
        [sess],
        (err) => {
          if (err) console.error("Failed to update login_log on logout:", err);
        }
      );

      res.json('https://localhost:3000/login.html');
    });
  } else {
    res.json('https://localhost:3000/login.html');
  }
});

// Session cleanup for tab/browser close
app.post('/session-cleanup', (req, res) => {
  const sess = req.cookies['session'];
  
  if (sess) {
    db.query("UPDATE sessions SET valid = 0 WHERE sess_token = ?", [sess]);
    
    db.query(
      `UPDATE login_log
       SET logout_time = NOW(),
           logout_reason = 'browser_closed'
       WHERE session_token = ?
         AND logout_time IS NULL`,
      [sess]
    );
  }
  
  res.sendStatus(204); // No content
});

//returns id if logged in
app.get(`/get_id`, (req,res) => {
  const sess = req.cookies['session'];


    const emailQuery = 'SELECT email from sessions where sess_token = ? AND valid = 1;'

    db.query(emailQuery, [sess], (err, emailResults) => {
      if (err) {
        console.error('User lookup error:', err);
        return res.status(500).json({ message: 'Server error during user lookup.' });
      }

        const email = emailResults[0].email;

        const idQuery = 'SELECT sys_ID FROM users WHERE email = ?';
        db.query(idQuery, [email], (err, userResults) => {
        if (err) {
          console.error('User lookup error:', err);
          return res.status(500).json({ message: 'Server error during user lookup.' });
        }

        const sys_ID = userResults[0].sys_ID;
        res.json(sys_ID);
      })

  })

})

/*  auto-logout stale sessions ( 5 min) */

setInterval(() => {
  const TIMEOUT_MINUTES = 2; // adjust as needed

  // find stale active sessions
  db.query(
    `SELECT sess_token FROM sessions
     WHERE valid = 1
     AND last_seen < (NOW() - INTERVAL ? MINUTE)`,
    [TIMEOUT_MINUTES],
    (err, rows) => {
      if (err) return console.error("Cleanup error:", err);

      rows.forEach(row => {
        const token = row.sess_token;

        // 1. Invalidate session
        db.query("UPDATE sessions SET valid = 0 WHERE sess_token = ?", [token]);

        // 2. Update login_log
        db.query(
          `UPDATE login_log
           SET logout_time = NOW(),
               logout_reason = 'browser_closed'
           WHERE session_token = ?
             AND logout_time IS NULL`,
          [token]
        );
      });
    }
  );
}, 5 * 60 * 1000);  // every 5 minutes

/* logs.html */

// Get all audit_log entries
app.get('/api/audit-log', (req, res) => {
  const query = 'SELECT * FROM audit_log ORDER BY changed_at DESC';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Failed to fetch audit_log:', err);
      return res.status(500).json({ message: 'Database error' });
    }
    res.json(results);
  });
});

// Get all login_log entries
app.get('/api/login-log', (req, res) => {
  const query = 'SELECT * FROM login_log ORDER BY login_time DESC';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Failed to fetch login_log:', err);
      return res.status(500).json({ message: 'Database error' });
    }
    res.json(results);
  });
});

//verifies the captcha was correct
async function verifyRecaptcha(token) {
  try {
    const response = await axios.post('https://www.google.com/recaptcha/api/siteverify', null, {
      params: {
        secret: process.env.RECAPTCHA_SECRET_KEY || 'your_recaptcha_secret',
        response: token
      }
    });
    return response.data.success;
  } catch (error) {
    console.error('reCAPTCHA verification failed:', error);
    return false;
  }
}

// Password reset routes

// Request password reset
app.post('/request-password-reset', async (req, res) => {
  const { email, recaptcha } = req.body;

  if (!email || !recaptcha) {
    return res.status(400).json({ message: 'Email and reCAPTCHA are required.' });
  }

  // Verify reCAPTCHA
  const isRecaptchaValid = await verifyRecaptcha(recaptcha);
  if (!isRecaptchaValid) {
    return res.status(400).json({ message: 'reCAPTCHA verification failed.' });
  }

  // Check if user exists
  authdb.query('SELECT email FROM authentication WHERE email = ?', [email], (err, users) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'An error occurred. Please try again later.' });
    }

    // Always return success message (security best practice)
    if (users.length === 0) {
      return res.status(200).json({ 
        message: 'If an account exists with this email, a password reset link has been sent.' 
      });
    }

    // Generate secure random token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    
    // Token expires in 1 hour
    const expiresAt = new Date(Date.now() + 3600000);

    // Store token in database
    authdb.query(
      'INSERT INTO password_reset_tokens (email, token, expires_at) VALUES (?, ?, ?)',
      [email, hashedToken, expiresAt],
      (err) => {
        if (err) {
          console.error('Token storage error:', err);
          return res.status(500).json({ message: 'An error occurred. Please try again later.' });
        }

        // Create reset URL
        const resetUrl = `https://localhost:3000/reset-password.html?token=${resetToken}`;

        // Send email
        transporter.sendMail({
          from: '"UWEC Password Reset" <noreply@uwec.edu>',
          to: email,
          subject: 'Password Reset Request',
          html: `
            <h2>Password Reset Request</h2>
            <p>You requested a password reset. Click the link below to reset your password:</p>
            <a href="${resetUrl}">${resetUrl}</a>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
          `
        }, (err) => {
          if (err) {
            console.error('Email error:', err);
            return res.status(500).json({ message: 'Failed to send email.' });
          }

          res.status(200).json({ 
            message: 'If an account exists with this email, a password reset link has been sent.' 
          });
        });
      }
    );
  });
});

// Verify reset token
app.get('/verify-reset-token', (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ valid: false, message: 'Token is required.' });
  }

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  authdb.query(
    'SELECT * FROM password_reset_tokens WHERE token = ? AND expires_at > NOW() AND used = FALSE',
    [hashedToken],
    (err, tokens) => {
      if (err) {
        console.error('Token verification error:', err);
        return res.status(500).json({ valid: false, message: 'An error occurred.' });
      }

      if (tokens.length === 0) {
        return res.status(400).json({ 
          valid: false, 
          message: 'Invalid or expired reset token.' 
        });
      }

      res.status(200).json({ valid: true, email: tokens[0].email });
    }
  );
});

// Reset password with token
app.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ message: 'Token and new password are required.' });
  }

  // Validate password strength
  if (newPassword.length < 8) {
    return res.status(400).json({ 
      message: 'Password must be at least 8 characters long.' 
    });
  }

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  // Find valid token
  authdb.query(
    'SELECT * FROM password_reset_tokens WHERE token = ? AND expires_at > NOW() AND used = FALSE',
    [hashedToken],
    async (err, tokens) => {
      if (err) {
        console.error('Token lookup error:', err);
        return res.status(500).json({ message: 'An error occurred.' });
      }

      if (tokens.length === 0) {
        return res.status(400).json({ 
          message: 'Invalid or expired reset token.' 
        });
      }

      const { email } = tokens[0];

      try {
        // Hash new password
        const hashedPassword = await hashPassword(newPassword);
        const hashedUsername = await hashUsername(newUsername);

        // Update password
        authdb.query(
          'UPDATE authentication SET password = ? WHERE email = ?',
          [hashedPassword, email],
          (err) => {
            if (err) {
              console.error('Password update error:', err);
              return res.status(500).json({ message: 'Failed to update password.' });
            }

            // Mark token as used
            authdb.query(
              'UPDATE password_reset_tokens SET used = TRUE WHERE token = ?',
              [hashedToken],
              (err) => {
                if (err) {
                  console.error('Token update error:', err);
                }

                res.status(200).json({ 
                  message: 'Password successfully reset. You can now log in with your new password.',
                  redirectTo: '/login.html'
                });
              }
            );
          }
        );
      } catch (error) {
        console.error('Password hashing error:', error);
        res.status(500).json({ message: 'An error occurred.' });
      }
    }
  );
});






  
