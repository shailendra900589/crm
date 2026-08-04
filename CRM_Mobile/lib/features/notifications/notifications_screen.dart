import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/lottie_box.dart';
import '../../providers/field_provider.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notes = ref.watch(notificationsProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text('Alerts', style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.ocean)),
        actions: [
          TextButton(
            onPressed: () async {
              try {
                await ref.read(apiClientProvider).post('/api/notifications/read_all/');
                ref.invalidate(notificationsProvider);
              } catch (_) {}
            },
            child: const Text('Mark all read'),
          ),
        ],
      ),
      body: notes.when(
        data: (list) {
          if (list.isEmpty) {
            return ListView(
              children: const [
                SizedBox(height: 40),
                LottieBox(url: LottieBox.secure, height: 140),
                Center(child: Text('No notifications')),
              ],
            );
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(notificationsProvider),
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
              itemCount: list.length,
              separatorBuilder: (context, index) => const SizedBox(height: 8),
              itemBuilder: (context, i) {
                final n = list[i];
                return Card(
                  color: n.isRead ? Colors.white : AppColors.mist,
                  child: ListTile(
                    leading: Icon(
                      n.isRead ? Icons.notifications_none_rounded : Icons.notifications_active_rounded,
                      color: n.isRead ? AppColors.ink.withValues(alpha: 0.4) : AppColors.coral,
                    ),
                    title: Text(n.message, style: TextStyle(fontWeight: n.isRead ? FontWeight.w500 : FontWeight.w700)),
                    subtitle: n.createdAt.isNotEmpty
                        ? Text(n.createdAt.length > 16 ? n.createdAt.substring(0, 16) : n.createdAt)
                        : null,
                    onTap: () async {
                      if (!n.isRead) {
                        try {
                          await ref.read(apiClientProvider).patch('/api/notifications/${n.id}/read/');
                          ref.invalidate(notificationsProvider);
                        } catch (_) {}
                      }
                    },
                  ),
                );
              },
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('$e')),
      ),
    );
  }
}
