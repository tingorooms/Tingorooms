import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Upload, MapPin, Building2, Home, Check, Users, User, Sofa, Box, Square, Wifi, ParkingSquare, ArrowUpDown, Dumbbell, Zap, Droplet, Shield, Camera, Warehouse, X, DoorOpen, Grid3x3, LayoutGrid, Maximize, Lock, Share2, RefreshCcw, Loader2, Plus, AlertCircle } from 'lucide-react';
import { createRoom, getPublicSupportEmail, uploadRoomImages } from '@/services/roomService';
import { getUserContactInfo } from '@/services/chatService';
import { getAvailablePlans } from '@/services/subscriptionService';
import { getBrokerSubscription } from '@/services/subscriptionService';
import { toast } from 'sonner';
import LocationPickerMap from '@/components/maps/LocationPickerMap';
import type { Plan } from '@/types';

const steps = [
    { id: 1, title: 'What are you looking for?', icon: Building2 },
    { id: 2, title: 'Select Room Type', icon: Home },
    { id: 3, title: 'Location Details', icon: MapPin },
    { id: 4, title: 'More Details', icon: Building2 },
    { id: 5, title: 'Furnishing & Facilities', icon: Check },
    { id: 6, title: 'Title & Description', icon: Building2 },
    { id: 7, title: 'Upload Images', icon: Upload },
    { id: 8, title: 'Select Plan', icon: Check },
];

const getTodayDateString = () => {
    const date = new Date();
    const timezoneOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - timezoneOffset).toISOString().split('T')[0];
};

type LocationDetails = {
    address?: string;
    area?: string;
    city?: string;
    pincode?: string;
    district?: string;
};

type FormDataType = {
    listingType: string;
    preferredGender: string;
    roomType: string;
    houseType: string;
    city: string;
    area: string;
    address: string;
    pincode: string;
    latitude: number;
    longitude: number;
    rent: string;
    deposit: string;
    cost: string;
    sizeSqft: string;
    availabilityFrom: string;
    furnishingType: string;
    facilities: string[];
    title: string;
    note: string;
    images: string[];
    planType: string;
    contact: string;
    contactVisibility: 'Private' | 'Public';
    existingRoommates: { name: string; city: string }[];
};

type SubscriptionBlockDialogState = {
    open: boolean;
    status: 'expired' | 'not_subscribed' | 'suspended';
    message: string;
};

type QuickRegisterFormState = {
    email: string;
    contact: string;
    role: 'Member' | 'Broker';
    selectedPlanId: string;
};

type QuickAuthMode = 'login' | 'register';
type QuickOtpFlow = 'register-member' | 'register-broker' | 'existing-login';

const brokerAreaSuggestions = [
    'Nigdi', 'Katraj', 'Kothrud', 'Hinjewadi', 'Wakad', 'Baner',
    'Aundh', 'Pimple Saudagar', 'Hadapsar', 'Magarpatta', 'Viman Nagar',
    'Koregaon Park', 'Shivajinagar', 'Kharadi', 'Pimpri', 'Chinchwad',
    'Balewadi', 'Bavdhan', 'Kondhwa', 'Dhanori', 'Lohegaon'
];

const parsePlanFeatures = (features: unknown): Record<string, unknown> => {
    if (!features) return {};
    if (typeof features === 'string') {
        try {
            const parsed = JSON.parse(features);
            return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
        } catch {
            return {};
        }
    }
    return typeof features === 'object' ? features as Record<string, unknown> : {};
};

const inferNameFromEmail = (email: string): string => {
    const localPart = String(email || '').trim().split('@')[0] || 'User';
    const readable = localPart
        .replace(/[._-]+/g, ' ')
        .replace(/\d+/g, ' ')
        .trim();

    if (!readable) {
        return 'User';
    }

    return readable
        .split(/\s+/)
        .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase())
        .join(' ')
        .slice(0, 100);
};

const generateQuickPassword = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
    const random = Array.from({ length: 10 })
        .map(() => chars[Math.floor(Math.random() * chars.length)])
        .join('');

    // Ensure mixed-character password accepted by backend validations.
    return `Qk${random}9A`;
};

const PostRoomPage: React.FC = () => {
    const navigate = useNavigate();
    const { user, isAuthenticated, isLoading, register, verifyOTP, resendOTP, login } = useAuth();
    const imageInputRef = useRef<HTMLInputElement | null>(null);
    const formStartRef = useRef<HTMLDivElement | null>(null);
    const [currentStep, setCurrentStep] = useState(() => {
        const savedStep = localStorage.getItem('postRoomCurrentStep');
        if (savedStep) {
            try {
                const step = parseInt(savedStep, 10);
                return step >= 1 && step <= steps.length ? step : 1;
            } catch {
                return 1;
            }
        }
        return 1;
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isImageUploading, setIsImageUploading] = useState(false);
    const [isLoadingNext, setIsLoadingNext] = useState(false);
    const [isTitleManuallyEdited, setIsTitleManuallyEdited] = useState(false);
    const [isTermsAccepted, setIsTermsAccepted] = useState(false);
    const [supportEmail, setSupportEmail] = useState('customer@support.com');
    const [locationFetched, setLocationFetched] = useState(false);
    const [contactFetched, setContactFetched] = useState(false);
    const [hasAutoSelectedBrokerPlan, setHasAutoSelectedBrokerPlan] = useState(false);
    const [isBrokerSubscriptionActive, setIsBrokerSubscriptionActive] = useState(false);
    const [quickRegisterDialogOpen, setQuickRegisterDialogOpen] = useState(false);
    const [quickAuthMode, setQuickAuthMode] = useState<QuickAuthMode>('login');
    const [quickRegisterConfirmed, setQuickRegisterConfirmed] = useState(false);
    const [quickOtpDialogOpen, setQuickOtpDialogOpen] = useState(false);
    const [quickOtpFlow, setQuickOtpFlow] = useState<QuickOtpFlow>('register-member');
    const [quickRegisterLoading, setQuickRegisterLoading] = useState(false);
    const [quickLoginLoading, setQuickLoginLoading] = useState(false);
    const [quickOtpLoading, setQuickOtpLoading] = useState(false);
    const [quickResendLoading, setQuickResendLoading] = useState(false);
    const [quickLoginPassword, setQuickLoginPassword] = useState('');
    const [quickLoginError, setQuickLoginError] = useState('');
    const [quickRegisterError, setQuickRegisterError] = useState('');
    const [quickOtpError, setQuickOtpError] = useState('');
    const [quickOtp, setQuickOtp] = useState('');
    const [quickGeneratedPassword, setQuickGeneratedPassword] = useState('');
    const [brokerPlans, setBrokerPlans] = useState<Plan[]>([]);
    const [isLoadingBrokerPlans, setIsLoadingBrokerPlans] = useState(false);
    const [brokerAreas, setBrokerAreas] = useState<string[]>([]);
    const [currentBrokerArea, setCurrentBrokerArea] = useState('');
    const [showAreaSuggestions, setShowAreaSuggestions] = useState(false);
    const [filteredAreaSuggestions, setFilteredAreaSuggestions] = useState<string[]>([]);
    const [quickRegisterData, setQuickRegisterData] = useState<QuickRegisterFormState>({
        email: user?.email || '',
        contact: user?.contact || '',
        role: 'Member',
        selectedPlanId: '',
    });
    const [subscriptionBlockDialog, setSubscriptionBlockDialog] = useState<SubscriptionBlockDialogState>({
        open: false,
        status: 'not_subscribed',
        message: ''
    });
    
    // Initialize formData with localStorage or defaults
    const getDefaultFormData = (): FormDataType => ({
        listingType: '',
        preferredGender: '',
        roomType: '',
        houseType: '',
        city: 'Pune',
        area: '',
        address: '',
        pincode: '',
        latitude: 18.5204,
        longitude: 73.8567,
        rent: '',
        deposit: '',
        cost: '',
        sizeSqft: '',
        availabilityFrom: getTodayDateString(),
        furnishingType: '',
        facilities: [] as string[],
        title: '',
        note: '',
        images: [] as string[],
        planType: user?.role === 'Broker' ? 'Premium' : 'Basic',
        contact: user?.contact || '',
        contactVisibility: 'Private',
        existingRoommates: []
    });

    const [formData, setFormData] = useState<FormDataType>(() => {
        const saved = localStorage.getItem('postRoomFormData');
        if (saved) {
            try {
                const parsed = JSON.parse(saved) as Partial<FormDataType>;
                return {
                    ...getDefaultFormData(),
                    ...parsed,
                    existingRoommates: Array.isArray(parsed.existingRoommates)
                        ? parsed.existingRoommates
                        : []
                };
            } catch {
                // Fallback to default if parsing fails
            }
        }
        return getDefaultFormData();
    });

    // Save formData to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem('postRoomFormData', JSON.stringify(formData));
    }, [formData]);

    // Save currentStep to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem('postRoomCurrentStep', currentStep.toString());
    }, [currentStep]);

    const suggestedTitle = useMemo(() => {
        const base = [formData.roomType, formData.furnishingType, formData.houseType]
            .filter(Boolean)
            .join(' ')
            .trim();

        if (!base) {
            return '';
        }

        return formData.area?.trim() ? `${base} in ${formData.area.trim()}` : base;
    }, [formData.roomType, formData.furnishingType, formData.houseType, formData.area]);

    useEffect(() => {
        if (isTitleManuallyEdited) {
            return;
        }

        setFormData((previous: FormDataType) => {
            if (previous.title === suggestedTitle) {
                return previous;
            }

            return {
                ...previous,
                title: suggestedTitle,
            };
        });
    }, [isTitleManuallyEdited, suggestedTitle]);

    useEffect(() => {
        const loadSupportEmail = async () => {
            try {
                const email = await getPublicSupportEmail();
                if (email) {
                    setSupportEmail(email);
                }
            } catch {
                // keep default fallback
            }
        };

        void loadSupportEmail();
    }, []);

    const loadUserContact = useCallback(async () => {
        if (!user?.id || contactFetched) {
            return;
        }

        try {
            const contactInfo = await getUserContactInfo(user.id);
            if (contactInfo?.contact) {
                setFormData((previous: FormDataType) => ({
                    ...previous,
                    contact: contactInfo.contact,
                }));
                setContactFetched(true);
            }
        } catch (error) {
            // Fallback to user context contact if API fails
            if (user?.contact) {
                setFormData((previous: FormDataType) => ({
                    ...previous,
                    contact: user.contact,
                }));
                setContactFetched(true);
            }
        }
    }, [contactFetched, user?.contact, user?.id]);

    useEffect(() => {
        if (user?.role !== 'Broker' || hasAutoSelectedBrokerPlan) {
            return;
        }

        setFormData((previous: FormDataType) => {
            if (previous.planType === 'Premium') {
                return previous;
            }

            return {
                ...previous,
                planType: 'Premium',
            };
        });
        setHasAutoSelectedBrokerPlan(true);
    }, [hasAutoSelectedBrokerPlan, user?.role]);

    useEffect(() => {
        if (user?.role !== 'Broker') {
            setIsBrokerSubscriptionActive(false);
            return;
        }

        const loadBrokerSubscriptionStatus = async () => {
            try {
                const stats = await getBrokerSubscription();
                setIsBrokerSubscriptionActive(Boolean(stats?.isActive));
            } catch {
                setIsBrokerSubscriptionActive(false);
            }
        };

        void loadBrokerSubscriptionStatus();
    }, [user?.role]);

    useEffect(() => {
        if (!quickRegisterDialogOpen || quickRegisterData.role !== 'Broker') {
            return;
        }

        const loadBrokerPlans = async () => {
            try {
                setIsLoadingBrokerPlans(true);
                const plans = await getAvailablePlans('Broker');
                setBrokerPlans(Array.isArray(plans) ? plans : []);
            } catch {
                setBrokerPlans([]);
            } finally {
                setIsLoadingBrokerPlans(false);
            }
        };

        void loadBrokerPlans();
    }, [quickRegisterData.role, quickRegisterDialogOpen]);

    useEffect(() => {
        if (quickRegisterData.role !== 'Broker') {
            setShowAreaSuggestions(false);
            setFilteredAreaSuggestions([]);
            return;
        }

        const query = currentBrokerArea.trim().toLowerCase();
        if (!query) {
            setShowAreaSuggestions(false);
            setFilteredAreaSuggestions([]);
            return;
        }

        const filtered = brokerAreaSuggestions
            .filter((area) => area.toLowerCase().includes(query) && !brokerAreas.includes(area))
            .slice(0, 8);

        setFilteredAreaSuggestions(filtered);
        setShowAreaSuggestions(filtered.length > 0);
    }, [brokerAreas, currentBrokerArea, quickRegisterData.role]);

    const handleCoordinatesChange = useCallback((latitude: number, longitude: number) => {
        setFormData((previous: FormDataType) => ({
            ...previous,
            latitude: Number(latitude.toFixed(6)),
            longitude: Number(longitude.toFixed(6)),
        }));
    }, []);

    const handleLocationDetailsChange = useCallback((details: LocationDetails) => {
        setLocationFetched(true);
        setFormData((previous: FormDataType) => {
            const updated = {
                ...previous,
                city: details.city || previous.city,
                area: details.area || previous.area,
                address: details.address || previous.address,
                pincode: details.pincode || previous.pincode,
            };
            return updated;
        });
    }, []);

    // Handle Enter key press to move to next step
    useEffect(() => {
        const handleKeyPress = (event: KeyboardEvent) => {
            // Don't trigger on Enter if user is typing in textarea or if submitting
            if (event.key === 'Enter' && 
                !(event.target instanceof HTMLTextAreaElement) &&
                !isSubmitting) {
                
                // If on last step and form is valid, submit
                if (currentStep === steps.length) {
                    if (isTermsAccepted) {
                        void handleSubmit();
                    }
                } else {
                    // Otherwise move to next step
                    handleNext();
                }
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [currentStep, isSubmitting, isTermsAccepted]);

    const validateStep = (step: number): { valid: boolean; message: string } => {
        switch (step) {
            case 1:
                if (!formData.listingType) return { valid: false, message: 'Please select a listing type' };
                if ((formData.listingType === 'For Rent' || formData.listingType === 'Required Roommate') && !formData.preferredGender) {
                    return { valid: false, message: 'Please select preferred gender' };
                }
                return { valid: true, message: '' };
            case 2:
                if (!formData.roomType) return { valid: false, message: 'Please select room type' };
                if (!formData.houseType) return { valid: false, message: 'Please select house type' };
                return { valid: true, message: '' };
            case 3:
                if (!formData.city) return { valid: false, message: 'Please select a city' };
                if (!formData.area) return { valid: false, message: 'Please enter area' };
                if (!formData.address) return { valid: false, message: 'Please enter full address' };
                if (!formData.pincode || !/^\d{6}$/.test(formData.pincode)) {
                    return { valid: false, message: 'Please enter valid 6-digit PIN code' };
                }
                return { valid: true, message: '' };
            case 4:
                if (!formData.availabilityFrom) return { valid: false, message: 'Please select availability date' };
                if (formData.listingType === 'For Rent' || formData.listingType === 'Required Roommate') {
                    if (!formData.rent) return { valid: false, message: 'Please enter rent amount' };
                    if (!formData.deposit) return { valid: false, message: 'Please enter deposit amount' };
                }
                if (formData.listingType === 'For Sell') {
                    if (!formData.cost) return { valid: false, message: 'Please enter cost' };
                    if (!formData.sizeSqft) return { valid: false, message: 'Please enter size in sqft' };
                }
                if (!formData.contact) return { valid: false, message: 'Please enter contact number' };
                return { valid: true, message: '' };
            case 5:
                if (!formData.furnishingType) return { valid: false, message: 'Please select furnishing type' };
                return { valid: true, message: '' };
            case 6:
                if (!formData.title || formData.title.trim() === '') return { valid: false, message: 'Please enter room title' };
                return { valid: true, message: '' };
            case 7:
                if (formData.images.length === 0) return { valid: false, message: 'Please upload at least one image' };
                return { valid: true, message: '' };
            case 8:
                if (!formData.planType) return { valid: false, message: 'Please select a plan' };
                return { valid: true, message: '' };
            default:
                return { valid: true, message: '' };
        }
    };

    const handleNext = async () => {
        // Validate current step before moving to next
        const validation = validateStep(currentStep);
        if (!validation.valid) {
            toast.error(validation.message);
            return;
        }

        // Fetch contact when moving from Location Details (step 3) to next step
        if (currentStep === 3) {
            setIsLoadingNext(true);
            await loadUserContact();
            setIsLoadingNext(false);
        }

        if (currentStep < steps.length) {
            setCurrentStep(currentStep + 1);
            requestAnimationFrame(() => {
                const topOffset = window.innerWidth < 640 ? 84 : 96;
                const top = (formStartRef.current?.getBoundingClientRect().top || 0) + window.scrollY - topOffset;
                window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
            });
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
            requestAnimationFrame(() => {
                const topOffset = window.innerWidth < 640 ? 84 : 96;
                const top = (formStartRef.current?.getBoundingClientRect().top || 0) + window.scrollY - topOffset;
                window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
            });
        }
    };

    const persistDraftSnapshot = useCallback(() => {
        localStorage.setItem('postRoomFormData', JSON.stringify(formData));
        localStorage.setItem('postRoomCurrentStep', String(currentStep));
    }, [currentStep, formData]);

    const openQuickRegisterDialog = () => {
        persistDraftSnapshot();
        setQuickAuthMode('login');
        setQuickRegisterConfirmed(false);
        setQuickLoginPassword('');
        setQuickLoginError('');
        setQuickRegisterError('');
        setQuickOtpError('');
        setQuickOtp('');
        setQuickRegisterData((prev) => ({
            ...prev,
            email: prev.email || '',
            contact: formData.contact || prev.contact || '',
            role: prev.role || 'Member',
        }));
        setBrokerAreas((previous) => previous);
        setQuickRegisterDialogOpen(true);
    };

    const handleQuickLogin = async () => {
        persistDraftSnapshot();
        setQuickLoginError('');

        if (!quickRegisterData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(quickRegisterData.email)) {
            setQuickLoginError('Please enter a valid email address.');
            return;
        }

        if (!quickLoginPassword) {
            setQuickLoginError('Please enter your password.');
            return;
        }

        try {
            setQuickLoginLoading(true);
            const response = await login({
                email: quickRegisterData.email.trim(),
                password: quickLoginPassword,
            });

            setQuickRegisterDialogOpen(false);
            await handleSubmit(false, {
                skipQuickAuthCheck: true,
                authOverride: {
                    forceAuthenticated: true,
                    email: response.user.email,
                    contact: formData.contact || quickRegisterData.contact || '',
                    role: response.user.role,
                }
            });
        } catch (error) {
            const apiError = error as {
                response?: {
                    data?: {
                        message?: string;
                        data?: {
                            requiresRegistration?: boolean;
                            requiresVerification?: boolean;
                            email?: string;
                        };
                    };
                };
            };

            if (apiError?.response?.data?.data?.requiresRegistration) {
                setQuickLoginError('Account not found. Continue with quick account creation.');
                setQuickAuthMode('register');
                setQuickRegisterConfirmed(false);
                return;
            }

            if (apiError?.response?.data?.data?.requiresVerification) {
                setQuickOtp('');
                setQuickOtpError('');
                setQuickOtpFlow('existing-login');
                setQuickRegisterDialogOpen(false);
                setQuickOtpDialogOpen(true);
                return;
            }

            setQuickLoginError(apiError?.response?.data?.message || 'Login failed. Please try again.');
        } finally {
            setQuickLoginLoading(false);
        }
    };

    const addBrokerArea = () => {
        const area = currentBrokerArea.trim();
        if (!area || brokerAreas.includes(area)) {
            return;
        }

        setBrokerAreas((previous) => [...previous, area]);
        setCurrentBrokerArea('');
        setShowAreaSuggestions(false);
    };

    const validateQuickRegister = (): string => {
        if (!quickRegisterData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(quickRegisterData.email)) {
            return 'Please enter a valid email address.';
        }

        if (!/^[6-9]\d{9}$/.test(quickRegisterData.contact)) {
            return 'Please enter a valid 10-digit phone number.';
        }

        if (quickRegisterData.role === 'Broker') {
            if (!quickRegisterData.selectedPlanId) {
                return 'Please select a broker plan.';
            }

            if (brokerAreas.length === 0) {
                return 'Please add at least one area you cover.';
            }
        }

        return '';
    };

    const handleQuickRegister = async () => {
        setQuickRegisterError('');
        persistDraftSnapshot();

        const validationMessage = validateQuickRegister();
        if (validationMessage) {
            setQuickRegisterError(validationMessage);
            return;
        }

        const generatedPassword = generateQuickPassword();

        try {
            setQuickRegisterLoading(true);
            await register({
                name: inferNameFromEmail(quickRegisterData.email),
                email: quickRegisterData.email.trim(),
                contact: quickRegisterData.contact.trim(),
                gender: 'Other',
                pincode: formData.pincode,
                password: generatedPassword,
                role: quickRegisterData.role,
                brokerArea: quickRegisterData.role === 'Broker' ? brokerAreas.join(', ') : undefined,
                selectedPlanId: quickRegisterData.role === 'Broker' ? Number(quickRegisterData.selectedPlanId) : undefined,
            });

            setQuickGeneratedPassword(generatedPassword);
            setQuickOtpFlow(quickRegisterData.role === 'Broker' ? 'register-broker' : 'register-member');
            setQuickRegisterDialogOpen(false);
            setQuickOtpDialogOpen(true);
            toast.success('OTP sent to your email. Verify to continue.');
        } catch (error) {
            const apiError = error as {
                response?: {
                    data?: {
                        message?: string;
                        errors?: { msg?: string }[];
                    };
                };
            };

            const message = apiError?.response?.data?.errors?.[0]?.msg
                || apiError?.response?.data?.message
                || 'Failed to create account. Please try again.';

            setQuickRegisterError(message);
        } finally {
            setQuickRegisterLoading(false);
        }
    };

    const handleQuickOtpVerify = async () => {
        persistDraftSnapshot();

        if (!/^\d{6}$/.test(quickOtp)) {
            setQuickOtpError('Please enter a valid 6-digit OTP.');
            return;
        }

        setQuickOtpError('');

        try {
            setQuickOtpLoading(true);
            await verifyOTP(
                quickRegisterData.email,
                quickOtp,
                quickOtpFlow === 'register-member' || quickOtpFlow === 'register-broker'
                    ? {
                        isShortcutRegistration: true,
                        tempPassword: quickGeneratedPassword,
                    }
                    : undefined
            );

            if (quickOtpFlow === 'register-broker') {
                setQuickOtpDialogOpen(false);
                toast.success('Broker account created and sent for admin approval. Draft is saved.');
                navigate('/login', {
                    state: {
                        message: 'Broker account verified. Please wait for admin approval before login. Your room draft is saved.',
                        type: 'success'
                    }
                });
                return;
            }

            const loginResponse = await login({
                email: quickRegisterData.email,
                password: quickOtpFlow === 'existing-login' ? quickLoginPassword : quickGeneratedPassword,
            });

            setQuickOtpDialogOpen(false);
            setFormData((previous: FormDataType) => ({
                ...previous,
                contact: previous.contact || quickRegisterData.contact,
            }));
            setQuickOtp('');
            await handleSubmit(false, {
                skipQuickAuthCheck: true,
                authOverride: {
                    forceAuthenticated: true,
                    email: loginResponse.user.email,
                    contact: formData.contact || quickRegisterData.contact || '',
                    role: loginResponse.user.role,
                }
            });
        } catch (error) {
            const apiError = error as {
                response?: {
                    data?: {
                        message?: string;
                    };
                };
            };

            const message = apiError?.response?.data?.message || 'OTP verification failed. Please try again.';
            setQuickOtpError(message);
        } finally {
            setQuickOtpLoading(false);
        }
    };

    const handleQuickOtpResend = async () => {
        try {
            setQuickResendLoading(true);
            await resendOTP(quickRegisterData.email);
            toast.success('OTP resent successfully.');
        } catch (error) {
            const apiError = error as {
                response?: {
                    data?: {
                        message?: string;
                    };
                };
            };
            setQuickOtpError(apiError?.response?.data?.message || 'Failed to resend OTP.');
        } finally {
            setQuickResendLoading(false);
        }
    };

    const handleSubmit = async (
        postWithoutSubscription = false,
        options?: {
            skipQuickAuthCheck?: boolean;
            authOverride?: {
                forceAuthenticated?: boolean;
                email?: string;
                contact?: string;
                role?: 'Member' | 'Broker' | 'Admin';
            };
        }
    ) => {
        // Validate all required fields before submission
        if (!formData.listingType || !formData.roomType || !formData.houseType ||
            !formData.city || !formData.area || !formData.address || !formData.pincode ||
            !formData.availabilityFrom || !formData.furnishingType || 
            !formData.title || formData.images.length === 0 || !formData.planType || !formData.contact) {
            
            toast.error('Please fill all required fields marked with *');
            return;
        }

        if (formData.listingType === 'For Rent' || formData.listingType === 'Required Roommate') {
            if (!formData.rent || !formData.deposit) {
                toast.error('Please enter rent and deposit amount');
                return;
            }
        }
        
        if (formData.listingType === 'For Sell') {
            if (!formData.cost || !formData.sizeSqft) {
                toast.error('Please enter cost and size in sqft');
                return;
            }
        }

        if (!/^\d{6}$/.test(formData.pincode)) {
            toast.error('Please enter valid 6-digit PIN code');
            return;
        }

        const effectiveIsAuthenticated = Boolean(options?.authOverride?.forceAuthenticated || isAuthenticated || user?.id);
        const effectiveEmail = options?.authOverride?.email || user?.email;
        const effectiveContact = options?.authOverride?.contact || formData.contact || user?.contact || '';
        const effectiveRole = options?.authOverride?.role || user?.role;

        if (!options?.skipQuickAuthCheck && isLoading) {
            toast.error('Checking login status. Please try again in a moment.');
            return;
        }

        if (!options?.skipQuickAuthCheck && !effectiveIsAuthenticated) {
            openQuickRegisterDialog();
            return;
        }

        setIsSubmitting(true);
        
        try {
            await createRoom({
                listingType: formData.listingType as 'For Rent' | 'Required Roommate' | 'For Sell',
                roomType: formData.roomType as '1RK' | '1BHK' | '2BHK' | '3BHK' | '4BHK' | 'PG' | 'Dormitory' | 'Studio' | 'Other',
                houseType: formData.houseType as 'Flat' | 'Apartment' | 'House',
                city: formData.city,
                area: formData.area,
                address: formData.address,
                pincode: formData.pincode,
                latitude: formData.latitude,
                longitude: formData.longitude,
                title: formData.title,
                note: formData.note,
                availabilityFrom: formData.availabilityFrom,
                furnishingType: formData.furnishingType as 'Furnished' | 'Semi-furnished' | 'Unfurnished',
                facilities: formData.facilities,
                planType: formData.planType,
                images: formData.images,
                contact: effectiveContact,
                contactVisibility: formData.contactVisibility,
                email: effectiveEmail,
                preferredGender: (formData.preferredGender || undefined) as 'Male' | 'Female' | 'Any' | undefined,
                rent: formData.rent ? parseFloat(formData.rent) : undefined,
                deposit: formData.deposit ? parseFloat(formData.deposit) : undefined,
                cost: formData.cost ? parseFloat(formData.cost) : undefined,
                sizeSqft: formData.sizeSqft ? parseInt(formData.sizeSqft) : undefined,
                existingRoommates: formData.existingRoommates.length > 0
                    ? formData.existingRoommates
                          .map((roommate) => ({
                              name: roommate.name.trim(),
                              city: roommate.city.trim()
                          }))
                          .filter((roommate) => roommate.name && roommate.city)
                    : undefined,
                postWithoutSubscription,
            });
            // Clear localStorage on successful submission
            localStorage.removeItem('postRoomFormData');
            localStorage.removeItem('postRoomCurrentStep');
            
            // Show different message for brokers (auto-approved) vs other users
            if (effectiveRole === 'Broker') {
                toast.success('Room posted successfully! Your listing is now live.');
            } else {
                toast.success(`Posted successfully! Waiting for Admin Approval. For more details contact ${supportEmail}`);
            }
            
            navigate('/dashboard/rooms');
        } catch (error) {
            const apiError = error as {
                response?: {
                    status?: number;
                    data?: {
                        message?: string;
                        errorCode?: string;
                        subscriptionStatus?: 'expired' | 'not_subscribed' | 'suspended';
                    };
                };
            };

            const errorCode = apiError?.response?.data?.errorCode;
            const subscriptionStatus = apiError?.response?.data?.subscriptionStatus;
            
            if (!postWithoutSubscription && apiError?.response?.status === 403 && (errorCode === 'BROKER_SUBSCRIPTION_REQUIRED' || errorCode === 'SUBSCRIPTION_SUSPENDED')) {
                setSubscriptionBlockDialog({
                    open: true,
                    status: subscriptionStatus || 'not_subscribed',
                    message: apiError?.response?.data?.message || 'Posting requires an active subscription.'
                });
                return;
            }

            const errorMessage = apiError?.response?.data?.message;
            toast.error(errorMessage || 'Failed to post room. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    }

    const handlePostWithoutSubscription = async () => {
        setSubscriptionBlockDialog((prev) => ({ ...prev, open: false }));
        await handleSubmit(true);
    };

    const handleClearForm = () => {
        localStorage.removeItem('postRoomFormData');
        localStorage.removeItem('postRoomCurrentStep');
        setFormData(getDefaultFormData());
        setCurrentStep(1);
        setIsTitleManuallyEdited(false);
        setIsTermsAccepted(false);
        if (imageInputRef.current) {
            imageInputRef.current.value = '';
        }
        toast.success('Form cleared. Start fresh.');
    };

    const handleBrowseImages = () => {
        imageInputRef.current?.click();
    };

    const handleImageSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []);

        if (files.length === 0) {
            return;
        }

        const remainingSlots = Math.max(0, 5 - formData.images.length);
        if (remainingSlots === 0) {
            toast.error('Maximum 5 images are allowed.');
            event.target.value = '';
            return;
        }

        const selectedFiles = files.slice(0, remainingSlots);
        const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png'];

        const invalidTypeFile = selectedFiles.find((file) => !supportedTypes.includes(file.type));
        if (invalidTypeFile) {
            toast.error('Only JPG and PNG images are supported.');
            event.target.value = '';
            return;
        }

        const oversizedFile = selectedFiles.find((file) => file.size > 500 * 1024);
        if (oversizedFile) {
            toast.error('Each image must be 500KB or less.');
            event.target.value = '';
            return;
        }

        setIsImageUploading(true);
        try {
            const imageUrls = await uploadRoomImages(selectedFiles);
            setFormData((previous: FormDataType) => ({
                ...previous,
                images: [...previous.images, ...imageUrls].slice(0, 5),
            }));
            toast.success('Images uploaded successfully.');
        } catch (error) {
            const errorMessage = (error as { response?: { data?: { message?: string } } })
                ?.response?.data?.message;
            toast.error(errorMessage || 'Failed to upload images. Please try again.');
        } finally {
            setIsImageUploading(false);
            event.target.value = '';
        }
    };

    const renderStep = () => {
        switch (currentStep) {
            case 1:
                return (
                    <div className="space-y-4 sm:space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                            {[
                                { type: 'For Rent', icon: Building2 },
                                { type: 'Required Roommate', icon: Users },
                                { type: 'For Sell', icon: Building2 }
                            ].map(({ type, icon: Icon }) => (
                                <Card 
                                    key={type}
                                    className={`cursor-pointer hover:shadow-md transition-all border-2 ${formData.listingType === type ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                                    onClick={() => setFormData({ ...formData, listingType: type })}
                                >
                                    <CardContent className="p-4 sm:p-6 text-center">
                                        <Icon className={`w-8 h-8 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-4 ${formData.listingType === type ? 'text-primary' : 'text-muted-foreground'}`} />
                                        <h3 className={`font-semibold text-sm sm:text-lg ${formData.listingType === type ? 'text-foreground' : 'text-muted-foreground'}`}>{type}</h3>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                        {(formData.listingType === 'For Rent' || formData.listingType === 'Required Roommate') && (
                            <div className="space-y-3 sm:space-y-4 p-4 sm:p-6 rounded-lg bg-muted/50 border border-border">
                                <Label className="text-sm sm:text-base font-semibold">Preferred Gender</Label>
                                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                                    {[
                                        { label: 'Male', icon: User },
                                        { label: 'Female', icon: Users },
                                        { label: 'Any', icon: Users }
                                    ].map(({ label, icon: Icon }) => (
                                        <Card
                                            key={label}
                                            className={`cursor-pointer transition-all border-2 ${formData.preferredGender === label ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                                            onClick={() => setFormData({ ...formData, preferredGender: label })}
                                        >
                                            <CardContent className="p-3 sm:p-4 flex flex-col items-center gap-1 sm:gap-2">
                                                <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${formData.preferredGender === label ? 'text-primary' : 'text-muted-foreground'}`} />
                                                <p className={`text-xs sm:text-sm font-medium ${formData.preferredGender === label ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</p>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                );

            case 2:
                return (
                    <div className="space-y-4 sm:space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                            {[
                                { type: '1RK', icon: DoorOpen },
                                { type: '1BHK', icon: Home },
                                { type: '2BHK', icon: Building2 },
                                { type: '3BHK', icon: LayoutGrid },
                                { type: '4BHK', icon: Building2 },
                                { type: 'PG', icon: Users },
                                { type: 'Dormitory', icon: Grid3x3 },
                                { type: 'Studio', icon: Maximize }
                            ].map(({ type, icon: Icon }) => (
                                <Card 
                                    key={type}
                                    className={`cursor-pointer hover:shadow-md transition-all border-2 ${
                                        formData.roomType === type 
                                            ? 'border-primary bg-primary/5' 
                                            : 'border-border hover:border-primary/50'
                                    }`}
                                    onClick={() => setFormData({ ...formData, roomType: type })}
                                >
                                    <CardContent className="p-3 sm:p-4 text-center">
                                        <Icon className={`w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-1 sm:mb-2 ${formData.roomType === type ? 'text-primary' : 'text-muted-foreground'}`} />
                                        <p className={`font-semibold text-xs sm:text-sm ${formData.roomType === type ? 'text-foreground' : 'text-muted-foreground'}`}>{type}</p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                        <div className="space-y-3 sm:space-y-4">
                            <Label className="text-sm sm:text-base font-semibold">House Type</Label>
                            <div className="grid grid-cols-3 gap-3 sm:gap-4">
                                {[
                                    { label: 'Flat', icon: Building2 },
                                    { label: 'Apartment', icon: Warehouse },
                                    { label: 'House', icon: Home }
                                ].map(({ label, icon: Icon }) => (
                                    <Card 
                                        key={label}
                                        className={`cursor-pointer transition-all border-2 ${
                                            formData.houseType === label ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                                        }`}
                                        onClick={() => setFormData({ ...formData, houseType: label })}
                                    >
                                        <CardContent className="p-4 sm:p-6 flex flex-col items-center gap-2 sm:gap-3 text-center">
                                            <Icon className={`w-6 h-6 sm:w-8 sm:h-8 ${formData.houseType === label ? 'text-primary' : 'text-muted-foreground'}`} />
                                            <p className={`font-medium text-xs sm:text-sm ${formData.houseType === label ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</p>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    </div>
                );

            case 3:
                return (
                    <div className="space-y-4 sm:space-y-6">
                        <div className="space-y-3 p-3 sm:p-4 rounded-lg bg-muted/50 border border-border">
                            <LocationPickerMap
                                latitude={formData.latitude}
                                longitude={formData.longitude}
                                onCoordinatesChange={handleCoordinatesChange}
                                onLocationDetailsChange={handleLocationDetailsChange}
                            />
                            <p className="text-sm text-muted-foreground">
                                Search in India, fetch your current location, or click/drag the marker to set exact room location.
                            </p>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label className="font-semibold">
                                        City / District
                                        {locationFetched && <span className="text-green-600 ml-1">✓ Detected</span>}
                                    </Label>
                                    <Input 
                                        placeholder="e.g., Pune"
                                        value={formData.city}
                                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-semibold">
                                        Area <span className="text-red-500">*</span>
                                        {locationFetched && formData.area && <span className="text-green-600 ml-1">✓ Detected</span>}
                                    </Label>
                                    <Input 
                                        placeholder="e.g., Koregaon Park"
                                        value={formData.area}
                                        onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-semibold">
                                        PIN Code <span className="text-red-500">*</span>
                                        {locationFetched && formData.pincode && <span className="text-green-600 ml-1">✓ Detected</span>}
                                    </Label>
                                    <Input 
                                        placeholder="411001"
                                        maxLength={6}
                                        value={formData.pincode}
                                        onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="font-semibold">
                                    Full Address <span className="text-red-500">*</span>
                                    {locationFetched && formData.address && <span className="text-green-600 ml-1">✓ Detected</span>}
                                </Label>
                                <Input 
                                    placeholder="Enter complete address"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                );

            case 4:
                return (
                    <div className="space-y-4 sm:space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="font-semibold">Available From <span className="text-red-500">*</span></Label>
                                <Input 
                                    type="date"
                                    value={formData.availabilityFrom}
                                    onChange={(e) => setFormData({ ...formData, availabilityFrom: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="font-semibold">Contact Privacy</Label>
                                <div className="flex gap-3">
                                    {[
                                        { value: 'Private', label: 'Secure Chat', icon: Lock, help: 'Your number stays private, contact through platform' },
                                        { value: 'Public', label: 'Share Details', icon: Share2, help: 'Your number is visible to everyone' }
                                    ].map(({ value, label, icon: Icon, help }) => (
                                        <div key={value} className="flex-1">
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, contactVisibility: value as 'Private' | 'Public' })}
                                                className={`w-full flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                                                    formData.contactVisibility === value
                                                        ? 'border-primary bg-primary/10 text-primary'
                                                        : 'border-border bg-background text-muted-foreground hover:border-primary/50'
                                                }`}
                                            >
                                                <Icon className="w-4 h-4" />
                                                <span className="text-sm font-medium">{label}</span>
                                            </button>
                                            <p className="text-xs text-muted-foreground mt-1">{help}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        {(formData.listingType === 'For Rent' || formData.listingType === 'Required Roommate') && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="font-semibold">Rent (per month) <span className="text-red-500">*</span></Label>
                                    <Input 
                                        type="number"
                                        placeholder="Enter rent amount"
                                        value={formData.rent}
                                        onChange={(e) => setFormData({ ...formData, rent: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-semibold">Deposit <span className="text-red-500">*</span></Label>
                                    <Input 
                                        type="number"
                                        placeholder="Enter deposit amount"
                                        value={formData.deposit}
                                        onChange={(e) => setFormData({ ...formData, deposit: e.target.value })}
                                    />
                                </div>
                            </div>
                        )}
                        {formData.listingType === 'For Sell' && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="font-semibold">Cost <span className="text-red-500">*</span></Label>
                                    <Input 
                                        type="number"
                                        placeholder="Enter cost amount"
                                        value={formData.cost}
                                        onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-semibold">Size (sqft) <span className="text-red-500">*</span></Label>
                                    <Input 
                                        type="number"
                                        placeholder="Enter size in sqft"
                                        value={formData.sizeSqft}
                                        onChange={(e) => setFormData({ ...formData, sizeSqft: e.target.value })}
                                    />
                                </div>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label className="font-semibold">
                                Contact Number 
                                <span className="text-red-500">*</span>
                                {contactFetched && <span className="text-green-600 ml-1">✓ Fetched from Profile</span>}
                            </Label>
                            <Input 
                                type="tel"
                                placeholder="Enter your contact number"
                                value={formData.contact}
                                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="font-semibold">Existing Roommates</Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() =>
                                        setFormData((previous) => ({
                                            ...previous,
                                            existingRoommates: [...previous.existingRoommates, { name: '', city: '' }]
                                        }))
                                    }
                                >
                                    Add Roommate
                                </Button>
                            </div>
                            <p className="text-sm text-muted-foreground">It will help you to find Member from your Local City.</p>
                            {formData.existingRoommates.length === 0 && (
                                <p className="text-sm text-muted-foreground">No roommates added yet.</p>
                            )}
                            <div className="space-y-3">
                                {formData.existingRoommates.map((roommate, index) => (
                                    <div key={`roommate-${index}`} className="grid grid-cols-1 md:grid-cols-[1fr,1fr,auto] gap-4 items-end">
                                        <div className="space-y-2">
                                            <Label className="text-sm text-muted-foreground">Roommate Name</Label>
                                            <Input
                                                placeholder="Enter roommate name"
                                                value={roommate.name}
                                                onChange={(e) => {
                                                    const value = e.target.value;
                                                    setFormData((previous) => ({
                                                        ...previous,
                                                        existingRoommates: previous.existingRoommates.map((item, idx) =>
                                                            idx === index ? { ...item, name: value } : item
                                                        )
                                                    }));
                                                }}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-sm text-muted-foreground">City</Label>
                                            <Input
                                                placeholder="Enter city"
                                                value={roommate.city}
                                                onChange={(e) => {
                                                    const value = e.target.value;
                                                    setFormData((previous) => ({
                                                        ...previous,
                                                        existingRoommates: previous.existingRoommates.map((item, idx) =>
                                                            idx === index ? { ...item, city: value } : item
                                                        )
                                                    }));
                                                }}
                                            />
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={() =>
                                                setFormData((previous) => ({
                                                    ...previous,
                                                    existingRoommates: previous.existingRoommates.filter((_, idx) => idx !== index)
                                                }))
                                            }
                                        >
                                            Remove
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );

            case 5:
                const facilityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
                    'WiFi': Wifi,
                    'Parking': ParkingSquare,
                    'Lift': ArrowUpDown,
                    'Gym': Dumbbell,
                    'Power Backup': Zap,
                    'Water Supply': Droplet,
                    'Security': Shield,
                    'CCTV': Camera
                };

                return (
                    <div className="space-y-8">
                        <div className="space-y-4">
                            <Label className="text-base font-semibold">Furnishing Type</Label>
                            <div className="grid grid-cols-3 gap-2 sm:gap-4">
                                {[
                                    { label: 'Furnished', icon: Sofa },
                                    { label: 'Semi-furnished', icon: Box },
                                    { label: 'Unfurnished', icon: Square }
                                ].map(({ label, icon: Icon }) => (
                                    <Card 
                                        key={label}
                                        className={`cursor-pointer transition-all border-2 ${formData.furnishingType === label ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                                        onClick={() => setFormData({ ...formData, furnishingType: label })}
                                    >
                                        <CardContent className="p-3 sm:p-6 flex flex-col items-center gap-3 text-center">
                                            <Icon className={`w-6 h-6 sm:w-8 sm:h-8 ${formData.furnishingType === label ? 'text-primary' : 'text-muted-foreground'}`} />
                                            <p className={`font-medium text-xs sm:text-sm ${formData.furnishingType === label ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</p>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-4">
                            <Label className="text-base font-semibold">Facilities</Label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
                                {['WiFi', 'Parking', 'Lift', 'Gym', 'Power Backup', 'Water Supply', 'Security', 'CCTV'].map((facility) => {
                                    const Icon = facilityIcons[facility];
                                    return (
                                        <Card
                                            key={facility}
                                            className={`cursor-pointer transition-all border-2 ${formData.facilities.includes(facility) ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                                            onClick={() => {
                                                if (formData.facilities.includes(facility)) {
                                                    setFormData({ ...formData, facilities: formData.facilities.filter((f: string) => f !== facility) });
                                                } else {
                                                    setFormData({ ...formData, facilities: [...formData.facilities, facility] });
                                                }
                                            }}
                                        >
                                            <CardContent className="p-2 sm:p-4 flex flex-col items-center gap-2 text-center">
                                                {Icon && <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${formData.facilities.includes(facility) ? 'text-primary' : 'text-muted-foreground'}`} />}
                                                <Label className={`font-normal text-xs sm:text-sm cursor-pointer ${formData.facilities.includes(facility) ? 'text-foreground' : 'text-muted-foreground'}`}>{facility}</Label>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                );

            case 6:
                return (
                    <div className="space-y-4 sm:space-y-6">
                        <div className="space-y-2">
                            <Label className="text-base font-semibold">Title</Label>
                            <Input 
                                placeholder="e.g., 2BHK Flat for Rent in Koregaon Park"
                                value={formData.title}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setFormData({ ...formData, title: value });
                                    setIsTitleManuallyEdited(value.trim().length > 0);
                                }}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-base font-semibold">Note / Description</Label>
                            <textarea
                                className="w-full min-h-[150px] p-3 border rounded-md border-input focus:border-ring focus:ring-2 focus:ring-ring/20 bg-background text-foreground"
                                placeholder="Add any additional details about the room..."
                                value={formData.note}
                                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                            />
                        </div>
                    </div>
                );

            case 7:
                return (
                    <div className="space-y-4 sm:space-y-6">
                        <div className="border-2 border-dashed border-border bg-muted/30 rounded-lg p-12 text-center transition-all hover:border-primary/50">
                            <input
                                ref={imageInputRef}
                                type="file"
                                accept="image/jpeg,image/png"
                                multiple
                                className="hidden"
                                onChange={handleImageSelection}
                                aria-label="Upload room images"
                            />
                            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                            <p className="text-foreground mb-2 font-semibold">Drag and drop images here</p>
                            <p className="text-sm text-muted-foreground mb-4">or</p>
                            <Button variant="outline" type="button" onClick={handleBrowseImages} disabled={isImageUploading}>
                                {isImageUploading ? 'Uploading...' : 'Browse Files'}
                            </Button>
                            <p className="text-sm mt-4 text-muted-foreground font-semibold">Uploaded: {formData.images.length}/5</p>
                            {formData.images.length > 0 && (
                                <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {formData.images.map((imageUrl: string, index: number) => (
                                        <div key={`${imageUrl}-${index}`} className="relative group rounded-lg overflow-hidden border-2 border-border">
                                            <img
                                                src={imageUrl}
                                                alt={`Room ${index + 1}`}
                                                className="w-full h-24 object-cover"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setFormData((previous: FormDataType) => ({
                                                        ...previous,
                                                        images: previous.images.filter((_: string, i: number) => i !== index)
                                                    }));
                                                }}
                                                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                aria-label="Remove image"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <p className="text-xs text-muted-foreground mt-4">
                                Max 5 images, 500KB each. JPG, PNG supported.
                            </p>
                        </div>
                    </div>
                );

            case 8:
                return (
                    <div className="space-y-4 sm:space-y-6">
                        {user?.role === 'Broker' && !isBrokerSubscriptionActive && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                                Without active subscription, broker needs to pay for each post and the listing will go to pending approval.
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[
                                { name: 'Basic', price: 'Free', features: ['15 days visibility', 'Basic support'], icon: '⭐' },
                                { name: 'Standard', price: '₹199', features: ['30 days visibility', 'Priority listing', 'Email support'], icon: '💎', recommended: true },
                                { name: 'Premium', price: '₹499', features: ['60 days visibility', 'Featured tag', 'Priority support'], icon: '👑' }
                            ].map((plan) => (
                                <Card 
                                    key={plan.name}
                                    className={`cursor-pointer transition-all hover:shadow-md relative border-2 ${
                                        formData.planType === plan.name ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                                    }`}
                                    onClick={() => setFormData({ ...formData, planType: plan.name })}
                                >
                                    {plan.recommended && <div className="absolute -top-3 -right-3 bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-bold">RECOMMENDED</div>}
                                    <CardContent className="p-6">
                                        <div className="text-3xl mb-2">{plan.icon}</div>
                                        <h3 className={`font-semibold text-lg ${formData.planType === plan.name ? 'text-foreground' : 'text-muted-foreground'}`}>{plan.name}</h3>
                                        {user?.role === 'Broker' && isBrokerSubscriptionActive ? (
                                            <div className="my-2 space-y-1">
                                                <p className={`text-lg line-through ${formData.planType === plan.name ? 'text-muted-foreground' : 'text-muted-foreground/80'}`}>{plan.price}</p>
                                                <p className={`text-xl font-bold ${formData.planType === plan.name ? 'text-foreground' : 'text-muted-foreground'}`}>Free for Subscribed broker</p>
                                            </div>
                                        ) : (
                                            <p className={`text-2xl font-bold my-2 ${formData.planType === plan.name ? 'text-foreground' : 'text-muted-foreground'}`}>{plan.price}</p>
                                        )}
                                        <ul className="space-y-2">
                                            {plan.features.map((feature, i) => (
                                                <li key={i} className={`text-sm flex items-center gap-2 ${formData.planType === plan.name ? 'text-foreground' : 'text-muted-foreground'}`}>
                                                    <Check className={`w-4 h-4 ${formData.planType === plan.name ? 'text-primary' : 'text-primary/70'}`} />
                                                    {feature}
                                                </li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                        <div className="flex items-start gap-3 rounded-lg border-2 border-border bg-muted/50 p-4">
                            <Checkbox
                                id="terms-accept"
                                checked={isTermsAccepted}
                                onCheckedChange={(checked: boolean | string) => setIsTermsAccepted(Boolean(checked))}
                            />
                            <Label htmlFor="terms-accept" className="font-normal leading-6 cursor-pointer text-foreground">
                                I accept the{' '}
                                <a
                                    href="/terms-conditions"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline font-semibold"
                                >
                                    Terms & Conditions
                                </a>
                                {' '}for posting this room listing.
                            </Label>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    const getMotivatingText = () => {
        const progress = (currentStep / steps.length) * 100;
        if (progress < 25) return 'Let\'s get started';
        if (progress < 50) return 'You\'re doing great';
        if (progress < 75) return 'Making good progress';
        if (progress < 100) return 'You are very close, almost done';
        return 'Ready to submit';
    };

    const isGuestView = !isAuthenticated;

    const activeStepTitle = steps[currentStep - 1]?.title || 'Post Room';

    return (
        <div className={`${isGuestView ? 'max-w-[1600px]' : 'max-w-[1440px]'} mx-auto px-1 sm:px-4 lg:px-6 pb-8`}>
            <div className="flex items-center gap-4 mb-4 sm:mb-6">
                <Button variant="ghost" onClick={() => navigate(isAuthenticated ? '/dashboard/rooms' : '/')}>
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Back
                </Button>
                <h1 className="text-2xl font-bold text-foreground">Post a Room</h1>
            </div>

            {isGuestView && (
                <div className="mb-6 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 via-blue-100 to-cyan-50 p-3 sm:p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-sm font-semibold text-slate-800">Guest Posting Mode</p>
                            <p className="text-xs text-slate-600">Fill the form normally. At final submit, quick account + OTP verification will be shown and your draft stays saved.</p>
                        </div>
                        <div className="text-xs font-medium text-blue-700">No data loss • Resume from same step</div>
                    </div>
                </div>
            )}

            <Card ref={formStartRef} className="shadow-sm border-border/70 bg-gradient-to-b from-background to-muted/20">
                <CardContent className="px-0.5 py-2 sm:px-1 sm:py-4 lg:px-1.25 lg:py-5">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                            <h3 className="text-base sm:text-lg font-semibold text-foreground truncate">
                                {activeStepTitle}
                            </h3>
                        </div>

                        <span className="text-xs sm:text-sm font-medium text-primary sm:text-right">
                            {getMotivatingText()}
                        </span>
                    </div>

                    <div className="mb-4">
                        <progress
                            className="w-full h-2 rounded-full overflow-hidden"
                            value={currentStep}
                            max={steps.length}
                            aria-label="Form completion progress"
                        />
                    </div>

                    {renderStep()}

                    <div className="mt-6 flex items-center justify-between gap-2 overflow-x-auto">
                        <div className="flex items-center gap-2 flex-nowrap">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleBack}
                                disabled={currentStep === 1}
                                className="whitespace-nowrap"
                            >
                                <ChevronLeft className="w-4 h-4 mr-1.5" />
                                Back
                            </Button>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleClearForm}
                                className="whitespace-nowrap"
                            >
                                <RefreshCcw className="w-4 h-4 mr-1.5" />
                                Reset All
                            </Button>
                        </div>

                        <div className="flex items-center justify-end flex-nowrap ml-auto">
                            {currentStep < steps.length ? (
                                <Button size="sm" onClick={handleNext} disabled={isLoadingNext} className="whitespace-nowrap">
                                    {isLoadingNext ? 'Loading...' : 'Next'}
                                    <ChevronRight className="w-4 h-4 ml-1.5" />
                                </Button>
                            ) : (
                                <Button
                                    size="sm"
                                    onClick={() => void handleSubmit()}
                                    disabled={isSubmitting || !isTermsAccepted}
                                    className="min-w-32 whitespace-nowrap"
                                >
                                    {isSubmitting ? 'Submitting...' : 'Post Room'}
                                </Button>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Dialog
                open={subscriptionBlockDialog.open}
                onOpenChange={(open) => setSubscriptionBlockDialog((prev) => ({ ...prev, open }))}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {subscriptionBlockDialog.status === 'expired'
                                ? 'Posting Subscription Expired'
                                : subscriptionBlockDialog.status === 'suspended'
                                ? 'Subscription Suspended'
                                : 'Subscription Required'}
                        </DialogTitle>
                        <DialogDescription>
                            {subscriptionBlockDialog.message || 'You cannot post room without an active broker subscription.'}
                        </DialogDescription>
                    </DialogHeader>

                    {subscriptionBlockDialog.status !== 'suspended' && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                            Without active subscription, each room post is chargeable and will go to pending approval.
                            Renew subscription for subscription benefits and uninterrupted posting.
                        </div>
                    )}

                    <div className="text-sm text-muted-foreground">
                        Please contact support: <span className="font-medium text-foreground">{supportEmail}</span>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            className="border-blue-300 text-blue-700 hover:bg-blue-50"
                            onClick={() => {
                                window.location.href = `mailto:${supportEmail}`;
                            }}
                        >
                            Contact Support
                        </Button>
                        {subscriptionBlockDialog.status !== 'suspended' && (
                            <Button
                                className="bg-green-600 text-white hover:bg-green-700"
                                onClick={() => {
                                    void handlePostWithoutSubscription();
                                }}
                            >
                                Post Room (Pending)
                            </Button>
                        )}
                        <Button
                            variant="secondary"
                            className="bg-amber-100 text-amber-800 hover:bg-amber-200"
                            onClick={() => {
                                setSubscriptionBlockDialog((prev) => ({ ...prev, open: false }));
                                navigate('/dashboard/plans');
                            }}
                        >
                            Renew Subscription
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={quickRegisterDialogOpen} onOpenChange={setQuickRegisterDialogOpen}>
                <DialogContent className="max-h-[90vh] overflow-hidden p-0 sm:max-w-4xl">
                    <div className="grid max-h-[90vh] grid-cols-1 md:grid-cols-[1.1fr,1.4fr]">
                        <div className="hidden border-r bg-gradient-to-br from-slate-900 via-blue-900 to-cyan-800 p-6 text-white md:block">
                            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">Quick Posting Access</p>
                            <h3 className="mt-3 text-2xl font-bold">Continue your room post without losing the draft.</h3>
                            <p className="mt-3 text-sm text-white/80">Login if you already have an account. If not, create a compact account here and verify OTP.</p>
                            <div className="mt-6 space-y-3 text-sm text-white/85">
                                <div className="rounded-lg border border-white/15 bg-white/10 p-3">Draft and current step stay saved.</div>
                                <div className="rounded-lg border border-white/15 bg-white/10 p-3">Existing users can login and post immediately.</div>
                                <div className="rounded-lg border border-white/15 bg-white/10 p-3">New brokers remain pending admin approval.</div>
                            </div>
                        </div>

                        <div className="overflow-y-auto p-5 sm:p-6">
                            <DialogHeader className="mb-4 text-left">
                                <DialogTitle>
                                    {quickAuthMode === 'login' ? 'Login to continue' : 'Create quick account'}
                                </DialogTitle>
                                <DialogDescription>
                                    {quickAuthMode === 'login'
                                        ? 'Use your existing account. If no account exists, you can create one here after confirmation.'
                                        : 'This compact registration is only for completing your room post quickly.'}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg border bg-muted/20 p-1">
                                <button
                                    type="button"
                                    className={`rounded-md px-3 py-2 text-sm font-medium transition ${quickAuthMode === 'login' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:bg-background/70'}`}
                                    onClick={() => {
                                        setQuickAuthMode('login');
                                        setQuickRegisterError('');
                                    }}
                                >
                                    Shortcut Login
                                </button>
                                <button
                                    type="button"
                                    className={`rounded-md px-3 py-2 text-sm font-medium transition ${quickAuthMode === 'register' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:bg-background/70'}`}
                                    onClick={() => {
                                        setQuickAuthMode('register');
                                        setQuickRegisterConfirmed(true);
                                        setQuickRegisterError('');
                                    }}
                                >
                                    Shortcut Register
                                </button>
                            </div>

                            {quickAuthMode === 'login' ? (
                                <div className="space-y-4">
                                    {quickLoginError && (
                                        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                                            {quickLoginError}
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label htmlFor="quick-email">Email</Label>
                                        <Input
                                            id="quick-email"
                                            type="email"
                                            placeholder="you@example.com"
                                            value={quickRegisterData.email}
                                            onChange={(e) => setQuickRegisterData((prev) => ({ ...prev, email: e.target.value }))}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="quick-login-password">Password</Label>
                                        <Input
                                            id="quick-login-password"
                                            type="password"
                                            placeholder="Enter your password"
                                            value={quickLoginPassword}
                                            onChange={(e) => setQuickLoginPassword(e.target.value)}
                                        />
                                    </div>

                                    <DialogFooter className="pt-2">
                                        <Button
                                            variant="outline"
                                            onClick={() => setQuickRegisterDialogOpen(false)}
                                            disabled={quickLoginLoading}
                                        >
                                            Cancel
                                        </Button>
                                        <Button onClick={() => void handleQuickLogin()} disabled={quickLoginLoading}>
                                            {quickLoginLoading ? 'Logging in...' : 'Login & Post'}
                                        </Button>
                                    </DialogFooter>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                                        <span>Compact registration for this room draft</span>
                                        <button
                                            type="button"
                                            className="font-medium text-primary hover:underline"
                                            onClick={() => {
                                                setQuickAuthMode('login');
                                                setQuickRegisterConfirmed(false);
                                                setQuickRegisterError('');
                                            }}
                                        >
                                            Back to Login
                                        </button>
                                    </div>

                                    {quickRegisterError && quickRegisterConfirmed && (
                                        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                                            {quickRegisterError}
                                        </div>
                                    )}

                                    {!quickRegisterConfirmed && (
                                        <div className="rounded-lg border border-blue-300 bg-blue-50 p-4 text-sm text-blue-900">
                                            <p className="font-semibold">No account found for this email.</p>
                                            <p className="mt-1 text-xs text-blue-800">Please accept to create a quick account and continue posting this room.</p>
                                            <div className="mt-3 flex items-center gap-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="border-blue-300 text-blue-800 hover:bg-blue-100"
                                                    onClick={() => setQuickAuthMode('login')}
                                                >
                                                    Back
                                                </Button>
                                                <Button
                                                    type="button"
                                                    className="bg-blue-600 text-white hover:bg-blue-700"
                                                    onClick={() => {
                                                        setQuickRegisterConfirmed(true);
                                                        setQuickRegisterError('');
                                                    }}
                                                >
                                                    Accept & Create Quick Account
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    {quickRegisterConfirmed && (
                                        <>
                                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                                <div className="space-y-2">
                                                    <Label htmlFor="quick-register-email">Email</Label>
                                                    <Input
                                                        id="quick-register-email"
                                                        type="email"
                                                        placeholder="you@example.com"
                                                        value={quickRegisterData.email}
                                                        onChange={(e) => setQuickRegisterData((prev) => ({ ...prev, email: e.target.value }))}
                                                    />
                                                </div>

                                                <div className="space-y-2">
                                                    <Label htmlFor="quick-contact">Phone Number</Label>
                                                    <Input
                                                        id="quick-contact"
                                                        type="tel"
                                                        maxLength={10}
                                                        placeholder="10-digit mobile number"
                                                        value={quickRegisterData.contact}
                                                        onChange={(e) => {
                                                            const sanitized = e.target.value.replace(/\D/g, '').slice(0, 10);
                                                            setQuickRegisterData((prev) => ({ ...prev, contact: sanitized }));
                                                        }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="quick-role">Account Type</Label>
                                                <Select
                                                    value={quickRegisterData.role}
                                                    onValueChange={(value: 'Member' | 'Broker') => {
                                                        setQuickRegisterData((prev) => ({
                                                            ...prev,
                                                            role: value,
                                                            selectedPlanId: value === 'Broker' ? prev.selectedPlanId : '',
                                                        }));

                                                        if (value !== 'Broker') {
                                                            setBrokerAreas([]);
                                                            setCurrentBrokerArea('');
                                                            setShowAreaSuggestions(false);
                                                        }
                                                    }}
                                                >
                                                    <SelectTrigger id="quick-role">
                                                        <SelectValue placeholder="Select role" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Member">Member (Default)</SelectItem>
                                                        <SelectItem value="Broker">Broker</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {quickRegisterData.role === 'Broker' && (
                                                <div className="space-y-4 rounded-xl border bg-slate-50 p-4">
                                                    <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
                                                        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                                                        <div>
                                                            <p className="font-medium">Broker accounts need admin approval.</p>
                                                            <p className="mt-1">Select your plan and add the areas you cover. Your room draft remains saved.</p>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label>Broker Plan</Label>
                                                        {isLoadingBrokerPlans ? (
                                                            <div className="flex items-center justify-center rounded-md border bg-background p-4 text-sm text-muted-foreground">
                                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                Loading plans...
                                                            </div>
                                                        ) : (
                                                            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                                                                {brokerPlans.map((plan) => {
                                                                    const features = parsePlanFeatures((plan as unknown as { features?: unknown }).features);
                                                                    const discount = typeof features.discount === 'string' ? features.discount : '';
                                                                    const isSelected = quickRegisterData.selectedPlanId === String(plan.id);

                                                                    return (
                                                                        <button
                                                                            key={plan.id}
                                                                            type="button"
                                                                            onClick={() => setQuickRegisterData((prev) => ({ ...prev, selectedPlanId: String(plan.id) }))}
                                                                            className={`rounded-lg border-2 bg-background p-4 text-left transition ${isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
                                                                        >
                                                                            <p className="text-sm font-semibold">{plan.plan_name}</p>
                                                                            <p className="mt-1 text-xl font-bold text-primary">Rs {Number(plan.price || 0).toLocaleString()}</p>
                                                                            <p className="text-xs text-muted-foreground">{plan.duration_days === 30 ? 'per month' : 'per year'}</p>
                                                                            {plan.description && <p className="mt-2 text-xs text-muted-foreground">{plan.description}</p>}
                                                                            <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                                                                                <li>✓ {String(features.postings || 'Unlimited')} postings</li>
                                                                                <li>✓ Auto-approved rooms</li>
                                                                                <li>✓ Edit anytime</li>
                                                                                {discount && <li>✓ {discount}</li>}
                                                                            </ul>
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label htmlFor="quick-broker-area">
                                                            Area You Cover
                                                            <span className="ml-1 text-red-500">*</span>
                                                        </Label>
                                                        <div className="relative">
                                                            <div className="flex gap-2">
                                                                <Input
                                                                    id="quick-broker-area"
                                                                    placeholder="Type area and press Enter"
                                                                    value={currentBrokerArea}
                                                                    onChange={(e) => setCurrentBrokerArea(e.target.value)}
                                                                    onFocus={() => {
                                                                        if (filteredAreaSuggestions.length > 0) {
                                                                            setShowAreaSuggestions(true);
                                                                        }
                                                                    }}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            e.preventDefault();
                                                                            addBrokerArea();
                                                                        }
                                                                    }}
                                                                />
                                                                <Button type="button" variant="outline" onClick={addBrokerArea}>
                                                                    <Plus className="mr-1 h-4 w-4" />
                                                                    Add
                                                                </Button>
                                                            </div>
                                                            {showAreaSuggestions && filteredAreaSuggestions.length > 0 && (
                                                                <div className="absolute z-20 mt-1 w-full rounded-md border bg-background shadow-md">
                                                                    {filteredAreaSuggestions.map((suggestion) => (
                                                                        <button
                                                                            key={suggestion}
                                                                            type="button"
                                                                            className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                                                                            onClick={() => {
                                                                                setCurrentBrokerArea(suggestion);
                                                                                setShowAreaSuggestions(false);
                                                                            }}
                                                                        >
                                                                            {suggestion}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {brokerAreas.length > 0 ? (
                                                            <div className="flex flex-wrap gap-2 pt-1">
                                                                {brokerAreas.map((area) => (
                                                                    <span key={area} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
                                                                        {area}
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setBrokerAreas((previous) => previous.filter((item) => item !== area))}
                                                                            className="rounded-full p-0.5 hover:bg-primary/20"
                                                                            aria-label={`Remove ${area}`}
                                                                        >
                                                                            <X className="h-3 w-3" />
                                                                        </button>
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs text-muted-foreground">Add one or more localities you cover.</p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            <DialogFooter className="pt-2">
                                                <Button
                                                    variant="outline"
                                                    onClick={() => setQuickRegisterDialogOpen(false)}
                                                    disabled={quickRegisterLoading}
                                                >
                                                    Cancel
                                                </Button>
                                                <Button onClick={() => void handleQuickRegister()} disabled={quickRegisterLoading}>
                                                    {quickRegisterLoading ? 'Creating...' : 'Create & Send OTP'}
                                                </Button>
                                            </DialogFooter>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={quickOtpDialogOpen} onOpenChange={setQuickOtpDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Verify OTP</DialogTitle>
                        <DialogDescription>
                            Enter the 6-digit OTP sent to {quickRegisterData.email}.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                        <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                            Save draft before OTP: your filled room form data and current step are preserved while you verify.
                        </div>
                        {quickOtpError && <p className="text-sm text-destructive">{quickOtpError}</p>}
                        <div className="space-y-2">
                            <Label htmlFor="quick-otp">OTP</Label>
                            <Input
                                id="quick-otp"
                                inputMode="numeric"
                                maxLength={6}
                                placeholder="Enter 6-digit OTP"
                                value={quickOtp}
                                onChange={(e) => setQuickOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => void handleQuickOtpResend()} disabled={quickResendLoading || quickOtpLoading}>
                            {quickResendLoading ? 'Resending...' : 'Resend OTP'}
                        </Button>
                        <Button onClick={() => void handleQuickOtpVerify()} disabled={quickOtpLoading}>
                            {quickOtpLoading ? 'Verifying...' : 'Verify & Continue'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default PostRoomPage;
