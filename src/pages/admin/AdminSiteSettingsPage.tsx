import { useEffect, useState } from 'react';
import { Save, Settings, RefreshCw, Building2, Mail, Phone, Image, MapPin, Upload, Sparkles, Facebook, Twitter, Instagram, Linkedin, Youtube } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    getAdminSiteSettings,
    updateAdminSiteSettings,
    uploadSiteFile,
    type SiteSettings
} from '@/services/siteSettingsService';
import { useSiteSettings } from '@/context/SiteSettingsContext';

const AdminSiteSettingsPage: React.FC = () => {
    const { refreshSettings } = useSiteSettings();
    const [formData, setFormData] = useState<SiteSettings>({
        businessName: '',
        businessTagline: '',
        supportEmail: '',
        adminEmail: '',
        supportPhone: '',
        logoUrl: '',
        faviconUrl: '',
        supportAddress: '',
        facebookUrl: '',
        twitterUrl: '',
        instagramUrl: '',
        linkedinUrl: '',
        youtubeUrl: ''
    });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState<'logo' | 'favicon' | null>(null);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const data = await getAdminSiteSettings();
            setFormData(data);
        } catch (error) {
            toast.error('Failed to load site settings');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadSettings();
    }, []);

    const handleChange = (key: keyof SiteSettings, value: string) => {
        setFormData((prev) => ({ ...prev, [key]: value }));
    };

    const handleFileUpload = async (fileType: 'logo' | 'favicon', file: File) => {
        try {
            setUploading(fileType);
            const updated = await uploadSiteFile(fileType, file);
            setFormData(updated);
            await refreshSettings(true);
            toast.success(`${fileType.charAt(0).toUpperCase() + fileType.slice(1)} uploaded successfully`);
        } catch (error) {
            toast.error(`Failed to upload ${fileType}`);
        } finally {
            setUploading(null);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const updated = await updateAdminSiteSettings(formData);
            setFormData(updated);
            await refreshSettings(true);
            toast.success('Site settings updated successfully');
        } catch (error) {
            toast.error('Failed to update site settings');
        } finally {
            setSaving(false);
        }
    };

    const FileUploadField = ({ 
        label, 
        fileType, 
        imageUrl,
        icon: Icon 
    }: { 
        label: string; 
        fileType: 'logo' | 'favicon';
        imageUrl?: string;
        icon: React.ReactNode;
    }) => (
        <div className="space-y-3">
            <Label className="flex items-center gap-2 text-base">
                {Icon}
                {label}
            </Label>
            
            {imageUrl ? (
                <div className="relative inline-block">
                    <div className="w-24 h-24 rounded-lg border-2 border-blue-500/20 bg-slate-50 flex items-center justify-center overflow-hidden">
                        <img
                            src={imageUrl}
                            alt={label}
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <label 
                        htmlFor={`${fileType}-upload`}
                        className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                    >
                        <Upload className="h-5 w-5 text-white" />
                    </label>
                    <input
                        id={`${fileType}-upload`}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploading !== null}
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                                void handleFileUpload(fileType, file);
                            }
                        }}
                    />
                </div>
            ) : (
                <div className="flex items-center gap-3">
                    <label 
                        htmlFor={`${fileType}-upload`}
                        className="flex-1 border-2 border-dashed border-blue-500/30 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500/60 transition-colors"
                    >
                        <Upload className="h-6 w-6 mx-auto mb-2 text-blue-500" />
                        <p className="text-sm font-medium text-slate-700">Click to upload {fileType}</p>
                        <p className="text-xs text-slate-500 mt-1">PNG, JPG, GIF up to 5MB</p>
                        <input
                            id={`${fileType}-upload`}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={uploading !== null}
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    void handleFileUpload(fileType, file);
                                }
                            }}
                        />
                    </label>
                </div>
            )}
            {uploading === fileType && (
                <p className="text-sm text-blue-600 flex items-center gap-2">
                    <span className="animate-spin">⌛</span>
                    Uploading...
                </p>
            )}
        </div>
    );

    return (
        <div className="space-y-6 p-3 sm:p-6 bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 min-h-screen">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Settings className="h-6 w-6 text-blue-500" />
                        Site Settings
                    </h1>
                    <p className="text-sm text-slate-600 mt-1">
                        Control business name, tagline, support emails, phone number, logo, favicon, and address across the whole site.
                    </p>
                </div>
                <Button className="w-full sm:w-auto" variant="outline" onClick={() => void loadSettings()} disabled={loading || saving}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                </Button>
            </div>

            {/* Brand & Contact Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Brand & Contact Details</CardTitle>
                    <CardDescription>
                        These values are shown in headers, footers, contact pages, and support references.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <Label htmlFor="businessName" className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-blue-500" />
                                Business Name
                            </Label>
                            <Input
                                id="businessName"
                                value={formData.businessName}
                                onChange={(e) => handleChange('businessName', e.target.value)}
                                placeholder="RoomRental"
                                disabled={loading}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="businessTagline" className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-blue-500" />
                                Business Tagline
                            </Label>
                            <Input
                                id="businessTagline"
                                value={formData.businessTagline}
                                onChange={(e) => handleChange('businessTagline', e.target.value)}
                                placeholder="Find Your Perfect Roommate"
                                disabled={loading}
                            />
                            <p className="text-xs text-slate-500">Shown under business name in headers and footers</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="supportPhone" className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-blue-500" />
                                Support Mobile Number
                            </Label>
                            <Input
                                id="supportPhone"
                                value={formData.supportPhone}
                                onChange={(e) => handleChange('supportPhone', e.target.value)}
                                placeholder="+91 99999 99999"
                                disabled={loading}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="supportEmail" className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-blue-500" />
                                Support Email
                            </Label>
                            <Input
                                id="supportEmail"
                                type="email"
                                value={formData.supportEmail}
                                onChange={(e) => handleChange('supportEmail', e.target.value)}
                                placeholder="support@roomrental.com"
                                disabled={loading}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="adminEmail" className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-blue-500" />
                                Admin Email
                            </Label>
                            <Input
                                id="adminEmail"
                                type="email"
                                value={formData.adminEmail}
                                onChange={(e) => handleChange('adminEmail', e.target.value)}
                                placeholder="admin@roomrental.com"
                                disabled={loading}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="supportAddress" className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-blue-500" />
                                Support Address
                            </Label>
                            <Input
                                id="supportAddress"
                                value={formData.supportAddress}
                                onChange={(e) => handleChange('supportAddress', e.target.value)}
                                placeholder="Pune, Maharashtra"
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button className="w-full sm:w-auto" onClick={() => void handleSave()} disabled={loading || saving || uploading !== null}>
                            <Save className="h-4 w-4 mr-2" />
                            {saving ? 'Saving...' : 'Save All Changes'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Media Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Media & Branding</CardTitle>
                    <CardDescription>
                        Upload your business logo and favicon
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8">
                        <FileUploadField 
                            label="Business Logo"
                            fileType="logo"
                            imageUrl={formData.logoUrl}
                            icon={<Image className="h-4 w-4 text-blue-500" />}
                        />
                        <FileUploadField 
                            label="Favicon"
                            fileType="favicon"
                            imageUrl={formData.faviconUrl}
                            icon={<Image className="h-4 w-4 text-blue-500" />}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Social Profile Links Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Social Profile Links</CardTitle>
                    <CardDescription>
                        Add your social media profile links (fully qualified URLs with https://)
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <Label htmlFor="facebookUrl" className="flex items-center gap-2">
                                <Facebook className="h-4 w-4 text-blue-600" />
                                Facebook Profile URL
                            </Label>
                            <Input
                                id="facebookUrl"
                                type="url"
                                value={formData.facebookUrl || ''}
                                onChange={(e) => handleChange('facebookUrl', e.target.value)}
                                placeholder="https://facebook.com/yourpage"
                                disabled={loading}
                            />
                            <p className="text-xs text-slate-500">e.g., https://facebook.com/roomrental</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="twitterUrl" className="flex items-center gap-2">
                                <Twitter className="h-4 w-4 text-blue-400" />
                                Twitter/X Profile URL
                            </Label>
                            <Input
                                id="twitterUrl"
                                type="url"
                                value={formData.twitterUrl || ''}
                                onChange={(e) => handleChange('twitterUrl', e.target.value)}
                                placeholder="https://twitter.com/yourprofile"
                                disabled={loading}
                            />
                            <p className="text-xs text-slate-500">e.g., https://twitter.com/roomrental</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="instagramUrl" className="flex items-center gap-2">
                                <Instagram className="h-4 w-4 text-pink-600" />
                                Instagram Profile URL
                            </Label>
                            <Input
                                id="instagramUrl"
                                type="url"
                                value={formData.instagramUrl || ''}
                                onChange={(e) => handleChange('instagramUrl', e.target.value)}
                                placeholder="https://instagram.com/yourprofile"
                                disabled={loading}
                            />
                            <p className="text-xs text-slate-500">e.g., https://instagram.com/roomrental</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="linkedinUrl" className="flex items-center gap-2">
                                <Linkedin className="h-4 w-4 text-blue-700" />
                                LinkedIn Profile URL
                            </Label>
                            <Input
                                id="linkedinUrl"
                                type="url"
                                value={formData.linkedinUrl || ''}
                                onChange={(e) => handleChange('linkedinUrl', e.target.value)}
                                placeholder="https://linkedin.com/company/yourcompany"
                                disabled={loading}
                            />
                            <p className="text-xs text-slate-500">e.g., https://linkedin.com/company/roomrental</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="youtubeUrl" className="flex items-center gap-2">
                                <Youtube className="h-4 w-4 text-red-600" />
                                YouTube Channel URL
                            </Label>
                            <Input
                                id="youtubeUrl"
                                type="url"
                                value={formData.youtubeUrl || ''}
                                onChange={(e) => handleChange('youtubeUrl', e.target.value)}
                                placeholder="https://youtube.com/@yourchannel"
                                disabled={loading}
                            />
                            <p className="text-xs text-slate-500">e.g., https://youtube.com/@roomrental</p>
                        </div>
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button className="w-full sm:w-auto" onClick={() => void handleSave()} disabled={loading || saving || uploading !== null}>
                            <Save className="h-4 w-4 mr-2" />
                            {saving ? 'Saving...' : 'Save All Changes'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default AdminSiteSettingsPage;
