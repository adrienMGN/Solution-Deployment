// Variables globales
let mediaRecorder;
let audioChunks = [];
let currentAudio = null;
let sessionId = null;
let sentences = [];
let currentSentenceIndex = 0;
let completedRecordings = 0;
let sessionStartTime = null;
let isRecording = false;
let audioStream = null; // Ajout pour gérer le stream

// Initialisation de l'application
document.addEventListener('DOMContentLoaded', function() {
    console.log('Application initialized');
    initializeEventListeners();
    showHomepage();
});

// Initialisation des écouteurs d'événements
function initializeEventListeners() {
    // Boutons de navigation
    document.getElementById('startSessionBtn').addEventListener('click', handleStartSession);
    document.getElementById('viewStatsBtn').addEventListener('click', handleViewStats);
    document.getElementById('viewRecordingsBtn').addEventListener('click', handleViewRecordings);
    
    // Boutons de retour
    document.querySelectorAll('#backToHomeBtn').forEach(btn => {
        btn.addEventListener('click', showHomepage);
    });
    
    // Formulaire démographique
    document.getElementById('demographicsForm').addEventListener('submit', handleDemographicsSubmit);
    
    // Boutons d'enregistrement
    document.getElementById('recordBtn').addEventListener('click', startRecording);
    document.getElementById('stopBtn').addEventListener('click', stopRecording);
    document.getElementById('playBtn').addEventListener('click', playRecording);
    document.getElementById('saveBtn').addEventListener('click', saveRecording);
    document.getElementById('rerecordBtn').addEventListener('click', rerecordAudio);
    document.getElementById('endSessionBtn').addEventListener('click', exitSession);
    
    // Bouton de nouvelle session
    document.getElementById('startNewSessionBtn').addEventListener('click', showHomepage);
    
    // Filtres pour la liste des enregistrements
    document.getElementById('sessionFilter').addEventListener('change', filterRecordings);
    document.getElementById('genderFilter').addEventListener('change', filterRecordings);
    document.getElementById('ageFilter').addEventListener('change', filterRecordings);
}

// Gestion des pages
function showHomepage() {
    activatePage('homepage');
    resetSession();
}

function showDemographicsPage() {
    activatePage('demographics');
}

function showRecordingPage() {
    activatePage('recording');
    loadSentence();
}

function showCompletionPage() {
    activatePage('completion');
    updateCompletionStats();
}

function showStatsPage() {
    activatePage('statistics');
    loadStatistics();
}

function showRecordingsPage() {
    activatePage('recordingsList');
    loadRecordingsList();
}

function activatePage(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
}

// Gestionnaires d'événements
function handleStartSession() {
    console.log('Start Recording Session button clicked');
    showDemographicsPage();
}

function handleViewStats() {
    console.log('View Statistics button clicked');
    showStatsPage();
}

function handleViewRecordings() {
    console.log('View Recordings button clicked');
    showRecordingsPage();
}

async function handleDemographicsSubmit(event) {
    event.preventDefault();
    
    const age = document.getElementById('age').value;
    const gender = document.getElementById('gender').value;
    const sentenceCount = document.getElementById('sentenceCount').value;
    const consent = document.getElementById('consent').checked;
    
    // Validation
    if (!age || !gender || !sentenceCount || !consent) {
        showError('demographicsError', 'Please fill out all required fields and provide consent.');
        return;
    }
    
    // Masquer les erreurs
    hideError('demographicsError');
    
    try {
        // Créer une nouvelle session
        const response = await fetch('/api/session/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                age: parseInt(age),
                gender,
                sentenceCount: parseInt(sentenceCount),
                consentGiven: consent
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to start session');
        }
        
        const data = await response.json();
        sessionId = data.sessionId;
        sentences = data.sentences;
        sessionStartTime = Date.now();
        
        console.log('Session started:', sessionId);
        console.log('Sentences loaded:', sentences.length);
        
        // Naviguer vers la page d'enregistrement
        showRecordingPage();
        
    } catch (error) {
        console.error('Error starting session:', error);
        showError('demographicsError', 'Failed to start session. Please try again.');
    }
}

// Fonctions d'enregistrement audio - CORRIGÉES
async function startRecording() {
    try {
        // Arrêter tout enregistrement en cours
        if (mediaRecorder && isRecording) {
            stopRecording();
        }
        
        // Libérer le stream précédent s'il existe
        if (audioStream) {
            audioStream.getTracks().forEach(track => track.stop());
        }
        
        console.log('Requesting microphone access...');
        
        // Demander l'autorisation d'accès au microphone avec contraintes spécifiques
        audioStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 44100
            } 
        });
        
        console.log('Microphone access granted');
        
        // Réinitialiser les chunks audio
        audioChunks = [];
        
        // Déterminer le type MIME supporté
        let mimeType = 'audio/webm';
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
            mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
            mimeType = 'audio/ogg;codecs=opus';
        }
        
        console.log('Using MIME type:', mimeType);
        
        // Configurer MediaRecorder avec options
        mediaRecorder = new MediaRecorder(audioStream, {
            mimeType: mimeType,
            audioBitsPerSecond: 128000
        });
        
        // Gestionnaire d'événements pour les données disponibles
        mediaRecorder.ondataavailable = (event) => {
            console.log('Data available:', event.data.size, 'bytes');
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };
        
        // Gestionnaire d'événements pour l'arrêt de l'enregistrement
        mediaRecorder.onstop = () => {
            console.log('MediaRecorder stopped. Total chunks:', audioChunks.length);
            
            if (audioChunks.length > 0) {
                // Créer le blob audio avec le bon type MIME
                currentAudio = new Blob(audioChunks, { type: mimeType });
                console.log('Audio blob created:', currentAudio.size, 'bytes');
                
                // Activer les boutons appropriés
                updateRecordingButtons('recorded');
            } else {
                console.error('No audio data recorded');
                showError('recordingError', 'No audio data was recorded. Please try again.');
                updateRecordingButtons('initial');
            }
            
            // Arrêter le stream
            if (audioStream) {
                audioStream.getTracks().forEach(track => {
                    track.stop();
                    console.log('Audio track stopped');
                });
                audioStream = null;
            }
        };
        
        // Gestionnaire d'erreurs
        mediaRecorder.onerror = (event) => {
            console.error('MediaRecorder error:', event.error);
            showError('recordingError', 'Recording error: ' + event.error.message);
            updateRecordingButtons('initial');
            isRecording = false;
        };
        
        // Gestionnaire de démarrage
        mediaRecorder.onstart = () => {
            console.log('MediaRecorder started');
            isRecording = true;
            updateRecordingButtons('recording');
            updateRecordingIndicator('recording');
        };
        
        // Commencer l'enregistrement avec des intervalles réguliers pour garantir la capture des données
        mediaRecorder.start(100); // Collecter les données toutes les 100ms
        
        console.log('Recording started with state:', mediaRecorder.state);
        
    } catch (error) {
        console.error('Error starting recording:', error);
        let errorMessage = 'Failed to access microphone. ';
        
        if (error.name === 'NotAllowedError') {
            errorMessage += 'Please allow microphone access and try again.';
        } else if (error.name === 'NotFoundError') {
            errorMessage += 'No microphone found. Please connect a microphone.';
        } else if (error.name === 'NotSupportedError') {
            errorMessage += 'Audio recording is not supported in this browser.';
        } else {
            errorMessage += 'Please check your microphone and try again.';
        }
        
        showError('recordingError', errorMessage);
        updateRecordingButtons('initial');
        isRecording = false;
    }
}

function stopRecording() {
    console.log('Stop recording called. Current state:', mediaRecorder?.state, 'isRecording:', isRecording);
    
    if (mediaRecorder && isRecording && mediaRecorder.state === 'recording') {
        console.log('Stopping MediaRecorder...');
        mediaRecorder.stop();
        isRecording = false;
        updateRecordingIndicator('ready');
    } else {
        console.log('Cannot stop recording - not in recording state');
    }
}

function playRecording() {
    if (currentAudio && currentAudio.size > 0) {
        console.log('Playing recording:', currentAudio.size, 'bytes');
        
        const audioUrl = URL.createObjectURL(currentAudio);
        const audio = new Audio(audioUrl);
        
        audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            console.log('Playback ended');
        };
        
        audio.onerror = (error) => {
            console.error('Playback error:', error);
            showError('recordingError', 'Failed to play recording. The audio file may be corrupted.');
            URL.revokeObjectURL(audioUrl);
        };
        
        audio.onloadstart = () => {
            console.log('Starting audio playback...');
        };
        
        audio.play().catch(error => {
            console.error('Play error:', error);
            showError('recordingError', 'Failed to play recording.');
            URL.revokeObjectURL(audioUrl);
        });
        
    } else {
        console.error('No valid audio to play');
        showError('recordingError', 'No recording available to play.');
    }
}

async function saveRecording() {
    if (!currentAudio || currentAudio.size === 0) {
        showError('recordingError', 'No recording to save.');
        return;
    }
    
    console.log('Saving recording:', currentAudio.size, 'bytes');
    
    const formData = new FormData();
    formData.append('audio', currentAudio, `recording-${sessionId}-${currentSentenceIndex + 1}.webm`);
    formData.append('sessionId', sessionId);
    formData.append('sentenceIndex', currentSentenceIndex);
    formData.append('sentence', sentences[currentSentenceIndex]);
    
    try {
        // Désactiver le bouton de sauvegarde pendant l'upload
        document.getElementById('saveBtn').disabled = true;
        
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Failed to save recording');
        }
        
        const data = await response.json();
        completedRecordings++;
        
        console.log('Recording saved:', data);
        showSuccess('Recording saved successfully!');
        
        // Réinitialiser l'interface
        resetRecordingInterface();
        
        // Passer à la phrase suivante ou terminer la session
        if (completedRecordings < sentences.length) {
            setTimeout(() => {
                currentSentenceIndex++;
                loadSentence();
            }, 1500);
        } else {
            setTimeout(() => {
                completeSession();
            }, 1500);
        }
        
    } catch (error) {
        console.error('Error saving recording:', error);
        showError('recordingError', 'Failed to save recording. Please try again.');
        document.getElementById('saveBtn').disabled = false;
    }
}

function rerecordAudio() {
    // Libérer les ressources audio
    if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        audioStream = null;
    }
    
    currentAudio = null;
    audioChunks = [];
    resetRecordingInterface();
    hideError('recordingError');
    hideSuccess();
    console.log('Ready to re-record');
}

async function exitSession() {
    if (confirm('Are you sure you want to end the session early?')) {
        try {
            // Libérer les ressources audio avant de quitter
            if (audioStream) {
                audioStream.getTracks().forEach(track => track.stop());
                audioStream = null;
            }
            
            const response = await fetch('/api/session/end', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ sessionId })
            });
            
            if (!response.ok) {
                throw new Error('Failed to end session');
            }
            
            console.log('Session ended early');
            showHomepage();
            
        } catch (error) {
            console.error('Error ending session:', error);
            showError('recordingError', 'Failed to end session. Please try again.');
        }
    }
}

// Nouvelles fonctions pour la liste des enregistrements
let allRecordings = [];
let filteredRecordings = [];

async function loadRecordingsList() {
    try {
        showLoadingMessage('recordingsListContent', 'Loading recordings...');
        
        const response = await fetch('/api/recordings');
        
        if (!response.ok) {
            throw new Error('Failed to load recordings');
        }
        
        const data = await response.json();
        allRecordings = data.recordings;
        
        // Charger les options de filtre
        populateFilterOptions(data.sessions);
        
        // Afficher tous les enregistrements initialement
        filteredRecordings = allRecordings;
        displayRecordingsList();
        
        console.log('Recordings loaded:', allRecordings.length);
        
    } catch (error) {
        console.error('Error loading recordings:', error);
        showError('recordingsError', 'Failed to load recordings. Please try again later.');
        document.getElementById('recordingsListContent').innerHTML = '';
    }
}

function populateFilterOptions(sessions) {
    const sessionFilter = document.getElementById('sessionFilter');
    
    // Effacer les options existantes sauf "All Sessions"
    sessionFilter.innerHTML = '<option value="">All Sessions</option>';
    
    // Ajouter les sessions uniques
    const uniqueSessions = [...new Set(sessions.map(s => s.sessionId))];
    uniqueSessions.forEach(sessionId => {
        const option = document.createElement('option');
        option.value = sessionId;
        option.textContent = `Session ${sessionId.substring(0, 8)}...`;
        sessionFilter.appendChild(option);
    });
}

function filterRecordings() {
    const sessionFilter = document.getElementById('sessionFilter').value;
    const genderFilter = document.getElementById('genderFilter').value;
    const ageFilter = document.getElementById('ageFilter').value;
    
    filteredRecordings = allRecordings.filter(recording => {
        // Filtre par session
        if (sessionFilter && recording.sessionId !== sessionFilter) {
            return false;
        }
        
        // Filtre par genre
        if (genderFilter && recording.session?.gender !== genderFilter) {
            return false;
        }
        
        // Filtre par âge
        if (ageFilter && recording.session?.age) {
            const age = recording.session.age;
            switch (ageFilter) {
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
    
    displayRecordingsList();
}

function displayRecordingsList() {
    const container = document.getElementById('recordingsListContent');
    
    if (filteredRecordings.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #718096;">No recordings found matching the selected filters.</p>';
        return;
    }
    
    const recordingsHTML = filteredRecordings.map(recording => {
        const createdAt = new Date(recording.createdAt).toLocaleString();
        const sessionInfo = recording.session ? 
            `${recording.session.gender}, ${recording.session.age} years` : 
            'Session info unavailable';
        
        return `
            <div class="recording-item">
                <div class="recording-info">
                    <div class="recording-title">
                        Recording ${recording.sentenceIndex + 1} - Session ${recording.sessionId.substring(0, 8)}...
                    </div>
                    <div class="recording-meta">
                        <strong>Sentence:</strong> "${recording.sentence}"<br>
                        <strong>Participant:</strong> ${sessionInfo}<br>
                        <strong>Recorded:</strong> ${createdAt}<br>
                        <strong>File:</strong> ${recording.filename} (${formatBytes(recording.fileSize)})
                    </div>
                </div>
                <div class="recording-actions">
                    <button class="btn btn-small play-btn" data-recording-id="${recording._id}">
                        ▶️ Play
                    </button>
                    <button class="btn btn-small btn-secondary download-btn" data-recording-id="${recording._id}" data-filename="${recording.filename}">
                        📥 Download
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = recordingsHTML;
    
    // Ajouter les écouteurs d'événements pour les nouveaux boutons
    attachRecordingEventListeners();
}

function attachRecordingEventListeners() {
    // Écouteurs pour les boutons Play
    document.querySelectorAll('.play-btn').forEach(button => {
        button.addEventListener('click', function() {
            const recordingId = this.getAttribute('data-recording-id');
            playRecordingFromList(recordingId);
        });
    });
    
    // Écouteurs pour les boutons Download
    document.querySelectorAll('.download-btn').forEach(button => {
        button.addEventListener('click', function() {
            const recordingId = this.getAttribute('data-recording-id');
            const filename = this.getAttribute('data-filename');
            downloadRecording(recordingId, filename);
        });
    });
}

async function playRecordingFromList(recordingId) {
    try {
        const response = await fetch(`/api/recording/${recordingId}/play`);
        
        if (!response.ok) {
            throw new Error('Failed to load recording');
        }
        
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
        };
        
        audio.play();
        
    } catch (error) {
        console.error('Error playing recording:', error);
        showError('recordingsError', 'Failed to play recording. Please try again.');
    }
}

async function downloadRecording(recordingId, filename) {
    try {
        const response = await fetch(`/api/recording/${recordingId}/download`);
        
        if (!response.ok) {
            throw new Error('Failed to download recording');
        }
        
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        
    } catch (error) {
        console.error('Error downloading recording:', error);
        showError('recordingsError', 'Failed to download recording. Please try again.');
    }
}

// Fonctions utilitaires
function loadSentence() {
    if (currentSentenceIndex >= sentences.length) {
        completeSession();
        return;
    }
    
    // Afficher la phrase actuelle
    const sentenceDisplay = document.getElementById('sentenceDisplay');
    sentenceDisplay.textContent = sentences[currentSentenceIndex];
    
    // Mettre à jour les statistiques
    updateRecordingUI();
    
    // Réinitialiser l'interface d'enregistrement
    resetRecordingInterface();
    
    console.log(`Loaded sentence ${currentSentenceIndex + 1}/${sentences.length}`);
}

function updateRecordingUI() {
    document.getElementById('currentSentenceNum').textContent = currentSentenceIndex + 1;
    document.getElementById('totalSentences').textContent = sentences.length;
    document.getElementById('completedCount').textContent = completedRecordings;
    
    // Mettre à jour la barre de progression
    const progressFill = document.getElementById('progressFill');
    const progressPercentage = ((currentSentenceIndex + 1) / sentences.length) * 100;
    progressFill.style.width = `${progressPercentage}%`;
}

function updateRecordingButtons(state) {
    const recordBtn = document.getElementById('recordBtn');
    const stopBtn = document.getElementById('stopBtn');
    const playBtn = document.getElementById('playBtn');
    const saveBtn = document.getElementById('saveBtn');
    const rerecordBtn = document.getElementById('rerecordBtn');
    
    switch (state) {
        case 'initial':
            recordBtn.disabled = false;
            stopBtn.disabled = true;
            playBtn.disabled = true;
            saveBtn.disabled = true;
            rerecordBtn.disabled = true;
            break;
        case 'recording':
            recordBtn.disabled = true;
            stopBtn.disabled = false;
            playBtn.disabled = true;
            saveBtn.disabled = true;
            rerecordBtn.disabled = true;
            break;
        case 'recorded':
            recordBtn.disabled = false;
            stopBtn.disabled = true;
            playBtn.disabled = false;
            saveBtn.disabled = false;
            rerecordBtn.disabled = false;
            break;
    }
}

function updateRecordingIndicator(state) {
    const indicator = document.getElementById('recordingIndicator');
    indicator.className = 'status-indicator ' + state;
}

function resetRecordingInterface() {
    // Libérer les ressources audio
    if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        audioStream = null;
    }
    
    currentAudio = null;
    audioChunks = [];
    isRecording = false;
    updateRecordingButtons('initial');
    updateRecordingIndicator('');
    hideError('recordingError');
    hideSuccess();
}

async function completeSession() {
    try {
        const response = await fetch('/api/session/complete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sessionId })
        });
        
        if (!response.ok) {
            throw new Error('Failed to complete session');
        }
        
        const data = await response.json();
        console.log('Session completed:', data);
        showCompletionPage();
        
    } catch (error) {
        console.error('Error completing session:', error);
        showError('recordingError', 'Failed to complete session properly, but your recordings are saved.');
        setTimeout(() => showCompletionPage(), 2000);
    }
}

function updateCompletionStats() {
    document.getElementById('finalCompletedCount').textContent = completedRecordings;
    
    if (sessionStartTime) {
        const duration = Math.round((Date.now() - sessionStartTime) / 60000);
        document.getElementById('sessionDuration').textContent = duration;
    }
}

async function loadStatistics() {
    try {
        const response = await fetch('/api/stats');
        
        if (!response.ok) {
            throw new Error('Failed to load statistics');
        }
        
        const stats = await response.json();
        displayStatistics(stats);
        
    } catch (error) {
        console.error('Error loading statistics:', error);
        document.getElementById('statsContent').innerHTML = 
            '<p style="color: #e53e3e;">Failed to load statistics. Please try again later.</p>';
    }
}

function displayStatistics(stats) {
    const statsHTML = `
        <div class="stats">
            <div class="stat-item">
                <div class="stat-number">${stats.sessions.total}</div>
                <div class="stat-label">Total Sessions</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${stats.sessions.completed}</div>
                <div class="stat-label">Completed</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${stats.recordings.total}</div>
                <div class="stat-label">Total Recordings</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${stats.sessions.averageAge}</div>
                <div class="stat-label">Average Age</div>
            </div>
        </div>
        
        <div style="margin-top: 20px;">
            <h3>Gender Distribution</h3>
            <div class="stats">
                ${Object.entries(stats.sessions.genderDistribution).map(([gender, count]) => `
                    <div class="stat-item">
                        <div class="stat-number">${count}</div>
                        <div class="stat-label">${gender}</div>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div style="margin-top: 20px;">
            <h3>System Information</h3>
            <p><strong>Server Uptime:</strong> ${Math.round(stats.system.uptime / 60)} minutes</p>
            <p><strong>Total File Size:</strong> ${formatBytes(stats.recordings.totalFileSize)}</p>
            <p><strong>Average File Size:</strong> ${formatBytes(stats.recordings.averageFileSize)}</p>
        </div>
    `;
    
    document.getElementById('statsContent').innerHTML = statsHTML;
}

// Fonctions d'aide
function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    errorElement.textContent = message;
    errorElement.style.display = 'block';
}

function hideError(elementId) {
    const errorElement = document.getElementById(elementId);
    errorElement.style.display = 'none';
}

function showSuccess(message) {
    const successElement = document.getElementById('recordingSuccess');
    successElement.textContent = message;
    successElement.style.display = 'block';
    setTimeout(() => hideSuccess(), 3000);
}

function hideSuccess() {
    const successElement = document.getElementById('recordingSuccess');
    successElement.style.display = 'none';
}

function showLoadingMessage(elementId, message) {
    const element = document.getElementById(elementId);
    element.innerHTML = `<p style="text-align: center; color: #718096;">${message}</p>`;
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function resetSession() {
    // Libérer les ressources audio
    if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        audioStream = null;
    }
    
    sessionId = null;
    sentences = [];
    currentSentenceIndex = 0;
    completedRecordings = 0;
    sessionStartTime = null;
    currentAudio = null;
    isRecording = false;
    audioChunks = [];
    
    // Réinitialiser le formulaire
    document.getElementById('demographicsForm').reset();
    hideError('demographicsError');
}

console.log('Client JavaScript loaded successfully');