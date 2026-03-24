import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, CheckCircle2, XCircle, Clock, Users, RefreshCw, History } from 'lucide-react';
import type { Broker } from '@/types';
import {
    getAllBrokers,
    updateBrokerStatus,
    getBrokerStats,
    getBrokerPlans,
    getSubscriptionUpgradeRequests,
    decideSubscriptionUpgradeRequest,
    getBrokerSubscriptions,
    getBrokerSubscriptionsByUserId,
    updateBrokerSubscription,
    type SubscriptionUpgradeRequest,
    type BrokerSubscription,
    type UpdateSubscriptionPayload
} from '@/services/adminService';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface BrokerStats {
    all: number;
    approved: number;
    pending: number;
    hold: number;
    rejected: number;
}

interface BrokerPlan {
    id: number;
    plan_name: string;
    price: number;
    duration_days: number;
}

interface UpgradeDecisionDialogData {
    request: SubscriptionUpgradeRequest;
    status: 'Completed' | 'Failed';
    planId: string;
    startsAt: string;
    expiresAt: string;
    remark: string;
}

interface EditHistoryDialogState {
    open: boolean;
    subscription: BrokerSubscription | null;
}

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

const toDateInputValue = (value?: string | Date | null) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
};

const calculateExpiryFromStartAndDuration = (startDate: string, durationDays: number) => {
    if (!startDate || !Number.isFinite(durationDays) || durationDays <= 0) {
        return '';
    }

    const start = new Date(`${startDate}T00:00:00`);
    if (Number.isNaN(start.getTime())) {
        return '';
    }

    start.setDate(start.getDate() + durationDays);
    return toDateInputValue(start);
};

export default function AdminBrokersPage() {
    const [activeTab, setActiveTab] = useState<'requests' | 'registration' | 'upgradation' | 'subscriptions'>('requests');
    const [brokers, setBrokers] = useState<Broker[]>([]);
    const [stats, setStats] = useState<BrokerStats | null>(null);
    const [plans, setPlans] = useState<BrokerPlan[]>([]);
    const [upgradeRequests, setUpgradeRequests] = useState<SubscriptionUpgradeRequest[]>([]);
    const [subscriptions, setSubscriptions] = useState<BrokerSubscription[]>([]);
    const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);
    const [upgradesLoading, setUpgradesLoading] = useState(false);
    const [processingUpgradeId, setProcessingUpgradeId] = useState<number | null>(null);
    const [upgradeDecisionDialog, setUpgradeDecisionDialog] = useState<UpgradeDecisionDialogData | null>(null);
    const [editSubscriptionDialog, setEditSubscriptionDialog] = useState<{
        open: boolean;
        subscription: BrokerSubscription | null;
    }>({
        open: false,
        subscription: null
    });
    const [subscriptionHistory, setSubscriptionHistory] = useState<BrokerSubscription[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [editHistoryDialog, setEditHistoryDialog] = useState<EditHistoryDialogState>({
        open: false,
        subscription: null
    });
    const [savingHistoryId, setSavingHistoryId] = useState<number | null>(null);
    const [filters, setFilters] = useState({ status: 'all', search: '' });
    const [loading, setLoading] = useState(false);
    const [actionDialog, setActionDialog] = useState<{ open: boolean; action: string; broker: Broker | null }>({
        open: false,
        action: '',
        broker: null
    });
    const [actionData, setActionData] = useState({
        remark: '',
        planId: '',
        subscriptionDays: ''
    });
    const [brokerActionSelections, setBrokerActionSelections] = useState<Record<number, string>>({});

    const dedupeBrokers = (items: Broker[]): Broker[] => {
        const brokerMap = new Map<number, Broker>();

        items.forEach((broker) => {
            const existingBroker = brokerMap.get(broker.id);
            if (!existingBroker) {
                brokerMap.set(broker.id, broker);
                return;
            }

            const existingUpgrade = Number(existingBroker.upgrade_request_id || 0);
            const nextUpgrade = Number(broker.upgrade_request_id || 0);
            if (nextUpgrade >= existingUpgrade) {
                brokerMap.set(broker.id, broker);
            }
        });

        return Array.from(brokerMap.values());
    };

    useEffect(() => {
        fetchBrokers();
        fetchStats();
        fetchPlans();
        fetchUpgradeRequests();
        if (activeTab === 'subscriptions') {
            fetchSubscriptions();
        }
    }, [filters, activeTab]);

    const fetchStats = async () => {
        try {
            const data = await getBrokerStats();
            setStats(data);
        } catch (error) {
        }
    };

    const fetchBrokers = async () => {
        try {
            setLoading(true);
            const apiFilters = {
                status: filters.status === 'all' ? '' : filters.status,
                search: filters.search
            };
            const data = await getAllBrokers(apiFilters);
            setBrokers(dedupeBrokers(data));
        } catch (error) {
            toast.error('Failed to load brokers');
        } finally {
            setLoading(false);
        }
    };

    const fetchPlans = async () => {
        try {
            const data = await getBrokerPlans();
            setPlans(data);
        } catch (error) {
        }
    };

    const fetchUpgradeRequests = async () => {
        try {
            setUpgradesLoading(true);
            const requests = await getSubscriptionUpgradeRequests();
            setUpgradeRequests(requests);
        } catch (error) {
            toast.error('Failed to load upgradation requests');
        } finally {
            setUpgradesLoading(false);
        }
    };

    const fetchSubscriptions = async () => {
        try {
            setSubscriptionsLoading(true);
            const apiFilters = {
                status: filters.status === 'all' ? '' : filters.status,
                search: filters.search
            };
            const response = await getBrokerSubscriptions(apiFilters);
            
            // Keep only one subscription per user (latest one based on created_at)
            const latestPerUser = new Map<number, BrokerSubscription>();
            response.data.forEach(sub => {
                const existing = latestPerUser.get(sub.user_id);
                if (!existing || new Date(sub.created_at) > new Date(existing.created_at)) {
                    latestPerUser.set(sub.user_id, sub);
                }
            });
            
            setSubscriptions(Array.from(latestPerUser.values()));
        } catch (error) {
            toast.error('Failed to load subscriptions');
        } finally {
            setSubscriptionsLoading(false);
        }
    };

    const fetchSubscriptionHistory = async (userId: number) => {
        try {
            setHistoryLoading(true);
            const history = await getBrokerSubscriptionsByUserId(userId);
            setSubscriptionHistory(history);
        } catch (error) {
            toast.error('Failed to load subscription history');
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleOpenEditSubscription = (subscription: BrokerSubscription) => {
        setEditSubscriptionDialog({
            open: true,
            subscription
        });
        fetchSubscriptionHistory(subscription.user_id);
    };

    const handleCloseEditSubscription = () => {
        setEditSubscriptionDialog({
            open: false,
            subscription: null
        });
        setSubscriptionHistory([]);
        setEditHistoryDialog({ open: false, subscription: null });
    };

    const handleOpenEditHistory = (subscription: BrokerSubscription) => {
        setEditHistoryDialog({
            open: true,
            subscription: {
                ...subscription,
                starts_at: toDateInputValue(subscription.starts_at),
                expires_at: toDateInputValue(subscription.expires_at)
            }
        });
    };

    const handleCloseEditHistory = () => {
        setEditHistoryDialog({ open: false, subscription: null });
    };

    const handleSaveHistoryEdit = async () => {
        if (!editHistoryDialog.subscription) return;

        try {
            setSavingHistoryId(editHistoryDialog.subscription.id);
            const payload: UpdateSubscriptionPayload = {
                starts_at: editHistoryDialog.subscription.starts_at,
                expires_at: editHistoryDialog.subscription.expires_at,
                payment_status: editHistoryDialog.subscription.payment_status,
                admin_remark: editHistoryDialog.subscription.admin_remark || ''
            };

            await updateBrokerSubscription(editHistoryDialog.subscription.id, payload);
            toast.success('Subscription history updated successfully');

            if (editSubscriptionDialog.subscription) {
                await fetchSubscriptionHistory(editSubscriptionDialog.subscription.user_id);
                if (editSubscriptionDialog.subscription.id === editHistoryDialog.subscription.id) {
                    setEditSubscriptionDialog((prev) => ({
                        ...prev,
                        subscription: prev.subscription
                            ? {
                                ...prev.subscription,
                                starts_at: editHistoryDialog.subscription!.starts_at,
                                expires_at: editHistoryDialog.subscription!.expires_at,
                                payment_status: editHistoryDialog.subscription!.payment_status,
                                admin_remark: editHistoryDialog.subscription!.admin_remark || ''
                            }
                            : null
                    }));
                }
            }

            await fetchSubscriptions();
            handleCloseEditHistory();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to update subscription history');
        } finally {
            setSavingHistoryId(null);
        }
    };

    const handleUpdateSubscription = async () => {
        if (!editSubscriptionDialog.subscription) return;

        try {
            // Build update payload from current subscription state
            const updatePayload: UpdateSubscriptionPayload = {
                plan_id: editSubscriptionDialog.subscription.plan_id,
                starts_at: editSubscriptionDialog.subscription.starts_at,
                expires_at: editSubscriptionDialog.subscription.expires_at,
                payment_status: editSubscriptionDialog.subscription.payment_status,
                admin_remark: editSubscriptionDialog.subscription.admin_remark || ''
            };
            
            await updateBrokerSubscription(editSubscriptionDialog.subscription.id, updatePayload);
            toast.success('Subscription updated successfully');
            handleCloseEditSubscription();
            fetchSubscriptions();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to update subscription');
        }
    };

    const openUpgradeDecisionDialog = (request: SubscriptionUpgradeRequest, status: 'Completed' | 'Failed') => {
        const effectiveStart = request.effective_starts_at || request.starts_at;
        const effectiveEnd = request.effective_expires_at || request.expires_at;
        const initialStart = toDateInputValue(effectiveStart);
        const initialDuration = Number(request.requested_duration_days || 0);
        const adjustedInitialEnd = calculateExpiryFromStartAndDuration(initialStart, initialDuration);

        setUpgradeDecisionDialog({
            request,
            status,
            planId: String(request.requested_plan_id),
            startsAt: initialStart,
            expiresAt: adjustedInitialEnd || toDateInputValue(effectiveEnd),
            remark: request.admin_remark || ''
        });
    };

    const closeUpgradeDecisionDialog = () => {
        setUpgradeDecisionDialog(null);
    };

    const handleUpgradeDecision = async () => {
        if (!upgradeDecisionDialog) return;

        const { request, status, planId, startsAt, expiresAt, remark: upgradeRemark } = upgradeDecisionDialog;

        try {
            setProcessingUpgradeId(request.id);
            await decideSubscriptionUpgradeRequest(request.id, status, {
                plan_id: status === 'Completed' ? Number(planId) : undefined,
                starts_at: status === 'Completed' && startsAt ? startsAt : undefined,
                expires_at: status === 'Completed' && expiresAt ? expiresAt : undefined,
                remark: upgradeRemark || undefined
            });
            toast.success(status === 'Completed' ? 'Upgrade request approved' : 'Upgrade request rejected');
            await Promise.all([fetchUpgradeRequests(), fetchBrokers(), fetchStats()]);
            closeUpgradeDecisionDialog();
        } catch (error) {
            toast.error('Failed to process upgradation request');
        } finally {
            setProcessingUpgradeId(null);
        }
    };

    const getPlanDurationDays = (planId: string) => {
        if (!planId) return '';
        const selectedPlan = plans.find((plan) => plan.id === parseInt(planId));
        return selectedPlan ? String(selectedPlan.duration_days) : '';
    };

    const handleOpenActionDialog = (action: string, broker: Broker) => {
        const brokerSelectedPlanId =
            broker.selected_plan?.id ||
            broker.selected_plan_id ||
            null;

        const defaultPlanId = action === 'Approved' && brokerSelectedPlanId
            ? String(brokerSelectedPlanId)
            : '';

        const defaultDays = action === 'Approved' && brokerSelectedPlanId
            ? String(
                plans.find((plan) => plan.id === Number(brokerSelectedPlanId))?.duration_days ||
                broker.selected_plan?.duration_days ||
                ''
            )
            : '';

        setActionDialog({ open: true, action, broker });
        setActionData({ remark: '', planId: defaultPlanId, subscriptionDays: defaultDays });
    };

    const handleCloseActionDialog = () => {
        setActionDialog({ open: false, action: '', broker: null });
        setActionData({ remark: '', planId: '', subscriptionDays: '' });
    };

    const handleSubmitAction = async () => {
        if (!actionDialog.broker) return;

        try {
            const { action, broker } = actionDialog;
            
            if (action === 'Approved') {
                if (!actionData.planId) {
                    toast.error('Please select a plan');
                    return;
                }

                const resolvedDays = actionData.subscriptionDays || getPlanDurationDays(actionData.planId);
                if (!resolvedDays) {
                    toast.error('Unable to fetch subscription days from selected plan');
                    return;
                }

                await updateBrokerStatus(
                    broker.id, 
                    'Approved', 
                    actionData.remark,
                    parseInt(actionData.planId),
                    parseInt(resolvedDays)
                );
            } else {
                await updateBrokerStatus(broker.id, action, actionData.remark);
            }

            toast.success(`Broker ${action.toLowerCase()} successfully`);
            handleCloseActionDialog();
            setBrokerActionSelections((prev) => ({
                ...prev,
                [broker.id]: ''
            }));
            await fetchBrokers();
            await fetchStats();
        } catch (error) {
            toast.error('Failed to update broker status');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Approved': return 'default';
            case 'Pending': return 'secondary';
            case 'Hold': return 'outline';
            case 'Rejected': return 'destructive';
            case 'Suspended': return 'outline';
            default: return 'outline';
        }
    };

    return (
        <div className="space-y-6 p-3 sm:p-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Manage Broker Registration Requests</h1>
                    <p className="text-muted-foreground mt-1">Review broker applications and subscription upgradation requests</p>
                </div>
                <Button onClick={() => { void Promise.all([fetchBrokers(), fetchStats(), fetchUpgradeRequests()]); }} variant="outline" size="sm" className="w-full sm:w-auto">
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Status Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card 
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => setFilters({ ...filters, status: 'all' })}
                >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">All</CardTitle>
                        <Users className="h-5 w-5 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-600">{stats?.all || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">Total brokers</p>
                    </CardContent>
                </Card>

                <Card 
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => setFilters({ ...filters, status: 'Approved' })}
                >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Approved</CardTitle>
                        <CheckCircle2 className="h-5 w-5 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-600">{stats?.approved || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">Active brokers</p>
                    </CardContent>
                </Card>

                <Card 
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => setFilters({ ...filters, status: 'Pending' })}
                >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending</CardTitle>
                        <Clock className="h-5 w-5 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-orange-600">{stats?.pending || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">Awaiting review</p>
                    </CardContent>
                </Card>

                <Card 
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => setFilters({ ...filters, status: 'Rejected' })}
                >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Rejected</CardTitle>
                        <XCircle className="h-5 w-5 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-red-600">{stats?.rejected || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">Rejected applications</p>
                    </CardContent>
                </Card>
            </div>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'requests' | 'registration' | 'upgradation' | 'subscriptions')}>
                <div className="overflow-x-auto pb-1">
                <TabsList className="inline-flex min-w-full sm:grid sm:w-full sm:grid-cols-4">
                    <TabsTrigger value="requests" className="min-w-[180px]">
                        <Clock className="h-4 w-4 mr-2" />
                        Broker Requests ({stats?.pending || 0})
                    </TabsTrigger>
                    <TabsTrigger value="registration" className="min-w-[150px]">Registration</TabsTrigger>
                    <TabsTrigger value="upgradation" className="min-w-[150px]">Upgradation</TabsTrigger>
                    <TabsTrigger value="subscriptions" className="min-w-[150px]">Subscriptions</TabsTrigger>
                </TabsList>
                </div>

                <TabsContent value="requests" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Clock className="h-5 w-5" />
                                Pending Broker Registration Requests
                            </CardTitle>
                            <CardDescription>Review and approve new broker applications with pending status</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="p-8 text-center text-muted-foreground">
                                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                                    Loading pending requests...
                                </div>
                            ) : brokers.filter(b => b.broker_status === 'Pending').length === 0 ? (
                                <div className="p-8 text-center">
                                    <CheckCircle2 className="h-12 w-12 text-blue-500 mx-auto mb-2" />
                                    <p className="text-muted-foreground">No pending broker requests</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {brokers
                                        .filter((broker) => broker.broker_status === 'Pending')
                                        .map((broker) => (
                                            <div
                                                key={`pending-broker-${broker.id}`}
                                                className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                                            >
                                                <div className="space-y-1 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-semibold">{broker.name}</p>
                                                        <Badge variant="secondary" className="text-xs">
                                                            {broker.unique_id}
                                                        </Badge>
                                                        <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                                                            Pending
                                                        </Badge>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">{broker.email}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        <span className="font-medium">Contact:</span> {broker.contact || 'N/A'}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        <span className="font-medium">Area:</span> {broker.broker_area || 'N/A'}
                                                    </p>
                                                    {broker.selected_plan && (
                                                        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                                                            <p className="text-xs font-semibold text-blue-900">Requested Plan:</p>
                                                            <p className="text-xs text-blue-800">
                                                                {broker.selected_plan.plan_name} - ₹{broker.selected_plan.price} (
                                                                {broker.selected_plan.duration_days} days)
                                                            </p>
                                                        </div>
                                                    )}
                                                    {!broker.selected_plan && broker.selected_plan_id && (
                                                        <p className="text-xs text-muted-foreground">
                                                            <span className="font-medium">Plan ID:</span> {broker.selected_plan_id}
                                                        </p>
                                                    )}
                                                    <p className="text-xs text-muted-foreground">
                                                        Registered: {new Date(broker.registration_date).toLocaleDateString()}
                                                    </p>
                                                </div>
                                                <div className="flex flex-col gap-2 ml-4">
                                                    <Button
                                                        size="sm"
                                                        onClick={() => {
                                                            setBrokerActionSelections((prev) => ({
                                                                ...prev,
                                                                [broker.id]: 'Approved'
                                                            }));
                                                            handleOpenActionDialog('Approved', broker);
                                                        }}
                                                        className="bg-green-600 hover:bg-green-700"
                                                    >
                                                        <CheckCircle2 className="h-4 w-4 mr-1" />
                                                        Approve
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => {
                                                            setBrokerActionSelections((prev) => ({
                                                                ...prev,
                                                                [broker.id]: 'Hold'
                                                            }));
                                                            handleOpenActionDialog('Hold', broker);
                                                        }}
                                                    >
                                                        <Clock className="h-4 w-4 mr-1" />
                                                        Hold
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        onClick={() => {
                                                            setBrokerActionSelections((prev) => ({
                                                                ...prev,
                                                                [broker.id]: 'Rejected'
                                                            }));
                                                            handleOpenActionDialog('Rejected', broker);
                                                        }}
                                                    >
                                                        <XCircle className="h-4 w-4 mr-1" />
                                                        Reject
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => {
                                                            setBrokerActionSelections((prev) => ({
                                                                ...prev,
                                                                [broker.id]: 'Suspended'
                                                            }));
                                                            handleOpenActionDialog('Suspended', broker);
                                                        }}
                                                        className="border-orange-600 text-orange-600 hover:bg-orange-50"
                                                    >
                                                        <XCircle className="h-4 w-4 mr-1" />
                                                        Suspend
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="registration" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Broker Filters</CardTitle>
                            <CardDescription>Filter brokers by status or search</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Status</label>
                                    <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Status</SelectItem>
                                            <SelectItem value="Approved">Approved</SelectItem>
                                            <SelectItem value="Pending">Pending</SelectItem>
                                            <SelectItem value="Hold">Hold</SelectItem>
                                            <SelectItem value="Rejected">Rejected</SelectItem>
                                            <SelectItem value="Suspended">Suspended</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Search</label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search by name, email, or area..."
                                            className="pl-10"
                                            value={filters.search}
                                            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {loading ? (
                            <Card className="col-span-full">
                                <CardContent className="p-8 text-center text-muted-foreground">
                                    Loading brokers...
                                </CardContent>
                            </Card>
                        ) : brokers.length === 0 ? (
                            <Card className="col-span-full">
                                <CardContent className="p-8 text-center text-muted-foreground">
                                    No brokers found
                                </CardContent>
                            </Card>
                        ) : (
                            brokers.map((broker) => (
                                <Card
                                    key={`broker-card-${broker.id}`}
                                    className="hover:shadow-lg transition-shadow"
                                >
                                    <CardHeader>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <CardTitle className="text-lg">{broker.name}</CardTitle>
                                                <CardDescription className="mt-1">{broker.email}</CardDescription>
                                            </div>
                                            <Badge variant={getStatusColor(broker.broker_status)}>
                                                {broker.broker_status}
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">ID:</span>
                                                <span className="font-medium">{broker.unique_id}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Contact:</span>
                                                <span className="font-medium">{broker.contact || 'N/A'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Area:</span>
                                                <span className="font-medium">{broker.broker_area || 'N/A'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Registered:</span>
                                                <span className="font-medium">
                                                    {new Date(broker.registration_date).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Plan:</span>
                                                <span className="font-medium">{broker.selected_plan?.plan_name || 'N/A'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Plan Status:</span>
                                                <span className="font-medium">{broker.subscription_status || 'No Subscription'}</span>
                                            </div>
                                            {broker.admin_remark && (
                                                <div className="pt-2 border-t">
                                                    <span className="text-muted-foreground text-xs">Admin Remark:</span>
                                                    <p className="text-xs mt-1">{broker.admin_remark}</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-[1fr_auto] gap-2 pt-2">
                                            <Select
                                                value={brokerActionSelections[broker.id] || ''}
                                                onValueChange={(value) =>
                                                    setBrokerActionSelections((prev) => ({
                                                        ...prev,
                                                        [broker.id]: value
                                                    }))
                                                }
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select status" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Approved" disabled={broker.broker_status === 'Approved'}>
                                                        Approve
                                                    </SelectItem>
                                                    <SelectItem value="Active" disabled={broker.broker_status === 'Approved'}>
                                                        Active (No Subscription Reset)
                                                    </SelectItem>
                                                    <SelectItem value="Hold" disabled={broker.broker_status === 'Hold'}>
                                                        Hold
                                                    </SelectItem>
                                                    <SelectItem value="Rejected" disabled={broker.broker_status === 'Rejected'}>
                                                        Reject
                                                    </SelectItem>
                                                    <SelectItem value="Suspended" disabled={broker.broker_status === 'Suspended'}>
                                                        Suspend
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Button
                                                size="sm"
                                                onClick={() => {
                                                    const action = brokerActionSelections[broker.id];
                                                    if (!action) {
                                                        toast.error('Please select a status');
                                                        return;
                                                    }
                                                    handleOpenActionDialog(action, broker);
                                                }}
                                            >
                                                Update
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="upgradation" className="space-y-4">
                    {upgradesLoading ? (
                        <Card>
                            <CardContent className="p-8 text-center text-muted-foreground">
                                Loading upgradation requests...
                            </CardContent>
                        </Card>
                    ) : upgradeRequests.length === 0 ? (
                        <Card>
                            <CardContent className="p-8 text-center text-muted-foreground">
                                No pending upgradation requests
                            </CardContent>
                        </Card>
                    ) : (
                        upgradeRequests.map((request, index) => (
                            <Card key={`upgrade-card-${request.id}-${request.created_at || index}`}>
                                <CardHeader>
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <CardTitle className="text-lg">{request.broker_name}</CardTitle>
                                            <CardDescription>
                                                {request.broker_unique_id} • {request.broker_email}
                                            </CardDescription>
                                        </div>
                                        <Badge variant="secondary">{request.request_type}</Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm">
                                    <div className="grid gap-2 md:grid-cols-2">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Current Plan:</span>
                                            <span className="font-medium">{request.current_plan_name || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Requested Plan:</span>
                                            <span className="font-medium">{request.requested_plan_name}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Duration:</span>
                                            <span className="font-medium">{request.requested_duration_days} days</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Carry Forward:</span>
                                            <span className="font-medium">{request.carry_forward_days || 0} days</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Effective Start:</span>
                                            <span className="font-medium">{formatCompactDate(request.effective_starts_at)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Effective Expiry:</span>
                                            <span className="font-medium">{formatCompactDate(request.effective_expires_at)}</span>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center pt-2 border-t">
                                        <span className="text-muted-foreground">
                                            Requested on {formatCompactDate(request.created_at)}
                                        </span>
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                onClick={() => openUpgradeDecisionDialog(request, 'Completed')}
                                                disabled={processingUpgradeId === request.id}
                                            >
                                                Approve
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={() => openUpgradeDecisionDialog(request, 'Failed')}
                                                disabled={processingUpgradeId === request.id}
                                            >
                                                Reject
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </TabsContent>

                <TabsContent value="subscriptions" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Subscription Filters</CardTitle>
                            <CardDescription>Filter subscriptions by status or search</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Status</label>
                                    <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Status</SelectItem>
                                            <SelectItem value="Completed">Active/Completed</SelectItem>
                                            <SelectItem value="Pending">Pending</SelectItem>
                                            <SelectItem value="Rejected">Rejected</SelectItem>
                                            <SelectItem value="Suspended">Suspended</SelectItem>
                                            <SelectItem value="Refunded">Refunded</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Search</label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search by broker name, email, or ID..."
                                            className="pl-10"
                                            value={filters.search}
                                            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {subscriptionsLoading ? (
                        <Card>
                            <CardContent className="p-8 text-center text-muted-foreground">
                                Loading subscriptions...
                            </CardContent>
                        </Card>
                    ) : subscriptions.length === 0 ? (
                        <Card>
                            <CardContent className="p-8 text-center text-muted-foreground">
                                No subscriptions found
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4">
                            {subscriptions.map((subscription) => (
                                <Card key={subscription.id}>
                                    <CardHeader>
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <CardTitle className="text-lg">{subscription.broker_name}</CardTitle>
                                                <CardDescription>
                                                    {subscription.broker_unique_id} • {subscription.broker_email}
                                                </CardDescription>
                                            </div>
                                            <Badge variant={
                                                subscription.payment_status === 'Completed' ? 'default' :
                                                subscription.payment_status === 'Pending' ? 'secondary' :
                                                subscription.payment_status === 'Suspended' ? 'outline' :
                                                'destructive'
                                            }>
                                                {subscription.status_display}
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-3 text-sm">
                                        <div className="grid gap-2 md:grid-cols-3">
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Plan:</span>
                                                <span className="font-medium">{subscription.plan_name}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Amount:</span>
                                                <span className="font-medium">₹{subscription.amount_paid}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Duration:</span>
                                                <span className="font-medium">{subscription.duration_days} days</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Starts At:</span>
                                                <span className="font-medium">{formatCompactDate(subscription.starts_at)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Expires At:</span>
                                                <span className="font-medium">{formatCompactDate(subscription.expires_at)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Created:</span>
                                                <span className="font-medium">{formatCompactDate(subscription.created_at)}</span>
                                            </div>
                                        </div>

                                        {subscription.admin_remark && (
                                            <div className="pt-2 border-t">
                                                <span className="text-muted-foreground text-xs">Admin Remark:</span>
                                                <p className="text-xs mt-1">{subscription.admin_remark}</p>
                                            </div>
                                        )}

                                        <div className="flex justify-end pt-2 border-t">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleOpenEditSubscription(subscription)}
                                            >
                                                Edit Subscription
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            <Dialog open={!!upgradeDecisionDialog} onOpenChange={closeUpgradeDecisionDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {upgradeDecisionDialog?.status === 'Completed' ? 'Approve Upgradation Request' : 'Reject Upgradation Request'}
                        </DialogTitle>
                        <DialogDescription>
                            {upgradeDecisionDialog?.request.broker_name} • {upgradeDecisionDialog?.request.broker_unique_id}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {upgradeDecisionDialog?.status === 'Completed' && (
                            <>
                                <div className="space-y-2">
                                    <Label>Plan</Label>
                                    <Select
                                        value={upgradeDecisionDialog.planId}
                                        onValueChange={(value) => {
                                            const selectedPlan = plans.find((plan) => String(plan.id) === value);
                                            const recalculatedExpiry = calculateExpiryFromStartAndDuration(
                                                upgradeDecisionDialog.startsAt,
                                                Number(selectedPlan?.duration_days || 0)
                                            );

                                            setUpgradeDecisionDialog((prev) =>
                                                prev
                                                    ? {
                                                        ...prev,
                                                        planId: value,
                                                        expiresAt: recalculatedExpiry || prev.expiresAt
                                                    }
                                                    : prev
                                            );
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Choose a plan" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {plans.map((plan) => (
                                                <SelectItem key={plan.id} value={String(plan.id)}>
                                                    {plan.plan_name} - ₹{plan.price} ({plan.duration_days} days)
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>Start Date</Label>
                                        <Input
                                            type="date"
                                            value={upgradeDecisionDialog.startsAt}
                                            onChange={(e) => {
                                                const nextStart = e.target.value;
                                                const selectedPlan = plans.find(
                                                    (plan) => String(plan.id) === upgradeDecisionDialog.planId
                                                );
                                                const recalculatedExpiry = calculateExpiryFromStartAndDuration(
                                                    nextStart,
                                                    Number(selectedPlan?.duration_days || 0)
                                                );

                                                setUpgradeDecisionDialog((prev) =>
                                                    prev
                                                        ? {
                                                            ...prev,
                                                            startsAt: nextStart,
                                                            expiresAt: recalculatedExpiry || prev.expiresAt
                                                        }
                                                        : prev
                                                );
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Expiry Date</Label>
                                        <Input
                                            type="date"
                                            value={upgradeDecisionDialog.expiresAt}
                                            onChange={(e) =>
                                                setUpgradeDecisionDialog((prev) => (prev ? { ...prev, expiresAt: e.target.value } : prev))
                                            }
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        <div className="space-y-2">
                            <Label>Admin Remark</Label>
                            <Textarea
                                value={upgradeDecisionDialog?.remark || ''}
                                onChange={(e) =>
                                    setUpgradeDecisionDialog((prev) => (prev ? { ...prev, remark: e.target.value } : prev))
                                }
                                placeholder="Enter admin remark"
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={closeUpgradeDecisionDialog}>Cancel</Button>
                        <Button
                            onClick={handleUpgradeDecision}
                            disabled={processingUpgradeId === upgradeDecisionDialog?.request.id}
                            variant={upgradeDecisionDialog?.status === 'Completed' ? 'default' : 'destructive'}
                        >
                            {upgradeDecisionDialog?.status === 'Completed' ? 'Approve' : 'Reject'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Action Dialog */}
            <Dialog open={actionDialog.open} onOpenChange={handleCloseActionDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {actionDialog.action} Broker: {actionDialog.broker?.name}
                        </DialogTitle>
                        <DialogDescription>
                            {actionDialog.action === 'Approved' 
                                ? 'Selected plan is pre-filled from broker registration. You can change it, and subscription days are auto-fetched from plan duration.'
                                : actionDialog.action === 'Active'
                                ? 'This will activate broker account (stored as Approved) without creating or resetting subscription records.'
                                : `Provide a reason for ${actionDialog.action.toLowerCase()} this broker.`
                            }
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {actionDialog.action === 'Approved' && (
                            <>
                                <div className="space-y-2">
                                    <Label>Select Plan *</Label>
                                    <Select
                                        value={actionData.planId}
                                        onValueChange={(value) => setActionData({
                                            ...actionData,
                                            planId: value,
                                            subscriptionDays: getPlanDurationDays(value)
                                        })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Choose a plan" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {plans.map((plan) => (
                                                <SelectItem key={plan.id} value={String(plan.id)}>
                                                    {plan.plan_name} - ₹{plan.price} ({plan.duration_days} days)
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Subscription Days *</Label>
                                    <Input
                                        type="number"
                                        placeholder="Auto-fetched from plan"
                                        value={actionData.subscriptionDays}
                                        readOnly
                                    />
                                </div>
                            </>
                        )}
                        <div className="space-y-2">
                            <Label>Remark {actionDialog.action === 'Approved' ? '(Optional)' : ''}</Label>
                            <Textarea
                                placeholder={`Enter remark for ${actionDialog.action.toLowerCase()}...`}
                                value={actionData.remark}
                                onChange={(e) => setActionData({ ...actionData, remark: e.target.value })}
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={handleCloseActionDialog}>
                            Cancel
                        </Button>
                        <Button onClick={handleSubmitAction}>
                            Confirm {actionDialog.action}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Subscription Dialog */}
            <Dialog open={editSubscriptionDialog.open} onOpenChange={(open) => !open && handleCloseEditSubscription()}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Subscription</DialogTitle>
                        <DialogDescription>
                            Update subscription details, plan, dates, status, and remarks
                        </DialogDescription>
                    </DialogHeader>

                    {editSubscriptionDialog.subscription && (
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4 p-3 bg-muted rounded-lg">
                                <div>
                                    <p className="text-xs text-muted-foreground">Broker</p>
                                    <p className="font-medium">{editSubscriptionDialog.subscription.broker_name}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Email</p>
                                    <p className="text-sm">{editSubscriptionDialog.subscription.broker_email}</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="plan">Plan</Label>
                                <Select
                                    value={editSubscriptionDialog.subscription.plan_id.toString()}
                                    onValueChange={(value) => {
                                        const selectedPlan = plans.find(p => p.id === parseInt(value));
                                        if (selectedPlan && editSubscriptionDialog.subscription) {
                                            const startDate = toDateInputValue(editSubscriptionDialog.subscription.starts_at);
                                            const newExpiryDate = calculateExpiryFromStartAndDuration(startDate, selectedPlan.duration_days);
                                            
                                            setEditSubscriptionDialog(prev => ({
                                                ...prev,
                                                subscription: prev.subscription ? {
                                                    ...prev.subscription,
                                                    plan_id: selectedPlan.id,
                                                    plan_name: selectedPlan.plan_name,
                                                    plan_price: selectedPlan.price,
                                                    expires_at: newExpiryDate
                                                } : null
                                            }));
                                        }
                                    }}
                                >
                                    <SelectTrigger id="plan">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {plans.map((plan) => (
                                            <SelectItem key={plan.id} value={plan.id.toString()}>
                                                {plan.plan_name} - ₹{plan.price} ({plan.duration_days} days)
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="starts_at">Start Date</Label>
                                    <Input
                                        id="starts_at"
                                        type="date"
                                        value={toDateInputValue(editSubscriptionDialog.subscription.starts_at)}
                                        onChange={(e) => {
                                            if (editSubscriptionDialog.subscription) {
                                                const selectedPlan = plans.find(p => p.id === editSubscriptionDialog.subscription!.plan_id);
                                                const newExpiryDate = selectedPlan 
                                                    ? calculateExpiryFromStartAndDuration(e.target.value, selectedPlan.duration_days)
                                                    : editSubscriptionDialog.subscription.expires_at;
                                                
                                                setEditSubscriptionDialog(prev => ({
                                                    ...prev,
                                                    subscription: prev.subscription ? {
                                                        ...prev.subscription,
                                                        starts_at: e.target.value,
                                                        expires_at: newExpiryDate
                                                    } : null
                                                }));
                                            }
                                        }}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="expires_at">Expiry Date</Label>
                                    <Input
                                        id="expires_at"
                                        type="date"
                                        value={toDateInputValue(editSubscriptionDialog.subscription.expires_at)}
                                        onChange={(e) => {
                                            setEditSubscriptionDialog(prev => ({
                                                ...prev,
                                                subscription: prev.subscription ? {
                                                    ...prev.subscription,
                                                    expires_at: e.target.value
                                                } : null
                                            }));
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="status">Payment Status</Label>
                                <Select
                                    value={editSubscriptionDialog.subscription.payment_status}
                                    onValueChange={(value: 'Pending' | 'Completed' | 'Rejected' | 'Suspended' | 'Refunded') => {
                                        setEditSubscriptionDialog(prev => ({
                                            ...prev,
                                            subscription: prev.subscription ? {
                                                ...prev.subscription,
                                                payment_status: value
                                            } : null
                                        }));
                                    }}
                                >
                                    <SelectTrigger id="status">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Pending">Pending</SelectItem>
                                        <SelectItem value="Completed">Completed</SelectItem>
                                        <SelectItem value="Rejected">Rejected</SelectItem>
                                        <SelectItem value="Suspended">Suspended</SelectItem>
                                        <SelectItem value="Refunded">Refunded</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="admin_remark">Admin Remark</Label>
                                <Textarea
                                    id="admin_remark"
                                    value={editSubscriptionDialog.subscription.admin_remark || ''}
                                    onChange={(e) => {
                                        setEditSubscriptionDialog(prev => ({
                                            ...prev,
                                            subscription: prev.subscription ? {
                                                ...prev.subscription,
                                                admin_remark: e.target.value
                                            } : null
                                        }));
                                    }}
                                    placeholder="Add or update admin remarks..."
                                    rows={3}
                                />
                            </div>

                            {/* Subscription History */}
                            <div className="space-y-2 border-t pt-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <History className="h-4 w-4" />
                                    <Label className="text-base font-semibold">Subscription History</Label>
                                </div>
                                
                                {historyLoading ? (
                                    <div className="text-sm text-muted-foreground text-center py-4">
                                        Loading history...
                                    </div>
                                ) : subscriptionHistory.length === 0 ? (
                                    <div className="text-sm text-muted-foreground text-center py-4">
                                        No subscription history found
                                    </div>
                                ) : (
                                    <div className="space-y-3 max-h-60 overflow-y-auto">
                                        {subscriptionHistory
                                            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                                            .map((history, index) => (
                                            <Card key={history.id} className={index === 0 ? 'border-primary' : ''}>
                                                <CardContent className="p-3">
                                                    <div className="flex items-start justify-between gap-2 mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant={
                                                                history.payment_status === 'Completed' ? 'default' :
                                                                history.payment_status === 'Pending' ? 'secondary' :
                                                                history.payment_status === 'Rejected' ? 'destructive' :
                                                                history.payment_status === 'Suspended' ? 'outline' :
                                                                'secondary'
                                                            }>
                                                                {history.payment_status}
                                                            </Badge>
                                                            {index === 0 && (
                                                                <Badge variant="outline" className="text-xs">Current</Badge>
                                                            )}
                                                        </div>
                                                        <span className="text-xs text-muted-foreground">
                                                            {new Date(history.created_at).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                                        <div>
                                                            <p className="text-muted-foreground">Plan</p>
                                                            <p className="font-medium">{history.plan_name}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-muted-foreground">Amount</p>
                                                            <p className="font-medium">₹{history.plan_price}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-muted-foreground">Start Date</p>
                                                            <p className="font-medium">{new Date(history.starts_at).toLocaleDateString()}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-muted-foreground">Expiry Date</p>
                                                            <p className="font-medium">{new Date(history.expires_at).toLocaleDateString()}</p>
                                                        </div>
                                                    </div>
                                                    {history.admin_remark && (
                                                        <div className="mt-2 pt-2 border-t">
                                                            <p className="text-xs text-muted-foreground">Admin Remark:</p>
                                                            <p className="text-xs mt-1">{history.admin_remark}</p>
                                                        </div>
                                                    )}
                                                    <div className="mt-2 pt-2 border-t flex justify-end">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleOpenEditHistory(history)}
                                                        >
                                                            Edit History
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={handleCloseEditSubscription}>
                            Cancel
                        </Button>
                        <Button onClick={handleUpdateSubscription}>
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={editHistoryDialog.open} onOpenChange={(open) => !open && handleCloseEditHistory()}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Subscription History</DialogTitle>
                        <DialogDescription>
                            Update start date, expiry date, payment status, and admin remark.
                        </DialogDescription>
                    </DialogHeader>

                    {editHistoryDialog.subscription && (
                        <div className="space-y-4 py-2">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="history_starts_at">Start Date</Label>
                                    <Input
                                        id="history_starts_at"
                                        type="date"
                                        value={toDateInputValue(editHistoryDialog.subscription.starts_at)}
                                        onChange={(e) => {
                                            setEditHistoryDialog((prev) => ({
                                                ...prev,
                                                subscription: prev.subscription
                                                    ? {
                                                        ...prev.subscription,
                                                        starts_at: e.target.value
                                                    }
                                                    : null
                                            }));
                                        }}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="history_expires_at">Expiry Date</Label>
                                    <Input
                                        id="history_expires_at"
                                        type="date"
                                        value={toDateInputValue(editHistoryDialog.subscription.expires_at)}
                                        onChange={(e) => {
                                            setEditHistoryDialog((prev) => ({
                                                ...prev,
                                                subscription: prev.subscription
                                                    ? {
                                                        ...prev.subscription,
                                                        expires_at: e.target.value
                                                    }
                                                    : null
                                            }));
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="history_payment_status">Payment Status</Label>
                                <Select
                                    value={editHistoryDialog.subscription.payment_status}
                                    onValueChange={(value: 'Pending' | 'Completed' | 'Rejected' | 'Suspended' | 'Refunded') => {
                                        setEditHistoryDialog((prev) => ({
                                            ...prev,
                                            subscription: prev.subscription
                                                ? {
                                                    ...prev.subscription,
                                                    payment_status: value
                                                }
                                                : null
                                        }));
                                    }}
                                >
                                    <SelectTrigger id="history_payment_status">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Pending">Pending</SelectItem>
                                        <SelectItem value="Completed">Completed</SelectItem>
                                        <SelectItem value="Rejected">Rejected</SelectItem>
                                        <SelectItem value="Suspended">Suspended</SelectItem>
                                        <SelectItem value="Refunded">Refunded</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="history_admin_remark">Admin Remark</Label>
                                <Textarea
                                    id="history_admin_remark"
                                    value={editHistoryDialog.subscription.admin_remark || ''}
                                    onChange={(e) => {
                                        setEditHistoryDialog((prev) => ({
                                            ...prev,
                                            subscription: prev.subscription
                                                ? {
                                                    ...prev.subscription,
                                                    admin_remark: e.target.value
                                                }
                                                : null
                                        }));
                                    }}
                                    placeholder="Add admin remark"
                                    rows={3}
                                />
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={handleCloseEditHistory}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSaveHistoryEdit}
                            disabled={savingHistoryId === editHistoryDialog.subscription?.id}
                        >
                            Save History Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
