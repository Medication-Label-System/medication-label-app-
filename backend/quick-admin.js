// quick-admin.js - Simple database admin tool
const sqlite3 = require('sqlite3').verbose();
const readline = require('readline');

const db = new sqlite3.Database('medications.db');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🛠️  QUICK DATABASE ADMIN TOOL');
console.log('=============================');

function showMenu() {
  console.log('\nChoose an option:');
  console.log('1. Add active_ingredient column to tblDrugs');
  console.log('2. View table structure');
  console.log('3. Run custom SQL query');
  console.log('4. View medications data');
  console.log('5. Exit');

  rl.question('Enter choice (1-5): ', handleChoice);
}

function handleChoice(choice) {
  switch(choice) {
    case '1':
      addActiveIngredientColumn();
      break;
    case '2':
      viewTableStructure();
      break;
    case '3':
      runCustomQuery();
      break;
    case '4':
      viewMedicationsData();
      break;
    case '5':
      console.log('Goodbye!');
      rl.close();
      db.close();
      break;
    default:
      console.log('Invalid choice. Please try again.');
      showMenu();
  }
}

function addActiveIngredientColumn() {
  console.log('\n🔄 Adding active_ingredient column...');

  db.run(`ALTER TABLE tblDrugs ADD COLUMN active_ingredient TEXT`, (err) => {
    if (err) {
      console.log('❌ Error:', err.message);
    } else {
      console.log('✅ SUCCESS: active_ingredient column added to tblDrugs!');
    }
    showMenu();
  });
}

function viewTableStructure() {
  console.log('\n📊 Database Structure:');

  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    if (err) {
      console.log('Error:', err.message);
      showMenu();
      return;
    }

    tables.forEach((table, index) => {
      console.log(`\nTable: ${table.name}`);
      db.all(`PRAGMA table_info(${table.name})`, (err, columns) => {
        if (err) {
          console.log('  Error reading table structure');
        } else {
          columns.forEach(col => {
            console.log(`  📍 ${col.name} (${col.type})`);
          });
        }

        if (index === tables.length - 1) {
          showMenu();
        }
      });
    });
  });
}

function runCustomQuery() {
  rl.question('\nEnter SQL query: ', (query) => {
    if (query.trim().toUpperCase().startsWith('SELECT')) {
      db.all(query, (err, rows) => {
        if (err) {
          console.log('❌ Error:', err.message);
        } else {
          console.log(`✅ Query successful. Found ${rows.length} rows:`);
          console.table(rows);
        }
        showMenu();
      });
    } else {
      db.run(query, function(err) {
        if (err) {
          console.log('❌ Error:', err.message);
        } else {
          console.log(`✅ Query successful. ${this.changes} rows affected.`);
        }
        showMenu();
      });
    }
  });
}

function viewMedicationsData() {
  console.log('\n💊 Medications Data (first 10 rows):');

  db.all("SELECT DrugName, InternationalCode, active_ingredient FROM tblDrugs LIMIT 10", (err, rows) => {
    if (err) {
      console.log('Error:', err.message);
    } else {
      console.table(rows);
      console.log(`\nTotal medications: (run "SELECT COUNT(*) FROM tblDrugs" to see count)`);
    }
    showMenu();
  });
}

// Start the tool
showMenu();