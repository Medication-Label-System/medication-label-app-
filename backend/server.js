const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();

// ✅ FIXED FOR DEPLOYMENT: Dynamic port for hosting platforms
const API_BASE_URL = process.env.REACT_APP_API_URL || "https://982f1e1a-2983-404d-a359-a517bdb8eff0-00-1tul3hqr1nf9g.picard.replit.dev";

// ✅ FIXED DATABASE PATH: Use absolute path that works in production
const dbPath =
  process.env.DATABASE_PATH || path.join(__dirname, "medications.db");
const db = new sqlite3.Database(dbPath);

// ✅ ENHANCED CORS: Allow both local and production frontends
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://your-app-name.netlify.app",
      "https://*.netlify.app",
    ],
    credentials: true,
  }),
);

app.use(express.json());

// ✅ HEALTH CHECK - Required by deployment platforms
app.get("/", (req, res) => {
  res.json({
    status: "Backend server is working!",
    message: "Medication Label System API",
    timestamp: new Date().toISOString(),
  });
});

// Test route
app.get("/api/health", (req, res) => {
  res.json({ status: "Backend server is working!" });
});

app.get("/api/medications", (req, res) => {
  const sql = `SELECT d.DrugName, 
               COALESCE(i.InstructionText, 'Take as directed') AS Instruction,
               d.InternationalCode,
               d.active_ingredient  -- Make sure this is included
               FROM tblDrugs d 
               LEFT JOIN tblUsageInstructions i ON d.DrugName = i.DrugName 
               ORDER BY d.DrugName`;

  db.all(sql, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ medications: rows });
  });
});

// PATIENT SEARCH
app.get("/api/patients/search", (req, res) => {
  const { patientId, year } = req.query;

  if (!patientId || !year) {
    return res.json({
      success: false,
      message: "Patient ID and Year are required",
    });
  }

  const pid = parseInt(patientId);
  const yr = parseInt(year);

  if (isNaN(pid) || isNaN(yr)) {
    return res.json({
      success: false,
      message: "Invalid Patient ID or Year format",
    });
  }

  const sql = `SELECT PatientID, Year, PatientName, NationalID 
               FROM patients_correct 
               WHERE PatientID = ? AND Year = ?`;

  db.get(sql, [pid, yr], (err, row) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({
        success: false,
        message: "Database error: " + err.message,
      });
    }

    if (row) {
      res.json({
        success: true,
        patient: row,
        fullId: `${row.PatientID}/${row.Year}`,
      });
    } else {
      res.json({
        success: false,
        message: `Patient not found with ID: ${patientId} and Year: ${year}`,
      });
    }
  });
});

// ADD TO BASKET
app.post("/api/basket/add", (req, res) => {
  const { drugName, instructionText } = req.body;

  if (!drugName) {
    res.status(400).json({ error: "Drug name is required" });
    return;
  }

  const sql = `INSERT INTO tblPrintQueue (DrugName, InstructionText, Selected) 
               VALUES (?, ?, TRUE)`;

  db.run(
    sql,
    [drugName, instructionText || "Take as directed"],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({
        success: true,
        message: "Medication added to basket",
        id: this.lastID,
      });
    },
  );
});

// GET BASKET
app.get("/api/basket", (req, res) => {
  const sql = `SELECT TempID, DrugName, InstructionText FROM tblPrintQueue ORDER BY DrugName`;

  db.all(sql, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ basket: rows });
  });
});

// REMOVE FROM BASKET
app.delete("/api/basket/:id", (req, res) => {
  const { id } = req.params;

  db.run("DELETE FROM tblPrintQueue WHERE TempID = ?", [id], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true, message: "Medication removed from basket" });
  });
});

// CLEAR BASKET
app.delete("/api/basket", (req, res) => {
  db.run("DELETE FROM tblPrintQueue", function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true, message: "Basket cleared" });
  });
});

// LOGIN
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  const sql = `SELECT UserID, UserName, Password, FullName, AccessLevel, IsActive 
               FROM tblUsers 
               WHERE UserName = ? AND IsActive = TRUE`;

  db.get(sql, [username], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    if (row && row.Password === password) {
      res.json({
        success: true,
        user: {
          id: row.UserID,
          username: row.UserName,
          fullName: row.FullName,
          accessLevel: row.AccessLevel,
        },
      });
    } else {
      res.json({
        success: false,
        message: "Invalid username or password",
      });
    }
  });
});

// AUDIT
app.post("/api/audit", (req, res) => {
  const {
    patientId,
    patientYear,
    patientName,
    drugName,
    instructionText,
    printedBy,
  } = req.body;

  const sql = `INSERT INTO tblPrintedLabelsAudit 
               (PatientID, PatientYear, PatientName, DrugName, InstructionText, PrintedBy) 
               VALUES (?, ?, ?, ?, ?, ?)`;

  db.run(
    sql,
    [patientId, patientYear, patientName, drugName, instructionText, printedBy],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ success: true, auditId: this.lastID });
    },
  );
});

// ==================== MANUAL DRUG ADDITION ROUTES ====================

// Add custom drug to database
app.post("/api/medications/custom", (req, res) => {
  const { drugName, instructionText, activeIngredient, internationalCode } =
    req.body;

  if (!drugName) {
    return res.status(400).json({ error: "Drug name is required" });
  }

  // Start a transaction to insert into both tables
  db.serialize(() => {
    // Insert into tblDrugs
    const insertDrugSQL = `
      INSERT OR IGNORE INTO tblDrugs (DrugName, active_ingredient, InternationalCode) 
      VALUES (?, ?, ?)
    `;

    db.run(
      insertDrugSQL,
      [drugName, activeIngredient || null, internationalCode || null],
      function (err) {
        if (err) {
          console.error("Error inserting drug:", err);
          return res
            .status(500)
            .json({ error: "Failed to add drug: " + err.message });
        }

        // If instruction provided, insert into tblUsageInstructions
        if (instructionText && instructionText.trim() !== "") {
          const insertInstructionSQL = `
          INSERT OR REPLACE INTO tblUsageInstructions (DrugName, InstructionText) 
          VALUES (?, ?)
        `;

          db.run(
            insertInstructionSQL,
            [drugName, instructionText.trim()],
            function (err) {
              if (err) {
                console.error("Error inserting instruction:", err);
                // Still return success for the drug, but log the instruction error
                return res.json({
                  success: true,
                  message:
                    "Drug added successfully, but instruction failed to save",
                  drugId: this.lastID,
                });
              }

              res.json({
                success: true,
                message: "Drug and instruction added successfully",
                drugId: this.lastID,
              });
            },
          );
        } else {
          res.json({
            success: true,
            message: "Drug added successfully",
            drugId: this.lastID,
          });
        }
      },
    );
  });
});

// Get all custom drugs (optional - for management)
app.get("/api/medications/custom", (req, res) => {
  const sql = `
    SELECT d.DrugName, i.InstructionText, d.active_ingredient, d.InternationalCode
    FROM tblDrugs d
    LEFT JOIN tblUsageInstructions i ON d.DrugName = i.DrugName
    ORDER BY d.DrugName
  `;

  db.all(sql, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ medications: rows });
  });
});

// Quick add to basket with custom drug (without saving to database)
app.post("/api/basket/custom-quick", (req, res) => {
  const { drugName, instructionText } = req.body;

  if (!drugName) {
    return res.status(400).json({ error: "Drug name is required" });
  }

  const sql = `INSERT INTO tblPrintQueue (DrugName, InstructionText, Selected) VALUES (?, ?, TRUE)`;

  db.run(
    sql,
    [drugName, instructionText || "Take as directed"],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      res.json({
        success: true,
        message: "Custom medication added to basket",
        id: this.lastID,
      });
    },
  );
});

// ==================== PATIENT MANAGEMENT ROUTES ====================

// Get all patients (with pagination for large datasets)
app.get("/api/patients", (req, res) => {
  const { page = 1, limit = 50, search = "" } = req.query;
  const offset = (page - 1) * limit;

  let sql = `SELECT PatientID, Year, PatientName, NationalID FROM patients_correct`;
  let countSql = `SELECT COUNT(*) as total FROM patients_correct`;
  let params = [];

  if (search) {
    const searchFilter = ` WHERE PatientName LIKE ? OR PatientID LIKE ? OR NationalID LIKE ?`;
    sql += searchFilter;
    countSql += searchFilter;
    const searchTerm = `%${search}%`;
    params = [searchTerm, searchTerm, searchTerm];
  }

  sql += ` ORDER BY PatientID DESC, Year DESC LIMIT ? OFFSET ?`;

  db.serialize(() => {
    // Get total count
    db.get(countSql, params, (err, countResult) => {
      if (err) {
        console.error("Count error:", err);
        return res.status(500).json({ error: err.message });
      }

      // Get patients data
      db.all(sql, [...params, parseInt(limit), offset], (err, rows) => {
        if (err) {
          console.error("Patients fetch error:", err);
          return res.status(500).json({ error: err.message });
        }

        res.json({
          success: true,
          patients: rows,
          total: countResult.total,
          page: parseInt(page),
          totalPages: Math.ceil(countResult.total / limit),
        });
      });
    });
  });
});

// Add new patient
app.post("/api/patients", (req, res) => {
  const { patientId, year, patientName, nationalId } = req.body;

  // Validation
  if (!patientId || !year || !patientName) {
    return res.status(400).json({
      success: false,
      message: "Patient ID, Year, and Patient Name are required",
    });
  }

  // Check if patient already exists
  const checkSql = `SELECT * FROM patients_correct WHERE PatientID = ? AND Year = ?`;

  db.get(checkSql, [patientId, year], (err, existingPatient) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (existingPatient) {
      return res.status(400).json({
        success: false,
        message: `Patient with ID ${patientId} and Year ${year} already exists`,
      });
    }

    // Insert new patient
    const insertSql = `
      INSERT INTO patients_correct (PatientID, Year, PatientName, NationalID) 
      VALUES (?, ?, ?, ?)
    `;

    db.run(
      insertSql,
      [patientId, year, patientName, nationalId || null],
      function (err) {
        if (err) {
          console.error("Insert patient error:", err);
          return res.status(500).json({ error: err.message });
        }

        res.json({
          success: true,
          message: "Patient added successfully",
          patient: {
            PatientID: patientId,
            Year: year,
            PatientName: patientName,
            NationalID: nationalId,
            fullId: `${patientId}/${year}`,
          },
          id: this.lastID,
        });
      },
    );
  });
});

// Update patient
app.put("/api/patients/:patientId/:year", (req, res) => {
  const { patientId, year } = req.params;
  const { patientName, nationalId } = req.body;

  if (!patientName) {
    return res.status(400).json({
      success: false,
      message: "Patient Name is required",
    });
  }

  const sql = `
    UPDATE patients_correct 
    SET PatientName = ?, NationalID = ? 
    WHERE PatientID = ? AND Year = ?
  `;

  db.run(
    sql,
    [patientName, nationalId || null, patientId, year],
    function (err) {
      if (err) {
        console.error("Update patient error:", err);
        return res.status(500).json({ error: err.message });
      }

      if (this.changes === 0) {
        return res.status(404).json({
          success: false,
          message: "Patient not found",
        });
      }

      res.json({
        success: true,
        message: "Patient updated successfully",
      });
    },
  );
});

// Delete patient
app.delete("/api/patients/:patientId/:year", (req, res) => {
  const { patientId, year } = req.params;

  const sql = `DELETE FROM patients_correct WHERE PatientID = ? AND Year = ?`;

  db.run(sql, [patientId, year], function (err) {
    if (err) {
      console.error("Delete patient error:", err);
      return res.status(500).json({ error: err.message });
    }

    if (this.changes === 0) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    res.json({
      success: true,
      message: "Patient deleted successfully",
    });
  });
});

// Get patient by ID and Year
app.get("/api/patients/:patientId/:year", (req, res) => {
  const { patientId, year } = req.params;

  const sql = `SELECT PatientID, Year, PatientName, NationalID FROM patients_correct WHERE PatientID = ? AND Year = ?`;

  db.get(sql, [patientId, year], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (!row) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    res.json({
      success: true,
      patient: {
        ...row,
        fullId: `${row.PatientID}/${row.Year}`,
      },
    });
  });
});

// ==================== ADMIN & USER MANAGEMENT ROUTES ====================

// Admin credentials
const ADMIN_USERNAME = "mahmoud_abdelkader";
const ADMIN_PASSWORD = "12345";

// Admin login
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    res.json({ 
      success: true, 
      message: "Admin access granted",
      user: { 
        username: username, 
        fullName: "System Administrator",
        role: "admin",
        permissions: ["all"]
      }
    });
  } else {
    res.status(403).json({ 
      success: false, 
      message: "Admin access denied. Invalid credentials." 
    });
  }
});

// Get all users
app.get("/api/admin/users", (req, res) => {
  const sql = `SELECT UserID, UserName, FullName, AccessLevel, IsActive FROM tblUsers ORDER BY UserName`;

  db.all(sql, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ 
      success: true, 
      users: rows 
    });
  });
});

// Add new user
app.post("/api/admin/users", (req, res) => {
  const { username, password, fullName, accessLevel, isActive } = req.body;

  if (!username || !password || !fullName) {
    return res.status(400).json({ 
      success: false, 
      message: 'Username, password, and full name are required' 
    });
  }

  // Check if user already exists
  const checkSql = `SELECT * FROM tblUsers WHERE UserName = ?`;

  db.get(checkSql, [username], (err, existingUser) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: `User with username ${username} already exists`
      });
    }

    // Insert new user
    const insertSql = `
      INSERT INTO tblUsers (UserName, Password, FullName, AccessLevel, IsActive) 
      VALUES (?, ?, ?, ?, ?)
    `;

    db.run(insertSql, [username, password, fullName, accessLevel || 'user', isActive !== false], function(err) {
      if (err) {
        console.error('Insert user error:', err);
        return res.status(500).json({ error: err.message });
      }

      res.json({
        success: true,
        message: 'User added successfully',
        user: {
          UserID: this.lastID,
          UserName: username,
          FullName: fullName,
          AccessLevel: accessLevel || 'user',
          IsActive: isActive !== false
        }
      });
    });
  });
});

// Update user
app.put("/api/admin/users/:userId", (req, res) => {
  const { userId } = req.params;
  const { username, fullName, accessLevel, isActive, password } = req.body;

  if (!username || !fullName) {
    return res.status(400).json({ 
      success: false, 
      message: 'Username and full name are required' 
    });
  }

  let sql, params;

  if (password) {
    sql = `
      UPDATE tblUsers 
      SET UserName = ?, Password = ?, FullName = ?, AccessLevel = ?, IsActive = ? 
      WHERE UserID = ?
    `;
    params = [username, password, fullName, accessLevel || 'user', isActive !== false, userId];
  } else {
    sql = `
      UPDATE tblUsers 
      SET UserName = ?, FullName = ?, AccessLevel = ?, IsActive = ? 
      WHERE UserID = ?
    `;
    params = [username, fullName, accessLevel || 'user', isActive !== false, userId];
  }

  db.run(sql, params, function(err) {
    if (err) {
      console.error('Update user error:', err);
      return res.status(500).json({ error: err.message });
    }

    if (this.changes === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User updated successfully'
    });
  });
});

// Delete user
app.delete("/api/admin/users/:userId", (req, res) => {
  const { userId } = req.params;

  // Prevent admin from deleting themselves
  if (userId === "1") { // Assuming admin has ID 1
    return res.status(400).json({
      success: false,
      message: 'Cannot delete system administrator'
    });
  }

  const sql = `DELETE FROM tblUsers WHERE UserID = ?`;

  db.run(sql, [userId], function(err) {
    if (err) {
      console.error('Delete user error:', err);
      return res.status(500).json({ error: err.message });
    }

    if (this.changes === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  });
});

// Get system statistics
app.get("/api/admin/statistics", (req, res) => {
  const statistics = {};

  // Count medications
  db.get("SELECT COUNT(*) as count FROM tblDrugs", (err, medResult) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    statistics.medicationsCount = medResult.count;

    // Count patients
    db.get("SELECT COUNT(*) as count FROM patients_correct", (err, patientResult) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      statistics.patientsCount = patientResult.count;

      // Count users
      db.get("SELECT COUNT(*) as count FROM tblUsers", (err, userResult) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        statistics.usersCount = userResult.count;

        // Count audit logs
        db.get("SELECT COUNT(*) as count FROM tblPrintedLabelsAudit", (err, auditResult) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          statistics.auditLogsCount = auditResult.count;

          res.json({
            success: true,
            statistics: statistics
          });
        });
      });
    });
  });
});

// Get recent activity
app.get("/api/admin/recent-activity", (req, res) => {
  const sql = `
    SELECT * FROM tblPrintedLabelsAudit 
    ORDER BY PrintDate DESC 
    LIMIT 50
  `;

  db.all(sql, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ 
      success: true, 
      activities: rows 
    });
  });
});

// Check if user has specific permissions
app.post("/api/admin/check-permissions", (req, res) => {
  const { username, permissions } = req.body;

  // For now, only admin has special permissions
  // In a real system, you'd check against a permissions table
  if (username === ADMIN_USERNAME) {
    res.json({
      success: true,
      hasPermissions: true,
      permissions: ["all"]
    });
  } else {
    res.json({
      success: true,
      hasPermissions: false,
      permissions: []
    });
  }
});

// ==================== DEBUG ROUTES ====================

// Test patients route
app.get("/api/patients/test", (req, res) => {
  console.log("✅ Patients test route called");
  res.json({ 
    success: true, 
    message: "Patients API is working!",
    timestamp: new Date().toISOString()
  });
});

// Diagnostic route to check patients table
app.get("/api/patients/debug", (req, res) => {
  console.log("🔧 Debug route called");

  // Check if table exists
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='patients_correct'", (err, row) => {
    if (err) {
      console.error("❌ Database error:", err);
      return res.status(500).json({ error: err.message });
    }

    if (!row) {
      console.log("❌ patients_correct table does not exist");
      return res.json({ 
        success: false, 
        message: "patients_correct table does not exist",
        tableExists: false
      });
    }

    console.log("✅ patients_correct table exists");

    // Count records
    db.get("SELECT COUNT(*) as count FROM patients_correct", (err, countResult) => {
      if (err) {
        console.error("❌ Count error:", err);
        return res.status(500).json({ error: err.message });
      }

      console.log(`📊 Table has ${countResult.count} records`);
      res.json({
        success: true,
        message: "patients_correct table exists",
        tableExists: true,
        recordCount: countResult.count,
        timestamp: new Date().toISOString()
      });
    });
  });
});

// Initialize patients table if it doesn't exist
app.get("/api/patients/init", (req, res) => {
  console.log("🔄 Initializing patients table...");

  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS patients_correct (
      PatientID INTEGER,
      Year INTEGER,
      PatientName TEXT NOT NULL,
      NationalID TEXT,
      PRIMARY KEY (PatientID, Year)
    )
  `;

  db.run(createTableSQL, function(err) {
    if (err) {
      console.error("❌ Table creation error:", err);
      return res.status(500).json({ error: err.message });
    }

    console.log("✅ Patients table created/verified successfully");

    // Add a sample patient
    const insertSampleSQL = `
      INSERT OR IGNORE INTO patients_correct (PatientID, Year, PatientName, NationalID) 
      VALUES (1001, 25, 'Sample Patient', '123456789')
    `;

    db.run(insertSampleSQL, function(err) {
      if (err) {
        console.error("❌ Sample insert error:", err);
        return res.status(500).json({ error: err.message });
      }

      res.json({
        success: true,
        message: "Patients table initialized successfully with sample data",
        changes: this.changes
      });
    });
  });
});

// ==================== ADMIN ROUTES ====================
const requireAdmin = (req, res, next) => {
  const { username, password } = req.body;

  const ADMIN_USERNAME = "admin";
  const ADMIN_PASSWORD = "admin123";

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    next();
  } else {
    res.status(403).json({ 
      success: false, 
      message: "Admin access denied. Invalid credentials." 
    });
  }
};

// Execute SQL query
app.post("/api/admin/database/query", requireAdmin, (req, res) => {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: "SQL query is required" });
  }

  if (query.trim().toUpperCase().startsWith("SELECT")) {
    db.all(query, (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ success: true, results: rows, count: rows.length });
      }
    });
  } else {
    db.run(query, function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({
          success: true,
          message: "Query executed successfully",
          changes: this.changes,
        });
      }
    });
  }
});

// Get table data
app.post("/api/admin/database/table/:tableName", requireAdmin, (req, res) => {
  const { tableName } = req.params;

  db.all(`SELECT * FROM ${tableName} LIMIT 100`, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ success: true, data: rows });
    }
  });
});

// ✅ ENHANCED ERROR HANDLING
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(500).json({ error: "Something went wrong!" });
});

// ✅ START SERVER
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Database: ${dbPath}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`💊 Medication Label System Ready!`);
});
// ================ ✅ ENHANCED KEEP-ALIVE ================
console.log("🟢 Setting up enhanced keep-alive service...");

const startEnhancedKeepAlive = () => {
  const http = require('http');
  const https = require('https');

  const pingEndpoints = () => {
    const baseUrl = process.env.REPLIT_DOMAIN ? 
      `https://${process.env.REPLIT_DOMAIN}` : 
      `http://localhost:${PORT}`;

    console.log(`🔄 [${new Date().toLocaleTimeString()}] Pinging endpoints...`);

    // Ping multiple endpoints to ensure all routes are active
    const endpoints = [
      '/api/health',
      '/api/medications',
      '/api/basket',
      '/'
    ];

    let successCount = 0;
    let failCount = 0;

    endpoints.forEach(endpoint => {
      const url = baseUrl + endpoint;
      const protocol = url.startsWith('https') ? https : http;

      const req = protocol.get(url, (res) => {
        successCount++;
        console.log(`✅ ${endpoint} - ${res.statusCode}`);
      });

      req.on('error', (err) => {
        failCount++;
        console.log(`❌ ${endpoint} - ${err.message}`);
      });

      req.on('timeout', () => {
        failCount++;
        console.log(`⏰ ${endpoint} - Timeout`);
        req.destroy();
      });

      req.setTimeout(10000); // 10 second timeout
    });

    // Log summary
    setTimeout(() => {
      console.log(`📊 Ping Summary: ${successCount} successful, ${failCount} failed`);

      if (failCount > 2) {
        console.log('🚨 Warning: Multiple endpoints failing - app might be sleeping');
      }
    }, 11000);
  };

  // Wait 30 seconds for server to fully start
  setTimeout(() => {
    // Ping every 3 minutes (180000 ms) - more frequent than Replit's 5-minute sleep
    setInterval(pingEndpoints, 3 * 60 * 1000);

    // Initial ping
    pingEndpoints();

    console.log('✅ Enhanced keep-alive service activated!');
    console.log('⏰ Pinging every 3 minutes to prevent sleep...');
  }, 30000);
};

// Start enhanced keep-alive
startEnhancedKeepAlive();