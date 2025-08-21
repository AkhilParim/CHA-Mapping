const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const app = express();
const PORT = 3050;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection setup
let dbEndPoint = '';
if (process.env.NODE_ENV && process.env.NODE_ENV === "production") {
    dbEndPoint = String(process.env.DB_END_POINT_2);
} else {
    dbEndPoint = 'mongodb://127.0.0.1:27017/PlaceEditor';
}

const client = new MongoClient(dbEndPoint);

let db;
let configCollection;

// Connect to MongoDB
async function connectToDatabase() {
    try {
        await client.connect();
        db = client.db('PlaceEditor');
        configCollection = db.collection('app_configuration');
        await client.db("admin").command({ ping: 1 });
    } catch (error) {
        process.exit(1);
    }
}

// API Routes

// GET /configuration - Retrieve configuration
app.get('/configuration', async (req, res) => {
    try {
        const config = await configCollection.findOne({});
        if (!config) {
            return res.status(404).json({ error: 'Configuration not found' });
        }
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve configuration' });
    }
});

// POST /configuration - Save configuration
app.post('/configuration', async (req, res) => {
    try {
        const configData = {
            lastUpdated: new Date(),
            configuration: req.body.configuration
        };

        await configCollection.replaceOne(
            {},
            configData,
            { upsert: true }
        );

        res.json({ 
            success: true, 
            message: 'Configuration saved successfully',
            data: configData
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save configuration' });
    }
});

// Start server
async function startServer() {
    await connectToDatabase();
    app.listen(PORT);
    console.log(`Server is running on port ${PORT}`);
}

// Graceful shutdown
process.on('SIGINT', async () => {
    await client.close();
    process.exit(0);
});

startServer(); 