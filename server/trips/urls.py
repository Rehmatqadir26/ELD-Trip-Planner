from django.urls import path
from . import views

urlpatterns = [
    path('trip/plan/', views.plan_trip, name='plan_trip'),
]
