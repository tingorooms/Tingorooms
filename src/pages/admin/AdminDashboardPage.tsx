import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
    Building2, 
    Users, 
    UserCheck, 
    TrendingUp,
    ShieldCheck,
    Clock3,
    RefreshCw,
    Activity,
    CheckCircle2,
    PauseCircle,
    XCircle,
    ArrowRight,
    Settings,
    Award,
    AlertTriangle,
    UserCog,
    Package,
    Home,
    FileText,
    Zap,
    CreditCard
} from 'lucide-react';
import {
    getDashboardStats,
    updateBrokerStatus,
    updateRoomStatus,
    getBrokerPlans,
    getSubscriptionUpgradeRequests,
    decideSubscriptionUpgradeRequest,
    type SubscriptionUpgradeRequest
} from '@/services/adminService';
import type { Broker, Room, DashboardStats, User } from '@/types';
import { toast } from 'sonner';

type AdminDashboardData = {
    stats: DashboardStats;
    todayRegistrations: User[];
    todayRooms: Room[];
    pendingBrokers: Broker[];
    pendingRooms: Room[];
};

interface ApprovalDialogData {
    type: 'broker' | 'room';
    id: number | string;
    name: string;
    selectedPlanId?: number;
}

interface UpgradeDecisionDialogData {
    request: SubscriptionUpgradeRequest;
    status: 'Completed' | 'Failed';
    planId: string;
    startsAt: string;
    expiresAt: string;
    remark: string;
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

const AdminDashboardPage: React.FC = () => {
    const navigate = useNavigate();
    const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [processingBrokerId, setProcessingBrokerId] = useState<number | null>(null);
    const [processingRoomId, setProcessingRoomId] = useState<string | null>(null);
    const [processingUpgradeRequestId, setProcessingUpgradeRequestId] = useState<number | null>(null);
    const [approvalDialog, setApprovalDialog] = useState<ApprovalDialogData | null>(null);
    const [approvalTab, setApprovalTab] = useState<'brokers' | 'rooms' | 'upgrades'>('brokers');
    const [selectedPlan, setSelectedPlan] = useState<string>('none');
    const [subscriptionDays, setSubscriptionDays] = useState<string>('30');
    const [remark, setRemark] = useState('');
    const [brokerPlans, setBrokerPlans] = useState<any[]>([]);
    const [upgradeRequests, setUpgradeRequests] = useState<SubscriptionUpgradeRequest[]>([]);
    const [upgradeDecisionDialog, setUpgradeDecisionDialog] = useState<UpgradeDecisionDialogData | null>(null);

    useEffect(() => {
        void fetchDashboard();
        void fetchBrokerPlans();
        void fetchUpgradeRequests();
    }, []);

    const fetchDashboard = async () => {
        try {
            setLoading(true);
            const data = await getDashboardStats();
            setDashboard(data);
            setLastUpdated(new Date());
        } catch (error) {
            toast.error('Failed to load admin dashboard');
        } finally {
            setLoading(false);
        }
    };

    const fetchBrokerPlans = async () => {
        try {
            const plans = await getBrokerPlans();
            setBrokerPlans(plans);
        } catch (error) {
        }
    };

    const fetchUpgradeRequests = async () => {
        try {
            const requests = await getSubscriptionUpgradeRequests();
            setUpgradeRequests(requests);
        } catch (error) {
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
            setProcessingUpgradeRequestId(request.id);
            await decideSubscriptionUpgradeRequest(request.id, status, {
                plan_id: status === 'Completed' ? Number(planId) : undefined,
                starts_at: status === 'Completed' && startsAt ? startsAt : undefined,
                expires_at: status === 'Completed' && expiresAt ? expiresAt : undefined,
                remark: upgradeRemark || undefined
            });
            toast.success(status === 'Completed' ? 'Upgrade request approved' : 'Upgrade request rejected');
            await Promise.all([fetchDashboard(), fetchUpgradeRequests()]);
            closeUpgradeDecisionDialog();
        } catch (error) {
            toast.error('Failed to process upgrade request');
        } finally {
            setProcessingUpgradeRequestId(null);
        }
    };

    const stats = dashboard?.stats;
    const pendingRooms = dashboard?.pendingRooms || [];
    const pendingBrokers = dashboard?.pendingBrokers || [];

    const approvalRate = useMemo(() => {
        if (!stats?.total_rooms) return 0;
        return Math.round((stats.approved_rooms / stats.total_rooms) * 100);
    }, [stats?.approved_rooms, stats?.total_rooms]);

    const occupancyRate = useMemo(() => {
        if (!stats?.approved_rooms) return 0;
        return Math.round((stats.occupied_rooms / stats.approved_rooms) * 100);
    }, [stats?.occupied_rooms, stats?.approved_rooms]);

    const openApprovalDialog = (type: 'broker' | 'room', id: number | string, name: string, selectedPlanId?: number) => {
        const preselectedPlan = type === 'broker' && selectedPlanId ? selectedPlanId.toString() : 'none';
        const selectedPlanData = type === 'broker' && selectedPlanId
            ? brokerPlans.find((plan) => plan.id === selectedPlanId)
            : null;

        setApprovalDialog({ type, id, name, selectedPlanId });
        setRemark('');
        setSelectedPlan(preselectedPlan);
        setSubscriptionDays(selectedPlanData ? String(selectedPlanData.duration_days) : '30');
    };

    const closeApprovalDialog = () => {
        setApprovalDialog(null);
        setRemark('');
        setSelectedPlan('none');
        setSubscriptionDays('30');
    };

    const handleApprove = async () => {
        if (!approvalDialog) return;

        try {
            if (approvalDialog.type === 'broker') {
                const brokerId = approvalDialog.id as number;
                setProcessingBrokerId(brokerId);

                if (selectedPlan === 'none') {
                    toast.error('Please select a plan before approving broker');
                    return;
                }
                
                await updateBrokerStatus(
                    brokerId, 
                    'Approved', 
                    remark,
                    parseInt(selectedPlan),
                    subscriptionDays ? parseInt(subscriptionDays) : undefined
                );
                
                toast.success('Broker approved successfully with active subscription');
            } else {
                const roomId = approvalDialog.id as string;
                setProcessingRoomId(roomId);
                await updateRoomStatus(roomId, 'Approved', remark);
                toast.success('Room approved successfully');
            }
            
            await fetchDashboard();
            closeApprovalDialog();
        } catch (error) {
            toast.error('Failed to approve');
        } finally {
            setProcessingBrokerId(null);
            setProcessingRoomId(null);
        }
    };

    const handleBrokerDecision = async (brokerId: number, status: 'Hold' | 'Rejected' | 'Suspended') => {
        try {
            setProcessingBrokerId(brokerId);
            await updateBrokerStatus(brokerId, status);
            toast.success(`Broker ${status.toLowerCase()} successfully`);
            await fetchDashboard();
        } catch (error) {
            toast.error('Failed to update broker status');
        } finally {
            setProcessingBrokerId(null);
        }
    };

    const handleRoomDecision = async (roomId: string, status: 'Hold' | 'Rejected') => {
        try {
            setProcessingRoomId(roomId);
            await updateRoomStatus(roomId, status);
            toast.success(`Room ${status.toLowerCase()} successfully`);
            await fetchDashboard();
        } catch (error) {
            toast.error('Failed to update room status');
        } finally {
            setProcessingRoomId(null);
        }
    };

    if (loading && !dashboard) {
        return (
            <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6 sm:space-y-8 p-3 sm:p-6 bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 min-h-screen">
            {/* Header */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-blue-600 bg-clip-text text-transparent">Admin Control Center</h1>
                    <p className="text-muted-foreground mt-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                        Complete control and monitoring of the platform
                        {lastUpdated && (
                            <span className="text-xs">
                                • Last updated: {lastUpdated.toLocaleTimeString()}
                            </span>
                        )}
                    </p>
                </div>
                <Button onClick={() => { void Promise.all([fetchDashboard(), fetchUpgradeRequests()]); }} variant="outline" size="sm" className="w-full sm:w-auto shadow-sm hover:shadow-md transition-all duration-300">
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card className="cursor-pointer border-t-4 border-t-blue-500 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white" onClick={() => navigate('/admin/rooms')}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Rooms</CardTitle>
                        <div className="p-2 rounded-lg bg-blue-100">
                            <Building2 className="h-5 w-5 text-blue-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-600">{stats?.total_rooms || 0}</div>
                        <div className="flex gap-2 mt-2">
                            <Badge variant="secondary" className="text-xs">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                {stats?.approved_rooms || 0} Approved
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                                <Clock3 className="h-3 w-3 mr-1" />
                                {stats?.pending_rooms || 0} Pending
                            </Badge>
                        </div>
                    </CardContent>
                </Card>

                <Card className="cursor-pointer border-t-4 border-t-blue-500 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white" onClick={() => navigate('/admin/users')}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Members</CardTitle>
                        <div className="p-2 rounded-lg bg-blue-100">
                            <Users className="h-5 w-5 text-blue-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-600">{stats?.total_members || 0}</div>
                        <p className="text-xs text-muted-foreground mt-2">
                            {stats?.today_registrations || 0} joined today
                        </p>
                    </CardContent>
                </Card>

                <Card className="cursor-pointer border-t-4 border-t-blue-500 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white" onClick={() => navigate('/admin/brokers')}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Approved Brokers</CardTitle>
                        <div className="p-2 rounded-lg bg-blue-100">
                            <UserCheck className="h-5 w-5 text-blue-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-600">{stats?.approved_brokers || 0}</div>
                        <p className="text-xs text-muted-foreground mt-2">
                            {stats?.pending_brokers || 0} awaiting approval
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-t-4 border-t-amber-500 bg-white shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Platform Health</CardTitle>
                        <div className="p-2 rounded-lg bg-amber-100">
                            <TrendingUp className="h-5 w-5 text-amber-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-amber-600">{approvalRate}%</div>
                        <p className="text-xs text-muted-foreground mt-2">
                            Approval rate • {occupancyRate}% occupancy
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Quick Actions Grid */}
            <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
                {/* Operational Snapshot */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Activity className="h-5 w-5" />
                            Operational Snapshot
                        </CardTitle>
                        <CardDescription>Real-time platform activity and metrics</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="flex items-start space-x-3 p-4 bg-orange-50 rounded-lg border border-orange-200">
                                <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                                <div className="flex-1 space-y-1">
                                    <p className="text-sm font-medium leading-none">Approval Queue</p>
                                    <p className="text-2xl font-bold text-orange-600">
                                        {(stats?.pending_rooms || 0) + (stats?.pending_brokers || 0)}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {stats?.pending_rooms || 0} rooms • {stats?.pending_brokers || 0} brokers
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start space-x-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <Zap className="h-5 w-5 text-blue-600 mt-0.5" />
                                <div className="flex-1 space-y-1">
                                    <p className="text-sm font-medium leading-none">Today's Activity</p>
                                    <p className="text-2xl font-bold text-blue-600">
                                        {(stats?.today_registrations || 0) + (stats?.today_rooms || 0)}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {stats?.today_registrations || 0} signups • {stats?.today_rooms || 0} listings
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start space-x-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <Home className="h-5 w-5 text-blue-600 mt-0.5" />
                                <div className="flex-1 space-y-1">
                                    <p className="text-sm font-medium leading-none">Occupied Rooms</p>
                                    <p className="text-2xl font-bold text-blue-600">{stats?.occupied_rooms || 0}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {occupancyRate}% of approved rooms
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start space-x-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <Award className="h-5 w-5 text-blue-600 mt-0.5" />
                                <div className="flex-1 space-y-1">
                                    <p className="text-sm font-medium leading-none">Approval Success</p>
                                    <p className="text-2xl font-bold text-blue-600">{approvalRate}%</p>
                                    <p className="text-xs text-muted-foreground">
                                        {stats?.approved_rooms || 0} of {stats?.total_rooms || 0} approved
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Quick Navigation */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Settings className="h-5 w-5" />
                            Quick Access
                        </CardTitle>
                        <CardDescription>Navigate to management sections</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-2 sm:grid-cols-2 md:grid-cols-1">
                        <Button 
                            variant="outline" 
                            className="w-full justify-start"
                            onClick={() => navigate('/admin/users')}
                        >
                            <UserCog className="h-4 w-4 mr-2" />
                            Manage Users
                            <ArrowRight className="h-4 w-4 ml-auto" />
                        </Button>
                        <Button 
                            variant="outline" 
                            className="w-full justify-start"
                            onClick={() => navigate('/admin/rooms')}
                        >
                            <Building2 className="h-4 w-4 mr-2" />
                            Manage Rooms
                            <ArrowRight className="h-4 w-4 ml-auto" />
                        </Button>
                        <Button 
                            variant="outline" 
                            className="w-full justify-start"
                            onClick={() => navigate('/admin/brokers')}
                        >
                            <ShieldCheck className="h-4 w-4 mr-2" />
                            Manage Brokers
                            <ArrowRight className="h-4 w-4 ml-auto" />
                        </Button>
                        <Button 
                            variant="outline" 
                            className="w-full justify-start"
                            onClick={() => navigate('/admin/plans')}
                        >
                            <Package className="h-4 w-4 mr-2" />
                            Manage Plans
                            <ArrowRight className="h-4 w-4 ml-auto" />
                        </Button>
                        <Button 
                            variant="outline" 
                            className="w-full justify-start"
                            onClick={() => navigate('/admin/reports')}
                        >
                            <FileText className="h-4 w-4 mr-2" />
                            View Reports
                            <ArrowRight className="h-4 w-4 ml-auto" />
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Approval Queues */}
            <Tabs value={approvalTab} onValueChange={(value) => setApprovalTab(value as 'brokers' | 'rooms' | 'upgrades')} className="space-y-4">
                <div className="overflow-x-auto pb-1">
                <TabsList className="inline-flex min-w-full sm:grid sm:w-full sm:grid-cols-3">
                    <TabsTrigger value="brokers" className="flex min-w-[180px] items-center gap-2">
                        <UserCheck className="h-4 w-4" />
                        Broker Approvals ({pendingBrokers.length})
                    </TabsTrigger>
                    <TabsTrigger value="rooms" className="flex min-w-[180px] items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Room Approvals ({pendingRooms.length})
                    </TabsTrigger>
                    <TabsTrigger value="upgrades" className="flex min-w-[200px] items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Upgradation Requests ({upgradeRequests.length})
                    </TabsTrigger>
                </TabsList>
                </div>

                <TabsContent value="brokers">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <span className="flex items-center gap-2 min-w-0">
                                    <UserCheck className="h-5 w-5" />
                                    <span className="truncate">Pending Broker Approvals</span>
                                </span>
                                <Badge variant="outline" className="w-fit">{pendingBrokers.length}</Badge>
                            </CardTitle>
                            <CardDescription>Review and approve broker applications</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {pendingBrokers.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-8">No pending brokers</p>
                            ) : (
                                <div className="space-y-4">
                                    {pendingBrokers.slice(0, 5).map((broker: Broker) => (
                                        <div key={broker.id} className="flex flex-col gap-4 p-3 sm:p-4 border rounded-lg hover:bg-muted/50 transition-colors lg:flex-row lg:items-start lg:justify-between">
                                            <div className="space-y-1 flex-1 min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="font-semibold break-words">{broker.name}</p>
                                                    <Badge variant="secondary" className="text-xs max-w-full break-all">{broker.unique_id}</Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground break-all">{broker.email}</p>
                                                <p className="text-xs text-muted-foreground"><span className="font-medium">Contact:</span> {broker.contact || 'N/A'}</p>
                                                <p className="text-xs text-muted-foreground"><span className="font-medium">Area:</span> {broker.broker_area || 'N/A'}</p>
                                                {(broker as any).selected_plan && (
                                                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded break-words">
                                                        <p className="text-xs font-semibold text-blue-900">Requested Plan:</p>
                                                        <p className="text-xs text-blue-800">{(broker as any).selected_plan.plan_name} - ₹{(broker as any).selected_plan.price} ({(broker as any).selected_plan.duration_days} days)</p>
                                                    </div>
                                                )}
                                                {!(broker as any).selected_plan && broker.selected_plan_id && (
                                                    <p className="text-xs text-muted-foreground"><span className="font-medium">Plan ID:</span> {broker.selected_plan_id}</p>
                                                )}
                                                <p className="text-xs text-muted-foreground">Registered: {new Date(broker.registration_date).toLocaleDateString()}</p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:ml-4 lg:flex lg:w-40 lg:flex-col">
                                                <Button size="sm" onClick={() => openApprovalDialog('broker', broker.id, broker.name, broker.selected_plan_id)} disabled={processingBrokerId === broker.id} className="bg-green-600 hover:bg-green-700">
                                                    <CheckCircle2 className="h-4 w-4 mr-1" />
                                                    Approve
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={() => handleBrokerDecision(broker.id, 'Hold')} disabled={processingBrokerId === broker.id}>
                                                    <PauseCircle className="h-4 w-4 mr-1" />
                                                    Hold
                                                </Button>
                                                <Button size="sm" variant="destructive" onClick={() => handleBrokerDecision(broker.id, 'Rejected')} disabled={processingBrokerId === broker.id}>
                                                    <XCircle className="h-4 w-4 mr-1" />
                                                    Reject
                                                </Button>
                                                <Button 
                                                    size="sm" 
                                                    variant="outline" 
                                                    onClick={() => handleBrokerDecision(broker.id, 'Suspended')} 
                                                    disabled={processingBrokerId === broker.id}
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

                <TabsContent value="rooms">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    <Building2 className="h-5 w-5" />
                                    Pending Room Approvals
                                </span>
                                <Badge variant="outline">{pendingRooms.length}</Badge>
                            </CardTitle>
                            <CardDescription>Review and approve room listings</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {pendingRooms.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-8">No pending rooms</p>
                            ) : (
                                <div className="space-y-4">
                                    {pendingRooms.slice(0, 5).map((room: Room) => (
                                        <div key={room.room_id} className="flex flex-col gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors lg:flex-row lg:items-start lg:justify-between">
                                            <div className="space-y-1 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-semibold">{room.title}</p>
                                                    <Badge variant="secondary" className="text-xs">{room.room_id}</Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground">{room.area}, {room.city}</p>
                                                <div className="flex gap-2 items-center">
                                                    <Badge variant="outline" className="text-xs">{room.listing_type}</Badge>
                                                    <Badge variant="outline" className="text-xs">{room.room_type}</Badge>
                                                </div>
                                                <p className="text-xs text-muted-foreground">Posted: {new Date(room.post_date).toLocaleDateString()}</p>
                                            </div>
                                            <div className="grid gap-2 sm:grid-cols-3 lg:ml-4 lg:flex lg:w-40 lg:flex-col">
                                                <Button size="sm" onClick={() => openApprovalDialog('room', room.room_id, room.title)} disabled={processingRoomId === room.room_id} className="bg-green-600 hover:bg-green-700">
                                                    <CheckCircle2 className="h-4 w-4 mr-1" />
                                                    Approve
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={() => handleRoomDecision(room.room_id, 'Hold')} disabled={processingRoomId === room.room_id}>
                                                    <PauseCircle className="h-4 w-4 mr-1" />
                                                    Hold
                                                </Button>
                                                <Button size="sm" variant="destructive" onClick={() => handleRoomDecision(room.room_id, 'Rejected')} disabled={processingRoomId === room.room_id}>
                                                    <XCircle className="h-4 w-4 mr-1" />
                                                    Reject
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="upgrades">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    <CreditCard className="h-5 w-5" />
                                    Subscription Upgradation Requests
                                </span>
                                <Badge variant="outline">{upgradeRequests.length}</Badge>
                            </CardTitle>
                            <CardDescription>Review broker plan upgrade/renewal requests</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {upgradeRequests.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-8">No pending upgrade requests</p>
                            ) : (
                                <div className="space-y-4">
                                    {upgradeRequests.slice(0, 8).map((request, index) => (
                                        <div key={`upgrade-request-${request.id}-${request.created_at || index}`} className="flex flex-col gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors lg:flex-row lg:items-start lg:justify-between">
                                            <div className="space-y-1 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-semibold">{request.broker_name}</p>
                                                    <Badge variant="secondary" className="text-xs">{request.broker_unique_id}</Badge>
                                                    <Badge variant="outline" className="text-xs">{request.request_type}</Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground">{request.broker_email}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    <span className="font-medium">Current:</span> {request.current_plan_name || 'None'}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    <span className="font-medium">Requested:</span> {request.requested_plan_name} ({request.requested_duration_days} days)
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    <span className="font-medium">Amount:</span> ₹{request.amount_paid} • Requested: {formatCompactDate(request.created_at)}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    <span className="font-medium">Carry Forward:</span> {request.carry_forward_days || 0} days
                                                </p>
                                                {request.effective_starts_at && request.effective_expires_at && (
                                                    <p className="text-xs text-muted-foreground">
                                                        <span className="font-medium">Effective Timeline:</span>{' '}
                                                        {formatCompactDate(request.effective_starts_at)} → {formatCompactDate(request.effective_expires_at)}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="grid gap-2 sm:grid-cols-2 lg:ml-4 lg:flex lg:w-32 lg:flex-col">
                                                <Button
                                                    size="sm"
                                                    onClick={() => openUpgradeDecisionDialog(request, 'Completed')}
                                                    disabled={processingUpgradeRequestId === request.id}
                                                    className="bg-green-600 hover:bg-green-700"
                                                >
                                                    <CheckCircle2 className="h-4 w-4 mr-1" />
                                                    Approve
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={() => openUpgradeDecisionDialog(request, 'Failed')}
                                                    disabled={processingUpgradeRequestId === request.id}
                                                >
                                                    <XCircle className="h-4 w-4 mr-1" />
                                                    Reject
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={!!upgradeDecisionDialog} onOpenChange={closeUpgradeDecisionDialog}>
                <DialogContent className="sm:max-w-[520px]">
                    <DialogHeader>
                        <DialogTitle>
                            {upgradeDecisionDialog?.status === 'Completed' ? 'Approve Upgradation Request' : 'Reject Upgradation Request'}
                        </DialogTitle>
                        <DialogDescription>
                            {upgradeDecisionDialog?.request.broker_name} • {upgradeDecisionDialog?.request.broker_unique_id}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {upgradeDecisionDialog?.status === 'Completed' && (
                            <>
                                <div className="space-y-2">
                                    <Label>Plan</Label>
                                    <Select
                                        value={upgradeDecisionDialog.planId}
                                        onValueChange={(value) => {
                                            const selectedPlan = brokerPlans.find((plan) => String(plan.id) === value);
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
                                            <SelectValue placeholder="Select plan" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {brokerPlans.map((plan) => (
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
                                                const selectedPlan = brokerPlans.find(
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
                                                setUpgradeDecisionDialog((prev) =>
                                                    prev ? { ...prev, expiresAt: e.target.value } : prev
                                                )
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
                                    setUpgradeDecisionDialog((prev) =>
                                        prev ? { ...prev, remark: e.target.value } : prev
                                    )
                                }
                                placeholder="Add remark for this decision"
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={closeUpgradeDecisionDialog}>Cancel</Button>
                        <Button
                            onClick={handleUpgradeDecision}
                            disabled={processingUpgradeRequestId === upgradeDecisionDialog?.request.id}
                            variant={upgradeDecisionDialog?.status === 'Completed' ? 'default' : 'destructive'}
                        >
                            {upgradeDecisionDialog?.status === 'Completed' ? 'Approve' : 'Reject'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Approval Dialog */}
            <Dialog open={!!approvalDialog} onOpenChange={closeApprovalDialog}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>
                            Approve {approvalDialog?.type === 'broker' ? 'Broker' : 'Room'}
                        </DialogTitle>
                        <DialogDescription>
                            {approvalDialog?.type === 'broker' 
                                ? 'Approve this broker application and optionally activate their subscription'
                                : 'Approve this room listing'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {approvalDialog?.type === 'broker' && (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="plan">Subscription Plan (Optional)</Label>
                                    <Select
                                        value={selectedPlan}
                                        onValueChange={(value) => {
                                            setSelectedPlan(value);
                                            if (value === 'none') {
                                                setSubscriptionDays('30');
                                                return;
                                            }
                                            const plan = brokerPlans.find((item) => item.id === parseInt(value));
                                            setSubscriptionDays(plan ? String(plan.duration_days) : '30');
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a plan to activate" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">No subscription</SelectItem>
                                            {brokerPlans.map((plan) => (
                                                <SelectItem key={plan.id} value={plan.id.toString()}>
                                                    {plan.plan_name} - ₹{plan.price} ({plan.duration_days} days)
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {selectedPlan && selectedPlan !== 'none' && (
                                    <div className="space-y-2">
                                        <Label htmlFor="days">Subscription Duration (Days)</Label>
                                        <Input
                                            id="days"
                                            type="number"
                                            min="1"
                                            value={subscriptionDays}
                                            readOnly
                                            placeholder="30"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Subscription will be active from now until {
                                                new Date(Date.now() + parseInt(subscriptionDays || '30') * 24 * 60 * 60 * 1000).toLocaleDateString()
                                            }
                                        </p>
                                    </div>
                                )}
                            </>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="remark">Admin Remark (Optional)</Label>
                            <Textarea
                                id="remark"
                                value={remark}
                                onChange={(e) => setRemark(e.target.value)}
                                placeholder="Enter any remarks or notes..."
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={closeApprovalDialog}>
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleApprove}
                            disabled={processingBrokerId !== null || processingRoomId !== null}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Approve {selectedPlan !== 'none' && '& Activate Subscription'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default AdminDashboardPage;
