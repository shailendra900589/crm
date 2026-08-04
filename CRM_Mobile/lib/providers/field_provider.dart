import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/network/api_client.dart';
import '../models/models.dart';
import 'project_provider.dart';

final productsProvider = FutureProvider.autoDispose<List<ProductItem>>((ref) async {
  final projectId = ref.watch(activeProjectProvider);
  final api = ref.watch(apiClientProvider);
  final res = await api.get(
    '/api/products/',
    query: {'project': ?projectId},
  );
  final raw = res.data;
  final list = raw is List
      ? raw
      : (raw is Map && raw['results'] is List)
          ? raw['results'] as List
          : <dynamic>[];
  return list
      .whereType<Map>()
      .map((e) => ProductItem.fromJson(Map<String, dynamic>.from(e)))
      .where((p) => projectId == null || p.project == null || p.project == projectId)
      .toList();
});

final visitsProvider = FutureProvider.autoDispose<List<VisitItem>>((ref) async {
  final projectId = ref.watch(activeProjectProvider);
  final api = ref.watch(apiClientProvider);
  final res = await api.get(
    '/api/visits/',
    query: {
      'project': ?projectId,
      'upcoming': 1,
    },
  );
  final raw = res.data;
  final list = raw is List
      ? raw
      : (raw is Map && raw['results'] is List)
          ? raw['results'] as List
          : <dynamic>[];
  return list.whereType<Map>().map((e) => VisitItem.fromJson(Map<String, dynamic>.from(e))).toList();
});

final allVisitsProvider = FutureProvider.autoDispose<List<VisitItem>>((ref) async {
  final projectId = ref.watch(activeProjectProvider);
  final api = ref.watch(apiClientProvider);
  final res = await api.get(
    '/api/visits/',
    query: {'project': ?projectId},
  );
  final raw = res.data;
  final list = raw is List
      ? raw
      : (raw is Map && raw['results'] is List)
          ? raw['results'] as List
          : <dynamic>[];
  return list.whereType<Map>().map((e) => VisitItem.fromJson(Map<String, dynamic>.from(e))).toList();
});

final followUpsProvider = FutureProvider.autoDispose<FollowUpsHub>((ref) async {
  final projectId = ref.watch(activeProjectProvider);
  final api = ref.watch(apiClientProvider);
  final res = await api.get(
    '/api/follow-ups/',
    query: {'project': ?projectId},
  );
  return FollowUpsHub.fromJson(Map<String, dynamic>.from(res.data as Map));
});

final notificationsProvider = FutureProvider.autoDispose<List<NotificationItem>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final res = await api.get('/api/notifications/');
  final raw = res.data;
  final list = raw is List
      ? raw
      : (raw is Map && raw['results'] is List)
          ? raw['results'] as List
          : <dynamic>[];
  return list
      .whereType<Map>()
      .map((e) => NotificationItem.fromJson(Map<String, dynamic>.from(e)))
      .toList();
});

final leadDetailProvider = FutureProvider.autoDispose.family<LeadItem, int>((ref, id) async {
  final api = ref.watch(apiClientProvider);
  final res = await api.get('/api/leads/$id/');
  return LeadItem.fromJson(Map<String, dynamic>.from(res.data as Map));
});

final leadActivityProvider =
    FutureProvider.autoDispose.family<List<ActivityEvent>, int>((ref, id) async {
  final api = ref.watch(apiClientProvider);
  final res = await api.get('/api/leads/$id/activity/');
  final raw = res.data;
  final list = raw is Map && raw['events'] is List
      ? raw['events'] as List
      : raw is List
          ? raw
          : <dynamic>[];
  return list.whereType<Map>().map((e) => ActivityEvent.fromJson(Map<String, dynamic>.from(e))).toList();
});
