// Module de gestion audio
(function () {
    'use strict';

    // Variables locales pour l'audio
    let mediaRecorder;
    let audioChunks = [];
    let currentAudio = null;
    let isRecording = false;
    let audioStream = null;
    let isInitialized = false;

    // Fonctions utilitaires intégrées
    function showError(elementId, message) {
        const errorElement = document.getElementById(elementId);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        } else {
            console.error('Error:', message);
        }
    }

    function hideError(elementId) {
        const errorElement = document.getElementById(elementId);
        if (errorElement) {
            errorElement.style.display = 'none';
        }
    }

    function showSuccess(elementId, message) {
        const successElement = document.getElementById(elementId);
        if (successElement) {
            successElement.textContent = message;
            successElement.style.display = 'block';
        } else {
            console.log('Success:', message);
        }
    }

    function hideSuccess(elementId) {
        const successElement = document.getElementById(elementId);
        if (successElement) {
            successElement.style.display = 'none';
        }
    }

    // Interface publique du module audio
    const audioModule = {
        async initializeAudio() {
            if (isInitialized) {
                console.log('Audio already initialized');
                return;
            }

            try {
                console.log('🎤 Initializing audio...');

                // Demander l'accès au microphone
                audioStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                        sampleRate: 44100
                    }
                });

                console.log('✅ Audio stream obtained');

                // Configurer MediaRecorder
                const options = {
                    mimeType: 'audio/webm;codecs=opus'
                };

                // Vérifier le support du format
                if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                    options.mimeType = 'audio/webm';
                    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                        options.mimeType = 'audio/mp4';
                        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                            options.mimeType = '';
                        }
                    }
                }

                mediaRecorder = new MediaRecorder(audioStream, options);

                // Événements du MediaRecorder
                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunks.push(event.data);
                        console.log('📊 Audio data chunk received:', event.data.size, 'bytes');
                    }
                };

                mediaRecorder.onstop = () => {
                    console.log('🛑 Recording stopped');
                    this.processRecording();
                };

                mediaRecorder.onerror = (event) => {
                    console.error('❌ MediaRecorder error:', event.error);
                    showError('recordingError', 'Recording error: ' + event.error.message);
                };

                // Mettre à jour l'état global
                if (window.appState) {
                    window.appState.setAudioStream(audioStream);
                    window.appState.setMediaRecorder(mediaRecorder);
                }

                isInitialized = true;
                console.log('✅ MediaRecorder initialized with format:', options.mimeType);
                this.updateRecordingControls();

            } catch (error) {
                console.error('❌ Error initializing audio:', error);
                let errorMessage = 'Failed to access microphone. ';

                if (error.name === 'NotAllowedError') {
                    errorMessage += 'Please allow microphone access and reload the page.';
                } else if (error.name === 'NotFoundError') {
                    errorMessage += 'No microphone found on this device.';
                } else if (error.name === 'NotSupportedError') {
                    errorMessage += 'Audio recording is not supported in this browser.';
                } else {
                    errorMessage += error.message;
                }

                showError('recordingError', errorMessage);
                throw error;
            }
        },

        async startRecording() {
            try {
                console.log('🎙️ Starting recording...');

                // Initialiser l'audio si ce n'est pas déjà fait
                if (!isInitialized || !mediaRecorder) {
                    await this.initializeAudio();
                }

                if (!mediaRecorder) {
                    throw new Error('MediaRecorder initialization failed');
                }

                if (mediaRecorder.state !== 'inactive') {
                    throw new Error('MediaRecorder is not in inactive state');
                }

                // Réinitialiser les chunks audio
                audioChunks = [];
                if (window.appState) {
                    window.appState.setAudioChunks([]);
                }

                // Commencer l'enregistrement
                mediaRecorder.start(100); // Enregistrer par chunks de 100ms
                isRecording = true;

                if (window.appState) {
                    window.appState.setIsRecording(true);
                }

                console.log('✅ Recording started');
                this.updateRecordingControls();
                this.updateRecordingIndicator();

                // Masquer les messages d'erreur précédents
                hideError('recordingError');

            } catch (error) {
                console.error('❌ Error starting recording:', error);
                showError('recordingError', 'Failed to start recording: ' + error.message);
            }
        },

        stopRecording() {
            try {
                console.log('🛑 Stopping recording...');

                if (mediaRecorder && mediaRecorder.state === 'recording') {
                    mediaRecorder.stop();
                    isRecording = false;

                    if (window.appState) {
                        window.appState.setIsRecording(false);
                    }

                    console.log('✅ Recording stopped');
                } else {
                    console.warn('⚠️ MediaRecorder not recording');
                }

                this.updateRecordingControls();
                this.updateRecordingIndicator();

            } catch (error) {
                console.error('❌ Error stopping recording:', error);
                showError('recordingError', 'Failed to stop recording: ' + error.message);
            }
        },

        processRecording() {
            try {
                if (audioChunks.length === 0) {
                    console.warn('⚠️ No audio data to process');
                    return;
                }

                console.log('🔄 Processing recording...');

                // Créer un blob audio
                const audioBlob = new Blob(audioChunks, {
                    type: mediaRecorder.mimeType || 'audio/webm'
                });

                console.log('📊 Audio blob created:', audioBlob.size, 'bytes');

                // Créer une URL pour la lecture
                const audioUrl = URL.createObjectURL(audioBlob);
                currentAudio = new Audio(audioUrl);

                if (window.appState) {
                    window.appState.setCurrentAudio(currentAudio);
                }

                console.log('✅ Recording processed successfully');
                this.updateRecordingControls();

                // Afficher un message de succès
                showSuccess('recordingSuccess', 'Recording completed! You can now play it back or save it.');

            } catch (error) {
                console.error('❌ Error processing recording:', error);
                showError('recordingError', 'Failed to process recording: ' + error.message);
            }
        },

        playRecording() {
            try {
                if (!currentAudio) {
                    console.warn('⚠️ No audio to play');
                    return;
                }

                console.log('▶️ Playing recording...');

                currentAudio.currentTime = 0;
                currentAudio.play();

                // Événements de lecture
                currentAudio.onended = () => {
                    console.log('✅ Playback finished');
                };

                currentAudio.onerror = (error) => {
                    console.error('❌ Playback error:', error);
                    showError('recordingError', 'Failed to play recording');
                };

            } catch (error) {
                console.error('❌ Error playing recording:', error);
                showError('recordingError', 'Failed to play recording: ' + error.message);
            }
        },

        async saveRecording() {
            try {
                if (!currentAudio || audioChunks.length === 0) {
                    console.warn('⚠️ No recording to save');
                    return;
                }

                const sessionId = window.appState?.getSessionId();
                const currentSentenceIndex = window.appState?.getCurrentSentenceIndex() || 0;
                const sentences = window.appState?.getSentences() || [];

                if (!sessionId) {
                    throw new Error('No session ID available');
                }

                console.log('💾 Saving recording...', {
                    sessionId,
                    sentenceIndex: currentSentenceIndex,
                    audioSize: audioChunks.reduce((total, chunk) => total + chunk.size, 0)
                });

                // Créer le blob audio
                const audioBlob = new Blob(audioChunks, {
                    type: mediaRecorder.mimeType || 'audio/webm'
                });

                // Préparer les données du formulaire
                const formData = new FormData();
                formData.append('audio', audioBlob, `recording_${sessionId}_${currentSentenceIndex}.webm`);
                formData.append('sessionId', sessionId);
                formData.append('sentenceIndex', currentSentenceIndex.toString());
                formData.append('sentence', sentences[currentSentenceIndex] || '');

                // Envoyer au serveur
                const response = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Upload failed');
                }

                const result = await response.json();
                console.log('✅ Recording saved successfully:', result);

                // Mettre à jour le compteur
                const completedRecordings = result.completedRecordings || (window.appState?.getCompletedRecordings() + 1);
                if (window.appState) {
                    window.appState.setCompletedRecordings(completedRecordings);
                }

                // Passer à la phrase suivante automatiquement
                await this.nextSentence();

                // Afficher un message de succès
                showSuccess('recordingSuccess', 'Recording saved successfully!');

            } catch (error) {
                console.error('❌ Error saving recording:', error);
                showError('recordingError', 'Failed to save recording: ' + error.message);
            }
        },

        async nextSentence() {
            try {
                const currentIndex = window.appState?.getCurrentSentenceIndex() || 0;
                const sentences = window.appState?.getSentences() || [];
                const totalSentences = sentences.length;

                console.log('➡️ Moving to next sentence:', currentIndex + 1, 'of', totalSentences);

                if (currentIndex + 1 >= totalSentences) {
                    // Session terminée
                    await this.completeSession();
                    return;
                }

                // Passer à la phrase suivante
                const nextIndex = currentIndex + 1;
                if (window.appState) {
                    window.appState.setCurrentSentenceIndex(nextIndex);
                }

                // Réinitialiser l'enregistrement
                this.resetRecording();

                // Mettre à jour l'affichage
                this.updateSentenceDisplay();
                this.updateProgressDisplay();

                console.log('✅ Moved to sentence', nextIndex + 1);

            } catch (error) {
                console.error('❌ Error moving to next sentence:', error);
                showError('recordingError', 'Failed to move to next sentence: ' + error.message);
            }
        },

        async completeSession() {
            try {
                const sessionId = window.appState?.getSessionId();

                if (!sessionId) {
                    console.warn('⚠️ No session to complete');
                    return;
                }

                console.log('🎉 Completing session:', sessionId);

                // Arrêter le stream audio
                if (audioStream) {
                    audioStream.getTracks().forEach(track => track.stop());
                }

                // Envoyer la completion au serveur
                const response = await fetch('/api/session/complete', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ sessionId })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to complete session');
                }

                const result = await response.json();
                console.log('✅ Session completed:', result);

                // Calculer la durée de la session
                const sessionStartTime = window.appState?.getSessionStartTime();
                const sessionDuration = sessionStartTime ? Math.round((Date.now() - sessionStartTime) / 60000) : 0;

                // Afficher la page de completion si le module pages existe
                if (window.pagesModule) {
                    window.pagesModule.showCompletionPage(result.completedRecordings, sessionDuration);
                } else {
                    alert(`Session completed! ${result.completedRecordings} recordings in ${sessionDuration} minutes.`);
                    location.reload();
                }

            } catch (error) {
                console.error('❌ Error completing session:', error);
                showError('recordingError', 'Failed to complete session: ' + error.message);
            }
        },

        async endSessionEarly() {
            try {
                const sessionId = window.appState?.getSessionId();

                if (!sessionId) {
                    console.warn('⚠️ No session to end');
                    return;
                }

                console.log('🔚 Ending session early:', sessionId);

                // Arrêter le stream audio
                if (audioStream) {
                    audioStream.getTracks().forEach(track => track.stop());
                }

                // Envoyer la fin de session au serveur
                const response = await fetch('/api/session/end', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ sessionId })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to end session');
                }

                console.log('✅ Session ended early');

                // Nettoyer et retourner à l'accueil
                this.cleanup();
                if (window.pagesModule) {
                    window.pagesModule.activatePage('homepage');
                }

            } catch (error) {
                console.error('❌ Error ending session early:', error);
                showError('recordingError', 'Failed to end session: ' + error.message);
            }
        },

        rerecordAudio() {
            try {
                console.log('🔄 Re-recording audio...');

                // Réinitialiser l'enregistrement
                this.resetRecording();

                // Masquer les messages
                hideError('recordingError');
                hideSuccess('recordingSuccess');

                console.log('✅ Ready for re-recording');

            } catch (error) {
                console.error('❌ Error preparing re-recording:', error);
                showError('recordingError', 'Failed to prepare re-recording: ' + error.message);
            }
        },

        resetRecording() {
            // Arrêter la lecture en cours
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.currentTime = 0;
                URL.revokeObjectURL(currentAudio.src);
                currentAudio = null;
            }

            // Réinitialiser les chunks
            audioChunks = [];
            isRecording = false;

            // Mettre à jour l'état global
            if (window.appState) {
                window.appState.setCurrentAudio(null);
                window.appState.setAudioChunks([]);
                window.appState.setIsRecording(false);
            }

            // Mettre à jour les contrôles
            this.updateRecordingControls();
            this.updateRecordingIndicator();

            // Masquer les messages
            hideError('recordingError');
            hideSuccess('recordingSuccess');
        },

        updateRecordingControls() {
            const recordBtn = document.getElementById('recordBtn');
            const stopBtn = document.getElementById('stopBtn');
            const playBtn = document.getElementById('playBtn');
            const saveBtn = document.getElementById('saveBtn');
            const rerecordBtn = document.getElementById('rerecordBtn');

            if (!recordBtn || !stopBtn || !playBtn || !saveBtn || !rerecordBtn) {
                return;
            }

            const hasAudio = currentAudio !== null;
            const recording = isRecording;

            recordBtn.disabled = recording;
            stopBtn.disabled = !recording;
            playBtn.disabled = !hasAudio || recording;
            saveBtn.disabled = !hasAudio || recording;
            rerecordBtn.disabled = !hasAudio || recording;

            // Mettre à jour le texte du bouton d'enregistrement
            recordBtn.textContent = recording ? 'Recording...' : 'Start Recording';
        },

        updateRecordingIndicator() {
            const indicator = document.getElementById('recordingIndicator');
            if (!indicator) return;

            indicator.className = 'status-indicator';
            if (isRecording) {
                indicator.classList.add('recording');
            } else if (currentAudio) {
                indicator.classList.add('ready');
            }
        },

        updateSentenceDisplay() {
            const sentenceDisplay = document.getElementById('sentenceDisplay');
            const currentSentenceNum = document.getElementById('currentSentenceNum');

            if (!sentenceDisplay || !currentSentenceNum) return;

            const sentences = window.appState?.getSentences() || [];
            const currentIndex = window.appState?.getCurrentSentenceIndex() || 0;

            if (sentences.length > 0 && currentIndex < sentences.length) {
                sentenceDisplay.textContent = sentences[currentIndex];
                currentSentenceNum.textContent = currentIndex + 1;
            } else {
                sentenceDisplay.textContent = 'Loading sentence...';
            }
        },

        updateProgressDisplay() {
            const progressFill = document.getElementById('progressFill');
            const totalSentences = document.getElementById('totalSentences');
            const completedCount = document.getElementById('completedCount');

            if (!progressFill || !totalSentences || !completedCount) return;

            const sentences = window.appState?.getSentences() || [];
            const completed = window.appState?.getCompletedRecordings() || 0;
            const total = sentences.length;

            totalSentences.textContent = total;
            completedCount.textContent = completed;

            const progressPercent = total > 0 ? (completed / total) * 100 : 0;
            progressFill.style.width = progressPercent + '%';
        },

        // Alias pour compatibilité
        resetRecordingInterface() {
            this.resetRecording();
        },

        // Nettoyage des ressources
        cleanup() {
            console.log('🧹 Cleaning up audio resources...');

            // Arrêter l'enregistrement si en cours
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
            }

            // Libérer le stream audio
            if (audioStream) {
                audioStream.getTracks().forEach(track => track.stop());
                audioStream = null;
            }

            // Nettoyer l'audio actuel
            if (currentAudio) {
                currentAudio.pause();
                URL.revokeObjectURL(currentAudio.src);
                currentAudio = null;
            }

            // Réinitialiser les variables
            mediaRecorder = null;
            audioChunks = [];
            isRecording = false;
            isInitialized = false;

            console.log('✅ Audio cleanup completed');
        }
    };

    // Exposer le module globalement
    window.audioModule = audioModule;

    console.log('🎵 Audio module loaded successfully');

})();