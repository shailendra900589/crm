import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/config/app_config.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/open_url.dart';
import '../../providers/auth_provider.dart';

/// Play Store–required account / privacy controls.
class AccountScreen extends ConsumerStatefulWidget {
  const AccountScreen({super.key});

  @override
  ConsumerState<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends ConsumerState<AccountScreen> {
  bool _deleting = false;

  Future<void> _deleteAccount() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete account?', style: TextStyle(fontWeight: FontWeight.w800)),
        content: const Text(
          'This deactivates your Trackbook login. Organisation CRM records may be retained by your company Admin as described in the Privacy Policy. This cannot be undone from the app.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.coral),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;

    setState(() => _deleting = true);
    try {
      final api = ref.read(apiClientProvider);
      await api.post('/api/me/delete-account/', data: {'confirm': 'delete'});
      await ref.read(authProvider.notifier).logout();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Account deleted. You have been signed out.')),
      );
      context.go('/login');
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ref.read(apiClientProvider).errorMessage(e))),
      );
    } finally {
      if (mounted) setState(() => _deleting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Account', style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.ocean)),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          Card(
            child: ListTile(
              title: Text(user?.displayName ?? '—', style: const TextStyle(fontWeight: FontWeight.w800)),
              subtitle: Text('@${user?.username ?? ''} · ${user?.role ?? ''}'),
            ),
          ),
          const SizedBox(height: 12),
          const Text('Legal', style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.ocean)),
          const SizedBox(height: 8),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.privacy_tip_outlined, color: AppColors.ocean),
                  title: const Text('Privacy Policy'),
                  subtitle: const Text(AppConfig.privacyUrl),
                  trailing: const Icon(Icons.open_in_new_rounded, size: 18),
                  onTap: () => openExternalUrl(AppConfig.privacyUrl),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.description_outlined, color: AppColors.ocean),
                  title: const Text('Terms & Conditions'),
                  trailing: const Icon(Icons.open_in_new_rounded, size: 18),
                  onTap: () => openExternalUrl(AppConfig.termsUrl),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.info_outline_rounded, color: AppColors.ocean),
                  title: const Text('Disclaimer'),
                  trailing: const Icon(Icons.open_in_new_rounded, size: 18),
                  onTap: () => openExternalUrl(AppConfig.disclaimerUrl),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.delete_forever_outlined, color: AppColors.coral),
                  title: const Text('Account deletion info'),
                  subtitle: const Text('Web instructions'),
                  trailing: const Icon(Icons.open_in_new_rounded, size: 18),
                  onTap: () => openExternalUrl(AppConfig.accountDeletionUrl),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Operator: Newish Technology\n${AppConfig.registeredOffice}\n${AppConfig.privacyEmail}',
            style: TextStyle(fontSize: 12, color: AppColors.ink.withValues(alpha: 0.55), height: 1.4),
          ),
          const SizedBox(height: 20),
          FilledButton.tonalIcon(
            onPressed: _deleting ? null : _deleteAccount,
            icon: _deleting
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.delete_forever_rounded),
            label: Text(_deleting ? 'Deleting…' : 'Delete my account'),
            style: FilledButton.styleFrom(
              foregroundColor: AppColors.coral,
              backgroundColor: AppColors.coral.withValues(alpha: 0.12),
            ),
          ),
        ],
      ),
    );
  }
}
