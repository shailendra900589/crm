import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Lightweight empty/success placeholder (no Lottie package — keeps APK small).
class LottieBox extends StatelessWidget {
  const LottieBox({
    super.key,
    required this.url,
    this.height = 140,
    this.repeat = true,
  });

  /// Kept for call-site compatibility; ignored (icons only).
  final String url;
  final double height;
  final bool repeat;

  static const team = 'team';
  static const empty = 'empty';
  static const success = 'success';
  static const rocket = 'rocket';
  static const secure = 'secure';

  IconData get _icon {
    switch (url) {
      case success:
        return Icons.check_circle_rounded;
      case rocket:
        return Icons.rocket_launch_rounded;
      case secure:
        return Icons.verified_user_rounded;
      case team:
        return Icons.groups_rounded;
      default:
        return Icons.inbox_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      child: Center(
        child: Icon(
          _icon,
          size: height * 0.45,
          color: AppColors.ocean.withValues(alpha: 0.35),
        ),
      ),
    );
  }
}
