"""Allow CRM Pro UI to be embedded inside Trackbook HRMS dashboard / mobile WebView."""


class AllowTrackbookEmbedMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        # Replace DENY so HRMS iframe / Flutter WebView can host CRM Pro.
        if "X-Frame-Options" in response:
            del response["X-Frame-Options"]
        response["Content-Security-Policy"] = (
            "frame-ancestors 'self' https://hrms.trackbook.co https://*.trackbook.co "
            "http://localhost:* http://127.0.0.1:*"
        )
        return response
