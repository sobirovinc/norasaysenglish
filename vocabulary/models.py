from django.db import models


class GameEventAsset(models.Model):
    CORRECT_MATCH = 'correct_match'
    INCORRECT_MATCH = 'incorrect_match'
    LIFE_LOST = 'life_lost'
    NO_LIVES_REMAINING = 'no_lives_remaining'
    ROUND_COMPLETED = 'round_completed'
    ROUND_FAILED = 'round_failed'
    TIMER_EXPIRED = 'timer_expired'
    UNIT_COMPLETED = 'unit_completed'
    CONTINUE_GAME = 'continue_game'

    EVENT_TYPE_CHOICES = [
        (CORRECT_MATCH, 'Correct match'),
        (INCORRECT_MATCH, 'Incorrect match'),
        (LIFE_LOST, 'Life lost'),
        (NO_LIVES_REMAINING, 'No lives remaining'),
        (ROUND_COMPLETED, 'Round completed'),
        (ROUND_FAILED, 'Round failed'),
        (TIMER_EXPIRED, 'Timer expired'),
        (UNIT_COMPLETED, 'Unit completed'),
        (CONTINUE_GAME, 'Continue game'),
    ]

    event_type = models.CharField(max_length=40, choices=EVENT_TYPE_CHOICES, unique=True)
    title = models.CharField(max_length=160)
    message = models.TextField(blank=True)
    sound_file = models.FileField(upload_to='game_events/sounds/', blank=True)
    gif_file = models.FileField(upload_to='game_events/gifs/', blank=True)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ['event_type']

    def __str__(self):
        return self.get_event_type_display()


class Level(models.Model):
    name = models.CharField(max_length=80, unique=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Unit(models.Model):
    level = models.ForeignKey(Level, on_delete=models.CASCADE, related_name='units')
    title = models.CharField(max_length=120)
    order = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ['level__name', 'order', 'title']
        unique_together = ('level', 'order')

    def __str__(self):
        return f'{self.level.name} - {self.title}'


class TeacherProfile(models.Model):
    name = models.CharField(max_length=120, default='Nora')
    title = models.CharField(max_length=160, default='English teacher')
    headline = models.CharField(
        max_length=220,
        default='I help Uzbek students learn English vocabulary with confidence.',
    )
    headline_uzbek = models.CharField(max_length=220, blank=True)
    bio = models.TextField(
        default='Welcome to Nora says English — a fun way to practice vocabulary through matching games.',
    )
    bio_uzbek = models.TextField(blank=True)
    photo = models.ImageField(upload_to='teacher/', blank=True)
    years_experience = models.PositiveIntegerField(null=True, blank=True)
    credentials = models.TextField(
        blank=True,
        help_text='One qualification per line.',
    )
    telegram_url = models.URLField(blank=True, default='https://t.me/norasaysenglish')
    instagram_url = models.URLField(blank=True, default='https://www.instagram.com/nora_says_english/')
    email = models.EmailField(blank=True)
    active = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Teacher profile'
        verbose_name_plural = 'Teacher profile'

    def __str__(self):
        return self.name

    @classmethod
    def get_profile(cls):
        profile = cls.objects.filter(active=True).first()
        if profile:
            return profile
        return cls(
            name='Nora',
            title='English teacher',
            headline='I help Uzbek students learn English vocabulary with confidence.',
            bio='Welcome to Nora says English.',
            telegram_url='https://t.me/norasaysenglish',
            instagram_url='https://www.instagram.com/nora_says_english/',
        )


class VocabularyWord(models.Model):
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE, related_name='words')
    uzbek_word = models.CharField(max_length=120)
    english_word = models.CharField(max_length=120)

    class Meta:
        ordering = ['uzbek_word']
        unique_together = ('unit', 'uzbek_word')

    def __str__(self):
        return f'{self.uzbek_word} - {self.english_word}'
