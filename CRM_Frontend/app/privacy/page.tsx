"use client";

import { LegalPage, LegalSection } from "@/components/legal-page";
import Link from "next/link";

const PRIVACY_EMAIL = "privacy@trackbook.co";
const GRIEVANCE_CONTACT = "Grievance Officer, Newish Technology";
const REGISTERED_OFFICE = "D-1012/13, Indira Nagar, Lucknow, Uttar Pradesh, 226016";
const DELETION_URL = "https://crm.trackbook.co/privacy#account-deletion";
const IN_APP_DELETE_PATH = "More → Account & Privacy → Delete my account";
const DELETION_DAYS = "30";

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="8 August 2026">
      <LegalSection heading="1. Who We Are">
        <p>
          Trackbook CRM (“Trackbook”, “we”, “our”, or “platform”) is operated by{" "}
          <strong>Newish Technology</strong>, having its registered office at {REGISTERED_OFFICE}.
        </p>
        <p>
          Trackbook provides multi-tenant sales CRM and field-team management software for businesses and their
          authorised users.
        </p>
        <p>
          This Privacy Policy explains how we collect, use, store, disclose, and protect personal information when you
          register a company, create or use an account, sign in to the platform, use our mobile application, or otherwise
          use Trackbook services.
        </p>
        <p>
          For privacy-related questions, requests, or complaints, you may contact us at{" "}
          <a className="font-semibold text-[#0B3D4A] underline" href={`mailto:${PRIVACY_EMAIL}`}>
            {PRIVACY_EMAIL}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection heading="2. Information We Collect">
        <p>
          Depending on the features used and the permissions granted to the application, we may process the following
          categories of information:
        </p>

        <h3 className="font-bold text-[#0B3D4A]">A. Company and Account Information</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>Company name and registration details</li>
          <li>Business email address and phone number</li>
          <li>City and business address</li>
          <li>Administrator identity and account details</li>
          <li>Username, login information and user role</li>
        </ul>

        <h3 className="font-bold text-[#0B3D4A]">B. Business and CRM Information</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>Leads and customer information entered by authorised users</li>
          <li>Forms, enquiries, sales activities and visit records</li>
          <li>Verification information and work-related records</li>
          <li>Notes, comments and other information entered by users</li>
          <li>Documents and files uploaded by users</li>
          <li>Audit and activity logs</li>
        </ul>

        <h3 className="font-bold text-[#0B3D4A]">C. Corporate KYC and Business Documents</h3>
        <p>
          Where required for company verification or onboarding, we may process documents submitted by authorised company
          representatives, including GST certificates, PAN, incorporation documents, address proof and other business KYC
          documents.
        </p>
        <p>
          Such information is used for company verification, account activation, compliance, security and related business
          purposes.
        </p>

        <h3 className="font-bold text-[#0B3D4A]">D. Device and Technical Information</h3>
        <p>We may collect technical information required to operate and secure the platform, including:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>IP address</li>
          <li>Login timestamps</li>
          <li>Device type</li>
          <li>Operating system</li>
          <li>Application version</li>
          <li>Browser information</li>
          <li>Device identifiers where required for security or application functionality</li>
          <li>Error and diagnostic information</li>
        </ul>

        <h3 className="font-bold text-[#0B3D4A]">E. Location Information</h3>
        <p>
          Where field-team, visit-management or location-based features are enabled and the required permission is
          granted, the Trackbook application may collect location information to record authorised business visits, field
          activities and related work records.
        </p>
        <p>
          <strong>Location access mode:</strong> Foreground only — collected only while the app is open and in active use
          (when such features are enabled and permission is granted).
        </p>
        <p>
          Where background location collection is enabled in a future release: (i) this will be limited to feature(s) that
          are core to the app&apos;s stated purpose and never used for advertising or analytics; (ii) we will display a
          clear, in-app disclosure — shown in the normal course of using the app, not only in a settings menu, app
          description, or on a website — describing what location data is collected, which specific feature uses it, and
          how, before the device permission prompt appears; and (iii) this will be declared separately to Google Play
          together with a demonstration of the feature, in addition to the disclosures in this Privacy Policy.
        </p>
        <p>
          Location information is used only for the legitimate business and operational purposes associated with the
          enabled Trackbook features described above, and is not used for advertising or sold to third parties.
        </p>
        <p>
          The application will request location permission where required by the relevant functionality. Users can manage
          available permissions through their device settings.
        </p>

        <h3 className="font-bold text-[#0B3D4A]">F. Camera, Photos and Files</h3>
        <p>
          Where required for specific CRM, document-upload or verification features, the application may request access
          to the device camera, photos or files.
        </p>
        <p>Such access may be used to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Capture photographs;</li>
          <li>Capture or upload documents;</li>
          <li>Upload business or KYC documents;</li>
          <li>Upload files required for CRM activities; or</li>
          <li>Complete other features specifically requiring image or file access.</li>
        </ul>
        <p>The application does not access these resources beyond what is reasonably required for the relevant feature.</p>

        <h3 className="font-bold text-[#0B3D4A]">G. Notifications</h3>
        <p>
          Where enabled, Trackbook may send notifications relating to account activity, workflows, assignments, CRM
          activities, service updates and other relevant platform functions.
        </p>
        <p>Users can manage notification permissions through their device settings.</p>

        <h3 className="font-bold text-[#0B3D4A]">H. Information Provided by Customer Organisations</h3>
        <p>
          Customer organisations may provide information relating to their employees, field personnel, customers, leads,
          business contacts or other individuals for use within their Trackbook tenant.
        </p>
        <p>
          Such information is processed to provide the services and functionality requested by the customer organisation.
        </p>
      </LegalSection>

      <LegalSection heading="3. How We Use Information">
        <p>We may use information to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Create and manage company and user accounts;</li>
          <li>Authenticate users and maintain account security;</li>
          <li>Verify company eligibility and corporate documentation;</li>
          <li>Provide CRM, sales and field-team management features;</li>
          <li>Record authorised business visits and field activities;</li>
          <li>Manage leads, forms, customer records and work-related information;</li>
          <li>Provide requested packages, modules and features;</li>
          <li>Provide customer support and troubleshoot technical issues;</li>
          <li>Maintain audit trails and monitor account activity;</li>
          <li>Prevent unauthorised access, misuse, fraud and security incidents;</li>
          <li>Maintain and improve the reliability, security and performance of the platform;</li>
          <li>Communicate service-related information;</li>
          <li>Comply with applicable legal, regulatory and contractual obligations; and</li>
          <li>Protect the rights, safety, security and property of Trackbook, our customers and users.</li>
        </ul>
        <p>
          We do not use personal information for purposes unrelated to the services described in this Privacy Policy
          unless permitted or required by applicable law or otherwise communicated to the relevant user.
        </p>
        <p>We do not share personal information with third parties for advertising or marketing purposes.</p>
      </LegalSection>

      <LegalSection heading="4. How We Share Information">
        <p>We do not sell personal information.</p>
        <p>
          Information may be disclosed where reasonably necessary to provide, secure or operate the services, including
          to:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Infrastructure, hosting and storage service providers;</li>
          <li>Technology, security and service providers acting on our behalf;</li>
          <li>Professional advisers and service providers where necessary;</li>
          <li>
            Customer organisations and their authorised administrators, where the information belongs to or is managed by
            that organisation;
          </li>
          <li>
            Government, regulatory, law-enforcement or other authorities where required or permitted by applicable law;
            or
          </li>
          <li>
            Other parties where disclosure is necessary to protect the rights, safety, security or property of Trackbook,
            our customers or users.
          </li>
        </ul>
        <p>
          Our service providers are expected to process information only for the purposes for which they are engaged and
          subject to appropriate contractual, confidentiality or security obligations.
        </p>
        <p>
          Within a customer organisation, information is accessible according to the roles, permissions and administrator
          controls configured for that organisation.
        </p>
      </LegalSection>

      <LegalSection heading="5. Customer Organisations and Their Users">
        <p>Trackbook operates as a multi-tenant business software platform.</p>
        <p>
          Customer organisations may determine what information they upload to Trackbook, how they use that information,
          and which users are authorised to access it.
        </p>
        <p>Customer organisations are responsible for:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Providing appropriate instructions for processing information;</li>
          <li>Ensuring that information uploaded to Trackbook is collected and used lawfully;</li>
          <li>Managing user accounts and access permissions;</li>
          <li>Ensuring that their users are authorised to access relevant information; and</li>
          <li>
            Complying with applicable privacy and data-protection requirements relating to information they provide to
            Trackbook.
          </li>
        </ul>
        <p>
          Trackbook processes customer-provided information to provide the services and functionality requested by the
          relevant customer organisation, subject to applicable agreements and law.
        </p>
      </LegalSection>

      <LegalSection heading="6. Data Retention and Deletion">
        <p>We retain information for as long as reasonably necessary to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Provide the services;</li>
          <li>Maintain business and operational records;</li>
          <li>Provide customer support;</li>
          <li>Comply with applicable legal or regulatory requirements;</li>
          <li>Fulfil contractual obligations;</li>
          <li>Resolve disputes;</li>
          <li>Enforce agreements; and</li>
          <li>Protect the security and integrity of the platform.</li>
        </ul>
        <p>
          When a customer organisation closes its account or requests deletion, information may be deleted or anonymised
          in accordance with the applicable agreement and our retention procedures.
        </p>
        <p>
          Certain information may be retained where required or permitted by applicable law, for legitimate business
          purposes, to resolve disputes, enforce agreements, prevent fraud or security incidents, or within secure backup
          systems for a limited period.
        </p>

        <h3 id="account-deletion" className="scroll-mt-24 font-bold text-[#0B3D4A]">
          Requesting Account or Data Deletion
        </h3>
        <p>
          Where the Trackbook mobile application allows a user to create an account, that user may request deletion of
          their account and associated personal information both:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            In-app, using the deletion option at: <strong>{IN_APP_DELETE_PATH}</strong>; and
          </li>
          <li>
            Outside the app, by submitting a request through our website at:{" "}
            <a className="font-semibold text-[#0B3D4A] underline" href={DELETION_URL}>
              {DELETION_URL}
            </a>
            .
          </li>
        </ul>
        <p>
          Users may also contact us directly at{" "}
          <a className="font-semibold text-[#0B3D4A] underline" href={`mailto:${PRIVACY_EMAIL}`}>
            {PRIVACY_EMAIL}
          </a>{" "}
          to request deletion.
        </p>
        <p>
          Temporary deactivation, disabling, or “freezing” of an account does not constitute deletion. Where we retain
          certain information after a deletion request for security, fraud-prevention, or legal/regulatory reasons, we
          will identify what is retained and for how long, either here or at the deletion request page above.
        </p>
        <p>
          Where information is managed by a customer organisation rather than by an individual account holder directly, we
          may direct the request to that organisation&apos;s administrator, or process it in accordance with our agreement
          with that organisation. We will complete deletion requests within <strong>{DELETION_DAYS} days</strong>, except
          where retention is required or permitted by applicable law.
        </p>
      </LegalSection>

      <LegalSection heading="7. Security">
        <p>
          We implement reasonable technical and organisational measures designed to protect personal information against
          unauthorised access, alteration, disclosure, loss or destruction.
        </p>
        <p>Depending on the applicable service and infrastructure, security measures may include:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Access controls;</li>
          <li>Authentication mechanisms;</li>
          <li>Role-based permissions;</li>
          <li>Least-privilege access;</li>
          <li>Tenant-level access restrictions;</li>
          <li>Audit and activity logging;</li>
          <li>Secure data transmission (data is encrypted in transit using industry-standard protocols such as TLS);</li>
          <li>System monitoring and security controls; and</li>
          <li>Backup and recovery measures.</li>
        </ul>
        <p>
          No method of electronic transmission or storage can be guaranteed to be completely secure. However, we take
          reasonable measures appropriate to the nature of the information and the services provided.
        </p>
      </LegalSection>

      <LegalSection heading="8. Your Privacy Choices and Rights">
        <p>
          Depending on applicable law, individuals may have rights relating to their personal information, including the
          right to request:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Access to personal information;</li>
          <li>Correction or updating of inaccurate information;</li>
          <li>Deletion of information where applicable;</li>
          <li>Information about how personal information is processed; and</li>
          <li>Withdrawal of consent where processing is based on consent.</li>
        </ul>
        <p>
          Where information is processed on behalf of a customer organisation, a privacy request may need to be submitted
          to that organisation or its authorised administrator because the organisation may determine the purpose and
          manner in which such information is processed.
        </p>
        <p>
          For information relating directly to a Trackbook account or information for which Trackbook is responsible, you
          may contact us at:{" "}
          <a className="font-semibold text-[#0B3D4A] underline" href={`mailto:${PRIVACY_EMAIL}`}>
            {PRIVACY_EMAIL}
          </a>
          .
        </p>
        <p>
          We may require reasonable verification of the identity of the requester before processing a privacy request.
        </p>
        <p>
          Withdrawal of consent will not affect processing that was lawfully carried out before the withdrawal or
          processing that is otherwise permitted or required by applicable law.
        </p>
      </LegalSection>

      <LegalSection heading="9. Mobile Application Permissions">
        <p>
          The Trackbook mobile application may request certain device permissions when required to provide specific
          features.
        </p>
        <p>These may include:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Location</strong> — Used for authorised field visits, field activity records and location-based
            functionality where such features are enabled. See Section 2E for details on foreground/background collection
            and the in-app disclosure shown before this permission is requested.
          </li>
          <li>
            <strong>Camera</strong> — Used to capture photographs or documents when required by an enabled feature.
          </li>
          <li>
            <strong>Photos and Files</strong> — Used to select and upload photographs, documents or other files required
            for CRM, verification or business activities.
          </li>
          <li>
            <strong>Notifications</strong> — Used to provide relevant account, workflow, assignment and service
            notifications.
          </li>
        </ul>
        <p>
          Permissions are requested only when required by the relevant functionality. Users can manage available
          permissions through their device settings.
        </p>
        <p>Disabling a permission may prevent the associated feature from functioning correctly.</p>
      </LegalSection>

      <LegalSection heading="10. Data Protection and Applicable Law">
        <p>We handle personal information in accordance with applicable privacy and data-protection laws and regulations.</p>
        <p>
          Where applicable to our processing activities, this includes the Digital Personal Data Protection Act, 2023
          (“DPDP Act”) and the Digital Personal Data Protection Rules, 2025, which were notified by the Ministry of
          Electronics and Information Technology on 14 November 2025 and are being brought into force in phases through
          2026 and 2027. As the DPDP framework and its associated rules continue to be operationalised, we will update
          our practices and this Privacy Policy as required to remain compliant.
        </p>
        <p>
          In line with the DPDP Act, where our processing of personal information is based on consent, we will provide
          clear notice describing the personal information collected and the purpose of processing, in itemised and plain
          language, before or at the time consent is sought, and consent may be withdrawn as described in Section 8.
        </p>
        <p>
          Our processing practices may vary depending on the nature of the information, the services being provided, the
          role of Trackbook and the requirements of the customer organisation.
        </p>
      </LegalSection>

      <LegalSection heading="11. Children's Privacy">
        <p>Trackbook is a business and workforce management service and is not directed towards children.</p>
        <p>
          We do not knowingly collect personal information from children where such collection is prohibited by applicable
          law.
        </p>
        <p>
          If you believe that information relating to a child has been provided to us improperly, please contact us using
          the contact details provided in this Privacy Policy.
        </p>
      </LegalSection>

      <LegalSection heading="12. Cookies and Similar Technologies">
        <p>
          Trackbook may use cookies, session technologies, analytics tools or similar technologies where necessary to
          operate, secure, maintain and improve our website or services.
        </p>
        <p>
          Such technologies may be used for purposes including authentication, session management, security, performance
          monitoring and service improvement.
        </p>
        <p>
          Where required by applicable law, we will provide appropriate notice or obtain consent for the use of such
          technologies.
        </p>
      </LegalSection>

      <LegalSection heading="13. Third-Party Services">
        <p>
          Trackbook may use third-party infrastructure, technology, hosting, storage, security, analytics, communication
          or other service providers to operate and support the platform.
        </p>
        <p>
          Such providers may process information on our behalf and are expected to maintain appropriate confidentiality
          and security measures.
        </p>
        <p>
          Where third-party services have their own privacy policies, their processing may also be subject to those
          policies.
        </p>
      </LegalSection>

      <LegalSection heading="14. Data Transfers">
        <p>Information may be processed or stored in locations where Trackbook or its service providers operate.</p>
        <p>
          Where information is transferred across jurisdictions, we will take reasonable steps to ensure that such
          processing is carried out in accordance with applicable law and appropriate contractual or organisational
          safeguards.
        </p>
      </LegalSection>

      <LegalSection heading="15. Privacy and Grievance Contact">
        <p>For privacy-related questions, complaints, requests or concerns, please contact:</p>
        <ul className="list-none space-y-1 pl-0">
          <li>
            <strong>Privacy / Grievance Contact:</strong> {GRIEVANCE_CONTACT}
          </li>
          <li>
            <strong>Email:</strong>{" "}
            <a className="font-semibold text-[#0B3D4A] underline" href={`mailto:${PRIVACY_EMAIL}`}>
              {PRIVACY_EMAIL}
            </a>
          </li>
          <li>
            <strong>Registered Office:</strong> {REGISTERED_OFFICE}
          </li>
        </ul>
        <p>We will review and address privacy-related requests and complaints in accordance with applicable law.</p>
        <p className="text-sm text-[#14212B]/60">
          Prefer email? Write to us from your registered company email, or{" "}
          <Link href="/login" className="font-semibold text-[#0B3D4A] underline">
            sign in
          </Link>{" "}
          and ask your organisation Admin / Super Admin to escalate.
        </p>
      </LegalSection>

      <LegalSection heading="16. Changes to This Privacy Policy">
        <p>
          We may update this Privacy Policy from time to time to reflect changes to our services, technology, legal
          requirements or data-processing practices.
        </p>
        <p>
          When we make changes, we will publish the updated Privacy Policy on this page and update the “Last updated”
          date.
        </p>
        <p>
          Where required by applicable law, we may provide additional notice or obtain consent for material changes.
        </p>
        <p>
          Your continued use of the services after an updated Privacy Policy becomes effective will be subject to the
          revised policy, to the extent permitted by applicable law.
        </p>
        <p className="text-sm text-[#14212B]/55">Last updated: 8 August 2026</p>
      </LegalSection>
    </LegalPage>
  );
}
