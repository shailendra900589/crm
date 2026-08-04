import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/network/api_client.dart';
import '../models/models.dart';
import 'auth_provider.dart';

final projectsProvider = FutureProvider<List<ProjectItem>>((ref) async {
  ref.watch(authProvider.select((s) => s.user?.id));
  final api = ref.watch(apiClientProvider);
  final res = await api.get('/api/projects/');
  final raw = res.data;
  final list = raw is List
      ? raw
      : (raw is Map && raw['results'] is List)
          ? raw['results'] as List
          : <dynamic>[];
  return list
      .whereType<Map>()
      .map((e) => ProjectItem.fromJson(Map<String, dynamic>.from(e)))
      .where((p) => p.isActive)
      .toList();
});

class ActiveProjectNotifier extends StateNotifier<int?> {
  ActiveProjectNotifier() : super(null) {
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final id = prefs.getInt('active_project');
    if (id != null) state = id;
  }

  Future<void> setProject(int id) async {
    state = id;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt('active_project', id);
  }

  Future<void> ensureDefault(List<ProjectItem> projects) async {
    if (projects.isEmpty) return;
    if (state != null && projects.any((p) => p.id == state)) return;
    await setProject(projects.first.id);
  }
}

final activeProjectProvider = StateNotifierProvider<ActiveProjectNotifier, int?>((ref) {
  return ActiveProjectNotifier();
});
