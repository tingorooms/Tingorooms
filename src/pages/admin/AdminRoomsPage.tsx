import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Search, Eye, CheckCircle2, XCircle, Pause, Clock, Building2, MoreVertical, RefreshCw } from 'lucide-react';
import type { Room } from '@/types';
import { getAllRooms, updateRoomStatus, getRoomStats } from '@/services/adminService';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface RoomStats {
    approved_count: number;
    pending_count: number;
    hold_count: number;
    rejected_count: number;
    total_count: number;
}

const AdminRoomsPage: React.FC = () => {
    const navigate = useNavigate();
    const [rooms, setRooms] = useState<Room[]>([]);
    const [stats, setStats] = useState<RoomStats | null>(null);
    const [filters, setFilters] = useState({ status: 'all', listingType: 'all', search: '' });
    const [loading, setLoading] = useState(false);
    const [processingRoomId, setProcessingRoomId] = useState<string | null>(null);

    useEffect(() => {
        fetchRooms();
        fetchStats();
    }, [filters]);

    const fetchStats = async () => {
        try {
            const data = await getRoomStats();
            setStats(data);
        } catch (error) {
        }
    };

    const fetchRooms = async () => {
        try {
            setLoading(true);
            const apiFilters = {
                status: filters.status === 'all' ? '' : filters.status,
                listingType: filters.listingType === 'all' ? '' : filters.listingType,
                search: filters.search
            };
            const data = await getAllRooms(apiFilters);
            setRooms(data.data);
        } catch (error) {
            toast.error('Failed to load rooms');
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = async (roomId: string, status: string, currentStatus: string) => {
        if (currentStatus === status) {
            toast.info('Room already has this status');
            return;
        }

        try {
            setProcessingRoomId(roomId);
            await updateRoomStatus(roomId, status);
            toast.success(`Room status changed to ${status}`);
            await fetchRooms();
            await fetchStats();
        } catch (error) {
            toast.error('Failed to update status');
        } finally {
            setProcessingRoomId(null);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Approved': return 'default';
            case 'Pending': return 'secondary';
            case 'Hold': return 'outline';
            case 'Rejected': return 'destructive';
            default: return 'outline';
        }
    };

    return (
        <div className="space-y-6 p-3 sm:p-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Manage Rooms</h1>
                    <p className="text-muted-foreground mt-1">Manage room listings</p>
                </div>
                <Button onClick={() => { fetchRooms(); fetchStats(); }} variant="outline" size="sm" className="w-full sm:w-auto">
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Status Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card 
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => setFilters({ ...filters, status: 'Approved' })}
                >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Approved</CardTitle>
                        <CheckCircle2 className="h-5 w-5 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-600">{stats?.approved_count || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">Active listings</p>
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
                        <div className="text-3xl font-bold text-orange-600">{stats?.pending_count || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">Awaiting review</p>
                    </CardContent>
                </Card>

                <Card 
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => setFilters({ ...filters, status: 'Hold' })}
                >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Hold</CardTitle>
                        <Pause className="h-5 w-5 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-600">{stats?.hold_count || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">On hold</p>
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
                        <div className="text-3xl font-bold text-red-600">{stats?.rejected_count || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">Not approved</p>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="grid gap-4 lg:grid-cols-[1fr_160px_190px]">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                            <Input
                                placeholder="Search rooms by title, ID, or owner..."
                                className="pl-10"
                                value={filters.search}
                                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                            />
                        </div>
                        <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="All Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="Pending">Pending</SelectItem>
                                <SelectItem value="Approved">Approved</SelectItem>
                                <SelectItem value="Hold">Hold</SelectItem>
                                <SelectItem value="Rejected">Rejected</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={filters.listingType} onValueChange={(value) => setFilters({ ...filters, listingType: value })}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="All Types" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                <SelectItem value="For Rent">For Rent</SelectItem>
                                <SelectItem value="Required Roommate">Required Roommate</SelectItem>
                                <SelectItem value="For Sell">For Sell</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Rooms Table */}
            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : rooms.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <Building2 className="h-12 w-12 mb-4" />
                            <p className="text-lg font-medium">No rooms found</p>
                            <p className="text-sm">Try adjusting your filters</p>
                        </div>
                    ) : (
                        <>
                        <div className="grid gap-4 p-4 lg:hidden">
                            {rooms.map((room) => (
                                <Card key={`room-mobile-${room.room_id}`} className="py-0 shadow-sm">
                                    <CardContent className="space-y-4 p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="font-semibold text-slate-900 line-clamp-2">{room.title}</p>
                                                <p className="text-sm text-muted-foreground">{room.area}, {room.city}</p>
                                            </div>
                                            <Badge variant={getStatusColor(room.status)}>{room.status}</Badge>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <Badge variant="outline" className="text-xs">{room.room_id}</Badge>
                                            <Badge variant="outline" className="text-xs">{room.listing_type}</Badge>
                                            <Badge variant="secondary" className="text-xs">{room.room_type}</Badge>
                                        </div>
                                        <div className="grid gap-2 text-sm sm:grid-cols-2">
                                            <div><span className="text-muted-foreground">Owner:</span> {room.owner_name || 'N/A'}</div>
                                            <div><span className="text-muted-foreground">Contact:</span> {room.owner_contact || 'N/A'}</div>
                                            <div><span className="text-muted-foreground">Price:</span> ₹{room.rent?.toLocaleString() || room.cost?.toLocaleString() || '0'}</div>
                                            <div><span className="text-muted-foreground">Deposit:</span> {room.deposit ? `₹${room.deposit.toLocaleString()}` : 'N/A'}</div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <Button size="sm" variant="outline" onClick={() => navigate(`/admin/rooms/${room.room_id}`)}>
                                                <Eye className="w-4 h-4 mr-2" />
                                                View
                                            </Button>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button size="sm" variant="outline" disabled={processingRoomId === room.room_id}>
                                                        <MoreVertical className="w-4 h-4 mr-2" />
                                                        Actions
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => handleStatusChange(room.room_id, 'Approved', room.status)} disabled={room.status === 'Approved'}>
                                                        <CheckCircle2 className="w-4 h-4 mr-2 text-blue-600" />
                                                        <span>Approve</span>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleStatusChange(room.room_id, 'Pending', room.status)} disabled={room.status === 'Pending'}>
                                                        <Clock className="w-4 h-4 mr-2 text-orange-600" />
                                                        <span>Set Pending</span>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleStatusChange(room.room_id, 'Hold', room.status)} disabled={room.status === 'Hold'}>
                                                        <Pause className="w-4 h-4 mr-2 text-blue-600" />
                                                        <span>Hold</span>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleStatusChange(room.room_id, 'Rejected', room.status)} disabled={room.status === 'Rejected'}>
                                                        <XCircle className="w-4 h-4 mr-2 text-red-600" />
                                                        <span>Reject</span>
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                        <div className="hidden overflow-x-auto lg:block">
                            <table className="w-full">
                                <thead className="bg-muted">
                                    <tr>
                                        <th className="text-left p-4 font-semibold">Room</th>
                                        <th className="text-left p-4 font-semibold">Owner</th>
                                        <th className="text-left p-4 font-semibold">Type</th>
                                        <th className="text-left p-4 font-semibold">Price</th>
                                        <th className="text-left p-4 font-semibold">Status</th>
                                        <th className="text-left p-4 font-semibold">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rooms.map((room) => (
                                        <tr key={room.room_id} className="border-t hover:bg-muted/50 transition-colors">
                                            <td className="p-4">
                                                <div>
                                                    <p className="font-medium">{room.title}</p>
                                                    <p className="text-sm text-muted-foreground">{room.area}, {room.city}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        <Badge variant="outline" className="text-xs">{room.room_id}</Badge>
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <p className="font-medium">{room.owner_name}</p>
                                                <p className="text-sm text-muted-foreground">{room.owner_contact}</p>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-col gap-1">
                                                    <Badge variant="outline">{room.listing_type}</Badge>
                                                    <Badge variant="secondary" className="text-xs">{room.room_type}</Badge>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <p className="font-medium">
                                                    ₹{room.rent?.toLocaleString() || room.cost?.toLocaleString()}
                                                </p>
                                                {room.deposit && (
                                                    <p className="text-xs text-muted-foreground">
                                                        Deposit: ₹{room.deposit.toLocaleString()}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <Badge variant={getStatusColor(room.status)}>
                                                    {room.status}
                                                </Badge>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <Button 
                                                        size="sm" 
                                                        variant="outline"
                                                        onClick={() => navigate(`/admin/rooms/${room.room_id}`)}
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                    
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button 
                                                                size="sm" 
                                                                variant="outline"
                                                                disabled={processingRoomId === room.room_id}
                                                            >
                                                                <MoreVertical className="w-4 h-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                onClick={() => handleStatusChange(room.room_id, 'Approved', room.status)}
                                                                disabled={room.status === 'Approved'}
                                                            >
                                                                <CheckCircle2 className="w-4 h-4 mr-2 text-blue-600" />
                                                                <span>Approve</span>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onClick={() => handleStatusChange(room.room_id, 'Pending', room.status)}
                                                                disabled={room.status === 'Pending'}
                                                            >
                                                                <Clock className="w-4 h-4 mr-2 text-orange-600" />
                                                                <span>Set Pending</span>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onClick={() => handleStatusChange(room.room_id, 'Hold', room.status)}
                                                                disabled={room.status === 'Hold'}
                                                            >
                                                                <Pause className="w-4 h-4 mr-2 text-blue-600" />
                                                                <span>Hold</span>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onClick={() => handleStatusChange(room.room_id, 'Rejected', room.status)}
                                                                disabled={room.status === 'Rejected'}
                                                            >
                                                                <XCircle className="w-4 h-4 mr-2 text-red-600" />
                                                                <span>Reject</span>
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Summary Footer */}
            {rooms.length > 0 && (
                <div className="text-sm text-muted-foreground text-center">
                    Showing {rooms.length} of {stats?.total_count || 0} total rooms
                </div>
            )}
        </div>
    );
};

export default AdminRoomsPage;
