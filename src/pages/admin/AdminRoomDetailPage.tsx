import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    ArrowLeft,
    MapPin,
    Calendar,
    Home,
    IndianRupee,
    User,
    Phone,
    Mail,
    Eye,
    CheckCircle2,
    XCircle,
    Pause,
    Clock,
    Image as ImageIcon,
} from 'lucide-react';
import type { Room } from '@/types';
import { getRoomDetails, updateRoomStatus } from '@/services/adminService';
import { getMediaAssetUrl, getProfileImageUrl, parseImages } from '@/lib/utils';
import { toast } from 'sonner';

const AdminRoomDetailPage: React.FC = () => {
    const { roomId } = useParams<{ roomId: string }>();
    const navigate = useNavigate();
    const [room, setRoom] = useState<Room | null>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState<string>('');
    const [remark, setRemark] = useState('');

    useEffect(() => {
        if (roomId) {
            fetchRoomDetails();
        }
    }, [roomId]);

    const fetchRoomDetails = async () => {
        if (!roomId) return;

        try {
            setLoading(true);
            const data = await getRoomDetails(roomId);
            
            // Room data received
            
            // Normalize data - ensure arrays are actual arrays
            const normalizedData = {
                ...data,
                facilities: Array.isArray(data.facilities) 
                    ? data.facilities 
                    : (typeof data.facilities === 'string' && data.facilities 
                        ? (data.facilities as string).split(',').map((f: string) => f.trim()) 
                        : []),
                // Use parseImages utility to properly parse JSON array from database
                images: parseImages(data.images).map((img) => getMediaAssetUrl(img)),
                existing_roommates: Array.isArray(data.existing_roommates) 
                    ? data.existing_roommates 
                    : []
            };
            
            // Data normalized
            
            setRoom(normalizedData);
            setSelectedStatus(normalizedData.status);
            setRemark(normalizedData.admin_remark || '');
        } catch (error) {
            console.error('Error loading room details:', error);
            toast.error('Failed to load room details');
            navigate('/admin/rooms');
        } finally {
            setLoading(false);
        }
    };

    const handleStatusUpdate = async () => {
        if (!room || !selectedStatus) return;

        if (selectedStatus === room.status && remark === (room.admin_remark || '')) {
            toast.info('No changes to update');
            return;
        }

        try {
            setProcessing(true);
            await updateRoomStatus(room.room_id, selectedStatus, remark);
            toast.success('Room status updated successfully');
            await fetchRoomDetails();
        } catch (error) {
            toast.error('Failed to update room status');
        } finally {
            setProcessing(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Approved': return 'default';
            case 'Pending': return 'secondary';
            case 'Hold': return 'outline';
            case 'Rejected': return 'destructive';
            case 'Expired': return 'destructive';
            default: return 'outline';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'Approved': return <CheckCircle2 className="w-4 h-4" />;
            case 'Pending': return <Clock className="w-4 h-4" />;
            case 'Hold': return <Pause className="w-4 h-4" />;
            case 'Rejected': return <XCircle className="w-4 h-4" />;
            default: return <Clock className="w-4 h-4" />;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading room details...</p>
                </div>
            </div>
        );
    }

    if (!room) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <p className="text-muted-foreground">Room not found</p>
                    <Button onClick={() => navigate('/admin/rooms')} className="mt-4">
                        Back to Rooms
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate('/admin/rooms')}
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">Room Details</h1>
                        <p className="text-sm text-muted-foreground">ID: {room.room_id}</p>
                    </div>
                </div>
                <Badge variant={getStatusColor(room.status)} className="text-base px-4 py-2">
                    {getStatusIcon(room.status)}
                    <span className="ml-2">{room.status}</span>
                </Badge>
            </div>

            {/* Main Content - Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Room Details */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Basic Information */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Basic Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <h3 className="text-xl font-semibold mb-2">{room.title}</h3>
                                <div className="flex flex-wrap gap-2">
                                    <Badge variant="outline">{room.listing_type}</Badge>
                                    <Badge variant="secondary">{room.room_type}</Badge>
                                    <Badge variant="outline">{room.house_type}</Badge>
                                    <Badge variant="outline">{room.furnishing_type}</Badge>
                                    {room.preferred_gender && (
                                        <Badge variant="outline">Preferred: {room.preferred_gender}</Badge>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                                <div className="flex items-start gap-2">
                                    <IndianRupee className="w-5 h-5 text-muted-foreground mt-0.5" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">
                                            {room.listing_type === 'For Sell' ? 'Cost' : 'Rent'}
                                        </p>
                                        <p className="text-lg font-semibold">
                                            ₹{(room.rent || room.cost || 0).toLocaleString()}
                                            {room.listing_type !== 'For Sell' && '/month'}
                                        </p>
                                        {room.deposit && (
                                            <p className="text-xs text-muted-foreground">
                                                Deposit: ₹{room.deposit.toLocaleString()}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-start gap-2">
                                    <Home className="w-5 h-5 text-muted-foreground mt-0.5" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Size</p>
                                        <p className="text-lg font-semibold">
                                            {room.size_sqft ? `${room.size_sqft} sq.ft` : 'N/A'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-2">
                                    <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Available From</p>
                                        <p className="font-medium">
                                            {new Date(room.availability_from).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-2">
                                    <Eye className="w-5 h-5 text-muted-foreground mt-0.5" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Views</p>
                                        <p className="font-medium">{room.views_count || 0}</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Location */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Location</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-start gap-2">
                                <MapPin className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                    <p className="font-medium">{room.address}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {room.area}, {room.city} - {room.pincode}
                                    </p>
                                    {room.latitude && room.longitude && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Coordinates: {Number(room.latitude).toFixed(6)}, {Number(room.longitude).toFixed(6)}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Facilities */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Facilities & Amenities ({room.facilities?.length || 0})</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {room.facilities && room.facilities.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {room.facilities.map((facility, index) => (
                                        <Badge key={index} variant="secondary">
                                            {facility}
                                        </Badge>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">No facilities listed</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Additional Notes */}
                    {room.note && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Additional Notes</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm whitespace-pre-wrap">{room.note}</p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Images */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ImageIcon className="w-5 h-5" />
                                Room Images ({room.images?.length || 0})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {room.images && room.images.length > 0 ? (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {room.images.map((image, index) => (
                                        <div
                                            key={index}
                                            className="relative aspect-video rounded-lg overflow-hidden border bg-muted"
                                        >
                                            <img
                                                src={image}
                                                alt={`Room ${index + 1}`}
                                                className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                                                onClick={() => window.open(image, '_blank')}
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    target.style.display = 'none';
                                                    const parent = target.parentElement;
                                                    if (parent && !parent.querySelector('.error-msg')) {
                                                        const errorDiv = document.createElement('div');
                                                        errorDiv.className = 'error-msg absolute inset-0 flex flex-col items-center justify-center bg-gray-100 text-gray-500 text-xs p-2';
                                                        errorDiv.innerHTML = `<span class="font-medium">Image unavailable</span><span class="text-[10px] mt-1 text-center break-all">${image}</span>`;
                                                        parent.appendChild(errorDiv);
                                                    }
                                                }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">No images uploaded</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Existing Roommates */}
                    {room.existing_roommates && room.existing_roommates.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Existing Roommates</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {room.existing_roommates.map((roommate, index) => (
                                        <div key={index} className="flex items-center gap-2 p-2 rounded-md bg-muted">
                                            <User className="w-4 h-4 text-muted-foreground" />
                                            <span className="font-medium">{roommate.name}</span>
                                            <span className="text-sm text-muted-foreground">from {roommate.city}</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Right Column - Owner & Actions */}
                <div className="space-y-6">
                    {/* Owner Details */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Owner Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-3">
                                {room.owner_profile_image ? (
                                    <img
                                        src={getProfileImageUrl(room.owner_profile_image)}
                                        alt={room.owner_name}
                                        className="w-12 h-12 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                        <User className="w-6 h-6 text-primary" />
                                    </div>
                                )}
                                <div>
                                    <p className="font-semibold">{room.owner_name || 'N/A'}</p>
                                    {room.owner_unique_id && (
                                        <p className="text-xs text-muted-foreground">ID: {room.owner_unique_id}</p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2 pt-2 border-t">
                                <div className="flex items-center gap-2">
                                    <Phone className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-sm">{room.owner_contact || room.contact}</span>
                                </div>
                                {room.owner_email && (
                                    <div className="flex items-center gap-2">
                                        <Mail className="w-4 h-4 text-muted-foreground" />
                                        <span className="text-sm">{room.owner_email}</span>
                                    </div>
                                )}
                                {room.email && room.email !== room.owner_email && (
                                    <div className="flex items-center gap-2">
                                        <Mail className="w-4 h-4 text-muted-foreground" />
                                        <span className="text-sm">{room.email}</span>
                                    </div>
                                )}
                            </div>

                            <div className="pt-2 border-t text-xs text-muted-foreground">
                                <p>Contact Visibility: {room.contact_visibility || 'Public'}</p>
                                <p>Occupied: {room.is_occupied ? 'Yes' : 'No'}</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Plan Details */}
                    {room.plan_type && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Plan Details</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <p className="font-medium">{room.plan_type}</p>
                                    {room.plan_amount && (
                                        <p className="text-sm text-muted-foreground">
                                            Amount: ₹{room.plan_amount.toLocaleString()}
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Status Update */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Update Status</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="text-sm font-medium mb-2 block">Status</label>
                                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Approved">
                                            <div className="flex items-center gap-2">
                                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                                                Approved
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="Pending">
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-4 h-4 text-orange-600" />
                                                Pending
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="Hold">
                                            <div className="flex items-center gap-2">
                                                <Pause className="w-4 h-4 text-blue-600" />
                                                Hold
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="Rejected">
                                            <div className="flex items-center gap-2">
                                                <XCircle className="w-4 h-4 text-red-600" />
                                                Rejected
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <label className="text-sm font-medium mb-2 block">Admin Remark</label>
                                <Textarea
                                    value={remark}
                                    onChange={(e) => setRemark(e.target.value)}
                                    placeholder="Add a remark (optional)"
                                    rows={4}
                                />
                            </div>

                            <Button
                                onClick={handleStatusUpdate}
                                disabled={processing}
                                className="w-full"
                            >
                                {processing ? 'Updating...' : 'Update Status'}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Timeline */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Timeline</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <div>
                                <p className="text-muted-foreground">Posted</p>
                                <p className="font-medium">
                                    {new Date(room.post_date).toLocaleString()}
                                </p>
                            </div>
                            {room.last_updated && (
                                <div className="pt-2 border-t">
                                    <p className="text-muted-foreground">Last Updated</p>
                                    <p className="font-medium">
                                        {new Date(room.last_updated).toLocaleString()}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default AdminRoomDetailPage;
