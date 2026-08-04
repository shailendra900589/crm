import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/config/app_config.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/lottie_box.dart';
import '../../providers/auth_provider.dart';
import '../../providers/form_provider.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    final form = ref.watch(formSyncProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile', style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.ocean)),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          const LottieBox(url: LottieBox.secure, height: 120),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    user?.displayName ?? '—',
                    style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.ocean),
                  ),
                  const SizedBox(height: 4),
                  Text('@${user?.username ?? ''} · ${user?.role ?? ''}'),
                  if (user?.organizationName != null) ...[
                    const SizedBox(height: 6),
                    Text(user!.organizationName!, style: TextStyle(color: AppColors.ink.withValues(alpha: 0.55))),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.cloud_outlined, color: AppColors.ocean),
                  title: const Text('API'),
                  subtitle: Text(AppConfig.apiBase, style: const TextStyle(fontSize: 12)),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.sync_rounded, color: AppColors.ocean),
                  title: const Text('Form Builder sync'),
                  subtitle: Text(
                    form.when(
                      data: (f) => f == null
                          ? 'No form for project'
                          : 'Live · polls every ${AppConfig.formPollSeconds}s',
                      loading: () => 'Loading…',
                      error: (e, st) => 'Offline / error',
                    ),
                  ),
                  trailing: IconButton(
                    onPressed: () => ref.read(formSyncProvider.notifier).refresh(force: true),
                    icon: const Icon(Icons.refresh_rounded),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
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
}
