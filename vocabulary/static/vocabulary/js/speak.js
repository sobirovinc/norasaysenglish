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

    speakUzbek(text) {
        if (!text || document.hidden || !('speechSynthesis' in window)) {
            return;
        }

        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(String(text));
        const voices = window.speechSynthesis.getVoices();
        const uzbekVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith('uz'));
        utterance.lang = uzbekVoice ? uzbekVoice.lang : 'uz-UZ';
        if (uzbekVoice) {
            utterance.voice = uzbekVoice;
        }
        window.speechSynthesis.speak(utterance);
    },
};

window.VocabSpeech = VocabSpeech;
