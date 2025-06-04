// Variables globales pour la gestion des enregistrements
let allRecordings = [];
let filteredRecordings = [];

// ======================
// GESTION DES STATISTIQUES
// ======================

async function loadStatistics() {
    try {
        console.log('Loading statistics from database...');
        
        const response = await fetch('/api/stats');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const stats = await response.json();
        console.log('Statistics loaded:', stats);
        displayStatistics(stats);
        
    } catch (error) {
        console.error('Error loading statistics:', error);
        document.getElementById('statsContent').innerHTML = 
            '<p style="color: #e53e3e; text-align: center;">Failed to load statistics. Please try again later.</p>';
    }
}

function displayStatistics(stats) {
    // Vérifier que les données existent avec des valeurs par défaut
    const sessionsTotal = stats.sessions?.total || 0;
    const sessionsCompleted = stats.sessions?.completed || 0;
    const recordingsTotal = stats.recordings?.total || 0;
    const averageAge = stats.sessions?.averageAge || 0;
    const genderDistribution = stats.sessions?.genderDistribution || {};
    const systemUptime = stats.system?.uptime || 0;
    const totalFileSize = stats.recordings?.totalFileSize || 0;
    const averageFileSize = stats.recordings?.averageFileSize || 0;

    const statsHTML = `
        <div class="stats">
            <div class="stat-item">
                <div class="stat-number">${sessionsTotal}</div>
                <div class="stat-label">Total Sessions</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${sessionsCompleted}</div>
                <div class="stat-label">Completed Sessions</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${recordingsTotal}</div>
                <div class="stat-label">Total Recordings</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${Math.round(averageAge)}</div>
                <div class="stat-label">Average Age</div>
            </div>
        </div>
        
        <div style="margin-top: 20px;">
            <h3>Gender Distribution</h3>
            <div class="stats">
                ${Object.entries(genderDistribution).length > 0 ? 
                    Object.entries(genderDistribution).map(([gender, count]) => `
                        <div class="stat-item">
                            <div class="stat-number">${count}</div>
                            <div class="stat-label">${capitalizeFirst(gender)}</div>
                        </div>
                    `).join('') : 
                    '<p style="text-align: center; color: #718096;">No gender data available</p>'
                }
            </div>
        </div>
        
        <div style="margin-top: 20px;">
            <h3>System Information</h3>
            <p><strong>Server Uptime:</strong> ${Math.round(systemUptime / 60)} minutes</p>
            <p><strong>Total File Size:</strong> ${formatBytes(totalFileSize)}</p>
            <p><strong>Average File Size:</strong> ${formatBytes(averageFileSize)}</p>
            <p><strong>Completion Rate:</strong> ${sessionsTotal > 0 ? Math.round((sessionsCompleted / sessionsTotal) * 100) : 0}%</p>
        </div>
    `;
    
    document.getElementById('statsContent').innerHTML = statsHTML;
}

// ======================
// GESTION DES ENREGISTREMENTS
// ======================

async function loadRecordingsList() {
    try {
        console.log('Loading recordings from database...');
        showLoadingMessage('recordingsListContent', 'Loading recordings...');
        
        const response = await fetch('/api/recordings');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Recordings data loaded:', data);
        
        // Vérifier la structure des données
        allRecordings = data.recordings || [];
        const sessions = data.sessions || [];
        
        console.log(`Loaded ${allRecordings.length} recordings and ${sessions.length} sessions`);
        
        // Charger les options de filtre
        populateFilterOptions(sessions);
        
        // Afficher tous les enregistrements initialement
        filteredRecordings = [...allRecordings];
        displayRecordingsList();
        
        // Masquer les erreurs précédentes
        hideError('recordingsError');
        
    } catch (error) {
        console.error('Error loading recordings:', error);
        showError('recordingsError', 'Failed to load recordings. Please try again later.');
        document.getElementById('recordingsListContent').innerHTML = 
            '<p style="color: #e53e3e; text-align: center;">Failed to load recordings. Please check your connection and try again.</p>';
    }
}

function populateFilterOptions(sessions) {
    const sessionFilter = document.getElementById('sessionFilter');
    
    if (!sessionFilter) {
        console.error('Session filter element not found');
        return;
    }
    
    // Effacer les options existantes sauf "All Sessions"
    sessionFilter.innerHTML = '<option value="">All Sessions</option>';
    
    // Ajouter les sessions uniques
    const uniqueSessions = [...new Set(sessions.map(s => s.sessionId))];
    console.log('Unique sessions found:', uniqueSessions.length);
    
    uniqueSessions.forEach(sessionId => {
        if (sessionId) {
            const option = document.createElement('option');
            option.value = sessionId;
            option.textContent = `Session ${sessionId.substring(0, 8)}...`;
            sessionFilter.appendChild(option);
        }
    });
}

function displayRecordingsList() {
    const container = document.getElementById('recordingsListContent');
    
    if (!container) {
        console.error('Recordings list container not found');
        return;
    }
    
    if (!filteredRecordings || filteredRecordings.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #718096;">No recordings found matching the selected filters.</p>';
        return;
    }
    
    const recordingsHTML = filteredRecordings.map((recording, index) => {
        // Vérifier et formater les données
        const createdAt = recording.createdAt ? 
            new Date(recording.createdAt).toLocaleString() : 
            'Date unknown';
            
        const sessionInfo = recording.session ? 
            `${recording.session.gender || 'Unknown'}, ${recording.session.age || 'Unknown'} years` : 
            'Session info unavailable';
            
        const sentence = recording.sentence || 'Sentence not available';
        const sentenceIndex = recording.sentenceIndex !== undefined ? 
            recording.sentenceIndex + 1 : 
            'Unknown';
        const sessionId = recording.sessionId || 'Unknown';
        const filename = recording.filename || 'Unknown';
        const fileSize = recording.fileSize || 0;
        
        return `
            <div class="recording-item">
                <div class="recording-info">
                    <div class="recording-title">
                        Recording ${sentenceIndex} - Session ${sessionId.substring(0, 8)}...
                    </div>
                    <div class="recording-meta">
                        <strong>Sentence:</strong> "${sentence}"<br>
                        <strong>Participant:</strong> ${sessionInfo}<br>
                        <strong>Recorded:</strong> ${createdAt}<br>
                        <strong>File:</strong> ${filename} (${formatBytes(fileSize)})
                    </div>
                </div>
                <div class="recording-actions">
                    <button class="btn btn-small play-btn" data-recording-id="${recording._id}" data-action="play">
                        ▶️ Play
                    </button>
                    <button class="btn btn-small btn-secondary download-btn" data-recording-id="${recording._id}" data-filename="${filename}" data-action="download">
                        📥 Download
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = recordingsHTML;
    
    // Ajouter les event listeners après avoir créé le HTML
    attachRecordingEventListeners();
}

// Nouvelle fonction pour attacher les event listeners
function attachRecordingEventListeners() {
    // Gestionnaires pour les boutons Play
    document.querySelectorAll('.play-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const recordingId = e.target.getAttribute('data-recording-id');
            playRecordingFromList(recordingId);
        });
    });
    
    // Gestionnaires pour les boutons Download
    document.querySelectorAll('.download-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const recordingId = e.target.getAttribute('data-recording-id');
            const filename = e.target.getAttribute('data-filename');
            downloadRecording(recordingId, filename);
        });
    });
}

function filterRecordings() {
    const sessionFilter = document.getElementById('sessionFilter');
    const genderFilter = document.getElementById('genderFilter');
    const ageFilter = document.getElementById('ageFilter');
    
    if (!sessionFilter || !genderFilter || !ageFilter) {
        console.error('Filter elements not found');
        return;
    }
    
    const sessionValue = sessionFilter.value;
    const genderValue = genderFilter.value;
    const ageValue = ageFilter.value;
    
    console.log('Filtering with:', { sessionValue, genderValue, ageValue });
    
    filteredRecordings = allRecordings.filter(recording => {
        // Filtre par session
        if (sessionValue && recording.sessionId !== sessionValue) {
            return false;
        }
        
        // Filtre par genre
        if (genderValue && recording.session?.gender !== genderValue) {
            return false;
        }
        
        // Filtre par âge
        if (ageValue && recording.session?.age) {
            const age = recording.session.age;
            switch (ageValue) {
                case '18-25':
                    if (age < 18 || age > 25) return false;
                    break;
                case '26-35':
                    if (age < 26 || age > 35) return false;
                    break;
                case '36-45':
                    if (age < 36 || age > 45) return false;
                    break;
                case '46-60':
                    if (age < 46 || age > 60) return false;
                    break;
                case '60+':
                    if (age <= 60) return false;
                    break;
            }
        }
        
        return true;
    });
    
    console.log(`Filtered ${filteredRecordings.length} recordings from ${allRecordings.length} total`);
    displayRecordingsList();
}

async function playRecordingFromList(recordingId) {
    try {
        console.log('Playing recording:', recordingId);
        
        const response = await fetch(`/api/recording/${recordingId}/play`);
        
        if (!response.ok) {
            throw new Error(`Failed to load recording: ${response.status}`);
        }
        
        const audioBlob = await response.blob();
        console.log('Audio blob loaded:', audioBlob.size, 'bytes');
        
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            console.log('Audio playback ended');
        };
        
        audio.onerror = (error) => {
            console.error('Audio playback error:', error);
            URL.revokeObjectURL(audioUrl);
            showError('recordingsError', 'Failed to play recording. The audio file may be corrupted.');
        };
        
        await audio.play();
        console.log('Audio playback started');
        
    } catch (error) {
        console.error('Error playing recording:', error);
        showError('recordingsError', 'Failed to play recording. Please try again.');
    }
}

async function downloadRecording(recordingId, filename) {
    try {
        console.log('Downloading recording:', recordingId, filename);
        
        const response = await fetch(`/api/recording/${recordingId}/download`);
        
        if (!response.ok) {
            throw new Error(`Failed to download recording: ${response.status}`);
        }
        
        const blob = await response.blob();
        console.log('Download blob loaded:', blob.size, 'bytes');
        
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `recording-${recordingId}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        console.log('Download initiated for:', filename);
        
    } catch (error) {
        console.error('Error downloading recording:', error);
        showError('recordingsError', 'Failed to download recording. Please try again.');
    }
}

// ======================
// CRÉATION DES MODULES GLOBAUX
// ======================

// Module de gestion des statistiques
window.statsModule = {
    loadStatistics: loadStatistics,
    displayStatistics: displayStatistics
};

// Module de gestion des enregistrements
window.recordingsModule = {
    loadRecordingsList: loadRecordingsList,
    filterRecordings: filterRecordings,
    displayRecordingsList: displayRecordingsList,
    populateFilterOptions: populateFilterOptions,
    playRecordingFromList: playRecordingFromList,
    downloadRecording: downloadRecording
};

console.log('Stats and Recordings modules loaded successfully');

// ======================
// FONCTIONS UTILITAIRES
// ======================

function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        errorElement.style.color = '#e53e3e';
    } else {
        console.error(`Error element '${elementId}' not found. Message: ${message}`);
    }
}

function hideError(elementId) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.style.display = 'none';
    }
}

function showSuccess(message) {
    const successElement = document.getElementById('recordingSuccess');
    if (successElement) {
        successElement.textContent = message;
        successElement.style.display = 'block';
        successElement.style.color = '#38a169';
        setTimeout(() => hideSuccess(), 3000);
    }
}

function hideSuccess() {
    const successElement = document.getElementById('recordingSuccess');
    if (successElement) {
        successElement.style.display = 'none';
    }
}

function showLoadingMessage(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `<p style="text-align: center; color: #718096;">${message}</p>`;
    } else {
        console.error(`Loading element '${elementId}' not found`);
    }
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

console.log('Stats module loaded successfully');