// User Types
export interface User {
    id: number;
    unique_id: string;
    name: string;
    email: string;
    contact: string;
    gender: 'Male' | 'Female' | 'Other';
    pincode: string;
    role: 'Admin' | 'Member' | 'Broker';
    broker_area?: string;
    broker_status?: 'Pending' | 'Approved' | 'Hold' | 'Rejected' | 'Suspended';
    profile_image?: string;
    two_factor_enabled: boolean;
    is_verified: boolean;
    registration_date: string;
    last_login?: string;
    status: 'Active' | 'Inactive' | 'Suspended';
    contact_visibility?: 'Private' | 'Public';
}

export interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
}

// Room Types
export interface Room {
    id?: number;
    room_id: string;
    user_id?: number;
    listing_type: 'For Rent' | 'Required Roommate' | 'For Sell';
    title: string;
    room_type: '1RK' | '1BHK' | '2BHK' | '3BHK' | '4BHK' | 'PG' | 'Dormitory' | 'Studio' | 'Other';
    house_type: 'Flat' | 'Apartment' | 'House';
    availability_from: string;
    rent?: number;
    deposit?: number;
    cost?: number;
    size_sqft?: number;
    latitude: number;
    longitude: number;
    city: string;
    area: string;
    address: string;
    pincode: string;
    contact: string;
    contact_visibility?: 'Private' | 'Public';
    email?: string;
    preferred_gender?: 'Male' | 'Female' | 'Any';
    furnishing_type: 'Furnished' | 'Semi-furnished' | 'Unfurnished';
    facilities: string[];
    note?: string;
    plan_type: string;
    plan_amount?: number;
    images: string[];
    status: 'Pending' | 'Approved' | 'Hold' | 'Rejected' | 'Expired';
    admin_remark?: string;
    views_count: number;
    post_date: string;
    last_updated?: string;
    is_occupied: boolean;
    owner_name?: string;
    owner_contact?: string;
    owner_email?: string;
    owner_unique_id?: string;
    owner_profile_image?: string;
    existing_roommates?: ExistingRoommate[];
    similar_rooms?: Room[];
}

export interface ExistingRoommate {
    name: string;
    city: string;
}

export interface RoomFilters {
    city?: string;
    roommateCity?: string;
    area?: string;
    listingType?: string;
    roomType?: string;
    minRent?: number;
    maxRent?: number;
    furnishingType?: string;
    gender?: string;
    search?: string;
    userId?: number;
}

// Expense Types
export interface Expense {
    id?: number;
    expense_id: string;
    title: string;
    cost: number;
    expense_date: string;
    paid_by: number;
    paid_by_name?: string;
    group_id: string;
    split_type: 'Equal' | 'Custom';
    due_date?: string;
    is_settled: boolean;
    settled_at?: string;
    notes?: string;
    created_by: number;
    created_at?: string;
    updated_at?: string;
    expense_category?: 'Daily' | 'TripOther';
    trip_label?: string;
    splits?: ExpenseSplit[];
    amount_settled?: number;
    amount_pending?: number;
}

export interface ExpenseSplit {
    id?: number;
    expense_id?: number;
    roommate_id: number;
    amount: number;
    is_paid: boolean;
    paid_at?: string;
    notification_sent: boolean;
    notification_sent_at?: string;
    roommate_name?: string;
    roommate_email?: string;
    roommate_contact?: string;
}

// Roommate Types
export interface RoommateGroup {
    group_id: string;
    group_name?: string;
    expense_label?: string;
    created_by?: number;
    latest_created_at?: string;
    ongoing_expense_count?: number;
    expense_category?: 'Daily' | 'TripOther';
    expense_status?: 'Ongoing' | 'Closed';
    is_deleted?: number;
    allow_member_edit_history?: boolean;
    admin_upi_id?: string;
    admin_scanner_url?: string;
    admin_drive_link?: string;
    closed_at?: string;
    members: Roommate[];
}

export interface Roommate {
    id?: number;
    user_id?: number;
    name: string;
    email: string;
    contact?: string;
    city?: string;
    group_id: string;
    group_name?: string;
    linked_user_id?: number;
    invite_token?: string;
    invited_by: number;
    invited_by_name?: string;
    invited_at?: string;
    accepted_at?: string;
    status: 'Pending' | 'Accepted' | 'Declined';
    unique_id?: string;
    profile_image?: string;
}

// Chat Types
export interface ChatRoom {
    id: number;
    uuid?: string;
    room_id?: string;
    room_listing_id?: number;
    room_title?: string;
    participant_1?: number | { id: number; name: string; profile_image?: string };
    participant_2?: number | { id: number; name: string; profile_image?: string };
    sender_id?: number;
    receiver_id?: number;
    initiator_id?: number;
    initiator_name?: string;
    receiver_name?: string;
    initiator_uuid?: string;
    receiver_uuid?: string;
    created_at?: string;
    last_message_at?: string;
    is_active?: boolean;
    active?: boolean;
    participant_1_name?: string;
    participant_1_image?: string;
    participant_2_name?: string;
    participant_2_image?: string;
    room_details?: Room;
    unread_count?: number;
    last_message?: Message;
    is_starred?: boolean;
}

export interface Message {
    id: string;
    uuid?: string;
    chat_room_id?: string;
    chat_id?: string;
    sender_id?: number;
    sender_uuid?: string;
    sender_name?: string;
    sender_image?: string;
    message?: string;
    message_text?: string;
    content?: string;
    is_read?: boolean;
    read_status?: boolean;
    read_at?: string;
    delivery_status?: 'sent' | 'read';
    created_at?: string;
    updated_at?: string;
}

// Notification Types
export interface Notification {
    id: number;
    user_id: number;
    type: 'Room_Approved' | 'Room_Rejected' | 'Room_Expired' | 'Broker_Approved' | 'Expense_Due' | 'Chat_Message' | 'Roommate_Invite' | 'System';
    title: string;
    message: string;
    is_read: boolean;
    read_at?: string;
    reference_id?: string;
    reference_type?: string;
    reference_title?: string;
    created_at: string;
}

// Admin Types
export interface DashboardStats {
    total_rooms: number;
    approved_rooms: number;
    pending_rooms: number;
    occupied_rooms: number;
    total_members: number;
    approved_brokers: number;
    pending_brokers: number;
    today_registrations: number;
    today_rooms: number;
}

export interface Broker {
    id: number;
    unique_id: string;
    name: string;
    email: string;
    contact: string;
    broker_area?: string;
    registration_date: string;
    broker_status: 'Pending' | 'Approved' | 'Hold' | 'Rejected' | 'Suspended';
    admin_remark?: string;
    room_count?: number;
    selected_plan_id?: number;
    selected_plan?: {
        id: number;
        plan_name: string;
        price: number;
        duration_days: number;
    };
    subscription_status?: 'Pending' | 'Completed' | 'Rejected' | 'Suspended' | 'Refunded' | 'Failed' | string;
    has_upgrade_request?: boolean;
    upgrade_request_id?: number;
    upgrade_requested_at?: string;
    upgrade_requested_plan_name?: string;
}

export interface ContactLead {
    id: number;
    name: string;
    email: string;
    phone?: string | null;
    subject: string;
    message: string;
    source_page?: string | null;
    status: 'New' | 'In Progress' | 'Closed' | 'Spam';
    admin_remark?: string | null;
    is_spam: boolean;
    spam_score: number;
    spam_reason?: string | null;
    ip_address?: string | null;
    user_agent?: string | null;
    reviewed_by?: number | null;
    reviewed_at?: string | null;
    submitted_at: string;
    updated_at: string;
}

// API Response Types
export interface ApiResponse<T> {
    success: boolean;
    message?: string;
    data: T;
    pagination?: PaginationInfo;
    unreadCount?: number;
}

export interface PaginationInfo {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
}

// Form Types
export interface LoginFormData {
    email: string;
    password: string;
}

export interface RegisterFormData {
    name: string;
    email: string;
    contact: string;
    gender: 'Male' | 'Female' | 'Other';
    pincode: string;
    password: string;
    confirmPassword?: string;
    role: 'Member' | 'Broker';
    brokerArea?: string;
    selectedPlanId?: number;
}

export interface RoomFormData {
    step: number;
    listingType?: string;
    preferredGender?: string;
    roomType?: string;
    houseType?: string;
    latitude?: number;
    longitude?: number;
    city?: string;
    area?: string;
    address?: string;
    pincode?: string;
    rent?: number;
    deposit?: number;
    cost?: number;
    sizeSqft?: number;
    availabilityFrom?: string;
    furnishingType?: string;
    facilities?: string[];
    title?: string;
    note?: string;
    images?: string[];
    planType?: string;
    existingRoommates?: ExistingRoommate[];
}

// Plan Types
export interface Plan {
    id: number;
    plan_name: string;
    plan_code: string;
    plan_type: 'Regular' | 'Broker';
    description?: string;
    price: number;
    duration_days: number;
    features: string[];
    is_active: boolean;
}

// Subscription Types
export interface Subscription {
    id: number;
    user_id: number;
    plan_id: number;
    room_id?: number;
    amount_paid: number;
    starts_at: string;
    expires_at: string;
    payment_status: 'Pending' | 'Completed' | 'Rejected' | 'Suspended' | 'Refunded';
    transaction_id?: string;
    admin_remark?: string;
    created_at: string;
    plan?: Plan;
}

export interface BrokerSubscriptionStats {
    currentSubscription?: Subscription;
    subscriptionHistory: Subscription[];
    isActive: boolean;
    daysRemaining: number;
    totalRoomsPosted: number;
    activeRooms: number;
    pendingRooms: number;
}

// City Types
export interface City {
    city_name: string;
    district: string;
    room_count?: number;
}
