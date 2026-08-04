class CrmUser {
  CrmUser({
    required this.id,
    required this.username,
    required this.role,
    this.firstName = '',
    this.lastName = '',
    this.allowedPages = const [],
    this.crmProMobileAccess = true,
    this.crmProMobileReason,
    this.organizationName,
    this.canEditLeads = true,
  });

  final int id;
  final String username;
  final String role;
  final String firstName;
  final String lastName;
  final List<String> allowedPages;
  final bool crmProMobileAccess;
  final String? crmProMobileReason;
  final String? organizationName;
  final bool canEditLeads;

  String get displayName {
    final n = '$firstName $lastName'.trim();
    return n.isEmpty ? username : n;
  }

  static const fieldRoles = {'BDM', 'TL', 'Manager', 'Ops', 'Admin', 'SuperAdmin'};

  bool get isFieldStaff => fieldRoles.contains(role);
  bool get isLeader => role == 'Manager' || role == 'TL' || role == 'Admin' || role == 'SuperAdmin';
  bool get canUseApp => isFieldStaff && crmProMobileAccess;

  bool canPage(String key) {
    if (role == 'Admin' || role == 'SuperAdmin') return true;
    if (allowedPages.isEmpty) return true;
    return allowedPages.contains(key);
  }

  factory CrmUser.fromJson(Map<String, dynamic> j) => CrmUser(
        id: j['id'] as int,
        username: j['username'] as String? ?? '',
        role: j['role'] as String? ?? 'BDM',
        firstName: j['first_name'] as String? ?? '',
        lastName: j['last_name'] as String? ?? '',
        allowedPages: (j['allowed_pages'] as List?)?.map((e) => '$e').toList() ?? const [],
        crmProMobileAccess: j['crm_pro_mobile_access'] as bool? ?? true,
        crmProMobileReason: j['crm_pro_mobile_reason'] as String?,
        organizationName: j['organization_name'] as String? ??
            (j['organization_detail'] is Map ? j['organization_detail']['name'] as String? : null),
        canEditLeads: j['can_edit_leads'] as bool? ?? true,
      );
}

class ProjectItem {
  ProjectItem({
    required this.id,
    required this.name,
    this.color = '#0B3D4A',
    this.isActive = true,
    this.crmProMobileEnabled = false,
  });

  final int id;
  final String name;
  final String color;
  final bool isActive;
  final bool crmProMobileEnabled;

  factory ProjectItem.fromJson(Map<String, dynamic> j) => ProjectItem(
        id: j['id'] as int,
        name: j['name'] as String? ?? 'Project',
        color: j['color'] as String? ?? '#0B3D4A',
        isActive: j['is_active'] as bool? ?? true,
        crmProMobileEnabled: j['crm_pro_mobile_enabled'] as bool? ?? false,
      );
}

class FormFieldModel {
  FormFieldModel({
    required this.fieldId,
    required this.label,
    required this.type,
    this.required = false,
    this.options = const [],
    this.optionRules = const [],
    this.placeholder,
    this.helpText,
    this.min,
    this.max,
    this.fileAccept,
    this.maxFileMb,
    this.metricRole,
  });

  final String fieldId;
  final String label;
  final String type;
  final bool required;
  final List<String> options;
  final List<Map<String, dynamic>> optionRules;
  final String? placeholder;
  final String? helpText;
  final num? min;
  final num? max;
  final String? fileAccept;
  final num? maxFileMb;
  final String? metricRole;

  bool get isStepBreak => type == 'step_break';
  bool get isFile => type == 'file';
  bool get isChoice => type == 'dropdown' || type == 'radio' || type == 'multiselect';

  factory FormFieldModel.fromJson(Map<String, dynamic> j) => FormFieldModel(
        fieldId: j['field_id'] as String? ?? '',
        label: j['label'] as String? ?? 'Field',
        type: j['type'] as String? ?? 'text',
        required: j['required'] as bool? ?? false,
        options: (j['options'] as List?)?.map((e) => '$e').toList() ?? const [],
        optionRules: (j['option_rules'] as List?)
                ?.whereType<Map>()
                .map((e) => Map<String, dynamic>.from(e))
                .toList() ??
            const [],
        placeholder: j['placeholder'] as String?,
        helpText: j['help_text'] as String?,
        min: j['min'] as num?,
        max: j['max'] as num?,
        fileAccept: j['file_accept'] as String?,
        maxFileMb: j['max_file_mb'] as num?,
        metricRole: j['metric_role'] as String?,
      );
}

class CustomFormModel {
  CustomFormModel({
    required this.id,
    required this.project,
    required this.title,
    required this.schema,
    required this.updatedAt,
    this.isActive = true,
    this.enableCollection = false,
    this.projectName = '',
  });

  final int id;
  final int project;
  final String title;
  final List<FormFieldModel> schema;
  final String updatedAt;
  final bool isActive;
  final bool enableCollection;
  final String projectName;

  /// Fields ready for BDM fill (collection gated + no step_break for flat list helpers)
  List<FormFieldModel> get fillSchema {
    return schema.where((f) {
      if (f.metricRole == 'collection' && !enableCollection) return false;
      return true;
    }).toList();
  }

  factory CustomFormModel.fromJson(Map<String, dynamic> j) => CustomFormModel(
        id: j['id'] as int? ?? 0,
        project: j['project'] as int? ?? 0,
        title: j['title'] as String? ?? 'Form',
        schema: (j['schema'] as List?)
                ?.whereType<Map>()
                .map((e) => FormFieldModel.fromJson(Map<String, dynamic>.from(e)))
                .toList() ??
            const [],
        updatedAt: j['updated_at'] as String? ?? '',
        isActive: j['is_active'] as bool? ?? true,
        enableCollection: j['enable_collection'] as bool? ?? false,
        projectName: j['project_name'] as String? ?? '',
      );
}

class LeadItem {
  LeadItem({
    required this.id,
    required this.merchantName,
    this.merchantMobile = '',
    this.merchantCity = '',
    this.merchantEmail = '',
    this.brandName = '',
    this.status = '',
    this.statusDisplay = '',
    this.product,
    this.productName,
    this.bdmName,
    this.followUpDate,
    this.notes = '',
    this.customData = const {},
    this.project,
    this.projectName,
  });

  final int id;
  final String merchantName;
  final String merchantMobile;
  final String merchantCity;
  final String merchantEmail;
  final String brandName;
  final String status;
  final String statusDisplay;
  final int? product;
  final String? productName;
  final String? bdmName;
  final String? followUpDate;
  final String notes;
  final Map<String, dynamic> customData;
  final int? project;
  final String? projectName;

  static const statusOptions = <MapEntry<String, String>>[
    MapEntry('interested', 'Interested'),
    MapEntry('follow_up', 'Follow Up'),
    MapEntry('callback', 'Callback'),
    MapEntry('order_confirmed', 'Order Confirmed'),
    MapEntry('not_interested', 'Not Interested'),
  ];

  factory LeadItem.fromJson(Map<String, dynamic> j) => LeadItem(
        id: j['id'] as int,
        merchantName: j['merchant_name'] as String? ?? 'Merchant',
        merchantMobile: j['merchant_mobile'] as String? ?? '',
        merchantCity: j['merchant_city'] as String? ?? '',
        merchantEmail: j['merchant_email'] as String? ?? '',
        brandName: j['brand_name'] as String? ?? '',
        status: j['status'] as String? ?? '',
        statusDisplay: j['status_display'] as String? ?? j['status'] as String? ?? '',
        product: j['product'] as int?,
        productName: j['product_name'] as String?,
        bdmName: j['bdm_name'] as String?,
        followUpDate: j['follow_up_date'] as String?,
        notes: j['notes'] as String? ?? '',
        customData: Map<String, dynamic>.from(j['custom_data'] as Map? ?? {}),
        project: j['project'] as int?,
        projectName: j['project_name'] as String?,
      );
}

class ProductItem {
  ProductItem({required this.id, required this.name, this.project});

  final int id;
  final String name;
  final int? project;

  factory ProductItem.fromJson(Map<String, dynamic> j) => ProductItem(
        id: j['id'] as int,
        name: j['name'] as String? ?? 'Product',
        project: j['project'] as int?,
      );
}

class VisitItem {
  VisitItem({
    required this.id,
    required this.lead,
    required this.leadName,
    this.merchantCity = '',
    this.scheduledDate = '',
    this.status = 'scheduled',
    this.visitType = '',
    this.remarks = '',
    this.projectName = '',
  });

  final int id;
  final int lead;
  final String leadName;
  final String merchantCity;
  final String scheduledDate;
  final String status;
  final String visitType;
  final String remarks;
  final String projectName;

  bool get isScheduled => status == 'scheduled';

  factory VisitItem.fromJson(Map<String, dynamic> j) => VisitItem(
        id: j['id'] as int,
        lead: j['lead'] as int? ?? 0,
        leadName: j['lead_name'] as String? ?? 'Lead',
        merchantCity: j['merchant_city'] as String? ?? '',
        scheduledDate: j['scheduled_date'] as String? ?? '',
        status: j['status'] as String? ?? 'scheduled',
        visitType: j['visit_type'] as String? ?? '',
        remarks: j['remarks'] as String? ?? '',
        projectName: j['project_name'] as String? ?? '',
      );
}

class NotificationItem {
  NotificationItem({
    required this.id,
    required this.message,
    this.isRead = false,
    this.link,
    this.createdAt = '',
  });

  final int id;
  final String message;
  final bool isRead;
  final String? link;
  final String createdAt;

  factory NotificationItem.fromJson(Map<String, dynamic> j) => NotificationItem(
        id: j['id'] as int,
        message: j['message'] as String? ?? '',
        isRead: j['is_read'] as bool? ?? false,
        link: j['link'] as String?,
        createdAt: j['created_at'] as String? ?? '',
      );
}

class FollowUpsHub {
  FollowUpsHub({
    required this.overdue,
    required this.dueToday,
    required this.upcoming,
    required this.counts,
  });

  final List<LeadItem> overdue;
  final List<LeadItem> dueToday;
  final List<LeadItem> upcoming;
  final Map<String, int> counts;

  factory FollowUpsHub.fromJson(Map<String, dynamic> j) {
    List<LeadItem> parse(String key) => (j[key] as List?)
            ?.whereType<Map>()
            .map((e) => LeadItem.fromJson(Map<String, dynamic>.from(e)))
            .toList() ??
        [];
    final c = Map<String, dynamic>.from(j['counts'] as Map? ?? {});
    return FollowUpsHub(
      overdue: parse('overdue'),
      dueToday: parse('due_today'),
      upcoming: parse('upcoming'),
      counts: {
        'overdue': (c['overdue'] as num?)?.toInt() ?? 0,
        'due_today': (c['due_today'] as num?)?.toInt() ?? 0,
        'upcoming': (c['upcoming'] as num?)?.toInt() ?? 0,
      },
    );
  }
}

class ActivityEvent {
  ActivityEvent({
    required this.id,
    required this.title,
    this.detail = '',
    this.actor = '',
    this.at = '',
  });

  final String id;
  final String title;
  final String detail;
  final String actor;
  final String at;

  factory ActivityEvent.fromJson(Map<String, dynamic> j) => ActivityEvent(
        id: '${j['id']}',
        title: j['title'] as String? ?? 'Event',
        detail: j['detail'] as String? ?? '',
        actor: j['actor'] as String? ?? '',
        at: j['at'] as String? ?? '',
      );
}

class DashboardData {
  DashboardData({
    required this.totalLeads,
    required this.ordersConfirmed,
    required this.followUpsDueToday,
    required this.conversionRate,
    this.projectForm,
    this.upcomingVisits = const [],
  });

  final int totalLeads;
  final int ordersConfirmed;
  final int followUpsDueToday;
  final double conversionRate;
  final CustomFormModel? projectForm;
  final List<Map<String, dynamic>> upcomingVisits;

  factory DashboardData.fromJson(Map<String, dynamic> j) {
    CustomFormModel? form;
    if (j['project_form'] is Map) {
      form = CustomFormModel.fromJson(Map<String, dynamic>.from(j['project_form'] as Map));
    }
    return DashboardData(
      totalLeads: j['total_leads'] as int? ?? 0,
      ordersConfirmed: j['orders_confirmed'] as int? ?? 0,
      followUpsDueToday: j['follow_ups_due_today'] as int? ?? 0,
      conversionRate: (j['conversion_rate'] as num?)?.toDouble() ?? 0,
      projectForm: form,
      upcomingVisits: (j['upcoming_visits'] as List?)
              ?.whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList() ??
          const [],
    );
  }
}
