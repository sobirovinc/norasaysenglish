# Generated for Nora says English

from django.db import migrations, models


def create_default_profile(apps, schema_editor):
    TeacherProfile = apps.get_model('vocabulary', 'TeacherProfile')
    if not TeacherProfile.objects.exists():
        TeacherProfile.objects.create(
            name='Nora',
            title='English teacher',
            headline='I help Uzbek students learn English vocabulary with confidence.',
            headline_uzbek='Oʻzbek talabalariga inglizcha soʻzlarni ishonch bilan oʻrgataman.',
            bio=(
                'Welcome to Nora says English! I am an English teacher passionate about '
                'helping Uzbek students build real vocabulary through fun, interactive practice. '
                'This game lets you match Uzbek and English words, hear correct pronunciation, '
                'and progress unit by unit at your own pace.'
            ),
            bio_uzbek=(
                'Nora says English ga xush kelibsiz! Men ingliz tili oʻqituvchisiman va '
                'talabalarga soʻz boyligini oʻyin orqali mustahkamlashga yordam beraman.'
            ),
            telegram_url='https://t.me/norasaysenglish',
            instagram_url='https://www.instagram.com/nora_says_english/',
            active=True,
        )


class Migration(migrations.Migration):

    dependencies = [
        ('vocabulary', '0003_gameeventasset'),
    ]

    operations = [
        migrations.CreateModel(
            name='TeacherProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(default='Nora', max_length=120)),
                ('title', models.CharField(default='English teacher', max_length=160)),
                ('headline', models.CharField(default='I help Uzbek students learn English vocabulary with confidence.', max_length=220)),
                ('headline_uzbek', models.CharField(blank=True, max_length=220)),
                ('bio', models.TextField(default='Welcome to Nora says English — a fun way to practice vocabulary through matching games.')),
                ('bio_uzbek', models.TextField(blank=True)),
                ('photo', models.ImageField(blank=True, upload_to='teacher/')),
                ('years_experience', models.PositiveIntegerField(blank=True, null=True)),
                ('credentials', models.TextField(blank=True, help_text='One qualification per line.')),
                ('telegram_url', models.URLField(blank=True, default='https://t.me/norasaysenglish')),
                ('instagram_url', models.URLField(blank=True, default='https://www.instagram.com/nora_says_english/')),
                ('email', models.EmailField(blank=True)),
                ('active', models.BooleanField(default=True)),
            ],
            options={
                'verbose_name': 'Teacher profile',
                'verbose_name_plural': 'Teacher profile',
            },
        ),
        migrations.RunPython(create_default_profile, migrations.RunPython.noop),
    ]
