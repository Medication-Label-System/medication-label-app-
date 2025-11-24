const { exec } = require("child_process");
const https = require("https");

console.log("🚀 Starting server...");

// Start your main server
const serverProcess = exec("node server.js", (error, stdout, stderr) => {
  if (error) {
    console.error(`❌ Server error: ${error}`);
    return;
  }
  console.log(stdout);
  console.error(stderr);
});

// Wait 10 seconds for server to start, then start pinging
setTimeout(() => {
  console.log("🟢 Starting keep-alive service...");

  function keepAlive() {
    const url = `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;

    console.log(`🔄 Pinging server at ${new Date().toLocaleTimeString()}`);

    https
      .get(url, (res) => {
        console.log(`✅ Server responded with status: ${res.statusCode}`);
      })
      .on("error", (err) => {
        console.log("❌ Ping error:", err.message);
      });
  }

  // Ping every 4 minutes
  setInterval(keepAlive, 240000);
  keepAlive(); // Initial ping
}, 10000);

// Handle process cleanup
process.on("SIGINT", () => {
  console.log("🛑 Shutting down...");
  serverProcess.kill();
  process.exit();
});
