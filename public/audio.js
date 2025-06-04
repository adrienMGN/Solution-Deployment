// Variables globales pour l'audio
let mediaRecorder = null;
let audioChunks = [];
let currentAudio = null;
let isRecording = false;
let audioStream = null;

// ======================
// FONCTIONS AUDIO PRINCIPALES
// ======================

// Vérifier l'accès au microphone
async function checkMicrophoneAccess() {
    try {
        console.log('🎤 Checking microphone access...');
        
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Microphone access is not supported in this browser');
        }
        
        console.log('✅ MediaDevices API available');
        
        // Tester l'accès au microphone
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('✅ Microphone access successful');
        
        // Arrêter immédiatement le stream de test
        stream.getTracks().forEach(track => track.stop());
        return true;
        
    } catch (error) {
        console.error('❌ Microphone access error:', error);
        handleMicrophoneError(error);
        return false;
    }
}

// Gérer les erreurs de microphone
function handleMicrophoneError(error) {
    let errorMessage = 'Failed to access microphone. ';
    
    if (error.name === 'NotFoundError') {
        errorMessage += 'No microphone found. Please connect a microphone and try again.';
    } else if (error.name === 'NotAllowedError') {
        errorMessage += 'Microphone access denied. Please allow microphone access and refresh the page.';
    } else if (error.name === 'NotSupportedError') {
        errorMessage += 'Microphone is not supported in this browser.';
    } else if (error.name === 'OverconstrainedError') {
        errorMessage += 'Microphone constraints not satisfied. Please try again.';
    } else {
        errorMessage += error.message || 'Please check your microphone and try again.';
    }
    
    showError('recordingError', errorMessage);
    updateRecordingButtons('initial');
}

// Démarrer l'enregistrement
async function startRecording() {
    try {
        console.log('🎙️ Starting recording...');
        
        const hasAccess = await checkMicrophoneAccess();
        if (!hasAccess) return;
        
        hideError('recordingError');
        
        audioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });
        
        mediaRecorder = new MediaRecorder(audioStream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = () => processRecording();
        mediaRecorder.onerror = (error) => handleRecordingError('Recording failed. Please try again.');
        
        mediaRecorder.start();
        isRecording = true;
        
        updateRecordingButtons('recording');
        updateRecordingIndicator('recording');
        
        console.log('✅ Recording started');
        
    } catch (error) {
        console.error('❌ Error starting recording:', error);
        handleRecordingError('Failed to start recording. Please check your microphone.');
    }
}

// Arrêter l'enregistrement
function stopRecording() {
    try {
        if (mediaRecorder && isRecording) {
            mediaRecorder.stop();
            isRecording = false;
            
            if (audioStream) {
                audioStream.getTracks().forEach(track => track.stop());
            }
            
            updateRecordingIndicator('stopped');
            console.log('✅ Recording stopped');
        }
    } catch (error) {
        console.error('❌ Error stopping recording:', error);
        handleRecordingError('Failed to stop recording.');
    }
}

// Traiter l'enregistrement
function processRecording() {
    try {
        if (audioChunks.length === 0) {
            throw new Error('No audio data recorded');
        }
        
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        currentAudio = {
            blob: audioBlob,
            url: audioUrl
        };
        
        updateRecordingButtons('recorded');
        showSuccess('Recording completed successfully!');
        
        console.log('✅ Recording processed');
        
    } catch (error) {
        console.error('❌ Error processing recording:', error);
        handleRecordingError('Failed to process recording.');
    }
}

// Lire l'enregistrement
function playRecording() {
    try {
        if (!currentAudio) {
            throw new Error('No recording available to play');
        }
        
        const audio = new Audio(currentAudio.url);
        audio.play();
        
    } catch (error) {
        console.error('❌ Error playing recording:', error);
        handleRecordingError('Failed to play recording.');
    }
}

// Sauvegarder l'enregistrement
async function saveRecording() {
    try {
        if (!currentAudio) {
            throw new Error('No recording to save');
        }
        
        const sessionData = {
            sessionId: sessionId,
            sentenceIndex: currentSentenceIndex,
            sentence: sentences[currentSentenceIndex]
        };
        
        const formData = new FormData();
        formData.append('audio', currentAudio.blob, 'recording.webm');
        formData.append('sessionData', JSON.stringify(sessionData));
        
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        showSuccess('Recording saved successfully!');
        nextSentence();
        
    } catch (error) {
        console.error('❌ Error saving recording:', error);
        handleRecordingError('Failed to save recording. Please try again.');
    }
}

// Réenregistrer
function rerecordAudio() {
    if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        audioStream = null;
    }
    
    if (currentAudio && currentAudio.url) {
        URL.revokeObjectURL(currentAudio.url);
    }
    
    currentAudio = null;
    audioChunks = [];
    isRecording = false;
    
    updateRecordingButtons('initial');
    updateRecordingIndicator('');
    hideError('recordingError');
    hideSuccess();
}

// ======================
// FONCTIONS D'INTERFACE
// ======================

function updateRecordingButtons(state) {
    const recordBtn = document.getElementById('recordBtn');
    const stopBtn = document.getElementById('stopBtn');
    const playBtn = document.getElementById('playBtn');
    const saveBtn = document.getElementById('saveBtn');
    const rerecordBtn = document.getElementById('rerecordBtn');
    
    switch (state) {
        case 'initial':
            if (recordBtn) recordBtn.disabled = false;
            if (stopBtn) stopBtn.disabled = true;
            if (playBtn) playBtn.disabled = true;
            if (saveBtn) saveBtn.disabled = true;
            if (rerecordBtn) rerecordBtn.disabled = true;
            break;
        case 'recording':
            if (recordBtn) recordBtn.disabled = true;
            if (stopBtn) stopBtn.disabled = false;
            if (playBtn) playBtn.disabled = true;
            if (saveBtn) saveBtn.disabled = true;
            if (rerecordBtn) rerecordBtn.disabled = true;
            break;
        case 'recorded':
            if (recordBtn) recordBtn.disabled = false;
            if (stopBtn) stopBtn.disabled = true;
            if (playBtn) playBtn.disabled = false;
            if (saveBtn) saveBtn.disabled = false;
            if (rerecordBtn) rerecordBtn.disabled = false;
            break;
    }
}

function updateRecordingIndicator(state) {
    const indicator = document.getElementById('recordingIndicator');
    if (indicator) {
        indicator.className = 'status-indicator ' + state;
        
        switch (state) {
            case 'recording':
                indicator.textContent = '🔴 Recording...';
                break;
            case 'stopped':
                indicator.textContent = '⏹️ Stopped';
                break;
            case 'error':
                indicator.textContent = '❌ Error';
                break;
            default:
                indicator.textContent = '';
        }
    }
}

function handleRecordingError(message) {
    console.error('🚨 Recording error:', message);
    
    isRecording = false;
    updateRecordingButtons('initial');
    updateRecordingIndicator('error');
    
    if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        audioStream = null;
    }
    
    showError('recordingError', message);
}

// ======================
// CRÉATION DU MODULE GLOBAL
// ======================

window.audioModule = {
    checkMicrophoneAccess: checkMicrophoneAccess,
    startRecording: startRecording,
    stopRecording: stopRecording,
    playRecording: playRecording,
    saveRecording: saveRecording,
    rerecordAudio: rerecordAudio,
    updateRecordingButtons: updateRecordingButtons,
    updateRecordingIndicator: updateRecordingIndicator,
    handleRecordingError: handleRecordingError,
    handleMicrophoneError: handleMicrophoneError,
    processRecording: processRecording
};

console.log('Audio module loaded successfully');
console.log('Available audio functions:', Object.keys(window.audioModule));