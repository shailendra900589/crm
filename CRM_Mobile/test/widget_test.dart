import 'package:flutter_test/flutter_test.dart';

import 'package:crm_mobile/core/config/app_config.dart';

void main() {
  test('app config defaults', () {
    expect(AppConfig.appName, 'Trackbook CRM');
    expect(AppConfig.formPollSeconds, 45);
  });
}
