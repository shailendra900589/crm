class AppConfig {
  /// Override with `--dart-define=API_BASE=https://crm.trackbook.co`
  static const apiBase = String.fromEnvironment(
    'API_BASE',
    defaultValue: 'https://crm.trackbook.co',
  );

  static const appName = 'Trackbook CRM';
  static const formPollSeconds = 45;
}
