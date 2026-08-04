import 'package:flutter/material.dart';

class BrandLogo extends StatelessWidget {
  const BrandLogo({
    super.key,
    this.size = 72,
    this.radius = 16,
  });

  final double size;
  final double radius;

  static const asset = 'assets/brand/trackbook_crm.png';

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: Image.asset(
        asset,
        width: size,
        height: size,
        fit: BoxFit.cover,
        errorBuilder: (context, error, stackTrace) => Icon(
          Icons.auto_awesome_rounded,
          size: size * 0.55,
          color: Colors.white70,
        ),
      ),
    );
  }
}
