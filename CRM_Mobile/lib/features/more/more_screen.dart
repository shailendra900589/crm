import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/config/app_config.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/open_url.dart';
import '../../core/widgets/brand_logo.dart';
import '../../providers/auth_provider.dart';
import '../../providers/field_provider.dart';
import '../../providers/form_provider.dart';

class MoreScreen extends ConsumerWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    final unread = ref.watch(notificationsProvider).maybeWhen(
          data: (list) => list.where((n) => !n.isRead).length,
          orElse: () => 0,
        );
    final fu = ref.watch(followUpsProvider).maybeWhen(
          data: (h) => (h.counts['overdue'] ?? 0) + (h.counts['due_today'] ?? 0),
          orElse: () => 0,
        );

    return Scaffold(
      appBar: AppBar(
        title: const Text('More', style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.ocean)),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          const Center(child: BrandLogo(size: 72, radius: 18)),
          const SizedBox(height: 12),
          Card(
            child: ListTile(
              title: Text(user?.displayName ?? '—', style: const TextStyle(fontWeight: FontWeight.w800)),
              subtitle: Text('${user?.role ?? ''} · ${user?.organizationName ?? AppConfig.appName}'),
            ),
          ),
          const SizedBox(height: 12),
          if (user?.canPage('follow-ups') != false)
            _tile(
              icon: Icons.event_available_rounded,
              title: 'Follow-ups',
              subtitle: fu > 0 ? '$fu need attention' : 'Overdue & due today',
              badge: fu,
              onTap: () => context.push('/follow-ups'),
            ),
          if (user?.canPage('alerts') != false)
            _tile(
              icon: Icons.notifications_active_outlined,
              title: 'Alerts',
              subtitle: 'Notifications from CRM',
              badge: unread,
              onTap: () => context.push('/notifications'),
            ),
          _tile(
            icon: Icons.manage_accounts_outlined,
            title: 'Account & Privacy',
            subtitle: 'Privacy Policy, Terms, delete account',
            onTap: () => context.push('/account'),
          ),
          _tile(
            icon: Icons.privacy_tip_outlined,
            title: 'Privacy Policy',
            subtitle: 'Open on website',
            onTap: () => openExternalUrl(AppConfig.privacyUrl),
          ),
          _tile(
            icon: Icons.sync_rounded,
            title: 'Refresh form schema',
            subtitle: 'Pull latest Form Builder fields',
            onTap: () async {
              await ref.read(formSyncProvider.notifier).refresh(force: true);
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Form schema refreshed')),
                );
              }
            },
          ),
          const SizedBox(height: 16),
          FilledButton.tonalIcon(
            onPressed: () async {
              await ref.read(authProvider.notifier).logout();
              if (context.mounted) context.go('/login');
            },
            icon: const Icon(Icons.logout_rounded),
            label: const Text('Sign out'),
            style: FilledButton.styleFrom(
              foregroundColor: AppColors.coral,
              backgroundColor: AppColors.coral.withValues(alpha: 0.12),
            ),
          ),
        ],
      ),
    );
  }

  Widget _tile({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
    int badge = 0,
  }) {
    return Card(
      child: ListTile(
        leading: Icon(icon, color: AppColors.ocean),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Text(subtitle),
        trailing: badge > 0
            ? CircleAvatar(
                radius: 12,
                backgroundColor: AppColors.coral,
                child: Text('$badge', style: const TextStyle(color: Colors.white, fontSize: 11)),
              )
            : const Icon(Icons.chevron_right_rounded),
        onTap: onTap,
      ),
    );
  }
}
