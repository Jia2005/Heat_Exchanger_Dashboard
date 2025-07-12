const express = require('express');
const { InfluxDB } = require('@influxdata/influxdb-client');
require('dotenv').config(); // To load variables from .env file

const app = express();
const port = 3001; // Your backend will run on a different port than React

// --- InfluxDB Connection Details ---
const url = process.env.INFLUX_URL;
const token = process.env.INFLUX_TOKEN;
const org = process.env.INFLUX_ORG;
const bucket = process.env.INFLUX_BUCKET;

const influxDB = new InfluxDB({ url, token });
const queryApi = influxDB.getQueryApi(org);

// --- API Endpoint ---
app.get('/api/heat-exchanger-data', async (req, res) => {
    const fluxQuery = `
        from(bucket: "${bucket}")
        |> range(start: -1y) // Fetch data from the last 1 year
        |> filter(fn: (r) => r._measurement == "heat_exchanger")
        |> pivot(rowKey:["_time"], columnKey: ["_field"], valueKey: "_value")
        |> keep(columns: ["_time", "Psat", "Tsat", "LMTD", "Tcw in", "Tcw out", "mcw", "Cpw", "Ufoul", "Uclean", "Rfoul"])
    `;

    const data = [];
    try {
        const result = await queryApi.collectRows(fluxQuery);
        result.forEach((row) => {
            // The client library renames "_time" to "Timestamp"
            // and we can format the other fields as needed.
            data.push({
                Timestamp: row._time,
                Psat: parseFloat(row.Psat),
                Tsat: parseFloat(row.Tsat),
                LMTD: parseFloat(row.LMTD),
                'Tcw in': parseFloat(row['Tcw in']),
                'Tcw out': parseFloat(row['Tcw out']),
                mcw: parseFloat(row.mcw),
                Cpw: parseFloat(row.Cpw),
                Ufoul: parseFloat(row.Ufoul),
                Uclean: parseFloat(row.Uclean),
                Rfoul: parseFloat(row.Rfoul)
            });
        });
        res.json(data);
    } catch (error) {
        console.error('Error querying InfluxDB', error);
        res.status(500).send('Error fetching data from database');
    }
});

app.listen(port, () => {
    console.log(`Backend server listening at http://localhost:${port}`);
});
