import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/lottie_box.dart';
import '../../providers/field_provider.dart';

class VisitsScreen extends ConsumerWidget {
  const VisitsScreen({super.key});

  Future<void> _complete(BuildContext context, WidgetRef ref, int id) async {
    final remarks = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Complete visit', style: TextStyle(fontWeight: FontWeight.w800)),
        content: TextField(controller: remarks, decoration: const InputDecoration(labelText: 'Remarks'), maxLines: 2),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Complete')),
        ],
      ),
    );
    final text = remarks.text.trim();
    remarks.dispose();
    if (ok != true) return;
    try {
      final api = ref.read(apiClientProvider);
      await api.patch('/api/visits/$id/complete/', data: {
        if (text.isNotEmpty) 'remarks': text,
      });
      ref.invalidate(visitsProvider);
      ref.invalidate(allVisitsProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Visit completed')));
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ref.read(apiClientProvider).errorMessage(e))),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final visits = ref.watch(allVisitsProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text('My Visits', style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.ocean)),
        actions: [
          IconButton(onPressed: () => ref.invalidate(allVisitsProvider), icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      body: visits.when(
        data: (list) {
          if (list.isEmpty) {
            return ListView(
              children: const [
                SizedBox(height: 40),
                LottieBox(url: LottieBox.empty, height: 150),
                Center(child: Text('No visits assigned')),
              ],
            );
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(allVisitsProvider),
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
              itemCount: list.length,
              separatorBuilder: (context, index) => const SizedBox(height: 10),
              itemBuilder: (context, i) {
                final v = list[i];
                return Card(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(v.leadName, style: const TextStyle(fontWeight: FontWeight.w700)),
                          subtitle: Text([
                            if (v.scheduledDate.isNotEmpty) v.scheduledDate,
                            v.status,
                            if (v.visitType.isNotEmpty) v.visitType,
                            if (v.merchantCity.isNotEmpty) v.merchantCity,
                          ].join(' · ')),
                          trailing: const Icon(Icons.chevron_right_rounded),
                          onTap: v.lead > 0 ? () => context.push('/leads/${v.lead}') : null,
                        ),
                        if (v.isScheduled)
                          Align(
                            alignment: Alignment.centerRight,
                            child: FilledButton.tonal(
                              onPressed: () => _complete(context, ref, v.id),
                              child: const Text('Mark complete'),
                            ),
                          ),
                      ],
                    ),
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
