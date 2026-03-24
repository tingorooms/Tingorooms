import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2 } from 'lucide-react';

const ForgotPasswordPage: React.FC = () => {
    const { forgotPassword } = useAuth();
    
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await forgotPassword(email);
            setIsSuccess(true);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to send reset link. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="w-full max-w-md mx-auto">
                    <Card className="border border-blue-100 shadow-xl">
                        <CardContent className="p-6 text-center">
                            <CheckCircle2 className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                            <h2 className="text-2xl font-bold mb-2">Check Your Email</h2>
                            <p className="text-muted-foreground mb-4">
                                We've sent a password reset link to<br />
                                <strong>{email}</strong>
                            </p>
                            <Link to="/login">
                                <Button className="w-full">Back to Login</Button>
                            </Link>
                        </CardContent>
                    </Card>
            </div>
        );
    }

    return (
        <div className="w-full max-w-md mx-auto">
                <Card className="border border-blue-100 shadow-xl">
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-2xl text-center">Forgot Password</CardTitle>
                        <CardDescription className="text-center">
                            Enter your email and we'll send you a reset link
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
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="Enter your email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>

                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    'Send Reset Link'
                                )}
                            </Button>
                        </form>
                    </CardContent>
                    <CardFooter>
                        <div className="text-sm text-center text-muted-foreground w-full">
                            Remember your password?{' '}
                            <Link to="/login" className="text-primary hover:underline">
                                Login
                            </Link>
                        </div>
                    </CardFooter>
                </Card>
        </div>
    );
};

export default ForgotPasswordPage;
