"use client";

import { LegalPage, LegalSection } from "@/components/legal-page";

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="3 August 2026">
      <LegalSection heading="1. Who we are">
        <p>
          Trackbook CRM (&quot;we&quot;, &quot;our&quot;, &quot;platform&quot;) provides multi-tenant sales CRM software for
          companies and their field teams. This policy explains how we collect, use, and protect information when you
          register a company, sign in, or use the product.
        </p>
      </LegalSection>
      <LegalSection heading="2. Information we collect">
        <p>We may process:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Company registration details (name, email, phone, city, admin identity)</li>
          <li>Corporate KYC documents you upload (GST, PAN, incorporation, address proof, etc.)</li>
          <li>User accounts, roles, leads, forms, visits, verification work, and audit logs created in the CRM</li>
          <li>Technical data such as login timestamps and basic device/browser metadata required for security</li>
        </ul>
      </LegalSection>
      <LegalSection heading="3. How we use information">
        <p>
          Data is used to operate the CRM, verify company eligibility, provide package/module access, improve reliability
          and support, and meet legal or contractual obligations. Super Admins review corporate documents before
          activating a tenant.
        </p>
      </LegalSection>
      <LegalSection heading="4. Sharing">
        <p>
          We do not sell personal data. Information may be shared with infrastructure providers (hosting, storage) under
          confidentiality, or when required by law. Within a company, data is visible according to roles and Super Admin
          module entitlements.
        </p>
      </LegalSection>
      <LegalSection heading="5. Retention & security">
        <p>
          We retain account and operational data while your organization is active on the platform and for a reasonable
          period thereafter for backups and disputes. We apply access controls, authentication, and least-privilege
          module gating; no method of transmission is 100% secure.
        </p>
      </LegalSection>
      <LegalSection heading="6. Your choices">
        <p>
          Company Admins can manage users in their tenant. To request correction or deletion of registration data,
          contact the platform Super Admin. Field users should contact their company Admin first.
        </p>
      </LegalSection>
      <LegalSection heading="7. Updates">
        <p>
          We may update this policy; the &quot;Last updated&quot; date will change. Continued use after updates constitutes
          acceptance of the revised policy.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
