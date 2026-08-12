/* eslint-disable react/no-unescaped-entities */
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Review Policy',
  description:
    'How TradeLynq handles reviews, moderation, and disputes — built on a commitment to honest, trusted feedback in Trinidad and Tobago.',
}

export default function ReviewPolicyPage() {
  return (
    <>
      <h2 className="text-brand-slate mt-0 text-2xl font-bold">Review Policy &amp; Brand Vision</h2>
      <p className="text-muted text-sm">Effective date: 25 February 2026 · Version 1.1</p>

      {/* ── Brand Vision ── */}
      <div className="not-prose from-brand-slate my-8 rounded-xl bg-gradient-to-br to-slate-700 p-8 text-white">
        <p className="text-brand-cyan mb-3 text-xs font-semibold tracking-widest uppercase">
          Our Standard
        </p>
        <blockquote className="font-display m-0 border-none p-0 text-xl leading-relaxed font-semibold text-white">
          &ldquo;TradeLynq exists to raise the standard of professional services in Trinidad and
          Tobago. Reviews are not a feature — they are the foundation. Every honest word of
          feedback, positive or negative, makes the platform more valuable for everyone.&rdquo;
        </blockquote>
        <p className="text-muted mt-4 text-sm">— TradeLynq Founding Principle</p>
      </div>

      <h3 id="why-reviews-matter">1. Why Reviews Matter</h3>
      <p>
        In Trinidad and Tobago, trust in professionals has historically been built through personal
        referrals — word of mouth from family, friends, and community. TradeLynq digitises and
        scales that trust network. Our review system is the mechanism by which earned reputation
        travels further than any individual's network.
      </p>
      <p>
        A professional's rating on TradeLynq is a{' '}
        <strong>public endorsement of their quality</strong>. Clients who leave reviews are
        performing a genuine service to their community. We take that seriously.
      </p>

      <h3 id="what-makes-a-valid-review">2. What Makes a Valid Review</h3>
      <p>Reviews on TradeLynq must be:</p>
      <ul>
        <li>
          <strong>First-hand:</strong> you must have personally engaged with or hired the
          Professional.
        </li>
        <li>
          <strong>Factual:</strong> describe what actually happened — what was done, when, and how.
        </li>
        <li>
          <strong>Recent:</strong> reviews should reflect experiences within the past 24 months.
        </li>
        <li>
          <strong>Honest:</strong> do not exaggerate, fabricate, or misrepresent your experience.
        </li>
        <li>
          <strong>Your own:</strong> reviews must not be written by, or at the request of, a third
          party for payment.
        </li>
      </ul>

      <h3 id="what-we-will-not-remove">
        3. What TradeLynq Will <em>Not</em> Remove
      </h3>
      <p>
        <strong>
          TradeLynq does not remove honest negative reviews on behalf of Professionals.
        </strong>{' '}
        This is non-negotiable. A Professional who receives a low rating cannot pay, threaten, or
        appeal their way to its removal — unless the review itself violates this policy.
      </p>
      <p>
        The presence of negative reviews is a feature, not a bug. Platforms where every professional
        has five stars are not trustworthy — they have simply silenced their critics. We will not be
        that platform.
      </p>

      <h3 id="grounds-for-moderation">4. Grounds for Moderation</h3>
      <p>
        We <em>will</em> act on reviews that violate the following rules. Reviews may be edited,
        hidden, or removed if they contain:
      </p>
      <ul>
        <li>
          <strong>Fabricated experiences:</strong> a review describing a job that never happened.
        </li>
        <li>
          <strong>Conflicts of interest:</strong> reviews written by the Professional's family
          members, employees, or business rivals.
        </li>
        <li>
          <strong>Incentivised reviews:</strong> reviews written in exchange for cash, discounts, or
          gifts.
        </li>
        <li>
          <strong>Personal attacks:</strong> content targeting a person's race, ethnicity, gender,
          religion, disability, or sexuality.
        </li>
        <li>
          <strong>Defamation:</strong> claims that are provably false and damaging to a person's
          reputation (assessed under T&amp;T defamation law).
        </li>
        <li>
          <strong>Profanity and abuse:</strong> content that is obscene, threatening, or harassing.
        </li>
        <li>
          <strong>Private information:</strong> review content that reveals home addresses, private
          phone numbers, or other personal details of any individual.
        </li>
        <li>
          <strong>Off-topic advertising:</strong> promoting competing businesses, products, or
          services within a review.
        </li>
      </ul>
      <p>
        Dissatisfaction with a price, a timeline, or a result — even if strongly worded — is{' '}
        <strong>not grounds for removal</strong> if it is an honest account of what occurred.
      </p>

      <h3 id="right-of-response">5. The Professional's Right of Response</h3>
      <p>
        Every Professional has the right to post a public response to any review. We encourage this.
        A thoughtful, professional reply to a negative review can demonstrate character and
        commitment to quality — and often reassures future clients more than the negative review
        damages.
      </p>
      <p>
        Responses must follow the same conduct standards as reviews. Responses that attack, demean,
        or reveal private information about the reviewer will be removed.
      </p>

      <h3 id="how-to-dispute">6. How to Dispute a Review</h3>
      <p>If you believe a review violates this policy, you may:</p>
      <ol>
        <li>
          Use the "Flag review" button on the review (Professionals only, for reviews on their own
          Listing).
        </li>
        <li>
          Email <strong>support@tradelynq.tech</strong> with the review URL and the specific grounds
          for your dispute.
        </li>
      </ol>
      <p>
        Our moderation team will review disputes within <strong>5 business days</strong>. Disputes
        that do not cite specific policy violations (e.g. "I don't like what they said") will be
        declined. The decision of the moderation team is final at the platform level.
      </p>

      <h3 id="consequences-of-abuse">7. Consequences of Review Abuse</h3>
      <p>
        Users who repeatedly submit false, paid, or policy-violating reviews will have their review
        privileges suspended and may have their accounts permanently banned. Professionals who are
        found to have solicited fake reviews — whether five-star or otherwise — will have their
        Listing suspended without refund.
      </p>

      <h3 id="tradelynq-role-in-disputes">
        8. TradeLynq's Role in Disputes Between Clients and Professionals
      </h3>
      <p>
        When a genuine service dispute arises, TradeLynq can play a supporting — but not legally
        binding — role. We may:
      </p>
      <ul>
        <li>
          Provide documented communication records from the Platform upon receipt of a valid legal
          request.
        </li>
        <li>Facilitate mediated dialogue between parties.</li>
        <li>Suspend a Professional's Listing pending investigation of a serious complaint.</li>
      </ul>
      <p>
        TradeLynq is a marketplace and cannot adjudicate contractual or legal disputes. For formal
        recourse, we encourage clients to contact the{' '}
        <strong>Trinidad and Tobago Consumer Affairs Division</strong> or seek independent legal
        advice.
      </p>

      <h3 id="featured-reviews">9. Featured Reviews</h3>
      <p>
        TradeLynq may elect to feature exceptional reviews on a Professional's profile or in
        Platform marketing materials. Featured status is awarded by TradeLynq at its discretion
        based on quality and detail — it cannot be purchased. Featured reviews are not editable by
        TradeLynq to change their meaning.
      </p>

      <h3 id="our-commitment">10. Our Commitment</h3>
      <p>
        We believe the professionals of Trinidad and Tobago deserve a platform that takes quality
        seriously. We believe clients deserve honest information to make confident decisions. And we
        believe that both groups are best served by a review system that is rigorously fair — not
        one that is managed for appearances.
      </p>
      <p>
        TradeLynq will never be a platform where buying a subscription buys you a clean record.
        <strong> Your reputation is earned here.</strong>
      </p>

      <h3 id="contact">11. Contact</h3>
      <p>
        <strong>TradeLynq Review Team</strong>
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
