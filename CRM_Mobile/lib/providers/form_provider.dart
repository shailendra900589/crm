import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/config/app_config.dart';
import '../core/network/api_client.dart';
import '../models/models.dart';
import 'project_provider.dart';

/// Auto-refreshing Form Builder schema for the active project.
/// Employees always get Admin's latest form via `updated_at` polling.
class FormSyncNotifier extends StateNotifier<AsyncValue<CustomFormModel?>> {
  FormSyncNotifier(this._ref) : super(const AsyncValue.loading()) {
    _ref.listen<int?>(activeProjectProvider, (prev, next) => refresh(force: true));
    refresh(force: true);
    _timer = Timer.periodic(
      const Duration(seconds: AppConfig.formPollSeconds),
      (_) => refresh(),
    );
  }

  final Ref _ref;
  Timer? _timer;
  String? _lastUpdatedAt;

  Future<void> refresh({bool force = false}) async {
    final projectId = _ref.read(activeProjectProvider);
    if (projectId == null) {
      state = const AsyncValue.data(null);
      return;
    }
    try {
      final api = _ref.read(apiClientProvider);
      final res = await api.get('/api/projects/$projectId/custom-form/');
      final form = CustomFormModel.fromJson(Map<String, dynamic>.from(res.data as Map));
      if (!force && _lastUpdatedAt == form.updatedAt && state.hasValue) {
        return;
      }
      _lastUpdatedAt = form.updatedAt;
      state = AsyncValue.data(form);
    } catch (e, st) {
      if (!state.hasValue) {
        state = AsyncValue.error(e, st);
      }
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}

final formSyncProvider =
    StateNotifierProvider<FormSyncNotifier, AsyncValue<CustomFormModel?>>((ref) {
  return FormSyncNotifier(ref);
});

final dashboardProvider = FutureProvider.autoDispose<DashboardData>((ref) async {
  final projectId = ref.watch(activeProjectProvider);
  final api = ref.watch(apiClientProvider);
  final res = await api.get(
    '/api/dashboard/',
    query: projectId != null ? {'project': projectId} : null,
  );
  return DashboardData.fromJson(Map<String, dynamic>.from(res.data as Map));
});

final leadsProvider = FutureProvider.autoDispose<List<LeadItem>>((ref) async {
  final projectId = ref.watch(activeProjectProvider);
  final api = ref.watch(apiClientProvider);
  final res = await api.get(
    '/api/leads/',
    query: {
      'project': ?projectId,
      'page': 1,
    },
  );
  final raw = res.data;
  final list = raw is Map && raw['results'] is List
      ? raw['results'] as List
      : raw is List
          ? raw
          : <dynamic>[];
  return list
      .whereType<Map>()
      .map((e) => LeadItem.fromJson(Map<String, dynamic>.from(e)))
      .toList();
});
