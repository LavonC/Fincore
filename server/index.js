// server.js
const express = require("express");
const app = express();
const PORT = 3000; // you can change this to any port

// Define API route
app.get("/hello", (req, res) => {
  res.send("Hello World");
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}/hello`);
});
