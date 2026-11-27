import type { Metadata } from "next";
import EventShell from "@/site/components/EventShell";
import PageHero from "@/site/components/PageHero";
import { organiser } from "@/site/content/organiser";
import { raipur } from "@/site/content/raipur";

export const metadata: Metadata = {
  title: "Rules, refunds, payments & privacy",
  description:
    "Race rules & regulations, prize and BIB collection policy, refund & cancellation, payments, privacy and contact details for LetsRun TGCG 2026.",
};

// Terms & policies every registrant accepts at checkout (also what the payment gateway reviews).
// Carried over word for word from the earlier tgcg.vercel.app/policies page; the anchors
// (#terms #refunds #payments #privacy #contact) are kept because older links point at them.
// Policy text stays in English (legal wording); headings are bilingual.

const RULES = [
  "Entrants are required to abide by the Race Rules and the Run Commander's directions.",
  "Entrants for the full marathon must be 18 years or older and for the half marathon 16 years or older on race date. For other categories the age limit is given in the race information document or webpage.",
  "Entries to the LetsRun TGCG are personal to the applicant; entry fees are non-refundable and non-deferrable. Any runner who competes in another person's BIB will be disqualified. Numbers are issued to the individual athlete completing the application form, except with the specific authority of the Race Organiser.",
  "No refund can be given if the race has to be cancelled or postponed due to circumstances outside the race organizers' control.",
  "The race organizers reserve the right to refuse or cancel applications, including duplicate applications, or to alter the date of the event, the course route or distance.",
  "The race organizers, sponsors, charities, suppliers and/or their agents will not be liable for any injury, loss or expense which may arise in consequence of your participation in this event.",
  "All runners are required to complete the personal, contact and health details form on the back of their race number.",
  "There is a cut-off time for the start — if you arrive later than the cut-off time mentioned in the race information booklet or website you cannot be qualified.",
  "No wheeled vehicles (prams, buggies etc.), dogs or following cycles are allowed along the entire track, and if anyone is found assisting a runner, the runner will be disqualified.",
  "We strongly recommend that you do not race wearing headphones; you need to be fully aware of the surroundings.",
  "Race Commanders and medical team members have the authority to disqualify and remove any runner they consider to be acting dangerously, or to be unfit to compete.",
  "Disqualified runners will be removed from the race results and may be banned from future events.",
  "We do not require competitors to wear an official club or team jersey; they can wear any sports jersey of their choice and comfort.",
  "Care must be taken to assist fellow runners who happen to get injured during the run, and any casualties must be reported immediately to the nearest first aid post or race commanders.",
  "In the event of any dispute the decision of the Race Referee and Race Director shall be final.",
  "It is important to note that we shall be using a Bib Tag with the timing device already attached to your number, and it is very important to wear your number clearly visible on the front of your running vest/t-shirt. Your number must not be altered in any way or covered by any clothing/tri belt. Do not bend, twist or fold your number.",
  "Do not use a Coupon Code more than once; in case of any duplicate use, the later one will be disqualified.",
  "You are not eligible for assistance from your coach or friends en route or in the start line or holding area; if you need assistance contact volunteers.",
  "Run guides are only meant to assist; runners have to rely on their own discretion while running on the track.",
  "If any runner / attendant / friend / coach is accompanying you, he must have a valid bib / ticket, else the Race Director has the right to ask him to leave the event premises or disqualify the runner.",
  "All minors entering must have a consent from a parent / guardian.",
  "Children running with guardians are the responsibility of the guardians.",
  "We will follow chip time and runners are required to go through all timing mats laid down on the road. We don't have any race officials or route escorts. Runners are on their own and are supposed to know the route prior to competition.",
  "Anyone without a bib / valid ticket / event ID shall be asked to leave the area marked by the organisers for the run and refreshments.",
  "Hydration / snacks / support material is only for the event participants and no one without a valid ticket will be allowed to make use of it.",
  "All props / material used for the event are the respective property of their owners and anyone tampering with them will be liable for legal action.",
  "Every participant has to make their own arrangement for travel / stay / food and the organizers may not supply it.",
  "All communication will be done by email, WhatsApp and SMS.",
  "Any race day audio, video, or visual recordings made by a participant at the TGCG 2026 Expo or on race day are to be used only for personal purposes; these cannot be used for any commercial purpose. The official photographer of TGCG 2026 is Wedding Gatha and individual photographs of runners will be available for sale and download on the event website 1 week after the closing hours of race day.",
  "Application fees shall not be refunded by virtue of non-participation, including failure by a confirmed participant to collect his/her bib from the Expo, or not being allowed to run on the race day due to high temperature or being unwell.",
  "The Event Promoter reserves the right to amend or alter the terms of TGCG at any point in time without any notice.",
  "The Promoter reserves the right to disqualify or exclude any person from the event/competition who gives incorrect personal data/details on the entry form, or who is suspected of having taken banned substances. No refund of entry fee will be made.",
  "No result or certificate will be given to runners who do not start their run at the respective start times of the race categories they have been confirmed in.",
  "Please note that if you tamper with the bib tag in any way or remove/exchange it with another runner, you won't be able to get an official finish time and thereby the official timing certificate recording your finish time. No Chip, No Timing, No Prize Money.",
  "Only those confirmed participants wearing the current TGCG 2026 running number bibs will be allowed on the route. Any person found wearing the incorrect bib or no bib will be disqualified and removed by security.",
  "Participants are requested to cooperate with the police and security personnel deputed at the event venues and on the route. Participants/supporters are liable to random checking on race day; this is for your own security.",
  "Photographs taken of runners during any TGCG event organised prior to and on race day can be used for the purpose of promoting the event.",
];

const PRIZE_RULES = [
  "Prize winners are eligible to receive only one prize.",
  "Each participant can only win in 1 category; in such a case, race qualification in other categories will be considered void. The prize will be given for the category which is higher.",
  "In case of a result dispute, or 2 or more winners having the same timing, the prize will be shared between them.",
  "Prizes will be given only to runners registering for the Competitive category. The Non-Competitive category may have prizes for motivational purposes only (subject to availability).",
  "Competitive runners will have to submit all documents online / offline before the run and after the run as needed; failing to do so, they may be disqualified.",
  "All results announced on event day are provisional and final results may change upon verification later; the final result will be declared on or before 20th December 2026.",
  "All prize winners (competitive or non-competitive) will be required to produce valid documents / bank details which shall be verified, and the prize will be given within one month of race result declaration after deduction of requisite taxes.",
  "Prizes / Ranks will only be declared if a minimum of 10 runners finish the race in the respective category. However, this decision will be on the Race Director to conclude.",
  "The winners' names in the different categories will be announced at the conclusion of the races. However, this will be a tentative list, subject to final analysis and confirmation by the Race Officials and Timing authority.",
  "The winners' cheques / online transfer will be done within 30 working days after the announcement, once the winners' list has been ratified by the officials and there are no conflicting claims over any particular Prize / Ranking.",
  "Prize money winnings are subject to Indian Income Tax Rules as applicable, and taxes, if deductible, would be borne by the winner.",
  "Prize winners declared may be required to submit further proof of identity/age, as may be required by the organizers, for disbursement of prize money.",
  "The winners should not remove their bibs before Prize distribution.",
  "Their bibs should be clearly visible during the prize distribution, not covered by jackets etc.",
  "The prize money shall be given to winners in the form of Cheques / Online transfer only.",
  "In case any question arises or a controversy exists that is not already covered by the prize/ranking rules, the decision of the Organisers [TGCG team] will be FINAL.",
  "The Organiser's decision on rankings and entitlements of prize money will be final and binding on all.",
];

const BIB_RULES = [
  "All confirmed participants are required to come to the Expo in order to collect their running number bibs. No running number will be posted to an individual's mailing address nor distributed on race day.",
  "It is mandatory for the participant to collect his/her running number bib personally from the Expo. In case of unavoidable circumstances, such a runner can send his/her authorised representative to collect the running number bib on his/her behalf. The authorised representative must carry: (a) soft copy of the Confirmation Email/SMS with BIB number details; (b) soft copy of the photo-identity proof (Aadhar card, PAN card or passport) of the confirmed participant.",
  "A maximum of two race kits will be issued to one individual. A registered participant can collect the race kit for himself/herself and one more person ONLY.",
  "The race kit will be issued only upon seeing the confirmation email/SMS with bib details.",
  "Note: NO bulk/group race kit collection will be accepted at the Expo without prior notification.",
];

const PROTEST_RULES = [
  "The athlete and/or his/her representative can appeal to the Race Director in relation to the Official race results declared, in writing, within 30 minutes of the interim official announcement of the results of the relevant race category on race day.",
  "The protest letter needs to be submitted at the Help Desk along with a non-refundable Protest Fee of INR 1,000/-.",
  "The reply to the appeal submission will be given after 15 days via email.",
];

const MEDICAL_RULES = [
  "If you suffer from any form of medical condition, you must mark the front of your number with a prominent waterproof cross. Please give brief details of your medical condition and what medication you take on the reverse of your number.",
];

const TRANSFER_RULES = [
  "Transfer of an entry to another person is not permitted. Please note that your race number must not be given to anyone else; this will result in them being disqualified and, if part of a team, will result in the team being disqualified.",
  "You will not receive any notification until your race pack arrives 5-10 days before the event. Your email is the confirmation.",
];

const REFUND_RULES = [
  "As we incur administrative, medical and other expenses the moment you register, it is not viable for us to refund any tickets once already sold. Entry fees are non-refundable and non-deferrable.",
  "No refund is given for a participant's cancellation of their registration.",
  "Application fees shall not be refunded by virtue of non-participation, including failure by a confirmed participant to collect his/her bib from the Expo, or not being allowed to run on race day due to high temperature or being unwell.",
  "No refund can be given if the race has to be cancelled or postponed due to circumstances outside the race organizers' control.",
  "A person who gives incorrect personal data/details on the entry form, or who is suspected of having taken banned substances, may be disqualified or excluded; no refund of entry fee will be made.",
  "Transfer of a registration to another person is not permitted.",
  "If a payment fails, or an amount is debited without your registration being confirmed, the amount is returned to your account by the payment gateway and your bank, usually within 5–7 working days. Write to us with your payment reference if it does not arrive.",
];

const PAYMENT_RULES = [
  "Registration fees are charged in Indian Rupees (INR) as listed for each race category on the registration page. Listed fees are exclusive of applicable taxes and the payment processing fee, which are added at checkout.",
  "Online: our registration website uses a secure payment gateway (Razorpay) and supports the standard payment methods it offers — UPI, debit/credit cards, net banking and wallets. Your card or UPI details are entered on the gateway and are never seen or stored by us.",
  "Offline: corporates and large groups can register via spreadsheet and pay by cash or another method, arranged with the organizers.",
  "Registration opens on 4 September 2026 and closes on 10 December 2026. Once your payment is confirmed, your ticket (with QR code) and BIB details are sent to you by WhatsApp and email.",
  "All communication regarding your registration is done by email, WhatsApp and SMS. See the Refund & Cancellation Policy above for what happens when a payment fails.",
];

const PRIVACY: { title: string; items: string[] }[] = [
  {
    title: "Information we collect",
    items: [
      "Registration details: name, WhatsApp/mobile number, gender, city, date of birth, T-shirt size, emergency contact number, and optionally your organization and running community.",
      "For Competitive (prize-eligible) categories only: Aadhar/government ID number and an uploaded copy of the ID, bank account details, and PAN, which are needed to verify eligibility and pay out prize money.",
      "Payment information is handled directly by our payment gateway; we receive only a confirmation of the payment and its reference, not your card, UPI or bank credentials.",
    ],
  },
  {
    title: "How we use it",
    items: [
      "To process and confirm your registration, issue your BIB and ticket, and run the event.",
      "To communicate with you by WhatsApp, SMS and email about your registration, BIB collection and event updates, and to verify your mobile number with a one-time password.",
      "To verify eligibility, publish results and certificates, and pay out prizes.",
      "Photographs and recordings taken at the event may be used to promote the event, as set out in the Terms & Conditions above.",
    ],
  },
  {
    title: "Who processes your data",
    items: [
      "We use third-party service providers to operate the registration site: a payment gateway (Razorpay), a WhatsApp/SMS messaging provider, cloud hosting and database services, and Google Drive for storing uploaded ID documents. They process data only to provide those services to us.",
    ],
  },
  {
    title: "Your choices",
    items: [
      `You can ask us to correct your details or to tell you what we hold about you by writing to ${organiser.email}. We may need to retain some information to run the event, pay prizes and meet legal and tax obligations.`,
    ],
  },
];

const TERMS: { id: string; title: string; titleHi: string; items: string[] }[] = [
  { id: "terms", title: "Rules and Regulations — TGCG.run 2026", titleHi: "नियम और शर्तें", items: RULES },
  { id: "prizes", title: "Prize announcement & money distribution", titleHi: "पुरस्कार घोषणा व राशि वितरण", items: PRIZE_RULES },
  { id: "bib-collection", title: "BIB collection", titleHi: "BIB संग्रह", items: BIB_RULES },
  { id: "protests", title: "Protests and appeals", titleHi: "आपत्ति और अपील", items: PROTEST_RULES },
  { id: "medical", title: "Medical advice", titleHi: "चिकित्सा सलाह", items: MEDICAL_RULES },
  { id: "transfers", title: "Transfers", titleHi: "ट्रांसफर", items: TRANSFER_RULES },
  { id: "refunds", title: "Refund & Cancellation Policy", titleHi: "रिफंड और रद्दीकरण नीति", items: REFUND_RULES },
  { id: "payments", title: "Payment Policy", titleHi: "भुगतान नीति", items: PAYMENT_RULES },
];

const JUMP = [
  { href: "#terms", label: "Rules & Terms" },
  { href: "#refunds", label: "Refund & Cancellation" },
  { href: "#payments", label: "Payment Policy" },
  { href: "#privacy", label: "Privacy Policy" },
  { href: "#contact", label: "Contact Us" },
];

export default function PoliciesPage() {
  return (
    <EventShell e={raipur}>
      <PageHero
        eyebrow={`${raipur.shortName} ${raipur.edition} · नियम व नीतियाँ`}
        title="Rules, refunds, payments & privacy"
        subtitle="Every registrant is required to read and accept these rules during registration. पंजीकरण के समय इन नियमों को पढ़ना और स्वीकार करना अनिवार्य है।"
      >
        <nav className="jump-links" aria-label="On this page">
          {JUMP.map((j) => (
            <a key={j.href} href={j.href}>
              {j.label}
            </a>
          ))}
        </nav>
      </PageHero>

      <section className="section section-sand">
        <div className="container rules-layout">
          {TERMS.map((s) => (
            <article key={s.id} id={s.id} className="rules-card reveal">
              <header>
                <h2>{s.title}</h2>
                <span className="hi">{s.titleHi}</span>
                <span className="rules-count">{s.items.length}</span>
              </header>
              <ol className={`rules-list ${s.items.length > 12 ? "rules-cols" : ""}`}>
                {s.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ol>
            </article>
          ))}

          <article id="privacy" className="rules-card reveal">
            <header>
              <h2>Privacy Policy</h2>
              <span className="hi">गोपनीयता नीति</span>
            </header>
            <p className="muted">
              This explains what personal information we collect when you register for LetsRun TGCG 2026, and how it is used.
            </p>
            {PRIVACY.map((p) => (
              <div key={p.title}>
                <h3>{p.title}</h3>
                <ul className="rules-list">
                  {p.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
              </div>
            ))}
          </article>

          <article id="contact" className="rules-card reveal">
            <header>
              <h2>Contact Us</h2>
              <span className="hi">संपर्क करें</span>
            </header>
            <p>
              Event by <strong>{organiser.name}, {organiser.address}</strong>
              <br />
              {organiser.legalName} · CIN: {organiser.cin}
            </p>
            <ul className="rules-list">
              <li>
                Email: <a href={`mailto:${organiser.email}`} className="link">{organiser.email}</a>
              </li>
              <li>
                WhatsApp:{" "}
                <a href={organiser.whatsappUrl} target="_blank" rel="noopener noreferrer" className="link">
                  {organiser.whatsappNumber}
                </a>
              </li>
              <li>Registration and event website: tgcg.run</li>
            </ul>
          </article>
        </div>
      </section>
    </EventShell>
  );
}
