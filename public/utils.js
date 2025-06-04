function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        errorElement.style.color = '#e53e3e';
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

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function formatDuration(minutes) {
    if (minutes < 60) {
        return `${minutes} minutes`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    return `${hours}h ${remainingMinutes}m`;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    return input.replace(/[<>]/g, '');
}

function validateAge(age) {
    const numAge = parseInt(age);
    return !isNaN(numAge) && numAge >= 1 && numAge <= 120;
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function isValidAudioFile(file) {
    const validTypes = ['audio/wav', 'audio/webm', 'audio/mp3', 'audio/ogg'];
    return validTypes.includes(file.type);
}

function getFileExtension(filename) {
    return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength) + '...';
}

// Créer un objet global pour les utilitaires
window.utils = {
    showError,
    hideError,
    showSuccess,
    hideSuccess,
    formatBytes,
    capitalizeFirst,
    formatDuration,
    debounce,
    validateEmail,
    generateId,
    sanitizeInput,
    validateAge,
    formatTime,
    isValidAudioFile,
    getFileExtension,
    truncateText
};

// Export pour utilisation avec les modules ES6
export { 
    showError, 
    hideError, 
    showSuccess, 
    hideSuccess, 
    formatBytes, 
    capitalizeFirst, 
    formatDuration, 
    debounce, 
    validateEmail, 
    generateId, 
    sanitizeInput, 
    validateAge, 
    formatTime, 
    isValidAudioFile, 
    getFileExtension, 
    truncateText 
};

console.log('Utils module loaded successfully');