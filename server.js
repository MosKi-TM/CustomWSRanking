const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

async function fetchTableData(url) {
  try {
    // Fetch the HTML
    const response = await axios.get(url);
    const html = response.data;

    // Load HTML into Cheerio
    const $ = cheerio.load(html);

    // Find the table rows (adjust selector if needed)
    const rows = $('tr');

    const results = [];
    let currentPlace = '';

    rows.each((i, row) => {
      const cells = $(row).find('td');

      // Extract data from each cell
      const placeCell = $(cells[1]).text().trim();
      const licenseCell = $(cells[3]).text().trim();
      const nameCell = $(cells[4]).text().trim();
      const clubCell = $(cells[5]).text().trim();
      const deptCell = $(cells[6]).text().trim();
      const categoryCell = $(cells[7]).text().trim();
      const genderCell = $(cells[9]).text().trim();
      const pointsCell = $(cells[10]).text().trim();
      // Update current place if available
      if (placeCell  && !isNaN(placeCell)) {
        currentPlace = placeCell;
      }

      // Skip empty rows
      if (!licenseCell || !nameCell) return;

      results.push({
        place: currentPlace,
        license: licenseCell,
        name: nameCell,
        club: clubCell,
        department: deptCell,
        category: categoryCell,
        gender: genderCell
      });
    });

    const ranked = currentPlace;
    results.forEach((elem) => {
      const base = ranked - elem.place + 1;
      const multiplier = 1 + Math.log(ranked + 1);
      elem.points = Math.round(base * multiplier);
    });
    results.splice(0,1);
    return results;
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

// Process all regattas and compute rankings
function computeOverallRankings(regattas) {
  const sailorData = {};

  // 1. Sum points, count events, track best performance
  regattas.forEach((regatta, regattaIndex) => {
    regatta.forEach((sailor) => {
      const { license, name, points } = sailor;

      if (!sailorData[license]) {
        sailorData[license] = {
          name,
          license: license,
          totalPoints: 0,
          events: 0,
          best: -Infinity, // Track highest points in a single regatta
          lastPoints: null,
        };
      }

      sailorData[license].totalPoints += points;
      sailorData[license].events += 1;
      sailorData[license].best = Math.max(sailorData[license].best, points);
      sailorData[license].lastPoints = points; // For previousRank comparison
    });
  });

  // 2. Convert to array and sort by totalPoints (descending)
  const sailors = Object.values(sailorData).sort((a, b) => b.totalPoints - a.totalPoints);

  // 3. Assign ranks (handle ties)
  let currentRank = 1;
  sailors.forEach((sailor, index) => {
    if (index > 0 && sailor.totalPoints === sailors[index - 1].totalPoints) {
      sailor.rank = sailors[index - 1].rank; // Same rank if tied
    } else {
      sailor.rank = currentRank;
    }
    currentRank++;
  });

  // 4. Format for output
  return sailors.map((sailor) => ({
    rank: sailor.rank,
    license: sailor.license,
    previousRank: null, // Can be improved with historical data
    name: sailor.name,
    profileUrl: `https://www.ffvoile.fr/ffv/sportif/C18/C18_Indiv_Detail.aspx?Annee=2025&NoLicence=${sailor.license}`,
    countryCode: "FRA", // Default (can be enhanced)
    countryName: "FRA.svg",
    events: sailor.events,
    best: sailor.best === -Infinity ? "" : sailor.best,
    points: sailor.totalPoints,
  }));
}


// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static HTML
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// API routes
//app.use('/api', apiRoutes);

// File paths
const REGATTAS_FILE = 'regattas.json';
const RANKINGS_FILE = 'data.json';

// Initialize files if they don't exist
if (!fs.existsSync(REGATTAS_FILE)) {
  fs.writeFileSync(REGATTAS_FILE, '[]');
}
if (!fs.existsSync(RANKINGS_FILE)) {
  fs.writeFileSync(RANKINGS_FILE, '[]');
}

// Admin dashboard
app.get('/admin', (req, res) => {
  const regattas = JSON.parse(fs.readFileSync(REGATTAS_FILE));
  res.render('admin', { regattas });
});


// Add new regatta
app.post('/regattas', (req, res) => {
  const { url } = req.body;
  const regattas = JSON.parse(fs.readFileSync(REGATTAS_FILE));
  
  if (!regattas.includes(url)) {
    regattas.push(url);
    fs.writeFileSync(REGATTAS_FILE, JSON.stringify(regattas, null, 2));
  }
  
  res.redirect('/');
});

// Delete regatta
app.delete('/regattas/:index', (req, res) => {
  const regattas = JSON.parse(fs.readFileSync(REGATTAS_FILE));
  regattas.splice(req.params.index, 1);
  fs.writeFileSync(REGATTAS_FILE, JSON.stringify(regattas, null, 2));
  res.sendStatus(200);
});

// API: Get computed rankings
app.get('/api/ranking', (req, res) => {
  const rankings = JSON.parse(fs.readFileSync(RANKINGS_FILE));
  res.json(rankings);
});

// API: Trigger ranking computation
app.post('/api/compute-rankings', async (req, res) => {
  const regattas = JSON.parse(fs.readFileSync(REGATTAS_FILE));
  const results = await Promise.all(regattas.map(fetchTableData));
  const ranking = await computeOverallRankings(results);
  fs.writeFileSync(RANKINGS_FILE, JSON.stringify(ranking, null, 2));
  res.json({ success: true });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
