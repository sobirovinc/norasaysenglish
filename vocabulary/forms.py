import json

from django import forms


class VocabularyImportForm(forms.Form):
    json_file = forms.FileField(
        required=False,
        label='JSON file',
        help_text='Upload a .json file with vocabulary pairs.',
    )
    json_text = forms.CharField(
        required=False,
        label='Or paste JSON',
        widget=forms.Textarea(attrs={'rows': 12}),
        help_text='Use either [{"uzbek": "olma", "english": "apple"}] or {"olma": "apple"}.',
    )
    replace_existing = forms.BooleanField(
        required=False,
        label='Delete current words in this unit before importing',
    )

    def clean(self):
        cleaned_data = super().clean()
        json_file = cleaned_data.get('json_file')
        json_text = cleaned_data.get('json_text', '').strip()

        if not json_file and not json_text:
            raise forms.ValidationError('Upload a JSON file or paste JSON text.')

        if json_file and json_text:
            raise forms.ValidationError('Use either a JSON file or pasted JSON text, not both.')

        raw_json = self._read_file(json_file) if json_file else json_text

        try:
            parsed = json.loads(raw_json)
        except json.JSONDecodeError as error:
            raise forms.ValidationError(f'Invalid JSON: {error.msg}.') from error

        cleaned_data['words'] = self._normalize_words(parsed)
        return cleaned_data

    def _read_file(self, uploaded_file):
        try:
            return uploaded_file.read().decode('utf-8')
        except UnicodeDecodeError as error:
            raise forms.ValidationError('JSON file must be UTF-8 encoded.') from error

    def _normalize_words(self, parsed_json):
        if isinstance(parsed_json, dict):
            words = [
                {'uzbek_word': uzbek, 'english_word': english}
                for uzbek, english in parsed_json.items()
            ]
        elif isinstance(parsed_json, list):
            words = [self._normalize_list_item(item, index) for index, item in enumerate(parsed_json, start=1)]
        else:
            raise forms.ValidationError('JSON must be a list of word objects or a key/value object.')

        normalized_words = []
        seen_uzbek_words = set()

        for index, word in enumerate(words, start=1):
            uzbek_word = str(word['uzbek_word']).strip()
            english_word = str(word['english_word']).strip()

            if not uzbek_word or not english_word:
                raise forms.ValidationError(f'Word #{index} must have both Uzbek and English text.')

            normalized_key = uzbek_word.casefold()
            if normalized_key in seen_uzbek_words:
                raise forms.ValidationError(f'Duplicate Uzbek word in import: {uzbek_word}.')

            seen_uzbek_words.add(normalized_key)
            normalized_words.append({
                'uzbek_word': uzbek_word,
                'english_word': english_word,
            })

        return normalized_words

    def _normalize_list_item(self, item, index):
        if not isinstance(item, dict):
            raise forms.ValidationError(f'Word #{index} must be an object.')

        uzbek_word = item.get('uzbek') or item.get('uzbek_word')
        english_word = item.get('english') or item.get('english_word')

        if uzbek_word is None or english_word is None:
            raise forms.ValidationError(
                f'Word #{index} must include uzbek/english keys.'
            )

        return {
            'uzbek_word': uzbek_word,
            'english_word': english_word,
        }
