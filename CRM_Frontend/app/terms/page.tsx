"use client";

import { LegalPage, LegalSection } from "@/components/legal-page";

export default function TermsPage() {
  return (
    <LegalPage title="Terms & Conditions" updated="3 August 2026">
      <LegalSection heading="1. Acceptance">
        <p>
          By registering a company or signing in to Trackbook CRM, you agree to these Terms, the Privacy Policy, and
          applicable Disclaimers. If you do not agree, do not use the platform.
        </p>
      </LegalSection>
      <LegalSection heading="2. Registration & verification">
        <p>
          New companies must submit accurate details and corporate documents. Access remains blocked until Super Admin
          verifies documents and approves the tenant (trial or paid). Providing false documents is grounds for rejection
          or suspension.
        </p>
      </LegalSection>
      <LegalSection heading="3. Accounts & roles">
        <p>
          You are responsible for credentials issued to your users. Company Admins manage internal users and role page
          permissions within the modules granted by Super Admin packages.
        </p>
      </LegalSection>
      <LegalSection heading="4. Subscriptions & trials">
        <p>
          Features depend on the package assigned by Super Admin. Trials (typically 15 days, adjustable by Super Admin)
          may be limited. Paid access unlocks after Super Admin records successful payment. Fees, if any, are as agreed
          commercially with the platform operator.
        </p>
      </LegalSection>
      <LegalSection heading="5. Acceptable use">
        <p>
          You may not misuse the CRM for unlawful activity, abuse other tenants, attempt to bypass module gates, or
          overload the service. We may suspend accounts that violate these Terms.
        </p>
      </LegalSection>
      <LegalSection heading="6. Data ownership">
        <p>
          Your company retains ownership of business data you enter. You grant us a license to host and process that data
          solely to provide the service. Platform branding and software remain our intellectual property.
        </p>
      </LegalSection>
      <LegalSection heading="7. Availability">
        <p>
          We aim for reliable uptime but do not guarantee uninterrupted service. Maintenance windows and third-party
          outages may occur.
        </p>
      </LegalSection>
      <LegalSection heading="8. Termination">
        <p>
          Super Admin may suspend or reject tenants for non-payment, document issues, or Terms violations. You may stop
          using the service and request offboarding through your Super Admin contact.
        </p>
      </LegalSection>
      <LegalSection heading="9. Governing terms">
        <p>
          These Terms are governed by the laws applicable to the platform operator&apos;s jurisdiction in India, unless
          a signed enterprise agreement states otherwise.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
