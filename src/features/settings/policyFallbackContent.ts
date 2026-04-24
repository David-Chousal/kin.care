/**
 * Offline / URL-error fallback for Settings → Privacy Policy & Terms.
 * Keep in sync with legal/privacy.md and legal/terms.md (source for `npm run build:legal`).
 */

export interface PolicySection {
  heading: string;
  body: string;
}

export const PRIVACY_POLICY = {
  title: 'Privacy Policy',
  lastUpdated: 'April 22, 2026',
  sections: [
    {
      heading: '1. Who we are',
      body:
        'Kin (“we”, “us”) provides a family care coordination app (“Kin”) that helps caregivers track tasks, medications, health logs, appointments, check-ins, and related documents.',
    },
    {
      heading: '2. Information we collect',
      body:
        'We collect:\n\n• Account information (such as name and email address)\n• Care-related information you enter (tasks, medications, health logs, calendar events, check-ins)\n• Files you upload (for example medical, legal, or insurance documents)\n• Photos you attach to health logs (if you choose to attach them)\n• Push notification token(s) (if you enable notifications)\n• Basic diagnostics data (see “Diagnostics” below)\n\nHealth logs and medication records may contain sensitive health information.',
    },
    {
      heading: '3. How we use information',
      body:
        'We use your information to:\n\n• Provide Kin and sync data within your family group\n• Send reminders and notifications you request\n• Support AI features like Visit Prep summaries and drug interaction checks\n• Maintain security, prevent abuse, and troubleshoot issues\n\nWe do not sell your personal information. We do not use your health information for advertising.',
    },
    {
      heading: '4. AI processing',
      body:
        'If you use AI features, we send relevant inputs you provide (for example, medications and recent health logs) to an AI model provider to generate an output.\n\nAs of this policy’s “Last updated” date, Kin uses Groq as an AI model provider for these features.\n\nWe may store limited metadata about AI requests to support reliability, rate limiting, cost controls, and abuse prevention. This can include: request purpose; timestamps; approximate request and response sizes; provider-reported token counts when available; latency; a best-effort client network identifier (for example the first IP in a forwarded header, which may be inaccurate); and an internal cryptographic hash of the prompt (not the prompt text itself).',
    },
    {
      heading: '5. Storage and security (Supabase)',
      body:
        'Kin uses Supabase for authentication, database, and file storage. Access to family data is restricted to members of that family group, and enforced using database row-level security policies.',
    },
    {
      heading: '6. Push notifications (Expo)',
      body:
        'If you enable notifications, Kin stores your device push notification token and uses it to send reminders and task-related alerts. You can disable notifications at any time in your device settings.',
    },
    {
      heading: '7. Diagnostics (Sentry)',
      body:
        'We use Sentry to diagnose crashes and performance issues. Diagnostic data may include device and app information (such as OS version, device model, app version) and crash details. Kin does not attach full-screen screenshots to Sentry crash reports by default.\n\nWe strive to avoid sending sensitive health content to Sentry; however, depending on the nature of an error, some user-entered text could be included in logs if it is part of the failure context.',
    },
    {
      heading: '8. Sharing with third parties',
      body:
        'We share information with service providers who help us operate Kin, such as Supabase (auth, database, storage), Expo (push notifications), an AI model provider (currently Groq), and Sentry (diagnostics). These providers process data only as needed to provide their services to us.\n\nWe do not share your health information with insurers, advertisers, or data brokers.',
    },
    {
      heading: '9. Data retention and deletion',
      body:
        'Your data is retained as long as your account is active. When you delete your account, your personal data is removed within 30 days. Family data shared with other family members may be retained by those members’ accounts.',
    },
    {
      heading: '10. Your choices and rights',
      body:
        'You can export family data in Settings. You can request account deletion using in-app options or by contacting us.',
    },
    {
      heading: '11. Children’s privacy',
      body:
        'Kin is not directed to children under 13 and we do not knowingly collect personal information from children under 13.',
    },
    {
      heading: '12. Changes',
      body:
        'We may update this policy as the service evolves. Continued use of Kin after changes constitutes acceptance of the updated policy.',
    },
    {
      heading: '13. Contact',
      body: 'For privacy-related questions or requests: privacy@kin.care',
    },
  ] satisfies PolicySection[],
};

export const TERMS_OF_SERVICE = {
  title: 'Terms of Service',
  lastUpdated: 'April 22, 2026',
  sections: [
    {
      heading: '1. Acceptance',
      body:
        'By creating an account or using Kin, you agree to these Terms. If you do not agree, do not use the app.',
    },
    {
      heading: '2. The service',
      body:
        'Kin is a family care coordination app that helps caregivers track tasks, medications, health logs, appointments, check-ins, and related documents. Kin also provides AI-assisted summaries to support doctor visit preparation and safety screening features.',
    },
    {
      heading: '3. Medical disclaimer',
      body:
        'Kin is not a medical device and does not provide medical advice, diagnosis, or treatment. AI-assisted outputs may be incorrect or incomplete. Always consult qualified healthcare professionals for medical decisions.',
    },
    {
      heading: '4. Accounts and responsibilities',
      body:
        'You are responsible for:\n\n• Maintaining the confidentiality of your account credentials\n• The accuracy of information you enter\n• Having permission to store or share information about others\n• Your use of Kin in compliance with applicable laws',
    },
    {
      heading: '5. Family groups',
      body:
        'When you create or join a family group, other members of that group can view and edit shared data. You are responsible for managing who you invite and what you share.',
    },
    {
      heading: '6. Acceptable use',
      body:
        'You agree not to:\n\n• Misuse the service, attempt unauthorized access, or interfere with operation\n• Upload malware or harmful content\n• Use Kin to harass, threaten, or violate others’ rights\n\nWe may suspend or terminate accounts that violate these Terms or applicable law.',
    },
    {
      heading: '7. User content and sharing outside your family',
      body:
        'Kin may allow you to share certain content outside your private family group (for example by exporting content or generating shareable links). If you choose to share, you are responsible for what you share and for having the rights and consents needed to share it. Do not share personal or health information about someone without their permission.\n\nWe may remove content or restrict sharing features to protect users, comply with law, or enforce these Terms.',
    },
    {
      heading: '8. Subscriptions and billing',
      body:
        'Some features may require a paid subscription or in-app purchase.\n\n• Purchases are processed by the platform where you buy (e.g., Apple App Store or Google Play)\n• Subscriptions renew automatically unless canceled before renewal\n• Refunds and cancellations are handled according to the platform’s policies',
    },
    {
      heading: '9. Service availability',
      body:
        'We strive to keep Kin available, but we do not guarantee uninterrupted access. We may modify, suspend, or discontinue features.',
    },
    {
      heading: '10. Limitation of liability',
      body:
        'To the fullest extent permitted by law, Kin is not liable for indirect, incidental, special, consequential, or punitive damages. Our total liability for any claim will not exceed the amount you paid for the service in the 12 months before the event giving rise to the claim.',
    },
    {
      heading: '11. Changes',
      body:
        'We may update these Terms as the service evolves. Continued use after the effective date of changes constitutes acceptance.',
    },
    {
      heading: '12. Contact',
      body: 'Questions about these Terms: legal@kin.care',
    },
  ] satisfies PolicySection[],
};
