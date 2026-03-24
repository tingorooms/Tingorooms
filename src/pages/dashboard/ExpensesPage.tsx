import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
    Plus,
    Wallet,
    TrendingUp,
    Users,
    CheckCircle2,
    MessageCircle,
    BellRing,
    Trash2,
    SquarePen,
    FolderKanban,
    AlertTriangle,
} from 'lucide-react';
import type { Expense, RoommateGroup } from '@/types';
import {
    createExpense,
    deleteExpense,
    getExpenses,
    getExpenseStats,
    getGroupSettlementSummary,
    markSplitAsPaid,
    sendGroupSettlementReminder,
    updateExpense,
    type CreateExpensePayload,
    type ExpenseSplitInput,
} from '@/services/expenseService';
import {
    createGroup,
    deleteGroup,
    getGroups,
    uploadGroupAdminScannerImage,
    updateGroupExpenseSettings,
} from '@/services/roommateService';
import { toast } from 'sonner';

type GroupTab = 'all' | 'inProgress' | 'daily' | 'custom' | 'month';
type ExpenseUseCase = 'Daily' | 'TripOther';
type SplitWithMode = 'existingGroup' | 'newMember';

interface NewMemberRow {
    localId: string;
    name: string;
    email: string;
    contact: string;
    amount: string;
}

interface CreateGroupMemberRow {
    localId: string;
    name: string;
    email: string;
    contact: string;
}

interface ExpenseFormState {
    useCase: ExpenseUseCase;
    tripLabel: string;
    title: string;
    cost: string;
    expenseDate: string;
    dueDate: string;
    notes: string;
    splitType: 'Equal' | 'Custom';
    groupId: string;
    paidBy: string;
}

interface EditExpenseState {
    expenseId: string;
    title: string;
    amount: string;
    notes: string;
    splits: Array<{
        splitId?: number;
        roommateId: number;
        roommateName: string;
        isIncluded: boolean;
        amount: string;
        isPaid: boolean;
    }>;
}

interface GroupSummary {
    group: RoommateGroup;
    expenses: Expense[];
    lastExpense: Expense | null;
    totalAmount: number;
    settledAmount: number;
    pendingAmount: number;
}

interface PendingMemberSummary {
    roommateId: number;
    name: string;
    contact?: string;
    totalPending: number;
    pendingSplits: Array<{ expenseId: string; splitId: number; amount: number }>;
}

const getToday = () => new Date().toISOString().slice(0, 10);

const getMonthExpenseLabel = (dateInput?: string) => {
    const source = dateInput ? new Date(dateInput) : new Date();
    const validDate = Number.isNaN(source.getTime()) ? new Date() : source;
    const monthName = validDate.toLocaleString('en-US', { month: 'long' });
    return `${monthName} Expense`;
};

const getLastDayOfMonth = (dateInput: string) => {
    const source = dateInput ? new Date(dateInput) : new Date();
    if (Number.isNaN(source.getTime())) {
        const today = new Date();
        return new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
    }

    return new Date(source.getFullYear(), source.getMonth() + 1, 0).toISOString().slice(0, 10);
};

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const calculateEqualSplitAmounts = (total: number, count: number) => {
    if (count <= 0) return [];

    const perHead = round2(total / count);
    const amounts: number[] = [];

    for (let index = 0; index < count; index += 1) {
        if (index === count - 1) {
            const distributed = amounts.reduce((sum, amount) => sum + amount, 0);
            amounts.push(round2(total - distributed));
        } else {
            amounts.push(perHead);
        }
    }

    return amounts;
};

const redistributeEditSplits = (totalAmount: string, splits: EditExpenseState['splits']) => {
    const included = splits.filter((split) => split.isIncluded);
    if (included.length === 0) return splits;

    const total = Number(totalAmount || 0);
    if (!Number.isFinite(total) || total <= 0) {
        return splits;
    }

    const amounts = calculateEqualSplitAmounts(total, included.length);
    let cursor = 0;

    return splits.map((split) => {
        if (!split.isIncluded) return split;
        const value = amounts[cursor] ?? 0;
        cursor += 1;
        return { ...split, amount: String(round2(value)) };
    });
};

const ExpensesPage: React.FC = () => {
    const { user } = useAuth();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [stats, setStats] = useState<{
        summary: {
            total_expenses: number;
            total_amount: number;
            settled_amount: number;
            pending_amount: number;
        };
    } | null>(null);
    const [groups, setGroups] = useState<RoommateGroup[]>([]);
    const [activeTab, setActiveTab] = useState<GroupTab>('all');
    const [isLoading, setIsLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1));
    const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
    const [periodStart, setPeriodStart] = useState('');
    const [periodEnd, setPeriodEnd] = useState('');
    const currentYear = new Date().getFullYear();

    const [isCreateExpenseOpen, setIsCreateExpenseOpen] = useState(false);
    const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
    const [isGroupDetailOpen, setIsGroupDetailOpen] = useState(false);
    const [isEditExpenseOpen, setIsEditExpenseOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [selectedGroupId, setSelectedGroupId] = useState<string>('');
    const [groupDetailId, setGroupDetailId] = useState<string | null>(null);
    const [splitWithMode, setSplitWithMode] = useState<SplitWithMode>('existingGroup');
    const [selectedRoommateIds, setSelectedRoommateIds] = useState<number[]>([]);
    const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
    const [newMemberRows, setNewMemberRows] = useState<NewMemberRow[]>([
        { localId: crypto.randomUUID(), name: '', email: '', contact: '', amount: '' },
    ]);
    const [newGroupName, setNewGroupName] = useState('');
    const [newExpenseLabel, setNewExpenseLabel] = useState(getMonthExpenseLabel());
    const [newGroupCategory, setNewGroupCategory] = useState<ExpenseUseCase>('Daily');
    const [allowMemberEditHistory, setAllowMemberEditHistory] = useState(false);
    const [memberSourceGroupId, setMemberSourceGroupId] = useState('');
    const [newGroupMembers, setNewGroupMembers] = useState<CreateGroupMemberRow[]>([
        { localId: crypto.randomUUID(), name: '', email: '', contact: '' },
    ]);
    const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
    const [confirmDialog, setConfirmDialog] = useState<{
        title: string;
        description: string;
        hasWarning?: boolean;
        onConfirm: () => void;
    } | null>(null);
    const [editExpense, setEditExpense] = useState<EditExpenseState | null>(null);
    const [groupAdminUpiId, setGroupAdminUpiId] = useState('');
    const [groupAdminScannerUrl, setGroupAdminScannerUrl] = useState('');
    const [groupAdminDriveLink, setGroupAdminDriveLink] = useState('');
    const [groupAdminUserId, setGroupAdminUserId] = useState('');
    const [groupExpenseLabel, setGroupExpenseLabel] = useState('');
    const [isSavingAdminPaymentSettings, setIsSavingAdminPaymentSettings] = useState(false);
    const [isUploadingScanner, setIsUploadingScanner] = useState(false);
    const [memberEmailStatus, setMemberEmailStatus] = useState<Record<string, 'success' | 'failed'>>({});
    const [form, setForm] = useState<ExpenseFormState>({
        useCase: 'Daily',
        tripLabel: '',
        title: '',
        cost: '',
        expenseDate: getToday(),
        dueDate: getLastDayOfMonth(getToday()),
        notes: '',
        splitType: 'Equal',
        groupId: '',
        paidBy: user?.id ? String(user.id) : '',
    });

    const refreshData = async () => {
        const [expensesData, statsData, groupsData] = await Promise.all([
            getExpenses(),
            getExpenseStats(),
            getGroups({ includeDeleted: true }),
        ]);

        setExpenses(expensesData.data);
        setStats(statsData);
        setGroups(groupsData.map((group) => ({
            ...group,
            allow_member_edit_history: Boolean(group.allow_member_edit_history),
        })));
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                setIsLoading(true);
                await refreshData();
            } catch (error: any) {
                toast.error(error?.response?.data?.message || 'Failed to load expense data');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    useEffect(() => {
        if (!selectedGroupId && groups.length > 0) {
            setSelectedGroupId(groups[0].group_id);
        }
    }, [groups, selectedGroupId]);

    const groupSummaries = useMemo<GroupSummary[]>(() => {
        return groups
            .map((group) => {
                const groupExpenses = expenses
                    .filter((expense) => expense.group_id === group.group_id)
                    .sort((first, second) => {
                        const firstTime = new Date(first.expense_date || first.created_at || 0).getTime();
                        const secondTime = new Date(second.expense_date || second.created_at || 0).getTime();
                        return secondTime - firstTime;
                    });

                return {
                    group,
                    expenses: groupExpenses,
                    lastExpense: groupExpenses[0] || null,
                    totalAmount: groupExpenses.reduce((sum, expense) => sum + Number(expense.cost || 0), 0),
                    settledAmount: groupExpenses.reduce((sum, expense) => sum + Number(expense.amount_settled || 0), 0),
                    pendingAmount: groupExpenses.reduce((sum, expense) => sum + Number(expense.amount_pending || expense.cost || 0), 0),
                };
            })
            .sort((first, second) => {
                const firstTime = new Date(first.lastExpense?.expense_date || first.group.latest_created_at || first.group.closed_at || 0).getTime();
                const secondTime = new Date(second.lastExpense?.expense_date || second.group.latest_created_at || second.group.closed_at || 0).getTime();
                return secondTime - firstTime;
            });
    }, [expenses, groups]);

    const visibleGroupSummaries = useMemo(() => {
        const monthValue = Number(selectedMonth);
        const yearValue = Number(selectedYear);

        const matchesDateFilters = (expense: Expense) => {
            const sourceDate = new Date(expense.expense_date || expense.created_at || 0);
            if (Number.isNaN(sourceDate.getTime())) {
                return false;
            }

            if (activeTab === 'month') {
                if (monthValue > 0 && sourceDate.getMonth() + 1 !== monthValue) {
                    return false;
                }
                if (yearValue > 0 && sourceDate.getFullYear() !== yearValue) {
                    return false;
                }
            }

            if (periodStart) {
                const start = new Date(`${periodStart}T00:00:00`);
                if (sourceDate < start) {
                    return false;
                }
            }

            if (periodEnd) {
                const end = new Date(`${periodEnd}T23:59:59`);
                if (sourceDate > end) {
                    return false;
                }
            }

            return true;
        };

        return groupSummaries
            .map((summary) => {
                let filteredExpenses = summary.expenses;

                if (activeTab === 'daily') {
                    if (summary.group.expense_category !== 'Daily') {
                        return { ...summary, expenses: [], lastExpense: null, totalAmount: 0, settledAmount: 0, pendingAmount: 0 };
                    }
                }

                if (activeTab === 'inProgress') {
                    filteredExpenses = summary.expenses.filter((expense) => !expense.is_settled);
                }

                if (activeTab === 'custom') {
                    if (summary.group.expense_category !== 'TripOther') {
                        return { ...summary, expenses: [], lastExpense: null, totalAmount: 0, settledAmount: 0, pendingAmount: 0 };
                    }
                }

                if (activeTab === 'month') {
                    filteredExpenses = summary.expenses.filter(matchesDateFilters);
                }

                return {
                    ...summary,
                    expenses: filteredExpenses,
                    lastExpense: filteredExpenses[0] || null,
                    totalAmount: filteredExpenses.reduce((sum, expense) => sum + Number(expense.cost || 0), 0),
                    settledAmount: filteredExpenses.reduce((sum, expense) => sum + Number(expense.amount_settled || 0), 0),
                    pendingAmount: filteredExpenses.reduce((sum, expense) => sum + Number(expense.amount_pending || expense.cost || 0), 0),
                };
            })
            .filter((summary) => activeTab === 'all' || summary.expenses.length > 0);
    }, [activeTab, groupSummaries, periodEnd, periodStart, selectedMonth, selectedYear]);

    const selectedGroupSummary = useMemo(
        () => groupSummaries.find((summary) => summary.group.group_id === (groupDetailId || selectedGroupId)) || null,
        [groupDetailId, groupSummaries, selectedGroupId]
    );

    useEffect(() => {
        if (!selectedGroupSummary) {
            setGroupAdminUpiId('');
            setGroupAdminScannerUrl('');
            setGroupAdminDriveLink('');
            setGroupAdminUserId('');
            setGroupExpenseLabel('');
            return;
        }

        setGroupAdminUpiId(selectedGroupSummary.group.admin_upi_id || '');
        setGroupAdminScannerUrl(selectedGroupSummary.group.admin_scanner_url || '');
        setGroupAdminDriveLink(selectedGroupSummary.group.admin_drive_link || '');
        setGroupAdminUserId(String(selectedGroupSummary.group.created_by || ''));
        setGroupExpenseLabel(getGroupDisplayLabel(selectedGroupSummary.group));
    }, [selectedGroupSummary]);

    const getGroupDisplayLabel = (group: RoommateGroup) => {
        const label = String(group.expense_label || '').trim();
        if (label) return label;
        return group.group_name || `Group ${group.group_id}`;
    };

    const getGroupAdminName = (group: RoommateGroup) => {
        const adminId = Number(group.created_by || 0);
        if (!adminId) return 'Unknown';

        if (adminId === Number(user?.id) && user?.name) {
            return user.name;
        }

        const match = (group.members || []).find((member) => {
            const memberUserId = Number(member.linked_user_id || member.user_id || 0);
            return memberUserId === adminId;
        });

        return match?.name || `Member ${adminId}`;
    };

    const isGroupAdmin = (group: RoommateGroup) => {
        if (!user?.id) return false;
        return Number(group.created_by || 0) === Number(user.id);
    };

    const isDeletedGroup = (group: RoommateGroup) => Number(group.is_deleted || 0) === 1;

    const pendingByGroup = useMemo<Record<string, PendingMemberSummary[]>>(() => {
        const result: Record<string, PendingMemberSummary[]> = {};

        groupSummaries.forEach((summary) => {
            const memberMap = new Map<number, PendingMemberSummary>();

            summary.expenses.forEach((expense) => {
                if (expense.is_settled) return;
                (expense.splits || []).forEach((split) => {
                    if (split.is_paid) return;
                    if (!split.id || !split.roommate_id) return;

                    const existing = memberMap.get(split.roommate_id) || {
                        roommateId: split.roommate_id,
                        name: split.roommate_name || `Member #${split.roommate_id}`,
                        contact: split.roommate_contact,
                        totalPending: 0,
                        pendingSplits: [],
                    };

                    existing.totalPending += Number(split.amount || 0);
                    existing.pendingSplits.push({
                        expenseId: expense.expense_id,
                        splitId: split.id,
                        amount: Number(split.amount || 0),
                    });

                    if (!existing.contact && split.roommate_contact) {
                        existing.contact = split.roommate_contact;
                    }

                    memberMap.set(split.roommate_id, existing);
                });
            });

            result[summary.group.group_id] = [...memberMap.values()].sort((a, b) => b.totalPending - a.totalPending);
        });

        return result;
    }, [groupSummaries]);

    const selectedGroup = useMemo(
        () => groups.find((group) => group.group_id === form.groupId) || null,
        [form.groupId, groups]
    );

    const acceptedGroupMembers = useMemo(
        () => (selectedGroup?.members || []).filter((member) => member.status === 'Accepted'),
        [selectedGroup]
    );

    const payerOptions = useMemo(() => {
        const map = new Map<number, string>();

        acceptedGroupMembers.forEach((member) => {
            const userId = member.linked_user_id ?? member.user_id;
            if (userId) {
                map.set(userId, member.name);
            }
        });

        if (user?.id && user.name) {
            map.set(user.id, user.name);
        }

        return [...map.entries()].map(([id, name]) => ({ id, name }));
    }, [acceptedGroupMembers, user?.id, user?.name]);

    useEffect(() => {
        if (!selectedGroup) return;

        const memberIds = acceptedGroupMembers
            .map((member) => member.id)
            .filter((value): value is number => typeof value === 'number');

        setSelectedRoommateIds(memberIds);
        setCustomAmounts({});

        const currentPayerExists = payerOptions.some((payer) => String(payer.id) === form.paidBy);
        if (!currentPayerExists && payerOptions[0]) {
            setForm((prev) => ({ ...prev, paidBy: String(payerOptions[0].id) }));
        }
    }, [acceptedGroupMembers, payerOptions, selectedGroup]);

    useEffect(() => {
        if (!selectedGroup) return;

        setForm((prev) => {
            const nextUseCase = (selectedGroup.expense_category || 'Daily') as ExpenseUseCase;
            const shouldUseDefaultTitle = !prev.title || prev.title === getMonthExpenseLabel(prev.expenseDate);

            return {
                ...prev,
                useCase: nextUseCase,
                tripLabel: '',
                title: nextUseCase === 'Daily' && shouldUseDefaultTitle
                    ? getMonthExpenseLabel(prev.expenseDate)
                    : prev.title,
            };
        });
    }, [selectedGroup]);

    const resetCreateExpenseForm = (groupId?: string) => {
        const defaultGroupId = groupId || selectedGroupId || groups[0]?.group_id || '';
        const group = groups.find((item) => item.group_id === defaultGroupId);
        const defaultSelectedMembers = (group?.members || [])
            .filter((member) => member.status === 'Accepted')
            .map((member) => member.id)
            .filter((value): value is number => typeof value === 'number');
        const defaultUseCase = (group?.expense_category || 'Daily') as ExpenseUseCase;
        const defaultExpenseDate = getToday();

        setForm({
            useCase: defaultUseCase,
            tripLabel: '',
            title: defaultUseCase === 'Daily' ? getMonthExpenseLabel(defaultExpenseDate) : '',
            cost: '',
            expenseDate: defaultExpenseDate,
            dueDate: getLastDayOfMonth(defaultExpenseDate),
            notes: '',
            splitType: 'Equal',
            groupId: defaultGroupId,
            paidBy: user?.id ? String(user.id) : '',
        });
        setSplitWithMode('existingGroup');
        setSelectedRoommateIds(defaultSelectedMembers);
        setCustomAmounts({});
        setNewMemberRows([{ localId: crypto.randomUUID(), name: '', email: '', contact: '', amount: '' }]);
    };

    const resetCreateGroupForm = () => {
        setNewGroupName('');
        setNewExpenseLabel(getMonthExpenseLabel());
        setNewGroupCategory('Daily');
        setAllowMemberEditHistory(false);
        setMemberSourceGroupId('');
        setNewGroupMembers([{ localId: crypto.randomUUID(), name: '', email: '', contact: '' }]);
    };

    const loadMembersFromExistingGroup = (groupId: string) => {
        setMemberSourceGroupId(groupId);

        if (!groupId) {
            setNewGroupMembers([{ localId: crypto.randomUUID(), name: '', email: '', contact: '' }]);
            return;
        }

        const sourceGroup = groups.find((group) => group.group_id === groupId);
        if (!sourceGroup) {
            toast.error('Selected source group not found');
            return;
        }

        const copiedMembers = (sourceGroup.members || [])
            .filter((member) => member.status !== 'Declined')
            .map((member) => ({
                localId: crypto.randomUUID(),
                name: member.name || '',
                email: member.email || '',
                contact: member.contact || '',
            }));

        if (!copiedMembers.length) {
            toast.info('No members found in selected group. You can add manually.');
            setNewGroupMembers([{ localId: crypto.randomUUID(), name: '', email: '', contact: '' }]);
            return;
        }

        setNewGroupMembers(copiedMembers);
    };

    const openCreateExpenseDialog = (groupId?: string) => {
        if (!groups.length && !groupId) {
            toast.info('Create Group Expense first, then start adding expense history.');
            return;
        }

        resetCreateExpenseForm(groupId);
        setIsCreateExpenseOpen(true);
    };

    const toggleRoommateSelection = (roommateId: number, checked: boolean) => {
        setSelectedRoommateIds((prev) => {
            if (checked) return [...new Set([...prev, roommateId])];
            return prev.filter((id) => id !== roommateId);
        });
    };

    const updateGroupMemberRow = (localId: string, field: keyof CreateGroupMemberRow, value: string) => {
        setNewGroupMembers((prev) => prev.map((row) => (
            row.localId === localId ? { ...row, [field]: value } : row
        )));
    };

    const addGroupMemberRow = () => {
        setNewGroupMembers((prev) => [
            ...prev,
            { localId: crypto.randomUUID(), name: '', email: '', contact: '' },
        ]);
    };

    const removeGroupMemberRow = (localId: string) => {
        setNewGroupMembers((prev) => prev.filter((row) => row.localId !== localId));
    };

    const validNewMemberRows = useMemo(
        () => newMemberRows.filter((row) => row.name.trim() && (row.email.trim() || row.contact.trim())),
        [newMemberRows]
    );

    const splitCount = splitWithMode === 'existingGroup'
        ? selectedRoommateIds.length
        : validNewMemberRows.length;

    const equalSplitAmount = splitCount > 0 ? round2(Number(form.cost || 0) / splitCount) : 0;

    const getDisplayAmount = (key: string) => {
        if (form.splitType === 'Equal') {
            return equalSplitAmount;
        }
        return Number(customAmounts[key] || 0);
    };

    const buildCreatePayload = (): CreateExpensePayload | null => {
        const title = form.title.trim();
        const cost = Number(form.cost);
        const paidBy = Number(form.paidBy || user?.id || 0);

        if (!form.groupId) {
            toast.error('Please select expense group');
            return null;
        }
        if (!title) {
            toast.error('Please enter expense title');
            return null;
        }
        if (!Number.isFinite(cost) || cost <= 0) {
            toast.error('Please enter a valid amount');
            return null;
        }
        if (!form.expenseDate) {
            toast.error('Please select expense date');
            return null;
        }

        let splits: ExpenseSplitInput[] = [];

        if (splitWithMode === 'existingGroup') {
            if (selectedRoommateIds.length === 0) {
                toast.error('Select at least one member from the selected group');
                return null;
            }

            splits = selectedRoommateIds.map((roommateId) => ({
                roommateId,
                amount: form.splitType === 'Custom' ? Number(customAmounts[String(roommateId)] || 0) : undefined,
            }));
        } else {
            if (validNewMemberRows.length === 0) {
                toast.error('Add at least one new member to split this expense');
                return null;
            }

            splits = validNewMemberRows.map((row) => ({
                name: row.name.trim(),
                email: row.email.trim() || undefined,
                contact: row.contact.trim() || undefined,
                amount: form.splitType === 'Custom' ? Number(row.amount || 0) : undefined,
            }));
        }

        if (form.splitType === 'Custom') {
            const invalid = splits.some((split) => !Number.isFinite(Number(split.amount)) || Number(split.amount) <= 0);
            if (invalid) {
                toast.error('All custom split amounts must be valid');
                return null;
            }

            const total = round2(splits.reduce((sum, split) => sum + Number(split.amount || 0), 0));
            if (Math.abs(total - cost) > 0.01) {
                toast.error('Split total must match total expense amount');
                return null;
            }
        }

        return {
            title,
            cost,
            expenseDate: form.expenseDate,
            expenseCategory: form.useCase,
            tripLabel: form.tripLabel.trim() || undefined,
            dueDate: form.dueDate || undefined,
            notes: form.notes.trim() || undefined,
            splitType: form.splitType,
            groupId: form.groupId,
            paidBy,
            splits,
        };
    };

    const handleCreateExpense = async () => {
        try {
            const payload = buildCreatePayload();
            if (!payload) return;

            setIsSubmitting(true);
            await createExpense(payload);
            toast.success('Expense added to group history');
            setIsCreateExpenseOpen(false);
            await refreshData();
            setGroupDetailId(payload.groupId || null);
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to create expense');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCreateGroupExpense = async () => {
        try {
            if (!newGroupName.trim()) {
                toast.error('Please enter group name');
                return;
            }

            if (!newExpenseLabel.trim()) {
                toast.error('Please enter expense label');
                return;
            }

            const validMembers = newGroupMembers
                .filter((row) => row.name.trim() && row.email.trim())
                .map((row) => ({
                    name: row.name.trim(),
                    email: row.email.trim(),
                    contact: row.contact.trim() || undefined,
                }));

            setIsCreatingGroup(true);
            const created = await createGroup({
                groupName: newGroupName.trim(),
                expenseLabel: newExpenseLabel.trim(),
                expenseCategory: newGroupCategory,
                allowMemberEditHistory,
                roommates: validMembers,
            });

            toast.success('Expense group created successfully');
            setIsCreateGroupOpen(false);
            resetCreateGroupForm();
            await refreshData();
            setSelectedGroupId(created.groupId);
            openCreateExpenseDialog(created.groupId);
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to create expense group');
        } finally {
            setIsCreatingGroup(false);
        }
    };

    const handleToggleHistoryEdit = async (groupId: string, enabled: boolean) => {
        try {
            setActionLoading((prev) => ({ ...prev, [`history-${groupId}`]: true }));
            await updateGroupExpenseSettings(groupId, { allowMemberEditHistory: enabled });
            toast.success(enabled ? 'Anyone in group can edit history now' : 'Only creator can edit history now');
            await refreshData();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to update history setting');
        } finally {
            setActionLoading((prev) => ({ ...prev, [`history-${groupId}`]: false }));
        }
    };

    const handleSaveAdminPaymentSettings = async (groupId: string) => {
        try {
            setIsSavingAdminPaymentSettings(true);
            const nextAdminId = Number(groupAdminUserId);
            await updateGroupExpenseSettings(groupId, {
                expenseLabel: groupExpenseLabel.trim(),
                adminUpiId: groupAdminUpiId.trim(),
                adminScannerUrl: groupAdminScannerUrl.trim(),
                adminDriveLink: groupAdminDriveLink.trim(),
                createdBy: Number.isInteger(nextAdminId) && nextAdminId > 0 ? nextAdminId : undefined,
            });
            toast.success('Expense label and admin payment settings saved');
            await refreshData();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to save admin payment settings');
        } finally {
            setIsSavingAdminPaymentSettings(false);
        }
    };

    const handleUploadAdminScanner = async (groupId: string, file: File) => {
        try {
            setIsUploadingScanner(true);
            const scannerUrl = await uploadGroupAdminScannerImage(groupId, file);
            setGroupAdminScannerUrl(scannerUrl);
            toast.success('Scanner image uploaded');
            await refreshData();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to upload scanner image');
        } finally {
            setIsUploadingScanner(false);
        }
    };

    const handleDeleteAdminScanner = async (groupId: string) => {
        try {
            setIsSavingAdminPaymentSettings(true);
            await updateGroupExpenseSettings(groupId, { adminScannerUrl: '' });
            setGroupAdminScannerUrl('');
            toast.success('Scanner removed');
            await refreshData();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to remove scanner');
        } finally {
            setIsSavingAdminPaymentSettings(false);
        }
    };

    const ensurePaymentSetupOrPrompt = (summary: GroupSummary) => {
        const hasPaymentConfig = Boolean(summary.group.admin_upi_id || summary.group.admin_scanner_url);
        if (hasPaymentConfig) {
            return true;
        }

        const shouldOpen = window.confirm('No admin UPI ID or scanner image is set. Open Group History to add payment settings now?');
        if (shouldOpen) {
            setGroupDetailId(summary.group.group_id);
            setIsGroupDetailOpen(true);
        }
        return false;
    };

    const runExpenseAction = async (key: string, action: () => Promise<void>) => {
        try {
            setActionLoading((prev) => ({ ...prev, [key]: true }));
            await action();
            await refreshData();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Action failed');
        } finally {
            setActionLoading((prev) => ({ ...prev, [key]: false }));
        }
    };

    const handleMarkMemberComplete = async (summary: GroupSummary, member: PendingMemberSummary) => {
        const groupId = summary.group.group_id;
        await runExpenseAction(`member-pay-${groupId}-${member.roommateId}`, async () => {
            for (const split of member.pendingSplits) {
                await markSplitAsPaid(split.expenseId, split.splitId);
            }

            toast.success(`Marked all pending splits as paid for ${member.name}`);
        });
    };

    const handleMemberReminder = async (summary: GroupSummary, member: PendingMemberSummary) => {
        if (!ensurePaymentSetupOrPrompt(summary)) {
            return;
        }

        const groupId = summary.group.group_id;
        const statusKey = `${groupId}-${member.roommateId}`;
        setMemberEmailStatus((prev) => {
            const next = { ...prev };
            delete next[statusKey];
            return next;
        });

        await runExpenseAction(`member-remind-${groupId}-${member.roommateId}`, async () => {
            const data = await sendGroupSettlementReminder(groupId, member.roommateId, {
                adminUpiId: summary.group.admin_upi_id || undefined,
                adminScannerUrl: summary.group.admin_scanner_url || undefined,
                adminDriveLink: summary.group.admin_drive_link || undefined,
            });
            if (data.emailSent === false) {
                setMemberEmailStatus((prev) => ({ ...prev, [statusKey]: 'failed' }));
                toast.error(`Email could not be sent to ${member.name}`);
                return;
            }
            setMemberEmailStatus((prev) => ({ ...prev, [statusKey]: 'success' }));
            toast.success(`Email sent to ${member.name}`);
        });
    };

    const handleMemberWhatsApp = async (summary: GroupSummary, member: PendingMemberSummary) => {
        if (!ensurePaymentSetupOrPrompt(summary)) {
            return;
        }

        const groupId = summary.group.group_id;
        await runExpenseAction(`member-whatsapp-${groupId}-${member.roommateId}`, async () => {
            const data = await getGroupSettlementSummary(groupId, member.roommateId);
            if (!data.whatsappLink) {
                toast.error('No valid WhatsApp number found for this member');
                return;
            }
            window.open(data.whatsappLink, '_blank', 'noopener,noreferrer');
        });
    };

    const handleDeleteExpense = (expenseId: string) => {
        setConfirmDialog({
            title: 'Delete Expense Entry',
            description: 'Are you sure you want to delete this expense entry from history? This cannot be undone.',
            onConfirm: async () => {
                setConfirmDialog(null);
                await runExpenseAction(`delete-${expenseId}`, async () => {
                    await deleteExpense(expenseId);
                    toast.success('Expense entry deleted');
                });
            },
        });
    };

    const handleToggleGroupClosure = (summary: GroupSummary, shouldClose: boolean) => {
        if (!isGroupAdmin(summary.group)) {
            toast.error('Only group admin can close or reopen this group');
            return;
        }

        const groupLabel = getGroupDisplayLabel(summary.group);
        setConfirmDialog({
            title: shouldClose ? 'Close Expense Group?' : 'Reopen Expense Group?',
            description: shouldClose
                ? `Close "${groupLabel}"? Once closed, no new expenses can be added. You can reopen at any time.`
                : `Reopen "${groupLabel}"? This will allow adding and editing expenses again.`,
            onConfirm: async () => {
                setConfirmDialog(null);
                await runExpenseAction(`group-close-${summary.group.group_id}`, async () => {
                    await updateGroupExpenseSettings(summary.group.group_id, {
                        expenseStatus: shouldClose ? 'Closed' : 'Ongoing',
                    });
                    toast.success(shouldClose ? 'Group closed' : 'Group reopened');
                });
            },
        });
    };

    const handleDeleteGroup = (summary: GroupSummary) => {
        if (!isGroupAdmin(summary.group)) {
            toast.error('Only group admin can delete this group');
            return;
        }

        const groupLabel = getGroupDisplayLabel(summary.group);
        const allGroupExpenses = groupSummaries.find((s) => s.group.group_id === summary.group.group_id)?.expenses || [];
        const hasInProgressExpenses = allGroupExpenses.some((expense) => !expense.is_settled);

        setConfirmDialog({
            title: `Delete "${groupLabel}"?`,
            description: 'This will permanently soft-delete the group. Payment history entries will remain accessible in records.',
            hasWarning: hasInProgressExpenses,
            onConfirm: async () => {
                setConfirmDialog(null);
                await runExpenseAction(`group-delete-${summary.group.group_id}`, async () => {
                    await deleteGroup(summary.group.group_id);
                    toast.success('Group deleted. Payment history remains available in records.');
                    if (groupDetailId === summary.group.group_id) {
                        setIsGroupDetailOpen(false);
                        setGroupDetailId(null);
                    }
                });
            },
        });
    };

    const openEditExpenseDialog = (expense: Expense) => {
        const mappedSplits = (expense.splits || []).map((split) => ({
            splitId: split.id,
            roommateId: Number(split.roommate_id),
            roommateName: split.roommate_name || `Member #${split.roommate_id}`,
            isIncluded: true,
            amount: String(split.amount || ''),
            isPaid: Boolean(split.is_paid),
        }));

        setEditExpense({
            expenseId: expense.expense_id,
            title: expense.title,
            amount: String(expense.cost || ''),
            notes: expense.notes || '',
            splits: mappedSplits,
        });
        setIsEditExpenseOpen(true);
    };

    const handleSaveEditedExpense = async () => {
        if (!editExpense) return;

        try {
            const normalizedAmount = Number(editExpense.amount || 0);
            if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
                toast.error('Please enter a valid amount');
                return;
            }

            const selectedSplits = editExpense.splits.filter((split) => split.isIncluded);
            if (selectedSplits.length === 0) {
                toast.error('Select at least one split member');
                return;
            }

            const invalidSplit = selectedSplits.some((split) => !Number.isFinite(Number(split.amount || 0)) || Number(split.amount) <= 0);
            if (invalidSplit) {
                toast.error('Each selected split must have a valid amount');
                return;
            }

            const splitTotal = round2(selectedSplits.reduce((sum, split) => sum + Number(split.amount || 0), 0));
            if (Math.abs(splitTotal - round2(normalizedAmount)) > 0.01) {
                toast.error('Split total must match amount');
                return;
            }

            setIsSubmitting(true);
            const updatePayload = {
                title: editExpense.title,
                cost: normalizedAmount,
                notes: editExpense.notes || undefined,
                splits: selectedSplits.map((split) => ({
                    splitId: split.splitId,
                    roommateId: split.roommateId,
                    amount: Number(split.amount),
                })),
            };

            await updateExpense(editExpense.expenseId, updatePayload as unknown as Partial<Expense>);
            toast.success('Expense history updated');
            setIsEditExpenseOpen(false);
            setEditExpense(null);
            await refreshData();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to update expense history');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return <div className="py-12 text-center">Loading expense management...</div>;
    }

    return (
        <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Expenses</h1>
                    <p className="text-muted-foreground">Track daily and one-time group expenses with shared history and settlement.</p>
                </div>
                <Button
                    variant="outline"
                    onClick={() => {
                        resetCreateGroupForm();
                        setIsCreateGroupOpen(true);
                    }}
                >
                    <FolderKanban className="mr-2 h-4 w-4" />
                    Create Group Expense
                </Button>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
                <Card>
                    <CardContent className="p-3 sm:p-4">
                        <div className="flex items-center gap-2 sm:gap-3">
                            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-blue-500 text-white">
                                <Wallet className="h-4 w-4 sm:h-5 sm:w-5" />
                            </div>
                            <div>
                                <p className="text-xs sm:text-sm text-muted-foreground">Total Expenses</p>
                                <p className="text-base sm:text-xl font-bold">₹{Number(stats?.summary.total_amount || 0).toLocaleString()}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-3 sm:p-4">
                        <div className="flex items-center gap-2 sm:gap-3">
                            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-blue-500 text-white">
                                <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
                            </div>
                            <div>
                                <p className="text-xs sm:text-sm text-muted-foreground">Settled</p>
                                <p className="text-base sm:text-xl font-bold">₹{Number(stats?.summary.settled_amount || 0).toLocaleString()}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-3 sm:p-4">
                        <div className="flex items-center gap-2 sm:gap-3">
                            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-orange-500 text-white">
                                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
                            </div>
                            <div>
                                <p className="text-xs sm:text-sm text-muted-foreground">Pending</p>
                                <p className="text-base sm:text-xl font-bold">₹{Number(stats?.summary.pending_amount || 0).toLocaleString()}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-3 sm:p-4">
                        <div className="flex items-center gap-2 sm:gap-3">
                            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-blue-500 text-white">
                                <Users className="h-4 w-4 sm:h-5 sm:w-5" />
                            </div>
                            <div>
                                <p className="text-xs sm:text-sm text-muted-foreground">Groups</p>
                                <p className="text-base sm:text-xl font-bold">{groupSummaries.length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-2">
                <Card>
                    <CardContent className="p-3 sm:p-4">
                        <p className="text-xs sm:text-sm text-muted-foreground">Daily Groups</p>
                        <p className="mt-1 sm:mt-2 text-base sm:text-2xl font-bold">
                            ₹{groupSummaries
                                .filter((summary) => summary.group.expense_category !== 'TripOther')
                                .reduce((sum, summary) => sum + summary.totalAmount, 0)
                                .toLocaleString()}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-3 sm:p-4">
                        <p className="text-xs sm:text-sm text-muted-foreground">Trip & Other Groups</p>
                        <p className="mt-1 sm:mt-2 text-base sm:text-2xl font-bold">
                            ₹{groupSummaries
                                .filter((summary) => summary.group.expense_category === 'TripOther')
                                .reduce((sum, summary) => sum + summary.totalAmount, 0)
                                .toLocaleString()}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as GroupTab)}>
                <TabsList className="h-auto w-full justify-start gap-2 overflow-x-auto whitespace-nowrap">
                    <TabsTrigger value="inProgress">In Progress</TabsTrigger>
                    <TabsTrigger value="daily">Daily</TabsTrigger>
                    <TabsTrigger value="custom">Custom</TabsTrigger>
                    <TabsTrigger value="month">Month</TabsTrigger>
                    <TabsTrigger value="all">All</TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="mt-6">
                    {activeTab === 'month' && (
                        <Card className="mb-6">
                            <CardContent className="grid grid-cols-1 gap-4 p-4 md:grid-cols-4">
                                <div>
                                    <Label htmlFor="expense-filter-month">Month</Label>
                                    <select
                                        id="expense-filter-month"
                                        title="Filter by month"
                                        className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
                                        value={selectedMonth}
                                        onChange={(event) => setSelectedMonth(event.target.value)}
                                    >
                                        {Array.from({ length: 12 }, (_, index) => (
                                            <option key={index + 1} value={String(index + 1)}>
                                                {new Date(2026, index, 1).toLocaleString('en-US', { month: 'long' })}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <Label htmlFor="expense-filter-year">Year</Label>
                                    <select
                                        id="expense-filter-year"
                                        title="Filter by year"
                                        className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
                                        value={selectedYear}
                                        onChange={(event) => setSelectedYear(event.target.value)}
                                    >
                                        {Array.from({ length: 5 }, (_, index) => {
                                            const year = currentYear - 2 + index;
                                            return (
                                                <option key={year} value={String(year)}>
                                                    {year}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                                <div>
                                    <Label htmlFor="expense-period-start">From</Label>
                                    <Input
                                        id="expense-period-start"
                                        type="date"
                                        className="mt-2"
                                        value={periodStart}
                                        onChange={(event) => setPeriodStart(event.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="expense-period-end">To</Label>
                                    <Input
                                        id="expense-period-end"
                                        type="date"
                                        className="mt-2"
                                        value={periodEnd}
                                        onChange={(event) => setPeriodEnd(event.target.value)}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {visibleGroupSummaries.length === 0 ? (
                        <Card>
                            <CardContent className="p-12 text-center">
                                <FolderKanban className="mx-auto mb-4 h-16 w-16 text-muted-foreground/50" />
                                <h3 className="mb-2 text-lg font-semibold">No expense groups found</h3>
                                <p className="mb-4 text-muted-foreground">Create a Daily or Trip & Other expense group to start tracking shared history.</p>
                                <Button
                                    onClick={() => {
                                        resetCreateGroupForm();
                                        setIsCreateGroupOpen(true);
                                    }}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Create First Group Expense
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                            {visibleGroupSummaries.map((summary) => (
                                <Card key={summary.group.group_id}>
                                    <CardContent className="space-y-3 p-3 sm:p-5">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <h3 className="text-lg font-semibold">{getGroupDisplayLabel(summary.group)}</h3>
                                                <p className="text-xs text-muted-foreground">Group: {summary.group.group_name || `Group ${summary.group.group_id}`}</p>
                                                <p className="text-xs text-muted-foreground">Admin: {getGroupAdminName(summary.group)}</p>
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => openCreateExpenseDialog(summary.group.group_id)}
                                                        disabled={summary.group.expense_status === 'Closed' || isDeletedGroup(summary.group)}
                                                    >
                                                        Add Expense
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => {
                                                            setGroupDetailId(summary.group.group_id);
                                                            setIsGroupDetailOpen(true);
                                                        }}
                                                    >
                                                        History
                                                    </Button>
                                                    {isGroupAdmin(summary.group) && (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleToggleGroupClosure(summary, summary.group.expense_status !== 'Closed')}
                                                                disabled={actionLoading[`group-close-${summary.group.group_id}`] || isDeletedGroup(summary.group)}
                                                            >
                                                                {summary.group.expense_status === 'Closed' ? 'Reopen' : 'Close'}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="destructive"
                                                                onClick={() => handleDeleteGroup(summary)}
                                                                disabled={actionLoading[`group-delete-${summary.group.group_id}`] || isDeletedGroup(summary.group)}
                                                            >
                                                                Delete
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap justify-end gap-2">
                                                <Badge variant="outline">
                                                    {summary.group.expense_category === 'TripOther' ? 'Trip & Other' : 'Daily'}
                                                </Badge>
                                                {isDeletedGroup(summary.group) && (
                                                    <Badge variant="secondary">Group Deleted</Badge>
                                                )}
                                                <Badge variant={summary.expenses.length > 0 && summary.expenses.every((expense) => expense.is_settled) ? 'secondary' : 'default'}>
                                                    {summary.expenses.length > 0 && summary.expenses.every((expense) => expense.is_settled) ? 'Settled' : 'In Progress'}
                                                </Badge>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                                            <div>
                                                <p className="text-muted-foreground">Total</p>
                                                <p className="font-semibold">₹{summary.totalAmount.toLocaleString()}</p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground">Pending</p>
                                                <p className="font-semibold">₹{summary.pendingAmount.toLocaleString()}</p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground">Members</p>
                                                <p className="font-semibold">{summary.group.members.filter((member) => member.status === 'Accepted').length}</p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground">Entries</p>
                                                <p className="font-semibold">{summary.expenses.length}</p>
                                            </div>
                                        </div>

                                        {(pendingByGroup[summary.group.group_id] || []).length > 0 && (
                                            <div className="space-y-2 rounded-lg border p-3">
                                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Final Pending Per Person</p>
                                                {(pendingByGroup[summary.group.group_id] || []).slice(0, 3).map((member) => (
                                                    <div key={`${summary.group.group_id}-${member.roommateId}`} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                                        <div>
                                                            <span className="font-medium">{member.name}</span>
                                                            <span className="ml-2 text-muted-foreground">₹{round2(member.totalPending).toLocaleString()}</span>
                                                            {memberEmailStatus[`${summary.group.group_id}-${member.roommateId}`] === 'success' && (
                                                                <Badge className="ml-2" variant="default">Email sent</Badge>
                                                            )}
                                                            {memberEmailStatus[`${summary.group.group_id}-${member.roommateId}`] === 'failed' && (
                                                                <Badge className="ml-2" variant="destructive">Email failed</Badge>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {Number(summary.group.created_by) === Number(user?.id) && (
                                                                <>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        onClick={() => handleMarkMemberComplete(summary, member)}
                                                                        disabled={actionLoading[`member-pay-${summary.group.group_id}-${member.roommateId}`]}
                                                                    >
                                                                        <CheckCircle2 className="mr-1 h-4 w-4" />
                                                                        Paid
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        onClick={() => handleMemberReminder(summary, member)}
                                                                        disabled={actionLoading[`member-remind-${summary.group.group_id}-${member.roommateId}`]}
                                                                    >
                                                                        <BellRing className="mr-1 h-4 w-4" />
                                                                        Email
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        onClick={() => handleMemberWhatsApp(summary, member)}
                                                                        disabled={actionLoading[`member-whatsapp-${summary.group.group_id}-${member.roommateId}`]}
                                                                    >
                                                                        <MessageCircle className="mr-1 h-4 w-4" />
                                                                        WhatsApp
                                                                    </Button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                                {(pendingByGroup[summary.group.group_id] || []).length > 3 && (
                                                    <p className="text-xs text-muted-foreground">
                                                        +{(pendingByGroup[summary.group.group_id] || []).length - 3} more members pending
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            <Dialog open={isCreateGroupOpen} onOpenChange={setIsCreateGroupOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Create Group Expense</DialogTitle>
                        <DialogDescription>Create a Daily or Trip & Other expense group. Any accepted member can view it.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5">
                        <div>
                            <Label>Category</Label>
                            <div className="mt-2 flex gap-2">
                                <Button
                                    type="button"
                                    variant={newGroupCategory === 'Daily' ? 'default' : 'outline'}
                                    onClick={() => {
                                        setNewGroupCategory('Daily');
                                        setNewExpenseLabel(getMonthExpenseLabel());
                                    }}
                                >
                                    Daily Expenses
                                </Button>
                                <Button
                                    type="button"
                                    variant={newGroupCategory === 'TripOther' ? 'default' : 'outline'}
                                    onClick={() => {
                                        setNewGroupCategory('TripOther');
                                        if (!newExpenseLabel.trim() || newExpenseLabel === getMonthExpenseLabel()) {
                                            setNewExpenseLabel('');
                                        }
                                    }}
                                >
                                    One-Time / Trip & Other
                                </Button>
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="expense-group-name">Group Name</Label>
                            <Input
                                id="expense-group-name"
                                placeholder="Roommates A, Flat 302, Team Alpha"
                                value={newGroupName}
                                onChange={(event) => setNewGroupName(event.target.value)}
                            />
                        </div>

                        <div>
                            <Label htmlFor="expense-label">Expense Label (Trip Label)</Label>
                            <Input
                                id="expense-label"
                                placeholder="March Expense, Goa Trip March, Team Dinner"
                                value={newExpenseLabel}
                                onChange={(event) => setNewExpenseLabel(event.target.value)}
                            />
                        </div>

                        <div>
                            <Label>Anyone can edit history?</Label>
                            <div className="mt-2 flex gap-2">
                                <Button
                                    type="button"
                                    variant={allowMemberEditHistory ? 'default' : 'outline'}
                                    onClick={() => setAllowMemberEditHistory(true)}
                                >
                                    Yes
                                </Button>
                                <Button
                                    type="button"
                                    variant={!allowMemberEditHistory ? 'default' : 'outline'}
                                    onClick={() => setAllowMemberEditHistory(false)}
                                >
                                    No
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-3 rounded-md border p-3">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium">Invite Members (Optional)</p>
                                <Button type="button" size="sm" variant="outline" onClick={addGroupMemberRow}>
                                    <Plus className="mr-1 h-4 w-4" />
                                    Add Member
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto] md:items-center">
                                <select
                                    value={memberSourceGroupId}
                                    onChange={(event) => loadMembersFromExistingGroup(event.target.value)}
                                    aria-label="Browse existing group members"
                                    title="Browse existing group members"
                                    className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                >
                                    <option value="">Browse existing group members</option>
                                    {groups.map((group) => (
                                        <option key={group.group_id} value={group.group_id}>
                                            {getGroupDisplayLabel(group)}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-muted-foreground">
                                    Load members from a group, then edit details below.
                                </p>
                            </div>

                            {newGroupMembers.map((member) => (
                                <div key={member.localId} className="grid grid-cols-1 gap-2 md:grid-cols-4">
                                    <Input
                                        placeholder="Name"
                                        value={member.name}
                                        onChange={(event) => updateGroupMemberRow(member.localId, 'name', event.target.value)}
                                    />
                                    <Input
                                        placeholder="Email"
                                        value={member.email}
                                        onChange={(event) => updateGroupMemberRow(member.localId, 'email', event.target.value)}
                                    />
                                    <Input
                                        placeholder="Contact"
                                        value={member.contact}
                                        onChange={(event) => updateGroupMemberRow(member.localId, 'contact', event.target.value)}
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => removeGroupMemberRow(member.localId)}
                                        disabled={newGroupMembers.length === 1}
                                    >
                                        Remove
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateGroupOpen(false)} disabled={isCreatingGroup}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreateGroupExpense} disabled={isCreatingGroup}>
                            {isCreatingGroup ? 'Creating...' : 'Create Group'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isCreateExpenseOpen} onOpenChange={setIsCreateExpenseOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Add Expense</DialogTitle>
                        <DialogDescription>Add a new history entry inside the selected expense group.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5">
                        <div className="rounded-md border bg-muted/20 p-3 text-sm">
                            <p className="font-medium">Expense Group</p>
                            <p className="text-muted-foreground">{selectedGroup ? getGroupDisplayLabel(selectedGroup) : 'No group selected'}</p>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                {form.useCase === 'Daily' ? (
                                    <div>
                                        <Label>Current Month Expense</Label>
                                        <div className="mt-2 inline-flex items-center gap-2 rounded-full border bg-muted/30 px-3 py-2">
                                            <span className="text-xs uppercase tracking-wide text-muted-foreground">Title</span>
                                            <Input
                                                className="h-8 w-44 border-0 bg-transparent p-0 text-sm font-medium shadow-none focus-visible:ring-0"
                                                value={form.title}
                                                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                                                placeholder={getMonthExpenseLabel(form.expenseDate)}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <Label htmlFor="expense-title">Title</Label>
                                        <Input
                                            id="expense-title"
                                            value={form.title}
                                            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                                            placeholder="Rent, Electricity, Petrol, Lunch"
                                        />
                                    </div>
                                )}
                            </div>
                            <div>
                                <Label htmlFor="expense-cost">Amount</Label>
                                <Input
                                    id="expense-cost"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.cost}
                                    onChange={(event) => setForm((prev) => ({ ...prev, cost: event.target.value }))}
                                />
                            </div>
                            <div>
                                <Label htmlFor="expense-date">Expense Date</Label>
                                <Input
                                    id="expense-date"
                                    type="date"
                                    value={form.expenseDate}
                                    onChange={(event) => {
                                        const nextExpenseDate = event.target.value;
                                        setForm((prev) => ({
                                            ...prev,
                                            expenseDate: nextExpenseDate,
                                            dueDate: getLastDayOfMonth(nextExpenseDate),
                                        }));
                                    }}
                                />
                            </div>
                            <div>
                                <Label htmlFor="expense-due-date">Settlement Due Date</Label>
                                <Input
                                    id="expense-due-date"
                                    type="date"
                                    value={form.dueDate}
                                    onChange={(event) => setForm((prev) => ({ ...prev, dueDate: event.target.value }))}
                                />
                            </div>
                            <div>
                                <Label htmlFor="expense-paid-by">Paid By</Label>
                                <select
                                    id="expense-paid-by"
                                    title="Select payer"
                                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                                    value={form.paidBy}
                                    onChange={(event) => setForm((prev) => ({ ...prev, paidBy: event.target.value }))}
                                >
                                    {payerOptions.map((payer) => (
                                        <option key={payer.id} value={payer.id}>
                                            {payer.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <Label>Split Type</Label>
                            <div className="mt-2 flex gap-2">
                                <Button
                                    type="button"
                                    variant={form.splitType === 'Equal' ? 'default' : 'outline'}
                                    onClick={() => setForm((prev) => ({ ...prev, splitType: 'Equal' }))}
                                >
                                    Equal
                                </Button>
                                <Button
                                    type="button"
                                    variant={form.splitType === 'Custom' ? 'default' : 'outline'}
                                    onClick={() => setForm((prev) => ({ ...prev, splitType: 'Custom' }))}
                                >
                                    Custom
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-3 rounded-md border p-3">
                            <p className="text-sm font-medium">Split with</p>
                            {acceptedGroupMembers.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No accepted members found in this group yet.</p>
                            ) : (
                                acceptedGroupMembers.map((member) => {
                                    const memberId = member.id || -1;
                                    const amount = form.splitType === 'Equal'
                                        ? equalSplitAmount
                                        : getDisplayAmount(String(memberId));

                                    return (
                                        <div key={member.id} className="flex items-center justify-between gap-3 rounded-md border p-2">
                                            <label className="flex items-center gap-2 text-sm">
                                                <Checkbox
                                                    checked={selectedRoommateIds.includes(memberId)}
                                                    onCheckedChange={(checked) => {
                                                        if (!member.id) return;
                                                        toggleRoommateSelection(member.id, Boolean(checked));
                                                    }}
                                                />
                                                {member.name}
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium">₹{Number(amount || 0).toLocaleString()}</span>
                                                {form.splitType === 'Custom' && selectedRoommateIds.includes(memberId) && (
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        className="w-28"
                                                        value={customAmounts[String(memberId)] || ''}
                                                        onChange={(event) => setCustomAmounts((prev) => ({
                                                            ...prev,
                                                            [String(memberId)]: event.target.value,
                                                        }))}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <div>
                            <Label htmlFor="expense-notes">Notes</Label>
                            <Textarea
                                id="expense-notes"
                                placeholder="Optional notes for this expense history"
                                value={form.notes}
                                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateExpenseOpen(false)} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreateExpense} disabled={isSubmitting}>
                            {isSubmitting ? 'Saving...' : 'Add Expense'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isGroupDetailOpen} onOpenChange={setIsGroupDetailOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{selectedGroupSummary ? getGroupDisplayLabel(selectedGroupSummary.group) : 'Expense History'}</DialogTitle>
                        <DialogDescription>
                            Expense history for this group. Any accepted member can track this group and continue adding entries.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedGroupSummary && (
                        <div className="space-y-5">
                            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm">
                                <Badge variant="outline">
                                    {selectedGroupSummary.group.expense_category === 'TripOther' ? 'One-Time / Trip & Other' : 'Daily'}
                                </Badge>
                                <Badge variant={selectedGroupSummary.expenses.length > 0 && selectedGroupSummary.expenses.every((expense) => expense.is_settled) ? 'secondary' : 'default'}>
                                    {selectedGroupSummary.expenses.length > 0 && selectedGroupSummary.expenses.every((expense) => expense.is_settled) ? 'Settled' : 'In Progress'}
                                </Badge>
                                <span className="text-muted-foreground">Total:</span>
                                <span className="font-semibold">₹{selectedGroupSummary.totalAmount.toLocaleString()}</span>
                                <span className="text-muted-foreground">Entries:</span>
                                <span className="font-semibold">{selectedGroupSummary.expenses.length}</span>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <Button
                                    onClick={() => openCreateExpenseDialog(selectedGroupSummary.group.group_id)}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Expense in Group
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => handleToggleHistoryEdit(
                                        selectedGroupSummary.group.group_id,
                                        !Boolean(selectedGroupSummary.group.allow_member_edit_history)
                                    )}
                                    disabled={actionLoading[`history-${selectedGroupSummary.group.group_id}`]}
                                >
                                    {selectedGroupSummary.group.allow_member_edit_history ? 'History Edit: Anyone' : 'History Edit: Creator Only'}
                                </Button>
                            </div>

                            {Number(selectedGroupSummary.group.created_by) === Number(user?.id) && (
                                <Card>
                                    <CardContent className="space-y-4 p-4">
                                        <div>
                                            <p className="font-semibold">Admin UPI/Scanner Settings</p>
                                            <p className="text-sm text-muted-foreground">
                                                Save expense label and payment details here. You can reuse the same group later with a new expense label.
                                            </p>
                                        </div>

                                        <div>
                                            <Label htmlFor="group-expense-label">Expense Label</Label>
                                            <Input
                                                id="group-expense-label"
                                                placeholder="March Expense, Goa Trip, Team Dinner"
                                                value={groupExpenseLabel}
                                                onChange={(event) => setGroupExpenseLabel(event.target.value)}
                                            />
                                        </div>

                                        <div>
                                            <Label htmlFor="group-admin-user">Group Admin</Label>
                                            <select
                                                id="group-admin-user"
                                                title="Select group admin"
                                                className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
                                                value={groupAdminUserId}
                                                onChange={(event) => setGroupAdminUserId(event.target.value)}
                                            >
                                                {(selectedGroupSummary.group.members || [])
                                                    .filter((member) => member.status === 'Accepted')
                                                    .map((member) => {
                                                        const memberUserId = Number(member.linked_user_id || member.user_id || 0);
                                                        if (!memberUserId) return null;
                                                        return (
                                                            <option key={`${member.id}-${memberUserId}`} value={String(memberUserId)}>
                                                                {member.name}
                                                            </option>
                                                        );
                                                    })}
                                            </select>
                                        </div>

                                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                            <div>
                                                <Label htmlFor="group-admin-upi">Admin UPI ID</Label>
                                                <Input
                                                    id="group-admin-upi"
                                                    placeholder="yourupi@bank"
                                                    value={groupAdminUpiId}
                                                    onChange={(event) => setGroupAdminUpiId(event.target.value)}
                                                />
                                            </div>

                                            <div>
                                                <Label htmlFor="group-admin-drive-link">Trip Photos/Videos Drive Link</Label>
                                                <Input
                                                    id="group-admin-drive-link"
                                                    placeholder="https://drive.google.com/..."
                                                    value={groupAdminDriveLink}
                                                    onChange={(event) => setGroupAdminDriveLink(event.target.value)}
                                                />
                                            </div>

                                            <div>
                                                <Label htmlFor="group-admin-scanner-file">Scanner Image</Label>
                                                <Input
                                                    id="group-admin-scanner-file"
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={(event) => {
                                                        const file = event.target.files?.[0];
                                                        if (!file) return;
                                                        void handleUploadAdminScanner(selectedGroupSummary.group.group_id, file);
                                                        event.currentTarget.value = '';
                                                    }}
                                                    disabled={isUploadingScanner}
                                                />
                                            </div>
                                        </div>

                                        {groupAdminScannerUrl && (
                                            <div className="space-y-2 rounded-md border p-3">
                                                <p className="text-sm font-medium">Current Scanner</p>
                                                <img
                                                    src={groupAdminScannerUrl}
                                                    alt="Admin scanner"
                                                    className="h-40 w-auto rounded-md border object-contain"
                                                />
                                            </div>
                                        )}

                                        <div className="flex flex-wrap gap-2">
                                            <Button
                                                onClick={() => handleSaveAdminPaymentSettings(selectedGroupSummary.group.group_id)}
                                                disabled={isSavingAdminPaymentSettings || isUploadingScanner}
                                            >
                                                {isSavingAdminPaymentSettings ? 'Saving...' : 'Save'}
                                            </Button>
                                            {groupAdminScannerUrl && (
                                                <Button
                                                    variant="outline"
                                                    onClick={() => handleDeleteAdminScanner(selectedGroupSummary.group.group_id)}
                                                    disabled={isSavingAdminPaymentSettings || isUploadingScanner}
                                                >
                                                    Delete Scanner
                                                </Button>
                                            )}
                                            {isUploadingScanner && (
                                                <p className="text-sm text-muted-foreground">Uploading scanner...</p>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {selectedGroupSummary.expenses.length === 0 ? (
                                <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                                    No expense history yet for this group.
                                </div>
                            ) : (
                                <div className="space-y-5">
                                    {Object.entries(
                                        selectedGroupSummary.expenses.reduce<Record<string, Expense[]>>((acc, expense) => {
                                            const key = expense.trip_label?.trim() || 'General';
                                            if (!acc[key]) acc[key] = [];
                                            acc[key].push(expense);
                                            return acc;
                                        }, {})
                                    ).map(([tripLabel, tripExpenses]) => (
                                        <div key={tripLabel} className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <Badge variant={tripLabel === 'General' ? 'secondary' : 'outline'}>
                                                    {tripLabel === 'General' ? 'General History' : `Trip: ${tripLabel}`}
                                                </Badge>
                                                <span className="text-sm text-muted-foreground">{tripExpenses.length} entries</span>
                                            </div>

                                            <div className="space-y-4">
                                                {tripExpenses.map((expense) => (
                                                    <Card key={expense.expense_id}>
                                                        <CardContent className="space-y-4 p-4">
                                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="font-semibold">{expense.title}</p>
                                                                        <Badge variant={expense.is_settled ? 'default' : 'secondary'}>
                                                                            {expense.is_settled ? 'Settled' : 'In Progress'}
                                                                        </Badge>
                                                                    </div>
                                                                    <p className="text-sm text-muted-foreground">Amount: ₹{Number(expense.cost || 0).toLocaleString()}</p>
                                                                    <p className="text-sm text-muted-foreground">
                                                                        Expense Due: {expense.due_date ? new Date(expense.due_date).toLocaleDateString() : 'Not set'}
                                                                    </p>
                                                                    <p className="text-sm text-muted-foreground">Note: {expense.notes?.trim() || 'N/A'}</p>
                                                                </div>
                                                                <p className="text-xs text-muted-foreground">Created: {new Date(expense.expense_date).toLocaleDateString()}</p>
                                                            </div>

                                                            {(expense.splits || []).length > 0 && (
                                                                <div className="space-y-2 rounded-md border p-3">
                                                                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Splitted IN</p>
                                                                    {(expense.splits || []).map((split) => (
                                                                        <div key={split.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                                                            <div>
                                                                                <span className="font-medium">
                                                                                    {(split.roommate_name || `Member #${split.roommate_id}`)} | ₹{Number(split.amount || 0).toLocaleString()}
                                                                                </span>
                                                                                <Badge className="ml-2" variant={split.is_paid ? 'default' : 'outline'}>
                                                                                    {split.is_paid ? 'Paid' : 'Pending'}
                                                                                </Badge>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
                                                                {selectedGroupSummary.group.expense_status !== 'Closed' && !isDeletedGroup(selectedGroupSummary.group) && (
                                                                    <>
                                                                    <Button size="sm" variant="outline" onClick={() => openEditExpenseDialog(expense)}>
                                                                        <SquarePen className="mr-1 h-4 w-4" />
                                                                        Edit History
                                                                    </Button>
                                                                    <Button size="sm" variant="destructive" onClick={() => handleDeleteExpense(expense.expense_id)}>
                                                                        <Trash2 className="mr-1 h-4 w-4" />
                                                                        Delete Entry
                                                                    </Button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={isEditExpenseOpen} onOpenChange={setIsEditExpenseOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Edit Expense History</DialogTitle>
                        <DialogDescription>Edit the recorded entry details for this group expense.</DialogDescription>
                    </DialogHeader>

                    {editExpense && (
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="edit-expense-title">Title</Label>
                                <Input
                                    id="edit-expense-title"
                                    value={editExpense.title}
                                    onChange={(event) => setEditExpense((prev) => prev ? { ...prev, title: event.target.value } : prev)}
                                />
                            </div>
                            <div>
                                <Label htmlFor="edit-expense-amount">Amount</Label>
                                <Input
                                    id="edit-expense-amount"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={editExpense.amount}
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        setEditExpense((prev) => prev ? {
                                            ...prev,
                                            amount: value,
                                            splits: redistributeEditSplits(value, prev.splits),
                                        } : prev);
                                    }}
                                />
                            </div>
                            <div className="space-y-2 rounded-md border p-3">
                                <p className="text-sm font-medium">Splitted IN</p>
                                {editExpense.splits.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No split members found for this entry.</p>
                                ) : (
                                    editExpense.splits.map((split) => (
                                        <div key={`${split.roommateId}-${split.splitId || 'new'}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
                                            <label className="flex items-center gap-2 text-sm">
                                                <Checkbox
                                                    checked={split.isIncluded}
                                                    onCheckedChange={(checked) => {
                                                        setEditExpense((prev) => {
                                                            if (!prev) return prev;
                                                            const nextSplits = prev.splits.map((item) => (
                                                                item.roommateId === split.roommateId
                                                                    ? { ...item, isIncluded: Boolean(checked) }
                                                                    : item
                                                            ));
                                                            return {
                                                                ...prev,
                                                                splits: redistributeEditSplits(prev.amount, nextSplits),
                                                            };
                                                        });
                                                    }}
                                                />
                                                {split.roommateName}
                                            </label>
                                            <div className="flex items-center gap-2">
                                                {split.isPaid && <Badge variant="secondary">Paid</Badge>}
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    className="w-28"
                                                    value={split.amount}
                                                    onChange={(event) => {
                                                        const value = event.target.value;
                                                        setEditExpense((prev) => prev ? {
                                                            ...prev,
                                                            splits: prev.splits.map((item) => (
                                                                item.roommateId === split.roommateId
                                                                    ? { ...item, amount: value }
                                                                    : item
                                                            )),
                                                        } : prev);
                                                    }}
                                                    disabled={!split.isIncluded}
                                                />
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div>
                                <Label htmlFor="edit-expense-notes">Note</Label>
                                <Textarea
                                    id="edit-expense-notes"
                                    value={editExpense.notes}
                                    onChange={(event) => setEditExpense((prev) => prev ? { ...prev, notes: event.target.value } : prev)}
                                />
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditExpenseOpen(false)} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveEditedExpense} disabled={isSubmitting}>
                            {isSubmitting ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!confirmDialog} onOpenChange={(open) => { if (!open) setConfirmDialog(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        {confirmDialog?.hasWarning && (
                            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                                <AlertTriangle className="h-6 w-6" />
                            </div>
                        )}
                        <AlertDialogTitle>{confirmDialog?.title}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirmDialog?.description}
                            {confirmDialog?.hasWarning && (
                                <span className="mt-2 block font-medium text-amber-600">
                                    ⚠ This group has in-progress (unsettled) expenses. Deleting it will mark the group as deleted but payment history will remain visible.
                                </span>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => confirmDialog?.onConfirm()}>Confirm</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

        </div>
    );
};

export default ExpensesPage;
