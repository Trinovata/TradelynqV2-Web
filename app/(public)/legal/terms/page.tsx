/* eslint-disable react/no-unescaped-entities */
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The terms and conditions governing use of the TradeLynq marketplace platform in Trinidad and Tobago.',
}

export default function TermsOfServicePage() {
  return (
    <>
      <h2 className="text-brand-slate mt-0 text-2xl font-bold">Terms of Service</h2>
      <p className="text-muted text-sm">Effective date: 25 July 2026 · Version 2.1</p>

      <p>
        Please read these Terms of Service ("<strong>Terms</strong>") carefully before using
        TradeLynq. By creating an account or using the platform, you agree to be bound by these
        Terms and our Privacy Policy. If you do not agree, do not use TradeLynq.
      </p>

      <h3 id="definitions">1. Definitions</h3>
      <ul>
        <li>
          <strong>"Platform"</strong> means the TradeLynq website, APIs, and any associated
          applications.
        </li>
        <li>
          <strong>"Professional"</strong> means a user who creates a listing to offer services.
        </li>
        <li>
          <strong>"Client"</strong> means an individual who uses the Platform to find, evaluate, or
          enquire about professional services.
        </li>
        <li>
          <strong>"Listing"</strong> means a Professional's public profile on the Platform.
        </li>
        <li>
          <strong>"Enquiry"</strong> means a Client's request for a quote or information sent
          through the Platform.
        </li>
        <li>
          <strong>"Booking"</strong> means a confirmed appointment between a Client and
          Professional.
        </li>
      </ul>

      <h3 id="eligibility">2. Eligibility</h3>
      <ul>
        <li>
          You must be at least <strong>18 years of age</strong> to use TradeLynq.
        </li>
        <li>
          You must reside in, or provide services within, the{' '}
          <strong>Republic of Trinidad and Tobago</strong>.
        </li>
        <li>
          Professionals must hold any licences, certifications, or registrations required by T&amp;T
          law for their trade or profession (e.g. Electrical Inspectorate, Medical Board, National
          Insurance Board).
        </li>
        <li>You must provide accurate, complete, and up-to-date registration information.</li>
        <li>
          One account per person. Corporate accounts must be registered in the name of the
          responsible individual.
        </li>
      </ul>

      <h3 id="professional-accounts">3. Professional Accounts</h3>

      <h4>3.1 Listings</h4>
      <p>
        By creating a Listing, you represent that the information is truthful and accurate,
        including your qualifications, service areas, and portfolio. Misleading or false listings
        will be suspended without refund.
      </p>

      <h4>3.2 Subscriptions</h4>
      <p>
        Active Listings require a paid subscription at the rate published on our{' '}
        <strong>Pricing page</strong> (plans start from <strong>TTD $200/month</strong>).
        Subscriptions are billed monthly. A one-time, non-refundable{' '}
        <strong>TTD $200 registration fee</strong> is due when you first activate your Listing.
      </p>
      <p>
        New Professionals receive <strong>50% off their subscription for the first 3 months</strong>{' '}
        — the promotional rate applies automatically at checkout. After the promotional period, the
        standard rate resumes. Subscriptions are billed for the package term you select — monthly,
        or discounted 3-, 6-, or 12-month packages billed at the start of the term. Payments are
        processed by First Atlantic Commerce Ltd. Subscriptions may be cancelled at any time; your
        Listing remains active until the end of the current billing period.
      </p>

      <h4>3.2A Refunds</h4>
      {/* Added 25 Jul 2026 (v2.1) at Gregg's direction. FLAG: pending attorney
          review with the rest of the legal set (W19) — the substance is the
          directive's; the drafting is interim. */}
      <p>
        <strong>Refunds are not typically issued.</strong> Subscription fees, package fees, and the
        registration fee pay for Listing visibility and platform tools that are provided
        immediately, and <strong>no refunds</strong> are issued for partial months or partially
        elapsed package terms once a billing cycle has started.
      </p>
      <ul>
        <li>
          Where TradeLynq, at its sole discretion, grants a refund, it becomes available only{' '}
          <strong>after your first billing cycle has completed</strong> and is capped at{' '}
          <strong>50% of the total amount paid</strong> for the package concerned.
        </li>
        <li>
          A refund request submitted <strong>between billing cycles</strong> operates as a
          cancellation for the cycle in progress: amounts paid for{' '}
          <strong>past and current cycles are forfeited</strong>, and any discretionary refund is
          assessed only against unstarted, prepaid cycles remaining in the package.
        </li>
        <li>
          Nothing in this section limits any non-waivable rights you hold under the consumer
          protection laws of Trinidad &amp; Tobago.
        </li>
      </ul>

      <h4>3.3 Professional conduct</h4>
      <p>Professionals must:</p>
      <ul>
        <li>Respond to Enquiries within a reasonable time (we recommend 48 hours).</li>
        <li>Honour prices and timelines communicated to Clients.</li>
        <li>
          Maintain professional standards of conduct during all interactions facilitated by
          TradeLynq.
        </li>
        <li>Not solicit Clients off-platform for the purpose of avoiding platform fees.</li>
      </ul>

      <h3 id="client-accounts">4. Client Accounts</h3>
      <p>
        Clients may browse, save, and contact Professionals at no charge. Clients must not use the
        Platform to:
      </p>
      <ul>
        <li>Submit false or malicious Enquiries.</li>
        <li>Solicit services for illegal purposes.</li>
        <li>Harass, threaten, or intimidate Professionals.</li>
        <li>Leave false reviews or reviews they were paid to write.</li>
      </ul>

      <h3 id="prohibited-conduct">5. Prohibited Conduct</h3>
      <p>All users are prohibited from:</p>
      <ul>
        <li>Impersonating another person or entity.</li>
        <li>Scraping, crawling, or data-mining the Platform without written permission.</li>
        <li>Using automated bots or scripts to interact with the Platform.</li>
        <li>Posting content that is defamatory, pornographic, violent, or hateful.</li>
        <li>Attempting to circumvent security controls or access others' accounts.</li>
        <li>Using the Platform to facilitate money laundering or any illegal activity.</li>
        <li>Creating multiple accounts to game ratings, reviews, or trials.</li>
      </ul>

      <h3 id="reviews-and-ratings">6. Reviews and Ratings</h3>
      <p>
        Reviews are governed by our separate <strong>Review Policy</strong> (available at
        /legal/reviews). In summary: TradeLynq does not remove honest negative reviews on behalf of
        Professionals. Reviews that violate our Review Policy (false, offensive, or fraudulent) may
        be moderated.
      </p>

      <h3 id="intellectual-property">7. Intellectual Property</h3>
      <p>
        TradeLynq and its licensors own all rights in the Platform's code, design, trademarks, and
        content (excluding user-generated content). You grant TradeLynq a non-exclusive,
        royalty-free licence to display your profile content, images, and reviews on the Platform
        for the purpose of operating the service.
      </p>
      <p>
        You retain ownership of content you upload. You are responsible for ensuring you own or have
        the right to upload any images or text you post.
      </p>

      <h3 id="marketplace-role">8. Marketplace Role — No Liability for Services</h3>
      <p>
        <strong>TradeLynq is a marketplace only.</strong> We do not employ Professionals, supervise
        work, or guarantee the quality, safety, or legality of any services rendered. All contracts
        for services are directly between the Client and the Professional.
      </p>
      <p>
        TradeLynq is not liable for: personal injury or property damage arising from work arranged
        through the Platform; disputes between Clients and Professionals; losses caused by a
        Professional's failure to perform; or fraudulent misrepresentation by any user.
      </p>

      <h3 id="limitation-of-liability">9. Limitation of Liability</h3>
      <p>
        To the maximum extent permitted by T&amp;T law, TradeLynq's total liability to you for any
        claim arising from use of the Platform is limited to the subscription fees paid by you in
        the three months preceding the claim. TradeLynq is not liable for indirect, consequential,
        or loss-of-profit damages.
      </p>

      <h3 id="indemnification">10. Indemnification</h3>
      <p>
        You agree to indemnify and hold TradeLynq harmless from any claims, losses, or expenses
        (including legal fees) arising from your use of the Platform, your content, or your
        violation of these Terms.
      </p>

      <h3 id="termination">11. Termination</h3>
      <p>
        We may suspend or terminate your account at any time for violation of these Terms, with or
        without notice. Repeated violations, fraudulent activity, or serious misconduct will result
        in permanent bans. Banned accounts may not be recreated.
      </p>
      <p>You may close your account at any time via account settings or by contacting support.</p>

      <h3 id="disputes-and-governing-law">12. Disputes and Governing Law</h3>
      <p>
        These Terms are governed by the laws of the <strong>Republic of Trinidad and Tobago</strong>
        . Any dispute arising shall first be submitted to TradeLynq's internal mediation process. If
        unresolved within 30 days, disputes shall be referred to the courts of Port of Spain,
        Trinidad and Tobago.
      </p>

      <h3 id="changes-to-terms">13. Changes to These Terms</h3>
      <p>
        We may update these Terms as the platform evolves. Significant changes will be communicated
        by email at least 14 days before taking effect. Continued use constitutes acceptance.
      </p>

      <h3 id="contact">14. Contact</h3>
      <p>
        <strong>TradeLynq Support</strong>
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
