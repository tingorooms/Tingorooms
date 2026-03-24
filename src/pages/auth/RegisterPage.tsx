import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Loader2, AlertCircle, CheckCircle2, Plus, X } from 'lucide-react';
import axios from 'axios';

const RegisterPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const { register } = useAuth();
    const invitationToken = searchParams.get('token') || '';
    const prefillEmail = (location.state as any)?.prefillEmail || '';
    const from = (location.state as any)?.from;
    const chatIntent = (location.state as any)?.chatIntent;
    
    const [formData, setFormData] = useState({
        name: '',
        email: prefillEmail,
        contact: '',
        gender: 'Male',
        pincode: '',
        password: '',
        confirmPassword: '',
        role: 'Member',
        brokerArea: '',
        selectedPlanId: ''
    });
    
    const [brokerAreas, setBrokerAreas] = useState<string[]>([]);
    const [currentArea, setCurrentArea] = useState('');
    const [showAreaSuggestions, setShowAreaSuggestions] = useState(false);
    const [filteredAreaSuggestions, setFilteredAreaSuggestions] = useState<string[]>([]);
    const [brokerPlans, setBrokerPlans] = useState<any[]>([]);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingPlans, setLoadingPlans] = useState(false);
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    // Common area suggestions (can be extended or fetched from API)
    const areaSuggestions = [
        'Nigdi', 'Katraj', 'Kothrud', 'Hinjewadi', 'Wakad', 'Baner',
        'Aundh', 'Pimple Saudagar', 'Pimple Nilakh', 'Hadapsar', 'Magarpatta',
        'Viman Nagar', 'Koregaon Park', 'Shivajinagar', 'Deccan', 'FC Road',
        'Swargate', 'Warje', 'Karve Nagar', 'Kharadi', 'Pune Station',
        'Camp', 'Kondhwa', 'NIBM', 'Undri', 'Pimpri', 'Chinchwad',
        'Akurdi', 'Bhosari', 'Chakan', 'Talegaon', 'Balewadi', 'Sus',
        'Pashan', 'Bavdhan', 'Kothrud', 'Narhe', 'Dhayari', 'Sinhagad Road',
        'Market Yard', 'Bibwewadi', 'Salisbury Park', 'Parvati', 'Sadashiv Peth',
        'Raviwar Peth', 'Somwar Peth', 'Mangalwar Peth', 'Budhwar Peth',
        'Kasba Peth', 'Nana Peth', 'Ganj Peth', 'Guruwar Peth', 'Shukrawar Peth',
        'Yerawada', 'Kalyani Nagar', 'Wadgaon Sheri', 'Dhanori', 'Lohegaon'
    ];

    // Refs for scrolling to invalid fields
    const nameRef = useRef<HTMLInputElement>(null);
    const emailRef = useRef<HTMLInputElement>(null);
    const contactRef = useRef<HTMLInputElement>(null);
    const pincodeRef = useRef<HTMLInputElement>(null);
    const genderRef = useRef<HTMLDivElement>(null);
    const planRef = useRef<HTMLDivElement>(null);
    const brokerAreaRef = useRef<HTMLDivElement>(null);
    const areaInputRef = useRef<HTMLInputElement>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);
    const confirmPasswordRef = useRef<HTMLInputElement>(null);
    const termsRef = useRef<HTMLDivElement>(null);

    // Fetch broker plans when role changes to Broker
    useEffect(() => {
        if (formData.role === 'Broker') {
            const fetchBrokerPlans = async () => {
                try {
                    setLoadingPlans(true);
                    const response = await axios.get('http://localhost:5000/api/subscriptions/plans?type=Broker');
                    setBrokerPlans(response.data || []);
                } catch (err) {
                    setBrokerPlans([]);
                } finally {
                    setLoadingPlans(false);
                }
            };
            fetchBrokerPlans();
        } else {
            setBrokerPlans([]);
            setBrokerAreas([]);
            setCurrentArea('');
            setShowAreaSuggestions(false);
            setFormData(prev => ({ ...prev, selectedPlanId: '' }));
        }
    }, [formData.role]);

    // Handle area input change and filter suggestions
    useEffect(() => {
        if (currentArea.trim().length > 0) {
            const filtered = areaSuggestions.filter(area =>
                area.toLowerCase().includes(currentArea.toLowerCase()) &&
                !brokerAreas.includes(area)
            );
            setFilteredAreaSuggestions(filtered);
            setShowAreaSuggestions(filtered.length > 0);
        } else {
            setShowAreaSuggestions(false);
            setFilteredAreaSuggestions([]);
        }
    }, [currentArea, brokerAreas]);

    // Close suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                suggestionsRef.current &&
                !suggestionsRef.current.contains(event.target as Node) &&
                areaInputRef.current &&
                !areaInputRef.current.contains(event.target as Node)
            ) {
                setShowAreaSuggestions(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Field validation helper functions
    const validateName = (name: string): string => {
        if (!name.trim()) return 'Full name is required';
        if (name.trim().length < 2) return 'Name must be at least 2 characters';
        if (!/^[a-zA-Z\s]+$/.test(name)) return 'Name should only contain letters and spaces';
        return '';
    };

    const validateEmail = (email: string): string => {
        if (!email.trim()) return 'Email is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email address';
        return '';
    };

    const validateContact = (contact: string): string => {
        if (!contact) return 'Phone number is required';
        if (!/^[6-9]\d{9}$/.test(contact)) return 'Phone number must be 10 digits and start with 6-9';
        return '';
    };

    const validatePincode = (pincode: string): string => {
        if (!pincode) return 'PIN code is required';
        if (!/^\d{6}$/.test(pincode)) return 'PIN code must be exactly 6 digits';
        return '';
    };

    const validatePassword = (password: string): string => {
        if (!password) return 'Password is required';
        return '';
    };

    const getPasswordStrength = (password: string): { score: number; label: string; barColor: string; textColor: string } | null => {
        if (!password) return null;
        let score = 0;
        if (password.length >= 8) score++;
        if (password.length >= 12) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;
        if (score <= 1) return { score: 1, label: 'Weak', barColor: 'bg-red-500', textColor: 'text-red-600' };
        if (score <= 3) return { score: 2, label: 'Medium', barColor: 'bg-yellow-500', textColor: 'text-yellow-600' };
        return { score: 3, label: 'Strong', barColor: 'bg-green-500', textColor: 'text-green-600' };
    };

    const validateConfirmPassword = (password: string, confirmPassword: string): string => {
        if (!confirmPassword) return 'Confirm password is required';
        if (password !== confirmPassword) return 'Passwords do not match';
        return '';
    };

    const validateGender = (gender: string): string => {
        if (!gender) return 'Gender is required';
        return '';
    };

    const validateBrokerPlan = (role: string, planId: string): string => {
        if (role === 'Broker' && !planId) return 'Please select a broker plan to continue';
        return '';
    };

    const validateBrokerArea = (role: string, areas: string[]): string => {
        if (role === 'Broker' && areas.length === 0) return 'Please add at least one area you cover';
        return '';
    };

    const validateTerms = (terms: boolean): string => {
        if (!terms) return 'You must accept the Terms & Conditions to register';
        return '';
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        let finalValue = value;
        let error = '';

        if (name === 'contact' || name === 'pincode') {
            finalValue = value.replace(/\D/g, '');
        }

        // Real-time validation
        if (name === 'name') {
            error = validateName(finalValue);
        } else if (name === 'email') {
            error = validateEmail(finalValue);
        } else if (name === 'contact') {
            error = validateContact(finalValue);
        } else if (name === 'pincode') {
            error = validatePincode(finalValue);
        } else if (name === 'password') {
            error = validatePassword(finalValue);
            // Also check confirmPassword if it exists
            if (formData.confirmPassword && finalValue !== formData.confirmPassword) {
                setFieldErrors(prev => ({ ...prev, confirmPassword: 'Passwords do not match' }));
            } else if (formData.confirmPassword) {
                setFieldErrors(prev => ({ ...prev, confirmPassword: '' }));
            }
        } else if (name === 'confirmPassword') {
            error = validateConfirmPassword(formData.password, finalValue);
        }

        setFormData({ ...formData, [name]: finalValue });
        
        if (error) {
            setFieldErrors(prev => ({ ...prev, [name]: error }));
        } else {
            setFieldErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const handleRoleChange = (value: string) => {
        setFormData({ ...formData, role: value, selectedPlanId: '' });
        // Clear broker plan error when role changes
        setFieldErrors(prev => ({ ...prev, selectedPlanId: '' }));
    };

    const handlePlanSelect = (planId: string) => {
        setFormData({ ...formData, selectedPlanId: planId });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const newErrors: Record<string, string> = {};

        // Validate all fields
        newErrors.name = validateName(formData.name);
        newErrors.email = validateEmail(formData.email);
        newErrors.contact = validateContact(formData.contact);
        newErrors.pincode = validatePincode(formData.pincode);
        newErrors.gender = validateGender(formData.gender);
        newErrors.password = validatePassword(formData.password);
        newErrors.confirmPassword = validateConfirmPassword(formData.password, formData.confirmPassword);
        newErrors.selectedPlanId = validateBrokerPlan(formData.role, formData.selectedPlanId);
        newErrors.brokerArea = validateBrokerArea(formData.role, brokerAreas);
        newErrors.acceptTerms = validateTerms(acceptedTerms);

        // Set field errors
        setFieldErrors(newErrors);

        // Check if there are any errors
        const hasErrors = Object.values(newErrors).some(error => error !== '');
        if (hasErrors) {
            // Show the first error as the main alert
            const firstError = Object.values(newErrors).find(error => error !== '');
            if (firstError) {
                setError(firstError);
            }

            // Scroll to the first invalid field
            setTimeout(() => {
                if (newErrors.name && nameRef.current) {
                    nameRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    nameRef.current.focus();
                } else if (newErrors.email && emailRef.current) {
                    emailRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    emailRef.current.focus();
                } else if (newErrors.contact && contactRef.current) {
                    contactRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    contactRef.current.focus();
                } else if (newErrors.pincode && pincodeRef.current) {
                    pincodeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    pincodeRef.current.focus();
                } else if (newErrors.gender && genderRef.current) {
                    genderRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else if (newErrors.selectedPlanId && planRef.current) {
                    planRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else if (newErrors.brokerArea && brokerAreaRef.current) {
                    brokerAreaRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else if (newErrors.password && passwordRef.current) {
                    passwordRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    passwordRef.current.focus();
                } else if (newErrors.confirmPassword && confirmPasswordRef.current) {
                    confirmPasswordRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    confirmPasswordRef.current.focus();
                } else if (newErrors.acceptTerms && termsRef.current) {
                    termsRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);

            return;
        }

        setIsLoading(true);

        try {
            const registerData = {
                name: formData.name,
                email: formData.email,
                contact: formData.contact,
                gender: formData.gender as 'Male' | 'Female' | 'Other',
                pincode: formData.pincode,
                password: formData.password,
                role: formData.role as 'Member' | 'Broker',
                brokerArea: brokerAreas.join(', '),
                selectedPlanId: formData.role === 'Broker' ? parseInt(formData.selectedPlanId) : undefined
            };
            const result = await register(registerData);
            
            // Both members and brokers need OTP verification
            if (result.requiresVerification) {
                navigate('/verify-otp', {
                    state: {
                        email: result.email,
                        role: formData.role,
                        name: formData.name,
                        invitationToken,
                        password: formData.password,
                        from,
                        chatIntent,
                    }
                });
            }
        } catch (err: any) {
            const apiError = err.response?.data;
            const firstFieldError = apiError?.errors?.[0]?.msg;
            const errorMessage = firstFieldError || apiError?.message || 'Registration failed. Please try again.';

            if (err.response?.status === 409) {
                const conflictField = apiError?.field;
                if (conflictField === 'email') {
                    setFieldErrors(prev => ({ ...prev, email: apiError?.message || 'Email already registered' }));
                    setTimeout(() => {
                        emailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        emailRef.current?.focus();
                    }, 100);
                } else if (conflictField === 'contact') {
                    setFieldErrors(prev => ({ ...prev, contact: apiError?.message || 'Phone number already registered' }));
                    setTimeout(() => {
                        contactRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        contactRef.current?.focus();
                    }, 100);
                }
            }

            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const getInputClassName = (hasError: boolean) => {
        if (hasError) {
            return 'border-red-500 bg-red-50 ring-2 ring-red-300 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:border-red-500';
        }
        return '';
    };

    return (
        <div className="w-full max-w-xl mx-auto">
                <Card className="border border-blue-100 shadow-xl">
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-2xl text-center">Create Account</CardTitle>
                        <CardDescription className="text-center">
                            Fill in your details to get started
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {error && (
                            <Alert variant="destructive" className="mb-4 border-red-500 bg-red-50 text-red-700">
                                <AlertDescription className="font-medium">{error}</AlertDescription>
                            </Alert>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label htmlFor="name">
                                        Full Name
                                        {formData.name && !fieldErrors.name && (
                                            <CheckCircle2 className="inline w-4 h-4 ml-1 text-blue-600" />
                                        )}
                                    </Label>
                                    <Input
                                        ref={nameRef}
                                        id="name"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        className={getInputClassName(!!fieldErrors.name)}
                                        style={fieldErrors.name ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : undefined}
                                        aria-invalid={!!fieldErrors.name}
                                        required
                                    />
                                    {fieldErrors.name && (
                                        <div className="text-xs text-red-600 flex items-start gap-2 mt-1 p-2 bg-red-100 rounded border border-red-300">
                                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                            <div>
                                                <p className="font-semibold">Name Error</p>
                                                <p>{fieldErrors.name}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="email">
                                        Email
                                        {formData.email && !fieldErrors.email && (
                                            <CheckCircle2 className="inline w-4 h-4 ml-1 text-blue-600" />
                                        )}
                                    </Label>
                                    <Input
                                        ref={emailRef}
                                        id="email"
                                        name="email"
                                        type="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        className={getInputClassName(!!fieldErrors.email)}
                                        style={fieldErrors.email ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : undefined}
                                        aria-invalid={!!fieldErrors.email}
                                        required
                                    />
                                    {fieldErrors.email && (
                                        <div className="text-xs text-red-600 flex items-start gap-2 mt-1 p-2 bg-red-100 rounded border border-red-300">
                                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                            <div>
                                                <p className="font-semibold">Email Error</p>
                                                <p>{fieldErrors.email}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label htmlFor="contact">
                                        Phone Number
                                        {formData.contact && !fieldErrors.contact && (
                                            <CheckCircle2 className="inline w-4 h-4 ml-1 text-blue-600" />
                                        )}
                                    </Label>
                                    <Input
                                        ref={contactRef}
                                        id="contact"
                                        name="contact"
                                        value={formData.contact}
                                        onChange={handleChange}
                                        maxLength={10}
                                        className={getInputClassName(!!fieldErrors.contact)}
                                        style={fieldErrors.contact ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : undefined}
                                        aria-invalid={!!fieldErrors.contact}
                                        required
                                    />
                                    {fieldErrors.contact && (
                                        <div className="text-xs text-red-600 flex items-start gap-2 mt-1 p-2 bg-red-100 rounded border border-red-300">
                                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                            <div>
                                                <p className="font-semibold">Phone Error</p>
                                                <p>{fieldErrors.contact}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="pincode">
                                        PIN Code
                                        {formData.pincode && !fieldErrors.pincode && (
                                            <CheckCircle2 className="inline w-4 h-4 ml-1 text-blue-600" />
                                        )}
                                    </Label>
                                    <Input
                                        ref={pincodeRef}
                                        id="pincode"
                                        name="pincode"
                                        value={formData.pincode}
                                        onChange={handleChange}
                                        maxLength={6}
                                        className={getInputClassName(!!fieldErrors.pincode)}
                                        style={fieldErrors.pincode ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : undefined}
                                        aria-invalid={!!fieldErrors.pincode}
                                        required
                                    />
                                    {fieldErrors.pincode && (
                                        <div className="text-xs text-red-600 flex items-start gap-2 mt-1 p-2 bg-red-100 rounded border border-red-300">
                                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                            <div>
                                                <p className="font-semibold">PIN Code Error</p>
                                                <p>{fieldErrors.pincode}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4" ref={genderRef}>
                                <div className="space-y-1">
                                    <Label htmlFor="gender">
                                        Gender
                                    </Label>
                                    <Select value={formData.gender} onValueChange={(value) => {
                                        setFormData({ ...formData, gender: value });
                                        setFieldErrors(prev => ({ ...prev, gender: '' }));
                                    }}>
                                        <SelectTrigger 
                                            className={fieldErrors.gender ? 'border-red-500 bg-red-50 ring-2 ring-red-300 focus:ring-2 focus:ring-red-500' : ''}
                                            aria-invalid={!!fieldErrors.gender}
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Male">Male</SelectItem>
                                            <SelectItem value="Female">Female</SelectItem>
                                            <SelectItem value="Other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {fieldErrors.gender && (
                                        <div className="text-xs text-red-600 flex items-start gap-2 mt-1 p-2 bg-red-100 rounded border border-red-300">
                                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                            <div>
                                                <p className="font-semibold">Gender Error</p>
                                                <p>{fieldErrors.gender}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="role">Role</Label>
                                    <Select value={formData.role} onValueChange={handleRoleChange}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Member">Member</SelectItem>
                                            <SelectItem value="Broker">Broker</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {formData.role === 'Broker' && (
                                <>
                                    <div className="space-y-2">
                                        <Label>
                                            Select Broker Plan
                                            <span className="text-red-500 ml-1">*</span>
                                        </Label>
                                        {loadingPlans ? (
                                            <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Loading plans...
                                            </div>
                                        ) : brokerPlans.length === 0 ? (
                                            <Alert variant="destructive">
                                                <AlertDescription>No broker plans available at the moment</AlertDescription>
                                            </Alert>
                                        ) : (
                                            <>
                                                <div className={`grid grid-cols-2 gap-3 p-3 rounded-lg border-2 transition-all ${
                                                    fieldErrors.selectedPlanId 
                                                        ? 'border-red-300 bg-red-50/30 ring-1 ring-red-200' 
                                                        : 'border-transparent'
                                                }`}>
                                                    {brokerPlans.map((plan) => {
                                                        const features = typeof plan.features === 'string' 
                                                            ? JSON.parse(plan.features) 
                                                            : plan.features;
                                                        const isSelected = formData.selectedPlanId === plan.id.toString();
                                                        
                                                        return (
                                                            <div
                                                                key={plan.id}
                                                                onClick={() => {
                                                                    handlePlanSelect(plan.id.toString());
                                                                    setFieldErrors(prev => ({ ...prev, selectedPlanId: '' }));
                                                                }}
                                                                className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                                                                    isSelected
                                                                        ? 'border-primary bg-primary/5'
                                                                        : 'border-muted bg-muted/30 hover:border-primary/50'
                                                                }`}
                                                            >
                                                                <div className="space-y-2">
                                                                    <h3 className="font-semibold text-sm">{plan.plan_name}</h3>
                                                                    <div className="space-y-1 text-xs">
                                                                        <p className="text-lg font-bold text-primary">₹{plan.price}</p>
                                                                        <p className="text-muted-foreground">
                                                                            {plan.duration_days === 30 ? 'per month' : 'per year'}
                                                                        </p>
                                                                        {plan.description && (
                                                                            <p className="text-xs text-muted-foreground mt-2">{plan.description}</p>
                                                                        )}
                                                                    </div>
                                                                    <div className="pt-2 mt-2 border-t border-dashed space-y-1">
                                                                        <p className="text-xs font-medium">Features:</p>
                                                                        <ul className="text-xs text-muted-foreground space-y-1">
                                                                            <li>✓ {features.postings || 'Unlimited'} postings</li>
                                                                            <li>✓ Auto-approved rooms</li>
                                                                            <li>✓ Edit anytime</li>
                                                                            {features.discount && <li>✓ {features.discount}</li>}
                                                                        </ul>
                                                                    </div>
                                                                </div>
                                                                {isSelected && (
                                                                    <div className="mt-3 text-center text-xs font-semibold text-primary">
                                                                        ✓ Selected
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                {formData.selectedPlanId && (
                                                    <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded flex items-center gap-1">
                                                        <CheckCircle2 className="w-3 h-3" /> Plan selected. Admin will review during broker approval.
                                                    </p>
                                                )}
                                                {fieldErrors.selectedPlanId && (
                                                    <div className="text-xs text-red-600 flex items-start gap-2 mt-2 p-3 bg-red-100 rounded-lg border border-red-300">
                                                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                                        <div>
                                                            <p className="font-semibold">Plan Selection Required</p>
                                                            <p>{fieldErrors.selectedPlanId}</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                    <div className="space-y-2" ref={brokerAreaRef}>
                                        <Label htmlFor="brokerArea">
                                            Area You Cover
                                            <span className="text-red-500 ml-1">*</span>
                                        </Label>
                                        <div className="relative">
                                            <div className="flex gap-2">
                                                <Input
                                                    ref={areaInputRef}
                                                    id="brokerArea"
                                                    name="brokerArea"
                                                    value={currentArea}
                                                    onChange={(e) => setCurrentArea(e.target.value)}
                                                    onFocus={() => {
                                                        if (currentArea.trim().length > 0 && filteredAreaSuggestions.length > 0) {
                                                            setShowAreaSuggestions(true);
                                                        }
                                                    }}
                                                    placeholder="Type area name (e.g., Nigdi, Katraj)"
                                                    onKeyPress={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            if (currentArea.trim() && !brokerAreas.includes(currentArea.trim())) {
                                                                setBrokerAreas([...brokerAreas, currentArea.trim()]);
                                                                setCurrentArea('');
                                                                setShowAreaSuggestions(false);
                                                            }
                                                        }
                                                    }}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => {
                                                        if (currentArea.trim() && !brokerAreas.includes(currentArea.trim())) {
                                                            setBrokerAreas([...brokerAreas, currentArea.trim()]);
                                                            setCurrentArea('');
                                                            setShowAreaSuggestions(false);
                                                        }
                                                    }}
                                                    className="flex-shrink-0"
                                                >
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            
                                            {/* Autocomplete Suggestions Dropdown */}
                                            {showAreaSuggestions && filteredAreaSuggestions.length > 0 && (
                                                <div
                                                    ref={suggestionsRef}
                                                    className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto"
                                                >
                                                    {filteredAreaSuggestions.slice(0, 10).map((suggestion, index) => (
                                                        <button
                                                            key={index}
                                                            type="button"
                                                            className="w-full text-left px-4 py-2 hover:bg-primary/10 transition-colors border-b border-gray-100 last:border-b-0"
                                                            onClick={() => {
                                                                if (!brokerAreas.includes(suggestion)) {
                                                                    setBrokerAreas([...brokerAreas, suggestion]);
                                                                    setCurrentArea('');
                                                                    setShowAreaSuggestions(false);
                                                                }
                                                            }}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                                                                    <Plus className="h-3 w-3 text-primary" />
                                                                </div>
                                                                <span className="text-sm font-medium">{suggestion}</span>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        {brokerAreas.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {brokerAreas.map((area, index) => (
                                                    <div
                                                        key={index}
                                                        className="flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                                                    >
                                                        <span>{area}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setBrokerAreas(brokerAreas.filter((_, i) => i !== index));
                                                            }}
                                                            className="hover:bg-primary/20 rounded-full p-0.5"
                                                            aria-label={`Remove ${area}`}
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {fieldErrors.brokerArea && (
                                            <div className="text-xs text-red-600 flex items-start gap-2 mt-2 p-3 bg-red-100 rounded-lg border border-red-300">
                                                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                                <div>
                                                    <p className="font-semibold">Area Required</p>
                                                    <p>{fieldErrors.brokerArea}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label htmlFor="password">
                                        Password
                                        {formData.password && !fieldErrors.password && (
                                            <CheckCircle2 className="inline w-4 h-4 ml-1 text-blue-600" />
                                        )}
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            ref={passwordRef}
                                            id="password"
                                            name="password"
                                            type={showPassword ? 'text' : 'password'}
                                            value={formData.password}
                                            onChange={handleChange}
                                            className={getInputClassName(!!fieldErrors.password)}
                                            style={fieldErrors.password ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : undefined}
                                            aria-invalid={!!fieldErrors.password}
                                            required
                                        />
                                    </div>
                                    {fieldErrors.password && (
                                        <div className="text-xs text-red-600 flex items-start gap-2 mt-1 p-2 bg-red-100 rounded border border-red-300">
                                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                            <div>
                                                <p className="font-semibold">Password Error</p>
                                                <p>{fieldErrors.password}</p>
                                            </div>
                                        </div>
                                    )}
                                    {formData.password && (() => {
                                        const strength = getPasswordStrength(formData.password);
                                        if (!strength) return null;
                                        return (
                                            <div className="mt-2">
                                                <div className="flex gap-1 h-1.5 mb-1">
                                                    <div className={`flex-1 rounded-full ${strength.score >= 1 ? strength.barColor : 'bg-gray-200'}`}></div>
                                                    <div className={`flex-1 rounded-full ${strength.score >= 2 ? strength.barColor : 'bg-gray-200'}`}></div>
                                                    <div className={`flex-1 rounded-full ${strength.score >= 3 ? strength.barColor : 'bg-gray-200'}`}></div>
                                                </div>
                                                <p className={`text-xs ${strength.textColor}`}>Password strength: <span className="font-semibold">{strength.label}</span></p>
                                            </div>
                                        );
                                    })()}
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="confirmPassword">
                                        Confirm Password
                                        {formData.confirmPassword && !fieldErrors.confirmPassword && (
                                            <CheckCircle2 className="inline w-4 h-4 ml-1 text-blue-600" />
                                        )}
                                    </Label>
                                    <Input
                                        ref={confirmPasswordRef}
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        type={showPassword ? 'text' : 'password'}
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        className={getInputClassName(!!fieldErrors.confirmPassword)}
                                        style={fieldErrors.confirmPassword ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : undefined}
                                        aria-invalid={!!fieldErrors.confirmPassword}
                                        required
                                    />
                                    {fieldErrors.confirmPassword && (
                                        <div className="text-xs text-red-600 flex items-start gap-2 mt-1 p-2 bg-red-100 rounded border border-red-300">
                                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                            <div>
                                                <p className="font-semibold">Password Confirmation Error</p>
                                                <p>{fieldErrors.confirmPassword}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="showPassword"
                                    className="rounded border-gray-300"
                                    onChange={() => setShowPassword(!showPassword)}
                                    aria-label="Show password"
                                />
                                <Label htmlFor="showPassword" className="text-sm font-normal cursor-pointer">
                                    Show password
                                </Label>
                            </div>

                            <div ref={termsRef} className={`flex items-start gap-2 p-3 rounded border-2 transition-colors ${
                                fieldErrors.acceptTerms 
                                    ? 'bg-red-50 border-red-200' 
                                    : acceptedTerms 
                                    ? 'bg-green-50 border-blue-200'
                                    : 'bg-green-50 border-blue-200'
                            }`}>
                                <input
                                    type="checkbox"
                                    id="acceptTerms"
                                    className="rounded border-gray-300 mt-1 cursor-pointer"
                                    checked={acceptedTerms}
                                    onChange={() => {
                                        setAcceptedTerms(!acceptedTerms);
                                        setFieldErrors(prev => ({ ...prev, acceptTerms: '' }));
                                    }}
                                    aria-label="Accept terms and conditions"
                                />
                                <div className="flex-1">
                                    <Label htmlFor="acceptTerms" className="text-sm font-normal cursor-pointer">
                                        I accept the{' '}
                                        <Link to="/terms-conditions" className="text-primary hover:underline font-semibold">
                                            Terms & Conditions
                                        </Link>
                                        <span className="text-red-500 ml-1">*</span>
                                    </Label>
                                </div>
                                {acceptedTerms && !fieldErrors.acceptTerms && (
                                    <CheckCircle2 className="w-4 h-4 mt-1 text-blue-600 flex-shrink-0" />
                                )}
                            </div>
                            {fieldErrors.acceptTerms && (
                                <div className="text-xs text-red-600 flex items-start gap-2 mt-1 p-2 bg-red-100 rounded border border-red-300">
                                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="font-semibold">Terms Agreement Error</p>
                                        <p>{fieldErrors.acceptTerms}</p>
                                    </div>
                                </div>
                            )}

                            <Button type="submit" className="w-full" disabled={isLoading || !acceptedTerms}>
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Creating account...
                                    </>
                                ) : (
                                    'Create Account'
                                )}
                            </Button>
                        </form>
                    </CardContent>
                    <CardFooter>
                        <div className="text-sm text-center text-muted-foreground w-full">
                            Already have an account?{' '}
                            <Link to="/login" className="text-primary hover:underline">
                                Login
                            </Link>
                        </div>
                    </CardFooter>
                </Card>
        </div>
    );
};

export default RegisterPage;
