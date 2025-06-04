// MongoDB initialization script
// This script runs when the container is first created

// Switch to the audiorecorder database
db = db.getSiblingDB('audiorecorder');

// Create collections with indexes
db.createCollection('sessions');
db.createCollection('recordings');

// Create indexes for better performance
db.sessions.createIndex({ sessionId: 1 }, { unique: true });
db.sessions.createIndex({ createdAt: 1 });
db.sessions.createIndex({ age: 1 });
db.sessions.createIndex({ gender: 1 });
db.sessions.createIndex({ completed: 1 });
db.sessions.createIndex({ age: 1, gender: 1 }); // Compound index

db.recordings.createIndex({ sessionId: 1 });
db.recordings.createIndex({ sentenceIndex: 1 });
db.recordings.createIndex({ createdAt: 1 });
db.recordings.createIndex({ fileId: 1 }, { unique: true });
db.recordings.createIndex({ sessionId: 1, sentenceIndex: 1 }); // Compound index

// Create GridFS collections for file storage
db.createCollection('recordings.files');
db.createCollection('recordings.chunks');

// Create indexes for GridFS
db.getCollection('recordings.files').createIndex({ filename: 1 });
db.getCollection('recordings.files').createIndex({ uploadDate: 1 });
db.getCollection('recordings.chunks').createIndex({ files_id: 1, n: 1 }, { unique: true });

// Create a user for the application
db.createUser({
  user: 'audioapp',
  pwd: 'audioapp123',
  roles: [
    {
      role: 'readWrite',
      db: 'audiorecorder'
    }
  ]
});

// Insert some test data to verify everything works
db.sessions.insertOne({
    sessionId: 'test-init-session',
    age: 30,
    gender: 'other',
    consentGiven: true,
    sentenceCount: 5,
    completed: false,
    completedRecordings: 0,
    totalDuration: 0,
    ipAddress: '127.0.0.1',
    userAgent: 'MongoDB Init Script',
    createdAt: new Date(),
    updatedAt: new Date()
});

print('✅ Database initialization completed successfully');
print('✅ Collections created: sessions, recordings');
print('✅ Indexes created for optimal performance');
print('✅ GridFS collections initialized');
print('✅ User "audioapp" created with readWrite permissions');
print('✅ Test session inserted');

// Verify collections exist
print('📊 Collections in database:');
db.getCollectionNames().forEach(name => print(`   - ${name}`));

// Verify indexes
print('📊 Indexes on sessions collection:');
db.sessions.getIndexes().forEach(index => print(`   - ${index.name}: ${JSON.stringify(index.key)}`));

print('📊 Indexes on recordings collection:');
db.recordings.getIndexes().forEach(index => print(`   - ${index.name}: ${JSON.stringify(index.key)}`));