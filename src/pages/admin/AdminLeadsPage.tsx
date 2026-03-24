import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
    CheckCircle2,
    Clock3,
    ExternalLink,
    Eye,
    Inbox,
    Loader2,
    Mail,
    MessageSquare,
    Phone,
    RefreshCw,
    Search,
    ShieldAlert,
    Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ContactLead } from '@/types';
import {
    getContactLeadStats,
    getContactLeads,
    updateContactLeadStatus,
    type ContactLeadStats,
} from '@/services/adminService';

const statusOptions = ['all', 'New', 'In Progress', 'Closed', 'Spam'] as const;
const spamOptions = ['exclude', 'include', 'only'] as const;
const quickActionStatuses: Array<ContactLead['status']> = ['New', 'In Progress', 'Closed', 'Spam'];

const decodeHtmlEntities = (value?: string | null): string => String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&#x2F;/gi, '/')
    .replace(/&#47;/g, '/')
    .replace(/&#x3A;/gi, ':')
    .replace(/&#58;/g, ':')
    .replace(/&#x3F;/gi, '?')
    .replace(/&#63;/g, '?')
    .replace(/&#x3D;/gi, '=')
    .replace(/&#61;/g, '=')
    .trim();

const formatSourceLabel = (value?: string | null) => decodeHtmlEntities(value) || '/contact';

const getStatusBadgeVariant = (status: ContactLead['status']) => {
    switch (status) {
        case 'New':
            return 'default';
        case 'In Progress':
            return 'secondary';
        case 'Closed':
            return 'outline';
        case 'Spam':
            return 'destructive';
        default:
            return 'outline';
    }
};

const formatDateTime = (value?: string | null) => {
    if (!value) return 'N/A';

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'N/A';

    return parsed.toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short'
    });
};

const formatStatusActionLabel = (status: ContactLead['status']) => {
    switch (status) {
        case 'New':
            return 'Mark New';
        case 'In Progress':
            return 'Start Work';
        case 'Closed':
            return 'Close';
        case 'Spam':
            return 'Mark Spam';
        default:
            return status;
    }
};

const isLeadSpam = (lead: ContactLead) => lead.is_spam || lead.status === 'Spam';

const AdminLeadsPage: React.FC = () => {
    const [leads, setLeads] = useState<ContactLead[]>([]);
    const [stats, setStats] = useState<ContactLeadStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [quickUpdatingLeadId, setQuickUpdatingLeadId] = useState<number | null>(null);
    const [quickUpdatingStatus, setQuickUpdatingStatus] = useState<ContactLead['status'] | null>(null);
    const [selectedLead, setSelectedLead] = useState<ContactLead | null>(null);
    const [dialogStatus, setDialogStatus] = useState<ContactLead['status']>('New');
    const [dialogRemark, setDialogRemark] = useState('');
    const [filters, setFilters] = useState({
        status: 'all',
        spam: 'exclude',
        search: '',
        page: 1,
        limit: 20,
    });
    const [pagination, setPagination] = useState({
        currentPage: 1,
        totalPages: 1,
        totalItems: 0,
        itemsPerPage: 20,
        hasNextPage: false,
        hasPrevPage: false,
    });

    const fetchStats = async () => {
        try {
            const data = await getContactLeadStats();
            setStats(data);
        } catch (error) {
            toast.error('Failed to load lead stats');
        }
    };

    const fetchLeads = async () => {
        try {
            setLoading(true);
            const response = await getContactLeads(filters);
            setLeads(response.data);
            setPagination(response.pagination);
        } catch (error) {
            toast.error('Failed to load leads');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void fetchStats();
    }, []);

    useEffect(() => {
        void fetchLeads();
    }, [filters]);

    const openLeadDialog = (lead: ContactLead) => {
        setSelectedLead(lead);
        setDialogStatus(lead.status);
        setDialogRemark(lead.admin_remark || '');
    };

    const closeLeadDialog = (open: boolean) => {
        if (!open) {
            setSelectedLead(null);
            setDialogRemark('');
        }
    };

    const handleSaveLead = async () => {
        if (!selectedLead) return;

        try {
            setSaving(true);
            await updateContactLeadStatus(selectedLead.id, dialogStatus, dialogRemark);
            toast.success('Lead updated successfully');
            setSelectedLead(null);
            await Promise.all([fetchLeads(), fetchStats()]);
        } catch (error) {
            toast.error('Failed to update lead');
        } finally {
            setSaving(false);
        }
    };

    const handleQuickStatusUpdate = async (lead: ContactLead, status: ContactLead['status']) => {
        try {
            setQuickUpdatingLeadId(lead.id);
            setQuickUpdatingStatus(status);
            await updateContactLeadStatus(lead.id, status, lead.admin_remark || '');
            toast.success(`Lead moved to ${status}`);

            setLeads((current) => current.map((item) => (
                item.id === lead.id
                    ? {
                        ...item,
                        status,
                        is_spam: status === 'Spam'
                    }
                    : item
            )));

            if (selectedLead?.id === lead.id) {
                setSelectedLead((current) => current ? {
                    ...current,
                    status,
                    is_spam: status === 'Spam'
                } : current);
                setDialogStatus(status);
            }

            await fetchStats();
        } catch (error) {
            toast.error('Failed to update lead status');
        } finally {
            setQuickUpdatingLeadId(null);
            setQuickUpdatingStatus(null);
        }
    };

    return (
        <div className="space-y-6 p-4 sm:p-6 bg-gradient-to-br from-slate-50 via-emerald-50/30 to-slate-50 min-h-screen">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-teal-600 bg-clip-text text-transparent">
                        Contact Leads
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Review valid enquiries, isolate spam, and move leads through the admin workflow.
                    </p>
                </div>

                <Button
                    variant="outline"
                    onClick={() => {
                        void fetchLeads();
                        void fetchStats();
                    }}
                    disabled={loading}
                    className="shadow-sm"
                >
                    <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <Card className="border-t-4 border-t-slate-600">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-slate-700">All Leads</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-900">{stats?.total || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">Every submitted contact request</p>
                    </CardContent>
                </Card>

                <Card className="border-t-4 border-t-emerald-500">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-slate-700">New</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-600">{stats?.new || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">Fresh valid leads awaiting action</p>
                    </CardContent>
                </Card>

                <Card className="border-t-4 border-t-amber-500">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-slate-700">In Progress</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-amber-600">{stats?.in_progress || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">Leads currently being handled</p>
                    </CardContent>
                </Card>

                <Card className="border-t-4 border-t-blue-500">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-slate-700">Closed</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-600">{stats?.closed || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">Resolved leads with completed follow-up</p>
                    </CardContent>
                </Card>

                <Card className="border-t-4 border-t-rose-500">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-slate-700">Spam</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-rose-600">{stats?.spam || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">Blocked or suspicious submissions</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle>Filters</CardTitle>
                    <CardDescription>Search enquiries and control whether spam appears in the admin queue.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 lg:grid-cols-[1.3fr_220px_220px]">
                        <div className="relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                            <Input
                                value={filters.search}
                                onChange={(event) => setFilters((current) => ({
                                    ...current,
                                    search: event.target.value,
                                    page: 1,
                                }))}
                                className="pl-10"
                                placeholder="Search by name, email, phone, subject, or message"
                            />
                        </div>

                        <Select
                            value={filters.status}
                            onValueChange={(value) => setFilters((current) => ({ ...current, status: value, page: 1 }))}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Lead status" />
                            </SelectTrigger>
                            <SelectContent>
                                {statusOptions.map((option) => (
                                    <SelectItem key={option} value={option}>
                                        {option === 'all' ? 'All statuses' : option}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select
                            value={filters.spam}
                            onValueChange={(value) => setFilters((current) => ({ ...current, spam: value, page: 1 }))}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Spam filter" />
                            </SelectTrigger>
                            <SelectContent>
                                {spamOptions.map((option) => (
                                    <SelectItem key={option} value={option}>
                                        {option === 'exclude' ? 'Hide spam' : option === 'include' ? 'Show all' : 'Only spam'}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="mt-4 space-y-3 sm:hidden">
                        <div>
                            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Status</div>
                            <div className="flex gap-2 overflow-x-auto pb-1">
                                {statusOptions.map((option) => (
                                    <Button
                                        key={option}
                                        type="button"
                                        size="sm"
                                        variant={filters.status === option ? 'default' : 'outline'}
                                        className="shrink-0 rounded-full"
                                        onClick={() => setFilters((current) => ({ ...current, status: option, page: 1 }))}
                                    >
                                        {option === 'all' ? 'All' : option}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Spam</div>
                            <div className="flex gap-2 overflow-x-auto pb-1">
                                {spamOptions.map((option) => (
                                    <Button
                                        key={option}
                                        type="button"
                                        size="sm"
                                        variant={filters.spam === option ? 'default' : 'outline'}
                                        className="shrink-0 rounded-full"
                                        onClick={() => setFilters((current) => ({ ...current, spam: option, page: 1 }))}
                                    >
                                        {option === 'exclude' ? 'Hide Spam' : option === 'include' ? 'Show All' : 'Only Spam'}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle>Lead Queue</CardTitle>
                    <CardDescription>
                        {loading ? 'Loading leads...' : `${pagination.totalItems} lead${pagination.totalItems === 1 ? '' : 's'} found`}
                    </CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
                    {loading ? (
                        <div className="flex min-h-52 items-center justify-center gap-3 text-slate-500">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Loading leads...
                        </div>
                    ) : leads.length === 0 ? (
                        <div className="flex min-h-52 flex-col items-center justify-center gap-3 text-center text-slate-500">
                            <Inbox className="h-10 w-10" />
                            <div>
                                <p className="font-medium text-slate-700">No leads match the current filters</p>
                                <p className="text-sm">Try broadening the search or changing the spam filter.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                            {leads.map((lead) => (
                                <Card key={lead.id} className="overflow-hidden border-slate-200 bg-white/95 py-0 shadow-sm">
                                    <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-white to-blue-50/60 px-4 py-4 sm:px-5">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 space-y-2">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Badge variant={getStatusBadgeVariant(lead.status)}>
                                                        {lead.status}
                                                    </Badge>
                                                    {isLeadSpam(lead) && <Badge variant="destructive">Spam flagged</Badge>}
                                                </div>
                                                <CardTitle className="line-clamp-2 text-base text-slate-900 sm:text-lg">
                                                    {lead.subject}
                                                </CardTitle>
                                                <CardDescription className="text-xs sm:text-sm">
                                                    Received {formatDateTime(lead.submitted_at)}
                                                </CardDescription>
                                            </div>

                                            <Button variant="outline" size="sm" className="shrink-0" onClick={() => openLeadDialog(lead)}>
                                                <Eye className="mr-2 h-4 w-4" />
                                                Review
                                            </Button>
                                        </div>
                                    </CardHeader>

                                    <CardContent className="space-y-4 px-4 py-4 sm:px-5">
                                        <div className="space-y-3 rounded-xl bg-slate-50 p-3.5">
                                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                                <Sparkles className="h-4 w-4 text-blue-600" />
                                                {lead.name}
                                            </div>
                                            <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-sm text-blue-700 hover:underline break-all">
                                                <Mail className="h-4 w-4 shrink-0" />
                                                {lead.email}
                                            </a>
                                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                                <Phone className="h-4 w-4 shrink-0" />
                                                {lead.phone || 'Phone not provided'}
                                            </div>
                                            <div className="flex items-start gap-2 text-sm text-slate-600 break-all">
                                                <ExternalLink className="mt-0.5 h-4 w-4 shrink-0" />
                                                <span>Source: {formatSourceLabel(lead.source_page)}</span>
                                            </div>
                                        </div>

                                        <p className="line-clamp-4 text-sm leading-6 text-slate-600">
                                            {lead.message}
                                        </p>

                                        {(isLeadSpam(lead) || lead.spam_reason) && (
                                            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
                                                <div className="font-medium">Spam Score: {lead.spam_score}</div>
                                                <div className="mt-1 line-clamp-2">{lead.spam_reason || 'No reason recorded'}</div>
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                Quick Actions
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                                                {quickActionStatuses.map((status) => (
                                                    <Button
                                                        key={status}
                                                        type="button"
                                                        size="sm"
                                                        variant={lead.status === status ? 'default' : 'outline'}
                                                        disabled={quickUpdatingLeadId === lead.id || lead.status === status}
                                                        onClick={() => void handleQuickStatusUpdate(lead, status)}
                                                        className="justify-center px-3 text-xs sm:text-sm"
                                                    >
                                                        {quickUpdatingLeadId === lead.id && quickUpdatingStatus === status ? (
                                                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                                        ) : null}
                                                        {formatStatusActionLabel(status)}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    <div className="flex flex-col gap-4 border-t px-6 py-4 md:flex-row md:items-center md:justify-between">
                        <p className="text-sm text-slate-500">
                            Page {pagination.currentPage} of {pagination.totalPages}
                        </p>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                disabled={!pagination.hasPrevPage || loading}
                                onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}
                            >
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                disabled={!pagination.hasNextPage || loading}
                                onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={!!selectedLead} onOpenChange={closeLeadDialog}>
                <DialogContent className="sm:max-w-[760px]">
                    <DialogHeader>
                        <DialogTitle>Lead Review</DialogTitle>
                        <DialogDescription>
                            Inspect the enquiry, confirm whether it is valid, and update its workflow status.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedLead && (
                        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.95fr]">
                            <div className="space-y-4">
                                <div className="rounded-xl border bg-slate-50 p-4 space-y-2">
                                    <div className="flex items-center gap-2 text-slate-800 font-semibold">
                                        <MessageSquare className="h-4 w-4" />
                                        {selectedLead.subject}
                                    </div>
                                    <p className="text-sm leading-6 text-slate-600 whitespace-pre-wrap">
                                        {selectedLead.message}
                                    </p>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2">
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm">Contact</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-2 text-sm text-slate-600">
                                            <div>{selectedLead.name}</div>
                                            <a href={`mailto:${selectedLead.email}`} className="block text-blue-700 hover:underline">
                                                {selectedLead.email}
                                            </a>
                                            <div>{selectedLead.phone || 'Phone not provided'}</div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm">Submission</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-2 text-sm text-slate-600">
                                            <div>Submitted: {formatDateTime(selectedLead.submitted_at)}</div>
                                            <div>Updated: {formatDateTime(selectedLead.updated_at)}</div>
                                            <div>Source: {formatSourceLabel(selectedLead.source_page)}</div>
                                        </CardContent>
                                    </Card>
                                </div>

                                {(isLeadSpam(selectedLead) || selectedLead.spam_reason) && (
                                    <Card className="border-rose-200 bg-rose-50">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm text-rose-700 flex items-center gap-2">
                                                <ShieldAlert className="h-4 w-4" />
                                                Spam Signals
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-2 text-sm text-rose-700">
                                            <div>Score: {selectedLead.spam_score}</div>
                                            <div>{selectedLead.spam_reason || 'No reason recorded'}</div>
                                            <div>IP: {selectedLead.ip_address || 'Unknown'}</div>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>

                            <div className="space-y-4">
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">Workflow</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700">Status</label>
                                            <Select value={dialogStatus} onValueChange={(value) => setDialogStatus(value as ContactLead['status'])}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {statusOptions.filter((option) => option !== 'all').map((option) => (
                                                        <SelectItem key={option} value={option}>
                                                            {option}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700">Admin Remark</label>
                                            <Textarea
                                                rows={6}
                                                value={dialogRemark}
                                                onChange={(event) => setDialogRemark(event.target.value)}
                                                placeholder="Add context for the next admin or record the outcome of your follow-up."
                                            />
                                        </div>

                                        <div className="grid gap-3 sm:grid-cols-3">
                                            <Card className="border-none bg-slate-50 shadow-none">
                                                <CardContent className="p-4 text-center">
                                                    <Inbox className="mx-auto mb-2 h-5 w-5 text-slate-500" />
                                                    <div className="text-xs text-slate-500">Status</div>
                                                    <div className="text-sm font-semibold text-slate-900">{selectedLead.status}</div>
                                                </CardContent>
                                            </Card>
                                            <Card className="border-none bg-slate-50 shadow-none">
                                                <CardContent className="p-4 text-center">
                                                    <Clock3 className="mx-auto mb-2 h-5 w-5 text-amber-500" />
                                                    <div className="text-xs text-slate-500">Reviewed</div>
                                                    <div className="text-sm font-semibold text-slate-900">{formatDateTime(selectedLead.reviewed_at)}</div>
                                                </CardContent>
                                            </Card>
                                            <Card className="border-none bg-slate-50 shadow-none">
                                                <CardContent className="p-4 text-center">
                                                    <CheckCircle2 className="mx-auto mb-2 h-5 w-5 text-blue-500" />
                                                    <div className="text-xs text-slate-500">Spam Score</div>
                                                    <div className="text-sm font-semibold text-slate-900">{selectedLead.spam_score}</div>
                                                </CardContent>
                                            </Card>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSelectedLead(null)} disabled={saving}>
                            Cancel
                        </Button>
                        <Button onClick={() => void handleSaveLead()} disabled={saving}>
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default AdminLeadsPage;