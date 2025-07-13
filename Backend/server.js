const express = require('express');
const { InfluxDB } = require('@influxdata/influxdb-client');
require('dotenv').config();

const app = express();
const port = 3001;

const url = process.env.INFLUX_URL;
const token = process.env.INFLUX_TOKEN;
const org = process.env.INFLUX_ORG;
const bucket = process.env.INFLUX_BUCKET;

const influxDB = new InfluxDB({ url, token });
const queryApi = influxDB.getQueryApi(org);

app.get('/api/heat-exchanger-data', async (req, res) => {
    const fluxQuery = `
        from(bucket: "${bucket}")
        |> range(start: -1y) // Fetch data from the last 1 year
        |> filter(fn: (r) => r._measurement == "heat_exchanger_readings")
        |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value") // <-- CORRECTED THIS LINE
        |> keep(columns: ["_time", "Psat", "Tsat", "LMTD", "Tcw_in", "Tcw_out", "mcw", "Cpw", "Ufoul", "Uclean", "Rfoul"])
    `;

    const data = [];
    try {
        const result = await queryApi.collectRows(fluxQuery);
        result.forEach((row) => {
            data.push({
                Timestamp: row._time,
                Psat: parseFloat(row.Psat),
                Tsat: parseFloat(row.Tsat),
                LMTD: parseFloat(row.LMTD),
                'Tcw in': parseFloat(row.Tcw_in),  
                'Tcw out': parseFloat(row.Tcw_out),
                mcw: parseFloat(row.mcw),
                Cpw: parseFloat(row.Cpw),
                Ufoul: parseFloat(row.Ufoul),
                Uclean: parseFloat(row.Uclean),
                Rfoul: parseFloat(row.Rfoul)
            });
        });
        res.json(data);
    } catch (error) {
        console.error('Error querying InfluxDB:', error);
        if (error.statusCode && error.json) {
            res.status(error.statusCode).json({
                message: "Failed to query the database.",
                details: error.json.message 
            });
        } else {
            res.status(500).json({
                message: "An unexpected error occurred on the server."
            });
        }
    }
});

app.listen(port, () => {
    console.log(`Backend server listening at http://localhost:${port}`);
});