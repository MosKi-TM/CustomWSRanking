const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const apiRoutes = require('./routes/api');
const admin = require('firebase-admin');
require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 3000;


const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),  // Ensure line breaks are properly formatted
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  clientId: process.env.FIREBASE_CLIENT_ID,
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
});

const db = admin.firestore();
const REGATTAS_COLLECTION = 'regattas'; // Firestore collection for regattas
const RANKINGS_COLLECTION = 'rankings'; // Firestore collection for rankings
const CUSTOM_REGATTAS_COLLECTION = 'custom_regattas';

// Fetch regattas from Firestore
async function getRegattas() {
  const snapshot = await db.collection(REGATTAS_COLLECTION).get();
  const regattas = snapshot.docs.map(doc => doc.data().url);
  return regattas;
}

async function fetchSailorInfo(license) {
  try {
    const url = `https://www.ffvoile.fr/ffv/sportif/cif/cif_detail.aspx?NoLicence=${license}`;
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    // These selectors will need to be tested on the actual page structure
    const fullname = $('#cph_Corps_lbNom').text().trim() ;
    const prenom = $('#cph_Corps_lbPrenom').text().trim();
    const name = fullname + " " + prenom
    const club = $('#cph_Corps_lbClub').text().trim();
    const category = "";
    const gender = "";
    const department = "44";

    return { name, club, category, gender, department };
  } catch (err) {
    console.error(`Error fetching sailor ${license}:`, err);
    return { name: "Unknown", club: "", category: "", gender: "", department: "" };
  }
}

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
      const ppremier = 200;
      elem.points = Math.round( (ppremier*(ranked - elem.place)+10*(elem.place-1))/(ranked-1) );
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

async function getCustomRegattas() {
  const snapshot = await db.collection(CUSTOM_REGATTAS_COLLECTION).get();
  return snapshot.docs.map(doc => doc.data().results);
}


// Admin dashboard
app.get('/admin', async (req, res) => {
  const regattas = await getRegattas();
  res.render('admin', { regattas });
});

app.post('/regattas/custom', async (req, res) => {
  const { name, results } = req.body;

  if (!name || !Array.isArray(results)) {
    return res.status(400).json({ error: "Invalid format. Expect { name, results: [...] }" });
  }

  const ranked = Math.max(...results.map(r => r.place));

  // Enrich sailors
  const enrichedResults = await Promise.all(results.map(async (sailor) => {
    const info = await fetchSailorInfo(sailor.license);

    // compute points
    const ppremier = 200;
    const points = Math.round((ppremier * (ranked - sailor.place) + 10 * (sailor.place - 1)) / (ranked - 1));

    return {
      place: sailor.place,
      license: sailor.license,
      ...info,
      points
    };
  }));

  // Save in Firestore
  await db.collection(CUSTOM_REGATTAS_COLLECTION).add({ 
    name, 
    results: enrichedResults 
  });

  res.json({ success: true, message: `Custom regatta '${name}' added.`, results: enrichedResults });
});



// Add new regatta
// Add new regatta
app.post('/regattas', async (req, res) => {
  const { url } = req.body;
  const regattas = await getRegattas();
  
  if (!regattas.includes(url)) {
    await db.collection(REGATTAS_COLLECTION).add({ url });
  }
  
  res.redirect('/');
});

// Delete regatta
app.delete('/regattas/:id', async (req, res) => {
  const regattaId = req.params.id;
  await db.collection(REGATTAS_COLLECTION).doc(regattaId).delete();
  res.sendStatus(200);
});


// API: Get computed rankings
app.get('/api/ranking', async (req, res) => {
  const rankingRef = db.collection(RANKINGS_COLLECTION).doc('currentRanking');
  const doc = await rankingRef.get();

  if (doc.exists) {
    res.json(doc.data().ranking);
  } else {
    res.status(404).json({ message: 'No rankings found' });
  }
});

app.delete('/regattas/custom/:id', async (req, res) => {
  const regattaId = req.params.id;
  await db.collection(CUSTOM_REGATTAS_COLLECTION).doc(regattaId).delete();
  res.sendStatus(200);
});

// Admin dashboard for custom regattas
app.get('/admin/custom', async (req, res) => {
  const snapshot = await db.collection(CUSTOM_REGATTAS_COLLECTION).get();
  const customRegattas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  res.render('customAdmin', { customRegattas });
});

app.post('/api/compute-rankings', async (req, res) => {
  const regattas = await getRegattas(); // from FFVoile URLs
  const resultsFromUrls = await Promise.all(regattas.map(fetchTableData));

  const resultsFromCustom = await getCustomRegattas(); // JSON regattas

  const allResults = [...resultsFromUrls, ...resultsFromCustom];

  const ranking = await computeOverallRankings(allResults);

  // Save rankings in Firestore
  const rankingRef = db.collection(RANKINGS_COLLECTION).doc('currentRanking');
  await rankingRef.set({ ranking: ranking });

  res.json({ success: true, ranking });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

