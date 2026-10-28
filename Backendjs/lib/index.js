const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const sequelize = require('./constants/database');
const DatabaseManager = require('./services/databaseManager');

dotenv.config();

const app = express();

// CORS Configuration - Allow all origins and headers
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');
    res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, X-Content-Range');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
    }
    next();
});
app.use(express.json());
// Express 5 leaves req.body undefined when a request has no body (a DELETE, a bare POST). Handlers read
// fields from it, so give them an empty object instead of a crash.
app.use((req, _res, next) => { if (req.body === undefined) req.body = {}; next(); });
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory with absolute path
const uploadsPath = path.resolve(__dirname, '..', 'uploads');
console.log('📁 Serving static files from:', uploadsPath);
// Salesman KYC documents (PAN, Aadhar, cancel cheque, photo) are private: only a
// logged-in admin / sales manager may open them. This is mounted BEFORE the public
// /uploads handler and never falls through to it.
const { authenticateToken } = require('./middleware/auth');
const { checkRole } = require('./middleware/roleAuth');
const { SALESMAN_DOC_ROLES } = require('./utils/roleHelpers');
app.use(
    '/uploads/salesman',
    authenticateToken,
    checkRole(SALESMAN_DOC_ROLES),
    express.static(path.join(uploadsPath, 'salesman'), { fallthrough: false, dotfiles: 'deny', index: false })
);
app.use('/uploads', express.static(uploadsPath));

// NOTE: the backend folder is deliberately NOT served as static files. It used to
// be ("for testing"), which let anyone download the source code, migrations and
// package files from the website. Only /uploads above is public.

// Import and use the route manager
const routeManager = require('./routes/routeManager');
app.use('/api', routeManager);

app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running Now..' });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!', message: err.message });
});

const PORT = process.env.PORT || 3000;

const startServer = async () => {
    try {
        // Initialize database with DatabaseManager
        console.log('🚀 Starting Database Manager...');
        await DatabaseManager.initialize();
        console.log('✅ Database Manager completed!\n');

        // Check if server is already listening (for LiteSpeed/OpenLiteSpeed environments)
        if (!app.listening) {
            // Start the server
            app.listen(PORT, () => {
                console.log(`🚀 Server is running on port ${PORT}`);
                console.log(`🏥 Health check: http://localhost:${PORT}/health`);
                console.log(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
            });
        } else {
            console.log(`🚀 Server already listening on port ${PORT}`);
            console.log(`🏥 Health check: http://localhost:${PORT}/health`);
            console.log(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
        }
    } catch (error) {
        console.error('❌ Error starting server:', error);
        // Don't exit in production environments where the server might already be running
        if (process.env.NODE_ENV !== 'production') {
            process.exit(1);
        }
    }
};

// Only start the server if not already started (important for LiteSpeed Node)
if (require.main === module) {
    startServer();
} else {
    // Loaded by a Node runtime (Passenger / LiteSpeed / cPanel) which serves the
    // exported `app` itself, so startServer()'s app.listen is skipped. We must
    // still run DB initialization (table creation/sync) on process boot —
    // otherwise new tables never get created on the deployed server.
    DatabaseManager.initialize()
        .then(() => console.log('✅ Database Manager completed (runtime-loaded)'))
        .catch((err) => console.error('❌ DB init failed (runtime-loaded):', err));
}

module.exports = app;