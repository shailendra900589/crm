import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_theme.dart';
import '../../core/widgets/kpi_card.dart';
import '../../core/widgets/lottie_box.dart';
import '../../providers/auth_provider.dart';
import '../../providers/form_provider.dart';
import '../../providers/project_provider.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    final projects = ref.watch(projectsProvider);
    final activeId = ref.watch(activeProjectProvider);
    final dash = ref.watch(dashboardProvider);
    final form = ref.watch(formSyncProvider);
    final workdesk = user?.isLeader == true ? 'Team Workdesk' : 'My Workdesk';

    ref.listen(projectsProvider, (_, next) {
      next.whenData((list) => ref.read(activeProjectProvider.notifier).ensureDefault(list));
    });

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Hi, ${user?.displayName ?? 'there'}',
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: AppColors.ocean),
            ),
            Text(
              '${user?.role ?? ''} · ${user?.organizationName ?? workdesk}',
              style: TextStyle(fontSize: 12, color: AppColors.ink.withValues(alpha: 0.5)),
            ),
          ],
        ),
        actions: [
          IconButton(
            onPressed: () => ref.invalidate(dashboardProvider),
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: AppColors.ocean,
        onRefresh: () async {
          ref.invalidate(dashboardProvider);
          await ref.read(formSyncProvider.notifier).refresh(force: true);
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            Text(workdesk, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: AppColors.ocean)),
            const SizedBox(height: 10),
            projects.when(
              data: (list) {
                if (list.isEmpty) return const Text('No projects assigned');
                final selected =
                    activeId != null && list.any((p) => p.id == activeId) ? activeId : list.first.id;
                return DropdownButtonFormField<int>(
                  key: ValueKey('project-$selected'),
                  initialValue: selected,
                  decoration: const InputDecoration(
                    labelText: 'Active project',
                    prefixIcon: Icon(Icons.folder_outlined),
                  ),
                  items: list.map((p) => DropdownMenuItem(value: p.id, child: Text(p.name))).toList(),
                  onChanged: (v) {
                    if (v != null) ref.read(activeProjectProvider.notifier).setProject(v);
                  },
                );
              },
              loading: () => const LinearProgressIndicator(),
              error: (e, _) => Text('$e'),
            ),
            const SizedBox(height: 14),
            form.when(
              data: (f) => f == null
                  ? const SizedBox.shrink()
                  : Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.mist,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.sync_rounded, color: AppColors.ocean, size: 18),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Form live · ${f.title}${f.updatedAt.isNotEmpty ? ' · v ${f.updatedAt.substring(0, 16)}' : ''}',
                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                            ),
                          ),
                        ],
                      ),
                    ),
              loading: () => const SizedBox.shrink(),
              error: (e, st) => const SizedBox.shrink(),
            ),
            const SizedBox(height: 14),
            dash.when(
              data: (d) {
                return Column(
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: KpiCard(
                            label: user?.isLeader == true ? 'Team leads' : 'Leads',
                            value: '${d.totalLeads}',
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: KpiCard(
                            label: 'Confirmed',
                            value: '${d.ordersConfirmed}',
                            accent: AppColors.success,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: KpiCard(
                            label: 'Follow-ups',
                            value: '${d.followUpsDueToday}',
                            accent: AppColors.warning,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: KpiCard(
                            label: 'Conversion',
                            value: '${d.conversionRate.toStringAsFixed(0)}%',
                            accent: AppColors.coral,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Today snapshot', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                            const SizedBox(height: 12),
                            _Bar(label: 'Confirmed', value: d.ordersConfirmed, color: AppColors.success, max: d.totalLeads),
                            const SizedBox(height: 8),
                            _Bar(label: 'Follow-ups', value: d.followUpsDueToday, color: AppColors.warning, max: d.totalLeads),
                            const SizedBox(height: 8),
                            _Bar(
                              label: 'Open',
                              value: (d.totalLeads - d.ordersConfirmed).clamp(0, 999999),
                              color: AppColors.ocean,
                              max: d.totalLeads,
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    if (user?.canPage('leads') != false)
                      FilledButton.icon(
                        onPressed: () => context.go('/form'),
                        icon: const Icon(Icons.dynamic_form_rounded),
                        label: const Text('Open onboarding form'),
                      ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        if (user?.canPage('follow-ups') != false)
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () => context.push('/follow-ups'),
                              icon: const Icon(Icons.event_available_rounded, size: 18),
                              label: Text('Follow-ups (${d.followUpsDueToday})'),
                            ),
                          ),
                        if (user?.canPage('follow-ups') != false && user?.canPage('visits') != false)
                          const SizedBox(width: 8),
                        if (user?.canPage('visits') != false)
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () => context.go('/visits'),
                              icon: const Icon(Icons.place_outlined, size: 18),
                              label: const Text('Visits'),
                            ),
                          ),
                      ],
                    ),
                  ],
                );
              },
              loading: () => const Padding(
                padding: EdgeInsets.all(40),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (e, _) => Column(
                children: [
                  const LottieBox(url: LottieBox.empty, height: 120),
                  Text('$e', textAlign: TextAlign.center),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Bar extends StatelessWidget {
  const _Bar({required this.label, required this.value, required this.color, required this.max});

  final String label;
  final int value;
  final Color color;
  final int max;

  @override
  Widget build(BuildContext context) {
    final pct = max <= 0 ? 0.0 : (value / max).clamp(0.0, 1.0);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(child: Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600))),
            Text('$value', style: TextStyle(fontWeight: FontWeight.w800, color: color)),
          ],
        ),
        const SizedBox(height: 4),
        ClipRRect(
          borderRadius: BorderRadius.circular(6),
          child: LinearProgressIndicator(
            value: pct == 0 ? 0.02 : pct,
            minHeight: 8,
            backgroundColor: AppColors.mist,
            color: color,
          ),
        ),
      ],
    );
  }
}
