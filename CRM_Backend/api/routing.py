from django.urls import path

from . import consumers

websocket_urlpatterns = [
    path("ws/dashboard/<str:scope>/", consumers.DashboardConsumer.as_asgi()),
]
