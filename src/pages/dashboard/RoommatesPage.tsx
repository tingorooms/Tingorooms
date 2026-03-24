import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Users, Trash2, LogOut, Eye, UserPlus, X, SquarePen } from 'lucide-react';
import type { RoommateGroup } from '@/types';
import { 
    getGroups, 
    createGroup, 
    addRoommate, 
    removeRoommate, 
    deleteGroup,
    leaveGroup,
    getGroupDetails,
    updateRoommateMember,
    updateGroupExpenseSettings,
} from '@/services/roommateService';
import { getProfileImageUrl } from '@/lib/utils';
import { toast } from 'sonner';

const RoommatesPage: React.FC = () => {
    const { user } = useAuth();
    const [groups, setGroups] = useState<RoommateGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Create Group Dialog
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [roommates, setRoommates] = useState<Array<{ name: string; email: string; contact: string; city: string }>>([
        { name: '', email: '', contact: '', city: '' }
    ]);
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);

    // Add Roommate Dialog
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [newRoommate, setNewRoommate] = useState({ name: '', email: '', contact: '', city: '' });
    const [isAddingRoommate, setIsAddingRoommate] = useState(false);

    // View Group Dialog
    const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState<RoommateGroup | null>(null);
    const [isLoadingGroupDetails, setIsLoadingGroupDetails] = useState(false);

    // Delete/Remove Dialog
    const [deleteDialog, setDeleteDialog] = useState<{ type: 'remove' | 'leave' | 'delete-group'; groupId: string; memberId?: number; groupName?: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [editMemberDialog, setEditMemberDialog] = useState<{ groupId: string; memberId: number } | null>(null);
    const [editMemberForm, setEditMemberForm] = useState({ name: '', email: '', contact: '', city: '' });
    const [isSavingMember, setIsSavingMember] = useState(false);
    const [editGroupDialog, setEditGroupDialog] = useState<{ groupId: string } | null>(null);
    const [editGroupName, setEditGroupName] = useState('');
    const [isSavingGroupName, setIsSavingGroupName] = useState(false);

    const getErrorMessage = (error: any, fallback: string) => {
        return error?.response?.data?.message || error?.message || fallback;
    };

    const hasInProgressLinkedExpenses = (group: RoommateGroup) => Number(group.ongoing_expense_count || 0) > 0;

    useEffect(() => {
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        try {
            setIsLoading(true);
            const data = await getGroups();
            setGroups(
                [...data].sort((first, second) => {
                    const firstTime = new Date(first.latest_created_at || 0).getTime();
                    const secondTime = new Date(second.latest_created_at || 0).getTime();
                    return secondTime - firstTime;
                })
            );
        } catch (error: any) {
            toast.error(getErrorMessage(error, 'Failed to load groups'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateGroup = async () => {
        try {
            // Validate
            if (!groupName.trim()) {
                toast.error('Please enter a room name');
                return;
            }

            const validRoommates = roommates.filter(r => r.name.trim() && r.email.trim());
            if (validRoommates.length === 0) {
                toast.error('Please add at least one roommate with name and email');
                return;
            }

            setIsCreatingGroup(true);
            await createGroup({
                groupName: groupName.trim(),
                roommates: validRoommates
            });

            toast.success('Group created successfully! Invitations sent to roommates.');
            setGroupName('');
            setRoommates([{ name: '', email: '', contact: '', city: '' }]);
            setIsCreateDialogOpen(false);
            await fetchGroups();
        } catch (error: any) {
            toast.error(error?.message || 'Failed to create group');
        } finally {
            setIsCreatingGroup(false);
        }
    };

    const handleAddRoommate = async () => {
        try {
            if (!selectedGroupId) return;

            const normalizedEmail = newRoommate.email.trim().toLowerCase();

            if (!newRoommate.name.trim()) {
                toast.error('Please enter roommate name');
                return;
            }

            if (!normalizedEmail) {
                toast.error('Please enter roommate email');
                return;
            }

            // Simple email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(normalizedEmail)) {
                toast.error('Please enter a valid email address');
                return;
            }

            if (user?.email && normalizedEmail === user.email.toLowerCase()) {
                toast.error('You cannot add your own email as a roommate');
                return;
            }

            const selectedGroup = groups.find((group) => group.group_id === selectedGroupId);
            const alreadyInGroup = (selectedGroup?.members || []).some(
                (member) => member.email?.toLowerCase() === normalizedEmail
            );

            if (alreadyInGroup) {
                toast.error('This email is already in this roommate group');
                return;
            }

            setIsAddingRoommate(true);
            await addRoommate(selectedGroupId, {
                ...newRoommate,
                email: normalizedEmail
            });

            toast.success('Roommate invited successfully!');
            setNewRoommate({ name: '', email: '', contact: '', city: '' });
            setIsAddDialogOpen(false);
            await fetchGroups();
        } catch (error: any) {
            toast.error(getErrorMessage(error, 'Failed to add roommate'));
        } finally {
            setIsAddingRoommate(false);
        }
    };

    const handleRemoveMember = async (groupId: string, memberId: number) => {
        try {
            setIsDeleting(true);
            await removeRoommate(groupId, memberId);
            toast.success('Member removed successfully');
            setDeleteDialog(null);
            await fetchGroups();
            // Refresh the view dialog if it's open for the same group
            if (isViewDialogOpen && selectedGroup?.group_id === groupId) {
                try {
                    const details = await getGroupDetails(groupId);
                    setSelectedGroup(prev => prev ? {
                        ...prev,
                        members: details.members,
                        created_by: details.group.created_by
                    } : prev);
                } catch {}
            }
        } catch (error: any) {
            toast.error(getErrorMessage(error, 'Failed to remove member'));
        } finally {
            setIsDeleting(false);
        }
    };

    const handleLeaveGroup = async (groupId: string) => {
        try {
            setIsDeleting(true);
            await leaveGroup(groupId);
            toast.success('You left the group');
            await fetchGroups();
            setDeleteDialog(null);
        } catch (error: any) {
            toast.error(error?.message || 'Failed to leave group');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDeleteGroup = async (groupId: string) => {
        try {
            const group = groups.find((item) => item.group_id === groupId);
            if (group && hasInProgressLinkedExpenses(group)) {
                toast.error('Cannot delete this group while linked expenses are still in progress');
                return;
            }

            setIsDeleting(true);
            await deleteGroup(groupId);
            toast.success('Group deleted successfully');
            await fetchGroups();
            setDeleteDialog(null);

            if (selectedGroup?.group_id === groupId) {
                setIsViewDialogOpen(false);
                setSelectedGroup(null);
            }
        } catch (error: any) {
            toast.error(getErrorMessage(error, 'Failed to delete group'));
        } finally {
            setIsDeleting(false);
        }
    };

    const openEditMemberDialog = (groupId: string, member: { id?: number; name: string; email: string; contact?: string; city?: string }) => {
        if (!member.id) return;
        setEditMemberDialog({ groupId, memberId: member.id });
        setEditMemberForm({
            name: member.name || '',
            email: member.email || '',
            contact: member.contact || '',
            city: member.city || '',
        });
    };

    const handleSaveMember = async () => {
        if (!editMemberDialog) return;

        const name = editMemberForm.name.trim();
        const email = editMemberForm.email.trim().toLowerCase();

        if (!name) {
            toast.error('Please enter member name');
            return;
        }

        if (!email) {
            toast.error('Please enter member email');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            toast.error('Please enter a valid email address');
            return;
        }

        try {
            setIsSavingMember(true);
            await updateRoommateMember(editMemberDialog.groupId, editMemberDialog.memberId, {
                name,
                email,
                contact: editMemberForm.contact.trim() || undefined,
                city: editMemberForm.city.trim() || undefined,
            });

            toast.success('Member details updated');
            setEditMemberDialog(null);
            await fetchGroups();

            if (selectedGroup?.group_id === editMemberDialog.groupId) {
                const details = await getGroupDetails(editMemberDialog.groupId);
                setSelectedGroup((prev) => prev ? {
                    ...prev,
                    members: details.members,
                    created_by: details.group.created_by,
                } : prev);
            }
        } catch (error: any) {
            toast.error(getErrorMessage(error, 'Failed to update member details'));
        } finally {
            setIsSavingMember(false);
        }
    };

    const handleViewGroup = async (group: RoommateGroup) => {
        try {
            setSelectedGroup(group);
            setIsViewDialogOpen(true);
            setIsLoadingGroupDetails(true);
            const details = await getGroupDetails(group.group_id);
            setSelectedGroup({
                ...group,
                members: details.members,
                created_by: details.group.created_by,
                group_name: details.group.group_name || group.group_name,
            });
        } catch (error: any) {
            toast.error(getErrorMessage(error, 'Failed to load group details'));
        } finally {
            setIsLoadingGroupDetails(false);
        }
    };

    const openEditGroupDialog = (group: RoommateGroup) => {
        setEditGroupDialog({ groupId: group.group_id });
        setEditGroupName(group.group_name || '');
    };

    const handleSaveGroupName = async () => {
        if (!editGroupDialog) return;

        const groupName = editGroupName.trim();
        if (!groupName) {
            toast.error('Please enter group name');
            return;
        }

        try {
            setIsSavingGroupName(true);
            await updateGroupExpenseSettings(editGroupDialog.groupId, { groupName });
            toast.success('Group name updated');
            setEditGroupDialog(null);
            await fetchGroups();

            if (selectedGroup?.group_id === editGroupDialog.groupId) {
                const details = await getGroupDetails(editGroupDialog.groupId);
                setSelectedGroup((prev) => prev ? {
                    ...prev,
                    group_name: details.group.group_name || groupName,
                    members: details.members,
                    created_by: details.group.created_by,
                } : prev);
            }
        } catch (error: any) {
            toast.error(getErrorMessage(error, 'Failed to update group name'));
        } finally {
            setIsSavingGroupName(false);
        }
    };

    const addRoommateRow = () => {
        setRoommates([...roommates, { name: '', email: '', contact: '', city: '' }]);
    };

    const removeRoommateRow = (index: number) => {
        setRoommates(roommates.filter((_, i) => i !== index));
    };

    const updateRoommateField = (index: number, field: keyof typeof roommates[0], value: string) => {
        const updated = [...roommates];
        updated[index][field] = value;
        setRoommates(updated);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-blue-500"></div>
            </div>
        );
    }

    if (user?.role === 'Broker') {
        return (
            <Card>
                <CardContent className="p-12 text-center">
                    <h2 className="text-xl font-semibold mb-2">Roommate Group is only for members</h2>
                    <p className="text-muted-foreground">This section is not available for broker accounts.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold sm:text-3xl">Roommate Groups</h1>
                    <p className="text-muted-foreground">Create and manage roommate groups to split expenses</p>
                </div>
                <Button onClick={() => setIsCreateDialogOpen(true)} className="w-full sm:w-auto bg-blue-500 hover:bg-blue-600">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Group
                </Button>
            </div>

            {/* Groups List */}
            {groups.length === 0 ? (
                <Card>
                    <CardContent className="p-12 text-center">
                        <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                        <h3 className="text-lg font-semibold mb-2">No groups yet</h3>
                        <p className="text-muted-foreground mb-4">Create a group to manage expenses with your roommates</p>
                        <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-blue-500 hover:bg-blue-600">
                            <Plus className="w-4 h-4 mr-2" />
                            Create First Group
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {groups.map((group) => (
                        <Card key={group.group_id} className="hover:shadow-lg transition-shadow">
                            <CardHeader className="pb-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <CardTitle className="text-lg">{group.group_name || `Group ${group.group_id}`}</CardTitle>
                                        <p className="text-sm text-muted-foreground mt-1">ID: {group.group_id}</p>
                                    </div>
                                    <Badge className="bg-blue-500/20 text-blue-500">{group.members?.length || 0} members</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Members Preview */}
                                <div className="space-y-2">
                                    {group.members?.slice(0, 3).map((member) => (
                                        <div key={member.id} className="flex items-center gap-2 text-sm">
                                            <div className="w-8 h-8 bg-blue-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                                                {member.profile_image ? (
                                                    <img src={getProfileImageUrl(member.profile_image)} alt={member.name} className="w-full h-full rounded-full object-cover" />
                                                ) : (
                                                    <Users className="w-4 h-4 text-blue-500" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium truncate">{member.name}</p>
                                                <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                                            </div>
                                            <Badge variant={member.status === 'Accepted' ? 'default' : 'secondary'} className="text-xs">
                                                {member.status}
                                            </Badge>
                                        </div>
                                    ))}
                                    {(group.members?.length || 0) > 3 && (
                                        <p className="text-xs text-muted-foreground text-center py-2">
                                            +{(group.members?.length || 0) - 3} more members
                                        </p>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="grid grid-cols-2 gap-2 pt-2 border-t sm:grid-cols-4">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full"
                                        onClick={() => {
                                            setSelectedGroupId(group.group_id);
                                            setIsAddDialogOpen(true);
                                        }}
                                    >
                                        <UserPlus className="w-4 h-4 mr-1" />
                                        Add
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full"
                                        onClick={() => handleViewGroup(group)}
                                    >
                                        <Eye className="w-4 h-4 mr-1" />
                                        View
                                    </Button>
                                    {Number(group.created_by) === Number(user?.id) && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full"
                                            onClick={() => openEditGroupDialog(group)}
                                        >
                                            <SquarePen className="w-4 h-4 mr-1" />
                                            Edit
                                        </Button>
                                    )}
                                    {Number(group.created_by) === Number(user?.id) && (
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            className="w-full"
                                            title={hasInProgressLinkedExpenses(group)
                                                ? 'Cannot delete: linked expenses are still in progress'
                                                : 'Delete this group'}
                                            disabled={hasInProgressLinkedExpenses(group)}
                                            onClick={() => setDeleteDialog({
                                                type: 'delete-group',
                                                groupId: group.group_id,
                                                groupName: group.group_name || `Group ${group.group_id}`,
                                            })}
                                        >
                                            <Trash2 className="w-4 h-4 mr-1" />
                                            Delete
                                        </Button>
                                    )}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full text-red-600 hover:text-red-700"
                                        onClick={() => setDeleteDialog({ type: 'leave', groupId: group.group_id })}
                                    >
                                        <LogOut className="w-4 h-4 mr-1" />
                                        Leave
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Create Group Dialog */}
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Create New Roommate Group</DialogTitle>
                        <DialogDescription>Add a name and invite roommates to your group</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6">
                        {/* Room Name */}
                        <div>
                            <Label htmlFor="groupName">Room Name</Label>
                            <Input
                                id="groupName"
                                placeholder="e.g., Downtown Apartment, Spring Street Room"
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                                className="mt-2"
                            />
                        </div>

                        {/* Roommates */}
                        <div>
                            <Label className="mb-3 block">Roommates</Label>
                            <div className="space-y-3 max-h-64 overflow-y-auto">
                                {roommates.map((roommate, index) => (
                                    <div key={index} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_1fr_1fr_auto] md:items-end">
                                        <div>
                                            <Input
                                                placeholder="Name"
                                                value={roommate.name}
                                                onChange={(e) => updateRoommateField(index, 'name', e.target.value)}
                                                size={30}
                                            />
                                        </div>
                                        <div>
                                            <Input
                                                placeholder="Email"
                                                type="email"
                                                value={roommate.email}
                                                onChange={(e) => updateRoommateField(index, 'email', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <Input
                                                placeholder="Contact (optional)"
                                                value={roommate.contact}
                                                onChange={(e) => updateRoommateField(index, 'contact', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <Input
                                                placeholder="City (optional)"
                                                value={roommate.city}
                                                onChange={(e) => updateRoommateField(index, 'city', e.target.value)}
                                            />
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeRoommateRow(index)}
                                            className="justify-self-start text-red-600 hover:text-red-700"
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={addRoommateRow}
                                className="mt-3"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Add Another Roommate
                            </Button>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreateGroup}
                            disabled={isCreatingGroup}
                            className="bg-blue-500 hover:bg-blue-600"
                        >
                            {isCreatingGroup ? 'Creating...' : 'Create Group'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add Roommate Dialog */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Roommate to Group</DialogTitle>
                        <DialogDescription>Invite a new roommate to this group</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="roommateEmail">Email *</Label>
                            <Input
                                id="roommateEmail"
                                placeholder="roommate@example.com"
                                type="email"
                                value={newRoommate.email}
                                onChange={(e) => setNewRoommate({ ...newRoommate, email: e.target.value })}
                                className="mt-2"
                            />
                        </div>
                        <div>
                            <Label htmlFor="roommateName">Name *</Label>
                            <Input
                                id="roommateName"
                                placeholder="Full Name"
                                value={newRoommate.name}
                                onChange={(e) => setNewRoommate({ ...newRoommate, name: e.target.value })}
                                className="mt-2"
                            />
                        </div>
                        <div>
                            <Label htmlFor="roommateContact">Contact (optional)</Label>
                            <Input
                                id="roommateContact"
                                placeholder="+1234567890"
                                value={newRoommate.contact}
                                onChange={(e) => setNewRoommate({ ...newRoommate, contact: e.target.value })}
                                className="mt-2"
                            />
                        </div>
                        <div>
                            <Label htmlFor="roommateCity">City (optional)</Label>
                            <Input
                                id="roommateCity"
                                placeholder="City name"
                                value={newRoommate.city}
                                onChange={(e) => setNewRoommate({ ...newRoommate, city: e.target.value })}
                                className="mt-2"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAddRoommate}
                            disabled={isAddingRoommate}
                            className="bg-blue-500 hover:bg-blue-600"
                        >
                            {isAddingRoommate ? 'Adding...' : 'Add Roommate'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* View Group Dialog */}
            <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{selectedGroup?.group_name || `Group ${selectedGroup?.group_id}`}</DialogTitle>
                        <DialogDescription>ID: {selectedGroup?.group_id}</DialogDescription>
                    </DialogHeader>

                    {isLoadingGroupDetails ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500"></div>
                        </div>
                    ) : selectedGroup ? (
                        <div className="space-y-4">
                            <div>
                                <h3 className="font-semibold mb-3 text-sm text-muted-foreground">Members ({selectedGroup.members?.length || 0})</h3>
                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                    {selectedGroup.members?.map((member) => (
                                        <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                                            <div className="flex items-center gap-3 flex-1">
                                                <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                                                    {member.profile_image ? (
                                                        <img src={getProfileImageUrl(member.profile_image)} alt={member.name} className="w-full h-full rounded-full object-cover" />
                                                    ) : (
                                                        <Users className="w-4 h-4 text-blue-500" />
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-medium">{member.name}</p>
                                                    <p className="text-xs text-muted-foreground">{member.email}</p>
                                                    {member.contact && <p className="text-xs text-muted-foreground">{member.contact}</p>}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant={member.status === 'Accepted' ? 'default' : 'secondary'}>
                                                    {member.status}
                                                </Badge>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    title="Edit member"
                                                    onClick={() => openEditMemberDialog(selectedGroup.group_id, member)}
                                                >
                                                    <SquarePen className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-red-600 hover:text-red-700"
                                                    title="Remove member"
                                                    onClick={() => setDeleteDialog({
                                                        type: 'remove',
                                                        groupId: selectedGroup.group_id,
                                                        memberId: member.id
                                                    })}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : null}

                    <DialogFooter>
                        <Button onClick={() => setIsViewDialogOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete/Leave Confirmation Dialog */}
            <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {deleteDialog?.type === 'leave'
                                ? 'Leave Group'
                                : deleteDialog?.type === 'delete-group'
                                    ? 'Delete Group'
                                    : 'Remove Member'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleteDialog?.type === 'leave'
                                ? 'Are you sure you want to leave this group? This action cannot be undone.'
                                : deleteDialog?.type === 'delete-group'
                                    ? `Delete ${deleteDialog.groupName || 'this group'} permanently? Settled and payment history will stay saved, but this group will be removed from active lists.`
                                    : 'Are you sure you want to remove this member from the group?'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (deleteDialog?.type === 'leave') {
                                    handleLeaveGroup(deleteDialog.groupId);
                                } else if (deleteDialog?.type === 'delete-group') {
                                    handleDeleteGroup(deleteDialog.groupId);
                                } else if (deleteDialog?.memberId) {
                                    handleRemoveMember(deleteDialog.groupId, deleteDialog.memberId);
                                }
                            }}
                            disabled={isDeleting}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {isDeleting
                                ? 'Processing...'
                                : deleteDialog?.type === 'leave'
                                    ? 'Leave'
                                    : deleteDialog?.type === 'delete-group'
                                        ? 'Delete Group'
                                        : 'Remove'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog
                open={Boolean(editMemberDialog)}
                onOpenChange={(open) => {
                    if (!open) {
                        setEditMemberDialog(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Member Details</DialogTitle>
                        <DialogDescription>Any group member can update member details.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="edit-member-name">Name</Label>
                            <Input
                                id="edit-member-name"
                                value={editMemberForm.name}
                                onChange={(e) => setEditMemberForm((prev) => ({ ...prev, name: e.target.value }))}
                            />
                        </div>
                        <div>
                            <Label htmlFor="edit-member-email">Email</Label>
                            <Input
                                id="edit-member-email"
                                type="email"
                                value={editMemberForm.email}
                                onChange={(e) => setEditMemberForm((prev) => ({ ...prev, email: e.target.value }))}
                            />
                        </div>
                        <div>
                            <Label htmlFor="edit-member-contact">Contact (optional)</Label>
                            <Input
                                id="edit-member-contact"
                                value={editMemberForm.contact}
                                onChange={(e) => setEditMemberForm((prev) => ({ ...prev, contact: e.target.value }))}
                            />
                        </div>
                        <div>
                            <Label htmlFor="edit-member-city">City (optional)</Label>
                            <Input
                                id="edit-member-city"
                                value={editMemberForm.city}
                                onChange={(e) => setEditMemberForm((prev) => ({ ...prev, city: e.target.value }))}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditMemberDialog(null)} disabled={isSavingMember}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveMember} disabled={isSavingMember}>
                            {isSavingMember ? 'Saving...' : 'Save Member'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={Boolean(editGroupDialog)}
                onOpenChange={(open) => {
                    if (!open) {
                        setEditGroupDialog(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Group Name</DialogTitle>
                        <DialogDescription>Only current group admin can update the group name.</DialogDescription>
                    </DialogHeader>

                    <div>
                        <Label htmlFor="edit-group-name">Group Name</Label>
                        <Input
                            id="edit-group-name"
                            value={editGroupName}
                            onChange={(e) => setEditGroupName(e.target.value)}
                            className="mt-2"
                        />
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditGroupDialog(null)} disabled={isSavingGroupName}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveGroupName} disabled={isSavingGroupName}>
                            {isSavingGroupName ? 'Saving...' : 'Save Group Name'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default RoommatesPage;
