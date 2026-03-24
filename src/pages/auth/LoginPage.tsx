import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Eye, EyeOff, Loader2, CheckCircle2, Mail, Lock, ArrowRight } from 'lucide-react';

const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();
    
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState((location.state as any)?.message || '');
    const [isLoading, setIsLoading] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [registerPromptEmail, setRegisterPromptEmail] = useState('');

    // Refs for scrolling to invalid fields
    const emailRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);

    const fromPath = (location.state as any)?.from?.pathname || '/dashboard';
    const fromSearch = (location.state as any)?.from?.search || '';
    const chatIntent = (location.state as any)?.chatIntent;
    const from = `${fromPath}${fromSearch}`;
    const registerPath = fromPath === '/accept-invite' && fromSearch
        ? `/register${fromSearch}`
        : '/register';

    const validateEmail = (email: string): string => {
        if (!email.trim()) return 'Email is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email address';
        return '';
    };

    const validatePassword = (password: string): string => {
        if (!password) return 'Password is required';
        return '';
    };

    const handleEmailChange = (value: string) => {
        setEmail(value);
        const error = validateEmail(value);
        if (error) {
            setFieldErrors(prev => ({ ...prev, email: error }));
        } else {
            setFieldErrors(prev => ({ ...prev, email: '' }));
        }
    };

    const handlePasswordChange = (value: string) => {
        setPassword(value);
        const error = validatePassword(value);
        if (error) {
            setFieldErrors(prev => ({ ...prev, password: error }));
        } else {
            setFieldErrors(prev => ({ ...prev, password: '' }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');
        
        // Validate all fields
        const emailError = validateEmail(email);
        const passwordError = validatePassword(password);
        
        setFieldErrors({
            email: emailError,
            password: passwordError
        });

        if (emailError || passwordError) {
            // Scroll to the first invalid field
            if (emailError && emailRef.current) {
                setTimeout(() => {
                    emailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    emailRef.current?.focus();
                }, 100);
            } else if (passwordError && passwordRef.current) {
                setTimeout(() => {
                    passwordRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    passwordRef.current?.focus();
                }, 100);
            }
            return;
        }

        setIsLoading(true);

        try {
            const response = await login({ email, password });
            
            // Role-based redirection
            if (response?.user?.role === 'Admin') {
                navigate('/admin', { replace: true });
            } else {
                navigate(from, { replace: true });
            }
        } catch (err: any) {
            const apiData = err.response?.data;
            if (apiData?.data?.requiresRegistration) {
                setRegisterPromptEmail(apiData?.data?.email || email);
                return;
            }

            const errorMsg = apiData?.message || 'Login failed. Please try again.';
            setError(errorMsg);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (successMessage) {
            const timer = setTimeout(() => setSuccessMessage(''), 5000);
            return () => clearTimeout(timer);
        }
    }, [successMessage]);

    return (
        <div className="w-full">
            <Card className="backdrop-blur-sm bg-white shadow-xl border border-blue-100 overflow-hidden">
                    {/* Gradient top border */}
                    <div className="h-1 bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700"></div>
                    
                    <CardHeader className="space-y-2 pb-6 pt-8">
                        <CardTitle className="text-3xl text-center font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                            Welcome Back
                        </CardTitle>
                        <CardDescription className="text-center text-base text-gray-600">
                            Sign in to continue your journey
                        </CardDescription>
                    </CardHeader>
                    
                    <CardContent className="px-8 pb-8">
                        {/* Success Message */}
                        {successMessage && (
                            <Alert className="mb-6 border-blue-200 bg-gradient-to-r from-blue-50 to-blue-50 animate-in fade-in slide-in-from-top-2 duration-500">
                                <CheckCircle2 className="h-5 w-5 text-blue-600" />
                                <AlertDescription className="text-green-800 font-medium ml-2">
                                    {successMessage}
                                </AlertDescription>
                            </Alert>
                        )}
                        
                        {/* Error Message */}
                        {error && (
                            <div className="mb-6 border border-red-200 bg-gradient-to-r from-red-50 to-rose-50 rounded-lg p-4 animate-in fade-in slide-in-from-top-2 duration-500">
                                <div className="flex items-start gap-3">
                                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse flex-shrink-0 mt-1.5"></div>
                                    <span className="text-red-800 font-medium text-sm leading-relaxed block">
                                        {error}
                                    </span>
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Email Field */}
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                    <Mail className="w-4 h-4 text-blue-500" />
                                    Email Address
                                </Label>
                                <div className="relative group">
                                    <Input
                                        ref={emailRef}
                                        id="email"
                                        type="email"
                                        placeholder="you@example.com"
                                        value={email}
                                        onChange={(e) => handleEmailChange(e.target.value)}
                                        className={`h-12 pl-4 pr-12 text-base transition-all duration-300 ${
                                            fieldErrors.email 
                                                ? 'border-red-300 bg-red-50/50 focus:border-red-500 focus:ring-red-500/20' 
                                                : email 
                                                ? 'border-green-300 bg-blue-50/50 focus:border-green-500 focus:ring-green-500/20'
                                                : 'border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 group-hover:border-gray-300'
                                        } rounded-xl`}
                                        required
                                    />
                                    {email && !fieldErrors.email && (
                                        <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-600 animate-in zoom-in duration-300" />
                                    )}
                                </div>
                                {fieldErrors.email && (
                                    <p className="text-sm text-red-600 flex items-center gap-2 animate-in slide-in-from-top-1 duration-300">
                                        <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span>
                                        {fieldErrors.email}
                                    </p>
                                )}
                            </div>

                            {/* Password Field */}
                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                    <Lock className="w-4 h-4 text-blue-500" />
                                    Password
                                </Label>
                                <div className="relative group">
                                    <Input
                                        ref={passwordRef}
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Enter your password"
                                        value={password}
                                        onChange={(e) => handlePasswordChange(e.target.value)}
                                        className={`h-12 pl-4 pr-12 text-base transition-all duration-300 ${
                                            fieldErrors.password 
                                                ? 'border-red-300 bg-red-50/50 focus:border-red-500 focus:ring-red-500/20' 
                                                : password 
                                                ? 'border-green-300 bg-blue-50/50 focus:border-green-500 focus:ring-green-500/20'
                                                : 'border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 group-hover:border-gray-300'
                                        } rounded-xl`}
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                                {fieldErrors.password && (
                                    <p className="text-sm text-red-600 flex items-center gap-2 animate-in slide-in-from-top-1 duration-300">
                                        <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span>
                                        {fieldErrors.password}
                                    </p>
                                )}
                            </div>

                            <div className="flex items-center justify-end">
                                <Link 
                                    to="/forgot-password" 
                                    className="text-sm font-medium text-blue-500 hover:text-blue-600 hover:underline transition-colors"
                                >
                                    Forgot password?
                                </Link>
                            </div>

                            <Button 
                                type="submit" 
                                className="w-full h-12 text-base font-semibold bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-500 shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl group" 
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                        Signing in...
                                    </>
                                ) : (
                                    <>
                                        Sign In
                                        <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                    
                    <CardFooter className="bg-gradient-to-r from-gray-50 to-slate-50 py-6 px-8">
                        <div className="text-sm text-center text-gray-600 w-full">
                            Don't have an account?{' '}
                            <Link 
                                to="/register" 
                                state={{
                                    from: (location.state as any)?.from,
                                    chatIntent,
                                }}
                                className="font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                            >
                                Create Account
                            </Link>
                        </div>
                    </CardFooter>
                </Card>

            <AlertDialog open={!!registerPromptEmail} onOpenChange={(open) => !open && setRegisterPromptEmail('')}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>User Not Registered</AlertDialogTitle>
                        <AlertDialogDescription>
                            This email is not registered yet. Continue to register and then proceed.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogAction
                        onClick={() => {
                            navigate(registerPath, {
                                state: {
                                    prefillEmail: registerPromptEmail,
                                    from: (location.state as any)?.from,
                                    chatIntent,
                                }
                            });
                        }}
                    >
                        OK, Register And Continue
                    </AlertDialogAction>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default LoginPage;
