const express = require('express');
const router = express.Router();
const axios = require('axios');
const cheerio = require('cheerio');

const urls = ['https://www.ffvoile.fr/ffv/sportif/ClmtCompetDet.asp?clid=203319', 'https://www.ffvoile.fr/ffv/sportif/ClmtCompetDet.asp?clid=203312'];

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
      if (!licenseCell && !nameCell) return;

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



// Example GET endpoint
router.get('/update', async (req, res) => {
  const data = await fetchTableData(urls[0]);
  res.json({ message: data });
});


router.get('/ranking', async (req, res) => {
  const data = await fetchTableData(urls[0]);
  const data2 = await fetchTableData(urls[1]);
  const tData = await computeOverallRankings([data, data2]);
  res.json({ data: tData });
});


module.exports = router;
