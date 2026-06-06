import math

from django.db.models import Count
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, render

from .models import GameEventAsset, Level, TeacherProfile, Unit


def home(request):
    levels = Level.objects.prefetch_related('units').annotate(unit_count=Count('units'))
    teacher = TeacherProfile.get_profile()
    return render(request, 'vocabulary/home.html', {
        'levels': levels,
        'teacher': teacher,
    })


def about(request):
    teacher = TeacherProfile.get_profile()
    credentials = [line.strip() for line in teacher.credentials.splitlines() if line.strip()]
    return render(request, 'vocabulary/about.html', {
        'teacher': teacher,
        'credentials': credentials,
    })


def unit_list(request, level_id):
    level = get_object_or_404(
        Level.objects.prefetch_related('units'),
        pk=level_id,
    )
    return render(request, 'vocabulary/unit_list.html', {'level': level})


def unit_intro(request, unit_id):
    unit = get_object_or_404(Unit.objects.select_related('level'), pk=unit_id)
    word_count = unit.words.count()
    round_size = 7
    round_count = max(1, math.ceil(word_count / round_size)) if word_count else 0
    estimated_minutes = max(1, round_count * 2)

    return render(request, 'vocabulary/unit_intro.html', {
        'unit': unit,
        'word_count': word_count,
        'round_count': round_count,
        'estimated_minutes': estimated_minutes,
    })


def game(request, unit_id):
    unit = get_object_or_404(Unit.objects.select_related('level'), pk=unit_id)
    next_unit = (
        Unit.objects.filter(level=unit.level, order__gt=unit.order)
        .order_by('order')
        .first()
    )
    return render(request, 'vocabulary/game.html', {
        'unit': unit,
        'next_unit': next_unit,
    })


def unit_words_api(request, unit_id):
    unit = get_object_or_404(Unit.objects.prefetch_related('words'), pk=unit_id)
    words = [
        {
            'uzbek': word.uzbek_word,
            'english': word.english_word,
        }
        for word in unit.words.all()
    ]
    return JsonResponse(words, safe=False)


def game_events_api(request):
    assets = GameEventAsset.objects.filter(active=True)
    events = {
        asset.event_type: {
            'title': asset.title,
            'message': asset.message,
            'sound_url': file_url(asset.sound_file),
            'gif_url': file_url(asset.gif_file),
        }
        for asset in assets
    }
    return JsonResponse({
        'events': events,
        'config': {
            'life_cost': 50,
            'correct_score': 10,
            'round_pause_ms': 2200,
        },
    })


def file_url(uploaded_file):
    if not uploaded_file:
        return None

    try:
        if not uploaded_file.storage.exists(uploaded_file.name):
            return None
        return uploaded_file.url
    except (OSError, ValueError):
        return None
