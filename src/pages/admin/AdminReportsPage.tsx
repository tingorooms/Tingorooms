import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Download, Calendar, RefreshCw } from 'lucide-react';
import { getReports, type AdminReportsData, type ReportSeriesPoint } from '@/services/adminService';
import { toast } from 'sonner';

type ReportType = 'all' | 'registrations' | 'rooms' | 'expenses';

const formatDateInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const today = new Date();
const last30Days = new Date();
last30Days.setDate(today.getDate() - 29);

const AdminReportsPage: React.FC = () => {
    const [dateRange, setDateRange] = useState({
        start: formatDateInput(last30Days),
        end: formatDateInput(today)
    });
    const [reportType, setReportType] = useState<ReportType>('all');
    const [reports, setReports] = useState<AdminReportsData>({});
    const [loading, setLoading] = useState(false);

    const fetchReports = async (type = reportType, start = dateRange.start, end = dateRange.end) => {
        try {
            setLoading(true);
            const data = await getReports(type, start, end);
            setReports(data || {});
        } catch (error) {
            toast.error('Failed to load reports');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void fetchReports('all', dateRange.start, dateRange.end);
    }, []);

    const applyQuickRange = async (days: number) => {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - (days - 1));

        const nextRange = {
            start: formatDateInput(start),
            end: formatDateInput(end)
        };

        setDateRange(nextRange);
        await fetchReports(reportType, nextRange.start, nextRange.end);
    };

    const totals = useMemo(() => {
        const registrationsTotal = (reports.registrations || []).reduce((sum, row) => sum + Number(row.count || 0), 0);
        const roomsTotal = (reports.rooms || []).reduce((sum, row) => sum + Number(row.count || 0), 0);
        const expensesTotal = (reports.expenses || []).reduce((sum, row) => sum + Number(row.total || 0), 0);

        return {
            registrationsTotal,
            roomsTotal,
            expensesTotal
        };
    }, [reports]);

    const downloadCsv = (fileName: string, rows: ReportSeriesPoint[], includeTotal = false) => {
        if (!rows || rows.length === 0) {
            toast.error('No data available to download');
            return;
        }

        const headers = includeTotal ? ['Date', 'Count', 'Total'] : ['Date', 'Count'];
        const lines = [headers.join(',')];

        rows.forEach((row) => {
            const values = includeTotal
                ? [row.date, row.count, row.total || 0]
                : [row.date, row.count];

            lines.push(values.join(','));
        });

        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
    };

    const renderReportTable = (title: string, rows: ReportSeriesPoint[], includeTotal = false) => (
        <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base">{title}</CardTitle>
                <Button
                    size="sm"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => downloadCsv(`${title.toLowerCase().replace(/\s+/g, '-')}.csv`, rows, includeTotal)}
                >
                    <Download className="w-4 h-4 mr-2" />
                    Download CSV
                </Button>
            </CardHeader>
            <CardContent>
                {rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">No data in selected date range</p>
                ) : (
                    <>
                        <div className="grid gap-3 sm:hidden">
                            {rows.map((row, index) => (
                                <Card key={`${title}-mobile-${row.date}-${index}`} className="border border-slate-200 shadow-none">
                                    <CardContent className="grid gap-2 p-4 text-sm">
                                        <div>
                                            <p className="text-xs text-muted-foreground">Date</p>
                                            <p className="font-medium">{new Date(row.date).toLocaleDateString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Count</p>
                                            <p className="font-medium">{row.count}</p>
                                        </div>
                                        {includeTotal && (
                                            <div>
                                                <p className="text-xs text-muted-foreground">Total</p>
                                                <p className="font-medium">₹{Number(row.total || 0).toLocaleString()}</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                        <div className="hidden overflow-x-auto sm:block">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Count</TableHead>
                                        {includeTotal && <TableHead>Total</TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rows.map((row, index) => (
                                        <TableRow key={`${title}-${row.date}-${index}`}>
                                            <TableCell>{new Date(row.date).toLocaleDateString()}</TableCell>
                                            <TableCell>{row.count}</TableCell>
                                            {includeTotal && <TableCell>₹{Number(row.total || 0).toLocaleString()}</TableCell>}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );

    return (
        <div className="space-y-6 p-3 sm:p-6 bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 min-h-screen">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-blue-600 bg-clip-text text-transparent">Reports</h1>
                    <p className="text-muted-foreground mt-2">Generate, review, and download platform reports</p>
                </div>
                <Button className="w-full sm:w-auto" onClick={() => { void fetchReports(); }} variant="outline" disabled={loading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Generate Report</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                        <div className="space-y-2">
                            <Label>Report Type</Label>
                            <Select value={reportType} onValueChange={(value) => setReportType(value as ReportType)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select report type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All</SelectItem>
                                    <SelectItem value="registrations">Registrations</SelectItem>
                                    <SelectItem value="rooms">Rooms</SelectItem>
                                    <SelectItem value="expenses">Expenses</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Start Date</Label>
                            <Input 
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>End Date</Label>
                            <Input 
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="grid gap-2 sm:flex sm:flex-wrap">
                        <Button className="w-full sm:w-auto" onClick={() => { void fetchReports(); }} disabled={loading}>
                            <BarChart3 className="w-4 h-4 mr-2" />
                            {loading ? 'Generating...' : 'Generate Report'}
                        </Button>
                        <Button className="w-full sm:w-auto" variant="outline" onClick={() => { void applyQuickRange(1); }} disabled={loading}>Daily</Button>
                        <Button className="w-full sm:w-auto" variant="outline" onClick={() => { void applyQuickRange(7); }} disabled={loading}>Weekly</Button>
                        <Button className="w-full sm:w-auto" variant="outline" onClick={() => { void applyQuickRange(30); }} disabled={loading}>Monthly</Button>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                <Card className="border-t-4 border-t-blue-500 shadow-sm">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                                <Calendar className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <p className="font-medium">Registrations</p>
                                <p className="text-sm text-muted-foreground">Selected range</p>
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-blue-600 mt-4">{totals.registrationsTotal}</p>
                        <Badge variant="outline" className="mt-2">Users onboarded</Badge>
                    </CardContent>
                </Card>

                <Card className="border-t-4 border-t-blue-500 shadow-sm">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                                <Calendar className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <p className="font-medium">Room Posts</p>
                                <p className="text-sm text-muted-foreground">Selected range</p>
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-blue-600 mt-4">{totals.roomsTotal}</p>
                        <Badge variant="outline" className="mt-2">Rooms listed</Badge>
                    </CardContent>
                </Card>

                <Card className="border-t-4 border-t-blue-500 shadow-sm">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                                <Calendar className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <p className="font-medium">Expenses</p>
                                <p className="text-sm text-muted-foreground">Selected range</p>
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-blue-600 mt-4">₹{Number(totals.expensesTotal).toLocaleString()}</p>
                        <Badge variant="outline" className="mt-2">Total cost</Badge>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-6">
                {(reportType === 'all' || reportType === 'registrations') &&
                    renderReportTable('Registrations Report', reports.registrations || [])}

                {(reportType === 'all' || reportType === 'rooms') &&
                    renderReportTable('Rooms Report', reports.rooms || [])}

                {(reportType === 'all' || reportType === 'expenses') &&
                    renderReportTable('Expenses Report', reports.expenses || [], true)}
            </div>

            <Card>
                <CardContent className="p-4">
                    <Button
                        className="w-full sm:w-auto"
                        variant="outline"
                        onClick={() => {
                            const payload = {
                                generatedAt: new Date().toISOString(),
                                filters: {
                                    type: reportType,
                                    startDate: dateRange.start,
                                    endDate: dateRange.end
                                },
                                data: reports
                            };

                            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
                            const link = document.createElement('a');
                            const url = URL.createObjectURL(blob);
                            link.href = url;
                            link.download = `admin-report-${reportType}-${dateRange.start}-to-${dateRange.end}.json`;
                            link.click();
                            URL.revokeObjectURL(url);
                        }}
                    >
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Download Full Report (JSON)
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
};

export default AdminReportsPage;
