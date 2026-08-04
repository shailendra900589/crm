import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/network/api_client.dart';
import '../models/models.dart';

class AuthState {
  const AuthState({
    this.user,
    this.loading = false,
    this.error,
    this.booting = true,
  });

  final CrmUser? user;
  final bool loading;
  final String? error;
  final bool booting;

  bool get isLoggedIn => user != null && user!.canUseApp;

  AuthState copyWith({
    CrmUser? user,
    bool? loading,
    String? error,
    bool? booting,
    bool clearUser = false,
    bool clearError = false,
  }) {
    return AuthState(
      user: clearUser ? null : (user ?? this.user),
      loading: loading ?? this.loading,
      error: clearError ? null : (error ?? this.error),
      booting: booting ?? this.booting,
    );
  }
}

class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier(this._api, this._ref) : super(const AuthState()) {
    bootstrap();
  }

  final ApiClient _api;
  final Ref _ref;

  String? _accessDenied(CrmUser user) {
    if (!user.isFieldStaff) {
      return 'This app is for Manager, TL, BDM and Ops. Your role: ${user.role}.';
    }
    if (!user.crmProMobileAccess) {
      return user.crmProMobileReason ??
          'Mobile CRM is disabled for your account. Ask Admin.';
    }
    return null;
  }

  Future<void> bootstrap() async {
    final has = await _ref.read(tokenStorageProvider).hasSession;
    if (!has) {
      state = state.copyWith(booting: false, clearUser: true);
      return;
    }
    try {
      final res = await _api.get('/api/me/');
      final user = CrmUser.fromJson(Map<String, dynamic>.from(res.data as Map));
      final denied = _accessDenied(user);
      if (denied != null) {
        await _ref.read(tokenStorageProvider).clear();
        state = AuthState(booting: false, error: denied);
        return;
      }
      state = AuthState(user: user, booting: false);
    } catch (_) {
      await _ref.read(tokenStorageProvider).clear();
      state = const AuthState(booting: false);
    }
  }

  Future<bool> login(String username, String password) async {
    state = state.copyWith(loading: true, clearError: true);
    try {
      final res = await _api.post(
        '/api/auth/login/',
        data: {'username': username.trim(), 'password': password},
      );
      final data = Map<String, dynamic>.from(res.data as Map);
      await _ref.read(tokenStorageProvider).saveTokens(
            access: data['access'] as String,
            refresh: data['refresh'] as String,
          );
      final me = await _api.get('/api/me/');
      final user = CrmUser.fromJson(Map<String, dynamic>.from(me.data as Map));
      final denied = _accessDenied(user);
      if (denied != null) {
        await _ref.read(tokenStorageProvider).clear();
        state = state.copyWith(loading: false, error: denied, booting: false, clearUser: true);
        return false;
      }
      state = AuthState(user: user, loading: false, booting: false);
      return true;
    } catch (e) {
      state = state.copyWith(
        loading: false,
        error: _api.errorMessage(e),
        booting: false,
      );
      return false;
    }
  }

  Future<void> logout() async {
    await _ref.read(tokenStorageProvider).clear();
    state = const AuthState(booting: false);
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(ref.watch(apiClientProvider), ref);
});
