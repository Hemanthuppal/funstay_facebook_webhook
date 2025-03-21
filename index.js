const express = require("express");
const mysql = require("mysql2");
const bodyParser = require("body-parser");
const cors = require("cors");
const { parsePhoneNumberFromString } = require("libphonenumber-js");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// MySQL Connection
// const db = mysql.createPool({
//   host: "localhost",
//   user: "root",
//   password: "",
//   database: "funstaydb",
//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0,
// });

const db = mysql.createPool({
  host: "localhost",
  user: 'nodeuser', // Your database user
  password: 'Root@1234', // Your database password
  database: 'funstay_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Function to convert date format
function formatDate(dateStr) {
  if (!dateStr) return null;

  const cleanedDateStr = dateStr.replace(/(\d+)(st|nd|rd|th)/, "$1");
  const [day, month, year] = cleanedDateStr.toLowerCase().split("_");

  const monthMap = {
    january: "01", february: "02", march: "03", april: "04",
    may: "05", june: "06", july: "07", august: "08",
    september: "09", october: "10", november: "11", december: "12",
  };

  return year && monthMap[month] && day
    ? `${year}-${monthMap[month]}-${day.padStart(2, "0")}`
    : null;
}

// Function to parse phone number
function parsePhoneNumber(phone) {
  if (!phone) return { country_code: null, phone_number: null };

  const cleanedPhone = phone.replace(/^p:/, "").trim();
  const parsed = parsePhoneNumberFromString(cleanedPhone);

  return parsed
    ? { country_code: `+${parsed.countryCallingCode}`, phone_number: parsed.nationalNumber }
    : { country_code: null, phone_number: phone };
}

// Webhook Endpoint
app.post("/webhook", async (req, res) => {
  console.log("Received Webhook Data:", req.body);

  let {
    lead_date, ad_copy, ad_set, lead_type, destination, sources,
    start_date, people_count, name, email, phone_number, origincity, channel
  } = req.body;

  // Format start_date
  start_date = formatDate(start_date);

  // Parse phone number
  const { country_code, phone_number: parsedPhoneNumber } = parsePhoneNumber(phone_number);

  let customerId;
  let customerStatus = "new";

  try {
    const connection = db.promise();

    // Check if customer exists
    const [customerResults] = await connection.query(
      "SELECT id, customer_status FROM customerdescription WHERE phone_number = ?",
      [parsedPhoneNumber]
    );

    if (customerResults.length > 0) {
      customerId = customerResults[0].id;
      customerStatus = customerResults[0].customer_status;
    } else {
      // Insert new customer
      const [insertResult] = await connection.query(
        "INSERT INTO customerdescription (name, email, phone_number, country_code, customer_status) VALUES (?, ?, ?, ?, ?)",
        [name?.trim() || "", email?.trim() || "", parsedPhoneNumber?.trim() || "", country_code?.trim() || "", "new"]
      );
      customerId = insertResult.insertId;
    }

    // Prevent duplicate entry in addleads
    

    // Insert data into addleads
    const insertQuery = `
    INSERT INTO addleadsdescription   (
      lead_date, ad_copy, ad_set, lead_type, destination, sources, 
      start_date, people_count, name, email, country_code, phone_number, 
      origincity, channel, customerid, customer_status, primarySource, secondarySource
    ) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  const [result] = await connection.query(insertQuery, [
    lead_date, ad_copy, ad_set, lead_type, destination, sources,
    start_date, people_count, name, email, country_code, parsedPhoneNumber, 
    origincity, channel, customerId, customerStatus, "Meta", "Facebook (Paid)"
  ]);
  

    res.status(200).json({ message: "Data inserted successfully", id: result.insertId });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Database error" });
  }
});



app.get('/enquiries', (req, res) => {
  const query = 'SELECT * FROM addleadsdescription  ORDER BY created_at DESC';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching enquiries:', err);
      return res.status(500).json({ message: 'Error fetching enquiries' });
    }
    res.json(results);
  });
});
// Start Server
const PORT = 8080;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
