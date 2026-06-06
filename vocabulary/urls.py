from django.urls import path

from . import views


app_name = 'vocabulary'

urlpatterns = [
    path('', views.home, name='home'),
    path('about/', views.about, name='about'),
    path('levels/<int:level_id>/', views.unit_list, name='unit_list'),
    path('units/<int:unit_id>/', views.unit_intro, name='unit_intro'),
    path('units/<int:unit_id>/play/', views.game, name='game'),
    path('api/unit/<int:unit_id>/words/', views.unit_words_api, name='unit_words_api'),
    path('api/game-events/', views.game_events_api, name='game_events_api'),
]
