"use client";

import { LegalPage, LegalSection } from "@/components/legal-page";

export default function DisclaimerPage() {
  return (
    <LegalPage title="Disclaimers" updated="3 August 2026">
      <LegalSection heading="1. General information">
        <p>
          Trackbook CRM is a software tool for sales operations. Content on marketing pages is informational and does not
          constitute legal, financial, or compliance advice.
        </p>
      </LegalSection>
      <LegalSection heading="2. No guarantee of business outcomes">
        <p>
          Using the CRM does not guarantee lead conversion, revenue, or regulatory compliance for your industry. Results
          depend on your teams, data quality, and processes.
        </p>
      </LegalSection>
      <LegalSection heading="3. Document verification">
        <p>
          Super Admin review of corporate documents is an access-control step for the platform. It is not a government
          KYC certification or a substitute for your own statutory compliance.
        </p>
      </LegalSection>
      <LegalSection heading="4. Third-party services">
        <p>
          Integrations (for example HRMS) and external media (images, animations) may be provided by third parties. We
          are not responsible for their availability or policies.
        </p>
      </LegalSection>
      <LegalSection heading="5. Limitation of liability">
        <p>
          To the maximum extent permitted by law, the platform and its operators are not liable for indirect, incidental,
          or consequential damages arising from use or inability to use the CRM, including data loss or business
          interruption.
        </p>
      </LegalSection>
      <LegalSection heading="6. Contact">
        <p>
          For clarification on these disclaimers, contact the platform Super Admin associated with your deployment.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
