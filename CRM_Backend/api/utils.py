"""Shared helpers."""


def normalize_mobile(mobile: str) -> str:
    digits = "".join(c for c in (mobile or "") if c.isdigit())
    if len(digits) >= 10:
        return digits[-10:]
    return digits
