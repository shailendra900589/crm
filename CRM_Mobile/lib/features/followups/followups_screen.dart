import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_theme.dart';
import '../../core/widgets/lottie_box.dart';
import '../../models/models.dart';
import '../../providers/field_provider.dart';

class FollowUpsScreen extends ConsumerWidget {
  const FollowUpsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final hub = ref.watch(followUpsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Follow-ups', style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.ocean)),
        actions: [
          IconButton(onPressed: () => ref.invalidate(followUpsProvider), icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      body: hub.when(
        data: (data) {
          final sections = <(String, Color, List<LeadItem>)>[
            ('Overdue (${data.counts['overdue'] ?? 0})', AppColors.coral, data.overdue),
            ('Due today (${data.counts['due_today'] ?? 0})', AppColors.warning, data.dueToday),
            ('Upcoming (${data.counts['upcoming'] ?? 0})', AppColors.ocean, data.upcoming),
          ];
          final empty = data.overdue.isEmpty && data.dueToday.isEmpty && data.upcoming.isEmpty;
          if (empty) {
            return ListView(
              children: const [
                SizedBox(height: 40),
                LottieBox(url: LottieBox.team, height: 140),
                Center(child: Text('All clear — no follow-ups queued')),
              ],
            );
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(followUpsProvider),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
              children: [
                for (final section in sections) ...[
                  if (section.$3.isNotEmpty) ...[
                    Padding(
                      padding: const EdgeInsets.only(top: 8, bottom: 8),
                      child: Text(
                        section.$1,
                        style: TextStyle(fontWeight: FontWeight.w800, color: section.$2, fontSize: 16),
                      ),
                    ),
                    ...section.$3.map(
                      (l) => Card(
                        child: ListTile(
                          title: Text(l.merchantName, style: const TextStyle(fontWeight: FontWeight.w700)),
                          subtitle: Text([
                            if (l.followUpDate != null)
                              'FU ${l.followUpDate!.length >= 10 ? l.followUpDate!.substring(0, 10) : l.followUpDate}',
                            l.statusDisplay,
                            if (l.bdmName != null && l.bdmName!.isNotEmpty) l.bdmName!,
                            if (l.merchantCity.isNotEmpty) l.merchantCity,
                          ].join(' · ')),
                          trailing: const Icon(Icons.chevron_right_rounded),
                          onTap: () => context.push('/leads/${l.id}'),
                        ),
                      ),
                    ),
                  ],
                ],
              ],
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('$e')),
      ),
    );
  }
}
