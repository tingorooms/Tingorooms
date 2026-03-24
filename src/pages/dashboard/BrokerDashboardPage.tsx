import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Building2,
    Calendar,
    CreditCard,
    CheckCircle,
    XCircle,
    Clock,
    History,
    RefreshCw,
    AlertCircle,
    Zap,
    MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';
import { getBrokerSubscription, getAvailablePlans, createSubscription } from '@/services/subscriptionService';
import type { BrokerSubscriptionStats, Plan } from '@/types';
import { cn } from '@/lib/utils';

const formatCompactDate = (value?: string | Date | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';

    const day = String(date.getDate()).padStart(2, '0');
    const monthShort = date.toLocaleString('en-US', { month: 'short' }).toLowerCase();
    const month = monthShort.charAt(0).toUpperCase() + monthShort.slice(1);
    const year = date.getFullYear();

    return `${day}-${month}-${year}`;
};

const BrokerDashboardPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [stats, setStats] = useState<BrokerSubscriptionStats | null>(null);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [renewingPlanId, setRenewingPlanId] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState(location.pathname === '/dashboard/plans' ? 'plans' : 'rooms');
    const [selectedPlanForPurchase, setSelectedPlanForPurchase] = useState<Plan | null>(null);
    const [confirmStep, setConfirmStep] = useState<1 | null>(null);
    const [successDialogOpen, setSuccessDialogOpen] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (location.pathname === '/dashboard/plans') {
            setActiveTab('plans');
            return;
        }

        if (location.pathname === '/dashboard') {
            setActiveTab('rooms');
        }
    }, [location.pathname]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [statsData, plansData] = await Promise.all([
                getBrokerSubscription(),
                getAvailablePlans()
            ]);
            setStats(statsData);
            setPlans(plansData);
        } catch (error) {
            toast.error('Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    const openPurchaseConfirmation = (planId: number) => {
        const selectedPlan = plans.find((plan) => plan.id === planId) || null;
        if (!selectedPlan) {
            toast.error('Selected plan not found');
            return;
        }

        setSelectedPlanForPurchase(selectedPlan);
        setConfirmStep(1);
    };

    const closeConfirmationDialogs = () => {
        setConfirmStep(null);
        setSelectedPlanForPurchase(null);
    };

    const handleRenewSubscription = async (planId: number) => {
        try {
            setRenewingPlanId(planId);
            const result = await createSubscription(planId);
            toast.success(result.message || 'Subscription request submitted');
            setSuccessDialogOpen(true);
            await fetchData();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to renew subscription');
        } finally {
            setRenewingPlanId(null);
            closeConfirmationDialogs();
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Completed':
                return 'bg-green-500';
            case 'Pending':
                return 'bg-yellow-500';
            case 'Rejected':
                return 'bg-red-500';
            case 'Suspended':
                return 'bg-orange-500';
            case 'Refunded':
                return 'bg-gray-500';
            default:
                return 'bg-gray-500';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'Completed':
                return <CheckCircle className="h-4 w-4" />;
            case 'Pending':
                return <Clock className="h-4 w-4" />;
            case 'Rejected':
                return <XCircle className="h-4 w-4" />;
            case 'Suspended':
                return <AlertCircle className="h-4 w-4" />;
            default:
                return <Clock className="h-4 w-4" />;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    const currentSub = stats?.currentSubscription;
    
    // Check for suspended subscription
    const isSuspended = currentSub?.payment_status === 'Suspended';
    
    // Use backend's isActive calculation (already checks expiration correctly)
    const isSubscriptionActive = !isSuspended && (stats?.isActive || false);
    const subscriptionStatusLabel = !stats 
        ? 'Unavailable' 
        : isSuspended 
        ? 'Suspended' 
        : isSubscriptionActive 
        ? 'Active' 
        : 'Inactive';
    const isPlansPage = location.pathname === '/dashboard/plans';

    // Calculate days status for display
    const daysRemaining = stats?.daysRemaining || 0;
    const isExpired = daysRemaining < 0;
    const daysText = isSuspended
        ? 'Suspended'
        : isExpired 
        ? `Expired ${Math.abs(daysRemaining)} days ago`
        : `${daysRemaining} days left`;

    const getPendingBaseStartDate = () => {
        const now = new Date();
        if (currentSub?.expires_at && new Date(currentSub.expires_at) > now) {
            const nextDay = new Date(currentSub.expires_at);
            nextDay.setDate(nextDay.getDate() + 1);
            return nextDay;
        }
        return now;
    };

    const getPlanTimeline = (durationDays: number) => {
        const startDate = getPendingBaseStartDate();
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + Number(durationDays || 0));

        return {
            startDate,
            endDate,
        };
    };

    const subscriptionHistory = (stats?.subscriptionHistory || []).filter((sub, index, list) => {
        return index === list.findIndex(
            (item) => item.id === sub.id && item.created_at === sub.created_at
        );
    });

    const getHistoryTimeline = (sub: typeof subscriptionHistory[number]) => {
        if (sub.payment_status !== 'Pending') {
            return {
                startDate: sub.starts_at,
                endDate: sub.expires_at,
            };
        }

        const existingPendingStart = sub.starts_at ? new Date(sub.starts_at) : null;
        const baseStartDate = existingPendingStart && existingPendingStart > new Date()
            ? existingPendingStart
            : getPendingBaseStartDate();

        const pendingEndDate = new Date(baseStartDate);
        const durationDays = Number(sub.plan?.duration_days || 0);
        pendingEndDate.setDate(pendingEndDate.getDate() + durationDays);

        return {
            startDate: baseStartDate,
            endDate: pendingEndDate,
        };
    };


    return (
        <div className="container mx-auto py-10 px-4 space-y-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
            {/* Header Section */}
            <div>
                <h1 className="text-4xl font-bold text-slate-900">Broker Dashboard</h1>
                <p className="text-lg text-slate-600 mt-2">Manage your subscription and listings</p>
                <p className="text-sm font-semibold mt-1 text-slate-700">
                    Subscription Status:{' '}
                    <span className={cn(
                        'font-bold',
                        !stats ? 'text-slate-500' 
                        : isSuspended ? 'text-orange-600' 
                        : isSubscriptionActive ? 'text-green-600' 
                        : 'text-red-600'
                    )}>
                        {subscriptionStatusLabel}
                    </span>
                </p>
            </div>

            {/* Alert Sections */}
            {stats && isSuspended && (
                <Alert variant="destructive" className="border-2 border-orange-500 bg-orange-50">
                    <AlertCircle className="h-5 w-5 text-orange-600" />
                    <AlertDescription className="ml-3 text-orange-700 font-semibold">
                        Your subscription has been suspended. You cannot post new rooms. Please contact admin for assistance.
                    </AlertDescription>
                </Alert>
            )}

            {stats && !isSubscriptionActive && !isSuspended && (
                <Alert variant="destructive" className="border-2 border-red-500 bg-red-50">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <AlertDescription className="ml-3 text-red-700 font-semibold">
                        Warning: Without active subscription, broker needs to pay for each post and listings go for pending approval.{isExpired ? ` Your previous subscription expired ${Math.abs(daysRemaining)} days ago.` : ''}
                    </AlertDescription>
                </Alert>
            )}

            {isSubscriptionActive && stats?.daysRemaining !== undefined && stats.daysRemaining <= 7 && stats.daysRemaining > 0 && (
                <Alert className="border-2 border-yellow-500 bg-yellow-50">
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                    <AlertDescription className="ml-3 text-yellow-700 font-semibold">
                        Your subscription expires in <span className="font-bold">{stats.daysRemaining} days</span>. Renew now to avoid service interruption.
                    </AlertDescription>
                </Alert>
            )}

            {/* Main Key Information Cards */}
            {!isPlansPage && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* My Rooms Posted */}
                <Card className="border shadow-md hover:shadow-lg transition-shadow cursor-pointer hover:border-primary" onClick={() => { setActiveTab('rooms'); }}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-semibold">My Rooms</CardTitle>
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Building2 className="h-4 w-4 text-blue-600" />
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div>
                            <p className="text-2xl font-bold text-slate-900">{stats?.totalRoomsPosted || 0}</p>
                            <p className="text-xs text-slate-600 mt-0.5">
                                {stats?.activeRooms || 0} active
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Pending Rooms */}
                <Card className="border shadow-md hover:shadow-lg transition-shadow cursor-pointer hover:border-primary" onClick={() => { setActiveTab('rooms'); }}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-semibold">Pending</CardTitle>
                        <div className="p-2 bg-yellow-100 rounded-lg">
                            <Clock className="h-4 w-4 text-yellow-600" />
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div>
                            <p className="text-2xl font-bold text-slate-900">{stats?.pendingRooms || 0}</p>
                            <p className="text-xs text-slate-600 mt-0.5">
                                pending approval
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Messages */}
                <Card className="border shadow-md hover:shadow-lg transition-shadow cursor-pointer hover:border-primary" onClick={() => { setActiveTab('messages'); }}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-semibold">Messages</CardTitle>
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <MessageSquare className="h-4 w-4 text-blue-600" />
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div>
                            <p className="text-2xl font-bold text-slate-900">0</p>
                            <p className="text-xs text-slate-600 mt-0.5">
                                unread
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Current Plan with Expiry */}
                <Card className="border shadow-md hover:shadow-lg transition-shadow cursor-pointer hover:border-primary" onClick={() => { setActiveTab('plans'); }}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-semibold">Plan</CardTitle>
                        <div className={cn(
                            "p-2 rounded-lg",
                            isExpired ? "bg-red-100" : "bg-green-100"
                        )}>
                            <CreditCard className={cn(
                                "h-4 w-4",
                                isExpired ? "text-red-600" : "text-green-600"
                            )} />
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div>
                            <p className="text-sm font-bold text-slate-900 truncate">
                                {currentSub?.plan?.plan_name || 'None'}
                            </p>
                            <p className={cn(
                                "text-xs mt-0.5 font-medium",
                                isExpired ? "text-red-600" : "text-slate-600"
                            )}>
                                {currentSub ? daysText : 'No active plan'}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
            )}

            {/* Tabs Section */}
            <Tabs defaultValue="rooms" value={activeTab} onValueChange={setActiveTab} className="w-full">
                {!isPlansPage && (
                <TabsList className="grid w-full grid-cols-2 bg-white border-2 rounded-lg p-1">
                    <TabsTrigger value="rooms" className="data-[state=active]:bg-primary data-[state=active]:text-white">
                        My Rooms
                    </TabsTrigger>
                    <TabsTrigger value="messages" className="data-[state=active]:bg-primary data-[state=active]:text-white">
                        Messages
                    </TabsTrigger>
                </TabsList>
                )}

                {/* My Rooms Tab */}
                <TabsContent value="rooms" className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                        {/* Active Rooms */}
                        <Card className="border-2 shadow-lg">
                            <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Building2 className="h-5 w-5" />
                                        Active Rooms
                                    </CardTitle>
                                    <Badge className="bg-blue-600">{stats?.activeRooms || 0}</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="text-center py-8">
                                    <Building2 className="h-10 w-10 text-blue-400 mx-auto mb-3" />
                                    <p className="text-slate-600 font-medium text-sm">
                                        {stats?.activeRooms ? `${stats.activeRooms} active listings` : 'No active rooms'}
                                    </p>
                                    <Button 
                                        className="mt-4 text-sm"
                                        onClick={() => navigate('/dashboard/rooms')}
                                    >
                                        View All
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Pending Rooms */}
                        <Card className="border-2 shadow-lg">
                            <CardHeader className="bg-gradient-to-r from-yellow-50 to-amber-50 border-b-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Clock className="h-5 w-5" />
                                        Pending Rooms
                                    </CardTitle>
                                    <Badge className="bg-yellow-600">{stats?.pendingRooms || 0}</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="text-center py-8">
                                    <Clock className="h-10 w-10 text-yellow-400 mx-auto mb-3" />
                                    <p className="text-slate-600 font-medium text-sm">
                                        {stats?.pendingRooms ? `${stats.pendingRooms} awaiting approval` : 'No pending rooms'}
                                    </p>
                                    <Button 
                                        className="mt-4 text-sm"
                                        variant="outline"
                                        onClick={() => navigate('/dashboard/rooms')}
                                    >
                                        View Pending
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* All Rooms Summary */}
                    <Card className="border-2 shadow-lg">
                        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Building2 className="h-5 w-5" />
                                All Rooms Summary
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 text-center">
                                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                    <p className="text-2xl font-bold text-slate-900">{stats?.totalRoomsPosted || 0}</p>
                                    <p className="text-xs text-slate-600 mt-1 font-medium">Total Posted</p>
                                </div>
                                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                    <p className="text-2xl font-bold text-blue-600">{stats?.activeRooms || 0}</p>
                                    <p className="text-xs text-slate-600 mt-1 font-medium">Active</p>
                                </div>
                                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                                    <p className="text-2xl font-bold text-yellow-600">{stats?.pendingRooms || 0}</p>
                                    <p className="text-xs text-slate-600 mt-1 font-medium">Pending</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Messages Tab */}
                <TabsContent value="messages" className="space-y-6">
                    <Card className="border-2 shadow-lg">
                        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2">
                            <CardTitle className="text-2xl flex items-center gap-2">
                                <MessageSquare className="h-6 w-6" />
                                Messages
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="text-center py-12">
                                <MessageSquare className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                                <p className="text-slate-600 font-medium">No new messages</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Plan Details Tab */}
                <TabsContent value="plans" className="space-y-6">
                    {isPlansPage ? (
                        currentSub ? (
                            <>
                            {/* Current Plan Details */}
                            <Card className="border-2 shadow-lg">
                                <CardHeader className={cn(
                                    "border-b-2",
                                    isSubscriptionActive
                                        ? "bg-gradient-to-r from-blue-50 to-blue-50"
                                        : "bg-gradient-to-r from-red-50 to-rose-50"
                                )}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "p-3 rounded-lg",
                                                isSubscriptionActive ? "bg-green-100" : "bg-red-100"
                                            )}>
                                                <CreditCard className={cn(
                                                    "h-6 w-6",
                                                    isSubscriptionActive ? "text-green-600" : "text-red-600"
                                                )} />
                                            </div>
                                            <div>
                                                <CardTitle className="text-2xl">Your Subscription</CardTitle>
                                                <CardDescription>Current plan details and information</CardDescription>
                                            </div>
                                        </div>
                                        <Badge className={cn(
                                            "text-base px-3 py-1",
                                            isSubscriptionActive ? "bg-green-600" : "bg-red-600"
                                        )}>
                                            {isSubscriptionActive ? 'Active' : 'Inactive'}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-6 space-y-6">
                                    {/* Plan Overview */}
                                    <div className="bg-gradient-to-br from-blue-50 to-blue-50 p-6 rounded-lg border-2 border-blue-200">
                                        <h3 className="text-lg font-bold text-slate-900 mb-4">Plan Overview</h3>
                                        <div className="grid gap-4 md:grid-cols-3">
                                            <div>
                                                <p className="text-sm text-slate-600 font-medium">Plan Name</p>
                                                <p className="text-xl font-bold text-slate-900 mt-1">
                                                    {currentSub.plan?.plan_name}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-slate-600 font-medium">Price Paid</p>
                                                <p className="text-xl font-bold text-blue-600 mt-1">
                                                    ₹{currentSub.amount_paid}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-slate-600 font-medium">Duration</p>
                                                <p className="text-xl font-bold text-slate-900 mt-1">
                                                    {currentSub.plan?.duration_days} Days
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Subscription Timeline */}
                                    <div className="bg-gradient-to-br from-blue-50 to-pink-50 p-6 rounded-lg border-2 border-blue-200">
                                        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                                            <Calendar className="h-5 w-5 text-blue-600" />
                                            Subscription Timeline
                                        </h3>
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center p-3 bg-white rounded border border-blue-200">
                                                <div>
                                                    <p className="text-sm text-slate-600 font-medium">Subscription Start Date</p>
                                                    <p className="text-lg font-bold text-slate-900 mt-1">
                                                        {formatCompactDate(currentSub.starts_at)}
                                                    </p>
                                                </div>
                                                <Clock className="h-5 w-5 text-blue-600" />
                                            </div>
                                            <div className="flex justify-between items-center p-3 bg-white rounded border border-red-200">
                                                <div>
                                                    <p className="text-sm text-slate-600 font-medium">Subscription Expiry Date</p>
                                                    <p className="text-lg font-bold text-red-600 mt-1">
                                                        {formatCompactDate(currentSub.expires_at)}
                                                    </p>
                                                </div>
                                                <Calendar className="h-5 w-5 text-red-600" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Features */}
                                    {currentSub.plan?.features && currentSub.plan.features.length > 0 && (
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                                                <Zap className="h-5 w-5 text-amber-500" />
                                                Plan Features
                                            </h3>
                                            <div className="grid gap-3 md:grid-cols-2">
                                                {currentSub.plan.features.map((feature, index) => (
                                                    <div key={index} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                                        <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                                                        <span className="text-sm font-medium text-slate-900">{feature}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Upgrade/Renew Section */}
                            <Card className="border-2 shadow-lg">
                                <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-blue-100 rounded-lg">
                                            <RefreshCw className="h-6 w-6 text-blue-600" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-2xl">Upgrade or Renew Subscription</CardTitle>
                                            <CardDescription>Choose a plan to upgrade or renew</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-6">
                                    {plans.length === 0 ? (
                                        <div className="text-center py-8">
                                            <AlertCircle className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                                            <p className="text-slate-600 font-medium">No plans available</p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                                            {plans.map((plan, index) => (
                                                (() => {
                                                    const timeline = getPlanTimeline(plan.duration_days);
                                                    return (
                                                <Card 
                                                    key={`active-plan-${plan.id}-${index}`} 
                                                    className={cn(
                                                        'border-2 hover:border-primary transition-all hover:shadow-lg',
                                                        currentSub && plan.id === currentSub.plan_id && 'border-green-500 bg-blue-50'
                                                    )}
                                                >
                                                    <CardHeader className="pb-3">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div>
                                                                <CardTitle className="text-lg">{plan.plan_name}</CardTitle>
                                                                {plan.description && (
                                                                    <CardDescription className="mt-1 text-xs">{plan.description}</CardDescription>
                                                                )}
                                                            </div>
                                                            {currentSub && plan.id === currentSub.plan_id && (
                                                                <Badge className="bg-green-600 text-xs">Current</Badge>
                                                            )}
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent className="space-y-4">
                                                        <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-4 rounded-lg">
                                                            <div className="text-3xl font-bold text-primary">₹{plan.price}</div>
                                                            <p className="text-sm text-slate-600 mt-1">
                                                                for <span className="font-bold">{plan.duration_days} days</span>
                                                            </p>
                                                            <p className="text-xs text-slate-600 mt-1">
                                                                Timeline: {formatCompactDate(timeline.startDate)} - {formatCompactDate(timeline.endDate)}
                                                            </p>
                                                        </div>

                                                        {plan.features && plan.features.length > 0 && (
                                                            <div className="space-y-2">
                                                                <p className="text-xs font-semibold text-slate-900">Features:</p>
                                                                <ul className="space-y-1">
                                                                    {plan.features.slice(0, 3).map((feature, index) => (
                                                                        <li key={index} className="flex items-start gap-2">
                                                                            <CheckCircle className="h-3 w-3 text-blue-600 mt-1 flex-shrink-0" />
                                                                            <span className="text-xs text-slate-700">{feature}</span>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}

                                                        <Button
                                                            className="w-full"
                                                            variant={currentSub && plan.id === currentSub.plan_id ? "outline" : "default"}
                                                            onClick={() => openPurchaseConfirmation(plan.id)}
                                                            disabled={renewingPlanId === plan.id}
                                                        >
                                                            {renewingPlanId === plan.id ? (
                                                                <>
                                                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                                                    Processing...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <CreditCard className="mr-2 h-4 w-4" />
                                                                    {currentSub && plan.id === currentSub.plan_id ? 'Current Plan' : 'Choose Plan'}
                                                                </>
                                                            )}
                                                        </Button>
                                                    </CardContent>
                                                </Card>
                                                    );
                                                })()
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Subscription History */}
                            {subscriptionHistory.length > 0 && (
                                <Card className="border-2 shadow-lg">
                                    <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2">
                                        <div className="flex items-center gap-3">
                                            <div className="p-3 bg-blue-100 rounded-lg">
                                                <History className="h-6 w-6 text-blue-600" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-2xl">Subscription History</CardTitle>
                                                <CardDescription>Your past subscriptions</CardDescription>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-6">
                                        <div className="space-y-3">
                                            {subscriptionHistory.map((sub, index) => {
                                                const timeline = getHistoryTimeline(sub);
                                                return (
                                                <div 
                                                    key={`subscription-history-${sub.id}-${sub.created_at || index}`} 
                                                    className="p-4 border-2 rounded-lg hover:border-primary transition-all"
                                                >
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div className="flex items-start gap-3">
                                                            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                                                                <CreditCard className="h-5 w-5 text-slate-600" />
                                                            </div>
                                                            <div>
                                                                <p className="font-semibold text-slate-900">{sub.plan?.plan_name}</p>
                                                                <p className="text-sm text-slate-600">
                                                                    {formatCompactDate(timeline.startDate)} - {formatCompactDate(timeline.endDate)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <Badge className={cn('text-base', getStatusColor(sub.payment_status))}>
                                                                {getStatusIcon(sub.payment_status)}
                                                                <span className="ml-1">{sub.payment_status}</span>
                                                            </Badge>
                                                            <p className="text-sm font-semibold text-slate-900 mt-1">₹{sub.amount_paid}</p>
                                                        </div>
                                                    </div>
                                                    {sub.admin_remark && (
                                                        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                                            <div className="flex items-start gap-2">
                                                                <MessageSquare className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                                                <div>
                                                                    <p className="text-xs font-semibold text-blue-900 mb-1">Admin Remark:</p>
                                                                    <p className="text-sm text-blue-800">{sub.admin_remark}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                );
                                            })}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                            </>
                        ) : (
                            <div className="space-y-6">
                                <Card className="border-2 shadow-lg">
                                    <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2">
                                        <CardTitle className="text-2xl">Get Started</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-6">
                                        <div className="text-center py-8">
                                            <AlertCircle className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                                            <p className="text-slate-600 font-medium">You don't have an active subscription</p>
                                            <p className="text-sm text-slate-500 mt-2">Choose a plan below to get started</p>
                                        </div>
                                    </CardContent>
                                </Card>

                                {plans.length === 0 ? (
                                    <div className="text-center py-8">
                                        <AlertCircle className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                                        <p className="text-slate-600 font-medium">No plans available</p>
                                    </div>
                                ) : (
                                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                                        {plans.map((plan, index) => (
                                            (() => {
                                                const timeline = getPlanTimeline(plan.duration_days);
                                                return (
                                            <Card
                                                key={`new-plan-${plan.id}-${index}`}
                                                className="border-2 hover:border-primary transition-all hover:shadow-lg"
                                            >
                                                <CardHeader className="pb-3">
                                                    <div>
                                                        <CardTitle className="text-lg">{plan.plan_name}</CardTitle>
                                                        {plan.description && (
                                                            <CardDescription className="mt-1 text-xs">{plan.description}</CardDescription>
                                                        )}
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="space-y-4">
                                                    <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-4 rounded-lg">
                                                        <div className="text-3xl font-bold text-primary">₹{plan.price}</div>
                                                        <p className="text-sm text-slate-600 mt-1">
                                                            for <span className="font-bold">{plan.duration_days} days</span>
                                                        </p>
                                                        <p className="text-xs text-slate-600 mt-1">
                                                            Timeline: {formatCompactDate(timeline.startDate)} - {formatCompactDate(timeline.endDate)}
                                                        </p>
                                                    </div>

                                                    {plan.features && plan.features.length > 0 && (
                                                        <div className="space-y-2">
                                                            <p className="text-xs font-semibold text-slate-900">Features:</p>
                                                            <ul className="space-y-1">
                                                                {plan.features.slice(0, 3).map((feature, index) => (
                                                                    <li key={index} className="flex items-start gap-2">
                                                                        <CheckCircle className="h-3 w-3 text-blue-600 mt-1 flex-shrink-0" />
                                                                        <span className="text-xs text-slate-700">{feature}</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}

                                                    <Button
                                                        className="w-full"
                                                        onClick={() => openPurchaseConfirmation(plan.id)}
                                                        disabled={renewingPlanId === plan.id}
                                                    >
                                                        {renewingPlanId === plan.id ? (
                                                            <>
                                                                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                                                Processing...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <CreditCard className="mr-2 h-4 w-4" />
                                                                Subscribe Now
                                                            </>
                                                        )}
                                                    </Button>
                                                </CardContent>
                                            </Card>
                                                );
                                            })()
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    ) : currentSub ? (
                        <Card className="border-2 shadow-lg">
                            <CardHeader className={cn(
                                "border-b-2",
                                isSubscriptionActive
                                    ? "bg-gradient-to-r from-blue-50 to-blue-50"
                                    : "bg-gradient-to-r from-red-50 to-rose-50"
                            )}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "p-3 rounded-lg",
                                            isSubscriptionActive ? "bg-green-100" : "bg-red-100"
                                        )}>
                                            <CreditCard className={cn(
                                                "h-6 w-6",
                                                isSubscriptionActive ? "text-green-600" : "text-red-600"
                                            )} />
                                        </div>
                                        <div>
                                            <CardTitle className="text-2xl">Your Subscription</CardTitle>
                                            <CardDescription>
                                                {isSubscriptionActive
                                                    ? 'Details of your current subscribed plan'
                                                    : `Subscription inactive${isExpired ? ` • Expired ${Math.abs(daysRemaining)} days ago` : ''}`}
                                            </CardDescription>
                                        </div>
                                    </div>
                                    <Badge className={cn(
                                        "text-base px-3 py-1",
                                        isSubscriptionActive ? "bg-green-600" : "bg-red-600"
                                    )}>
                                        {isSubscriptionActive ? 'Active' : 'Inactive'}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <div>
                                        <p className="text-sm text-slate-600 font-medium">Plan Name</p>
                                        <p className="text-lg font-bold text-slate-900 mt-1">{currentSub.plan?.plan_name}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-600 font-medium">Amount Paid</p>
                                        <p className="text-lg font-bold text-blue-600 mt-1">₹{currentSub.amount_paid}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-600 font-medium">Start Date</p>
                                        <p className="text-lg font-bold text-slate-900 mt-1">{formatCompactDate(currentSub.starts_at)}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-600 font-medium">Expiry Date</p>
                                        <p className="text-lg font-bold text-red-600 mt-1">{formatCompactDate(currentSub.expires_at)}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="border-2 shadow-lg">
                            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2">
                                <CardTitle className="text-2xl">No Active Subscription</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6 text-center">
                                <AlertCircle className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                                <p className="text-slate-600 font-medium mb-4">You have not subscribed to any plan yet.</p>
                                <Button onClick={() => navigate('/dashboard/plans')}>
                                    <CreditCard className="mr-2 h-4 w-4" />
                                    Browse Plans
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>

            <Dialog open={confirmStep === 1} onOpenChange={(open) => { if (!open) closeConfirmationDialogs(); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Plan Purchase</DialogTitle>
                        <DialogDescription>
                            Do you want to buy <span className="font-semibold">{selectedPlanForPurchase?.plan_name}</span> for ₹{selectedPlanForPurchase?.price}?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={closeConfirmationDialogs}>Cancel</Button>
                        <Button
                            onClick={() => selectedPlanForPurchase && handleRenewSubscription(selectedPlanForPurchase.id)}
                            disabled={!selectedPlanForPurchase || renewingPlanId !== null}
                        >
                            {renewingPlanId ? 'Submitting...' : 'Confirm'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Request Submitted Successfully</DialogTitle>
                        <DialogDescription>
                            Your subscription request is submitted and is waiting for admin approval.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button onClick={() => setSuccessDialogOpen(false)}>OK</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default BrokerDashboardPage;
