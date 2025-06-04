const mongoose = require('mongoose');

// Session Schema
const sessionSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    age: {
        type: Number,
        required: true,
        min: 18,
        max: 100
    },
    gender: {
        type: String,
        required: true,
        enum: ['male', 'female', 'other', 'prefer-not-to-say']
    },
    consentGiven: {
        type: Boolean,
        required: true,
        default: false
    },
    sentenceCount: {
        type: Number,
        required: true,
        min: 1,
        max: 50
    },
    completed: {
        type: Boolean,
        default: false
    },
    completedRecordings: {
        type: Number,
        default: 0
    },
    totalDuration: {
        type: Number, // in seconds
        default: 0
    },
    ipAddress: {
        type: String,
        required: false
    },
    userAgent: {
        type: String,
        required: false
    }
}, {
    timestamps: true, // Automatically adds createdAt and updatedAt
    versionKey: false
});

// Recording Schema
const recordingSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
        index: true
    },
    sentenceIndex: {
        type: Number,
        required: true,
        min: 0
    },
    sentence: {
        type: String,
        required: true
    },
    fileId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'fs.files' // Reference to GridFS files collection
    },
    filename: {
        type: String,
        required: true
    },
    fileSize: {
        type: Number,
        required: true
    },
    duration: {
        type: Number, // in seconds
        required: false
    },
    mimeType: {
        type: String,
        required: true,
        default: 'audio/webm'
    },
    quality: {
        bitrate: Number,
        sampleRate: Number,
        channels: Number
    },
    metadata: {
        recordingAttempts: {
            type: Number,
            default: 1
        },
        deviceInfo: String,
        browserInfo: String
    }
}, {
    timestamps: true,
    versionKey: false
});

// Add compound indexes
sessionSchema.index({ createdAt: 1, completed: 1 });
sessionSchema.index({ age: 1, gender: 1 });

recordingSchema.index({ sessionId: 1, sentenceIndex: 1 });
recordingSchema.index({ createdAt: 1 });

// Instance methods for Session
sessionSchema.methods.getCompletionRate = function() {
    return this.sentenceCount > 0 ? (this.completedRecordings / this.sentenceCount) * 100 : 0;
};

sessionSchema.methods.markCompleted = function() {
    this.completed = true;
    this.totalDuration = Math.floor((Date.now() - this.createdAt.getTime()) / 1000);
    return this.save();
};

// Static methods for Session
sessionSchema.statics.getSessionStats = async function() {
    const pipeline = [
        {
            $group: {
                _id: null,
                totalSessions: { $sum: 1 },
                completedSessions: {
                    $sum: { $cond: [{ $eq: ['$completed', true] }, 1, 0] }
                },
                averageAge: { $avg: '$age' },
                totalRecordings: { $sum: '$completedRecordings' }
            }
        }
    ];
    
    const genderStats = await this.aggregate([
        {
            $group: {
                _id: '$gender',
                count: { $sum: 1 }
            }
        }
    ]);
    
    const [generalStats] = await this.aggregate(pipeline);
    
    return {
        ...generalStats,
        genderDistribution: genderStats.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
        }, {})
    };
};

// Static methods for Recording
recordingSchema.statics.getRecordingStats = async function() {
    const pipeline = [
        {
            $group: {
                _id: null,
                totalRecordings: { $sum: 1 },
                totalFileSize: { $sum: '$fileSize' },
                averageFileSize: { $avg: '$fileSize' },
                totalDuration: { $sum: '$duration' }
            }
        }
    ];
    
    const [stats] = await this.aggregate(pipeline);
    return stats || {
        totalRecordings: 0,
        totalFileSize: 0,
        averageFileSize: 0,
        totalDuration: 0
    };
};

// Pre-save middleware
sessionSchema.pre('save', function(next) {
    if (this.completedRecordings >= this.sentenceCount && !this.completed) {
        this.completed = true;
        this.totalDuration = Math.floor((Date.now() - this.createdAt.getTime()) / 1000);
    }
    next();
});

// Create models
const Session = mongoose.model('Session', sessionSchema);
const Recording = mongoose.model('Recording', recordingSchema);

module.exports = {
    Session,
    Recording
};