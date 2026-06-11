from django.contrib import admin, messages
from django.db import transaction
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import path, reverse
from django.utils.html import format_html

from .forms import SentenceImportForm, VocabularyImportForm
from .models import GameEventAsset, Level, TeacherProfile, Unit, UnitSentence, VocabularyWord


class UnitInline(admin.TabularInline):
    model = Unit
    extra = 1


class VocabularyWordInline(admin.TabularInline):
    model = VocabularyWord
    extra = 3


class UnitSentenceInline(admin.TabularInline):
    model = UnitSentence
    extra = 2
    fields = ('order', 'english_sentence', 'uzbek_translation')


@admin.register(Level)
class LevelAdmin(admin.ModelAdmin):
    list_display = ('name',)
    search_fields = ('name',)
    inlines = (UnitInline,)


@admin.register(Unit)
class UnitAdmin(admin.ModelAdmin):
    list_display = ('title', 'level', 'order', 'import_words_link', 'import_sentences_link')
    list_filter = ('level',)
    search_fields = ('title', 'level__name')
    ordering = ('level__name', 'order')
    inlines = (VocabularyWordInline, UnitSentenceInline)

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                '<int:unit_id>/import-words/',
                self.admin_site.admin_view(self.import_words),
                name='vocabulary_unit_import_words',
            ),
            path(
                '<int:unit_id>/import-sentences/',
                self.admin_site.admin_view(self.import_sentences),
                name='vocabulary_unit_import_sentences',
            ),
        ]
        return custom_urls + urls

    def import_words_link(self, unit):
        url = reverse('admin:vocabulary_unit_import_words', args=[unit.id])
        return format_html('<a href="{}">Import words</a>', url)

    import_words_link.short_description = 'Words'

    def import_sentences_link(self, unit):
        url = reverse('admin:vocabulary_unit_import_sentences', args=[unit.id])
        return format_html('<a href="{}">Import sentences</a>', url)

    import_sentences_link.short_description = 'Sentences'

    def import_words(self, request, unit_id):
        unit = get_object_or_404(Unit.objects.select_related('level'), pk=unit_id)

        if request.method == 'POST':
            form = VocabularyImportForm(request.POST, request.FILES)
            if form.is_valid():
                created_count, updated_count = self.save_imported_words(unit, form.cleaned_data)
                messages.success(
                    request,
                    f'Imported {created_count} new words and updated {updated_count} words for {unit}.',
                )
                return redirect('admin:vocabulary_unit_change', unit.id)
        else:
            form = VocabularyImportForm()

        context = {
            **self.admin_site.each_context(request),
            'opts': self.model._meta,
            'title': f'Import vocabulary for {unit}',
            'unit': unit,
            'form': form,
        }
        return render(request, 'admin/vocabulary/unit/import_words.html', context)

    # Keep imported words as normal VocabularyWord rows so every game mode can reuse them.
    def save_imported_words(self, unit, cleaned_data):
        words = cleaned_data['words']
        replace_existing = cleaned_data['replace_existing']
        created_count = 0
        updated_count = 0

        with transaction.atomic():
            if replace_existing:
                unit.words.all().delete()

            for word in words:
                vocabulary_word, created = VocabularyWord.objects.update_or_create(
                    unit=unit,
                    uzbek_word=word['uzbek_word'],
                    defaults={'english_word': word['english_word']},
                )
                if created:
                    created_count += 1
                else:
                    updated_count += 1

        return created_count, updated_count

    def import_sentences(self, request, unit_id):
        unit = get_object_or_404(Unit.objects.select_related('level'), pk=unit_id)

        if request.method == 'POST':
            form = SentenceImportForm(request.POST, request.FILES)
            if form.is_valid():
                created_count = self.save_imported_sentences(unit, form.cleaned_data)
                messages.success(
                    request,
                    f'Imported {created_count} sentences for {unit}.',
                )
                return redirect('admin:vocabulary_unit_change', unit.id)
        else:
            form = SentenceImportForm()

        context = {
            **self.admin_site.each_context(request),
            'opts': self.model._meta,
            'title': f'Import sentences for {unit}',
            'unit': unit,
            'form': form,
        }
        return render(request, 'admin/vocabulary/unit/import_sentences.html', context)

    def save_imported_sentences(self, unit, cleaned_data):
        sentences = cleaned_data['sentences']
        replace_existing = cleaned_data['replace_existing']

        with transaction.atomic():
            if replace_existing:
                unit.sentences.all().delete()

            start_order = unit.sentences.count() + 1
            created = []
            for offset, sentence in enumerate(sentences):
                created.append(UnitSentence.objects.create(
                    unit=unit,
                    english_sentence=sentence['english_sentence'],
                    uzbek_translation=sentence['uzbek_translation'],
                    order=start_order + offset,
                ))

        return len(created)


@admin.register(VocabularyWord)
class VocabularyWordAdmin(admin.ModelAdmin):
    list_display = ('uzbek_word', 'english_word', 'unit')
    list_filter = ('unit__level', 'unit')
    search_fields = ('uzbek_word', 'english_word', 'unit__title')


@admin.register(UnitSentence)
class UnitSentenceAdmin(admin.ModelAdmin):
    list_display = ('english_preview', 'uzbek_preview', 'unit', 'order')
    list_filter = ('unit__level', 'unit')
    search_fields = ('english_sentence', 'uzbek_translation', 'unit__title')
    ordering = ('unit__level__name', 'unit__order', 'order', 'id')

    def english_preview(self, sentence):
        text = sentence.english_sentence
        return text[:70] + ('…' if len(text) > 70 else '')

    english_preview.short_description = 'English'

    def uzbek_preview(self, sentence):
        text = sentence.uzbek_translation
        return text[:70] + ('…' if len(text) > 70 else '')

    uzbek_preview.short_description = 'Uzbek'


@admin.register(TeacherProfile)
class TeacherProfileAdmin(admin.ModelAdmin):
    list_display = ('name', 'title', 'active')
    readonly_fields = ('photo_preview',)

    fieldsets = (
        ('Profile', {'fields': ('name', 'title', 'headline', 'headline_uzbek', 'active')}),
        ('About', {'fields': ('bio', 'bio_uzbek', 'years_experience', 'credentials')}),
        ('Photo', {'fields': ('photo', 'photo_preview')}),
        ('Contact & social', {'fields': ('telegram_url', 'instagram_url', 'email')}),
    )

    def has_add_permission(self, request):
        if TeacherProfile.objects.exists():
            return False
        return super().has_add_permission(request)

    def photo_preview(self, profile):
        if profile.photo:
            return format_html('<img src="{}" style="max-width:220px;border-radius:12px;" alt="">', profile.photo.url)
        return 'No photo uploaded. The site logo is used as fallback.'

    photo_preview.short_description = 'Photo preview'


@admin.register(GameEventAsset)
class GameEventAssetAdmin(admin.ModelAdmin):
    list_display = ('event_type', 'title', 'active', 'has_sound', 'has_gif')
    list_filter = ('active', 'event_type')
    search_fields = ('event_type', 'title', 'message')
    readonly_fields = ('sound_preview', 'gif_preview')
    fieldsets = (
        (None, {'fields': ('event_type', 'title', 'message', 'active')}),
        ('Media', {'fields': ('sound_file', 'sound_preview', 'gif_file', 'gif_preview')}),
    )

    def has_sound(self, asset):
        return bool(asset.sound_file)

    has_sound.boolean = True
    has_sound.short_description = 'Sound'

    def has_gif(self, asset):
        return bool(asset.gif_file)

    has_gif.boolean = True
    has_gif.short_description = 'GIF'

    def sound_preview(self, asset):
        if not asset.sound_file:
            return 'No sound uploaded.'
        return format_html('<audio controls src="{}"></audio>', asset.sound_file.url)

    sound_preview.short_description = 'Sound preview'

    def gif_preview(self, asset):
        if not asset.gif_file:
            return 'No image uploaded.'
        return format_html('<img src="{}" style="max-width:220px;max-height:180px;" alt="">', asset.gif_file.url)

    gif_preview.short_description = 'GIF preview'
