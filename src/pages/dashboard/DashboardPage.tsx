import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Building2,
    Wallet,
    Users,
    MessageSquare,
    Plus,
    ArrowRight,
    TrendingUp,
    Eye
} from 'lucide-react';
import type { Room, Expense } from '@/types';
import { getMyRooms } from '@/services/roomService';
import { getExpenses, getExpenseStats } from '@/services/expenseService';
import { getGroups } from '@/services/roommateService';
import { getUnreadCount } from '@/services/chatService';
import { getFirstImage } from '@/lib/utils';
import { toast } from 'sonner';

const DashboardPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [rooms, setRooms] = useState<Room[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [stats, setStats] = useState({
        totalRooms: 0,
        approvedRooms: 0,
        pendingRooms: 0,
        totalExpenses: 0,
        pendingAmount: 0,
        unreadMessages: 0
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [roomsData, expensesData, groupsData, unreadData] = await Promise.all([
                    getMyRooms(),
                    getExpenses({ limit: 5 }),
                    getGroups(),
                    getUnreadCount()
                ]);

                const expenseStatsData = await getExpenseStats();

                const sortedExpenses = [...expensesData.data].sort((first, second) => {
                    const firstTime = new Date(first.expense_date || first.created_at || 0).getTime();
                    const secondTime = new Date(second.expense_date || second.created_at || 0).getTime();
                    return secondTime - firstTime;
                });

                setRooms(roomsData.data.slice(0, 3));
                setExpenses(sortedExpenses);
                setGroups(groupsData);

                setStats({
                    totalRooms: roomsData.pagination.totalItems,
                    approvedRooms: roomsData.data.filter(r => r.status === 'Approved').length,
                    pendingRooms: roomsData.data.filter(r => r.status === 'Pending').length,
                    totalExpenses: Number(expenseStatsData.summary.total_amount || 0),
                    pendingAmount: Number(expenseStatsData.summary.pending_amount || 0),
                    unreadMessages: unreadData.unreadCount
                });
            } catch (error) {
                toast.error('Failed to load dashboard data');
            }
        };

        fetchData();

        // Listen for message events to refresh unread count
        const handleMessageEvent = () => {
            fetchData();
        };

        window.addEventListener('chat:message-received', handleMessageEvent);
        window.addEventListener('chat:messages-read', handleMessageEvent);

        return () => {
            window.removeEventListener('chat:message-received', handleMessageEvent);
            window.removeEventListener('chat:messages-read', handleMessageEvent);
        };
    }, []);

    const statCards = [
        {
            title: 'My Rooms',
            value: stats.totalRooms,
            subtitle: `${stats.approvedRooms} approved, ${stats.pendingRooms} pending`,
            icon: Building2,
            color: 'bg-blue-500',
            link: '/dashboard/rooms'
        },
        {
            title: 'Total Expenses',
            value: `₹${stats.totalExpenses.toLocaleString()}`,
            subtitle: `₹${stats.pendingAmount.toLocaleString()} pending`,
            icon: Wallet,
            color: 'bg-green-500',
            link: '/dashboard/expenses'
        },
        {
            title: 'Roommate Groups',
            value: groups.length,
            subtitle: 'Active groups',
            icon: Users,
            color: 'bg-blue-500',
            link: '/dashboard/roommates'
        },
        {
            title: 'Messages',
            value: stats.unreadMessages,
            subtitle: 'Unread messages',
            icon: MessageSquare,
            color: 'bg-orange-500',
            link: '/dashboard/chat'
        }
    ];

    return (
        <div className="space-y-6">
            {/* Welcome Section */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Welcome back, {user?.name}!</h1>
                    <p className="text-muted-foreground">Here's what's happening with your account</p>
                </div>
                <Button onClick={() => navigate('/dashboard/rooms/post')}>
                    <Plus className="w-4 h-4 mr-2" />
                    Post Room
                </Button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                {statCards.map((stat, index) => (
                    <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => navigate(stat.link)}>
                        <CardContent className="p-3 sm:p-6">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-xs sm:text-sm text-muted-foreground">{stat.title}</p>
                                    <p className="text-lg sm:text-2xl font-bold mt-1">{stat.value}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
                                </div>
                                <div className={`w-8 h-8 sm:w-10 sm:h-10 ${stat.color} rounded-lg flex items-center justify-center`}>
                                    <stat.icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Recent Rooms */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Recent Rooms</CardTitle>
                        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/rooms')}>
                            View All
                            <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {rooms.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p>No rooms posted yet</p>
                                <Button variant="outline" className="mt-4" onClick={() => navigate('/dashboard/rooms/post')}>
                                    Post Your First Room
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {rooms.map((room) => (
                                    <div key={room.room_id} 
                                         className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                                         onClick={() => navigate(`/room/${room.room_id}`)}>
                                        <div className="flex items-center gap-4">
                                            <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                                                {getFirstImage(room.images) ? (
                                                    <img src={getFirstImage(room.images)} alt={room.title} className="w-full h-full object-cover" />
                                                ) : (
                                                    <Building2 className="w-6 h-6 text-muted-foreground" />
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-medium line-clamp-1">{room.title}</p>
                                                <p className="text-sm text-muted-foreground">{room.area}, {room.city}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Badge variant={room.status === 'Approved' ? 'default' : 'secondary'}>
                                                        {room.status}
                                                    </Badge>
                                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <Eye className="w-3 h-3" />
                                                        {room.views_count}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-primary">
                                                ₹{room.rent?.toLocaleString() || room.cost?.toLocaleString()}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {room.rent ? '/month' : 'one-time'}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Recent Expenses */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Recent Expenses</CardTitle>
                        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/expenses')}>
                            View All
                            <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {expenses.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <Wallet className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p>No expenses recorded yet</p>
                                <Button variant="outline" className="mt-4" onClick={() => navigate('/dashboard/expenses')}>
                                    Add Expense
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {expenses.slice(0, 5).map((expense) => (
                                    <div key={expense.expense_id} 
                                         className="flex items-center justify-between p-4 border rounded-lg">
                                        <div>
                                            <p className="font-medium">{expense.title}</p>
                                            <p className="text-sm text-muted-foreground">
                                                Paid by {expense.paid_by_name} • {new Date(expense.expense_date).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold">₹{expense.cost.toLocaleString()}</p>
                                            <Badge variant={expense.is_settled ? 'default' : 'secondary'}>
                                                {expense.is_settled ? 'Settled' : 'Pending'}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Quick Actions */}
            <Card>
                <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <Button variant="outline" className="h-auto py-6 flex flex-col items-center gap-2"
                                onClick={() => navigate('/dashboard/rooms/post')}>
                            <Plus className="w-6 h-6" />
                            <span>Post Room</span>
                        </Button>
                        <Button variant="outline" className="h-auto py-6 flex flex-col items-center gap-2"
                                onClick={() => navigate('/dashboard/expenses')}>
                            <TrendingUp className="w-6 h-6" />
                            <span>Add Expense</span>
                        </Button>
                        <Button variant="outline" className="h-auto py-6 flex flex-col items-center gap-2"
                                onClick={() => navigate('/dashboard/roommates')}>
                            <Users className="w-6 h-6" />
                            <span>Manage Roommates</span>
                        </Button>
                        <Button variant="outline" className="h-auto py-6 flex flex-col items-center gap-2"
                                onClick={() => navigate('/dashboard/chat')}>
                            <MessageSquare className="w-6 h-6" />
                            <span>Messages</span>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default DashboardPage;
