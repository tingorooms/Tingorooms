import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2 } from 'lucide-react';

const ResetPasswordPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { resetPassword } = useAuth();
    
    const token = searchParams.get('token') || '';
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setIsLoading(true);

        try {
            await resetPassword(token, password);
            setIsSuccess(true);
            setTimeout(() => {
                navigate('/login');
            }, 3000);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to reset password. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="w-full max-w-md mx-auto">
                    <Card className="border border-blue-100 shadow-xl">
                        <CardContent className="p-6 text-center">
                            <Alert variant="destructive" className="mb-4">
                                <AlertDescription>Invalid or missing reset token</AlertDescription>
                            </Alert>
                            <Link to="/forgot-password">
                                <Button className="w-full">Request New Link</Button>
                            </Link>
                        </CardContent>
                    </Card>
            </div>
        );
    }

    if (isSuccess) {
        return (
            <div className="w-full max-w-md mx-auto">
                    <Card className="border border-blue-100 shadow-xl">
                        <CardContent className="p-6 text-center">
                            <CheckCircle2 className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                            <h2 className="text-2xl font-bold mb-2">Password Reset Successful</h2>
                            <p className="text-muted-foreground mb-4">
                                Your password has been reset successfully. Redirecting to login...
                            </p>
                        </CardContent>
                    </Card>
            </div>
        );
    }

    return (
        <div className="w-full max-w-md mx-auto">
                <Card className="border border-blue-100 shadow-xl">
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-2xl text-center">Reset Password</CardTitle>
                        <CardDescription className="text-center">
                            Enter your new password
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {error && (
                            <Alert variant="destructive" className="mb-4">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="password">New Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="Enter new password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirm Password</Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    placeholder="Confirm new password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                />
                            </div>

                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Resetting...
                                    </>
                                ) : (
                                    'Reset Password'
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
        </div>
    );
};

export default ResetPasswordPage;
