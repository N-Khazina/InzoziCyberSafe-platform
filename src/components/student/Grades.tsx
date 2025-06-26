import React, { useState, useEffect } from 'react';
import {
  Award,
  TrendingUp,
  BarChart3,
  Filter,
  Calendar,
  Search,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Target,
  BookOpen,
  Clock,
  Star,
  ArrowUp,
  ArrowDown,
  Eye,
  FileText,
  PieChart,
  Activity
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import GradingService, { Grade, GradeStats } from '../../services/gradingService';
import EnrollmentService from '../../services/enrollmentService';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  getDocs
} from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface GradeAnalytics {
  totalAssignments: number;
  averageScore: number;
  highestGrade: number;
  lowestGrade: number;
  improvementTrend: 'up' | 'down' | 'stable';
  recentPerformance: number;
  gradeDistribution: { [key: string]: number };
  missedAssignments: number;
}

interface CourseGradeData {
  courseId: string;
  courseName: string;
  grades: Grade[];
  stats: GradeStats;
  analytics: GradeAnalytics;
  currentGPA: number;
}

const Grades = () => {
  const { user } = useAuth();

  // Core data state
  const [grades, setGrades] = useState<Grade[]>([]);
  const [gradeStats, setGradeStats] = useState<{ [courseId: string]: GradeStats }>({});
  const [enrolledCourses, setEnrolledCourses] = useState<any[]>([]);
  const [courseGradeData, setCourseGradeData] = useState<CourseGradeData[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [selectedView, setSelectedView] = useState<'list' | 'analytics' | 'trends'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'grade' | 'course' | 'type'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedGradeType, setSelectedGradeType] = useState<string>('all');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<Grade | null>(null);

  // Analytics state
  const [overallGPA, setOverallGPA] = useState<number>(0);
  const [semesterGPA, setSemesterGPA] = useState<number>(0);
  const [gradeAnalytics, setGradeAnalytics] = useState<GradeAnalytics | null>(null);

  // Error handling
  const [error, setError] = useState<string | null>(null);

  // Enhanced data fetching with real-time updates and comprehensive analytics
  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const fetchComprehensiveGradeData = async () => {
      setLoading(true);
      setError(null);

      try {
        console.log('Fetching comprehensive grade data...');

        // Fetch enrolled courses first
        const enrollments = await EnrollmentService.getUserEnrollments(user.id);
        setEnrolledCourses(enrollments);

        // Set up real-time listener for grades
        const gradesQuery = query(
          collection(db, 'grades'),
          where('studentId', '==', user.id),
          orderBy('gradedAt', 'desc')
        );

        const unsubscribeGrades = onSnapshot(
          gradesQuery,
          async (snapshot) => {
            console.log(`Received ${snapshot.size} grades from real-time listener`);

            const gradesData: Grade[] = [];
            snapshot.forEach(doc => {
              const data = doc.data();
              gradesData.push({
                id: doc.id,
                studentId: data.studentId,
                courseId: data.courseId,
                assignmentId: data.assignmentId,
                title: data.title,
                type: data.type || 'assignment',
                points: data.points,
                maxPoints: data.maxPoints,
                percentage: data.percentage,
                letterGrade: data.letterGrade,
                feedback: data.feedback || '',
                gradedAt: data.gradedAt,
                gradedBy: data.gradedBy,
                isPublished: data.isPublished ?? true
              });
            });

            setGrades(gradesData);

            // Calculate comprehensive analytics
            await calculateComprehensiveAnalytics(gradesData, enrollments);

            console.log('Grades updated via real-time listener:', gradesData.length);
          },
          (error) => {
            console.error('Error in grades listener:', error);
            // Fallback to simple fetch
            fetchGradesFallback();
          }
        );

        // Cleanup function
        return () => {
          console.log('Cleaning up grades listener');
          unsubscribeGrades();
        };

      } catch (error) {
        console.error('Error setting up grade data:', error);
        setError('Failed to load grade data. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    };

    const unsubscribe = fetchComprehensiveGradeData();

    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [user?.id]);

  // Fallback function for grade fetching
  const fetchGradesFallback = async () => {
    try {
      console.log('Using fallback grade fetch...');

      // Simple query without complex ordering
      const gradesSnapshot = await getDocs(
        query(collection(db, 'grades'), where('studentId', '==', user!.id))
      );

      const gradesData: Grade[] = [];
      gradesSnapshot.forEach(doc => {
        const data = doc.data();
        gradesData.push({
          id: doc.id,
          studentId: data.studentId,
          courseId: data.courseId,
          assignmentId: data.assignmentId,
          title: data.title,
          type: data.type || 'assignment',
          points: data.points,
          maxPoints: data.maxPoints,
          percentage: data.percentage,
          letterGrade: data.letterGrade,
          feedback: data.feedback || '',
          gradedAt: data.gradedAt,
          gradedBy: data.gradedBy,
          isPublished: data.isPublished ?? true
        });
      });

      // Sort on client side
      gradesData.sort((a, b) => {
        if (a.gradedAt && b.gradedAt) {
          return b.gradedAt.seconds - a.gradedAt.seconds;
        }
        return 0;
      });

      setGrades(gradesData);

      // Calculate analytics with fallback data
      const enrollments = await EnrollmentService.getUserEnrollments(user!.id);
      await calculateComprehensiveAnalytics(gradesData, enrollments);

      console.log('Fallback grade fetch completed:', gradesData.length);

    } catch (error) {
      console.error('Fallback grade fetch failed:', error);
      setError('Failed to load grades. Please check your connection and try again.');
    }
  };

  // Calculate comprehensive analytics
  const calculateComprehensiveAnalytics = async (gradesData: Grade[], enrollments: any[]) => {
    try {
      // Calculate overall GPA
      const totalPoints = gradesData.reduce((sum, grade) => sum + grade.points, 0);
      const totalMaxPoints = gradesData.reduce((sum, grade) => sum + grade.maxPoints, 0);
      const overallGPA = totalMaxPoints > 0 ? (totalPoints / totalMaxPoints) * 4 : 0;
      setOverallGPA(overallGPA);

      // Calculate semester GPA (last 3 months)
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const recentGrades = gradesData.filter(grade =>
        grade.gradedAt && grade.gradedAt.toDate() >= threeMonthsAgo
      );
      const recentTotalPoints = recentGrades.reduce((sum, grade) => sum + grade.points, 0);
      const recentTotalMaxPoints = recentGrades.reduce((sum, grade) => sum + grade.maxPoints, 0);
      const semesterGPA = recentTotalMaxPoints > 0 ? (recentTotalPoints / recentTotalMaxPoints) * 4 : 0;
      setSemesterGPA(semesterGPA);

      // Calculate comprehensive analytics
      const analytics: GradeAnalytics = {
        totalAssignments: gradesData.length,
        averageScore: gradesData.length > 0
          ? gradesData.reduce((sum, g) => sum + g.percentage, 0) / gradesData.length
          : 0,
        highestGrade: gradesData.length > 0
          ? Math.max(...gradesData.map(g => g.percentage))
          : 0,
        lowestGrade: gradesData.length > 0
          ? Math.min(...gradesData.map(g => g.percentage))
          : 0,
        improvementTrend: calculateTrend(gradesData),
        recentPerformance: recentGrades.length > 0
          ? recentGrades.reduce((sum, g) => sum + g.percentage, 0) / recentGrades.length
          : 0,
        gradeDistribution: calculateGradeDistribution(gradesData),
        missedAssignments: 0 // This would need assignment data to calculate properly
      };

      setGradeAnalytics(analytics);

      // Calculate course-specific data
      const courseData: CourseGradeData[] = [];
      for (const enrollment of enrollments) {
        const courseGrades = gradesData.filter(g => g.courseId === enrollment.courseId);
        if (courseGrades.length > 0) {
          const courseTotalPoints = courseGrades.reduce((sum, g) => sum + g.points, 0);
          const courseTotalMaxPoints = courseGrades.reduce((sum, g) => sum + g.maxPoints, 0);
          const courseGPA = courseTotalMaxPoints > 0 ? (courseTotalPoints / courseTotalMaxPoints) * 4 : 0;

          courseData.push({
            courseId: enrollment.courseId,
            courseName: enrollment.courseTitle || 'Unknown Course',
            grades: courseGrades,
            stats: {
              totalPoints: courseTotalPoints,
              maxTotalPoints: courseTotalMaxPoints,
              averagePercentage: courseGrades.reduce((sum, g) => sum + g.percentage, 0) / courseGrades.length,
              letterGrade: GradingService.calculateLetterGrade(courseGrades.reduce((sum, g) => sum + g.percentage, 0) / courseGrades.length),
              gpa: courseGPA,
              assignmentCount: courseGrades.filter(g => g.type === 'assignment').length,
              quizCount: courseGrades.filter(g => g.type === 'quiz').length,
              examCount: courseGrades.filter(g => g.type === 'exam').length
            },
            analytics: {
              totalAssignments: courseGrades.length,
              averageScore: courseGrades.reduce((sum, g) => sum + g.percentage, 0) / courseGrades.length,
              highestGrade: Math.max(...courseGrades.map(g => g.percentage)),
              lowestGrade: Math.min(...courseGrades.map(g => g.percentage)),
              improvementTrend: calculateTrend(courseGrades),
              recentPerformance: courseGrades.slice(-3).reduce((sum, g) => sum + g.percentage, 0) / Math.min(3, courseGrades.length),
              gradeDistribution: calculateGradeDistribution(courseGrades),
              missedAssignments: 0
            },
            currentGPA: courseGPA
          });
        }
      }

      setCourseGradeData(courseData);

    } catch (error) {
      console.error('Error calculating analytics:', error);
    }
  };

  // Calculate improvement trend
  const calculateTrend = (grades: Grade[]): 'up' | 'down' | 'stable' => {
    if (grades.length < 2) return 'stable';

    const sortedGrades = [...grades].sort((a, b) => {
      if (a.gradedAt && b.gradedAt) {
        return a.gradedAt.seconds - b.gradedAt.seconds;
      }
      return 0;
    });

    const firstHalf = sortedGrades.slice(0, Math.floor(sortedGrades.length / 2));
    const secondHalf = sortedGrades.slice(Math.floor(sortedGrades.length / 2));

    const firstAvg = firstHalf.reduce((sum, g) => sum + g.percentage, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, g) => sum + g.percentage, 0) / secondHalf.length;

    const difference = secondAvg - firstAvg;
    if (difference > 2) return 'up';
    if (difference < -2) return 'down';
    return 'stable';
  };

  // Calculate grade distribution
  const calculateGradeDistribution = (grades: Grade[]): { [key: string]: number } => {
    const distribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };

    grades.forEach(grade => {
      const letter = grade.letterGrade || getLetterGrade(grade.percentage);
      if (letter in distribution) {
        distribution[letter as keyof typeof distribution]++;
      }
    });

    return distribution;
  };

  // Get letter grade from percentage
  const getLetterGrade = (percentage: number): string => {
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  };

  // Refresh data manually
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (user?.id) {
        await fetchGradesFallback();
      }
    } catch (error) {
      console.error('Error refreshing grades:', error);
      setError('Failed to refresh data. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  // Filter and sort grades
  const getFilteredAndSortedGrades = () => {
    let filtered = selectedCourse === 'all'
      ? grades
      : grades.filter(grade => grade.courseId === selectedCourse);

    // Apply search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(grade =>
        grade.title.toLowerCase().includes(term) ||
        grade.feedback?.toLowerCase().includes(term) ||
        getCourseTitle(grade.courseId).toLowerCase().includes(term) ||
        grade.type.toLowerCase().includes(term)
      );
    }

    // Apply grade type filter
    if (selectedGradeType !== 'all') {
      filtered = filtered.filter(grade => grade.type === selectedGradeType);
    }

    // Sort grades
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date':
          if (a.gradedAt && b.gradedAt) {
            return sortOrder === 'desc'
              ? b.gradedAt.seconds - a.gradedAt.seconds
              : a.gradedAt.seconds - b.gradedAt.seconds;
          }
          return 0;
        case 'grade':
          return sortOrder === 'desc'
            ? b.percentage - a.percentage
            : a.percentage - b.percentage;
        case 'course':
          const courseA = getCourseTitle(a.courseId);
          const courseB = getCourseTitle(b.courseId);
          return sortOrder === 'desc'
            ? courseB.localeCompare(courseA)
            : courseA.localeCompare(courseB);
        case 'type':
          return sortOrder === 'desc'
            ? b.type.localeCompare(a.type)
            : a.type.localeCompare(b.type);
        default:
          return 0;
      }
    });

    return filtered;
  };

  // Get course title by ID
  const getCourseTitle = (courseId: string) => {
    const enrollment = enrolledCourses.find(e => e.courseId === courseId);
    return enrollment?.courseTitle || 'Unknown Course';
  };

  // Get grade color based on percentage
  const getGradeColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600 bg-green-50 border-green-200';
    if (percentage >= 80) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (percentage >= 70) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    if (percentage >= 60) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  // Get unique grade types
  const getGradeTypes = () => {
    const types = [...new Set(grades.map(g => g.type))];
    return types;
  };

  // Handle sort change
  const handleSortChange = (newSortBy: typeof sortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
  };

  // Get filtered grades
  const filteredGrades = getFilteredAndSortedGrades();



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
              <p className="text-gray-600">Loading your grades...</p>
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
              <h3 className="text-lg font-medium text-red-900">Error Loading Grades</h3>
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

  return (
    <div className="space-y-6">
      {/* Enhanced Header with Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-gray-900">Grades</h1>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              title="Refresh grades"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
            {/* View Toggle */}
            <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setSelectedView('list')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  selectedView === 'list'
                    ? 'bg-white text-green-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                List
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
                onClick={() => setSelectedView('trends')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  selectedView === 'trends'
                    ? 'bg-white text-green-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Trends
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

      {/* Enhanced Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl shadow-sm border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-700">Overall GPA</p>
              <p className="text-3xl font-bold text-green-900">{overallGPA.toFixed(2)}</p>
              <div className="flex items-center space-x-1 mt-1">
                <span className="text-sm text-green-600">
                  {gradeAnalytics?.improvementTrend === 'up' ? '↗️ Improving' :
                   gradeAnalytics?.improvementTrend === 'down' ? '↘️ Declining' : '→ Stable'}
                </span>
              </div>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Award className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl shadow-sm border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-700">Total Assignments</p>
              <p className="text-3xl font-bold text-blue-900">{grades.length}</p>
              <p className="text-sm text-blue-600 mt-1">
                {grades.filter(g => g.type === 'assignment').length} assignments, {grades.filter(g => g.type === 'quiz').length} quizzes
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl shadow-sm border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-700">Average Score</p>
              <p className="text-3xl font-bold text-purple-900">
                {gradeAnalytics?.averageScore ? Math.round(gradeAnalytics.averageScore) : 0}%
              </p>
              <p className="text-sm text-purple-600 mt-1">
                Recent: {gradeAnalytics?.recentPerformance ? Math.round(gradeAnalytics.recentPerformance) : 0}%
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-yellow-50 p-6 rounded-xl shadow-sm border border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-700">Semester GPA</p>
              <p className="text-3xl font-bold text-orange-900">{semesterGPA.toFixed(2)}</p>
              <p className="text-sm text-orange-600 mt-1">Last 3 months</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Star className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Analytics View */}
      {selectedView === 'analytics' && gradeAnalytics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Grade Distribution */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Grade Distribution</h3>
            <div className="space-y-3">
              {Object.entries(gradeAnalytics.gradeDistribution).map(([grade, count]) => (
                <div key={grade} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                      grade === 'A' ? 'bg-green-100 text-green-700' :
                      grade === 'B' ? 'bg-blue-100 text-blue-700' :
                      grade === 'C' ? 'bg-yellow-100 text-yellow-700' :
                      grade === 'D' ? 'bg-orange-100 text-orange-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {grade}
                    </div>
                    <span className="font-medium text-gray-900">{count} assignments</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          grade === 'A' ? 'bg-green-500' :
                          grade === 'B' ? 'bg-blue-500' :
                          grade === 'C' ? 'bg-yellow-500' :
                          grade === 'D' ? 'bg-orange-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${(count / gradeAnalytics.totalAssignments) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-600">
                      {Math.round((count / gradeAnalytics.totalAssignments) * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Target className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-gray-900">Highest Grade</span>
                </div>
                <span className="text-lg font-bold text-green-600">{gradeAnalytics.highestGrade}%</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <span className="font-medium text-gray-900">Lowest Grade</span>
                </div>
                <span className="text-lg font-bold text-red-600">{gradeAnalytics.lowestGrade}%</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Activity className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-gray-900">Recent Performance</span>
                </div>
                <span className="text-lg font-bold text-blue-600">{Math.round(gradeAnalytics.recentPerformance)}%</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  {gradeAnalytics.improvementTrend === 'up' ? (
                    <ArrowUp className="w-5 h-5 text-green-600" />
                  ) : gradeAnalytics.improvementTrend === 'down' ? (
                    <ArrowDown className="w-5 h-5 text-red-600" />
                  ) : (
                    <Activity className="w-5 h-5 text-gray-600" />
                  )}
                  <span className="font-medium text-gray-900">Trend</span>
                </div>
                <span className={`text-lg font-bold ${
                  gradeAnalytics.improvementTrend === 'up' ? 'text-green-600' :
                  gradeAnalytics.improvementTrend === 'down' ? 'text-red-600' :
                  'text-gray-600'
                }`}>
                  {gradeAnalytics.improvementTrend === 'up' ? 'Improving' :
                   gradeAnalytics.improvementTrend === 'down' ? 'Declining' :
                   'Stable'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trends View */}
      {selectedView === 'trends' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Course Performance Trends</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courseGradeData.map((courseData) => (
              <div key={courseData.courseId} className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">{courseData.courseName}</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">GPA:</span>
                    <span className="font-medium">{courseData.currentGPA.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Average:</span>
                    <span className="font-medium">{Math.round(courseData.analytics.averageScore)}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Assignments:</span>
                    <span className="font-medium">{courseData.grades.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Trend:</span>
                    <span className={`font-medium ${
                      courseData.analytics.improvementTrend === 'up' ? 'text-green-600' :
                      courseData.analytics.improvementTrend === 'down' ? 'text-red-600' :
                      'text-gray-600'
                    }`}>
                      {courseData.analytics.improvementTrend === 'up' ? '↗️ Up' :
                       courseData.analytics.improvementTrend === 'down' ? '↘️ Down' :
                       '→ Stable'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Enhanced Grade List */}
      {selectedView === 'list' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
              <h2 className="text-xl font-semibold text-gray-900">Grade Details</h2>

              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search grades..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                {/* Course Filter */}
                <select
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="all">All Courses</option>
                  {enrolledCourses.map((enrollment) => (
                    <option key={enrollment.courseId} value={enrollment.courseId}>
                      {getCourseTitle(enrollment.courseId)}
                    </option>
                  ))}
                </select>

                {/* Grade Type Filter */}
                <select
                  value={selectedGradeType}
                  onChange={(e) => setSelectedGradeType(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="all">All Types</option>
                  <option value="assignment">Assignments</option>
                  <option value="quiz">Quizzes</option>
                  <option value="exam">Exams</option>
                  <option value="participation">Participation</option>
                </select>
              </div>
            </div>

            {/* Sort Controls */}
            <div className="mt-4 flex items-center space-x-4">
              <span className="text-sm text-gray-600">Sort by:</span>
              <div className="flex space-x-2">
                {[
                  { key: 'date', label: 'Date' },
                  { key: 'grade', label: 'Grade' },
                  { key: 'course', label: 'Course' },
                  { key: 'type', label: 'Type' }
                ].map((sort) => (
                  <button
                    key={sort.key}
                    onClick={() => handleSortChange(sort.key as typeof sortBy)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      sortBy === sort.key
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {sort.label}
                    {sortBy === sort.key && (
                      <span className="ml-1">
                        {sortOrder === 'desc' ? '↓' : '↑'}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-6">
            {/* Grades List */}
            <div className="space-y-4">
              {filteredGrades.length === 0 ? (
                <div className="text-center py-12">
                  <Award className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {searchTerm || selectedCourse !== 'all' || selectedGradeType !== 'all'
                      ? 'No grades match your criteria'
                      : 'No grades available yet'
                    }
                  </h3>
                  <p className="text-gray-600 mb-4">
                    {searchTerm || selectedCourse !== 'all' || selectedGradeType !== 'all'
                      ? 'Try adjusting your search or filter settings.'
                      : 'Grades will appear here once your assignments are graded.'
                    }
                  </p>
                  {(searchTerm || selectedCourse !== 'all' || selectedGradeType !== 'all') && (
                    <button
                      onClick={() => {
                        setSearchTerm('');
                        setSelectedCourse('all');
                        setSelectedGradeType('all');
                      }}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              ) : (
                filteredGrades.map((grade) => (
                  <div key={grade.id} className={`p-4 rounded-lg border-l-4 transition-all duration-200 hover:shadow-md ${
                    grade.percentage >= 90 ? 'bg-green-50 border-l-green-500' :
                    grade.percentage >= 80 ? 'bg-blue-50 border-l-blue-500' :
                    grade.percentage >= 70 ? 'bg-yellow-50 border-l-yellow-500' :
                    grade.percentage >= 60 ? 'bg-orange-50 border-l-orange-500' :
                    'bg-red-50 border-l-red-500'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1">
                        <div className={`px-3 py-1 rounded-full text-sm font-medium border ${getGradeColor(grade.percentage)}`}>
                          {grade.letterGrade}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className="font-semibold text-gray-900">{grade.title}</h4>
                            <span className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded-full">
                              {grade.type}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-1">{getCourseTitle(grade.courseId)}</p>
                          {grade.feedback && (
                            <p className="text-sm text-gray-500 italic">{grade.feedback}</p>
                          )}
                          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                            <div className="flex items-center space-x-1">
                              <Clock className="w-3 h-3" />
                              <span>
                                {grade.gradedAt?.toDate?.()?.toLocaleDateString() || 'Recently graded'}
                              </span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <FileText className="w-3 h-3" />
                              <span>Graded by instructor</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end space-y-1">
                        <div className="text-right">
                          <p className="text-2xl font-bold text-gray-900">{grade.points}</p>
                          <p className="text-sm text-gray-600">out of {grade.maxPoints}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-gray-900">{grade.percentage}%</p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedGrade(grade);
                            setShowDetailModal(true);
                          }}
                          className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          <Eye className="w-4 h-4 inline mr-1" />
                          Details
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Grade Detail Modal */}
      {showDetailModal && selectedGrade && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">Grade Details</h3>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-900 text-lg">{selectedGrade.title}</h4>
                  <p className="text-gray-600">{getCourseTitle(selectedGrade.courseId)} • {selectedGrade.type}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Score</p>
                    <p className="text-2xl font-bold text-gray-900">{selectedGrade.points}/{selectedGrade.maxPoints}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Percentage</p>
                    <p className="text-2xl font-bold text-gray-900">{selectedGrade.percentage}%</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Letter Grade</p>
                    <p className="text-2xl font-bold text-gray-900">{selectedGrade.letterGrade}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Graded On</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {selectedGrade.gradedAt?.toDate?.()?.toLocaleDateString() || 'Recently'}
                    </p>
                  </div>
                </div>

                {selectedGrade.feedback && (
                  <div>
                    <h5 className="font-medium text-gray-900 mb-2">Instructor Feedback</h5>
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <p className="text-gray-700">{selectedGrade.feedback}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Grades;
