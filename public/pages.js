// Module de gestion des pages
window.pagesModule = {
    
    // Fonctions de navigation entre pages
    showHomepage() {
        this.activatePage('homepage');
    },

    showDemographicsPage() {
        this.activatePage('demographics');
    },

    showRecordingPage() {
        this.activatePage('recording');
        this.loadSentence();
    },

    showCompletionPage() {
        this.activatePage('completion');
        this.updateCompletionStats();
    },

    showStatsPage() {
        this.activatePage('statistics');
        window.statsModule.loadStatistics();
    },

    showRecordingsPage() {
        this.activatePage('recordingsList');
        window.recordingsModule.loadRecordingsList();
    },

    activatePage(pageId) {
        document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
        document.getElementById(pageId).classList.add('active');
    },

    // Fonctions de gestion de l'enregistrement
    loadSentence() {
        const currentSentenceIndex = window.appState.getCurrentSentenceIndex();
        const sentences = window.appState.getSentences();
        
        if (currentSentenceIndex >= sentences.length) {
            this.completeSession();
            return;
        }
        
        // Afficher la phrase actuelle
        const sentenceDisplay = document.getElementById('sentenceDisplay');
        sentenceDisplay.textContent = sentences[currentSentenceIndex];
        
        // Mettre à jour les statistiques
        this.updateRecordingUI();
        
        // Réinitialiser l'interface d'enregistrement
        window.audioModule.resetRecordingInterface();
        
        console.log(`Loaded sentence ${currentSentenceIndex + 1}/${sentences.length}`);
    },

    updateRecordingUI() {
        const currentSentenceIndex = window.appState.getCurrentSentenceIndex();
        const sentences = window.appState.getSentences();
        const completedRecordings = window.appState.getCompletedRecordings();
        
        document.getElementById('currentSentenceNum').textContent = currentSentenceIndex + 1;
        document.getElementById('totalSentences').textContent = sentences.length;
        document.getElementById('completedCount').textContent = completedRecordings;
        
        // Mettre à jour la barre de progression
        const progressFill = document.getElementById('progressFill');
        const progressPercentage = ((currentSentenceIndex + 1) / sentences.length) * 100;
        progressFill.style.width = `${progressPercentage}%`;
    },

    async completeSession() {
        const sessionId = window.appState.getSessionId();
        
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
            this.showCompletionPage();
            
        } catch (error) {
            console.error('Error completing session:', error);
            window.utils.showError('recordingError', 'Failed to complete session properly, but your recordings are saved.');
            setTimeout(() => this.showCompletionPage(), 2000);
        }
    },

    updateCompletionStats() {
        const completedRecordings = window.appState.getCompletedRecordings();
        const sessionStartTime = window.appState.getSessionStartTime();
        
        document.getElementById('finalCompletedCount').textContent = completedRecordings;
        
        if (sessionStartTime) {
            const duration = Math.round((Date.now() - sessionStartTime) / 60000);
            document.getElementById('sessionDuration').textContent = duration;
        }
    },

    // Fonction pour passer à la phrase suivante
    moveToNextSentence() {
        const currentSentenceIndex = window.appState.getCurrentSentenceIndex();
        const sentences = window.appState.getSentences();
        const completedRecordings = window.appState.getCompletedRecordings();
        
        if (completedRecordings < sentences.length) {
            window.appState.setCurrentSentenceIndex(currentSentenceIndex + 1);
            this.loadSentence();
        } else {
            this.completeSession();
        }
    }
};

console.log('Pages module loaded successfully');