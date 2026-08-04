import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_theme.dart';
import '../../core/widgets/lottie_box.dart';
import '../../providers/auth_provider.dart';
import '../../providers/form_provider.dart';

class LeadsScreen extends ConsumerWidget {
  const LeadsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final leads = ref.watch(leadsProvider);
    final user = ref.watch(authProvider).user;
    final title = user?.isLeader == true ? 'Team Leads' : 'My Leads';

    return Scaffold(
      appBar: AppBar(
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.ocean)),
        actions: [
          IconButton(
            onPressed: () => ref.invalidate(leadsProvider),
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.coral,
        foregroundColor: Colors.white,
        onPressed: () => context.go('/form'),
        icon: const Icon(Icons.add_rounded),
        label: const Text('Fresh Direct'),
      ),
      body: leads.when(
        data: (list) {
          if (list.isEmpty) {
            return ListView(
              children: const [
                SizedBox(height: 40),
                LottieBox(url: LottieBox.empty, height: 160),
                SizedBox(height: 8),
                Center(child: Text('No leads yet — open Form to onboard')),
              ],
            );
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(leadsProvider),
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 88),
              itemCount: list.length,
              separatorBuilder: (context, index) => const SizedBox(height: 10),
              itemBuilder: (context, i) {
                final l = list[i];
                return Card(
                  child: ListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    title: Text(l.merchantName, style: const TextStyle(fontWeight: FontWeight.w700)),
                    subtitle: Text(
                      [
                        if (l.merchantCity.isNotEmpty) l.merchantCity,
                        l.statusDisplay,
                        if (l.productName != null) l.productName!,
                        if (user?.isLeader == true && l.bdmName != null && l.bdmName!.isNotEmpty) l.bdmName!,
                        if (l.followUpDate != null && l.followUpDate!.isNotEmpty)
                          'FU ${l.followUpDate!.length >= 10 ? l.followUpDate!.substring(0, 10) : l.followUpDate}',
                      ].join(' · '),
                    ),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () => context.push('/leads/${l.id}'),
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
