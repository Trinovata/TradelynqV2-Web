/* eslint-disable react/no-unescaped-entities */
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'User Agreement',
  description:
    'The End User Licence Agreement covering use of the TradeLynq platform, app, and associated software.',
}

export default function EulaPage() {
  return (
    <>
      <h2 className="text-brand-slate mt-0 text-2xl font-bold">User Agreement (EULA)</h2>
      <p className="text-muted text-sm">Effective date: 25 February 2026 · Version 1.1</p>

      <p>
        This End User Licence Agreement ("<strong>Agreement</strong>") is a legal contract between
        you and TradeLynq governing your access to and use of the TradeLynq software platform,
        website, and any future mobile applications (collectively, the "<strong>Software</strong>").
        This Agreement supplements our Terms of Service, which continue to apply.
      </p>
      <p>
        By accessing or using the Software, you confirm that you have read, understood, and agree to
        this Agreement. If you are entering this Agreement on behalf of an organisation, you warrant
        that you have authority to bind that organisation.
      </p>

      <h3 id="licence-grant">1. Licence Grant</h3>
      <p>
        TradeLynq grants you a{' '}
        <strong>limited, non-exclusive, non-transferable, revocable licence</strong> to access and
        use the Software solely for:
      </p>
      <ul>
        <li>
          Clients: finding, contacting, and booking local professionals in Trinidad and Tobago.
        </li>
        <li>
          Professionals: managing your Listing, responding to Enquiries, and operating your service
          business.
        </li>
        <li>Admins: administering the Platform on behalf of TradeLynq.</li>
      </ul>
      <p>
        This licence does not convey any ownership rights. All rights not expressly granted are
        reserved by TradeLynq.
      </p>

      <h3 id="restrictions">2. Restrictions</h3>
      <p>You must not:</p>
      <ul>
        <li>
          <strong>Reverse engineer</strong> or attempt to extract the source code of the Software.
        </li>
        <li>
          <strong>Decompile or disassemble</strong> any portion of the Software.
        </li>
        <li>
          <strong>Reproduce, copy, or resell</strong> access to the Software or any part of it.
        </li>
        <li>
          <strong>Automated access:</strong> use bots, scrapers, crawlers, or any automated tool to
          access, index, or extract data from the Platform without TradeLynq's prior written
          consent.
        </li>
        <li>
          <strong>Frame or mirror</strong> the Platform on any other website without written
          permission.
        </li>
        <li>
          <strong>Create derivative works</strong> based on the Software or its design.
        </li>
        <li>
          <strong>Circumvent security:</strong> bypass, disable, or interfere with any security
          feature, rate limit, or access control on the Platform.
        </li>
        <li>
          <strong>Commercial exploitation:</strong> use the Platform to develop a competing
          marketplace service.
        </li>
      </ul>

      <h3 id="intellectual-property">3. Intellectual Property</h3>
      <p>
        The Software, its design system, codebase, trademarks ("TradeLynq", the TradeLynq logo), and
        all Platform content created by TradeLynq are the exclusive property of TradeLynq and its
        licensors, protected under T&amp;T intellectual property law and applicable international
        conventions.
      </p>
      <p>
        <strong>User-generated content</strong> (profile text, images, reviews) remains your
        property. By uploading content, you grant TradeLynq a worldwide, royalty-free licence to
        use, reproduce, and display that content solely to operate the Platform. This licence ends
        when you delete the content or close your account (subject to legal retention requirements).
      </p>

      <h3 id="account-security">4. Account Security</h3>
      <p>
        You are responsible for keeping your account credentials confidential. You must notify
        TradeLynq immediately at <strong>support@tradelynq.tech</strong> if you suspect unauthorised
        access to your account. TradeLynq is not liable for losses resulting from unauthorised
        access due to your failure to protect your credentials.
      </p>

      <h3 id="open-source-components">5. Open-Source Components</h3>
      <p>
        The Platform is built using open-source software including Next.js (MIT), React (MIT),
        Tailwind CSS (MIT), Supabase client libraries (Apache 2.0), and others. Use of these
        components is subject to their respective licences. TradeLynq's proprietary code is not open
        source and is not covered by these licences.
      </p>

      <h3 id="updates-and-changes">6. Updates and Changes</h3>
      <p>
        TradeLynq may update, modify, or discontinue features of the Software at any time. We will
        provide reasonable notice of significant changes. Continued use after changes constitutes
        acceptance of the updated Software.
      </p>

      <h3 id="disclaimer-of-warranties">7. Disclaimer of Warranties</h3>
      <p>
        The Software is provided "<strong>as is</strong>" without warranty of any kind, express or
        implied. TradeLynq does not warrant that the Software will be uninterrupted, error-free, or
        free of viruses. We make no warranties as to the accuracy, reliability, or completeness of
        any content on the Platform.
      </p>

      <h3 id="data-collection-consent">8. Data Collection Consent</h3>
      <p>
        By using the Software, you consent to the collection and use of data as described in our
        Privacy Policy. This includes activity logging (logins, page views, and interactions) used
        for security and platform improvement. IP addresses are stored as irreversible hashes —
        never in plain text.
      </p>

      <h3 id="termination-of-licence">9. Termination of Licence</h3>
      <p>
        This licence automatically terminates if you violate any provision of this Agreement or the
        Terms of Service. TradeLynq may also terminate the licence at its discretion, with or
        without notice, for any reason. Upon termination, you must immediately cease all use of the
        Software.
      </p>

      <h3 id="governing-law">10. Governing Law</h3>
      <p>
        This Agreement is governed by the laws of the Republic of Trinidad and Tobago. Any disputes
        shall be resolved in the courts of Port of Spain, Trinidad and Tobago.
      </p>

      <h3 id="entire-agreement">11. Entire Agreement</h3>
      <p>
        This Agreement, together with the Terms of Service and Privacy Policy, constitutes the
        entire agreement between you and TradeLynq regarding the Software. It supersedes all prior
        understandings or agreements on the same subject.
      </p>

      <h3 id="contact">12. Contact</h3>
      <p>
        <strong>TradeLynq Legal</strong>
        <br />
        Email: support@tradelynq.tech
        <br />
        WhatsApp: +1 (868) 708-9214
        <br />
        Port of Spain, Republic of Trinidad and Tobago
      </p>
    </>
  )
}
