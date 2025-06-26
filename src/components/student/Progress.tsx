import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Target,
  Clock,
  Award,
  BookOpen,
  Flame,
  Calendar,
  Star,
  Trophy,
  Zap,
  Activity,
  CheckCircle,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Filter,
  Download,
  Eye,
  Users,
  Brain,
  Lightbulb,
  Medal,
  Crown,
  Rocket,
  AlertCircle,
  TrendingDown
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import ProgressService from '../../services/progressService';
import EnrollmentService from '../../services/enrollmentService';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: Date;
  progress: number;
  maxProgress: number;
  category: 'learning' | 'streak' | 'completion' | 'time' | 'social';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

interface LearningGoal {
  id: string;
  title: string;
  description: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  deadline?: Date;
  completed: boolean;
  category: 'daily' | 'weekly' | 'monthly' | 'custom';
}

interface ProgressAnalytics {
  totalCoursesEnrolled: number;
  coursesCompleted: number;
  totalLessonsCompleted: number;
  totalTimeSpent: number;
  averageSessionTime: number;
  weeklyProgress: any[];
  courseProgress: any[];
  monthlyStats: any[];
  learningVelocity: number;
  consistencyScore: number;
  focusScore: number;
  improvementRate: number;
}

const Progress = () => {
  const { user } = useAuth();

  // Core data state
  const [analytics, setAnalytics] = useState<ProgressAnalytics | null>(null);
  const [learningStreak, setLearningStreak] = useState<number>(0);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [learningGoals, setLearningGoals] = useState<LearningGoal[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<any[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedView, setSelectedView] = useState<'overview' | 'analytics' | 'achievements' | 'goals'>('overview');
  const [selectedTimeframe, setSelectedTimeframe] = useState<'week' | 'month' | 'year'>('month');
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);

  // Analytics state
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [comparisonData, setComparisonData] = useState<any>(null);

  // Error handling
  const [error, setError] = useState<string | null>(null);

  // Enhanced data fetching with real-time updates and comprehensive analytics
  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const fetchComprehensiveProgressData = async () => {
      setLoading(true);
      setError(null);

      try {
        console.log('Fetching comprehensive progress data...');

        // Fetch enrolled courses first
        const enrollments = await EnrollmentService.getUserEnrollments(user.id);
        setEnrolledCourses(enrollments);

        // Set up real-time listener for progress data
        const progressQuery = query(
          collection(db, 'progress'),
          where('studentId', '==', user.id),
          orderBy('lastActivity', 'desc')
        );

        const unsubscribeProgress = onSnapshot(
          progressQuery,
          async (snapshot) => {
            console.log(`Received ${snapshot.size} progress records from real-time listener`);

            // Process progress data
            const progressData: any[] = [];
            snapshot.forEach(doc => {
              const data = doc.data();
              progressData.push({
                id: doc.id,
                courseId: data.courseId,
                studentId: data.studentId,
                lessonsCompleted: data.lessonsCompleted || 0,
                totalLessons: data.totalLessons || 0,
                overallProgress: data.overallProgress || 0,
                timeSpent: data.timeSpent || 0,
                lastActivity: data.lastActivity,
                completedLessons: data.completedLessons || [],
                quizScores: data.quizScores || [],
                sessionCount: data.sessionCount || 0
              });
            });

            // Calculate comprehensive analytics
            await calculateComprehensiveAnalytics(progressData, enrollments);

            console.log('Progress updated via real-time listener:', progressData.length);
          },
          (error) => {
            console.error('Error in progress listener:', error);
            // Fallback to simple fetch
            fetchProgressFallback();
          }
        );

        // Fetch achievements and goals
        await Promise.all([
          fetchAchievements(),
          fetchLearningGoals(),
          fetchLearningStreak()
        ]);

        // Cleanup function
        return () => {
          console.log('Cleaning up progress listener');
          unsubscribeProgress();
        };

      } catch (error) {
        console.error('Error setting up progress data:', error);
        setError('Failed to load progress data. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    };

    const unsubscribe = fetchComprehensiveProgressData();

    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [user?.id]);

  // Fallback function for progress fetching
  const fetchProgressFallback = async () => {
    try {
      console.log('Using fallback progress fetch...');

      // Simple query without complex ordering
      const progressSnapshot = await getDocs(
        query(collection(db, 'progress'), where('studentId', '==', user!.id))
      );

      const progressData: any[] = [];
      progressSnapshot.forEach(doc => {
        const data = doc.data();
        progressData.push({
          id: doc.id,
          courseId: data.courseId,
          studentId: data.studentId,
          lessonsCompleted: data.lessonsCompleted || 0,
          totalLessons: data.totalLessons || 0,
          overallProgress: data.overallProgress || 0,
          timeSpent: data.timeSpent || 0,
          lastActivity: data.lastActivity,
          completedLessons: data.completedLessons || [],
          quizScores: data.quizScores || [],
          sessionCount: data.sessionCount || 0
        });
      });

      // Calculate analytics with fallback data
      const enrollments = await EnrollmentService.getUserEnrollments(user!.id);
      await calculateComprehensiveAnalytics(progressData, enrollments);

      console.log('Fallback progress fetch completed:', progressData.length);

    } catch (error) {
      console.error('Fallback progress fetch failed:', error);
      setError('Failed to load progress data. Please check your connection and try again.');
    }
  };

  // Calculate comprehensive analytics
  const calculateComprehensiveAnalytics = async (progressData: any[], enrollments: any[]) => {
    try {
      // Basic calculations
      const totalCoursesEnrolled = enrollments.length;
      const coursesCompleted = progressData.filter(p => p.overallProgress >= 100).length;
      const totalLessonsCompleted = progressData.reduce((sum, p) => sum + p.lessonsCompleted, 0);
      const totalTimeSpent = progressData.reduce((sum, p) => sum + p.timeSpent, 0);
      const totalSessions = progressData.reduce((sum, p) => sum + p.sessionCount, 0);

      // Advanced calculations
      const averageSessionTime = totalSessions > 0 ? totalTimeSpent / totalSessions : 0;
      const learningVelocity = calculateLearningVelocity(progressData);
      const consistencyScore = calculateConsistencyScore(progressData);
      const focusScore = calculateFocusScore(progressData);
      const improvementRate = calculateImprovementRate(progressData);

      // Generate weekly and monthly data
      const weeklyProgress = generateWeeklyData(progressData);
      const monthlyStats = generateMonthlyData(progressData);

      // Course progress with enriched data
      const courseProgress = progressData.map(progress => {
        const enrollment = enrollments.find(e => e.courseId === progress.courseId);
        return {
          ...progress,
          courseTitle: enrollment?.courseTitle || 'Unknown Course',
          instructor: enrollment?.instructor || 'Unknown',
          enrolledAt: enrollment?.enrolledAt,
          progress: progress.overallProgress
        };
      });

      const analytics: ProgressAnalytics = {
        totalCoursesEnrolled,
        coursesCompleted,
        totalLessonsCompleted,
        totalTimeSpent,
        averageSessionTime,
        weeklyProgress,
        courseProgress,
        monthlyStats,
        learningVelocity,
        consistencyScore,
        focusScore,
        improvementRate
      };

      setAnalytics(analytics);
      setWeeklyData(weeklyProgress);
      setMonthlyData(monthlyStats);

      // Calculate comparison data
      const comparison = calculateComparisonData(analytics);
      setComparisonData(comparison);

    } catch (error) {
      console.error('Error calculating analytics:', error);
    }
  };

  // Fetch achievements
  const fetchAchievements = async () => {
    try {
      // Generate achievements based on progress
      const achievementsList: Achievement[] = [
        {
          id: 'first-course',
          title: 'First Steps',
          description: 'Enrolled in your first course',
          icon: 'BookOpen',
          unlocked: enrolledCourses.length > 0,
          progress: Math.min(enrolledCourses.length, 1),
          maxProgress: 1,
          category: 'learning',
          rarity: 'common'
        },
        {
          id: 'course-completer',
          title: 'Course Completer',
          description: 'Completed your first course',
          icon: 'Award',
          unlocked: analytics?.coursesCompleted > 0,
          progress: Math.min(analytics?.coursesCompleted || 0, 1),
          maxProgress: 1,
          category: 'completion',
          rarity: 'rare'
        },
        {
          id: 'week-warrior',
          title: 'Week Warrior',
          description: 'Maintained a 7-day learning streak',
          icon: 'Flame',
          unlocked: learningStreak >= 7,
          progress: Math.min(learningStreak, 7),
          maxProgress: 7,
          category: 'streak',
          rarity: 'rare'
        },
        {
          id: 'lesson-master',
          title: 'Lesson Master',
          description: 'Completed 50 lessons',
          icon: 'Target',
          unlocked: (analytics?.totalLessonsCompleted || 0) >= 50,
          progress: Math.min(analytics?.totalLessonsCompleted || 0, 50),
          maxProgress: 50,
          category: 'learning',
          rarity: 'epic'
        },
        {
          id: 'time-scholar',
          title: 'Time Scholar',
          description: 'Spent 100 hours learning',
          icon: 'Clock',
          unlocked: (analytics?.totalTimeSpent || 0) >= 360000, // 100 hours in seconds
          progress: Math.min(analytics?.totalTimeSpent || 0, 360000),
          maxProgress: 360000,
          category: 'time',
          rarity: 'epic'
        },
        {
          id: 'consistency-king',
          title: 'Consistency King',
          description: 'Achieved 90%+ consistency score',
          icon: 'Crown',
          unlocked: (analytics?.consistencyScore || 0) >= 90,
          progress: Math.min(analytics?.consistencyScore || 0, 90),
          maxProgress: 90,
          category: 'learning',
          rarity: 'legendary'
        }
      ];

      setAchievements(achievementsList);
    } catch (error) {
      console.error('Error fetching achievements:', error);
    }
  };

  // Fetch learning goals
  const fetchLearningGoals = async () => {
    try {
      // Generate default learning goals
      const goals: LearningGoal[] = [
        {
          id: 'daily-lesson',
          title: 'Daily Learning',
          description: 'Complete at least 1 lesson per day',
          targetValue: 1,
          currentValue: 0, // This would be calculated based on today's activity
          unit: 'lessons',
          completed: false,
          category: 'daily'
        },
        {
          id: 'weekly-time',
          title: 'Weekly Study Time',
          description: 'Study for 5 hours this week',
          targetValue: 18000, // 5 hours in seconds
          currentValue: 0, // This would be calculated based on this week's activity
          unit: 'seconds',
          completed: false,
          category: 'weekly'
        },
        {
          id: 'monthly-courses',
          title: 'Monthly Progress',
          description: 'Complete 1 course this month',
          targetValue: 1,
          currentValue: 0, // This would be calculated based on this month's completions
          unit: 'courses',
          completed: false,
          category: 'monthly'
        }
      ];

      setLearningGoals(goals);
    } catch (error) {
      console.error('Error fetching learning goals:', error);
    }
  };

  // Fetch learning streak
  const fetchLearningStreak = async () => {
    try {
      const streak = await ProgressService.getLearningStreak(user!.id);
      setLearningStreak(streak);
    } catch (error) {
      console.error('Error fetching learning streak:', error);
      setLearningStreak(0);
    }
  };

  // Utility calculation functions
  const calculateLearningVelocity = (progressData: any[]): number => {
    if (progressData.length === 0) return 0;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const recentProgress = progressData.filter(p =>
      p.lastActivity && p.lastActivity.toDate() >= thirtyDaysAgo
    );

    const totalLessons = recentProgress.reduce((sum, p) => sum + p.lessonsCompleted, 0);
    return totalLessons / 30; // lessons per day
  };

  const calculateConsistencyScore = (progressData: any[]): number => {
    if (progressData.length === 0) return 0;

    // Calculate based on regular activity patterns
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const recentActivity = progressData.filter(p =>
      p.lastActivity && p.lastActivity.toDate() >= sevenDaysAgo
    );

    const activeDays = new Set(
      recentActivity.map(p => p.lastActivity.toDate().toDateString())
    ).size;

    return Math.round((activeDays / 7) * 100);
  };

  const calculateFocusScore = (progressData: any[]): number => {
    if (progressData.length === 0) return 0;

    // Calculate based on session completion rates
    const totalSessions = progressData.reduce((sum, p) => sum + p.sessionCount, 0);
    const totalLessons = progressData.reduce((sum, p) => sum + p.lessonsCompleted, 0);

    if (totalSessions === 0) return 0;
    return Math.round((totalLessons / totalSessions) * 100);
  };

  const calculateImprovementRate = (progressData: any[]): number => {
    if (progressData.length < 2) return 0;

    // Calculate improvement over time
    const sortedData = [...progressData].sort((a, b) => {
      if (a.lastActivity && b.lastActivity) {
        return a.lastActivity.seconds - b.lastActivity.seconds;
      }
      return 0;
    });

    const firstHalf = sortedData.slice(0, Math.floor(sortedData.length / 2));
    const secondHalf = sortedData.slice(Math.floor(sortedData.length / 2));

    const firstAvg = firstHalf.reduce((sum, p) => sum + p.overallProgress, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, p) => sum + p.overallProgress, 0) / secondHalf.length;

    return Math.round(secondAvg - firstAvg);
  };

  const generateWeeklyData = (progressData: any[]): any[] => {
    const weeks = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const weekStart = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

      const weekProgress = progressData.filter(p => {
        if (!p.lastActivity) return false;
        const activityDate = p.lastActivity.toDate();
        return activityDate >= weekStart && activityDate < weekEnd;
      });

      const weekLessons = weekProgress.reduce((sum, p) => sum + p.lessonsCompleted, 0);

      weeks.push({
        week: `Week ${i + 1}`,
        progress: weekLessons,
        timeSpent: weekProgress.reduce((sum, p) => sum + p.timeSpent, 0)
      });
    }

    return weeks;
  };

  const generateMonthlyData = (progressData: any[]): any[] => {
    const months = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const monthProgress = progressData.filter(p => {
        if (!p.lastActivity) return false;
        const activityDate = p.lastActivity.toDate();
        return activityDate >= monthStart && activityDate <= monthEnd;
      });

      months.push({
        month: monthStart.toLocaleDateString('en-US', { month: 'short' }),
        lessons: monthProgress.reduce((sum, p) => sum + p.lessonsCompleted, 0),
        timeSpent: monthProgress.reduce((sum, p) => sum + p.timeSpent, 0),
        courses: monthProgress.filter(p => p.overallProgress >= 100).length
      });
    }

    return months;
  };

  const calculateComparisonData = (analytics: ProgressAnalytics): any => {
    // This would typically compare with other students or benchmarks
    return {
      lessonsVsAverage: analytics.totalLessonsCompleted > 25 ? 'above' : 'below',
      timeVsAverage: analytics.totalTimeSpent > 36000 ? 'above' : 'below', // 10 hours
      streakVsAverage: learningStreak > 3 ? 'above' : 'below'
    };
  };

  // Refresh data manually
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (user?.id) {
        await fetchProgressFallback();
        await Promise.all([
          fetchAchievements(),
          fetchLearningGoals(),
          fetchLearningStreak()
        ]);
      }
    } catch (error) {
      console.error('Error refreshing progress:', error);
      setError('Failed to refresh data. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  // Format time spent
  const formatTimeSpent = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Get achievement icon
  const getAchievementIcon = (iconName: string) => {
    const icons: { [key: string]: any } = {
      BookOpen, Award, Flame, Target, Clock, Crown, Trophy, Medal, Star, Rocket
    };
    return icons[iconName] || Award;
  };

  // Get rarity color
  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'text-gray-600 bg-gray-100';
      case 'rare': return 'text-blue-600 bg-blue-100';
      case 'epic': return 'text-purple-600 bg-purple-100';
      case 'legendary': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-20 mb-2 animate-pulse"></div>
                  <div className="h-8 bg-gray-200 rounded w-16 mb-1 animate-pulse"></div>
                  <div className="h-3 bg-gray-200 rounded w-24 animate-pulse"></div>
                </div>
                <div className="w-12 h-12 bg-gray-200 rounded-lg animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading your progress...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-6 h-6 text-red-600" />
            <div>
              <h3 className="text-lg font-medium text-red-900">Error Loading Progress</h3>
              <p className="text-red-700 mt-1">{error}</p>
              <button
                onClick={handleRefresh}
                className="mt-3 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No data state
  if (!analytics) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <BarChart3 className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No Progress Data</h3>
        <p className="text-gray-600 mb-4">Start learning to see your progress analytics.</p>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          Refresh Data
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Header with Navigation and Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-gray-900">Progress</h1>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              title="Refresh progress"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
            {/* View Toggle */}
            <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setSelectedView('overview')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  selectedView === 'overview'
                    ? 'bg-white text-green-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setSelectedView('analytics')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  selectedView === 'analytics'
                    ? 'bg-white text-green-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Analytics
              </button>
              <button
                onClick={() => setSelectedView('achievements')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  selectedView === 'achievements'
                    ? 'bg-white text-green-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Achievements
              </button>
              <button
                onClick={() => setSelectedView('goals')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  selectedView === 'goals'
                    ? 'bg-white text-green-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Goals
              </button>
            </div>

            {/* Export Button */}
            <button className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* Enhanced Progress Overview */}
      {selectedView === 'overview' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl shadow-sm border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700">Courses Enrolled</p>
                  <p className="text-3xl font-bold text-green-900">{analytics.totalCoursesEnrolled}</p>
                  <div className="flex items-center space-x-1 mt-1">
                    <span className="text-sm text-green-600">{analytics.coursesCompleted} completed</span>
                    {comparisonData?.lessonsVsAverage === 'above' && (
                      <ArrowUp className="w-3 h-3 text-green-600" />
                    )}
                  </div>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl shadow-sm border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-700">Lessons Completed</p>
                  <p className="text-3xl font-bold text-blue-900">{analytics.totalLessonsCompleted}</p>
                  <div className="flex items-center space-x-1 mt-1">
                    <span className="text-sm text-blue-600">
                      {analytics.learningVelocity.toFixed(1)} per day
                    </span>
                    {comparisonData?.lessonsVsAverage === 'above' && (
                      <TrendingUp className="w-3 h-3 text-blue-600" />
                    )}
                  </div>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Target className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl shadow-sm border border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-700">Time Spent</p>
                  <p className="text-3xl font-bold text-purple-900">
                    {formatTimeSpent(analytics.totalTimeSpent)}
                  </p>
                  <div className="flex items-center space-x-1 mt-1">
                    <span className="text-sm text-purple-600">
                      Avg: {formatTimeSpent(analytics.averageSessionTime)}
                    </span>
                    {comparisonData?.timeVsAverage === 'above' && (
                      <ArrowUp className="w-3 h-3 text-purple-600" />
                    )}
                  </div>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-yellow-50 p-6 rounded-xl shadow-sm border border-orange-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-700">Learning Streak</p>
                  <p className="text-3xl font-bold text-orange-900">{learningStreak}</p>
                  <div className="flex items-center space-x-1 mt-1">
                    <span className="text-sm text-orange-600">
                      {learningStreak === 1 ? 'day' : 'days'}
                    </span>
                    {comparisonData?.streakVsAverage === 'above' && (
                      <Flame className="w-3 h-3 text-orange-600" />
                    )}
                  </div>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Flame className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Consistency Score</h3>
                <Activity className="w-5 h-5 text-gray-600" />
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-green-600 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${analytics.consistencyScore}%` }}
                    ></div>
                  </div>
                </div>
                <span className="text-2xl font-bold text-gray-900">{analytics.consistencyScore}%</span>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Based on your learning frequency
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Focus Score</h3>
                <Brain className="w-5 h-5 text-gray-600" />
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${analytics.focusScore}%` }}
                    ></div>
                  </div>
                </div>
                <span className="text-2xl font-bold text-gray-900">{analytics.focusScore}%</span>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Session completion rate
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Improvement Rate</h3>
                {analytics.improvementRate >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-green-600" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-600" />
                )}
              </div>
              <div className="flex items-center space-x-2">
                <span className={`text-2xl font-bold ${
                  analytics.improvementRate >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {analytics.improvementRate >= 0 ? '+' : ''}{analytics.improvementRate}%
                </span>
                <span className="text-sm text-gray-600">vs previous period</span>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Progress improvement trend
              </p>
            </div>
          </div>
        </>
      )}

      {/* Analytics View */}
      {selectedView === 'analytics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Weekly Progress Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Weekly Activity</h3>
            </div>
            <div className="p-6">
              {weeklyData.length === 0 ? (
                <div className="text-center py-8">
                  <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No activity data yet.</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Complete lessons to see your weekly progress.
                  </p>
                </div>
              ) : (
                <div className="flex items-end justify-between h-40 space-x-2">
                  {weeklyData.map((week: any, index: number) => (
                    <div key={index} className="flex flex-col items-center flex-1">
                      <div
                        className="bg-green-600 rounded-t w-full transition-all duration-300 hover:bg-green-700 cursor-pointer"
                        style={{
                          height: `${Math.max((week.progress / Math.max(...weeklyData.map((w: any) => w.progress))) * 100, 5)}%`,
                          minHeight: '4px'
                        }}
                        title={`${week.progress} lessons completed`}
                      ></div>
                      <span className="text-xs text-gray-600 mt-2">{week.week}</span>
                      <span className="text-xs text-gray-500">{week.progress}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Monthly Statistics */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Monthly Statistics</h3>
            </div>
            <div className="p-6">
              {monthlyData.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No monthly data yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {monthlyData.slice(-3).map((month: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <h4 className="font-medium text-gray-900">{month.month}</h4>
                        <p className="text-sm text-gray-600">
                          {month.lessons} lessons • {formatTimeSpent(month.timeSpent)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">{month.courses}</p>
                        <p className="text-xs text-gray-500">courses completed</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Course Progress */}
      {(selectedView === 'overview' || selectedView === 'analytics') && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Course Progress</h2>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <span>{analytics.coursesCompleted} of {analytics.totalCoursesEnrolled} completed</span>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {analytics.courseProgress.length === 0 ? (
                <div className="text-center py-12">
                  <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No courses enrolled yet</h3>
                  <p className="text-gray-600 mb-4">
                    Enroll in courses to track your progress and achievements.
                  </p>
                  <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                    Browse Courses
                  </button>
                </div>
              ) : (
                analytics.courseProgress.map((course: any) => (
                  <div key={course.courseId} className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{course.courseTitle}</h4>
                        <p className="text-sm text-gray-600">
                          {course.instructor} • {course.lessonsCompleted} of {course.totalLessons} lessons
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-gray-900">{course.progress}%</span>
                        <p className="text-xs text-gray-500">
                          {course.progress >= 100 ? 'Completed' : 'In Progress'}
                        </p>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all duration-300 ${
                          course.progress >= 100 ? 'bg-green-600' : 'bg-blue-600'
                        }`}
                        style={{ width: `${course.progress}%` }}
                      ></div>
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                      <span>Time spent: {formatTimeSpent(course.timeSpent)}</span>
                      <span>
                        Last activity: {course.lastActivity?.toDate?.()?.toLocaleDateString() || 'Never'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Achievements View */}
      {selectedView === 'achievements' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Achievements</h2>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Trophy className="w-4 h-4" />
                  <span>{achievements.filter(a => a.unlocked).length} of {achievements.length} unlocked</span>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {achievements.map((achievement) => {
                  const IconComponent = getAchievementIcon(achievement.icon);
                  return (
                    <div
                      key={achievement.id}
                      className={`p-4 rounded-lg border-2 transition-all duration-200 cursor-pointer hover:shadow-md ${
                        achievement.unlocked
                          ? `border-${achievement.rarity === 'legendary' ? 'yellow' : achievement.rarity === 'epic' ? 'purple' : achievement.rarity === 'rare' ? 'blue' : 'green'}-200 bg-${achievement.rarity === 'legendary' ? 'yellow' : achievement.rarity === 'epic' ? 'purple' : achievement.rarity === 'rare' ? 'blue' : 'green'}-50`
                          : 'border-gray-200 bg-gray-50'
                      }`}
                      onClick={() => setSelectedAchievement(achievement)}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          achievement.unlocked
                            ? getRarityColor(achievement.rarity)
                            : 'bg-gray-400 text-white'
                        }`}>
                          <IconComponent className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className="font-semibold text-gray-900">{achievement.title}</h4>
                            {achievement.rarity === 'legendary' && (
                              <Crown className="w-4 h-4 text-yellow-600" />
                            )}
                            {achievement.rarity === 'epic' && (
                              <Star className="w-4 h-4 text-purple-600" />
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{achievement.description}</p>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all duration-300 ${
                                achievement.unlocked ? 'bg-green-600' : 'bg-gray-400'
                              }`}
                              style={{ width: `${(achievement.progress / achievement.maxProgress) * 100}%` }}
                            ></div>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {achievement.progress} / {achievement.maxProgress}
                            {achievement.unlocked && achievement.unlockedAt && (
                              <span className="ml-2">• Unlocked {achievement.unlockedAt.toLocaleDateString()}</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Goals View */}
      {selectedView === 'goals' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Learning Goals</h2>
                <button
                  onClick={() => setShowGoalModal(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Add Goal
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {learningGoals.length === 0 ? (
                  <div className="text-center py-12">
                    <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No learning goals set</h3>
                    <p className="text-gray-600 mb-4">
                      Set learning goals to track your progress and stay motivated.
                    </p>
                    <button
                      onClick={() => setShowGoalModal(true)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Create Your First Goal
                    </button>
                  </div>
                ) : (
                  learningGoals.map((goal) => (
                    <div key={goal.id} className={`p-4 rounded-lg border-2 ${
                      goal.completed ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
                    }`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            goal.completed ? 'bg-green-600' : 'bg-gray-400'
                          }`}>
                            {goal.completed ? (
                              <CheckCircle className="w-5 h-5 text-white" />
                            ) : (
                              <Target className="w-5 h-5 text-white" />
                            )}
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">{goal.title}</h4>
                            <p className="text-sm text-gray-600">{goal.description}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            goal.category === 'daily' ? 'bg-blue-100 text-blue-700' :
                            goal.category === 'weekly' ? 'bg-purple-100 text-purple-700' :
                            goal.category === 'monthly' ? 'bg-orange-100 text-orange-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {goal.category}
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full transition-all duration-300 ${
                            goal.completed ? 'bg-green-600' : 'bg-blue-600'
                          }`}
                          style={{ width: `${Math.min((goal.currentValue / goal.targetValue) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <div className="flex items-center justify-between mt-2 text-sm text-gray-600">
                        <span>
                          {goal.unit === 'seconds' ? formatTimeSpent(goal.currentValue) : goal.currentValue} / {goal.unit === 'seconds' ? formatTimeSpent(goal.targetValue) : goal.targetValue} {goal.unit}
                        </span>
                        {goal.deadline && (
                          <span>Due: {goal.deadline.toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Achievement Detail Modal */}
      {selectedAchievement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">Achievement Details</h3>
                <button
                  onClick={() => setSelectedAchievement(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="text-center">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
                  selectedAchievement.unlocked
                    ? getRarityColor(selectedAchievement.rarity)
                    : 'bg-gray-400 text-white'
                }`}>
                  {React.createElement(getAchievementIcon(selectedAchievement.icon), { className: "w-10 h-10" })}
                </div>
                <h4 className="text-xl font-bold text-gray-900 mb-2">{selectedAchievement.title}</h4>
                <p className="text-gray-600 mb-4">{selectedAchievement.description}</p>
                <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                  <div
                    className={`h-3 rounded-full transition-all duration-300 ${
                      selectedAchievement.unlocked ? 'bg-green-600' : 'bg-gray-400'
                    }`}
                    style={{ width: `${(selectedAchievement.progress / selectedAchievement.maxProgress) * 100}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-600">
                  Progress: {selectedAchievement.progress} / {selectedAchievement.maxProgress}
                </p>
                {selectedAchievement.unlocked && selectedAchievement.unlockedAt && (
                  <p className="text-sm text-green-600 mt-2">
                    Unlocked on {selectedAchievement.unlockedAt.toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Progress;
