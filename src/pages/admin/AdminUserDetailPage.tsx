import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    ArrowLeft,
    User,
    Mail,
    Phone,
    MapPin,
    Calendar,
    Clock,
    Home,
    Shield,
    Loader2,
    RefreshCw,
} from 'lucide-react';
import type { User as UserType } from '@/types';
import { getUserDetails, updateUserStatus } from '@/services/adminService';
import { getMediaAssetUrl } from '@/lib/utils';
import { toast } from 'sonner';

interface UserDetail extends UserType {
    rooms: Array<{
        room_id: string;
        title: string;
        listing_type: string;
        status: string;
        post_date: string;
        views_count: number;
    }>;
}

const getStatusColor = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (status === 'Active') return 'default';
    if (status === 'Inactive') return 'secondary';
    if (status === 'Suspended') return 'destructive';
    return 'outline';
};

const getRoleBadgeColor = (role: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (role === 'Admin') return 'destructive';
    if (role === 'Broker') return 'default';
    if (role === 'Member') return 'secondary';
    return 'outline';
};

const AdminUserDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);

    const fetchUser = async () => {
        if (!id) return;
        try {
            setLoading(true);
            const data = await getUserDetails(id) as UserDetail;
            setUserDetail(data);
        } catch {
            toast.error('Failed to load user details');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void fetchUser();
    }, [id]);

    const handleStatusChange = async (status: string) => {
        if (!id || !userDetail) return;
        try {
            setUpdating(true);
            await updateUserStatus(id, status);
            setUserDetail((prev) => prev ? { ...prev, status: status as UserType['status'] } : prev);
            toast.success(`Status updated to ${status}`);
        } catch {
            toast.error('Failed to update status');
        } finally {
            setUpdating(false);
        }
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    };

    if (loading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
                    <p className="text-slate-500 font-medium">Loading user details...</p>
                </div>
            </div>
        );
    }

    if (!userDetail) {
        return (
            <div className="flex h-96 flex-col items-center justify-center gap-4">
                <p className="text-slate-600 text-lg">User not found.</p>
                <Button onClick={() => navigate('/admin/users')}>
                    <ArrowLeft className="h-4 w-4 mr-2" />Back to Users
                </Button>
            </div>
        );
    }

    const avatarUrl = getMediaAssetUrl(userDetail.profile_image);

    return (
        <div className="space-y-6 p-3 sm:p-6 bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 min-h-screen">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="outline" size="sm" onClick={() => navigate('/admin/users')}>
                    <ArrowLeft className="h-4 w-4 mr-2" />Back
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-blue-600 bg-clip-text text-transparent">
                        User Detail
                    </h1>
                    <p className="text-muted-foreground text-sm mt-0.5">{userDetail.unique_id}</p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void fetchUser()}
                    disabled={loading}
                >
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
                {/* Profile Card */}
                <Card className="shadow-md border-0 bg-white self-start">
                    <CardContent className="pt-8 pb-6 flex flex-col items-center text-center gap-4">
                        {/* Avatar */}
                        <div className="relative w-24 h-24 rounded-full overflow-hidden ring-4 ring-blue-100">
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-3xl font-bold">
                                {userDetail.name.charAt(0).toUpperCase()}
                            </div>
                            {avatarUrl && (
                                <img
                                    src={avatarUrl}
                                    alt={userDetail.name}
                                    className="absolute inset-0 w-full h-full object-cover"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                            )}
                        </div>

                        <div>
                            <h2 className="text-xl font-bold text-slate-900">{userDetail.name}</h2>
                            <p className="text-sm text-slate-500 mt-0.5">{userDetail.email}</p>
                        </div>

                        <div className="flex flex-wrap gap-2 justify-center">
                            <Badge variant={getRoleBadgeColor(userDetail.role)}>{userDetail.role}</Badge>
                            <Badge variant={getStatusColor(userDetail.status)}>{userDetail.status}</Badge>
                            {userDetail.role === 'Broker' && userDetail.broker_status && (
                                <Badge variant={userDetail.broker_status === 'Approved' ? 'default' : 'secondary'}>
                                    {userDetail.broker_status}
                                </Badge>
                            )}
                        </div>

                        {/* Status Change */}
                        <div className="w-full pt-2 border-t border-slate-100">
                            <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">Change Status</p>
                            <Select
                                value={userDetail.status}
                                onValueChange={handleStatusChange}
                                disabled={updating}
                            >
                                <SelectTrigger className="w-full">
                                    {updating ? (
                                        <span className="flex items-center gap-2">
                                            <Loader2 className="h-3 w-3 animate-spin" />Updating...
                                        </span>
                                    ) : (
                                        <SelectValue />
                                    )}
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Active">Active</SelectItem>
                                    <SelectItem value="Inactive">Inactive</SelectItem>
                                    <SelectItem value="Suspended">Suspended</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Details */}
                <div className="space-y-6">
                    {/* Personal Info */}
                    <Card className="shadow-md border-0 bg-white">
                        <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-blue-50/50 pb-3">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <User className="h-4 w-4 text-blue-600" />Personal Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-5 grid gap-4 sm:grid-cols-2">
                            <InfoRow icon={<User className="h-4 w-4" />} label="Full Name" value={userDetail.name} />
                            <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={userDetail.email} />
                            <InfoRow icon={<Phone className="h-4 w-4" />} label="Contact" value={userDetail.contact || 'N/A'} />
                            <InfoRow icon={<Shield className="h-4 w-4" />} label="Gender" value={userDetail.gender || 'N/A'} />
                            <InfoRow icon={<MapPin className="h-4 w-4" />} label="Pincode" value={userDetail.pincode || 'N/A'} />
                            <InfoRow icon={<Calendar className="h-4 w-4" />} label="Registered" value={formatDate(userDetail.registration_date)} />
                            <InfoRow icon={<Clock className="h-4 w-4" />} label="Last Login" value={formatDate(userDetail.last_login)} />
                            {userDetail.role === 'Broker' && (
                                <InfoRow icon={<MapPin className="h-4 w-4" />} label="Broker Area" value={userDetail.broker_area || 'N/A'} />
                            )}
                        </CardContent>
                    </Card>

                    {/* Listings */}
                    <Card className="shadow-md border-0 bg-white">
                        <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-blue-50/50 pb-3">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <Home className="h-4 w-4 text-blue-600" />
                                Listings
                                <span className="ml-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-bold">
                                    {userDetail.rooms?.length ?? 0}
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {!userDetail.rooms || userDetail.rooms.length === 0 ? (
                                <div className="py-10 text-center text-slate-400">
                                    <Home className="h-10 w-10 mx-auto mb-2 opacity-40" />
                                    <p className="text-sm">No listings posted yet</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {userDetail.rooms.map((room) => (
                                        <div
                                            key={room.room_id}
                                            className="flex items-center justify-between px-5 py-3 hover:bg-blue-50/40 transition-colors cursor-pointer"
                                            onClick={() => navigate(`/admin/rooms/${room.room_id}`)}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <p className="font-medium text-sm text-slate-800 truncate">{room.title}</p>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    {room.listing_type} • Posted {formatDate(room.post_date)} • {room.views_count ?? 0} views
                                                </p>
                                            </div>
                                            <Badge
                                                variant={room.status === 'Approved' ? 'default' : room.status === 'Pending' ? 'secondary' : 'destructive'}
                                                className="ml-3 flex-shrink-0 text-xs"
                                            >
                                                {room.status}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

const InfoRow: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
    <div className="flex items-start gap-3">
        <span className="mt-0.5 text-slate-400 flex-shrink-0">{icon}</span>
        <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
            <p className="text-sm font-semibold text-slate-800 break-all">{value}</p>
        </div>
    </div>
);

export default AdminUserDetailPage;
