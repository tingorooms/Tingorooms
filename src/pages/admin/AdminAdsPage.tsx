import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Megaphone, Plus, RefreshCw, Pencil, Power, Trash2, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import {
    getAdminAds,
    createAdminAd,
    updateAdminAd,
    updateAdminAdStatus,
    uploadAdminAdImages,
    getDefaultAdCardBgSearch,
    uploadDefaultAdCardBgSearch,
    removeDefaultAdCardBgSearch,
    type AdminAd,
    type AdminAdPayload
} from '@/services/adminService';

interface AdFormState {
    banner_title: string;
    description: string;
    images: string[];
    new_image_url: string;
    priority: number;
    card_placement: string;
    start_date: string;
    end_date: string;
    is_active: boolean;
}

const initialFormState: AdFormState = {
    banner_title: '',
    description: '',
    images: [],
    new_image_url: '',
    priority: 0,
    card_placement: 'MP_Search',
    start_date: '',
    end_date: '',
    is_active: true
};

const toDateInput = (value?: string) => {
    if (!value) return '';
    return String(value).slice(0, 10);
};

const normalizeImageUrls = (images: string[]): string[] => {
    return [...new Set(images.map((item) => item.trim()).filter(Boolean))];
};

const AdminAdsPage: React.FC = () => {
    // Default Ad Card BG State
    const [defaultAdBgSearch, setDefaultAdBgSearch] = useState<string>('');
    const [uploadingDefaultBgSearch, setUploadingDefaultBgSearch] = useState(false);
    const [removingDefaultBgSearch, setRemovingDefaultBgSearch] = useState(false);

    useEffect(() => {
        void fetchDefaultAdBgs();
    }, []);

    const fetchDefaultAdBgs = async () => {
        try {
            const urlSearch = await getDefaultAdCardBgSearch();
            setDefaultAdBgSearch(urlSearch);
        } catch {
            setDefaultAdBgSearch('');
        }
    };

    const handleDefaultBgUploadSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingDefaultBgSearch(true);
        try {
            const url = await uploadDefaultAdCardBgSearch(file);
            setDefaultAdBgSearch(url);
            toast.success('Default Search Ad Card background updated!');
        } catch {
            toast.error('Failed to upload Search Card background');
        } finally {
            setUploadingDefaultBgSearch(false);
        }
    };

    const handleDefaultBgRemoveSearch = async () => {
        try {
            setRemovingDefaultBgSearch(true);
            await removeDefaultAdCardBgSearch();
            setDefaultAdBgSearch('');
            toast.success('Default Search Ad Card background removed');
        } catch {
            toast.error('Failed to remove Search Card background');
        } finally {
            setRemovingDefaultBgSearch(false);
        }
    };

    const [ads, setAds] = useState<AdminAd[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [processingAdId, setProcessingAdId] = useState<number | null>(null);
    const [uploadingImages, setUploadingImages] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingAd, setEditingAd] = useState<AdminAd | null>(null);
    const [formState, setFormState] = useState<AdFormState>(initialFormState);


    useEffect(() => {
        void fetchAds();
    }, []);

    const fetchAds = async () => {
        try {
            setLoading(true);
            const data = await getAdminAds();
            setAds(
                data.map((ad) => ({
                    ...ad,
                    card_placement: ad.card_placement === 'MP_Post1' ? 'MP_Search' : (ad.card_placement || 'MP_Search'),
                }))
            );
        } catch (error) {
            console.error('Failed to fetch ads:', error);
            toast.error('Failed to fetch ads');
        } finally {
            setLoading(false);
        }
    };

    // Helper functions
    const closeDialog = () => {
        setDialogOpen(false);
        setEditingAd(null);
        setFormState(initialFormState);
    };

    const openCreateDialog = () => {
        setEditingAd(null);
        setFormState(initialFormState);
        setDialogOpen(true);
    };

    const openEditDialog = (ad: AdminAd) => {
        setEditingAd(ad);
        setFormState({
            banner_title: ad.banner_title || '',
            description: ad.description || '',
            images: ad.images || [],
            new_image_url: '',
            priority: ad.priority || 0,
            card_placement: ad.card_placement === 'MP_Post1' ? 'MP_Search' : (ad.card_placement || 'MP_Search'),
            start_date: toDateInput(ad.start_date),
            end_date: toDateInput(ad.end_date),
            is_active: ad.is_active ?? true
        });
        setDialogOpen(true);
    };

    // Calculate stats
    const stats = useMemo(() => {
        const now = new Date();
        return {
            total: ads.length,
            running: ads.filter(ad => ad.is_active && new Date(ad.start_date) <= now && new Date(ad.end_date) >= now).length,
            scheduled: ads.filter(ad => ad.is_active && new Date(ad.start_date) > now).length,
            inactive: ads.filter(ad => !ad.is_active).length
        };
    }, [ads]);

    const addImageByUrl = () => {
        const trimmedUrl = formState.new_image_url.trim();
        if (!trimmedUrl) {
            return;
        }

        setFormState((prev) => ({
            ...prev,
            images: normalizeImageUrls([...prev.images, trimmedUrl]),
            new_image_url: ''
        }));
    };

    const removeImage = (index: number) => {
        setFormState((prev) => ({
            ...prev,
            images: prev.images.filter((_, imageIndex) => imageIndex !== index)
        }));
    };

    const buildPayload = (): AdminAdPayload | null => {
        const title = formState.banner_title.trim();
        const description = formState.description.trim();

        if (!title) {
            toast.error('Banner title is required');
            return null;
        }

        if (!formState.start_date || !formState.end_date) {
            toast.error('Start and end dates are required');
            return null;
        }

        if (new Date(formState.start_date) > new Date(formState.end_date)) {
            toast.error('Start date cannot be greater than end date');
            return null;
        }

        const images = normalizeImageUrls(formState.images);
        if (images.length === 0) {
            toast.error('At least one ad image is required');
            return null;
        }

        return {
            banner_title: title,
            description: description || undefined,
            images,
            priority: Number.isFinite(formState.priority) ? Math.max(0, formState.priority) : 0,
            card_placement: formState.card_placement || 'MP_Search',
            start_date: formState.start_date,
            end_date: formState.end_date,
            is_active: formState.is_active
        };
    };

    const handleUploadImages = async (files: FileList | null) => {
        if (!files || files.length === 0) {
            return;
        }

        try {
            setUploadingImages(true);
            const uploadedUrls = await uploadAdminAdImages(Array.from(files));

            if (!uploadedUrls.length) {
                toast.error('No images were uploaded');
                return;
            }

            setFormState((prev) => ({
                ...prev,
                images: normalizeImageUrls([...prev.images, ...uploadedUrls])
            }));

            toast.success(`${uploadedUrls.length} image${uploadedUrls.length > 1 ? 's' : ''} uploaded`);
        } catch (error) {
            toast.error('Failed to upload images');
        } finally {
            setUploadingImages(false);
        }
    };

    const handleSave = async () => {
        const payload = buildPayload();
        if (!payload) return;

        try {
            setSaving(true);

            if (editingAd) {
                await updateAdminAd(editingAd.id, payload);
                toast.success('Ad updated successfully');
            } else {
                await createAdminAd(payload);
                toast.success('Ad created successfully');
            }

            closeDialog();
            await fetchAds();
        } catch (error) {
            toast.error('Failed to save ad');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleStatus = async (ad: AdminAd) => {
        try {
            setProcessingAdId(ad.id);
            await updateAdminAdStatus(ad.id, !ad.is_active);
            toast.success(`Ad ${ad.is_active ? 'deactivated' : 'activated'} successfully`);
            await fetchAds();
        } catch (error) {
            toast.error('Failed to update ad status');
        } finally {
            setProcessingAdId(null);
        }
    };

    return (
        <div className="space-y-6 p-3 sm:p-6 bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 min-h-screen">
            {/* Default Ad Card Background Upload */}
            <div className="grid grid-cols-1 gap-6 lg:gap-8">
                {/* Search Card Default BG */}
                <Card>
                    <CardHeader>
                        <CardTitle>Default Search Ad Card Background</CardTitle>
                        <CardDescription>
                            This image will be used as the background for the Search Ad Card when no ad is allotted.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-full max-w-xs h-32 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center">
                                {defaultAdBgSearch ? (
                                    <img
                                        src={defaultAdBgSearch}
                                        alt="Default Search Ad Card Background"
                                        className="object-cover w-full h-full"
                                        onError={() => {
                                            toast.error('Default Search Card image failed to load');
                                            setDefaultAdBgSearch('');
                                        }}
                                    />
                                ) : (
                                    <span className="text-slate-400">No image set</span>
                                )}
                            </div>
                            <Label htmlFor="default-ad-bg-search-upload" className="mt-2">Upload New Image</Label>
                            <Input className="max-w-xs" id="default-ad-bg-search-upload" type="file" accept="image/*" onChange={handleDefaultBgUploadSearch} disabled={uploadingDefaultBgSearch} />
                            <p className="text-xs text-muted-foreground">Supported: JPEG, PNG, WebP, GIF, SVG, ICO</p>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => { void handleDefaultBgRemoveSearch(); }}
                                disabled={!defaultAdBgSearch || removingDefaultBgSearch || uploadingDefaultBgSearch}
                                className="mt-1 w-full max-w-xs"
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {removingDefaultBgSearch ? 'Removing...' : 'Remove Image'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Ads Management Section */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-blue-600 bg-clip-text text-transparent">
                        Ads Management
                    </h1>
                    <p className="text-muted-foreground mt-2">Set ad priority, schedule, and images for homepage slider placement.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    <Button className="w-full sm:w-auto" variant="outline" onClick={() => { void fetchAds(); }} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Button className="w-full sm:w-auto" onClick={openCreateDialog}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Ad
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="border-t-4 border-t-blue-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Ads</CardTitle>
                        <Megaphone className="h-5 w-5 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
                    </CardContent>
                </Card>
                <Card className="border-t-4 border-t-emerald-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Running</CardTitle>
                        <Power className="h-5 w-5 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-600">{stats.running}</div>
                    </CardContent>
                </Card>
                <Card className="border-t-4 border-t-amber-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
                        <Power className="h-5 w-5 text-amber-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-amber-600">{stats.scheduled}</div>
                    </CardContent>
                </Card>
                <Card className="border-t-4 border-t-slate-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Inactive</CardTitle>
                        <Power className="h-5 w-5 text-slate-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-600">{stats.inactive}</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Ad Priority & Schedule</CardTitle>
                    <CardDescription>Higher priority ads are shown first in homepage slider</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-6 lg:hidden">
                        {loading ? (
                            <Card className="border border-dashed shadow-none">
                                <CardContent className="p-6 text-center text-sm text-muted-foreground">Loading ads...</CardContent>
                            </Card>
                        ) : ads.length === 0 ? (
                            <Card className="border border-dashed shadow-none">
                                <CardContent className="p-6 text-center text-sm text-muted-foreground">No ads found</CardContent>
                            </Card>
                        ) : (
                            ads.map((ad) => (
                                <Card key={`mobile-ad-${ad.id}`} className="border border-slate-200 shadow-sm">
                                    <CardContent className="space-y-4 p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="font-semibold text-slate-900 break-words">{ad.banner_title}</p>
                                                <p className="text-sm text-slate-500">{ad.card_placement || 'MP_Search'}</p>
                                            </div>
                                            <Badge variant={ad.is_active ? 'default' : 'secondary'}>
                                                {ad.status_display || (ad.is_active ? 'Active' : 'Inactive')}
                                            </Badge>
                                        </div>
                                        <div className="grid grid-cols-[88px_1fr] gap-3 items-start">
                                            {ad.images && ad.images.length > 0 ? (
                                                <img
                                                    src={ad.images[0]}
                                                    alt={ad.banner_title}
                                                    className="h-16 w-22 rounded border object-cover"
                                                    loading="lazy"
                                                    onError={(e) => {
                                                        e.currentTarget.style.display = 'none';
                                                    }}
                                                />
                                            ) : (
                                                <div className="h-16 w-22 rounded border bg-slate-50 flex items-center justify-center text-xs text-muted-foreground">
                                                    No image
                                                </div>
                                            )}
                                            <div className="grid grid-cols-2 gap-2 text-sm">
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Priority</p>
                                                    <p className="font-medium">{ad.priority || 0}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Images</p>
                                                    <p className="font-medium">{ad.images?.length || 0}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Start</p>
                                                    <p className="font-medium">{toDateInput(ad.start_date) || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground">End</p>
                                                    <p className="font-medium">{toDateInput(ad.end_date) || 'N/A'}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid gap-2 sm:grid-cols-2">
                                            <Button size="sm" variant="outline" onClick={() => openEditDialog(ad)}>
                                                <Pencil className="h-4 w-4 mr-2" />
                                                Edit
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant={ad.is_active ? 'secondary' : 'default'}
                                                onClick={() => { void handleToggleStatus(ad); }}
                                                disabled={processingAdId === ad.id}
                                            >
                                                <Power className="h-4 w-4 mr-2" />
                                                {ad.is_active ? 'Deactivate' : 'Activate'}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>

                    <div className="hidden rounded-md border lg:block">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Title</TableHead>
                                    <TableHead>Preview</TableHead>
                                    <TableHead>Card</TableHead>
                                    <TableHead>Priority</TableHead>
                                    <TableHead>Images</TableHead>
                                    <TableHead>Start</TableHead>
                                    <TableHead>End</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading ads...</TableCell>
                                    </TableRow>
                                ) : ads.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No ads found</TableCell>
                                    </TableRow>
                                ) : (
                                    ads.map((ad) => (
                                        <TableRow key={ad.id}>
                                            <TableCell className="font-medium max-w-[220px] truncate">{ad.banner_title}</TableCell>
                                            <TableCell>
                                                {ad.images && ad.images.length > 0 ? (
                                                    <img
                                                        src={ad.images[0]}
                                                        alt={ad.banner_title}
                                                        className="h-12 w-20 rounded border object-cover"
                                                        loading="lazy"
                                                        onLoad={() => {
                                                            // Image loaded
                                                        }}
                                                        onError={(e) => {
                                                            console.error('Admin ad image failed to load:', ad.images?.[0]);
                                                            e.currentTarget.style.display = 'none';
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="h-12 w-20 rounded border bg-slate-50 flex items-center justify-center">
                                                        <span className="text-xs text-muted-foreground">No image</span>
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-xs">
                                                    {ad.card_placement || 'MP_Search'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{ad.priority || 0}</TableCell>
                                            <TableCell>{ad.images?.length || 0}</TableCell>
                                            <TableCell>{toDateInput(ad.start_date)}</TableCell>
                                            <TableCell>{toDateInput(ad.end_date)}</TableCell>
                                            <TableCell>
                                                <Badge variant={ad.is_active ? 'default' : 'secondary'}>
                                                    {ad.status_display || (ad.is_active ? 'Active' : 'Inactive')}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button size="sm" variant="outline" onClick={() => openEditDialog(ad)}>
                                                        <Pencil className="h-4 w-4 mr-1" />
                                                        Edit
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant={ad.is_active ? 'secondary' : 'default'}
                                                        onClick={() => { void handleToggleStatus(ad); }}
                                                        disabled={processingAdId === ad.id}
                                                    >
                                                        <Power className="h-4 w-4 mr-1" />
                                                        {ad.is_active ? 'Deactivate' : 'Activate'}
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-[95vw] sm:max-w-[680px] max-h-[90vh] overflow-auto">
                    <DialogHeader>
                        <DialogTitle>{editingAd ? 'Edit Ad' : 'Add New Ad'}</DialogTitle>
                        <DialogDescription>Upload multiple images, preview/remove them, and set ad priority.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="banner_title">Banner Title</Label>
                            <Input
                                id="banner_title"
                                value={formState.banner_title}
                                onChange={(event) => setFormState((prev) => ({ ...prev, banner_title: event.target.value }))}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                rows={3}
                                value={formState.description}
                                onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
                            />
                        </div>

                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="priority">Priority</Label>
                                <Input
                                    id="priority"
                                    type="number"
                                    min={0}
                                    value={formState.priority}
                                    onChange={(event) => setFormState((prev) => ({ ...prev, priority: Number(event.target.value || 0) }))}
                                />
                                <p className="text-xs text-muted-foreground">Higher number shows earlier in slider.</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="card_placement">Card Placement</Label>
                                <Select
                                    value={formState.card_placement}
                                    onValueChange={(value) => setFormState((prev) => ({ ...prev, card_placement: value }))}
                                >
                                    <SelectTrigger id="card_placement">
                                        <SelectValue placeholder="Select card placement" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="MP_Search">MP_Search (Hero Search Bar)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">Choose where the ad should appear.</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Upload Images</Label>
                            <Input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={(event) => {
                                    void handleUploadImages(event.target.files);
                                    event.currentTarget.value = '';
                                }}
                            />
                            <p className="text-xs text-muted-foreground">Supported formats: JPEG, PNG, WebP, GIF, SVG, ICO. You can upload up to 8 images at once.</p>
                        </div>

                        <div className="space-y-2">
                            <Label>Add Image URL</Label>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <Input
                                    value={formState.new_image_url}
                                    onChange={(event) => setFormState((prev) => ({ ...prev, new_image_url: event.target.value }))}
                                    placeholder="https://..."
                                />
                                <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={addImageByUrl}>
                                    <ImagePlus className="h-4 w-4 mr-1" />
                                    Add
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Selected Images</Label>
                                <Badge variant="secondary">{formState.images.length} image(s)</Badge>
                            </div>
                            {formState.images.length === 0 ? (
                                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                                    No images selected yet
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {formState.images.map((imageUrl, index) => (
                                        <div key={`${imageUrl}-${index}`} className="relative rounded-md overflow-hidden border bg-slate-50">
                                            <div className="h-24 w-full flex items-center justify-center bg-slate-100">
                                                <img 
                                                    src={imageUrl} 
                                                    alt={`Ad image ${index + 1}`} 
                                                    className="h-full w-full object-cover"
                                                    onError={(e) => {
                                                        e.currentTarget.style.display = 'none';
                                                        const parent = e.currentTarget.parentElement;
                                                        if (parent && !parent.querySelector('.fallback-text')) {
                                                            const fallback = document.createElement('div');
                                                            fallback.className = 'fallback-text text-xs text-red-500 px-2 text-center';
                                                            fallback.textContent = 'Invalid Image URL';
                                                            parent.appendChild(fallback);
                                                        }
                                                    }}
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                className="absolute top-1 right-1 rounded-full bg-white p-1 border"
                                                onClick={() => removeImage(index)}
                                                aria-label="Remove image"
                                            >
                                                <Trash2 className="h-3.5 w-3.5 text-red-600" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="start_date">Start Date</Label>
                                <Input
                                    id="start_date"
                                    type="date"
                                    value={formState.start_date}
                                    onChange={(event) => setFormState((prev) => ({ ...prev, start_date: event.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="end_date">End Date</Label>
                                <Input
                                    id="end_date"
                                    type="date"
                                    value={formState.end_date}
                                    onChange={(event) => setFormState((prev) => ({ ...prev, end_date: event.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border p-3">
                            <div>
                                <p className="text-sm font-medium">Ad Status</p>
                                <p className="text-xs text-muted-foreground">Toggle whether ad is active in its schedule window</p>
                            </div>
                            <Button
                                type="button"
                                size="sm"
                                variant={formState.is_active ? 'default' : 'secondary'}
                                onClick={() => setFormState((prev) => ({ ...prev, is_active: !prev.is_active }))}
                            >
                                {formState.is_active ? 'Active' : 'Inactive'}
                            </Button>
                        </div>
                    </div>

                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        <Button className="w-full sm:w-auto" variant="outline" onClick={closeDialog} disabled={saving}>Cancel</Button>
                        <Button className="w-full sm:w-auto" onClick={() => { void handleSave(); }} disabled={saving || uploadingImages}>
                            {uploadingImages ? 'Uploading...' : saving ? 'Saving...' : editingAd ? 'Update Ad' : 'Create Ad'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default AdminAdsPage;
