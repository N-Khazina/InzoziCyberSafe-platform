import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  User,
  Bell,
  Shield,
  Palette,
  Save,
  Eye,
  EyeOff,
  Camera,
  Upload,
  Download,
  Trash2,
  RefreshCw,
  Check,
  X,
  AlertCircle,
  Info,
  Lock,
  Globe,
  Moon,
  Sun,
  Monitor,
  Smartphone,
  Mail,
  Key,
  Database,
  FileText,
  HelpCircle,
  LogOut,
  UserCheck,
  Calendar,
  Clock,
  Languages,
  Zap,
  Activity,
  BookOpen,
  Trophy,
  Play
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import NotificationService, { NotificationPreferences } from '../../services/notificationService';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import {
  updateProfile,
  updatePassword,
  updateEmail,
  EmailAuthProvider,
  reauthenticateWithCredential
} from 'firebase/auth';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from 'firebase/storage';
import { db, storage, auth } from '../../lib/firebase';

interface UserSettings {
  profile: {
    displayName: string;
    email: string;
    bio: string;
    location: string;
    website: string;
    phoneNumber: string;
    profilePicture: string;
    dateOfBirth: string;
    occupation: string;
    interests: string[];
  };
  notifications: NotificationPreferences & {
    digestFrequency: 'daily' | 'weekly' | 'monthly' | 'never';
    quietHours: { start: string; end: string; enabled: boolean };
    notificationSound: boolean;
    emailDigest: boolean;
  };
  privacy: {
    profileVisibility: 'private' | 'friends' | 'public';
    showProgress: boolean;
    showAchievements: boolean;
    showActivity: boolean;
    allowMessages: boolean;
    showEmail: boolean;
    dataSharing: boolean;
    analyticsOptOut: boolean;
  };
  appearance: {
    theme: 'light' | 'dark' | 'auto';
    language: string;
    timezone: string;
    dateFormat: string;
    timeFormat: '12h' | '24h';
    compactMode: boolean;
    animations: boolean;
    fontSize: 'small' | 'medium' | 'large';
  };
  security: {
    twoFactorEnabled: boolean;
    loginNotifications: boolean;
    sessionTimeout: number;
    passwordLastChanged: Date | null;
    trustedDevices: string[];
  };
  learning: {
    dailyGoal: number;
    reminderTime: string;
    autoplay: boolean;
    subtitles: boolean;
    playbackSpeed: number;
    downloadQuality: 'low' | 'medium' | 'high';
  };
}

const Settings = () => {
  const { user, logout } = useAuth();

  // UI state
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  // Profile editing state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(null);

  // Password change state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Settings data
  const [userSettings, setUserSettings] = useState<UserSettings>({
    profile: {
      displayName: user?.name || '',
      email: user?.email || '',
      bio: '',
      location: '',
      website: '',
      phoneNumber: '',
      profilePicture: user?.photoURL || '',
      dateOfBirth: '',
      occupation: '',
      interests: []
    },
    notifications: {
      userId: user?.id || '',
      emailNotifications: true,
      pushNotifications: true,
      assignmentReminders: true,
      gradeNotifications: true,
      courseUpdates: true,
      systemAnnouncements: true,
      digestFrequency: 'weekly',
      quietHours: { start: '22:00', end: '08:00', enabled: false },
      notificationSound: true,
      emailDigest: true
    },
    privacy: {
      profileVisibility: 'private',
      showProgress: false,
      showAchievements: true,
      showActivity: false,
      allowMessages: true,
      showEmail: false,
      dataSharing: false,
      analyticsOptOut: false
    },
    appearance: {
      theme: 'light',
      language: 'en',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      dateFormat: 'MM/DD/YYYY',
      timeFormat: '12h',
      compactMode: false,
      animations: true,
      fontSize: 'medium'
    },
    security: {
      twoFactorEnabled: false,
      loginNotifications: true,
      sessionTimeout: 30,
      passwordLastChanged: null,
      trustedDevices: []
    },
    learning: {
      dailyGoal: 30,
      reminderTime: '19:00',
      autoplay: true,
      subtitles: false,
      playbackSpeed: 1.0,
      downloadQuality: 'medium'
    }
  });

  // Activity tracking
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [accountStats, setAccountStats] = useState({
    accountCreated: null as Date | null,
    lastLogin: null as Date | null,
    totalSessions: 0,
    dataUsage: 0
  });

  // Enhanced data loading with real-time updates
  useEffect(() => {
    if (!user?.id) return;

    const loadUserSettings = async () => {
      setLoading(true);
      setError('');

      try {
        console.log('Loading comprehensive user settings...');

        // Set up real-time listener for user settings
        const userSettingsRef = doc(db, 'userSettings', user.id);

        const unsubscribe = onSnapshot(
          userSettingsRef,
          (doc) => {
            if (doc.exists()) {
              const data = doc.data();
              console.log('Settings updated via real-time listener');

              // Merge with default settings
              setUserSettings(prevSettings => ({
                ...prevSettings,
                ...data,
                profile: {
                  ...prevSettings.profile,
                  ...data.profile,
                  displayName: user.name || data.profile?.displayName || '',
                  email: user.email || data.profile?.email || '',
                  profilePicture: user.photoURL || data.profile?.profilePicture || ''
                }
              }));
            } else {
              // Create default settings document
              createDefaultSettings();
            }
          },
          (error) => {
            console.error('Error in settings listener:', error);
            setError('Failed to load settings. Please refresh the page.');
          }
        );

        // Load account statistics
        await loadAccountStats();

        // Load recent activity
        await loadRecentActivity();

        return unsubscribe;

      } catch (error) {
        console.error('Error loading user settings:', error);
        setError('Failed to load settings. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    const unsubscribe = loadUserSettings();

    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [user?.id]);

  // Create default settings document
  const createDefaultSettings = async () => {
    if (!user?.id) return;

    try {
      const userSettingsRef = doc(db, 'userSettings', user.id);
      await setDoc(userSettingsRef, {
        ...userSettings,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      console.log('Default settings created');
    } catch (error) {
      console.error('Error creating default settings:', error);
    }
  };

  // Load account statistics
  const loadAccountStats = async () => {
    if (!user?.id) return;

    try {
      const userStatsRef = doc(db, 'userStats', user.id);
      const statsDoc = await getDoc(userStatsRef);

      if (statsDoc.exists()) {
        const data = statsDoc.data();
        setAccountStats({
          accountCreated: data.accountCreated?.toDate() || null,
          lastLogin: data.lastLogin?.toDate() || null,
          totalSessions: data.totalSessions || 0,
          dataUsage: data.dataUsage || 0
        });
      }
    } catch (error) {
      console.error('Error loading account stats:', error);
    }
  };

  // Load recent activity
  const loadRecentActivity = async () => {
    if (!user?.id) return;

    try {
      // This would typically load from an activity log collection
      // For now, we'll simulate some recent activity
      const mockActivity = [
        {
          id: '1',
          type: 'login',
          description: 'Logged in from Chrome on Windows',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          location: 'New York, NY'
        },
        {
          id: '2',
          type: 'settings',
          description: 'Updated notification preferences',
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
          location: 'New York, NY'
        },
        {
          id: '3',
          type: 'password',
          description: 'Password changed successfully',
          timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
          location: 'New York, NY'
        }
      ];

      setRecentActivity(mockActivity);
    } catch (error) {
      console.error('Error loading recent activity:', error);
    }
  };

  // Save settings to Firebase
  const saveSettings = async (section: keyof UserSettings, showSuccessMessage = true) => {
    if (!user?.id) return;

    setSaving(true);
    setError('');

    try {
      const userSettingsRef = doc(db, 'userSettings', user.id);

      await updateDoc(userSettingsRef, {
        [section]: userSettings[section],
        updatedAt: Timestamp.now()
      });

      if (showSuccessMessage) {
        setSaveMessage(`${section.charAt(0).toUpperCase() + section.slice(1)} settings saved successfully!`);
        setTimeout(() => setSaveMessage(''), 3000);
      }

      console.log(`${section} settings saved successfully`);
    } catch (error) {
      console.error(`Error saving ${section} settings:`, error);
      setError(`Failed to save ${section} settings. Please try again.`);
    } finally {
      setSaving(false);
    }
  };

  // Handle profile picture upload
  const handleProfilePictureUpload = async (file: File) => {
    if (!user?.id) return;

    setSaving(true);
    setError('');

    try {
      // Upload to Firebase Storage
      const storageRef = ref(storage, `profilePictures/${user.id}/${Date.now()}_${file.name}`);
      const uploadResult = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(uploadResult.ref);

      // Update user profile
      await updateProfile(auth.currentUser!, {
        photoURL: downloadURL
      });

      // Update settings
      setUserSettings(prev => ({
        ...prev,
        profile: {
          ...prev.profile,
          profilePicture: downloadURL
        }
      }));

      // Save to database
      await saveSettings('profile', false);

      setSaveMessage('Profile picture updated successfully!');
      setTimeout(() => setSaveMessage(''), 3000);

      // Clear preview
      setProfilePictureFile(null);
      setProfilePicturePreview(null);

    } catch (error) {
      console.error('Error uploading profile picture:', error);
      setError('Failed to upload profile picture. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Handle password change
  const handlePasswordChange = async () => {
    if (!user?.email || !auth.currentUser) return;

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      // Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email, passwordData.currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);

      // Update password
      await updatePassword(auth.currentUser, passwordData.newPassword);

      // Update security settings
      setUserSettings(prev => ({
        ...prev,
        security: {
          ...prev.security,
          passwordLastChanged: new Date()
        }
      }));

      await saveSettings('security', false);

      setSaveMessage('Password changed successfully!');
      setTimeout(() => setSaveMessage(''), 3000);

      // Clear password fields
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });

    } catch (error: any) {
      console.error('Error changing password:', error);
      if (error.code === 'auth/wrong-password') {
        setError('Current password is incorrect.');
      } else if (error.code === 'auth/weak-password') {
        setError('New password is too weak.');
      } else {
        setError('Failed to change password. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  // Handle email change
  const handleEmailChange = async (newEmail: string) => {
    if (!auth.currentUser) return;

    setSaving(true);
    setError('');

    try {
      await updateEmail(auth.currentUser, newEmail);

      setUserSettings(prev => ({
        ...prev,
        profile: {
          ...prev.profile,
          email: newEmail
        }
      }));

      await saveSettings('profile', false);

      setSaveMessage('Email updated successfully!');
      setTimeout(() => setSaveMessage(''), 3000);

    } catch (error: any) {
      console.error('Error updating email:', error);
      if (error.code === 'auth/email-already-in-use') {
        setError('This email is already in use by another account.');
      } else if (error.code === 'auth/invalid-email') {
        setError('Invalid email address.');
      } else {
        setError('Failed to update email. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  // Handle profile picture file selection
  const handleProfilePictureSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError('Profile picture must be less than 5MB.');
        return;
      }

      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file.');
        return;
      }

      setProfilePictureFile(file);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfilePicturePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Export user data
  const exportUserData = async () => {
    setSaving(true);
    try {
      const dataToExport = {
        profile: userSettings.profile,
        settings: {
          notifications: userSettings.notifications,
          privacy: userSettings.privacy,
          appearance: userSettings.appearance,
          learning: userSettings.learning
        },
        accountStats,
        recentActivity,
        exportedAt: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `user-data-${user?.id}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSaveMessage('User data exported successfully!');
      setTimeout(() => setSaveMessage(''), 3000);

    } catch (error) {
      console.error('Error exporting user data:', error);
      setError('Failed to export user data. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Delete account
  const handleDeleteAccount = async () => {
    if (!auth.currentUser || !user?.id) return;

    setSaving(true);
    setError('');

    try {
      // Delete user data from Firestore
      const userSettingsRef = doc(db, 'userSettings', user.id);
      await updateDoc(userSettingsRef, {
        deleted: true,
        deletedAt: Timestamp.now()
      });

      // Delete profile picture from storage if exists
      if (userSettings.profile.profilePicture) {
        try {
          const pictureRef = ref(storage, userSettings.profile.profilePicture);
          await deleteObject(pictureRef);
        } catch (error) {
          console.warn('Could not delete profile picture:', error);
        }
      }

      // Delete Firebase Auth account
      await auth.currentUser.delete();

      // Logout
      await logout();

    } catch (error: any) {
      console.error('Error deleting account:', error);
      if (error.code === 'auth/requires-recent-login') {
        setError('Please log out and log back in before deleting your account.');
      } else {
        setError('Failed to delete account. Please try again.');
      }
    } finally {
      setSaving(false);
      setShowConfirmDialog(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User, description: 'Personal information and account details' },
    { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Manage your notification preferences' },
    { id: 'privacy', label: 'Privacy', icon: Shield, description: 'Control your privacy and data sharing' },
    { id: 'appearance', label: 'Appearance', icon: Palette, description: 'Customize your interface' },
    { id: 'security', label: 'Security', icon: Lock, description: 'Password and security settings' },
    { id: 'learning', label: 'Learning', icon: Zap, description: 'Learning preferences and goals' },
    { id: 'data', label: 'Data & Privacy', icon: Database, description: 'Export data and account management' }
  ];

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="h-8 bg-gray-200 rounded w-32 animate-pulse mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-64 animate-pulse"></div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading your settings...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Settings Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
              <p className="text-gray-600 mt-1">Manage your account preferences and settings</p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={exportUserData}
                disabled={saving}
                className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                title="Export your data"
              >
                <Download className="w-4 h-4" />
                <span>Export Data</span>
              </button>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <Activity className="w-4 h-4" />
                <span>Last updated: {new Date().toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap border-b border-gray-200">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors min-w-0 ${
                  activeTab === tab.id
                    ? 'border-green-600 text-green-600 bg-green-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
                title={tab.description}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Status Messages */}
      {saveMessage && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center space-x-3">
            <Check className="w-5 h-5 text-green-600" />
            <p className="text-green-800">{saveMessage}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-800">{error}</p>
            <button
              onClick={() => setError('')}
              className="ml-auto text-red-600 hover:text-red-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Enhanced Profile Settings */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          {/* Profile Picture Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Profile Picture</h2>
            </div>
            <div className="p-6">
              <div className="flex items-center space-x-6">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200">
                    {profilePicturePreview || userSettings.profile.profilePicture ? (
                      <img
                        src={profilePicturePreview || userSettings.profile.profilePicture}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                  </div>
                  {profilePicturePreview && (
                    <button
                      onClick={() => {
                        setProfilePicturePreview(null);
                        setProfilePictureFile(null);
                      }}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProfilePictureSelect}
                        className="hidden"
                      />
                      <div className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                        <Camera className="w-4 h-4" />
                        <span>Choose Photo</span>
                      </div>
                    </label>
                    {profilePictureFile && (
                      <button
                        onClick={() => handleProfilePictureUpload(profilePictureFile)}
                        disabled={saving}
                        className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        <Upload className="w-4 h-4" />
                        <span>{saving ? 'Uploading...' : 'Upload'}</span>
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    JPG, PNG or GIF. Max size 5MB.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Basic Information */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Basic Information</h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={userSettings.profile.displayName}
                    onChange={(e) => setUserSettings(prev => ({
                      ...prev,
                      profile: { ...prev.profile, displayName: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Enter your display name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="email"
                      value={userSettings.profile.email}
                      onChange={(e) => setUserSettings(prev => ({
                        ...prev,
                        profile: { ...prev.profile, email: e.target.value }
                      }))}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Enter your email"
                    />
                    {userSettings.profile.email !== user?.email && (
                      <button
                        onClick={() => handleEmailChange(userSettings.profile.email)}
                        disabled={saving}
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        Update
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={userSettings.profile.phoneNumber}
                    onChange={(e) => setUserSettings(prev => ({
                      ...prev,
                      profile: { ...prev.profile, phoneNumber: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Enter your phone number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    value={userSettings.profile.location}
                    onChange={(e) => setUserSettings(prev => ({
                      ...prev,
                      profile: { ...prev.profile, location: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="City, Country"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Website
                  </label>
                  <input
                    type="url"
                    value={userSettings.profile.website}
                    onChange={(e) => setUserSettings(prev => ({
                      ...prev,
                      profile: { ...prev.profile, website: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="https://yourwebsite.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Occupation
                  </label>
                  <input
                    type="text"
                    value={userSettings.profile.occupation}
                    onChange={(e) => setUserSettings(prev => ({
                      ...prev,
                      profile: { ...prev.profile, occupation: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Your job title or profession"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bio
                </label>
                <textarea
                  value={userSettings.profile.bio}
                  onChange={(e) => setUserSettings(prev => ({
                    ...prev,
                    profile: { ...prev.profile, bio: e.target.value }
                  }))}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Tell us about yourself..."
                />
                <p className="text-sm text-gray-500 mt-1">
                  {userSettings.profile.bio.length}/500 characters
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => saveSettings('profile')}
                  disabled={saving}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Saving...' : 'Save Profile'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Security Settings */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          {/* Password Change */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Change Password</h2>
              <p className="text-gray-600 mt-1">Update your password to keep your account secure</p>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Enter your current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-gray-400" />
                    ) : (
                      <Eye className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Enter new password"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Must be at least 6 characters long
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Confirm new password"
                  />
                  {passwordData.newPassword && passwordData.confirmPassword &&
                   passwordData.newPassword !== passwordData.confirmPassword && (
                    <p className="text-sm text-red-600 mt-1">
                      Passwords do not match
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handlePasswordChange}
                  disabled={saving || !passwordData.currentPassword || !passwordData.newPassword ||
                           passwordData.newPassword !== passwordData.confirmPassword}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Key className="w-4 h-4" />
                  <span>{saving ? 'Changing...' : 'Change Password'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Security Information */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Security Information</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <Shield className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Two-Factor Authentication</h4>
                    <p className="text-sm text-gray-600">Add an extra layer of security to your account</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={userSettings.security.twoFactorEnabled}
                    onChange={(e) => setUserSettings(prev => ({
                      ...prev,
                      security: { ...prev.security, twoFactorEnabled: e.target.checked }
                    }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Bell className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Login Notifications</h4>
                    <p className="text-sm text-gray-600">Get notified when someone logs into your account</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={userSettings.security.loginNotifications}
                    onChange={(e) => setUserSettings(prev => ({
                      ...prev,
                      security: { ...prev.security, loginNotifications: e.target.checked }
                    }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                </label>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">Session Timeout</h4>
                  <span className="text-sm text-gray-600">{userSettings.security.sessionTimeout} minutes</span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="120"
                  step="15"
                  value={userSettings.security.sessionTimeout}
                  onChange={(e) => setUserSettings(prev => ({
                    ...prev,
                    security: { ...prev.security, sessionTimeout: parseInt(e.target.value) }
                  }))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>15 min</span>
                  <span>2 hours</span>
                </div>
              </div>

              {userSettings.security.passwordLastChanged && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Info className="w-4 h-4 text-blue-600" />
                    <p className="text-sm text-blue-800">
                      Password last changed: {userSettings.security.passwordLastChanged.toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={() => saveSettings('security')}
                  disabled={saving}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Saving...' : 'Save Security Settings'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Notification Settings */}
      {activeTab === 'notifications' && (
        <div className="space-y-6">
          {/* Basic Notifications */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Notification Preferences</h2>
              <p className="text-gray-600 mt-1">Choose how you want to be notified about important updates</p>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Mail className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Email Notifications</h4>
                      <p className="text-sm text-gray-600">Receive notifications via email</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userSettings.notifications.emailNotifications}
                      onChange={(e) => setUserSettings(prev => ({
                        ...prev,
                        notifications: { ...prev.notifications, emailNotifications: e.target.checked }
                      }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Smartphone className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Push Notifications</h4>
                      <p className="text-sm text-gray-600">Receive browser notifications</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userSettings.notifications.pushNotifications}
                      onChange={(e) => setUserSettings(prev => ({
                        ...prev,
                        notifications: { ...prev.notifications, pushNotifications: e.target.checked }
                      }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Assignment Reminders</h4>
                      <p className="text-sm text-gray-600">Get reminded about upcoming assignments</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userSettings.notifications.assignmentReminders}
                      onChange={(e) => setUserSettings(prev => ({
                        ...prev,
                        notifications: { ...prev.notifications, assignmentReminders: e.target.checked }
                      }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Grade Notifications</h4>
                      <p className="text-sm text-gray-600">Be notified when new grades are available</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userSettings.notifications.gradeNotifications}
                      onChange={(e) => setUserSettings(prev => ({
                        ...prev,
                        notifications: { ...prev.notifications, gradeNotifications: e.target.checked }
                      }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Course Updates</h4>
                      <p className="text-sm text-gray-600">Receive updates about your enrolled courses</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userSettings.notifications.courseUpdates}
                      onChange={(e) => setUserSettings(prev => ({
                        ...prev,
                        notifications: { ...prev.notifications, courseUpdates: e.target.checked }
                      }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                      <Bell className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">System Announcements</h4>
                      <p className="text-sm text-gray-600">Important platform updates and announcements</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userSettings.notifications.systemAnnouncements}
                      onChange={(e) => setUserSettings(prev => ({
                        ...prev,
                        notifications: { ...prev.notifications, systemAnnouncements: e.target.checked }
                      }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => saveSettings('notifications')}
                  disabled={saving}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Saving...' : 'Save Preferences'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Advanced Notification Settings */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Advanced Settings</h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Digest Frequency
                  </label>
                  <select
                    value={userSettings.notifications.digestFrequency}
                    onChange={(e) => setUserSettings(prev => ({
                      ...prev,
                      notifications: { ...prev.notifications, digestFrequency: e.target.value as any }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="never">Never</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">Notification Sound</h4>
                    <p className="text-sm text-gray-600">Play sound for notifications</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userSettings.notifications.notificationSound}
                      onChange={(e) => setUserSettings(prev => ({
                        ...prev,
                        notifications: { ...prev.notifications, notificationSound: e.target.checked }
                      }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-gray-900">Quiet Hours</h4>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userSettings.notifications.quietHours.enabled}
                      onChange={(e) => setUserSettings(prev => ({
                        ...prev,
                        notifications: {
                          ...prev.notifications,
                          quietHours: { ...prev.notifications.quietHours, enabled: e.target.checked }
                        }
                      }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>

                {userSettings.notifications.quietHours.enabled && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={userSettings.notifications.quietHours.start}
                        onChange={(e) => setUserSettings(prev => ({
                          ...prev,
                          notifications: {
                            ...prev.notifications,
                            quietHours: { ...prev.notifications.quietHours, start: e.target.value }
                          }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        End Time
                      </label>
                      <input
                        type="time"
                        value={userSettings.notifications.quietHours.end}
                        onChange={(e) => setUserSettings(prev => ({
                          ...prev,
                          notifications: {
                            ...prev.notifications,
                            quietHours: { ...prev.notifications.quietHours, end: e.target.value }
                          }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Privacy Settings */}
      {activeTab === 'privacy' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Privacy Settings</h2>
              <p className="text-gray-600 mt-1">Control who can see your information and activity</p>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Profile Visibility
                </label>
                <select
                  value={userSettings.privacy.profileVisibility}
                  onChange={(e) => setUserSettings(prev => ({
                    ...prev,
                    privacy: { ...prev.privacy, profileVisibility: e.target.value as any }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="private">Private - Only you can see your profile</option>
                  <option value="friends">Friends Only - Only your connections can see</option>
                  <option value="public">Public - Anyone can see your profile</option>
                </select>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Activity className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Show Learning Progress</h4>
                      <p className="text-sm text-gray-600">Allow others to see your learning progress and statistics</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userSettings.privacy.showProgress}
                      onChange={(e) => setUserSettings(prev => ({
                        ...prev,
                        privacy: { ...prev.privacy, showProgress: e.target.checked }
                      }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                      <Trophy className="w-5 h-5 text-yellow-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Show Achievements</h4>
                      <p className="text-sm text-gray-600">Display your achievements and badges on your profile</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userSettings.privacy.showAchievements}
                      onChange={(e) => setUserSettings(prev => ({
                        ...prev,
                        privacy: { ...prev.privacy, showAchievements: e.target.checked }
                      }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <Clock className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Show Activity Status</h4>
                      <p className="text-sm text-gray-600">Let others see when you're online and active</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userSettings.privacy.showActivity}
                      onChange={(e) => setUserSettings(prev => ({
                        ...prev,
                        privacy: { ...prev.privacy, showActivity: e.target.checked }
                      }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Mail className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Allow Messages</h4>
                      <p className="text-sm text-gray-600">Allow other users to send you direct messages</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userSettings.privacy.allowMessages}
                      onChange={(e) => setUserSettings(prev => ({
                        ...prev,
                        privacy: { ...prev.privacy, allowMessages: e.target.checked }
                      }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                      <Globe className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Show Email Address</h4>
                      <p className="text-sm text-gray-600">Display your email address on your public profile</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userSettings.privacy.showEmail}
                      onChange={(e) => setUserSettings(prev => ({
                        ...prev,
                        privacy: { ...prev.privacy, showEmail: e.target.checked }
                      }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => saveSettings('privacy')}
                  disabled={saving}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Saving...' : 'Save Privacy Settings'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Data Sharing Settings */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Data & Analytics</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <Database className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Data Sharing</h4>
                    <p className="text-sm text-gray-600">Share anonymized data to help improve the platform</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={userSettings.privacy.dataSharing}
                    onChange={(e) => setUserSettings(prev => ({
                      ...prev,
                      privacy: { ...prev.privacy, dataSharing: e.target.checked }
                    }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Activity className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Analytics Opt-out</h4>
                    <p className="text-sm text-gray-600">Opt out of usage analytics and tracking</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={userSettings.privacy.analyticsOptOut}
                    onChange={(e) => setUserSettings(prev => ({
                      ...prev,
                      privacy: { ...prev.privacy, analyticsOptOut: e.target.checked }
                    }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Appearance Settings */}
      {activeTab === 'appearance' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Theme & Display</h2>
              <p className="text-gray-600 mt-1">Customize how the interface looks and feels</p>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Theme Preference
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'light', label: 'Light', icon: Sun, description: 'Clean and bright' },
                    { value: 'dark', label: 'Dark', icon: Moon, description: 'Easy on the eyes' },
                    { value: 'auto', label: 'Auto', icon: Monitor, description: 'Follows system' }
                  ].map((theme) => {
                    const Icon = theme.icon;
                    return (
                      <button
                        key={theme.value}
                        onClick={() => setUserSettings(prev => ({
                          ...prev,
                          appearance: { ...prev.appearance, theme: theme.value as any }
                        }))}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          userSettings.appearance.theme === theme.value
                            ? 'border-green-600 bg-green-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Icon className={`w-6 h-6 mx-auto mb-2 ${
                          userSettings.appearance.theme === theme.value ? 'text-green-600' : 'text-gray-400'
                        }`} />
                        <div className="text-sm font-medium text-gray-900">{theme.label}</div>
                        <div className="text-xs text-gray-500">{theme.description}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Language
                  </label>
                  <select
                    value={userSettings.appearance.language}
                    onChange={(e) => setUserSettings(prev => ({
                      ...prev,
                      appearance: { ...prev.appearance, language: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="en">🇺🇸 English</option>
                    <option value="fr">🇫🇷 Français</option>
                    <option value="es">🇪🇸 Español</option>
                    <option value="de">🇩🇪 Deutsch</option>
                    <option value="zh">🇨🇳 中文</option>
                    <option value="ja">🇯🇵 日本語</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Timezone
                  </label>
                  <select
                    value={userSettings.appearance.timezone}
                    onChange={(e) => setUserSettings(prev => ({
                      ...prev,
                      appearance: { ...prev.appearance, timezone: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="UTC">UTC (Coordinated Universal Time)</option>
                    <option value="America/New_York">Eastern Time (ET)</option>
                    <option value="America/Chicago">Central Time (CT)</option>
                    <option value="America/Denver">Mountain Time (MT)</option>
                    <option value="America/Los_Angeles">Pacific Time (PT)</option>
                    <option value="Europe/London">London (GMT)</option>
                    <option value="Europe/Paris">Paris (CET)</option>
                    <option value="Asia/Tokyo">Tokyo (JST)</option>
                    <option value="Asia/Shanghai">Shanghai (CST)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date Format
                  </label>
                  <select
                    value={userSettings.appearance.dateFormat}
                    onChange={(e) => setUserSettings(prev => ({
                      ...prev,
                      appearance: { ...prev.appearance, dateFormat: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY (EU)</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                    <option value="DD MMM YYYY">DD MMM YYYY (Verbose)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Time Format
                  </label>
                  <select
                    value={userSettings.appearance.timeFormat}
                    onChange={(e) => setUserSettings(prev => ({
                      ...prev,
                      appearance: { ...prev.appearance, timeFormat: e.target.value as any }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="12h">12-hour (AM/PM)</option>
                    <option value="24h">24-hour</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Font Size
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'small', label: 'Small', size: 'text-sm' },
                    { value: 'medium', label: 'Medium', size: 'text-base' },
                    { value: 'large', label: 'Large', size: 'text-lg' }
                  ].map((size) => (
                    <button
                      key={size.value}
                      onClick={() => setUserSettings(prev => ({
                        ...prev,
                        appearance: { ...prev.appearance, fontSize: size.value as any }
                      }))}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        userSettings.appearance.fontSize === size.value
                          ? 'border-green-600 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className={`${size.size} font-medium ${
                        userSettings.appearance.fontSize === size.value ? 'text-green-600' : 'text-gray-900'
                      }`}>
                        {size.label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">Compact Mode</h4>
                    <p className="text-sm text-gray-600">Reduce spacing and padding for a denser layout</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userSettings.appearance.compactMode}
                      onChange={(e) => setUserSettings(prev => ({
                        ...prev,
                        appearance: { ...prev.appearance, compactMode: e.target.checked }
                      }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">Animations</h4>
                    <p className="text-sm text-gray-600">Enable smooth transitions and animations</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userSettings.appearance.animations}
                      onChange={(e) => setUserSettings(prev => ({
                        ...prev,
                        appearance: { ...prev.appearance, animations: e.target.checked }
                      }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => saveSettings('appearance')}
                  disabled={saving}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Saving...' : 'Save Appearance Settings'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Learning Preferences */}
      {activeTab === 'learning' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Learning Preferences</h2>
              <p className="text-gray-600 mt-1">Customize your learning experience and goals</p>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Daily Learning Goal (minutes)
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="range"
                      min="15"
                      max="180"
                      step="15"
                      value={userSettings.learning.dailyGoal}
                      onChange={(e) => setUserSettings(prev => ({
                        ...prev,
                        learning: { ...prev.learning, dailyGoal: parseInt(e.target.value) }
                      }))}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-sm font-medium text-gray-900 min-w-[60px]">
                      {userSettings.learning.dailyGoal} min
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>15 min</span>
                    <span>3 hours</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Daily Reminder Time
                  </label>
                  <input
                    type="time"
                    value={userSettings.learning.reminderTime}
                    onChange={(e) => setUserSettings(prev => ({
                      ...prev,
                      learning: { ...prev.learning, reminderTime: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Play className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Auto-play Videos</h4>
                      <p className="text-sm text-gray-600">Automatically play the next video in a course</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userSettings.learning.autoplay}
                      onChange={(e) => setUserSettings(prev => ({
                        ...prev,
                        learning: { ...prev.learning, autoplay: e.target.checked }
                      }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Show Subtitles</h4>
                      <p className="text-sm text-gray-600">Display subtitles by default for video content</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userSettings.learning.subtitles}
                      onChange={(e) => setUserSettings(prev => ({
                        ...prev,
                        learning: { ...prev.learning, subtitles: e.target.checked }
                      }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Default Playback Speed
                  </label>
                  <select
                    value={userSettings.learning.playbackSpeed}
                    onChange={(e) => setUserSettings(prev => ({
                      ...prev,
                      learning: { ...prev.learning, playbackSpeed: parseFloat(e.target.value) }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value={0.5}>0.5x (Slow)</option>
                    <option value={0.75}>0.75x</option>
                    <option value={1.0}>1.0x (Normal)</option>
                    <option value={1.25}>1.25x</option>
                    <option value={1.5}>1.5x</option>
                    <option value={2.0}>2.0x (Fast)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Download Quality
                  </label>
                  <select
                    value={userSettings.learning.downloadQuality}
                    onChange={(e) => setUserSettings(prev => ({
                      ...prev,
                      learning: { ...prev.learning, downloadQuality: e.target.value as any }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="low">Low (360p) - Saves data</option>
                    <option value="medium">Medium (720p) - Balanced</option>
                    <option value="high">High (1080p) - Best quality</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => saveSettings('learning')}
                  disabled={saving}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Saving...' : 'Save Learning Preferences'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Data & Privacy Management */}
      {activeTab === 'data' && (
        <div className="space-y-6">
          {/* Account Statistics */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Account Information</h2>
              <p className="text-gray-600 mt-1">View your account statistics and activity</p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Account Created</p>
                      <p className="font-semibold text-gray-900">
                        {accountStats.accountCreated?.toLocaleDateString() || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <Clock className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Last Login</p>
                      <p className="font-semibold text-gray-900">
                        {accountStats.lastLogin?.toLocaleDateString() || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-purple-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Activity className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Sessions</p>
                      <p className="font-semibold text-gray-900">{accountStats.totalSessions}</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-orange-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                      <Database className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Data Usage</p>
                      <p className="font-semibold text-gray-900">{(accountStats.dataUsage / 1024 / 1024).toFixed(1)} MB</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Recent Activity</h2>
            </div>
            <div className="p-6">
              {recentActivity.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No recent activity to display</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <Activity className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                        <p className="text-xs text-gray-500">
                          {activity.timestamp.toLocaleDateString()} at {activity.timestamp.toLocaleTimeString()} • {activity.location}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Data Management */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Data Management</h2>
              <p className="text-gray-600 mt-1">Export your data or manage your account</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Download className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Export Your Data</h4>
                    <p className="text-sm text-gray-600">Download a copy of all your data in JSON format</p>
                  </div>
                </div>
                <button
                  onClick={exportUserData}
                  disabled={saving}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>{saving ? 'Exporting...' : 'Export Data'}</span>
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                    <Trash2 className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Delete Account</h4>
                    <p className="text-sm text-gray-600">Permanently delete your account and all associated data</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setPendingAction('delete-account');
                    setShowConfirmDialog(true);
                  }}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Account</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Confirm Account Deletion</h3>
                  <p className="text-sm text-gray-600">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-gray-700 mb-6">
                Are you sure you want to delete your account? This will permanently remove all your data,
                including courses, progress, and settings. This action cannot be reversed.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowConfirmDialog(false);
                    setPendingAction(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {saving ? 'Deleting...' : 'Delete Account'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
