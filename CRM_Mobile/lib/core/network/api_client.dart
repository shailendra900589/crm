import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';
import '../storage/token_storage.dart';

final tokenStorageProvider = Provider((ref) => TokenStorage());

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(ref.watch(tokenStorageProvider));
});

class ApiClient {
  ApiClient(this._tokens) {
    _dio = Dio(
      BaseOptions(
        baseUrl: AppConfig.apiBase,
        connectTimeout: const Duration(seconds: 25),
        receiveTimeout: const Duration(seconds: 40),
        headers: {'Accept': 'application/json'},
      ),
    );
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final t = await _tokens.access;
          if (t != null && t.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $t';
          }
          handler.next(options);
        },
        onError: (err, handler) async {
          if (err.response?.statusCode == 401 && !_refreshing) {
            final ok = await _tryRefresh();
            if (ok) {
              final req = err.requestOptions;
              final t = await _tokens.access;
              req.headers['Authorization'] = 'Bearer $t';
              try {
                final res = await _dio.fetch(req);
                return handler.resolve(res);
              } catch (e) {
                return handler.next(err);
              }
            }
          }
          handler.next(err);
        },
      ),
    );
  }

  final TokenStorage _tokens;
  late final Dio _dio;
  bool _refreshing = false;

  Dio get raw => _dio;

  Future<bool> _tryRefresh() async {
    final refresh = await _tokens.refresh;
    if (refresh == null || refresh.isEmpty) return false;
    _refreshing = true;
    try {
      final res = await Dio(BaseOptions(baseUrl: AppConfig.apiBase)).post(
        '/api/auth/refresh/',
        data: {'refresh': refresh},
      );
      final access = res.data['access'] as String?;
      if (access == null) return false;
      await _tokens.saveTokens(access: access, refresh: refresh);
      return true;
    } catch (_) {
      await _tokens.clear();
      return false;
    } finally {
      _refreshing = false;
    }
  }

  Future<Response<T>> get<T>(String path, {Map<String, dynamic>? query}) =>
      _dio.get<T>(path, queryParameters: query);

  Future<Response<T>> post<T>(String path, {dynamic data}) => _dio.post<T>(path, data: data);

  Future<Response<T>> patch<T>(String path, {dynamic data}) => _dio.patch<T>(path, data: data);

  Future<Response<T>> put<T>(String path, {dynamic data}) => _dio.put<T>(path, data: data);

  String errorMessage(Object e) {
    if (e is DioException) {
      final data = e.response?.data;
      if (data is Map && data['detail'] != null) {
        final d = data['detail'];
        if (d is String) return d;
        return d.toString();
      }
      return e.message ?? 'Network error';
    }
    return e.toString();
  }
}
