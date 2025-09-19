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
let themeCollection;

// Connect to MongoDB
async function connectToDatabase() {
    try {
        await client.connect();
        db = client.db('PlaceEditor');
        configCollection = db.collection('app_configuration');
        themeCollection = db.collection('theme_configuration');
        await client.db("admin").command({ ping: 1 });
    } catch (error) {
        process.exit(1);
    }
}

// API Routes

// --- THEME CONFIGURATION ---
const THEME_ALLOWED_KEYS = new Set([
    '--text', '--text-muted', '--text-disabled', '--text-secondary',
    '--primary-50', '--primary-500', '--primary-600', '--primary-700',
    '--on-primary'
]);

function isValidColor(value) {
    if (typeof value !== 'string') return false;
    const hex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
    const rgb = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(\s*,\s*(0|1|0?\.\d+))?\s*\)$/;
    const hsl = /^hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%(\s*,\s*(0|1|0?\.\d+))?\s*\)$/;
    return hex.test(value) || rgb.test(value) || hsl.test(value);
}

function validateThemePayload(body) {
    const errors = [];
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return { valid: false, errors: ['Body must be a JSON object.'] };
    }
    const theme = body.theme;
    if (!theme || typeof theme !== 'object' || Array.isArray(theme)) {
        return { valid: false, errors: ['"theme" must be an object mapping CSS vars to values.'] };
    }
    for (const key of Object.keys(theme)) {
        if (!THEME_ALLOWED_KEYS.has(key)) {
            errors.push(`Unknown token key: ${key}`);
        }
    }
    // Validate values
    for (const key of THEME_ALLOWED_KEYS) {
        if (!(key in theme)) continue; // optional keys
        const value = theme[key];
        // Colors
        if (!isValidColor(value)) {
            errors.push(`Invalid color value for ${key}: ${value}`);
        }
    }
    return { valid: errors.length === 0, errors };
}

// GET /theme - Retrieve theme overrides (returns empty theme if not set)
app.get('/theme', async (req, res) => {
    try {
        const themeDoc = await themeCollection.findOne({});
        if (!themeDoc) {
            return res.json({ theme: {}, lastUpdated: null });
        }
        return res.json({ theme: themeDoc.theme || {}, lastUpdated: themeDoc.lastUpdated || null });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to retrieve theme configuration' });
    }
});

// POST /theme - Validate and save theme overrides
app.post('/theme', async (req, res) => {
    try {
        const validation = validateThemePayload(req.body);
        if (!validation.valid) {
            return res.status(400).json({ success: false, errors: validation.errors });
        }
        const themeData = {
            lastUpdated: new Date(),
            theme: req.body.theme
        };
        await themeCollection.replaceOne({}, themeData, { upsert: true });
        return res.json({ success: true, message: 'Theme saved successfully', data: themeData });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to save theme configuration' });
    }
});

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