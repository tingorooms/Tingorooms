import { Shield, AlertTriangle, Eye, MessageSquare, Database, UserX, Scale, FileText, Bell, HelpCircle } from 'lucide-react';
import { useSiteSettings } from '@/context/SiteSettingsContext';

const EFFECTIVE_DATE = 'March 23, 2026';

const sections = [
    { id: 'acceptance', label: '1. Acceptance of Terms' },
    { id: 'platform', label: '2. Platform Description' },
    { id: 'eligibility', label: '3. Eligibility & Registration' },
    { id: 'data-collection', label: '4. Data Collection & Use' },
    { id: 'chat-messaging', label: '5. Chat & Messaging' },
    { id: 'user-conduct', label: '6. User Conduct' },
    { id: 'listings', label: '7. Listings & Content' },
    { id: 'privacy', label: '8. Privacy & Cookies' },
    { id: 'intellectual-property', label: '9. Intellectual Property' },
    { id: 'liability', label: '10. Liability & Disclaimer' },
    { id: 'termination', label: '11. Account Termination' },
    { id: 'dispute', label: '12. Dispute Resolution' },
    { id: 'governing-law', label: '13. Governing Law' },
    { id: 'changes', label: '14. Changes to Terms' },
    { id: 'contact', label: '15. Contact Us' },
];

export default function TermsAndConditionsPage() {
    const { settings } = useSiteSettings();

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-blue-50/20">
            {/* Hero Banner */}
            <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 text-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-10 sm:py-14">
                    <div className="flex items-start gap-5">
                        <div className="bg-white/15 backdrop-blur-sm p-4 rounded-2xl flex-shrink-0">
                            <Scale className="w-10 h-10 text-blue-200" />
                        </div>
                        <div>
                            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">Terms &amp; Conditions</h1>
                            <p className="text-blue-200 text-sm sm:text-base max-w-2xl leading-relaxed">
                                Please read these terms carefully before using {settings.businessName || 'our platform'}. By accessing or using the platform, you agree to be legally bound by these terms.
                            </p>
                            <div className="flex flex-wrap items-center gap-4 mt-4 text-xs sm:text-sm text-blue-300">
                                <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Effective: {EFFECTIVE_DATE}</span>
                                <span className="flex items-center gap-1.5"><Bell className="w-3.5 h-3.5" /> Last Updated: {EFFECTIVE_DATE}</span>
                                <span className="flex items-center gap-1.5"><Scale className="w-3.5 h-3.5" /> Jurisdiction: Worldwide</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-10">
                <div className="flex flex-col lg:flex-row gap-8">

                    {/* Table of Contents - Sticky Sidebar */}
                    <aside className="lg:w-64 flex-shrink-0">
                        <div className="lg:sticky lg:top-24 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-blue-600" />
                                Table of Contents
                            </h3>
                            <nav className="space-y-1">
                                {sections.map((s) => (
                                    <a
                                        key={s.id}
                                        href={`#${s.id}`}
                                        className="block text-xs text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg px-3 py-2 transition-colors leading-snug"
                                    >
                                        {s.label}
                                    </a>
                                ))}
                            </nav>
                        </div>
                    </aside>

                    {/* Main Content */}
                    <main className="flex-1 space-y-6">

                        {/* Important Notice Banner */}
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex gap-4">
                            <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold text-amber-900 mb-1">Important Notice</p>
                                <p className="text-sm text-amber-800 leading-relaxed">
                                    This platform collects and processes user data including names, phone numbers, email addresses, and location information. Chats and messages sent through this platform are <strong>not end-to-end encrypted</strong> and may be accessible to platform administrators for moderation and safety purposes. By using this platform, you expressly consent to these practices.
                                </p>
                            </div>
                        </div>

                        {/* Section 1 */}
                        <section id="acceptance" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="bg-blue-100 p-2 rounded-xl"><Shield className="w-5 h-5 text-blue-700" /></div>
                                <h2 className="text-xl font-bold text-slate-900">1. Acceptance of Terms</h2>
                            </div>
                            <div className="space-y-3 text-slate-700 text-sm leading-relaxed">
                                <p>By accessing, browsing, or using {settings.businessName || 'this platform'} ("Platform", "we", "us", or "our"), you acknowledge that you have read, understood, and agree to be bound by these Terms &amp; Conditions ("Terms") and our Privacy Policy.</p>
                                <p>If you do not agree with any part of these Terms, you must immediately discontinue use of the Platform. Your continued use of the Platform after any modification to these Terms constitutes your acceptance of the revised Terms.</p>
                                <p>These Terms constitute a legally binding agreement between you and the Platform operator under applicable Indian law.</p>
                            </div>
                        </section>

                        {/* Section 2 */}
                        <section id="platform" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="bg-blue-100 p-2 rounded-xl"><HelpCircle className="w-5 h-5 text-blue-700" /></div>
                                <h2 className="text-xl font-bold text-slate-900">2. Platform Description</h2>
                            </div>
                            <div className="space-y-3 text-slate-700 text-sm leading-relaxed">
                                <p>The Platform is an online marketplace that connects persons seeking rental accommodation ("Seekers") with property owners and brokers who have rooms or accommodation available for rent ("Listers"). We are an intermediary only and are not a party to any rental agreement between users.</p>
                                <p>The Platform also provides supplementary features including expense management for roommate groups, real-time messaging, broker subscription plans, and listing promotion tools.</p>
                                <p className="font-medium text-slate-900">The Platform does not:</p>
                                <ul className="space-y-1.5 ml-4">
                                    {['Verify the identity of all users', 'Inspect or guarantee the condition of any property', 'Act as a real estate agent or broker', 'Guarantee room availability or booking outcomes', 'Handle payments between landlords and tenants'].map(item => (
                                        <li key={item} className="flex items-start gap-2"><span className="text-slate-400 mt-0.5">•</span>{item}</li>
                                    ))}
                                </ul>
                            </div>
                        </section>

                        {/* Section 3 */}
                        <section id="eligibility" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="bg-green-100 p-2 rounded-xl"><UserX className="w-5 h-5 text-blue-700" /></div>
                                <h2 className="text-xl font-bold text-slate-900">3. Eligibility &amp; Registration</h2>
                            </div>
                            <div className="space-y-3 text-slate-700 text-sm leading-relaxed">
                                <p>You must be at least 18 years old and legally capable of entering into binding contracts under applicable Indian law to use this Platform. By registering, you represent and warrant that you meet these requirements.</p>
                                <p>You agree to provide accurate, current, and complete information during registration and to keep your account information updated. You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account.</p>
                                <ul className="space-y-1.5 ml-4">
                                    {[
                                        'One person may hold only one account unless otherwise permitted',
                                        'You must not create accounts on behalf of others without authorization',
                                        'You must notify us immediately of any unauthorized account use',
                                        'Accounts registered with false information may be terminated without notice',
                                        'Broker accounts require subscription and are subject to additional verification'
                                    ].map(item => (
                                        <li key={item} className="flex items-start gap-2"><span className="text-slate-400 mt-0.5">•</span>{item}</li>
                                    ))}
                                </ul>
                            </div>
                        </section>

                        {/* Section 4 - DATA - Key section */}
                        <section id="data-collection" className="bg-white rounded-2xl border border-blue-200 shadow-sm p-6 sm:p-8">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="bg-blue-100 p-2 rounded-xl"><Database className="w-5 h-5 text-blue-700" /></div>
                                <h2 className="text-xl font-bold text-slate-900">4. Data Collection &amp; Use</h2>
                            </div>
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
                                <p className="text-blue-900 text-sm font-semibold mb-1">Your Data Is Used by This Platform</p>
                                <p className="text-blue-800 text-sm leading-relaxed">By registering and using this Platform, you expressly consent to the collection, storage, processing, and use of your personal data as described below.</p>
                            </div>
                            <div className="space-y-4 text-slate-700 text-sm leading-relaxed">
                                <div>
                                    <p className="font-semibold text-slate-900 mb-2">4.1 Data We Collect</p>
                                    <ul className="space-y-1.5 ml-4">
                                        {[
                                            'Personal identifiers: name, email address, mobile number, WhatsApp number',
                                            'Profile information: profile photo, gender, bio',
                                            'Location data: city, area, pincode, and optionally GPS coordinates',
                                            'Listing data: room details, photos, rent, availability, amenities',
                                            'Financial data: subscription plan details and payment status (we do not store full card/bank details)',
                                            'Usage data: pages visited, search queries, device type, browser, IP address',
                                            'Communication data: messages, chat history, contact leads',
                                            'Expense & group data: expense records, roommate group membership'
                                        ].map(item => (
                                            <li key={item} className="flex items-start gap-2"><span className="text-slate-400 mt-0.5">•</span>{item}</li>
                                        ))}
                                    </ul>
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900 mb-2">4.2 How We Use Your Data</p>
                                    <ul className="space-y-1.5 ml-4">
                                        {[
                                            'To create and manage your account and profile',
                                            'To display your listings to other users',
                                            'To facilitate communication between seekers and listers',
                                            'To process subscription payments and manage broker plans',
                                            'To send transactional notifications via email and WhatsApp',
                                            'To improve platform features and user experience through analytics',
                                            'To enforce these Terms, prevent fraud, and ensure platform safety',
                                            'To comply with legal obligations, respond to legal requests, or exercise legal rights',
                                            'To contact you regarding your account, listings, or platform updates'
                                        ].map(item => (
                                            <li key={item} className="flex items-start gap-2"><span className="text-slate-400 mt-0.5">•</span>{item}</li>
                                        ))}
                                    </ul>
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900 mb-2">4.3 Data Sharing</p>
                                    <p>Your contact details (phone number, WhatsApp) included in room listings are visible to registered users of the Platform. We may share your data with third-party service providers (hosting, email delivery, image storage, analytics) solely to operate the Platform. We do not sell your personal data to third parties for marketing purposes.</p>
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900 mb-2">4.4 Data Retention</p>
                                    <p>We retain your data as long as your account is active. Upon account deletion, we may retain certain data for up to 90 days for backup and compliance purposes, after which it is permanently deleted from production systems.</p>
                                </div>
                            </div>
                        </section>

                        {/* Section 5 - CHAT - Critical section */}
                        <section id="chat-messaging" className="bg-white rounded-2xl border border-red-200 shadow-sm p-6 sm:p-8">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="bg-red-100 p-2 rounded-xl"><MessageSquare className="w-5 h-5 text-red-700" /></div>
                                <h2 className="text-xl font-bold text-slate-900">5. Chat &amp; Messaging</h2>
                            </div>
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5">
                                <div className="flex gap-3">
                                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-red-900 text-sm font-bold mb-1">⚠ Chats Are NOT End-to-End Encrypted</p>
                                        <p className="text-red-800 text-sm leading-relaxed">Messages sent through this Platform are stored on our servers and are <strong>not end-to-end encrypted</strong>. Platform administrators and authorized personnel may access message content for safety, moderation, fraud prevention, and legal compliance purposes. Do not share sensitive financial information, passwords, or confidential personal data through the chat system.</p>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-3 text-slate-700 text-sm leading-relaxed">
                                <p><span className="font-semibold text-slate-900">5.1 Message Storage:</span> All messages, contact leads, and chat conversations are stored on the Platform's servers. By using the messaging feature, you consent to this storage and the possibility of administrative review.</p>
                                <p><span className="font-semibold text-slate-900">5.2 No Confidentiality Guarantee:</span> The Platform does not guarantee the confidentiality of communications. You use the messaging system at your own risk and should avoid sharing sensitive personal, financial, or legal information through it.</p>
                                <p><span className="font-semibold text-slate-900">5.3 Prohibited Communication:</span> You must not use the messaging system to send spam, threats, offensive content, unauthorized advertisements, or communications that violate any law. We reserve the right to delete such messages and terminate accounts sending them.</p>
                                <p><span className="font-semibold text-slate-900">5.4 Contact Lead Tracking:</span> When you express interest in a listing, your contact details and inquiry are logged and visible to the listing owner. This data is retained as part of the platform's contact lead system.</p>
                                <p><span className="font-semibold text-slate-900">5.5 Legal Disclosure:</span> We may disclose chat records to law enforcement or judicial authorities if required by law or court order, without prior notice to you.</p>
                            </div>
                        </section>

                        {/* Section 6 */}
                        <section id="user-conduct" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="bg-orange-100 p-2 rounded-xl"><Shield className="w-5 h-5 text-orange-700" /></div>
                                <h2 className="text-xl font-bold text-slate-900">6. User Conduct</h2>
                            </div>
                            <div className="space-y-3 text-slate-700 text-sm leading-relaxed">
                                <p>You agree to use the Platform only for lawful purposes and in compliance with all applicable laws. You must not:</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                                    {[
                                        'Post false, misleading, or fraudulent listings',
                                        'Impersonate any person or entity',
                                        'Harass, threaten, or abuse other users',
                                        'Post discriminatory content based on religion, caste, gender, or ethnicity',
                                        'Solicit personal information from minors',
                                        'Engage in unauthorized data scraping or crawling',
                                        'Attempt to hack, disrupt, or overload the Platform',
                                        'Use the Platform for money laundering or illegal transactions',
                                        'Post pornographic or sexually explicit content',
                                        'Circumvent any subscription, paywall, or access restriction',
                                        'Advertise third-party services without approval',
                                        'Violate any third-party intellectual property rights'
                                    ].map(item => (
                                        <div key={item} className="flex items-start gap-2 bg-slate-50 rounded-lg px-3 py-2">
                                            <span className="text-red-400 font-bold mt-0.5 flex-shrink-0">✕</span>
                                            <span className="text-xs">{item}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>

                        {/* Section 7 */}
                        <section id="listings" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="bg-teal-100 p-2 rounded-xl"><FileText className="w-5 h-5 text-teal-700" /></div>
                                <h2 className="text-xl font-bold text-slate-900">7. Listings &amp; Content</h2>
                            </div>
                            <div className="space-y-3 text-slate-700 text-sm leading-relaxed">
                                <p><span className="font-semibold text-slate-900">7.1 Accuracy:</span> All room listings must contain accurate, truthful, and current information. Rent, deposit, availability date, room type, amenities, and location must reflect the actual property.</p>
                                <p><span className="font-semibold text-slate-900">7.2 Images:</span> All uploaded photos must be genuine images of the actual property. Stock photos, watermarked images, or images of third-party properties are prohibited.</p>
                                <p><span className="font-semibold text-slate-900">7.3 Approval Process:</span> Listings are subject to admin review before publication. We reserve the right to approve, reject, edit, or remove any listing at our sole discretion.</p>
                                <p><span className="font-semibold text-slate-900">7.4 License to Content:</span> By uploading content to the Platform (including photos, descriptions, and logos), you grant us a non-exclusive, royalty-free, worldwide licence to display, reproduce, and distribute that content solely for operating the Platform.</p>
                                <p><span className="font-semibold text-slate-900">7.5 Broker Listings:</span> Broker accounts are subject to subscription limits. Listings posted by brokers must disclose their brokerage status. Misrepresentation as a direct owner is grounds for immediate account termination.</p>
                            </div>
                        </section>

                        {/* Section 8 */}
                        <section id="privacy" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="bg-blue-100 p-2 rounded-xl"><Eye className="w-5 h-5 text-blue-700" /></div>
                                <h2 className="text-xl font-bold text-slate-900">8. Privacy &amp; Cookies</h2>
                            </div>
                            <div className="space-y-3 text-slate-700 text-sm leading-relaxed">
                                <p>Our full Privacy Policy governs how we collect and process your personal data. Key points are summarized below:</p>
                                <p><span className="font-semibold text-slate-900">8.1 Cookies:</span> We use cookies and similar tracking technologies to maintain sessions, remember preferences, and collect anonymous usage analytics. By using the Platform you consent to our use of cookies.</p>
                                <p><span className="font-semibold text-slate-900">8.2 Analytics:</span> We collect anonymized usage data to understand how the Platform is used and to improve our services. This may include page views, search terms, and device information.</p>
                                <p><span className="font-semibold text-slate-900">8.3 Push Notifications:</span> If you grant permission, we may send push notifications about new listings, messages, and platform updates. You may revoke this permission at any time through your browser or device settings.</p>
                                <p><span className="font-semibold text-slate-900">8.4 Your Rights:</span> Subject to applicable law, you have the right to access, correct, or request deletion of your personal data by contacting us at the email below. We will respond within 30 days.</p>
                            </div>
                        </section>

                        {/* Section 9 */}
                        <section id="intellectual-property" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="bg-yellow-100 p-2 rounded-xl"><Shield className="w-5 h-5 text-yellow-700" /></div>
                                <h2 className="text-xl font-bold text-slate-900">9. Intellectual Property</h2>
                            </div>
                            <div className="space-y-3 text-slate-700 text-sm leading-relaxed">
                                <p>All intellectual property rights in the Platform, including but not limited to software code, design, logos, trademarks, user interface, and original content are owned by or licensed to the Platform operator.</p>
                                <p>You may not reproduce, modify, distribute, display, create derivative works, or commercially exploit any part of the Platform without prior written authorization from us.</p>
                                <p>User-generated content (listings, photos, reviews) remains owned by the respective users, subject to the licence granted in Section 7.4 of these Terms.</p>
                            </div>
                        </section>

                        {/* Section 10 */}
                        <section id="liability" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="bg-red-100 p-2 rounded-xl"><AlertTriangle className="w-5 h-5 text-red-700" /></div>
                                <h2 className="text-xl font-bold text-slate-900">10. Liability &amp; Disclaimer</h2>
                            </div>
                            <div className="space-y-3 text-slate-700 text-sm leading-relaxed">
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                                    <p className="font-semibold text-slate-900 mb-2">Platform Provided "As Is"</p>
                                    <p>The Platform is provided on an "as is" and "as available" basis without any warranties of any kind, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement.</p>
                                </div>
                                <p><span className="font-semibold text-slate-900">10.1 No Liability for Transactions:</span> We are not responsible for any rental agreement, payment, dispute, injury, property damage, or loss arising from interactions between users on or off the Platform.</p>
                                <p><span className="font-semibold text-slate-900">10.2 No Liability for Data Breaches:</span> While we implement reasonable technical security measures, we cannot guarantee absolute security. We shall not be liable for any unauthorized access to or disclosure of your data resulting from circumstances beyond our reasonable control.</p>
                                <p><span className="font-semibold text-slate-900">10.3 Third-Party Content:</span> The Platform may contain links to third-party websites or services. We have no control over, and accept no responsibility for, the content or practices of those third parties.</p>
                                <p><span className="font-semibold text-slate-900">10.4 Limitation of Liability:</span> To the maximum extent permitted by applicable Indian law, our total aggregate liability to you for any claim arising out of or related to these Terms or your use of the Platform shall not exceed the greater of ₹500 (Indian Rupees Five Hundred) or the total fees paid by you to us in the 3 months preceding the claim.</p>
                            </div>
                        </section>

                        {/* Section 11 */}
                        <section id="termination" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="bg-gray-100 p-2 rounded-xl"><UserX className="w-5 h-5 text-gray-700" /></div>
                                <h2 className="text-xl font-bold text-slate-900">11. Account Termination</h2>
                            </div>
                            <div className="space-y-3 text-slate-700 text-sm leading-relaxed">
                                <p><span className="font-semibold text-slate-900">11.1 Termination by You:</span> You may delete your account at any time through your account settings. Deletion removes your profile and active listings. Certain data may be retained for legal compliance as described in Section 4.4.</p>
                                <p><span className="font-semibold text-slate-900">11.2 Termination by Us:</span> We reserve the right to suspend or permanently terminate your account immediately and without notice if you:</p>
                                <ul className="space-y-1.5 ml-4">
                                    {[
                                        'Violate any provision of these Terms',
                                        'Provide false or fraudulent information during registration or listing',
                                        'Engage in abusive, harassing, or illegal behaviour towards other users',
                                        "Attempt to manipulate or abuse the platform's systems",
                                        'Fail to pay applicable subscription fees',
                                        'Are found to be involved in money laundering or other criminal activity'
                                    ].map(item => (
                                        <li key={item} className="flex items-start gap-2"><span className="text-slate-400 mt-0.5">•</span>{item}</li>
                                    ))}
                                </ul>
                                <p><span className="font-semibold text-slate-900">11.3 Effect of Termination:</span> Upon termination, your right to use the Platform ceases immediately. We may retain your data as required by law and are not obligated to refund any subscription fees paid.</p>
                            </div>
                        </section>

                        {/* Section 12 */}
                        <section id="dispute" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="bg-blue-100 p-2 rounded-xl"><Scale className="w-5 h-5 text-blue-700" /></div>
                                <h2 className="text-xl font-bold text-slate-900">12. Dispute Resolution</h2>
                            </div>
                            <div className="space-y-3 text-slate-700 text-sm leading-relaxed">
                                <p><span className="font-semibold text-slate-900">12.1 Between Users:</span> The Platform does not mediate disputes between users (landlords, tenants, brokers). Any disputes arising from room rental transactions must be resolved directly between the parties involved.</p>
                                <p><span className="font-semibold text-slate-900">12.2 With the Platform:</span> If you have a dispute with us, please first contact us at {settings.supportEmail || 'our support email'} and allow 30 days for resolution. If unresolved, disputes may be resolved through internationally recognised arbitration or the courts of competent jurisdiction applicable in your region.</p>
                                <p><span className="font-semibold text-slate-900">12.3 Class Action Waiver:</span> You agree that any dispute resolution proceedings shall be conducted on an individual basis and not as part of a class or representative action.</p>
                            </div>
                        </section>

                        {/* Section 13 */}
                        <section id="governing-law" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="bg-slate-100 p-2 rounded-xl"><Scale className="w-5 h-5 text-slate-700" /></div>
                                <h2 className="text-xl font-bold text-slate-900">13. Governing Law</h2>
                            </div>
                            <div className="space-y-3 text-slate-700 text-sm leading-relaxed">
                                <p>This Platform operates globally and is accessible to users worldwide. These Terms shall be governed by internationally recognised principles of internet and e-commerce law. Users are responsible for ensuring their use of this Platform complies with the local laws applicable in their jurisdiction.</p>
                                <p>While the Platform operator is based in India and Indian law may apply to the operator's own obligations, users outside India agree that local mandatory consumer protection laws in their country of residence may also apply and are respected by this Platform.</p>
                                <p>Nothing in these Terms limits any rights you may have under the mandatory laws of your country of residence that cannot be excluded by contract.</p>
                            </div>
                        </section>

                        {/* Section 14 */}
                        <section id="changes" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="bg-cyan-100 p-2 rounded-xl"><Bell className="w-5 h-5 text-cyan-700" /></div>
                                <h2 className="text-xl font-bold text-slate-900">14. Changes to Terms</h2>
                            </div>
                            <div className="space-y-3 text-slate-700 text-sm leading-relaxed">
                                <p>We reserve the right to modify these Terms at any time. When we make material changes, we will update the "Effective Date" at the top of this page and, where reasonably practicable, notify you by email or via an in-platform notice.</p>
                                <p>Your continued use of the Platform after the effective date of any revision constitutes your acceptance of the revised Terms. If you do not agree to the revised Terms, you must stop using the Platform and may delete your account.</p>
                            </div>
                        </section>

                        {/* Section 15 */}
                        <section id="contact" className="bg-gradient-to-br from-blue-50 to-blue-50 rounded-2xl border border-blue-200 shadow-sm p-6 sm:p-8">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="bg-blue-100 p-2 rounded-xl"><HelpCircle className="w-5 h-5 text-blue-700" /></div>
                                <h2 className="text-xl font-bold text-slate-900">15. Contact Us</h2>
                            </div>
                            <div className="space-y-3 text-slate-700 text-sm leading-relaxed">
                                <p>If you have questions, concerns, or complaints about these Terms, our data practices, or any aspect of the Platform, please contact us:</p>
                                <div className="bg-white rounded-xl border border-blue-200 p-4 space-y-2">
                                    <p><span className="font-semibold text-slate-900">Platform Name:</span> {settings.businessName || 'Room Rental Platform'}</p>
                                    <p><span className="font-semibold text-slate-900">Support Email:</span>{' '}
                                        <a href={`mailto:${settings.supportEmail}`} className="text-blue-600 hover:underline">{settings.supportEmail}</a>
                                    </p>
                                    <p><span className="font-semibold text-slate-900">Jurisdiction:</span> Worldwide</p>
                                    <p><span className="font-semibold text-slate-900">Response Time:</span> As Soon as Possible</p>
                                </div>
                                <p className="text-xs text-slate-500">For urgent matters related to fraud, abuse, or illegal content, please mark your email subject as "URGENT - [Issue]".</p>
                            </div>
                        </section>

                        {/* Footer */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <p className="text-xs text-slate-500">Effective Date: <span className="font-medium text-slate-700">{EFFECTIVE_DATE}</span></p>
                                <p className="text-xs text-slate-500 mt-0.5">These terms apply to all users of {settings.businessName || 'this platform'} worldwide.</p>
                            </div>
                        </div>

                    </main>
                </div>
            </div>
        </div>
    );
}
