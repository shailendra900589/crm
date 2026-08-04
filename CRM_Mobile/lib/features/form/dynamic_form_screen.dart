import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/lottie_box.dart';
import '../../models/models.dart';
import '../../providers/field_provider.dart';
import '../../providers/form_provider.dart';
import '../../providers/project_provider.dart';

class DynamicFormScreen extends ConsumerStatefulWidget {
  const DynamicFormScreen({super.key, this.leadId});

  final int? leadId;

  @override
  ConsumerState<DynamicFormScreen> createState() => _DynamicFormScreenState();
}

class _DynamicFormScreenState extends ConsumerState<DynamicFormScreen> {
  final _answers = <String, dynamic>{};
  final _freshName = TextEditingController();
  final _freshMobile = TextEditingController();
  final _freshCity = TextEditingController();
  int? _leadId;
  int? _productId;
  bool _submitting = false;
  String? _error;
  bool _success = false;
  int _step = 0;

  @override
  void initState() {
    super.initState();
    _leadId = widget.leadId;
  }

  @override
  void didUpdateWidget(covariant DynamicFormScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.leadId != widget.leadId) {
      setState(() {
        _leadId = widget.leadId;
        _answers.clear();
        _step = 0;
        _success = false;
      });
    }
  }

  @override
  void dispose() {
    _freshName.dispose();
    _freshMobile.dispose();
    _freshCity.dispose();
    super.dispose();
  }

  List<List<FormFieldModel>> _steps(List<FormFieldModel> schema) {
    final steps = <List<FormFieldModel>>[];
    var cur = <FormFieldModel>[];
    for (final f in schema) {
      if (f.isStepBreak) {
        if (cur.isNotEmpty) steps.add(cur);
        cur = [];
      } else {
        cur.add(f);
      }
    }
    if (cur.isNotEmpty) steps.add(cur);
    if (steps.isEmpty) steps.add([]);
    return steps;
  }

  Set<String> _visibleIds(List<FormFieldModel> schema) {
    final revealed = <String>{};
    for (final f in schema) {
      if (!f.isChoice) continue;
      final val = _answers[f.fieldId];
      final selected = val is List ? val.cast<String>() : [if (val != null) '$val'];
      for (final rule in f.optionRules) {
        final opt = '${rule['option']}';
        if (selected.contains(opt)) {
          final ids = rule['show_field_ids'];
          if (ids is List) {
            for (final id in ids) {
              revealed.add('$id');
            }
          }
        }
      }
    }
    final conditional = <String>{};
    for (final f in schema) {
      for (final rule in f.optionRules) {
        final ids = rule['show_field_ids'];
        if (ids is List) {
          for (final id in ids) {
            conditional.add('$id');
          }
        }
      }
    }
    return {
      for (final f in schema)
        if (!conditional.contains(f.fieldId) || revealed.contains(f.fieldId)) f.fieldId,
    };
  }

  Future<int> _ensureLead(ApiClient api) async {
    if (_leadId != null) return _leadId!;
    final projectId = ref.read(activeProjectProvider);
    if (projectId == null) throw Exception('Select a project first');
    final name = _freshName.text.trim();
    final mobile = _freshMobile.text.trim();
    if (name.isEmpty || mobile.replaceAll(RegExp(r'\D'), '').length < 10) {
      throw Exception('Enter merchant name & valid mobile for Fresh Direct');
    }

    var force = false;
    try {
      final dup = await api.get('/api/leads/check-duplicate/', query: {
        'mobile': mobile,
        'project': projectId,
      });
      final data = Map<String, dynamic>.from(dup.data as Map);
      if (data['duplicate'] == true) {
        if (!mounted) throw Exception('Duplicate cancelled');
        final proceed = await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Possible duplicate'),
            content: Text('Mobile already has ${data['count'] ?? 1} lead(s) in this project. Continue anyway?'),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
              FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Continue')),
            ],
          ),
        );
        if (proceed != true) throw Exception('Duplicate cancelled');
        force = true;
      }
    } catch (e) {
      if (e.toString().contains('Duplicate cancelled')) rethrow;
      // soft-fail duplicate check
    }

    final res = await api.post('/api/leads/', data: {
      'project': projectId,
      'merchant_name': name,
      'merchant_mobile': mobile,
      'city': _freshCity.text.trim().isEmpty ? null : _freshCity.text.trim(),
      if (_productId != null) 'product': _productId,
      'notes': 'Fresh direct onboarding (mobile)',
      if (force) 'force': true,
    });
    final id = (res.data as Map)['id'] as int;
    setState(() => _leadId = id);
    return id;
  }

  Future<void> _uploadFile(FormFieldModel field) async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_camera_rounded),
              title: const Text('Camera'),
              onTap: () => Navigator.pop(ctx, ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_rounded),
              title: const Text('Gallery'),
              onTap: () => Navigator.pop(ctx, ImageSource.gallery),
            ),
          ],
        ),
      ),
    );
    if (source == null) return;
    final picker = ImagePicker();
    final file = await picker.pickImage(source: source, imageQuality: 85);
    if (file == null) return;
    setState(() => _error = null);
    try {
      final api = ref.read(apiClientProvider);
      final leadId = await _ensureLead(api);
      final form = FormData.fromMap({
        'field_id': field.fieldId,
        'file': await MultipartFile.fromFile(file.path, filename: file.name),
      });
      final res = await api.raw.post('/api/leads/$leadId/upload-form-file/', data: form);
      final url = (res.data as Map)['url'] as String?;
      if (url != null) setState(() => _answers[field.fieldId] = url);
    } catch (e) {
      setState(() => _error = ref.read(apiClientProvider).errorMessage(e));
    }
  }

  Future<void> _submit(CustomFormModel form) async {
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await ref.read(formSyncProvider.notifier).refresh(force: true);
      final api = ref.read(apiClientProvider);
      final leadId = await _ensureLead(api);
      await api.post('/api/leads/$leadId/form_submission/', data: {
        'answers': _answers,
        'remarks': '',
      });
      setState(() => _success = true);
      ref.invalidate(leadsProvider);
      ref.invalidate(dashboardProvider);
    } catch (e) {
      setState(() => _error = apiError(e));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  String apiError(Object e) => ref.read(apiClientProvider).errorMessage(e);

  @override
  Widget build(BuildContext context) {
    final asyncForm = ref.watch(formSyncProvider);

    if (_success) {
      return Scaffold(
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const LottieBox(url: LottieBox.success, height: 160, repeat: false),
              Text('Submitted', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: AppColors.ocean)),
              const SizedBox(height: 8),
              const Text('Saved to CRM · verification notified'),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: () => setState(() {
                  _success = false;
                  _answers.clear();
                  _leadId = widget.leadId;
                  _step = 0;
                  _freshName.clear();
                  _freshMobile.clear();
                  _freshCity.clear();
                  _productId = null;
                }),
                child: const Text('Submit another'),
              ),
            ],
          ),
        ),
      );
    }

    final products = ref.watch(productsProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text('Onboarding Form', style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.ocean)),
        actions: [
          IconButton(
            tooltip: 'Refresh form schema',
            onPressed: () => ref.read(formSyncProvider.notifier).refresh(force: true),
            icon: const Icon(Icons.sync_rounded),
          ),
        ],
      ),
      body: asyncForm.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('$e')),
        data: (form) {
          if (form == null || !form.isActive) {
            return const Center(child: Text('No active form for this project'));
          }
          final schema = form.fillSchema;
          final steps = _steps(schema);
          final visible = _visibleIds(schema);
          final stepFields = steps[_step.clamp(0, steps.length - 1)]
              .where((f) => visible.contains(f.fieldId))
              .toList();

          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
            children: [
              Text(
                form.title,
                style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.ocean),
              ),
              Text(
                'Auto-synced from Form Builder${form.updatedAt.isNotEmpty ? ' · ${form.updatedAt.substring(0, 16)}' : ''}',
                style: TextStyle(fontSize: 12, color: AppColors.ink.withValues(alpha: 0.5)),
              ),
              if (_leadId == null) ...[
                const SizedBox(height: 14),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Fresh Direct', style: TextStyle(fontWeight: FontWeight.w800)),
                        const SizedBox(height: 8),
                        TextField(controller: _freshName, decoration: const InputDecoration(labelText: 'Merchant name *')),
                        const SizedBox(height: 8),
                        TextField(
                          controller: _freshMobile,
                          keyboardType: TextInputType.phone,
                          decoration: const InputDecoration(labelText: 'Mobile *'),
                        ),
                        const SizedBox(height: 8),
                        TextField(controller: _freshCity, decoration: const InputDecoration(labelText: 'City')),
                        const SizedBox(height: 8),
                        products.when(
                          data: (list) => DropdownButtonFormField<int>(
                            key: ValueKey('fresh-product-$_productId'),
                            initialValue: _productId != null && list.any((p) => p.id == _productId) ? _productId : null,
                            items: list.map((p) => DropdownMenuItem(value: p.id, child: Text(p.name))).toList(),
                            onChanged: (v) => setState(() => _productId = v),
                            decoration: const InputDecoration(labelText: 'Product'),
                          ),
                          loading: () => const LinearProgressIndicator(),
                          error: (e, st) => const SizedBox.shrink(),
                        ),
                      ],
                    ),
                  ),
                ),
              ] else
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Chip(
                    avatar: const Icon(Icons.badge_outlined, size: 16),
                    label: Text('Lead #$_leadId'),
                    backgroundColor: AppColors.mist,
                  ),
                ),
              if (steps.length > 1) ...[
                const SizedBox(height: 14),
                Wrap(
                  spacing: 6,
                  children: List.generate(
                    steps.length,
                    (i) => ChoiceChip(
                      label: Text('Step ${i + 1}'),
                      selected: _step == i,
                      onSelected: (v) {
                        if (v && i <= _step) setState(() => _step = i);
                      },
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 12),
              ...stepFields.map((f) => _FieldTile(
                    field: f,
                    value: _answers[f.fieldId],
                    onChanged: (v) => setState(() => _answers[f.fieldId] = v),
                    onUpload: () => _uploadFile(f),
                  )),
              if (_error != null) ...[
                const SizedBox(height: 8),
                Text(_error!, style: const TextStyle(color: AppColors.coral)),
              ],
              const SizedBox(height: 16),
              Row(
                children: [
                  if (_step > 0)
                    OutlinedButton(
                      onPressed: () => setState(() => _step--),
                      child: const Text('Back'),
                    ),
                  const Spacer(),
                  if (_step < steps.length - 1)
                    FilledButton(
                      onPressed: () => setState(() => _step++),
                      child: const Text('Next'),
                    )
                  else
                    FilledButton(
                      onPressed: _submitting ? null : () => _submit(form),
                      style: FilledButton.styleFrom(backgroundColor: AppColors.coral),
                      child: Text(_submitting ? 'Submitting…' : 'Submit & Complete'),
                    ),
                ],
              ),
            ],
          );
        },
      ),
    );
  }
}

class _FieldTile extends StatelessWidget {
  const _FieldTile({
    required this.field,
    required this.value,
    required this.onChanged,
    required this.onUpload,
  });

  final FormFieldModel field;
  final dynamic value;
  final ValueChanged<dynamic> onChanged;
  final VoidCallback onUpload;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${field.label}${field.required ? ' *' : ''}',
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
          ),
          if (field.helpText != null && field.helpText!.isNotEmpty)
            Text(field.helpText!, style: TextStyle(fontSize: 11, color: AppColors.ink.withValues(alpha: 0.45))),
          const SizedBox(height: 6),
          if (field.isFile)
            OutlinedButton.icon(
              onPressed: onUpload,
              icon: const Icon(Icons.upload_file_rounded),
              label: Text(value is String && '$value'.isNotEmpty ? 'Uploaded · change' : 'Upload file'),
            )
          else if (field.type == 'textarea')
            TextFormField(
              initialValue: value?.toString() ?? '',
              maxLines: 3,
              decoration: InputDecoration(hintText: field.placeholder),
              onChanged: onChanged,
            )
          else if (field.type == 'dropdown' || field.type == 'radio')
            DropdownButtonFormField<String>(
              key: ValueKey('${field.fieldId}-$value'),
              initialValue: value is String && field.options.contains(value) ? value as String : null,
              items: field.options.map((o) => DropdownMenuItem(value: o, child: Text(o))).toList(),
              onChanged: onChanged,
              decoration: InputDecoration(hintText: field.placeholder ?? 'Select'),
            )
          else if (field.type == 'multiselect')
            Wrap(
              spacing: 6,
              children: field.options.map((o) {
                final selected = value is List && (value as List).contains(o);
                return FilterChip(
                  label: Text(o),
                  selected: selected,
                  onSelected: (v) {
                    final cur = List<String>.from(value is List ? value as List : []);
                    if (v) {
                      cur.add(o);
                    } else {
                      cur.remove(o);
                    }
                    onChanged(cur);
                  },
                );
              }).toList(),
            )
          else
            TextFormField(
              initialValue: value?.toString() ?? '',
              keyboardType: field.type == 'number' || field.type == 'currency' || field.type == 'phone'
                  ? TextInputType.number
                  : field.type == 'email'
                      ? TextInputType.emailAddress
                      : TextInputType.text,
              decoration: InputDecoration(
                hintText: field.placeholder,
                prefixText: field.type == 'currency' ? '₹ ' : null,
              ),
              onChanged: onChanged,
            ),
        ],
      ),
    );
  }
}
