/* Ringback site settings. Everything here is safe to be public. */
window.RB_CONFIG = {
  siteUrl: 'https://aerhq3e4r5h.github.io/ringback/',

  /* Supabase (accounts + database). The key is the public "publishable" key, protected by row-level security. */
  supabaseUrl: 'https://mmjbhckqqcvixhzehgvg.supabase.co',
  supabaseKey: 'sb_publishable_A21Dzqa6_-UWZIfoxItrqA_8hu3wwSN',
  otpLength: 6,

  /* Contact details */
  whatsapp: '27652343106',
  phoneDisplay: '065 234 3106',
  phoneTel: '+27652343106',
  email: '',

  /* Vapi website assistant (public key, locked to this website's address) */
  vapiPublicKey: '4d96fa0f-6478-4fb1-8e04-dccad2410c86',
  vapiAssistantId: '5aef0057-c3ed-4d67-a802-23db18e26f8a',

  /* Log-in codes: how long an emailed code stays valid, in minutes. Match the Supabase email OTP expiry. */
  otpExpiryMinutes: 10,

  /* Example-call recordings that exist in audio/, by trade key, e.g. ['plumbing','electrical'].
     Only listed keys are requested, so an empty list means no audio requests at all. */
  audio: [],

  /* The founder card on about, contact, pricing and login. It only shows when name, photo and note are ALL set.
     photo is a path in this site, e.g. 'img/founder.jpg' (square, at least 176px). */
  founder: { name: '', role: '', photo: '', note: '' },

  /* VAT rate used where a page shows a price including VAT (prices are quoted excluding VAT). */
  vatRate: 0.15,

  /* Portal go-live helper: minutes to wait for a test call to show up before suggesting a fix. */
  testCallWaitMinutes: 5,

  /* Optional line under the portal's 'Refer another business' card, e.g. a thank-you you really offer. Empty hides it. */
  referralNote: '',

  /* Card payments through Paystack (portal "Pay by card", usage meter, admin subscriptions).
     Leave false until you've finished supabase/BILLING-SETUP.md; then set it to true. */
  payments: false
};
