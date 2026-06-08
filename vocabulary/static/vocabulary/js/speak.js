/**
 * Browser speech synthesis for English vocabulary.
 */
const VocabSpeech = {
    speakEnglish(word) {
        if (!word || document.hidden || !('speechSynthesis' in window)) {
            return;
        }

        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(String(word));
        utterance.lang = 'en-US';
        window.speechSynthesis.speak(utterance);
    },
};

window.VocabSpeech = VocabSpeech;
