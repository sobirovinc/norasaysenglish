from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('vocabulary', '0004_teacherprofile'),
    ]

    operations = [
        migrations.CreateModel(
            name='UnitSentence',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('english_sentence', models.TextField()),
                ('uzbek_translation', models.TextField()),
                ('order', models.PositiveIntegerField(default=1)),
                ('unit', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='sentences', to='vocabulary.unit')),
            ],
            options={
                'verbose_name': 'Sentence',
                'verbose_name_plural': 'Sentences',
                'ordering': ['order', 'id'],
            },
        ),
    ]
