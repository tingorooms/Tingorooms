import { useState, useRef } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { acceptInvitationAfterRegistration } from '@/services/roommateService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { useSiteSettings } from '@/context/SiteSettingsContext';

const VerifyOTPPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { verifyOTP, resendOTP, login } = useAuth();
    const { settings } = useSiteSettings();
    const email = (location.state as any)?.email || '';
    const role = (location.state as any)?.role || '';
    const name = (location.state as any)?.name || '';
    const invitationToken = (location.state as any)?.invitationToken || '';
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [showBrokerSuccessModal, setShowBrokerSuccessModal] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const handleBrokerModalClose = () => {
        setShowBrokerSuccessModal(false);
        navigate('/login', { replace: true });
    };

    const handleChange = (index: number, value: string) => {
        if (value.length > 1) return;
        
        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const otpString = otp.join('');
        if (otpString.length !== 6) {
            setError('Please enter complete OTP');
            return;
        }

        setIsLoading(true);

        try {
            await verifyOTP(email, otpString);

            if (invitationToken) {
                try {
                    await acceptInvitationAfterRegistration(invitationToken, email);
                } catch (inviteErr: any) {
                    // Invitation acceptance failed, but continue
                }
            }

            // Handle post-verification based on role
            if (role === 'Broker') {
                // Show success modal for brokers (pending approval)
                setShowBrokerSuccessModal(true);
            } else {
                // For members, log in and redirect to dashboard (or chat context if present)
                // Try to get password from location.state if present (for chat/quick flows)
                const password = (location.state as any)?.password || '';
                if (!password) {
                    // fallback: try tempPassword or ask user to login manually
                    navigate('/login', {
                        state: {
                            message: 'Email verified successfully! Please login to continue.',
                            type: 'success'
                        }
                    });
                    return;
                }
                try {
                    await login({ email, password });
                } catch {
                    navigate('/login', {
                        state: {
                            message: 'Email verified, but automatic login failed. Please login manually.',
                            type: 'success'
                        }
                    });
                    return;
                }
                // If chat context is present, redirect back to chat
                const chatIntent = (location.state as any)?.chatIntent;
                if (chatIntent && chatIntent.roomId && chatIntent.receiverId) {
                    const fromPath = (location.state as any)?.from?.pathname || `/room/${chatIntent.roomId}`;
                    const fromSearch = (location.state as any)?.from?.search || '';
                    const params = new URLSearchParams(fromSearch.startsWith('?') ? fromSearch.slice(1) : fromSearch);
                    params.set('startChat', '1');
                    params.set('receiverId', String(chatIntent.receiverId));
                    navigate(`${fromPath}?${params.toString()}`, { replace: true });
                } else {
                    navigate('/dashboard', { replace: true });
                }
            }
        } catch (err: any) {
            setError(err?.response?.data?.message || 'OTP verification failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResend = async () => {
        setIsResending(true);
        try {
            await resendOTP(email);
            setError('');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to resend OTP');
        } finally {
            setIsResending(false);
        }
    };

    if (!email) {
        return <Navigate to="/register" replace />;
    }

    return (
        <div className="w-full max-w-md mx-auto">
                <Card className="border border-blue-100 shadow-xl">
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-2xl text-center">Verify Your Email</CardTitle>
                        <CardDescription className="text-center">
                            Enter the 6-digit OTP sent to<br />
                            <strong>{email}</strong>
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {error && (
                            <Alert variant="destructive" className="mb-4">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="flex justify-center gap-2">
                                {otp.map((digit, index) => (
                                    <Input
                                        key={index}
                                        ref={(el) => { inputRefs.current[index] = el; }}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={digit}
                                        onChange={(e) => handleChange(index, e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(index, e)}
                                        className="w-12 h-12 text-center text-2xl font-bold"
                                    />
                                ))}
                            </div>

                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Verifying...
                                    </>
                                ) : (
                                    'Verify OTP'
                                )}
                            </Button>
                        </form>
                    </CardContent>
                    <CardFooter className="flex flex-col space-y-4">
                        <div className="text-sm text-center text-muted-foreground">
                            Didn't receive the code?{' '}
                            <button
                                onClick={handleResend}
                                disabled={isResending}
                                className="text-primary hover:underline disabled:opacity-50"
                            >
                                {isResending ? 'Resending...' : 'Resend OTP'}
                            </button>
                        </div>
                    </CardFooter>
                </Card>

            {/* Broker Success Modal */}
            <AlertDialog open={showBrokerSuccessModal} onOpenChange={setShowBrokerSuccessModal}>
                <AlertDialogContent className="max-w-md">
                    <AlertDialogHeader>
                        <div className="flex justify-center mb-4">
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                                <CheckCircle2 className="w-8 h-8 text-blue-600" />
                            </div>
                        </div>
                        <AlertDialogTitle className="text-center text-2xl">Email Verified!</AlertDialogTitle>
                    </AlertDialogHeader>
                    <AlertDialogDescription className="space-y-4 text-center">
                        <div className="space-y-2">
                            <p className="text-lg font-semibold text-foreground">
                                Welcome, {name}!
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Your broker account has been verified successfully.
                            </p>
                        </div>
                        
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                            <p className="text-sm font-semibold text-blue-900">
                                What happens next?
                            </p>
                            <ul className="text-xs text-blue-800 space-y-1 text-left">
                                <li>✓ Your account is under admin review</li>
                                <li>✓ You will receive an email once approved</li>
                                <li>✓ Login with your credentials after approval</li>
                                <li>✓ Your plan details have been saved</li>
                            </ul>
                        </div>

                        <div className="bg-muted/50 border border-border rounded-lg p-3 space-y-1">
                            <p className="text-xs font-medium text-foreground">
                                Need help?
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Contact support team:{' '}
                                <a 
                                    href={`mailto:${settings.supportEmail || 'support@pumeroom.com'}`}
                                    className="text-primary hover:underline font-medium"
                                >
                                    {settings.supportEmail || 'support@pumeroom.com'}
                                </a>
                            </p>
                        </div>

                        <p className="text-xs text-muted-foreground">
                            You can now login once your account is approved by admin.
                        </p>
                    </AlertDialogDescription>
                    <AlertDialogAction onClick={handleBrokerModalClose} className="w-full">
                        OK, Got it!
                    </AlertDialogAction>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default VerifyOTPPage;
