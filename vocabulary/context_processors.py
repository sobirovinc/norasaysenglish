from .models import TeacherProfile


def site_profile(request):
    return {'teacher': TeacherProfile.get_profile()}
