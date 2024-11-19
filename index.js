const express = require('express');
const fs = require('fs');
const cors = require('cors');
const axios = require('axios');
const app = express();
const port = 3001;

app.use(cors());

// Helper function to fetch LeetCode data for a user
async function fetchLeetCodeData(username) {
  try {
    const response = await axios.get(`https://leetcodeapi-v1.vercel.app/${username}`);
    const data = response.data;

    if (data && data[username]) {
      return {
        totalSolved: data[username].submitStatsGlobal.acSubmissionNum[0].count || 0,
        easySolved: data[username].submitStatsGlobal.acSubmissionNum[1].count || 0,
        mediumSolved: data[username].submitStatsGlobal.acSubmissionNum[2].count || 0,
        hardSolved: data[username].submitStatsGlobal.acSubmissionNum[3].count || 0,
      };
    } else {
      return {
        totalSolved: 0,
        easySolved: 0,
        mediumSolved: 0,
        hardSolved: 0,
        info: 'No LeetCode data available'
      };
    }
  } catch (error) {
    console.error(`Error fetching data for ${username}:`, error.message);
    return {
      totalSolved: 0,
      easySolved: 0,
      mediumSolved: 0,
      hardSolved: 0,
      info: 'Error fetching LeetCode data'
    };
  }
}

// Function to fetch and process all data
async function fetchAndSaveData() {
  try {
    console.log('Starting to read input files...');

    // Read input files
    const rolls = fs.readFileSync('roll.txt', 'utf-8').split('\n').map(line => line.trim()).filter(Boolean);
    const names = fs.readFileSync('name.txt', 'utf-8').split('\n').map(line => line.trim()).filter(Boolean);
    const urls = fs.readFileSync('urls.txt', 'utf-8').split('\n').map(line => line.trim()).filter(Boolean);
    const sections = fs.readFileSync('sections.txt', 'utf-8').split('\n').map(line => line.trim()).filter(Boolean);

    if (rolls.length !== names.length || names.length !== urls.length || names.length !== sections.length) {
      console.error('Error: The number of rolls, names, URLs, and sections do not match.');
      return;
    }

    console.log('Input files read successfully.');
    const combinedData = [];

    for (let i = 0; i < rolls.length; i++) {
      const roll = rolls[i];
      const name = names[i];
      const url = urls[i];
      const section = sections[i];
      let studentData = { roll, name, url, section };

      console.log(`Processing data for roll number: ${roll}, name: ${name}, section: ${section}`);

      // Check if URL is a LeetCode URL
      if (url.startsWith('https://leetcode.com/u/')) {
        let username = url.split('/u/')[1];
        if (username.charAt(username.length - 1) === '/') username = username.substring(0, username.length - 1);
        console.log(`Fetching data for LeetCode username: ${username}`);

        // Fetch LeetCode data
        const leetCodeData = await fetchLeetCodeData(username);
        studentData = { ...studentData, ...leetCodeData };
      } else {
        console.log(`URL for ${name} is not a LeetCode profile. Skipping API call.`);
        studentData.info = 'No LeetCode data available';
      }

      combinedData.push(studentData);
    }

    // Sort the data by totalSolved in descending order, treating 'NA' or invalid values as 0
    combinedData.sort((a, b) => {
      const aTotalSolved = isNaN(a.totalSolved) ? 0 : a.totalSolved;
      const bTotalSolved = isNaN(b.totalSolved) ? 0 : b.totalSolved;
      return bTotalSolved - aTotalSolved;
    });

    // Save the combined data to a file
    fs.writeFileSync('data.json', JSON.stringify(combinedData, null, 2));
    console.log('Data saved to data.json successfully.');
  } catch (error) {
    console.error('Error processing data:', error.message);
  }
}

// Endpoint to get all student data
app.get('/data', (req, res) => {
  // Check if the data file exists and is up-to-date
  fs.readFile('data.json', 'utf-8', (err, data) => {
    if (err) {
      console.error('Error reading data file:', err.message);
      res.status(500).json({ error: 'Error reading data file.' });
      return;
    }
    res.json(JSON.parse(data)); // Send data as JSON
  });
});

// Endpoint to get data for a specific student by roll number
app.get('/student/:roll', (req, res) => {
  const roll = req.params.roll;
  fs.readFile('data.json', 'utf-8', (err, data) => {
    if (err) {
      console.error('Error reading data file:', err.message);
      res.status(500).json({ error: 'Error reading data file.' });
      return;
    }

    const students = JSON.parse(data);
    const student = students.find((s) => s.roll === roll);

    if (student) {
      res.json(student);
    } else {
      res.status(404).json({ error: 'Student not found.' });
    }
  });
});

// Initial data fetch and periodic refresh every hour
fetchAndSaveData();
setInterval(fetchAndSaveData, 60 * 60 * 1000); // Refresh data every hour

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
