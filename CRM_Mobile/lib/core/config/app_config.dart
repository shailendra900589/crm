class AppConfig {
  /// Override with `--dart-define=API_BASE=https://crm.trackbook.co`
  static const apiBase = String.fromEnvironment(
    'API_BASE',
    defaultValue: 'https://crm.trackbook.co',
  );

  static const appName = 'Trackbook CRM';
  static const formPollSeconds = 45;

  /// Public legal URLs (Play Store listing + in-app links)
  static const privacyUrl = 'https://crm.trackbook.co/privacy';
  static const termsUrl = 'https://crm.trackbook.co/terms';
  static const disclaimerUrl = 'https://crm.trackbook.co/disclaimer';
  static const accountDeletionUrl = 'https://crm.trackbook.co/privacy#account-deletion';
  static const privacyEmail = 'privacy@trackbook.co';
  static const registeredOffice = 'D-1012/13, Indira Nagar, Lucknow, Uttar Pradesh, 226016';
}
