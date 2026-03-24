import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, UserCheck, UserMinus, UserX, Users, RefreshCw, Eye, Loader2 } from 'lucide-react';
import type { User } from '@/types';
import { getAllUsers, updateUserStatus, getUserStats } from '@/services/adminService';
import { toast } from 'sonner';

interface UserStats {
	all: number;
	active: number;
	inactive: number;
	suspended: number;
}

const getStatusColor = (status: string) => {
	switch (status) {
		case 'Active':
			return 'default';
		case 'Inactive':
			return 'secondary';
		case 'Suspended':
			return 'destructive';
		default:
			return 'outline';
	}
};

const getRoleBadgeColor = (role: string) => {
	switch (role) {
		case 'Admin':
			return 'destructive';
		case 'Broker':
			return 'default';
		case 'Member':
			return 'secondary';
		default:
			return 'outline';
	}
};

const AdminUsersPage: React.FC = () => {
	const navigate = useNavigate();
	const [users, setUsers] = useState<User[]>([]);
	const [stats, setStats] = useState<UserStats | null>(null);
	const [filters, setFilters] = useState({ role: 'all', status: 'all', search: '' });
	const [loading, setLoading] = useState(false);
	const [processingUserId, setProcessingUserId] = useState<string | null>(null);

	useEffect(() => {
		void fetchUsers();
		void fetchStats();
	}, [filters]);

	const fetchStats = async () => {
		try {
			const data = await getUserStats();
			setStats(data);
		} catch {
		}
	};

	const fetchUsers = async () => {
		try {
			setLoading(true);
			const apiFilters = {
				role: filters.role === 'all' ? '' : filters.role,
				status: filters.status === 'all' ? '' : filters.status,
				search: filters.search,
			};
			const data = await getAllUsers(apiFilters);
			setUsers(data.data);
		} catch {
			toast.error('Failed to load users');
		} finally {
			setLoading(false);
		}
	};

	const handleStatusChange = async (userId: string, status: string) => {
		try {
			setProcessingUserId(userId);
			await updateUserStatus(userId, status);
			toast.success(`User status changed to ${status}`);
			await fetchUsers();
			await fetchStats();
		} catch {
			toast.error('Failed to update status');
		} finally {
			setProcessingUserId(null);
		}
	};

	return (
		<div className="space-y-6 p-3 sm:p-6 bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 min-h-screen">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-blue-600 bg-clip-text text-transparent">
						User Management
					</h1>
					<p className="text-muted-foreground mt-2 text-base">Manage and monitor all platform users</p>
				</div>
				<Button
					onClick={() => {
						void fetchUsers();
						void fetchStats();
					}}
					variant="outline"
					disabled={loading}
					className="w-full sm:w-auto shadow-sm"
				>
					<RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
					Refresh
				</Button>
			</div>

			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				<Card className="cursor-pointer border-t-4 border-t-blue-500" onClick={() => setFilters({ ...filters, status: 'all' })}>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-semibold text-slate-700">All Users</CardTitle>
						<div className="p-2 bg-blue-100 rounded-lg"><Users className="h-5 w-5 text-blue-600" /></div>
					</CardHeader>
					<CardContent>
						<div className="text-4xl font-bold text-blue-600 mb-1">{stats?.all || 0}</div>
						<p className="text-xs text-slate-500 font-medium">Total registered users</p>
					</CardContent>
				</Card>

				<Card className="cursor-pointer border-t-4 border-t-green-500" onClick={() => setFilters({ ...filters, status: 'Active' })}>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-semibold text-slate-700">Active</CardTitle>
						<div className="p-2 bg-blue-100 rounded-lg"><UserCheck className="h-5 w-5 text-blue-600" /></div>
					</CardHeader>
					<CardContent>
						<div className="text-4xl font-bold text-blue-600 mb-1">{stats?.active || 0}</div>
						<p className="text-xs text-slate-500 font-medium">Currently active users</p>
					</CardContent>
				</Card>

				<Card className="cursor-pointer border-t-4 border-t-gray-500" onClick={() => setFilters({ ...filters, status: 'Inactive' })}>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-semibold text-slate-700">Inactive</CardTitle>
						<div className="p-2 bg-gray-100 rounded-lg"><UserMinus className="h-5 w-5 text-gray-600" /></div>
					</CardHeader>
					<CardContent>
						<div className="text-4xl font-bold text-gray-600 mb-1">{stats?.inactive || 0}</div>
						<p className="text-xs text-slate-500 font-medium">Inactive accounts</p>
					</CardContent>
				</Card>

				<Card className="cursor-pointer border-t-4 border-t-red-500" onClick={() => setFilters({ ...filters, status: 'Suspended' })}>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-semibold text-slate-700">Suspended</CardTitle>
						<div className="p-2 bg-red-100 rounded-lg"><UserX className="h-5 w-5 text-red-600" /></div>
					</CardHeader>
					<CardContent>
						<div className="text-4xl font-bold text-red-600 mb-1">{stats?.suspended || 0}</div>
						<p className="text-xs text-slate-500 font-medium">Suspended accounts</p>
					</CardContent>
				</Card>
			</div>

			<Card className="shadow-lg border-0 bg-white">
				<CardHeader className="border-b bg-gradient-to-r from-slate-50 to-blue-50/50">
					<CardTitle className="text-xl font-semibold">Search & Filter</CardTitle>
					<CardDescription>Find users by role, status, or search terms</CardDescription>
				</CardHeader>
				<CardContent className="pt-6">
					<div className="grid gap-4 lg:grid-cols-[1.2fr_220px_220px]">
						<div className="relative">
							<Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
							<Input
								placeholder="Search by name, email, ID or contact..."
								className="pl-10"
								value={filters.search}
								onChange={(e) => setFilters({ ...filters, search: e.target.value })}
							/>
						</div>
						<Select value={filters.role} onValueChange={(value) => setFilters({ ...filters, role: value })}>
							<SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Roles</SelectItem>
								<SelectItem value="Member">Member</SelectItem>
								<SelectItem value="Broker">Broker</SelectItem>
								<SelectItem value="Admin">Admin</SelectItem>
							</SelectContent>
						</Select>
						<Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
							<SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Status</SelectItem>
								<SelectItem value="Active">Active</SelectItem>
								<SelectItem value="Inactive">Inactive</SelectItem>
								<SelectItem value="Suspended">Suspended</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</CardContent>
			</Card>

			<Card className="shadow-lg border-0 bg-white">
				<CardHeader className="border-b bg-gradient-to-r from-slate-50 to-blue-50/50">
					<CardTitle className="text-xl font-semibold">Users Directory</CardTitle>
					<CardDescription>
						{loading ? (
							<span className="flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" />Loading users...</span>
						) : (
							<span className="font-medium text-slate-600">{users.length} user{users.length !== 1 ? 's' : ''} found</span>
						)}
					</CardDescription>
				</CardHeader>
				<CardContent className="p-0">
					{loading ? (
						<div className="flex h-64 flex-col items-center justify-center gap-4">
							<Loader2 className="h-12 w-12 animate-spin text-blue-600" />
							<p className="text-slate-500 font-medium">Loading users data...</p>
						</div>
					) : users.length === 0 ? (
						<div className="flex h-64 flex-col items-center justify-center gap-4">
							<div className="p-4 bg-slate-100 rounded-full"><Users className="h-12 w-12 text-slate-400" /></div>
							<div className="text-center">
								<p className="text-lg font-semibold text-slate-700 mb-1">No users found</p>
								<p className="text-sm text-slate-500">Try adjusting your filters or search terms</p>
							</div>
						</div>
					) : (
						<>
							<div className="grid gap-4 p-4 lg:hidden">
								{users.map((user) => (
									<Card key={`mobile-user-${user.id}`} className="border border-slate-200 py-0 shadow-sm">
										<CardContent className="space-y-4 p-4">
											<div className="flex items-start justify-between gap-3">
												<div className="min-w-0">
													<p className="font-semibold text-slate-900">{user.name}</p>
													<p className="text-sm text-slate-600 break-all">{user.email}</p>
												</div>
												<Badge variant={getStatusColor(user.status)}>{user.status}</Badge>
											</div>
											<div className="flex flex-wrap gap-2">
												<Badge variant={getRoleBadgeColor(user.role)}>{user.role}</Badge>
												<Badge variant="outline" className="font-mono text-xs">{user.unique_id}</Badge>
												{user.role === 'Broker' && user.broker_status ? (
													<Badge variant={user.broker_status === 'Approved' ? 'default' : 'secondary'}>{user.broker_status}</Badge>
												) : null}
											</div>
											<div className="grid gap-2 text-sm sm:grid-cols-2">
												<div><span className="text-slate-500">Contact:</span> {user.contact || 'N/A'}</div>
												<div><span className="text-slate-500">Role:</span> {user.role}</div>
											</div>
											<div className="grid gap-2 sm:grid-cols-[1fr_auto]">
												<Select value={user.status} onValueChange={(value) => handleStatusChange(String(user.id), value)} disabled={processingUserId === String(user.id)}>
													<SelectTrigger disabled={processingUserId === String(user.id)}>
														{processingUserId === String(user.id) ? (
															<span className="flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" />Updating...</span>
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
												<Button variant="outline" onClick={() => navigate(`/admin/users/${user.id}`)}>
													<Eye className="h-4 w-4 mr-2" />View
												</Button>
											</div>
										</CardContent>
									</Card>
								))}
							</div>

							<div className="hidden overflow-x-auto lg:block">
								<Table>
									<TableHeader>
										<TableRow className="bg-slate-50/50 hover:bg-slate-50/80">
											<TableHead className="font-semibold text-slate-700">ID</TableHead>
											<TableHead className="font-semibold text-slate-700">Name</TableHead>
											<TableHead className="font-semibold text-slate-700">Email</TableHead>
											<TableHead className="font-semibold text-slate-700">Contact</TableHead>
											<TableHead className="font-semibold text-slate-700">Role</TableHead>
											<TableHead className="font-semibold text-slate-700">Status</TableHead>
											<TableHead className="font-semibold text-slate-700">Broker Status</TableHead>
											<TableHead className="font-semibold text-slate-700">Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{users.map((user) => (
											<TableRow key={user.id} className="hover:bg-blue-50/50 transition-colors duration-200">
												<TableCell className="font-medium text-slate-700"><span className="px-2 py-1 bg-slate-100 rounded text-xs font-mono">{user.unique_id}</span></TableCell>
												<TableCell className="font-medium text-slate-800">{user.name}</TableCell>
												<TableCell className="text-slate-600">{user.email}</TableCell>
												<TableCell className="text-slate-600">{user.contact || 'N/A'}</TableCell>
												<TableCell><Badge variant={getRoleBadgeColor(user.role)} className="font-medium shadow-sm">{user.role}</Badge></TableCell>
												<TableCell><Badge variant={getStatusColor(user.status)} className="font-medium shadow-sm">{user.status}</Badge></TableCell>
												<TableCell>
													{user.role === 'Broker' ? (
														<Badge variant={user.broker_status === 'Approved' ? 'default' : 'secondary'} className="font-medium shadow-sm">{user.broker_status || 'N/A'}</Badge>
													) : (
														<span className="text-slate-400 text-sm">-</span>
													)}
												</TableCell>
												<TableCell>
													<div className="flex gap-2">
														<Select value={user.status} onValueChange={(value) => handleStatusChange(String(user.id), value)} disabled={processingUserId === String(user.id)}>
															<SelectTrigger className="w-32" disabled={processingUserId === String(user.id)}>
																{processingUserId === String(user.id) ? (
																	<span className="flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /><span>Updating...</span></span>
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
														<Button variant="outline" size="sm" onClick={() => navigate(`/admin/users/${user.id}`)}>
															<Eye className="h-4 w-4 mr-1" />View
														</Button>
													</div>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						</>
					)}
				</CardContent>
			</Card>
		</div>
	);
};

export default AdminUsersPage;