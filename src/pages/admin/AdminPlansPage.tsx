import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, RefreshCw, Pencil, Power, Search, Package, ShieldCheck, LayoutList } from 'lucide-react';
import { toast } from 'sonner';
import {
    createAdminPlan,
    getAdminPlans,
    updateAdminPlan,
    updateAdminPlanStatus,
    type AdminPlanPayload
} from '@/services/adminService';

type PlanType = 'all' | 'Regular' | 'Broker';

interface AdminPlan {
    id: number;
    plan_name: string;
    plan_code: string;
    plan_type: 'Regular' | 'Broker';
    description?: string;
    price: number;
    duration_days: number;
    features: string[] | string | null;
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
}

interface PlanFormState {
    plan_name: string;
    plan_code: string;
    plan_type: 'Regular' | 'Broker';
    description: string;
    price: string;
    duration_days: string;
    featuresText: string;
    is_active: boolean;
}

const initialFormState: PlanFormState = {
    plan_name: '',
    plan_code: '',
    plan_type: 'Broker',
    description: '',
    price: '',
    duration_days: '30',
    featuresText: '',
    is_active: true
};

const parseFeatures = (value: AdminPlan['features']): string[] => {
    if (Array.isArray(value)) {
        return value.map((item) => String(item).trim()).filter(Boolean);
    }

    if (typeof value === 'string') {
        const trimmedValue = value.trim();
        if (!trimmedValue) {
            return [];
        }

        try {
            const parsed = JSON.parse(trimmedValue);
            if (Array.isArray(parsed)) {
                return parsed.map((item) => String(item).trim()).filter(Boolean);
            }
        } catch {
            return trimmedValue.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
        }
    }

    return [];
};

const toFormState = (plan?: AdminPlan | null): PlanFormState => {
    if (!plan) {
        return initialFormState;
    }

    return {
        plan_name: plan.plan_name,
        plan_code: plan.plan_code,
        plan_type: plan.plan_type,
        description: plan.description || '',
        price: String(plan.price),
        duration_days: String(plan.duration_days),
        featuresText: parseFeatures(plan.features).join('\n'),
        is_active: Boolean(plan.is_active)
    };
};

const AdminPlansPage: React.FC = () => {
    const [plans, setPlans] = useState<AdminPlan[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [processingPlanId, setProcessingPlanId] = useState<number | null>(null);
    const [planTypeFilter, setPlanTypeFilter] = useState<PlanType>('all');
    const [search, setSearch] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<AdminPlan | null>(null);
    const [formState, setFormState] = useState<PlanFormState>(initialFormState);
    const [showSuggestions, setShowSuggestions] = useState(false);

    useEffect(() => {
        void fetchPlans();
    }, [planTypeFilter]);

    const fetchPlans = async () => {
        try {
            setLoading(true);
            const data = await getAdminPlans(planTypeFilter);
            setPlans(data);
        } catch (error) {
            toast.error('Failed to fetch plans');
        } finally {
            setLoading(false);
        }
    };

    const filteredPlans = useMemo(() => {
        const keyword = search.trim().toLowerCase();
        if (!keyword) {
            return plans;
        }

        return plans.filter((plan) =>
            [plan.plan_name, plan.plan_code, plan.plan_type]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(keyword))
        );
    }, [plans, search]);

    const planStats = useMemo(() => {
        const total = plans.length;
        const active = plans.filter((plan) => Boolean(plan.is_active)).length;
        const broker = plans.filter((plan) => plan.plan_type === 'Broker').length;
        const regular = plans.filter((plan) => plan.plan_type === 'Regular').length;

        return { total, active, broker, regular };
    }, [plans]);

    const suggestions = useMemo(() => {
        const keyword = search.trim().toLowerCase();
        if (!keyword) return [];
        
        return plans
            .filter((plan) =>
                [plan.plan_name, plan.plan_code]
                    .filter(Boolean)
                    .some((value) => String(value).toLowerCase().includes(keyword))
            )
            .slice(0, 6);
    }, [plans, search]);

    const openCreateDialog = () => {
        setEditingPlan(null);
        setFormState(initialFormState);
        setDialogOpen(true);
    };

    const openEditDialog = (plan: AdminPlan) => {
        setEditingPlan(plan);
        setFormState(toFormState(plan));
        setDialogOpen(true);
    };

    const closeDialog = () => {
        setDialogOpen(false);
        setEditingPlan(null);
        setFormState(initialFormState);
    };

    const toPayload = (): AdminPlanPayload | null => {
        const price = Number(formState.price);
        const durationDays = Number(formState.duration_days);
        const features = formState.featuresText
            .split('\n')
            .map((item) => item.trim())
            .filter(Boolean);

        if (!formState.plan_name.trim()) {
            toast.error('Plan name is required');
            return null;
        }

        if (!formState.plan_code.trim()) {
            toast.error('Plan code is required');
            return null;
        }

        if (!Number.isFinite(price) || price < 0) {
            toast.error('Price must be a valid non-negative number');
            return null;
        }

        if (!Number.isInteger(durationDays) || durationDays < 1) {
            toast.error('Duration must be at least 1 day');
            return null;
        }

        return {
            plan_name: formState.plan_name.trim(),
            plan_code: formState.plan_code.trim(),
            plan_type: formState.plan_type,
            description: formState.description.trim() || undefined,
            price,
            duration_days: durationDays,
            features,
            is_active: formState.is_active
        };
    };

    const handleSubmitPlan = async () => {
        const payload = toPayload();
        if (!payload) {
            return;
        }

        try {
            setSaving(true);

            if (editingPlan) {
                await updateAdminPlan(editingPlan.id, payload);
                toast.success('Plan updated successfully');
            } else {
                await createAdminPlan(payload);
                toast.success('Plan created successfully');
            }

            closeDialog();
            await fetchPlans();
        } catch (error) {
            toast.error('Failed to save plan');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleStatus = async (plan: AdminPlan) => {
        try {
            setProcessingPlanId(plan.id);
            await updateAdminPlanStatus(plan.id, !plan.is_active);
            toast.success(`Plan ${plan.is_active ? 'deactivated' : 'activated'} successfully`);
            await fetchPlans();
        } catch (error) {
            toast.error('Failed to update plan status');
        } finally {
            setProcessingPlanId(null);
        }
    };

    return (
        <div className="space-y-4 sm:space-y-6 md:space-y-8 pt-0 px-3 sm:px-6 py-3 sm:py-6 bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 min-h-screen">
            <div className="flex flex-col gap-3 sm:gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-blue-600 bg-clip-text text-transparent">
                        Plan Management
                    </h1>
                    <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">Add, edit, activate, and deactivate subscription plans with full control.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-2 w-full sm:w-auto">
                    <Button 
                        variant="outline" 
                        onClick={() => { void fetchPlans(); }} 
                        disabled={loading}
                        className="w-full sm:w-auto"
                    >
                        <RefreshCw className={`h-4 w-4 sm:mr-2 ${loading ? 'animate-spin' : ''}`} />
                        <span className="ml-2 sm:ml-0">Refresh</span>
                    </Button>
                    <Button 
                        onClick={openCreateDialog}
                        className="w-full sm:w-auto"
                    >
                        <Plus className="h-4 w-4 sm:mr-2" />
                        <span className="ml-2 sm:ml-0">Add Plan</span>
                    </Button>
                </div>
            </div>

            <div className="grid gap-3 sm:gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="border-t-4 border-t-blue-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6">
                        <CardTitle className="text-sm font-medium">Total Plans</CardTitle>
                        <LayoutList className="h-5 w-5 text-blue-600" />
                    </CardHeader>
                    <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                        <div className="text-2xl sm:text-3xl font-bold text-blue-600">{planStats.total}</div>
                        <p className="text-xs text-muted-foreground mt-1">Across all plan types</p>
                    </CardContent>
                </Card>

                <Card className="border-t-4 border-t-blue-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6">
                        <CardTitle className="text-sm font-medium">Active Plans</CardTitle>
                        <Power className="h-5 w-5 text-blue-600" />
                    </CardHeader>
                    <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                        <div className="text-2xl sm:text-3xl font-bold text-blue-600">{planStats.active}</div>
                        <p className="text-xs text-muted-foreground mt-1">Available for subscriptions</p>
                    </CardContent>
                </Card>

                <Card className="border-t-4 border-t-blue-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6">
                        <CardTitle className="text-sm font-medium">Broker Plans</CardTitle>
                        <ShieldCheck className="h-5 w-5 text-blue-600" />
                    </CardHeader>
                    <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                        <div className="text-2xl sm:text-3xl font-bold text-blue-600">{planStats.broker}</div>
                        <p className="text-xs text-muted-foreground mt-1">For broker subscriptions</p>
                    </CardContent>
                </Card>

                <Card className="border-t-4 border-t-amber-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6">
                        <CardTitle className="text-sm font-medium">Regular Plans</CardTitle>
                        <Package className="h-5 w-5 text-amber-600" />
                    </CardHeader>
                    <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                        <div className="text-2xl sm:text-3xl font-bold text-amber-600">{planStats.regular}</div>
                        <p className="text-xs text-muted-foreground mt-1">For standard listings</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-sm">
                <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-lg sm:text-xl">Plans</CardTitle>
                    <CardDescription className="text-sm">Search, filter, and control all available plans</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 p-4 sm:p-6">
                    <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-3">
                        {/* Search Field with Auto-Suggestions */}
                        <div className="space-y-2 md:col-span-2 relative">
                            <Label className="text-sm font-bold drop-shadow-sm">🔍 Search Plans</Label>
                            <div className="relative">
                                <Search className="absolute left-3 sm:left-4 top-3 sm:top-4 h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                                <Input
                                    value={search}
                                    onChange={(event) => {
                                        setSearch(event.target.value);
                                        setShowSuggestions(true);
                                    }}
                                    onFocus={() => setShowSuggestions(true)}
                                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                                    placeholder="Type plan name or code..."
                                    className="pl-10 sm:pl-12 pr-3 sm:pr-4 h-11 sm:h-14 text-sm sm:text-base font-medium border-2 border-slate-300 hover:border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-xl sm:rounded-2xl shadow-md transition-all duration-200"
                                />
                                
                                {/* Auto-Suggestions Dropdown */}
                                {showSuggestions && search.trim() && suggestions.length > 0 && (
                                    <div className="absolute top-full mt-2 w-full bg-white border-2 border-slate-200 rounded-xl sm:rounded-2xl shadow-xl z-50 max-h-[60vh] overflow-y-auto">
                                        {suggestions.map((plan) => (
                                            <button
                                                key={plan.id}
                                                onClick={() => {
                                                    setSearch(plan.plan_name);
                                                    setShowSuggestions(false);
                                                }}
                                                className="w-full text-left px-3 sm:px-4 py-3 hover:bg-blue-50 border-b border-slate-100 last:border-b-0 transition-colors duration-150 flex flex-col gap-1 touch-manipulation"
                                            >
                                                <p className="font-semibold text-slate-900 text-sm sm:text-base">{plan.plan_name}</p>
                                                <p className="text-xs text-slate-500 break-words">Code: {plan.plan_code} • {plan.plan_type} • ₹{Number(plan.price).toLocaleString()}</p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Type Filter */}
                        <div className="space-y-2">
                            <Label className="text-sm font-bold drop-shadow-sm">📋 Plan Type</Label>
                            <Select value={planTypeFilter} onValueChange={(value) => setPlanTypeFilter(value as PlanType)}>
                                <SelectTrigger className="h-11 sm:h-14 text-sm sm:text-base font-semibold border-2 border-slate-300 hover:border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-xl sm:rounded-2xl shadow-md transition-all duration-200">
                                    <SelectValue placeholder="Filter by type" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl sm:rounded-2xl border-2 border-slate-200 shadow-xl">
                                    <SelectItem value="all" className="text-sm sm:text-base py-2 font-medium hover:bg-blue-50">
                                        📌 All Types
                                    </SelectItem>
                                    <SelectItem value="Broker" className="text-sm sm:text-base py-2 font-medium hover:bg-blue-50">
                                        🛡️ Broker
                                    </SelectItem>
                                    <SelectItem value="Regular" className="text-sm sm:text-base py-2 font-medium hover:bg-blue-50">
                                        📦 Regular
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Mobile Card View */}
                    <div className="block lg:hidden space-y-3">
                        {loading ? (
                            <Card className="p-6 text-center text-muted-foreground">
                                Loading plans...
                            </Card>
                        ) : filteredPlans.length === 0 ? (
                            <Card className="p-6 text-center text-muted-foreground">
                                No plans found
                            </Card>
                        ) : (
                            filteredPlans.map((plan) => (
                                <Card key={plan.id} className="overflow-hidden">
                                    <CardContent className="p-4 space-y-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-semibold text-base truncate">{plan.plan_name}</h3>
                                                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{plan.description || 'No description'}</p>
                                            </div>
                                            <Badge variant={plan.is_active ? 'default' : 'secondary'} className="shrink-0">
                                                {plan.is_active ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <div>
                                                <p className="text-xs text-muted-foreground">Code</p>
                                                <p className="font-mono text-xs font-medium">{plan.plan_code}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">Type</p>
                                                <Badge variant="outline" className="mt-1">{plan.plan_type}</Badge>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">Price</p>
                                                <p className="font-semibold">₹{Number(plan.price).toLocaleString()}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">Duration</p>
                                                <p className="font-medium">{plan.duration_days} days</p>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2 pt-2">
                                            <Button 
                                                size="sm" 
                                                variant="outline" 
                                                onClick={() => openEditDialog(plan)}
                                                className="w-full justify-center"
                                            >
                                                <Pencil className="h-4 w-4 mr-2" />
                                                Edit Plan
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant={plan.is_active ? 'secondary' : 'default'}
                                                onClick={() => { void handleToggleStatus(plan); }}
                                                disabled={processingPlanId === plan.id}
                                                className="w-full justify-center"
                                            >
                                                <Power className="h-4 w-4 mr-2" />
                                                {plan.is_active ? 'Deactivate' : 'Activate'}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden lg:block rounded-md border overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Code</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Price</TableHead>
                                    <TableHead>Duration</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                            Loading plans...
                                        </TableCell>
                                    </TableRow>
                                ) : filteredPlans.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                            No plans found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredPlans.map((plan) => (
                                        <TableRow key={plan.id}>
                                            <TableCell>
                                                <div>
                                                    <p className="font-medium">{plan.plan_name}</p>
                                                    <p className="text-xs text-muted-foreground line-clamp-1">{plan.description || 'No description'}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">{plan.plan_code}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{plan.plan_type}</Badge>
                                            </TableCell>
                                            <TableCell>₹{Number(plan.price).toLocaleString()}</TableCell>
                                            <TableCell>{plan.duration_days} days</TableCell>
                                            <TableCell>
                                                <Badge variant={plan.is_active ? 'default' : 'secondary'}>
                                                    {plan.is_active ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button size="sm" variant="outline" onClick={() => openEditDialog(plan)}>
                                                        <Pencil className="h-4 w-4 mr-1" />
                                                        Edit
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant={plan.is_active ? 'secondary' : 'default'}
                                                        onClick={() => { void handleToggleStatus(plan); }}
                                                        disabled={processingPlanId === plan.id}
                                                    >
                                                        <Power className="h-4 w-4 mr-1" />
                                                        {plan.is_active ? 'Deactivate' : 'Activate'}
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-[95vw] sm:max-w-[90vw] md:max-w-[640px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader className="pb-3 sm:pb-4">
                        <DialogTitle className="text-lg sm:text-xl">{editingPlan ? 'Edit Plan' : 'Add New Plan'}</DialogTitle>
                        <DialogDescription className="text-sm">
                            {editingPlan ? 'Update plan details and status.' : 'Create a new plan and publish it as active or inactive.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-3 sm:gap-4 py-2 grid-cols-1 md:grid-cols-2">
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="plan_name" className="text-sm">Plan Name</Label>
                            <Input
                                id="plan_name"
                                value={formState.plan_name}
                                onChange={(event) => setFormState((prev) => ({ ...prev, plan_name: event.target.value }))}
                                className="h-10 sm:h-11"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="plan_code" className="text-sm">Plan Code</Label>
                            <Input
                                id="plan_code"
                                value={formState.plan_code}
                                onChange={(event) => setFormState((prev) => ({ ...prev, plan_code: event.target.value.toUpperCase() }))}
                                className="h-10 sm:h-11"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm">Plan Type</Label>
                            <Select
                                value={formState.plan_type}
                                onValueChange={(value) => setFormState((prev) => ({ ...prev, plan_type: value as 'Regular' | 'Broker' }))}
                            >
                                <SelectTrigger className="h-10 sm:h-11">
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Broker">Broker</SelectItem>
                                    <SelectItem value="Regular">Regular</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="price" className="text-sm">Price</Label>
                            <Input
                                id="price"
                                type="number"
                                min="0"
                                step="0.01"
                                value={formState.price}
                                onChange={(event) => setFormState((prev) => ({ ...prev, price: event.target.value }))}
                                className="h-10 sm:h-11"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="duration_days" className="text-sm">Duration (Days)</Label>
                            <Input
                                id="duration_days"
                                type="number"
                                min="1"
                                value={formState.duration_days}
                                onChange={(event) => setFormState((prev) => ({ ...prev, duration_days: event.target.value }))}
                                className="h-10 sm:h-11"
                            />
                        </div>

                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="description" className="text-sm">Description</Label>
                            <Textarea
                                id="description"
                                rows={2}
                                value={formState.description}
                                onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
                                className="text-sm resize-none"
                            />
                        </div>

                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="features" className="text-sm">Features (one per line)</Label>
                            <Textarea
                                id="features"
                                rows={5}
                                value={formState.featuresText}
                                onChange={(event) => setFormState((prev) => ({ ...prev, featuresText: event.target.value }))}
                                placeholder={'Unlimited postings\nPriority listing\nDedicated support'}
                                className="text-sm resize-none"
                            />
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border p-3 md:col-span-2">
                            <div>
                                <p className="text-sm font-medium">Plan Status</p>
                                <p className="text-xs text-muted-foreground">Enable this to make the plan available for selection</p>
                            </div>
                            <Select
                                value={formState.is_active ? 'active' : 'inactive'}
                                onValueChange={(value) => setFormState((prev) => ({ ...prev, is_active: value === 'active' }))}
                            >
                                <SelectTrigger className="w-full sm:w-[140px] h-10">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0 pt-3 sm:pt-4">
                        <Button 
                            variant="outline" 
                            onClick={closeDialog} 
                            disabled={saving}
                            className="w-full sm:w-auto"
                        >
                            Cancel
                        </Button>
                        <Button 
                            onClick={() => { void handleSubmitPlan(); }} 
                            disabled={saving}
                            className="w-full sm:w-auto"
                        >
                            {saving ? 'Saving...' : editingPlan ? 'Update Plan' : 'Create Plan'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default AdminPlansPage;
