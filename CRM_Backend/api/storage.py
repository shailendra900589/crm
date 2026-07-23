from django.conf import settings

if getattr(settings, "USE_S3", False):
    from storages.backends.s3boto3 import S3Boto3Storage

    class MediaStorage(S3Boto3Storage):
        location = "media"
        file_overwrite = False
        default_acl = None

else:
    MediaStorage = None
