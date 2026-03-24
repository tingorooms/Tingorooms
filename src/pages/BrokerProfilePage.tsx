import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { 
    Building2, 
    MapPin, 
    Phone, 
    Mail, 
    Calendar, 
    MessageCircle, 
    ArrowLeft,
    Home,
    User
} from 'lucide-react';
import { getBrokerById, type PublicBroker } from '@/services/brokerService';
import { getRooms } from '@/services/roomService';
import type { Room } from '@/types';
import RoomCard from '@/components/rooms/RoomCard';
import { buildBrokerPath, buildWhatsAppUrl, getProfileImageUrl, normalizePhoneForWhatsApp } from '@/lib/utils';

const BrokerProfilePage: React.FC = () => {
    const { brokerId } = useParams<{ brokerId: string }>();
    const navigate = useNavigate();
    
    const [broker, setBroker] = useState<PublicBroker | null>(null);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [roomsLoading, setRoomsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchBrokerData = async () => {
            if (!brokerId) {
                setError('Invalid broker ID');
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError('');
                
                const brokerData = await getBrokerById(brokerId);
                setBroker(brokerData);

                const canonicalPath = buildBrokerPath(brokerData.unique_id || brokerData.id, brokerData.name);
                if (window.location.pathname !== canonicalPath) {
                    navigate(canonicalPath, { replace: true });
                }
            } catch (err) {
                setError('Broker not found or unavailable');
            } finally {
                setLoading(false);
            }
        };

        fetchBrokerData();
    }, [brokerId]);

    useEffect(() => {
        const fetchBrokerRooms = async () => {
            if (!brokerId) return;

            try {
                setRoomsLoading(true);
                
                const roomsResponse = await getRooms({
                    userId: parseInt(brokerId),
                    limit: 100
                });
                
                setRooms(roomsResponse.data);
            } catch (err) {
            } finally {
                setRoomsLoading(false);
            }
        };

        if (!loading && broker) {
            fetchBrokerRooms();
        }
    }, [brokerId, loading, broker]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 pt-0 pb-10 md:pt-0 md:pb-14\">
                <div className="max-w-screen-xl mx-auto px-3 md:px-[20px] space-y-6 md:space-y-8">
                    <Skeleton className="h-12 w-48" />
                    <Card>
                        <CardContent className="p-5 md:p-8">
                            <div className="flex flex-col md:flex-row items-center md:items-start gap-5 md:gap-6">
                                <Skeleton className="w-20 h-20 md:w-24 md:h-24 rounded-full" />
                                <div className="flex-1 space-y-4">
                                    <Skeleton className="h-8 w-64" />
                                    <Skeleton className="h-4 w-48" />
                                    <Skeleton className="h-4 w-32" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    if (error || !broker) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 pt-[30px] pb-10 md:pt-[30px] md:pb-14">
                <div className="max-w-screen-xl mx-auto px-3 md:px-[20px]">
                    <Button 
                        variant="ghost" 
                        onClick={() => navigate('/brokers')}
                        className="mb-6"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Brokers
                    </Button>
                    
                    <Card className="border-slate-200">
                        <CardContent className="p-8 text-center space-y-4">
                            <Building2 className="w-16 h-16 mx-auto text-slate-300" />
                            <h3 className="text-xl font-semibold text-slate-900">
                                {error || 'Broker Not Found'}
                            </h3>
                            <p className="text-sm text-slate-600">
                                The broker you're looking for doesn't exist or is no longer available.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                <Button variant="outline" onClick={() => navigate('/brokers')}>
                                    View All Brokers
                                </Button>
                                <Button onClick={() => navigate('/rooms')}>
                                    Browse Rooms
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    const phone = normalizePhoneForWhatsApp(broker.contact);
    const hasPhone = phone.length >= 10;
    const whatsappUrl = buildWhatsAppUrl(broker.contact);

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 pt-[30px] pb-10 md:pt-[30px] md:pb-14">
            <div className="max-w-screen-xl mx-auto px-3 md:px-[20px] space-y-6 md:space-y-8">
                {/* Back Button */}
                <Button 
                    variant="ghost" 
                    onClick={() => navigate('/brokers')}
                    className="hover:bg-green-50 w-fit"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Brokers
                </Button>

                {/* Broker Information Card */}
                <Card className="border-slate-200 shadow-sm">
                    <CardContent className="pt-0 md:pt-[10px] px-4 sm:px-6 lg:px-8 pb-6 md:pb-8">
                        <div className="flex flex-col md:flex-row items-center md:items-start gap-5 md:gap-8">
                            {/* Avatar */}
                            <Avatar className="w-20 h-20 md:w-24 md:h-24 border-4 border-blue-50 shrink-0">
                                <AvatarImage src={getProfileImageUrl(broker.profile_image)} alt={broker.name} />
                                <AvatarFallback className="bg-blue-500 text-white text-2xl font-bold">
                                    {broker.name?.slice(0, 2).toUpperCase() || 'BR'}
                                </AvatarFallback>
                            </Avatar>

                            {/* Broker Details */}
                            <div className="flex-1 space-y-4">
                                <div className="text-center md:text-left">
                                    <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2 break-words">{broker.name}</h1>
                                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3 text-slate-600">
                                        <div className="flex items-center gap-2">
                                            <User className="w-4 h-4" />
                                            <span className="text-sm truncate">ID: {broker.unique_id}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4" />
                                            <span className="text-sm">
                                                Member since {new Date(broker.registration_date).toLocaleDateString('en-US', { 
                                                    month: 'short', 
                                                    year: 'numeric' 
                                                })}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <MapPin className="w-4 h-4" />
                                            <span className="text-sm truncate">{broker.broker_area || 'Area not specified'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2 md:gap-3">
                                    <Badge variant="default" className="bg-blue-500 text-white px-4 py-1.5">
                                        <Building2 className="w-4 h-4 mr-1.5" />
                                        {broker.room_count || 0} Active Listings
                                    </Badge>
                                    <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100 px-4 py-1.5">
                                        Verified Broker
                                    </Badge>
                                </div>

                                {/* Contact Information */}
                                <div className="pt-4 border-t border-slate-100 space-y-3">
                                    <h3 className="font-semibold text-slate-900 mb-3">Contact Information</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="flex items-center gap-3 text-slate-600">
                                            <Phone className="w-5 h-5 text-blue-500" />
                                            <span>{broker.contact || 'Not available'}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-slate-600 break-all">
                                            <Mail className="w-5 h-5 text-blue-500" />
                                            <span className="truncate">{broker.email || 'Not available'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {hasPhone ? (
                                        <Button asChild size="lg" variant="outline" className="w-full">
                                            <a href={`tel:${phone}`}>
                                                <Phone className="w-4 h-4 mr-2" />
                                                Call Now
                                            </a>
                                        </Button>
                                    ) : (
                                        <Button size="lg" variant="outline" disabled className="w-full">
                                            <Phone className="w-4 h-4 mr-2" />
                                            Call Now
                                        </Button>
                                    )}
                                    {hasPhone ? (
                                        <Button asChild size="lg" className="bg-green-600 hover:bg-green-700 w-full">
                                            <a href={whatsappUrl || '#'} target="_blank" rel="noopener noreferrer">
                                                <MessageCircle className="w-4 h-4 mr-2" />
                                                WhatsApp
                                            </a>
                                        </Button>
                                    ) : (
                                        <Button size="lg" className="bg-green-600 hover:bg-green-700 w-full" disabled>
                                            <MessageCircle className="w-4 h-4 mr-2" />
                                            WhatsApp
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Listings Section */}
                <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                                <Home className="w-6 h-6 text-blue-500" />
                                Available Listings
                            </h2>
                            <p className="text-sm text-slate-600 mt-1">
                                Browse all properties listed by {broker.name}
                            </p>
                        </div>
                        {!roomsLoading && rooms.length > 0 && (
                            <Badge variant="secondary" className="text-sm md:text-base px-3 py-1.5 md:px-4 md:py-2 w-fit">
                                {rooms.length} {rooms.length === 1 ? 'Property' : 'Properties'}
                            </Badge>
                        )}
                    </div>

                    {roomsLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2, 3].map((i) => (
                                <Card key={i}>
                                    <CardContent className="p-6 space-y-4">
                                        <Skeleton className="h-48 w-full" />
                                        <Skeleton className="h-6 w-3/4" />
                                        <Skeleton className="h-4 w-1/2" />
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : rooms.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {rooms.map((room) => (
                                <RoomCard key={room.room_id} room={room} />
                            ))}
                        </div>
                    ) : (
                        <Card className="border-slate-200">
                            <CardContent className="p-12 text-center space-y-4">
                                <Home className="w-16 h-16 mx-auto text-slate-300" />
                                <h3 className="text-lg font-semibold text-slate-900">No Listings Available</h3>
                                <p className="text-sm text-slate-600">
                                    {broker.name} doesn't have any active listings at the moment.
                                </p>
                                <Button variant="outline" onClick={() => navigate('/rooms')}>
                                    Browse All Rooms
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BrokerProfilePage;
