const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA = path.join(__dirname, "data.json");

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

function readData(){
  try { return JSON.parse(fs.readFileSync(DATA, "utf-8")); }
  catch { return {}; }
}
function writeData(obj){
  fs.writeFileSync(DATA, JSON.stringify(obj, null, 2));
}

// Ingest track events
app.post("/track", (req, res) => {
  const { domain, ms, day } = req.body || {};
  if (!domain || !ms || !day) return res.status(400).json({ ok:false, error:"Missing domain/ms/day" });

  const db = readData();
  db[day] = db[day] || {};
  db[day][domain] = (db[day][domain] || 0) + Number(ms);
  writeData(db);
  res.json({ ok:true });
});

// Summary (by day)
app.get("/summary", (req, res) => {
  const day = req.query.day; // YYYY-MM-DD
  const db = readData();
  if (!day) return res.json(db); // all
  res.json(db[day] || {});
});

// Simple dashboard page
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

app.listen(PORT, () => console.log(`✅ Backend running on port ${PORT}`));
