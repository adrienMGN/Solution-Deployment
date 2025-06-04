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
let audioStream = null;

// Export des variables globales pour les autres modules
window.appState = {
    mediaRecorder,
    audioChunks,
    currentAudio,
    sessionId,
    sentences,
    currentSentenceIndex,
    completedRecordings,
    sessionStartTime,
    isRecording,
    audioStream,
    
    // Méthodes pour mettre à jour l'état
    setMediaRecorder: (recorder) => { window.appState.mediaRecorder = mediaRecorder = recorder; },
    setAudioChunks: (chunks) => { window.appState.audioChunks = audioChunks = chunks; },
    setCurrentAudio: (audio) => { window.appState.currentAudio = currentAudio = audio; },
    setSessionId: (id) => { window.appState.sessionId = sessionId = id; },
    setSentences: (sentenceArray) => { window.appState.sentences = sentences = sentenceArray; },
    setCurrentSentenceIndex: (index) => { window.appState.currentSentenceIndex = currentSentenceIndex = index; },
    setCompletedRecordings: (count) => { window.appState.completedRecordings = completedRecordings = count; },
    setSessionStartTime: (time) => { window.appState.sessionStartTime = sessionStartTime = time; },
    setIsRecording: (recording) => { window.appState.isRecording = isRecording = recording; },
    setAudioStream: (stream) => { window.appState.audioStream = audioStream = stream; },
    
    // Getters
    getMediaRecorder: () => mediaRecorder,
    getAudioChunks: () => audioChunks,
    getCurrentAudio: () => currentAudio,
    getSessionId: () => sessionId,
    getSentences: () => sentences,
    getCurrentSentenceIndex: () => currentSentenceIndex,
    getCompletedRecordings: () => completedRecordings,
    getSessionStartTime: () => sessionStartTime,
    getIsRecording: () => isRecording,
    getAudioStream: () => audioStream
};

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
    document.getElementById('recordBtn').addEventListener('click', window.audioModule.startRecording);
    document.getElementById('stopBtn').addEventListener('click', window.audioModule.stopRecording);
    document.getElementById('playBtn').addEventListener('click', window.audioModule.playRecording);
    document.getElementById('saveBtn').addEventListener('click', window.audioModule.saveRecording);
    document.getElementById('rerecordBtn').addEventListener('click', window.audioModule.rerecordAudio);
    document.getElementById('endSessionBtn').addEventListener('click', exitSession);
    
    // Bouton de nouvelle session
    document.getElementById('startNewSessionBtn').addEventListener('click', showHomepage);
    
    // Filtres pour la liste des enregistrements
    document.getElementById('sessionFilter').addEventListener('change', window.recordingsModule.filterRecordings);
    document.getElementById('genderFilter').addEventListener('change', window.recordingsModule.filterRecordings);
    document.getElementById('ageFilter').addEventListener('change', window.recordingsModule.filterRecordings);
}

// Gestionnaires d'événements principaux
function handleStartSession() {
    console.log('Start Recording Session button clicked');
    window.pagesModule.showDemographicsPage();
}

function handleViewStats() {
    console.log('View Statistics button clicked');
    window.pagesModule.showStatsPage();
}

function handleViewRecordings() {
    console.log('View Recordings button clicked');
    window.pagesModule.showRecordingsPage();
}

async function handleDemographicsSubmit(event) {
    event.preventDefault();
    
    const age = document.getElementById('age').value;
    const gender = document.getElementById('gender').value;
    const sentenceCount = document.getElementById('sentenceCount').value;
    const consent = document.getElementById('consent').checked;
    
    // Validation
    if (!age || !gender || !sentenceCount || !consent) {
        window.utils.showError('demographicsError', 'Please fill out all required fields and provide consent.');
        return;
    }
    
    // Masquer les erreurs
    window.utils.hideError('demographicsError');
    
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
        window.appState.setSessionId(data.sessionId);
        window.appState.setSentences(data.sentences);
        window.appState.setSessionStartTime(Date.now());
        
        console.log('Session started:', sessionId);
        console.log('Sentences loaded:', sentences.length);
        
        // Naviguer vers la page d'enregistrement
        window.pagesModule.showRecordingPage();
        
    } catch (error) {
        console.error('Error starting session:', error);
        window.utils.showError('demographicsError', 'Failed to start session. Please try again.');
    }
}

async function exitSession() {
    if (confirm('Are you sure you want to end the session early?')) {
        try {
            // Libérer les ressources audio avant de quitter
            if (audioStream) {
                audioStream.getTracks().forEach(track => track.stop());
                window.appState.setAudioStream(null);
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
            window.utils.showError('recordingError', 'Failed to end session. Please try again.');
        }
    }
}

function showHomepage() {
    window.pagesModule.activatePage('homepage');
    resetSession();
}

function resetSession() {
    // Libérer les ressources audio
    if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        window.appState.setAudioStream(null);
    }
    
    window.appState.setSessionId(null);
    window.appState.setSentences([]);
    window.appState.setCurrentSentenceIndex(0);
    window.appState.setCompletedRecordings(0);
    window.appState.setSessionStartTime(null);
    window.appState.setCurrentAudio(null);
    window.appState.setIsRecording(false);
    window.appState.setAudioChunks([]);
    
    // Réinitialiser le formulaire
    document.getElementById('demographicsForm').reset();
    window.utils.hideError('demographicsError');
}

console.log('Main application loaded successfully');