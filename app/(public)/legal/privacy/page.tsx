/* eslint-disable react/no-unescaped-entities */
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How TradeLynq collects, uses, and protects your personal information under the Trinidad and Tobago Data Protection Act 2011.',
}

export default function PrivacyPolicyPage() {
  return (
    <>
      <h2 className="text-brand-slate mt-0 text-2xl font-bold">Privacy Policy</h2>
      <p className="text-muted text-sm">Effective date: 25 February 2026 · Version 2.0</p>

      {/* ------------------------------------------------------------------ */}
      {/* 1. Who We Are                                                      */}
      {/* ------------------------------------------------------------------ */}
      <h3 id="who-we-are">1. Who We Are</h3>
      <p>
        TradeLynq ("<strong>TradeLynq</strong>", "<strong>we</strong>", "<strong>us</strong>", "
        <strong>our</strong>") is an online professional services marketplace registered and
        operating from Port of Spain, Republic of Trinidad and Tobago. Our website is located at{' '}
        <strong>tradelynq.tech</strong>.
      </p>
      <p>
        TradeLynq acts exclusively as a <strong>platform facilitator</strong>. We provide the
        technology that enables Clients to discover, evaluate, and contact Professionals. We are
        <strong> not</strong> a party to any transaction, agreement, or service engagement between a
        Client and a Professional. All service arrangements, pricing, quality guarantees, and
        dispute resolution regarding the services rendered are solely between the Client and the
        Professional.
      </p>
      <p>
        This Privacy Policy explains how we collect, use, store, share, and protect Personal Data
        when you access or use the TradeLynq platform, including our website and any associated
        applications or communications channels.
      </p>

      {/* ------------------------------------------------------------------ */}
      {/* 2. Definitions                                                     */}
      {/* ------------------------------------------------------------------ */}
      <h3 id="definitions">2. Definitions</h3>
      <p>In this Privacy Policy the following terms have the meanings set out below:</p>
      <ul>
        <li>
          <strong>"Platform"</strong> means the TradeLynq website at tradelynq.tech, any mobile
          applications, APIs, and all related services and communications channels operated by
          TradeLynq.
        </li>
        <li>
          <strong>"Professional"</strong> means a registered user who offers professional services
          through the Platform, including but not limited to beauty, trades, creative, health,
          events, education, and technology services.
        </li>
        <li>
          <strong>"Client"</strong> means a registered or unregistered user who uses the Platform to
          browse, search for, or contact Professionals.
        </li>
        <li>
          <strong>"User"</strong> means any individual who accesses or uses the Platform, whether as
          a Professional, Client, or visitor.
        </li>
        <li>
          <strong>"Personal Data"</strong> means any information relating to an identified or
          identifiable natural person, as defined by the Data Protection Act, Chapter 22:04 of the
          Laws of Trinidad and Tobago.
        </li>
        <li>
          <strong>"Processing"</strong> means any operation or set of operations performed on
          Personal Data, including collection, recording, organisation, structuring, storage,
          adaptation, retrieval, consultation, use, disclosure, dissemination, restriction, erasure,
          or destruction.
        </li>
        <li>
          <strong>"Data Processor"</strong> means a third-party vendor that processes Personal Data
          on behalf of TradeLynq, subject to our instructions and contractual obligations.
        </li>
        <li>
          <strong>"Payment Processor"</strong> means WiPay Limited and/or First Atlantic Commerce
          Ltd., which handle all payment card processing on behalf of TradeLynq.
        </li>
      </ul>

      {/* ------------------------------------------------------------------ */}
      {/* 3. Legal Basis for Processing                                      */}
      {/* ------------------------------------------------------------------ */}
      <h3 id="legal-basis">3. Legal Basis for Processing</h3>
      <p>
        We process Personal Data in accordance with the{' '}
        <strong>Data Protection Act, Chapter 22:04 of the Laws of Trinidad and Tobago</strong> (the
        "<strong>DPA</strong>"), as well as internationally recognised data-protection principles.
        Our lawful bases for processing are:
      </p>
      <ul>
        <li>
          <strong>Consent:</strong> where you have given clear, informed consent for us to process
          your Personal Data for specific purposes (e.g., marketing communications, optional
          analytics cookies). You may withdraw consent at any time without affecting the lawfulness
          of processing carried out before withdrawal.
        </li>
        <li>
          <strong>Contractual necessity:</strong> where processing is necessary to perform our
          obligations under the Terms of Service you accepted when creating an account, including
          account management, subscription billing, enquiry routing, and service delivery.
        </li>
        <li>
          <strong>Legal obligation:</strong> where processing is required to comply with applicable
          laws, regulations, court orders, or lawful government requests under the laws of Trinidad
          and Tobago, including tax record-keeping requirements of the Board of Inland Revenue.
        </li>
        <li>
          <strong>Legitimate interests:</strong> where processing is necessary for our legitimate
          business interests, provided those interests are not overridden by your rights and
          freedoms. These interests include fraud prevention, platform security, service
          improvement, and analytics.
        </li>
      </ul>
      <p>
        By using the Platform you acknowledge that you have read and understood this Privacy Policy.
        Where consent is the legal basis, we will obtain your explicit consent before commencing
        processing.
      </p>

      {/* ------------------------------------------------------------------ */}
      {/* 4. Information We Collect                                          */}
      {/* ------------------------------------------------------------------ */}
      <h3 id="information-we-collect">4. Information We Collect</h3>

      <h4>4.1 Account Information</h4>
      <p>When you create a TradeLynq account we collect:</p>
      <ul>
        <li>Full name</li>
        <li>Email address</li>
        <li>Phone number (mobile)</li>
        <li>Account role (Professional or Client)</li>
        <li>Authentication credentials (password hash — we never store plaintext passwords)</li>
      </ul>

      <h4>4.2 Professional Profile Information</h4>
      <p>If you register as a Professional we additionally collect:</p>
      <ul>
        <li>Business or trading name</li>
        <li>Service category and sub-categories</li>
        <li>Service areas and locations within Trinidad and Tobago</li>
        <li>Professional biography and description of services</li>
        <li>Portfolio images and media</li>
        <li>Years of experience and qualifications</li>
        <li>Subscription plan and billing cycle</li>
      </ul>

      <h4>4.3 Usage and Activity Data</h4>
      <ul>
        <li>
          <strong>Activity logs:</strong> logins, profile views, search queries, enquiry
          submissions, and other interactions with the Platform. IP addresses are stored as{' '}
          <strong>one-way SHA-256 hashes</strong> — we cannot reverse these to obtain your raw IP
          address.
        </li>
        <li>
          <strong>Enquiries and communications:</strong> job descriptions, preferred dates, contact
          preferences, and messages exchanged through the Platform's enquiry system.
        </li>
        <li>
          <strong>Reviews and testimonials:</strong> star ratings, written reviews, and any
          responses submitted by Professionals.
        </li>
        <li>
          <strong>Support communications:</strong> messages you send to us via WhatsApp, email, or
          any other support channel.
        </li>
      </ul>

      <h4>4.4 Device and Technical Data</h4>
      <ul>
        <li>Browser type and version</li>
        <li>Operating system</li>
        <li>Referring URL and landing page</li>
        <li>Pages visited and time spent on each page</li>
        <li>Screen resolution and device type (desktop, mobile, tablet)</li>
        <li>Language preference</li>
      </ul>

      <h4>4.5 Payment Metadata</h4>
      <p>
        We collect and store payment <strong>metadata only</strong>, which may include:
      </p>
      <ul>
        <li>Transaction reference numbers</li>
        <li>Payment date and time</li>
        <li>Payment amount (in TTD)</li>
        <li>Payment status (successful, failed, pending, refunded)</li>
        <li>
          Last four digits of the payment card (as provided by the Payment Processor for receipt
          purposes)
        </li>
        <li>Billing name (if different from account name)</li>
      </ul>
      <p>
        <strong>
          We do not collect, process, store, or have access to full payment card numbers, CVV/CVC
          codes, or bank account details.
        </strong>{' '}
        All payment card processing is handled entirely by our Payment Processors (see Section 6).
      </p>

      {/* ------------------------------------------------------------------ */}
      {/* 5. How We Use Your Information                                     */}
      {/* ------------------------------------------------------------------ */}
      <h3 id="how-we-use-info">5. How We Use Your Information</h3>
      <p>We process your Personal Data for the following purposes:</p>
      <ul>
        <li>
          <strong>Service delivery and platform operation:</strong> matching Clients with
          Professionals, processing and routing enquiries, managing bookings, and sending
          transactional notifications related to your use of the Platform.
        </li>
        <li>
          <strong>Account management:</strong> creating and maintaining your account, authenticating
          your identity, managing your subscription, and processing payments.
        </li>
        <li>
          <strong>Identity verification:</strong> confirming that accounts belong to real persons in
          Trinidad and Tobago and that Professionals meet our registration requirements.
        </li>
        <li>
          <strong>Communications:</strong> transactional messages via email (powered by Resend) and
          WhatsApp Business API (powered by Meta Platforms). Marketing and promotional
          communications are sent <strong>only</strong> where you have provided explicit opt-in
          consent, and you may withdraw that consent at any time.
        </li>
        <li>
          <strong>Trust, safety, and fraud prevention:</strong> detecting and preventing fraudulent
          activity, enforcing our Terms of Service and Community Standards, investigating potential
          violations, and resolving disputes.
        </li>
        <li>
          <strong>Payment processing and financial record-keeping:</strong> processing subscription
          fees, generating receipts and invoices, maintaining transaction records as required by
          applicable tax and financial legislation.
        </li>
        <li>
          <strong>Platform improvement and analytics:</strong> analysing anonymised and aggregated
          usage data to improve search relevance, user experience, feature development, and overall
          Platform performance. Individual users are not identified in aggregated analytics.
        </li>
        <li>
          <strong>Legal compliance:</strong> complying with applicable laws, regulations, and lawful
          government requests, including tax reporting obligations to the Board of Inland Revenue,
          responses to court orders, and regulatory reporting.
        </li>
        <li>
          <strong>Customer support:</strong> responding to your enquiries, troubleshooting issues,
          and providing technical assistance through our support channels.
        </li>
        <li>
          <strong>Protecting rights and interests:</strong> establishing, exercising, or defending
          legal claims and protecting the rights, property, and safety of TradeLynq, our Users, and
          the public.
        </li>
      </ul>

      {/* ------------------------------------------------------------------ */}
      {/* 6. Information We Do NOT Collect                                   */}
      {/* ------------------------------------------------------------------ */}
      <h3 id="info-we-do-not-collect">6. Information We Do NOT Collect</h3>
      <p>
        TradeLynq does <strong>not</strong> collect, process, or store the following categories of
        information:
      </p>
      <ul>
        <li>
          <strong>Payment card numbers:</strong> full credit card or debit card numbers are never
          transmitted to, processed by, or stored on TradeLynq servers. All payment card processing
          is handled exclusively by our Payment Processors — <strong>WiPay Limited</strong> and{' '}
          <strong>First Atlantic Commerce Ltd.</strong> (via Republic Bank) — under their own PCI
          DSS-compliant security environments.
        </li>
        <li>
          <strong>CVV/CVC security codes:</strong> card verification values are never collected or
          transmitted to TradeLynq.
        </li>
        <li>
          <strong>Bank account details:</strong> bank account numbers, sort codes, and routing
          numbers are not collected by TradeLynq.
        </li>
        <li>
          <strong>Government-issued identification numbers:</strong> we do not collect national
          identification card numbers, passport numbers, driver's permit numbers, or tax
          identification numbers through the Platform.
        </li>
        <li>
          <strong>Biometric data:</strong> we do not collect fingerprints, facial recognition data,
          or other biometric identifiers.
        </li>
        <li>
          <strong>Precise geolocation:</strong> we do not collect GPS coordinates or precise
          real-time location data. Service areas are provided voluntarily by Professionals as
          general locality descriptions.
        </li>
      </ul>
      <p>
        If you believe any of the above data categories have been inadvertently collected, contact
        us immediately at <strong>support@tradelynq.tech</strong>.
      </p>

      {/* ------------------------------------------------------------------ */}
      {/* 7. Sharing and Disclosure                                          */}
      {/* ------------------------------------------------------------------ */}
      <h3 id="sharing-and-disclosure">7. Sharing and Disclosure</h3>
      <p>
        <strong>We do not sell, rent, or trade your Personal Data.</strong> We share Personal Data
        only in the following limited circumstances:
      </p>

      <h4>7.1 With Other Users</h4>
      <p>
        Professional profile information — including name, business name, biography, service
        categories, service areas, portfolio, and reviews — is publicly visible on the Platform.
        Client names appear on reviews they submit. Contact details are shared between a Client and
        a Professional only when an enquiry is initiated.
      </p>

      <h4>7.2 With Vendors (Data Processors)</h4>
      <p>
        We engage trusted third-party vendors who process Personal Data on our behalf, subject to
        contractual obligations of confidentiality and data protection. These providers include:
      </p>
      <ul>
        <li>
          <strong>Supabase Inc.</strong> — database hosting, authentication, and data storage
        </li>
        <li>
          <strong>Vercel Inc.</strong> — web application hosting, content delivery network, and edge
          computing
        </li>
        <li>
          <strong>Resend Inc.</strong> — transactional and service-related email delivery
        </li>
        <li>
          <strong>Meta Platforms Inc.</strong> — WhatsApp Business API for notifications and
          customer support communications
        </li>
        <li>
          <strong>WiPay Limited</strong> — payment processing (Phase 1)
        </li>
        <li>
          <strong>First Atlantic Commerce Ltd.</strong> (via Republic Bank) — payment processing
          (Phase 2)
        </li>
      </ul>
      <p>
        Each Data Processor is contractually prohibited from using your Personal Data for any
        purpose other than providing services to TradeLynq and is required to maintain appropriate
        security measures.
      </p>

      <h4>7.3 For Legal Obligations</h4>
      <p>We may disclose Personal Data where required or permitted by law, including:</p>
      <ul>
        <li>In response to valid legal process, court orders, or subpoenas</li>
        <li>
          To comply with requests from law enforcement or regulatory authorities in Trinidad and
          Tobago
        </li>
        <li>To comply with tax reporting obligations to the Board of Inland Revenue</li>
        <li>To protect the rights, property, or safety of TradeLynq, our Users, or the public</li>
        <li>To detect, prevent, or address fraud, security, or technical issues</li>
      </ul>

      <h4>7.4 Business Transfers</h4>
      <p>
        In the event of a merger, acquisition, reorganisation, asset sale, or insolvency proceeding,
        Personal Data may be transferred to the successor entity, provided the successor agrees to
        be bound by privacy protections no less protective than those set out in this Privacy
        Policy. We will provide notice of any such transfer as required by applicable law.
      </p>

      <h4>7.5 With Your Consent</h4>
      <p>
        We may share your Personal Data for purposes not described in this Privacy Policy where we
        have obtained your explicit prior consent.
      </p>

      {/* ------------------------------------------------------------------ */}
      {/* 8. Data Retention                                                  */}
      {/* ------------------------------------------------------------------ */}
      <h3 id="data-retention">8. Data Retention</h3>
      <p>
        We retain Personal Data only for as long as necessary to fulfil the purposes for which it
        was collected, or as required by applicable law. Our retention periods are as follows:
      </p>
      <ul>
        <li>
          <strong>Active account data:</strong> retained for as long as your account remains open
          and active on the Platform.
        </li>
        <li>
          <strong>Closed or deleted account data:</strong> following account deletion, we retain a
          minimal set of records (transaction history, tax-relevant records, and dispute-related
          data) for <strong>7 years</strong> to comply with tax and financial record-keeping
          requirements under the laws of Trinidad and Tobago, and to support the resolution of any
          outstanding disputes or legal claims.
        </li>
        <li>
          <strong>Payment records:</strong> retained for <strong>7 years</strong> as required by the
          Board of Inland Revenue and applicable financial regulations.
        </li>
        <li>
          <strong>Activity logs:</strong> retained for <strong>24 months</strong> from the date of
          the activity, then automatically purged.
        </li>
        <li>
          <strong>Support communications:</strong> retained for <strong>3 years</strong> from the
          date of the last communication in the thread.
        </li>
        <li>
          <strong>Reviews and testimonials:</strong> retained for the lifetime of the Professional's
          account. If the Professional's account is deleted, reviews are anonymised but may be
          retained in aggregated form.
        </li>
      </ul>
      <p>
        When retention periods expire, Personal Data is securely deleted or irreversibly anonymised.
        Where anonymised data is retained for statistical purposes, it cannot be used to identify
        any individual.
      </p>

      {/* ------------------------------------------------------------------ */}
      {/* 9. Your Rights                                                     */}
      {/* ------------------------------------------------------------------ */}
      <h3 id="your-rights">9. Your Rights</h3>
      <p>
        Under the DPA and internationally recognised data-protection principles, you have the
        following rights with respect to your Personal Data:
      </p>
      <ul>
        <li>
          <strong>Right of access:</strong> you may request a copy of the Personal Data we hold
          about you, together with information about how it is being processed.
        </li>
        <li>
          <strong>Right to correction:</strong> you may request that we correct or update any
          inaccurate or incomplete Personal Data.
        </li>
        <li>
          <strong>Right to deletion:</strong> you may request that we delete your Personal Data,
          subject to our legal retention obligations as described in Section 8. Where deletion is
          not possible due to legal requirements, we will restrict processing to the minimum
          necessary for compliance purposes.
        </li>
        <li>
          <strong>Right to data portability:</strong> you may request an export of your Personal
          Data in a structured, commonly used, machine-readable format (JSON or CSV).
        </li>
        <li>
          <strong>Right to object:</strong> you may object to the processing of your Personal Data
          for marketing purposes at any time. You may also object to processing based on legitimate
          interests, and we will cease processing unless we demonstrate compelling legitimate
          grounds that override your rights.
        </li>
        <li>
          <strong>Right to withdraw consent:</strong> where processing is based on consent, you may
          withdraw your consent at any time. Withdrawal does not affect the lawfulness of processing
          carried out before withdrawal.
        </li>
        <li>
          <strong>Right to restrict processing:</strong> you may request that we temporarily
          restrict processing of your Personal Data while we verify its accuracy or assess an
          objection.
        </li>
      </ul>
      <p>
        To exercise any of these rights, contact us at <strong>support@tradelynq.tech</strong> or
        message us on WhatsApp at <strong>+1 (868) 708-9214</strong>. We will acknowledge your
        request within <strong>5 business days</strong> and provide a substantive response within{' '}
        <strong>30 calendar days</strong>. If your request is complex or we receive a large number
        of requests, we may extend this period by an additional 30 days with notice to you.
      </p>
      <p>
        We may ask you to verify your identity before processing your request to ensure that
        Personal Data is not disclosed to unauthorised persons.
      </p>

      {/* ------------------------------------------------------------------ */}
      {/* 10. Cookies and Tracking                                           */}
      {/* ------------------------------------------------------------------ */}
      <h3 id="cookies-and-tracking">10. Cookies and Tracking</h3>

      <h4>10.1 Essential Cookies</h4>
      <p>
        We use <strong>strictly necessary cookies by default</strong>. These include session tokens
        required for authentication and security. These cookies are essential for the Platform to
        function and cannot be disabled without breaking core functionality.
      </p>

      <h4>10.2 Analytics Cookies</h4>
      <p>
        We may use analytics cookies to understand how Users interact with the Platform and to
        improve our services. Analytics cookies are <strong>opt-in only</strong> — they are not set
        unless you explicitly grant consent through our cookie preference controls. You may change
        your preference at any time.
      </p>

      <h4>10.3 What We Do NOT Use</h4>
      <ul>
        <li>We do not use third-party advertising or tracking cookies.</li>
        <li>We do not participate in cross-site tracking or retargeting networks.</li>
        <li>We do not sell cookie data or browsing behaviour to any third party.</li>
      </ul>
      <p>
        You may clear cookies at any time through your browser settings. Note that clearing
        essential cookies will require you to log in again.
      </p>

      {/* ------------------------------------------------------------------ */}
      {/* 11. Third-Party Services                                           */}
      {/* ------------------------------------------------------------------ */}
      <h3 id="third-party-services">11. Third-Party Services</h3>
      <p>
        The Platform relies on trusted third-party services for hosting, data storage,
        communication, and payment processing. Each provider operates under its own privacy policy
        and data-protection practices. We encourage you to review their policies:
      </p>
      <ul>
        <li>
          <strong>Supabase Inc.</strong> (database and authentication) —{' '}
          <a
            href="https://supabase.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-cyan underline"
          >
            supabase.com/privacy
          </a>
        </li>
        <li>
          <strong>Vercel Inc.</strong> (hosting and CDN) —{' '}
          <a
            href="https://vercel.com/legal/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-cyan underline"
          >
            vercel.com/legal/privacy-policy
          </a>
        </li>
        <li>
          <strong>Resend Inc.</strong> (transactional email) —{' '}
          <a
            href="https://resend.com/legal/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-cyan underline"
          >
            resend.com/legal/privacy-policy
          </a>
        </li>
        <li>
          <strong>WiPay Limited</strong> (payment processing) —{' '}
          <a
            href="https://wipayfinancial.com/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-cyan underline"
          >
            wipayfinancial.com/privacy-policy
          </a>
        </li>
        <li>
          <strong>First Atlantic Commerce Ltd.</strong> (payment processing) —{' '}
          <a
            href="https://firstatlanticcommerce.com/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-cyan underline"
          >
            firstatlanticcommerce.com/privacy-policy
          </a>
        </li>
        <li>
          <strong>Meta Platforms Inc.</strong> (WhatsApp Business API) —{' '}
          <a
            href="https://www.whatsapp.com/legal/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-cyan underline"
          >
            whatsapp.com/legal/privacy-policy
          </a>
        </li>
      </ul>
      <p>
        TradeLynq is not responsible for the privacy practices of third-party services. Your use of
        these services is governed by their respective terms and privacy policies.
      </p>

      {/* ------------------------------------------------------------------ */}
      {/* 12. International Data Transfers                                   */}
      {/* ------------------------------------------------------------------ */}
      <h3 id="international-transfers">12. International Data Transfers</h3>
      <p>
        TradeLynq operates from Trinidad and Tobago. However, our infrastructure providers —
        including Supabase and Vercel — host data on servers located in the{' '}
        <strong>United States</strong> and other jurisdictions outside Trinidad and Tobago.
      </p>
      <p>
        When your Personal Data is transferred outside Trinidad and Tobago, we ensure that adequate
        safeguards are in place, including:
      </p>
      <ul>
        <li>
          <strong>Contractual protections:</strong> our agreements with Data Processors include
          data-protection clauses requiring them to protect your Personal Data to standards no less
          protective than those required by the DPA.
        </li>
        <li>
          <strong>Encryption in transit:</strong> all data transmitted between your device and our
          servers, and between our servers and third-party services, is encrypted using TLS 1.2 or
          higher.
        </li>
        <li>
          <strong>Encryption at rest:</strong> Personal Data stored by our infrastructure providers
          is encrypted at rest using AES-256 or equivalent industry-standard encryption.
        </li>
        <li>
          <strong>Access controls:</strong> access to Personal Data is restricted to authorised
          personnel and systems on a strict need-to-know basis.
        </li>
      </ul>
      <p>
        By using the Platform, you acknowledge and consent to the transfer of your Personal Data to
        jurisdictions outside Trinidad and Tobago for the purposes described in this Privacy Policy,
        subject to the safeguards described above.
      </p>

      {/* ------------------------------------------------------------------ */}
      {/* 13. Data Security                                                  */}
      {/* ------------------------------------------------------------------ */}
      <h3 id="data-security">13. Data Security</h3>
      <p>
        We implement industry-standard technical and organisational measures to protect your
        Personal Data against unauthorised access, alteration, disclosure, or destruction. These
        measures include:
      </p>
      <ul>
        <li>
          <strong>TLS encryption in transit:</strong> all communications between your browser and
          the Platform are encrypted using Transport Layer Security (TLS 1.2+).
        </li>
        <li>
          <strong>AES-256 encryption at rest:</strong> Personal Data stored in our database is
          encrypted at rest via Supabase's infrastructure.
        </li>
        <li>
          <strong>Row-level security (RLS):</strong> database-level access policies ensure that
          Users can only access data they are authorised to view. Every database query is subject to
          RLS enforcement.
        </li>
        <li>
          <strong>Hashed IP storage:</strong> IP addresses are stored as irreversible SHA-256
          hashes, preventing reconstruction of raw IP addresses.
        </li>
        <li>
          <strong>Password hashing:</strong> passwords are hashed using bcrypt with appropriate work
          factors. Plaintext passwords are never stored.
        </li>
        <li>
          <strong>Rate limiting:</strong> API endpoints are protected by rate limiting to mitigate
          brute-force and denial-of-service attacks.
        </li>
        <li>
          <strong>Access controls:</strong> administrative access to production systems is
          restricted to authorised personnel, protected by multi-factor authentication, and logged
          for audit purposes.
        </li>
        <li>
          <strong>Periodic security reviews:</strong> we conduct regular security assessments of our
          platform, infrastructure, and third-party integrations.
        </li>
      </ul>
      <p>
        <strong>
          No method of transmission over the internet or electronic storage is 100% secure.
        </strong>{' '}
        While we strive to protect your Personal Data, we cannot guarantee absolute security. In the
        event of a data breach that affects your Personal Data, we will notify affected Users and
        the relevant authorities in accordance with applicable law.
      </p>
      <p>
        <strong>Limitation of liability:</strong> to the maximum extent permitted by law,
        TradeLynq's total liability for any data breach or unauthorised disclosure of Personal Data
        shall not exceed the total fees paid by the affected User to TradeLynq in the{' '}
        <strong>twelve (12) months</strong> immediately preceding the date of the breach. This
        limitation applies whether the claim is based in contract, tort (including negligence),
        statute, or any other legal theory.
      </p>
      <p>
        If you believe your account has been compromised, contact us immediately at{' '}
        <strong>support@tradelynq.tech</strong>.
      </p>

      {/* ------------------------------------------------------------------ */}
      {/* 14. Children's Privacy                                             */}
      {/* ------------------------------------------------------------------ */}
      <h3 id="childrens-privacy">14. Children's Privacy</h3>
      <p>
        TradeLynq is intended for Users aged <strong>18 years and over</strong>. We do not knowingly
        collect, solicit, or process Personal Data from individuals under the age of 18.
      </p>
      <p>
        If you are a parent or guardian and believe that a minor under 18 has created an account or
        provided Personal Data to TradeLynq, please contact us immediately at{' '}
        <strong>support@tradelynq.tech</strong>. We will take prompt steps to delete the minor's
        account and associated Personal Data.
      </p>
      <p>
        If we become aware that we have collected Personal Data from a minor without appropriate
        parental or guardian consent, we will delete such data without undue delay.
      </p>

      {/* ------------------------------------------------------------------ */}
      {/* 15. Changes to This Policy and Contact                             */}
      {/* ------------------------------------------------------------------ */}
      <h3 id="changes-and-contact">15. Changes to This Policy and Contact</h3>

      <h4>15.1 Changes</h4>
      <p>
        We may update this Privacy Policy from time to time to reflect changes in our practices, the
        Platform, or applicable law. When we make material changes, we will:
      </p>
      <ul>
        <li>
          Provide at least <strong>30 days' advance notice</strong> via email to the address
          associated with your account and via a prominent notice on the Platform.
        </li>
        <li>Update the "Effective date" and "Version" number at the top of this page.</li>
        <li>
          Publish the updated policy on the Platform at least 30 days before the changes take
          effect.
        </li>
      </ul>
      <p>
        Your continued use of the Platform after the effective date of the updated policy
        constitutes acceptance of the changes. If you do not agree with the updated policy, you
        should discontinue use of the Platform and request deletion of your account.
      </p>

      <h4>15.2 Contact</h4>
      <p>
        If you have any questions, concerns, or complaints about this Privacy Policy or our
        data-protection practices, or if you wish to exercise any of your rights under Section 9,
        please contact us:
      </p>
      <p>
        <strong>TradeLynq Privacy Team</strong>
        <br />
        Email:{' '}
        <a href="mailto:support@tradelynq.tech" className="text-brand-cyan underline">
          support@tradelynq.tech
        </a>
        <br />
        WhatsApp:{' '}
        <a
          href="https://wa.me/18687089214"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-cyan underline"
        >
          +1 (868) 708-9214
        </a>
        <br />
        Port of Spain, Republic of Trinidad and Tobago
      </p>
      <p>
        We aim to resolve all privacy-related enquiries within <strong>30 calendar days</strong>. If
        you are not satisfied with our response, you have the right to lodge a complaint with the
        Office of the Information Commissioner of Trinidad and Tobago.
      </p>
    </>
  )
}
