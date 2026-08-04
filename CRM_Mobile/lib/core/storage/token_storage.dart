import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class TokenStorage {
  static const _access = 'access';
  static const _refresh = 'refresh';
  final _store = const FlutterSecureStorage();

  Future<void> saveTokens({required String access, required String refresh}) async {
    await _store.write(key: _access, value: access);
    await _store.write(key: _refresh, value: refresh);
  }

  Future<String?> get access => _store.read(key: _access);
  Future<String?> get refresh => _store.read(key: _refresh);

  Future<void> clear() async {
    await _store.delete(key: _access);
    await _store.delete(key: _refresh);
  }

  Future<bool> get hasSession async => (await access)?.isNotEmpty == true;
}
