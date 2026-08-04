import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../models/models.dart';
import '../../providers/field_provider.dart';
import '../../providers/form_provider.dart';

class LeadDetailScreen extends ConsumerStatefulWidget {
  const LeadDetailScreen({super.key, required this.leadId});

  final int leadId;

  @override
  ConsumerState<LeadDetailScreen> createState() => _LeadDetailScreenState();
}

class _LeadDetailScreenState extends ConsumerState<LeadDetailScreen> {
  bool _busy = false;

  Future<void> _patch(Map<String, dynamic> data) async {
    setState(() => _busy = true);
    try {
      final api = ref.read(apiClientProvider);
      await api.patch('/api/leads/${widget.leadId}/', data: data);
      ref.invalidate(leadDetailProvider(widget.leadId));
      ref.invalidate(leadsProvider);
      ref.invalidate(followUpsProvider);
      ref.invalidate(dashboardProvider);
      ref.invalidate(leadActivityProvider(widget.leadId));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Saved')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ref.read(apiClientProvider).errorMessage(e))),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _pickFollowUp(LeadItem lead) async {
    final initial = DateTime.tryParse(lead.followUpDate ?? '') ?? DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime.now().subtract(const Duration(days: 1)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked == null) return;
    final api = ref.read(apiClientProvider);
    setState(() => _busy = true);
    try {
      await api.patch('/api/leads/${widget.leadId}/follow_up/', data: {
        'follow_up_date': DateFormat('yyyy-MM-dd').format(picked),
      });
      ref.invalidate(leadDetailProvider(widget.leadId));
      ref.invalidate(followUpsProvider);
      ref.invalidate(leadsProvider);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(api.errorMessage(e))),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _logCall() async {
    String outcome = 'answered';
    final notes = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => AlertDialog(
          title: Text('Log call', style: TextStyle(fontWeight: FontWeight.w800)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                initialValue: outcome,
                items: const [
                  DropdownMenuItem(value: 'answered', child: Text('Answered')),
                  DropdownMenuItem(value: 'no_answer', child: Text('No answer')),
                  DropdownMenuItem(value: 'busy', child: Text('Busy')),
                  DropdownMenuItem(value: 'callback', child: Text('Callback')),
                  DropdownMenuItem(value: 'interested', child: Text('Interested')),
                  DropdownMenuItem(value: 'not_interested', child: Text('Not interested')),
                ],
                onChanged: (v) => setLocal(() => outcome = v ?? outcome),
                decoration: const InputDecoration(labelText: 'Outcome'),
              ),
              const SizedBox(height: 10),
              TextField(controller: notes, decoration: const InputDecoration(labelText: 'Notes'), maxLines: 2),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Save')),
          ],
        ),
      ),
    );
    final noteText = notes.text.trim();
    notes.dispose();
    if (ok != true) return;
    setState(() => _busy = true);
    try {
      final api = ref.read(apiClientProvider);
      await api.post('/api/leads/${widget.leadId}/log-call/', data: {
        'outcome': outcome,
        if (noteText.isNotEmpty) 'notes': noteText,
      });
      ref.invalidate(leadDetailProvider(widget.leadId));
      ref.invalidate(leadActivityProvider(widget.leadId));
      ref.invalidate(leadsProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Call logged')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ref.read(apiClientProvider).errorMessage(e))),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final leadAsync = ref.watch(leadDetailProvider(widget.leadId));
    final activity = ref.watch(leadActivityProvider(widget.leadId));
    final products = ref.watch(productsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Lead', style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.ocean)),
        actions: [
          IconButton(
            onPressed: () {
              ref.invalidate(leadDetailProvider(widget.leadId));
              ref.invalidate(leadActivityProvider(widget.leadId));
            },
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: leadAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('$e')),
        data: (lead) => ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      lead.merchantName,
                      style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.ocean),
                    ),
                    const SizedBox(height: 6),
                    Text([
                      if (lead.merchantMobile.isNotEmpty) lead.merchantMobile,
                      if (lead.merchantCity.isNotEmpty) lead.merchantCity,
                      if (lead.productName != null) lead.productName!,
                      if (lead.bdmName != null && lead.bdmName!.isNotEmpty) 'BDM ${lead.bdmName}',
                    ].join(' · ')),
                    if (lead.brandName.isNotEmpty)
                      Text(lead.brandName, style: TextStyle(color: AppColors.ink.withValues(alpha: 0.55))),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      children: [
                        Chip(label: Text(lead.statusDisplay), backgroundColor: AppColors.mist),
                        if (lead.followUpDate != null && lead.followUpDate!.isNotEmpty)
                          Chip(
                            avatar: const Icon(Icons.event, size: 16),
                            label: Text('FU ${lead.followUpDate!.substring(0, 10)}'),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            const Text('Quick actions', style: TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                FilledButton.icon(
                  onPressed: _busy ? null : () => context.push('/form?lead=${lead.id}'),
                  icon: const Icon(Icons.dynamic_form_rounded),
                  label: const Text('Open form'),
                ),
                FilledButton.tonalIcon(
                  onPressed: _busy ? null : _logCall,
                  icon: const Icon(Icons.call_rounded),
                  label: const Text('Log call'),
                ),
                OutlinedButton.icon(
                  onPressed: _busy ? null : () => _pickFollowUp(lead),
                  icon: const Icon(Icons.calendar_month_rounded),
                  label: const Text('Follow-up'),
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
                    const Text('Status', style: TextStyle(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      key: ValueKey('status-${lead.status}'),
                      initialValue: LeadItem.statusOptions.any((e) => e.key == lead.status) ? lead.status : null,
                      items: LeadItem.statusOptions
                          .map((e) => DropdownMenuItem(value: e.key, child: Text(e.value)))
                          .toList(),
                      onChanged: _busy
                          ? null
                          : (v) {
                              if (v != null) _patch({'status': v});
                            },
                    ),
                    const SizedBox(height: 12),
                    const Text('Product', style: TextStyle(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 8),
                    products.when(
                      data: (list) => DropdownButtonFormField<int>(
                        key: ValueKey('product-${lead.product}'),
                        initialValue:
                            lead.product != null && list.any((p) => p.id == lead.product) ? lead.product : null,
                        items: list.map((p) => DropdownMenuItem(value: p.id, child: Text(p.name))).toList(),
                        onChanged: _busy
                            ? null
                            : (v) {
                                if (v != null) _patch({'product': v});
                              },
                        decoration: const InputDecoration(hintText: 'Select product'),
                      ),
                      loading: () => const LinearProgressIndicator(),
                      error: (e, _) => Text('$e'),
                    ),
                    if (lead.notes.isNotEmpty) ...[
                      const SizedBox(height: 14),
                      const Text('Notes', style: TextStyle(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 6),
                      Text(lead.notes, style: const TextStyle(fontSize: 13, height: 1.4)),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            const Text('Activity', style: TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            activity.when(
              data: (events) {
                if (events.isEmpty) return const Text('No activity yet');
                return Column(
                  children: events.take(20).map((e) {
                    return Card(
                      child: ListTile(
                        dense: true,
                        title: Text(e.title, style: const TextStyle(fontWeight: FontWeight.w700)),
                        subtitle: Text([
                          if (e.detail.isNotEmpty) e.detail,
                          if (e.actor.isNotEmpty) e.actor,
                          if (e.at.isNotEmpty) e.at.length > 16 ? e.at.substring(0, 16) : e.at,
                        ].join(' · ')),
                      ),
                    );
                  }).toList(),
                );
              },
              loading: () => const LinearProgressIndicator(),
              error: (e, _) => Text('$e'),
            ),
          ],
        ),
      ),
    );
  }
}
