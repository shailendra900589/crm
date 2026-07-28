"""HTTP endpoints for Trackbook HRMS SSO into CRM Pro."""

from __future__ import annotations

from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from .hrms_sso import issue_crm_tokens, resolve_crm_user, validate_trackbook_sso_ticket
from .serializers import UserSerializer


class HrmsSsoThrottle(AnonRateThrottle):
    rate = "60/min"


class HrmsSsoLoginView(APIView):
    """
    Exchange a Trackbook HRMS SSO ticket for CRM JWT tokens.

    POST /api/auth/hrms-sso/
    Body: {"ticket": "..."} or {"trackbook_sso": "..."}
    """

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [HrmsSsoThrottle]

    def post(self, request):
        ticket = (
            request.data.get("ticket")
            or request.data.get("trackbook_sso")
            or request.data.get("hrms_sso_ticket")
            or request.headers.get("X-Trackbook-SSO")
            or ""
        )
        ticket = str(ticket).strip()
        if not ticket:
            return Response(
                {"detail": "ticket is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            payload = validate_trackbook_sso_ticket(ticket)
            user = resolve_crm_user(payload, auto_provision=True)
            if not user.is_active or not getattr(user, "is_active_user", True):
                return Response(
                    {"detail": "CRM account is inactive."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            tokens = issue_crm_tokens(user)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response(
                {"detail": "SSO login failed."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                **tokens,
                "user": UserSerializer(user).data,
                "login_mode": "trackbook_sso",
            },
            status=status.HTTP_200_OK,
        )
