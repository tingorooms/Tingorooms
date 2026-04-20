import { get, post, put, del } from './api';
import type { ApiResponse, RoommateGroup, Roommate, Expense } from '@/types';

export const getGroups = async (filters?: { includeDeleted?: boolean }): Promise<RoommateGroup[]> => {
    const params = new URLSearchParams();
    if (filters?.includeDeleted) {
        params.append('includeDeleted', '1');
    }
    const response = await get<ApiResponse<RoommateGroup[]>>(`/roommates/groups${params.size ? `?${params.toString()}` : ''}`);
    return response.data;
};

export const getGroupDetails = async (groupId: string): Promise<{
    group: {
        group_id: string;
        group_name?: string;
        expense_label?: string;
        created_by: number;
        expense_category?: 'Daily' | 'TripOther';
        expense_status?: 'Ongoing' | 'Closed';
        allow_member_edit_history?: boolean;
        admin_upi_id?: string;
        admin_scanner_url?: string;
        admin_drive_link?: string;
        closed_at?: string;
    };
    members: Roommate[];
    recentExpenses: Expense[];
}> => {
    const response = await get<ApiResponse<{
        id: number;
        group_name: string;
        created_at: string;
        updated_at: string;
        closed_at?: string;
        members: Roommate[];
        recentExpenses: Expense[];
    }>>(`/roommates/group/${groupId}`);
    
    // Transform the response to match the expected structure
    const data = response.data;
    return {
        group: {
            group_id: data.id.toString(),
            group_name: data.group_name,
            closed_at: data.closed_at,
            // Add default values for missing properties if needed
            created_by: 0, // This might need to be fetched separately or adjusted
            expense_category: undefined,
            expense_status: data.closed_at ? 'Closed' : 'Ongoing',
            allow_member_edit_history: undefined,
            admin_upi_id: undefined,
            admin_scanner_url: undefined,
            admin_drive_link: undefined,
            expense_label: undefined
        },
        members: data.members,
        recentExpenses: data.recentExpenses
    };
};

export const createGroup = async (data: { 
    groupName?: string; 
    expenseLabel?: string;
    expenseCategory?: 'Daily' | 'TripOther';
    allowMemberEditHistory?: boolean;
    roommates?: { name: string; email: string; contact?: string; city?: string }[] 
}): Promise<{ groupId: string; groupName: string }> => {
    const response = await post<ApiResponse<{ groupId: string; groupName: string }>>('/roommates/group', data);
    return response.data;
};

export const updateGroupExpenseSettings = async (
    groupId: string,
    data: {
        groupName?: string;
        expenseCategory?: 'Daily' | 'TripOther';
        expenseLabel?: string;
        expenseStatus?: 'Ongoing' | 'Closed';
        allowMemberEditHistory?: boolean;
        adminUpiId?: string;
        adminScannerUrl?: string;
        adminDriveLink?: string;
        createdBy?: number;
    }
): Promise<void> => {
    await post<ApiResponse<void>>(`/roommates/group/${groupId}/expense-settings`, data);
};

export const addRoommate = async (groupId: string, data: { 
    name: string; 
    email: string; 
    contact?: string; 
    city?: string 
}): Promise<void> => {
    await post<ApiResponse<void>>(`/roommates/group/${groupId}/add`, data);
};

export const removeRoommate = async (groupId: string, memberId: number): Promise<void> => {
    await del<ApiResponse<void>>(`/roommates/group/${groupId}/member/${memberId}`);
};

export const updateRoommateMember = async (
    groupId: string,
    memberId: number,
    data: {
        name?: string;
        email?: string;
        contact?: string;
        city?: string;
    }
): Promise<void> => {
    await put<ApiResponse<void>>(`/roommates/group/${groupId}/member/${memberId}`, data);
};

export const uploadGroupAdminScannerImage = async (groupId: string, file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('scanner', file);

    const response = await post<ApiResponse<{ scannerUrl: string }>>(
        `/roommates/group/${groupId}/admin-scanner-upload`,
        formData
    );

    return response.data.scannerUrl;
};

export const leaveGroup = async (groupId: string): Promise<void> => {
    await post<ApiResponse<void>>(`/roommates/group/${groupId}/leave`, {});
};

export const deleteGroup = async (groupId: string): Promise<void> => {
    await del<ApiResponse<void>>(`/roommates/group/${groupId}`);
};

export const getPendingInvitations = async (): Promise<Roommate[]> => {
    const response = await get<ApiResponse<Roommate[]>>('/roommates/invitations/pending');
    return response.data;
};

export const acceptInvitation = async (token: string): Promise<{
    requiresRegistration: boolean;
    email: string;
    groupId: string;
}> => {
    const response = await post<ApiResponse<{
        requiresRegistration: boolean;
        email: string;
        groupId: string;
    }>>('/roommates/accept-invite', { token });
    return response.data;
};

export const acceptInvitationAfterRegistration = async (token: string, email: string): Promise<{
    email: string;
    groupId: string;
}> => {
    const response = await post<ApiResponse<{
        email: string;
        groupId: string;
    }>>('/roommates/accept-invite-after-registration', { token, email });
    return response.data;
};
