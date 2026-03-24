import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Mail, Phone, MapPin, Send, CheckCircle2, Loader2 } from 'lucide-react';
import { useSiteSettings } from '@/context/SiteSettingsContext';
import { toast } from 'sonner';
import { submitContactForm } from '@/services/contactService';

const validateContactForm = (formData: {
    name: string;
    email: string;
    phone: string;
    subject: string;
    message: string;
}) => {
    if (formData.name.trim().length < 2) {
        return 'Please enter your full name.';
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
        return 'Please enter a valid email address.';
    }

    if (formData.phone.trim() && !/^[0-9+()\-\s]{7,20}$/.test(formData.phone.trim())) {
        return 'Please enter a valid phone number.';
    }

    if (formData.subject.trim().length < 3) {
        return 'Subject must be at least 3 characters.';
    }

    if (formData.message.trim().length < 20) {
        return 'Message must be at least 20 characters so we can help properly.';
    }

    return null;
};

const ContactPage: React.FC = () => {
    const { settings } = useSiteSettings();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        subject: '',
        message: '',
        website: ''
    });
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formStartedAt, setFormStartedAt] = useState(() => Date.now());

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const validationError = validateContactForm(formData);
        if (validationError) {
            toast.error(validationError);
            return;
        }

        try {
            setIsSubmitting(true);
            const message = await submitContactForm({
                name: formData.name.trim(),
                email: formData.email.trim(),
                phone: formData.phone.trim(),
                subject: formData.subject.trim(),
                message: formData.message.trim(),
                website: formData.website,
                sourcePage: typeof window !== 'undefined' ? window.location.pathname : '/contact',
                formElapsedMs: Date.now() - formStartedAt,
            });

            setIsSubmitted(true);
            setFormData({
                name: '',
                email: '',
                phone: '',
                subject: '',
                message: '',
                website: ''
            });
            setFormStartedAt(Date.now());
            toast.success(message);
        } catch (error) {
            toast.error('Failed to send your message. Please try again in a moment.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    return (
        <div className="container mx-auto px-4 py-0 md:py-4">
            <div className="text-center mb-6">
                <h1 className="text-3xl font-bold mb-4">Contact Us</h1>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                    Have questions or need help? We're here for you. Reach out to our team.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
                {/* Contact Info */}
                <div className="space-y-6">
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                                    <Mail className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-semibold">Email</h3>
                                    <p className="text-sm text-muted-foreground">{settings.supportEmail}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                                    <Phone className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-semibold">Phone</h3>
                                    <p className="text-sm text-muted-foreground">{settings.supportPhone}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                                    <MapPin className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-semibold">Address</h3>
                                    <p className="text-sm text-muted-foreground">
                                        {settings.supportAddress}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Contact Form */}
                <Card className="lg:col-span-2">
                    <CardContent className="p-6">
                        {isSubmitted ? (
                            <div className="text-center py-12">
                                <CheckCircle2 className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                                <h3 className="text-xl font-bold mb-2">Message Sent!</h3>
                                <p className="text-muted-foreground">
                                    Thank you for reaching out. We'll get back to you soon.
                                </p>
                                <Button
                                    variant="outline"
                                    className="mt-6"
                                    onClick={() => {
                                        setIsSubmitted(false);
                                        setFormStartedAt(Date.now());
                                    }}
                                >
                                    Send Another Message
                                </Button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
                                    <Label htmlFor="website">Website</Label>
                                    <Input
                                        id="website"
                                        name="website"
                                        tabIndex={-1}
                                        autoComplete="off"
                                        value={formData.website}
                                        onChange={handleChange}
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Your Name</Label>
                                        <Input
                                            id="name"
                                            name="name"
                                            placeholder="John Doe"
                                            value={formData.name}
                                            onChange={handleChange}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="email">Email Address</Label>
                                        <Input
                                            id="email"
                                            name="email"
                                            type="email"
                                            placeholder="john@example.com"
                                            value={formData.email}
                                            onChange={handleChange}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="phone">Phone Number</Label>
                                        <Input
                                            id="phone"
                                            name="phone"
                                            placeholder="9876543210"
                                            value={formData.phone}
                                            onChange={handleChange}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="subject">Subject</Label>
                                        <Input
                                            id="subject"
                                            name="subject"
                                            placeholder="How can we help?"
                                            value={formData.subject}
                                            onChange={handleChange}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="message">Message</Label>
                                    <Textarea
                                        id="message"
                                        name="message"
                                        placeholder="Tell us more about your query..."
                                        rows={6}
                                        value={formData.message}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>

                                <Button type="submit" className="w-full" disabled={isSubmitting}>
                                    {isSubmitting ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <Send className="w-4 h-4 mr-2" />
                                    )}
                                    {isSubmitting ? 'Sending...' : 'Send Message'}
                                </Button>
                            </form>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default ContactPage;
