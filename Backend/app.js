const mysql = require('mysql2');
const express = require('express');
const cors = require('cors');
const app = express();
const bcrypt = require('bcrypt');
const session = require('express-session');
const path = require('path');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(session({
    secret: 'secret_key',
    resave: false,
    saveUninitialized: true
}));

app.use(express.static(path.join(__dirname)));

// MySQL connection
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'new3'
});

connection.connect((err) => {
    if (err) throw err;
    console.log("Database connection successful");
});

// Create tables if not exists
const createUsersTable = `
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    certificate VARCHAR(255),
    intern_detail TEXT,
    degree VARCHAR(255),
    courses TEXT,
    specialization VARCHAR(255),
    linkedin VARCHAR(255),
    phone VARCHAR(20),
    github VARCHAR(255),
    languages TEXT,
    certificates JSON
);
`;

const createBatchesTable = `
CREATE TABLE IF NOT EXISTS batches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    max_students INT DEFAULT 25,
    current_students INT DEFAULT 0
);
`;

const createScoresTable = `
CREATE TABLE IF NOT EXISTS scores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    batch_id INT NOT NULL,
    mcq_score DECIMAL(5, 2) DEFAULT 0,
    project_score DECIMAL(5, 2) DEFAULT 0,
    course_completion DECIMAL(5, 2) DEFAULT 0, 
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (batch_id) REFERENCES batches(id)
);
`;

const createUserBatchesTable = `
CREATE TABLE IF NOT EXISTS user_batches (
    user_id INT NOT NULL,
    batch_id INT NOT NULL,
    PRIMARY KEY (user_id, batch_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (batch_id) REFERENCES batches(id)
);
`;

const createTables = () => {
    connection.query(createUsersTable, (err) => {
        if (err) throw err;
        console.log("Users table created or already exists");
    });

    connection.query(createBatchesTable, (err) => {
        if (err) throw err;
        console.log("Batches table created or already exists");
    });

    connection.query(createScoresTable, (err) => {
        if (err) throw err;
        console.log("Scores table created or already exists");
    });

    connection.query(createUserBatchesTable, (err) => {
        if (err) throw err;
        console.log("User Batches table created or already exists");
    });
};

createTables();

// Middleware to ensure user is authenticated
function ensureAuthenticated(req, res, next) {
    if (req.session.user && req.session.user.id) {
        return next();
    }
    res.redirect('/'); // Redirect to login page if not authenticated
}

// Signup route
app.post('/user', async (req, res) => {
    const { name, email, password } = req.body;

    // Check for missing fields
    if (!name || !email || !password) {
        return res.status(400).send('All fields are required');
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    const insertQuery = 'INSERT INTO users (name, email, password) VALUES (?, ?, ?)';
    connection.query(insertQuery, [name, email, hashedPassword], (err, results) => {
        if (err) {
            console.error("Signup error:", err);
            res.status(500).send("Sign up failed");
        } else {
            req.session.user = { id: results.insertId, email }; // Set user ID in session
            res.redirect('/home');
        }
    });
});

// Sign-in route
app.post('/signin', async (req, res) => {
    const { email, password } = req.body;
    const query1 = "SELECT * FROM users WHERE email = ?";
    
    connection.query(query1, [email], async (err, results) => {
        if (err) {
            console.error("Sign-in error:", err);
            return res.status(500).send("Sign-in failed");
        }
        if (results.length === 0) {
            return res.send("Invalid email");
        }
        const user = results[0];
        try {
            const isMatch = await bcrypt.compare(password, user.password);
            if (isMatch) {
                req.session.user = { id: user.id, email: user.email }; // Set user ID in session
                res.redirect('/home');
            } else {
                res.send("Invalid password");
            }
        } catch (err) {
            console.error(err);
            res.send("Sign-in failed");
        }
    });
});

// Home route (protected by session)
app.get('/home', ensureAuthenticated, (req, res) => {
    return res.sendFile(path.join(__dirname, 'home.html'));
});

// Serve the index page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Register route (protected by session)
app.post('/register', ensureAuthenticated, (req, res) => {
    const { name, certificate, intern_detail, degree, courses, specialization, linkedin, phone, github, languages, certificates } = req.body;
    const certificatess = JSON.stringify([certificates]); // Ensure it's in JSON format

    if (!name || !certificate || !degree) {
        return res.status(400).send('All required fields must be provided');
    }

    const userId = req.session.user.id;
    const sql = `
        UPDATE users
        SET name = ?, certificate = ?, intern_detail = ?, degree = ?, courses = ?, specialization = ?, linkedin = ?, phone = ?, github = ?, languages = ?, certificates = ?
        WHERE id = ?
    `;

    connection.query(sql, [name, certificate, intern_detail, degree, courses, specialization, linkedin, phone, github, languages, certificatess, userId], (err) => {
        if (err) {
            console.log("Error in registration", err);
            return res.status(500).send('Registration failed');
        }

        // Determine the batch based on certificate
        let batchName = '';
        if (certificate === 'AWS' || certificate === 'Java') {
            batchName = 'Java Batch';
        } else if (certificate === 'Azure' || certificate === '.NET') {
            batchName = '.NET Batch';
        } else if (certificate === 'Python' || certificate === 'python') {
            batchName = 'Data Engineering Batch';
        } else {
            batchName = 'General Batch';
        }

        // Find or create the batch
        connection.query('SELECT id, current_students FROM batches WHERE name = ?', [batchName], (err, results) => {
            if (err) {
                console.log("Error finding batch", err);
                return res.status(500).send('Batch assignment failed');
            }

            let batchId;
            if (results.length === 0) {
                // Batch does not exist, create it
                connection.query('INSERT INTO batches (name) VALUES (?)', [batchName], (err, results) => {
                    if (err) {
                        console.log("Error creating batch", err);
                        return res.status(500).send('Batch creation failed');
                    }
                    batchId = results.insertId;
                    addUserToBatch(userId, batchId);
                });
            } else {
                batchId = results[0].id;
                const currentStudents = results[0].current_students;

                if (currentStudents >= 25) {
                    return res.status(400).send('Batch is full');
                }

                addUserToBatch(userId, batchId);
            }
        });
        function addUserToBatch(userId, batchId) {
            // Check if the user is already in the batch
            connection.query('SELECT * FROM user_batches WHERE user_id = ? AND batch_id = ?', [userId, batchId], (err, results) => {
                if (err) {
                    console.log("Error checking user-batch relationship", err);
                    return res.status(500).send('Error checking user-batch relationship');
                }
        
                if (results.length > 0) {
                    // User is already in this batch, handle as needed
                    return res.status(400).send('User is already assigned to this batch');
                }
        
                // Proceed with the insertion if not already assigned
                connection.query('INSERT INTO user_batches (user_id, batch_id) VALUES (?, ?)', [userId, batchId], (err) => {
                    if (err) {
                        console.log("Error adding user to batch", err);
                        return res.status(500).send('User batch assignment failed');
                    }
        
                    // Update the batch count
                    connection.query('UPDATE batches SET current_students = current_students + 1 WHERE id = ?', [batchId], (err) => {
                        if (err) {
                            console.log("Error updating batch count", err);
                            return res.status(500).send('Batch count update failed');
                        }
        
                        res.sendFile(path.join(__dirname, 'home.html'));
                    });
                });
            });
        }
        

    });
});

// Route to add/update scores
// Route to add/update scores
app.post('/update-scores', ensureAuthenticated, (req, res) => {
    const { mcqScore, projectScore,course_completion } = req.body;

    if (mcqScore === undefined || projectScore === undefined  || course_completion === undefined) {

        return res.status(400).send('All fields are required');
    }

    const userId = req.session.user.id;

    // Get the user's batch ID
    connection.query('SELECT batch_id FROM user_batches WHERE user_id = ?', [userId], (err, results) => {
        if (err) {
            console.log("Error fetching batch ID", err);
            return res.status(500).send('Error fetching batch ID');
        }

        if (results.length === 0) {
            return res.status(400).send('User is not assigned to any batch');
        }

        const batchId = results[0].batch_id;

        const sql = `
            INSERT INTO scores (user_id, batch_id, mcq_score, project_score, course_completion)
            VALUES (?, ?, ?, ?,?)
            ON DUPLICATE KEY UPDATE mcq_score = VALUES(mcq_score), project_score = VALUES(project_score),  course_completion=VALUES( course_completion)
        `;

        connection.query(sql, [userId, batchId, mcqScore, projectScore,course_completion], (err) => {
            if (err) {
                console.log("Error updating scores", err);
                return res.status(500).send('Score update failed');
            }
            res.send('Scores updated successfully');
        });
    });
});


app.get('/percentage', (req, res) => {
    if (!req.session.user || !req.session.user.id) {
        return res.status(401).send('User not authenticated');
    }

    const userId = req.session.user.id;

    const query = `
        SELECT 
            s.mcq_score, 
            s.project_score, 
            s.course_completion, 
            b.name AS batch_name
        FROM 
            scores s
        JOIN 
            user_batches ub ON s.user_id = ub.user_id
        JOIN 
            batches b ON ub.batch_id = b.id
        WHERE 
            s.user_id = ?
        ORDER BY 
            s.updated_at DESC 
        LIMIT 1
    `;

    connection.query(query, [userId], (err, results) => {
        if (err) {
            console.log("Error fetching scores", err);
            return res.status(500).send('Error fetching scores');
        }

        if (results.length === 0) {
            return res.status(404).send('No scores found for this user');
        }

        const { mcq_score, project_score, course_completion, batch_name } = results[0];
        
        res.send({ 
            mcqScore: mcq_score || 0, // Default to 0 if undefined
            projectScore: project_score || 0, // Default to 0 if undefined
            coursepercent: course_completion || 0, // Default to 0 if undefined
            batchName: batch_name // Add the batch name to the response
        });
    });
});


// Start server
app.listen(2001, () => {
    console.log("Server running on port 2001");
});
