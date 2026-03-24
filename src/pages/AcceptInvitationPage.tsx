import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, Loader2, LogIn, UserPlus, AlertCircle, Home } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { acceptInvitation } from '@/services/roommateService';
import { toast } from 'sonner';

const AcceptInvitationPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { isAuthenticated, isLoading, user } = useAuth();
    const [searchParams] = useSearchParams();

    const token = searchParams.get('token')?.trim() || '';
    const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState(((location as any)?.state as any)?.message || '');
    const [groupId, setGroupId] = useState('');

    const invitationLocation = useMemo(() => ({
        pathname: '/accept-invite',
        search: token ? `?token=${encodeURIComponent(token)}` : ''
    }), [token]);

    useEffect(() => {
        const run = async () => {
            if (isLoading) return;

            if (!token) {
                setStatus('error');
                setMessage('Invitation link is invalid or missing token.');
                return;
            }

            if (!isAuthenticated) {
                setStatus('idle');
                return;
            }

            try {
                setStatus('processing');
                const response = await acceptInvitation(token);
                setGroupId(response.groupId);
                setStatus('success');
                setMessage('Invitation accepted. You joined the roommate group successfully.');
                toast.success('Invitation accepted. You joined the roommate group.');
            } catch (error: any) {
                const errorMessage = error?.response?.data?.message || 'Failed to accept invitation.';
                setStatus('error');
                setMessage(errorMessage);
                toast.error(errorMessage);
            }
        };

        run();
    }, [token, isAuthenticated, isLoading]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-xl shadow-xl">
                <CardHeader>
                    <CardTitle className="text-2xl">Roommate Invitation</CardTitle>
                    <CardDescription>Accept your invitation to join the roommate group.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isLoading && (
                        <div className="flex items-center gap-3 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Checking your login status...
                        </div>
                    )}

                    {!isLoading && !token && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{message || 'Invalid invitation link.'}</AlertDescription>
                        </Alert>
                    )}

                    {!isLoading && token && !isAuthenticated && (
                        <>
                            <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    Please login or register first, then we will accept this invitation for your account.
                                </AlertDescription>
                            </Alert>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <Button
                                    className="flex-1"
                                    onClick={() => navigate('/login', {
                                        state: {
                                            from: invitationLocation,
                                            message: 'Please login to accept your roommate invitation.'
                                        }
                                    })}
                                >
                                    <LogIn className="w-4 h-4 mr-2" />
                                    Login
                                </Button>
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => navigate(token ? `/register?token=${encodeURIComponent(token)}` : '/register', {
                                        state: {
                                            from: invitationLocation
                                        }
                                    })}
                                >
                                    <UserPlus className="w-4 h-4 mr-2" />
                                    Register
                                </Button>
                            </div>
                        </>
                    )}

                    {!isLoading && isAuthenticated && status === 'processing' && (
                        <div className="flex items-center gap-3 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Accepting invitation...
                        </div>
                    )}

                    {!isLoading && isAuthenticated && status === 'success' && (
                        <>
                            <Alert className="border-green-200 bg-blue-50 text-blue-900">
                                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                                <AlertDescription>
                                    {message}
                                    {groupId ? ` Group ID: ${groupId}` : ''}
                                </AlertDescription>
                            </Alert>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <Button className="flex-1" onClick={() => navigate('/dashboard/roommates')}>
                                    Go To Roommate Group
                                </Button>
                                <Button variant="outline" className="flex-1" onClick={() => navigate('/dashboard')}>
                                    Open Dashboard
                                </Button>
                            </div>
                        </>
                    )}

                    {!isLoading && isAuthenticated && status === 'error' && (
                        <>
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{message}</AlertDescription>
                            </Alert>
                            <div className="text-sm text-muted-foreground">
                                Logged in as: <span className="font-medium">{user?.email || '-'}</span>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <Button variant="outline" className="flex-1" onClick={() => navigate('/dashboard')}>
                                    <Home className="w-4 h-4 mr-2" />
                                    Dashboard
                                </Button>
                                <Button
                                    className="flex-1"
                                    onClick={() => navigate('/login', {
                                        state: {
                                            from: invitationLocation,
                                            message: 'Login with the invited email address to accept the invitation.'
                                        }
                                    })}
                                >
                                    <LogIn className="w-4 h-4 mr-2" />
                                    Login With Different Account
                                </Button>
                            </div>
                        </>
                    )}

                    <div className="pt-2 text-center">
                        <Link to="/" className="text-sm text-muted-foreground hover:underline">
                            Back to home
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default AcceptInvitationPage;
