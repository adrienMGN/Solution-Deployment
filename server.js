const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const Grid = require('gridfs-stream');
const { GridFSBucket } = require('mongodb');

// Import models
const { Session, Recording } = require('./models');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://audioapp:audioapp123@localhost:27017/audiorecorder';

// Global variables for GridFS
let gfsBucket;
let gridFS;

// MongoDB connection
mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('✅ Connected to MongoDB');
        
        // Initialize GridFS
        const conn = mongoose.connection;
        gfsBucket = new GridFSBucket(conn.db, { bucketName: 'recordings' });
        gridFS = Grid(conn.db, mongoose.mongo);
        gridFS.collection('recordings');
        
        console.log('✅ GridFS initialized for audio file storage');
    })
    .catch(err => {
        console.error('❌ MongoDB connection error:', err);
        console.error('Make sure MongoDB is running and credentials are correct');
        process.exit(1);
    });

// Create necessary directories
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            mediaSrc: ["'self'", "blob:"],
            connectSrc: ["'self'"]
        }
    }
}));

app.use(compression());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Multer configuration for GridFS storage
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('audio/')) {
            cb(null, true);
        } else {
            cb(new Error('Only audio files are allowed!'), false);
        }
    }
});

// Predefined sentences for reading
const SENTENCES = [
    "The quick brown fox jumps over the lazy dog.",
    "A journey of a thousand miles begins with a single step.",
    "To be or not to be, that is the question.",
    "In the beginning was the Word, and the Word was with God.",
    "All that glitters is not gold.",
    "The pen is mightier than the sword.",
    "Knowledge is power, but power corrupts absolutely.",
    "Life is what happens when you're busy making other plans.",
    "The only thing we have to fear is fear itself.",
    "Ask not what your country can do for you, ask what you can do for your country.",
    "Yesterday is history, tomorrow is a mystery, today is a gift.",
    "The only impossible journey is the one you never begin.",
    "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    "It is during our darkest moments that we must focus to see the light.",
    "The future belongs to those who believe in the beauty of their dreams.",
    "Innovation distinguishes between a leader and a follower.",
    "The greatest glory in living lies not in never falling, but in rising every time we fall.",
    "The way to get started is to quit talking and begin doing.",
    "Your time is limited, don't waste it living someone else's life.",
    "If life were predictable it would cease to be life, and be without flavor."
];

// Utility functions
function getClientInfo(req) {
    return {
        ipAddress: req.ip || req.connection.remoteAddress || req.socket.remoteAddress,
        userAgent: req.get('User-Agent') || 'Unknown'
    };
}

// API Routes

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        // Check MongoDB connection
        const dbState = mongoose.connection.readyState;
        const dbStatus = dbState === 1 ? 'connected' : 'disconnected';
        
        // Check GridFS
        const gridFSStatus = gfsBucket ? 'initialized' : 'not initialized';
        
        // Test database query
        const sessionCount = await Session.countDocuments();
        
        res.status(200).json({ 
            status: 'OK', 
            timestamp: new Date().toISOString(),
            database: dbStatus,
            gridFS: gridFSStatus,
            uptime: process.uptime(),
            sessionCount
        });
    } catch (error) {
        console.error('Health check error:', error);
        res.status(500).json({ 
            status: 'ERROR', 
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Get sentences endpoint
app.get('/api/sentences', (req, res) => {
    const count = parseInt(req.query.count) || SENTENCES.length;
    const selectedSentences = SENTENCES.slice(0, Math.min(count, SENTENCES.length));
    res.json({ sentences: selectedSentences });
});

// Start session endpoint
app.post('/api/session/start', async (req, res) => {
    try {
        console.log('Starting new session with data:', req.body);
        
        const { age, gender, consentGiven, sentenceCount } = req.body;
        
        if (!age || !gender || !consentGiven) {
            console.error('Missing required fields:', { age, gender, consentGiven });
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const clientInfo = getClientInfo(req);
        const sessionId = uuidv4();
        const finalSentenceCount = Math.min(parseInt(sentenceCount) || 10, SENTENCES.length);
        
        // Create new session in database
        const session = new Session({
            sessionId,
            age: parseInt(age),
            gender,
            consentGiven,
            sentenceCount: finalSentenceCount,
            ...clientInfo
        });
        
        const savedSession = await session.save();
        console.log('✅ Session saved to database:', savedSession.sessionId);
        
        console.log(`📝 New session started: ${sessionId} (Age: ${age}, Gender: ${gender}, Sentences: ${finalSentenceCount})`);
        
        res.json({ 
            sessionId, 
            sentences: SENTENCES.slice(0, finalSentenceCount) 
        });
        
    } catch (error) {
        console.error('❌ Error starting session:', error);
        res.status(500).json({ error: 'Failed to start session: ' + error.message });
    }
});

// Upload audio recording endpoint
app.post('/api/upload', upload.single('audio'), async (req, res) => {
    try {
        console.log('Upload request received:', {
            hasFile: !!req.file,
            sessionId: req.body.sessionId,
            sentenceIndex: req.body.sentenceIndex
        });
        
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }
        
        const { sessionId, sentenceIndex, sentence } = req.body;
        
        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID is required' });
        }
        
        // Verify session exists
        const session = await Session.findOne({ sessionId });
        if (!session) {
            console.error('Session not found:', sessionId);
            return res.status(404).json({ error: 'Session not found' });
        }
        
        console.log('✅ Session found:', session.sessionId);
        
        // Get the sentence text
        const sentenceIdx = parseInt(sentenceIndex);
        const sentenceText = sentence || SENTENCES[sentenceIdx] || 'Unknown sentence';
        
        // Create GridFS upload stream
        const filename = `session_${sessionId}_sentence_${sentenceIndex}_${Date.now()}.webm`;
        
        console.log('📁 Uploading to GridFS:', filename);
        
        const uploadStream = gfsBucket.openUploadStream(filename, {
            metadata: {
                sessionId,
                sentenceIndex: sentenceIdx,
                sentence: sentenceText,
                uploadedAt: new Date(),
                originalName: req.file.originalname,
                mimeType: req.file.mimetype
            }
        });
        
        // Handle upload completion
        uploadStream.on('finish', async () => {
            try {
                console.log('✅ GridFS upload completed:', uploadStream.id);
                
                // Save recording metadata to database
                const recording = new Recording({
                    sessionId,
                    sentenceIndex: sentenceIdx,
                    sentence: sentenceText,
                    fileId: uploadStream.id,
                    filename,
                    fileSize: req.file.size,
                    mimeType: req.file.mimetype,
                    metadata: {
                        recordingAttempts: 1,
                        browserInfo: req.get('User-Agent')
                    }
                });
                
                const savedRecording = await recording.save();
                console.log('✅ Recording metadata saved:', savedRecording._id);
                
                // Update session completion count
                session.completedRecordings += 1;
                await session.save();
                
                console.log(`🎙️ Recording saved: ${filename} (Session: ${sessionId}, Sentence: ${sentenceIdx})`);
                console.log(`📊 Session progress: ${session.completedRecordings}/${session.sentenceCount}`);
                
                res.json({ 
                    message: 'Recording uploaded successfully',
                    filename,
                    fileId: uploadStream.id,
                    completedRecordings: session.completedRecordings
                });
                
            } catch (dbError) {
                console.error('❌ Database error after upload:', dbError);
                res.status(500).json({ error: 'Failed to save recording metadata: ' + dbError.message });
            }
        });
        
        uploadStream.on('error', (error) => {
            console.error('❌ GridFS upload error:', error);
            res.status(500).json({ error: 'Failed to upload recording: ' + error.message });
        });
        
        // Upload file to GridFS
        uploadStream.end(req.file.buffer);
        
    } catch (error) {
        console.error('❌ Upload error:', error);
        res.status(500).json({ error: 'Failed to process upload: ' + error.message });
    }
});

// Complete session endpoint
app.post('/api/session/complete', async (req, res) => {
    try {
        const { sessionId } = req.body;
        
        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID is required' });
        }
        
        const session = await Session.findOne({ sessionId });
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        
        await session.markCompleted();
        
        console.log(`✅ Session completed: ${sessionId} (${session.completedRecordings}/${session.sentenceCount} recordings)`);
        
        res.json({ 
            message: 'Session completed successfully',
            completedRecordings: session.completedRecordings,
            totalSentences: session.sentenceCount,
            completionRate: session.getCompletionRate()
        });
        
    } catch (error) {
        console.error('❌ Error completing session:', error);
        res.status(500).json({ error: 'Failed to complete session: ' + error.message });
    }
});

// End session endpoint
app.post('/api/session/end', async (req, res) => {
    try {
        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID is required' });
        }

        const session = await Session.findOne({ sessionId });
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Mark session as ended (but not necessarily completed)
        session.completed = true;
        session.totalDuration = Math.floor((Date.now() - session.createdAt.getTime()) / 1000);
        await session.save();

        console.log(`✅ Session ended: ${sessionId}`);
        res.status(200).json({ message: 'Session ended successfully' });
    } catch (error) {
        console.error('❌ Error ending session:', error);
        res.status(500).json({ error: 'Failed to end session: ' + error.message });
    }
});

// Get comprehensive statistics
app.get('/api/stats', async (req, res) => {
    try {
        const [sessionStats, recordingStats] = await Promise.all([
            Session.getSessionStats(),
            Recording.getRecordingStats()
        ]);
        
        // Recent activity (last 7 days)
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        const recentSessions = await Session.countDocuments({ 
            createdAt: { $gte: weekAgo } 
        });
        
        const recentRecordings = await Recording.countDocuments({ 
            createdAt: { $gte: weekAgo } 
        });
        
        const stats = {
            sessions: {
                total: sessionStats?.totalSessions || 0,
                completed: sessionStats?.completedSessions || 0,
                recentWeek: recentSessions,
                averageAge: Math.round(sessionStats?.averageAge || 0),
                genderDistribution: sessionStats?.genderDistribution || {}
            },
            recordings: {
                total: recordingStats?.totalRecordings || 0,
                recentWeek: recentRecordings,
                totalFileSize: recordingStats?.totalFileSize || 0,
                averageFileSize: Math.round(recordingStats?.averageFileSize || 0)
            },
            system: {
                uptime: Math.round(process.uptime()),
                memoryUsage: process.memoryUsage(),
                nodeVersion: process.version
            }
        };
        
        res.json(stats);
        
    } catch (error) {
        console.error('❌ Stats error:', error);
        res.status(500).json({ error: 'Failed to retrieve statistics: ' + error.message });
    }
});

// Get recordings list with filters
app.get('/api/recordings', async (req, res) => {
    try {
        console.log('Loading recordings list...');
        
        // Get all recordings with session info
        const recordings = await Recording.aggregate([
            {
                $lookup: {
                    from: 'sessions',
                    localField: 'sessionId',
                    foreignField: 'sessionId',
                    as: 'session'
                }
            },
            {
                $unwind: {
                    path: '$session',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $sort: { createdAt: -1 }
            }
        ]);
        
        // Get unique sessions for filter
        const sessions = await Session.find({}, { sessionId: 1, createdAt: 1 }).sort({ createdAt: -1 });
        
        console.log(`✅ Loaded ${recordings.length} recordings from ${sessions.length} sessions`);
        
        res.json({
            recordings,
            sessions
        });
        
    } catch (error) {
        console.error('❌ Error loading recordings:', error);
        res.status(500).json({ error: 'Failed to load recordings: ' + error.message });
    }
});

// Play recording from list
app.get('/api/recording/:recordingId/play', async (req, res) => {
    try {
        const recordingId = req.params.recordingId;
        const recording = await Recording.findById(recordingId);
        
        if (!recording) {
            return res.status(404).json({ error: 'Recording not found' });
        }
        
        // Stream the file from GridFS
        const downloadStream = gfsBucket.openDownloadStream(recording.fileId);
        
        res.set({
            'Content-Type': recording.mimeType || 'audio/webm',
            'Content-Disposition': `inline; filename="${recording.filename}"`
        });
        
        downloadStream.pipe(res);
        
        downloadStream.on('error', (error) => {
            console.error('❌ Download stream error:', error);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to stream audio file' });
            }
        });
        
    } catch (error) {
        console.error('❌ Play recording error:', error);
        res.status(500).json({ error: 'Failed to play recording: ' + error.message });
    }
});

// Download recording
app.get('/api/recording/:recordingId/download', async (req, res) => {
    try {
        const recordingId = req.params.recordingId;
        const recording = await Recording.findById(recordingId);
        
        if (!recording) {
            return res.status(404).json({ error: 'Recording not found' });
        }
        
        // Stream the file from GridFS
        const downloadStream = gfsBucket.openDownloadStream(recording.fileId);
        
        res.set({
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${recording.filename}"`
        });
        
        downloadStream.pipe(res);
        
        downloadStream.on('error', (error) => {
            console.error('❌ Download stream error:', error);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to download audio file' });
            }
        });
        
    } catch (error) {
        console.error('❌ Download recording error:', error);
        res.status(500).json({ error: 'Failed to download recording: ' + error.message });
    }
});

// Test database connection endpoint
app.get('/api/test-db', async (req, res) => {
    try {
        // Test basic operations
        const sessionCount = await Session.countDocuments();
        const recordingCount = await Recording.countDocuments();
        
        // Test creating a sample session
        const testSession = new Session({
            sessionId: 'test-' + Date.now(),
            age: 25,
            gender: 'other',
            consentGiven: true,
            sentenceCount: 1,
            ipAddress: '127.0.0.1',
            userAgent: 'Test'
        });
        
        await testSession.save();
        console.log('✅ Test session created:', testSession.sessionId);
        
        // Delete the test session
        await Session.deleteOne({ sessionId: testSession.sessionId });
        console.log('✅ Test session deleted');
        
        res.json({
            status: 'Database connection successful',
            sessionCount,
            recordingCount,
            testPassed: true
        });
        
    } catch (error) {
        console.error('❌ Database test failed:', error);
        res.status(500).json({
            status: 'Database connection failed',
            error: error.message,
            testPassed: false
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large (max 10MB)' });
        }
    }
    
    console.error('❌ Unhandled error:', error);
    res.status(500).json({ error: 'Internal server error: ' + error.message });
});

// 404 handler
app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        res.status(404).json({ error: 'API endpoint not found' });
    } else {
        res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🔄 Shutting down gracefully...');
    
    try {
        await mongoose.connection.close();
        console.log('✅ MongoDB connection closed');
    } catch (error) {
        console.error('❌ Error closing MongoDB connection:', error);
    }
    
    process.exit(0);
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Audio Recording Server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️ MongoDB URI: ${MONGODB_URI.replace(/\/\/.*@/, '//***:***@')}`);
    console.log(`📁 Uploads directory: ${uploadsDir}`);
    console.log(`⏰ Server started at: ${new Date().toISOString()}`);
});

module.exports = app;