import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from rest_framework_simplejwt.tokens import AccessToken


class DashboardConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.scope_name = self.scope["url_route"]["kwargs"].get("scope", "admin")
        token = self.scope["query_string"].decode().split("token=")[-1] if "token=" in self.scope["query_string"].decode() else ""
        if token:
            try:
                AccessToken(token)
            except Exception:
                await self.close()
                return
        self.group = f"dashboard_{self.scope_name}"
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        await self.channel_layer.group_discard(self.group, self.channel_name)

    async def dashboard_update(self, event):
        await self.send(text_data=json.dumps(event))
