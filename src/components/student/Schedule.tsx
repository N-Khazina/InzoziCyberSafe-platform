import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle,
  BookOpen,
  FileText,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  Target,
  TrendingUp,
  Award,
  RefreshCw,
  Bell,
  CalendarDays
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import AssignmentService, { Assignment } from '../../services/assignmentService';
import EnrollmentService from '../../services/enrollmentService';
import ProgressService from '../../services/progressService';
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

interface StudySession {
  id: string;
  courseId: string;
  courseName: string;
  plannedDate: Date;
  duration: number; // in minutes
  completed: boolean;
  type: 'lesson' | 'assignment' | 'review';
}

interface CourseProgress {
  courseId: string;
  courseName: string;
  totalLessons: number;
  completedLessons: number;
  overallProgress: number;
  lastActivity: Date;
}

const Schedule = () => {
  const { user } = useAuth();

  // Core data state
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<any[]>([]);
  const [courseProgress, setCourseProgress] = useState<CourseProgress[]>([]);
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedView, setSelectedView] = useState<'week' | 'month' | 'agenda'>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'overdue' | 'due-soon' | 'upcoming'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showStudyPlanner, setShowStudyPlanner] = useState(false);

  // Error handling
  const [error, setError] = useState<string | null>(null);
  const [showIndexInfo, setShowIndexInfo] = useState(false);

  // Enhanced data fetching with real-time updates
  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const fetchScheduleData = async () => {
      setLoading(true);
      setError(null);

      try {
        console.log('Fetching comprehensive schedule data...');

        // Fetch enrolled courses
        const enrollments = await EnrollmentService.getUserEnrollments(user.id);
        setEnrolledCourses(enrollments);

        // Get course IDs
        const courseIds = enrollments.map(e => e.courseId);

        if (courseIds.length > 0) {
          // Fetch assignments with simplified query to avoid index requirements
          try {
            // Try with orderBy only (no where clause to avoid composite index requirement)
            const assignmentsQuery = query(
              collection(db, 'assignments'),
              orderBy('dueDate', 'asc')
            );

            const unsubscribeAssignments = onSnapshot(
              assignmentsQuery,
              (snapshot) => {
                const assignmentsData: Assignment[] = [];
                snapshot.forEach(doc => {
                  const data = doc.data();
                  // Filter for enrolled courses on the client side
                  if (courseIds.includes(data.courseId)) {
                    assignmentsData.push({
                      id: doc.id,
                      title: data.title,
                      description: data.description,
                      courseId: data.courseId,
                      dueDate: data.dueDate,
                      maxPoints: data.maxPoints,
                      type: data.type || 'assignment',
                      status: data.status || 'active',
                      createdAt: data.createdAt,
                      instructions: data.instructions || '',
                      submissionFormat: data.submissionFormat || 'text'
                    });
                  }
                });
                setAssignments(assignmentsData);
                console.log('Assignments updated:', assignmentsData.length);
              },
              (error) => {
                console.error('Error in assignments listener:', error);

                // Check if it's an index-related error
                if (error.message && error.message.includes('index')) {
                  console.log('Index error detected, using simple fallback...');
                  setShowIndexInfo(true);
                }

                // Fallback to simple query without orderBy
                fetchAssignmentsFallbackSimple(courseIds);
              }
            );

            // Store unsubscribe function for cleanup
            return unsubscribeAssignments;

          } catch (queryError) {
            console.error('Error setting up assignments query:', queryError);
            // Fallback to simple fetch
            await fetchAssignmentsFallbackSimple(courseIds);
          }

          // Fetch course progress data
          const progressPromises = courseIds.map(async (courseId) => {
            try {
              const progress = await ProgressService.getCourseProgress(user.id, courseId);
              const enrollment = enrollments.find(e => e.courseId === courseId);
              return {
                courseId,
                courseName: enrollment?.courseTitle || 'Unknown Course',
                totalLessons: progress?.totalLessons || 0,
                completedLessons: progress?.lessonsCompleted || 0,
                overallProgress: progress?.overallProgress || 0,
                lastActivity: progress?.lastActivity?.toDate() || new Date()
              };
            } catch (error) {
              console.warn(`Failed to fetch progress for course ${courseId}:`, error);
              return null;
            }
          });

          const progressResults = await Promise.all(progressPromises);
          const validProgress = progressResults.filter(p => p !== null) as CourseProgress[];
          setCourseProgress(validProgress);

          // Generate study sessions based on assignments and progress
          generateStudySessions(assignmentsData, validProgress);

          // Cleanup function
          return () => {
            unsubscribeAssignments();
          };
        } else {
          setAssignments([]);
          setCourseProgress([]);
          setStudySessions([]);
        }

      } catch (error) {
        console.error('Error fetching schedule data:', error);
        setError('Failed to load schedule data. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    };

    const unsubscribe = fetchScheduleData();

    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [user?.id]);

  // Fallback function for assignment fetching using service
  const fetchAssignmentsFallback = async (courseIds: string[]) => {
    try {
      const studentAssignments = await AssignmentService.getStudentAssignments(user!.id, courseIds);
      setAssignments(studentAssignments);
    } catch (error) {
      console.error('Fallback assignment fetch failed:', error);
      setError('Failed to load assignments. Please try refreshing.');
    }
  };

  // Simple fallback function that avoids complex queries
  const fetchAssignmentsFallbackSimple = async (courseIds: string[]) => {
    try {
      console.log('Using simple fallback query for assignments...');

      // Simple query without any where or orderBy clauses
      const assignmentsSnapshot = await getDocs(collection(db, 'assignments'));
      const assignmentsData: Assignment[] = [];

      assignmentsSnapshot.forEach(doc => {
        const data = doc.data();
        // Filter for enrolled courses on the client side
        if (courseIds.includes(data.courseId)) {
          assignmentsData.push({
            id: doc.id,
            title: data.title,
            description: data.description,
            courseId: data.courseId,
            dueDate: data.dueDate,
            maxPoints: data.maxPoints,
            type: data.type || 'assignment',
            status: data.status || 'active',
            createdAt: data.createdAt,
            instructions: data.instructions || '',
            submissionFormat: data.submissionFormat || 'text'
          });
        }
      });

      // Sort on client side
      assignmentsData.sort((a, b) => {
        if (a.dueDate && b.dueDate) {
          return a.dueDate.seconds - b.dueDate.seconds;
        }
        return 0;
      });

      setAssignments(assignmentsData);
      console.log('Simple fallback completed:', assignmentsData.length);

    } catch (error) {
      console.error('Simple fallback failed:', error);
      setError('Failed to load assignments. Please check your connection and try again.');
    }
  };

  // Generate study sessions based on assignments and progress
  const generateStudySessions = (assignments: Assignment[], progress: CourseProgress[]) => {
    const sessions: StudySession[] = [];
    const now = new Date();

    // Generate sessions for upcoming assignments
    assignments.forEach(assignment => {
      const dueDate = assignment.dueDate.toDate();
      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 3600 * 24));

      if (daysUntilDue > 0 && daysUntilDue <= 14) {
        const course = progress.find(p => p.courseId === assignment.courseId);
        const studyDate = new Date(now);
        studyDate.setDate(now.getDate() + Math.max(1, daysUntilDue - 2));

        sessions.push({
          id: `assignment-${assignment.id}`,
          courseId: assignment.courseId,
          courseName: course?.courseName || 'Unknown Course',
          plannedDate: studyDate,
          duration: assignment.type === 'quiz' ? 30 : 60,
          completed: false,
          type: 'assignment'
        });
      }
    });

    // Generate regular study sessions for courses with low progress
    progress.forEach(courseProgress => {
      if (courseProgress.overallProgress < 80) {
        const sessionsNeeded = Math.ceil((100 - courseProgress.overallProgress) / 10);

        for (let i = 0; i < Math.min(sessionsNeeded, 3); i++) {
          const studyDate = new Date(now);
          studyDate.setDate(now.getDate() + (i + 1) * 2);

          sessions.push({
            id: `study-${courseProgress.courseId}-${i}`,
            courseId: courseProgress.courseId,
            courseName: courseProgress.courseName,
            plannedDate: studyDate,
            duration: 45,
            completed: false,
            type: 'lesson'
          });
        }
      }
    });

    setStudySessions(sessions.sort((a, b) => a.plannedDate.getTime() - b.plannedDate.getTime()));
  };

  // Refresh data manually
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Re-fetch all data
      if (user?.id) {
        const enrollments = await EnrollmentService.getUserEnrollments(user.id);
        setEnrolledCourses(enrollments);

        const courseIds = enrollments.map(e => e.courseId);
        if (courseIds.length > 0) {
          await fetchAssignmentsFallback(courseIds);
        }
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
      setError('Failed to refresh data. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  // Get course title by ID
  const getCourseTitle = (courseId: string) => {
    const enrollment = enrolledCourses.find(e => e.courseId === courseId);
    return enrollment?.courseTitle || 'Unknown Course';
  };

  // Get assignment status
  const getAssignmentStatus = (assignment: Assignment) => {
    const now = new Date();
    const dueDate = assignment.dueDate.toDate();
    const timeDiff = dueDate.getTime() - now.getTime();
    const daysUntilDue = Math.ceil(timeDiff / (1000 * 3600 * 24));

    if (daysUntilDue < 0) {
      return { status: 'overdue', color: 'text-red-600 bg-red-50', text: 'Overdue' };
    } else if (daysUntilDue === 0) {
      return { status: 'due-today', color: 'text-orange-600 bg-orange-50', text: 'Due Today' };
    } else if (daysUntilDue <= 3) {
      return { status: 'due-soon', color: 'text-yellow-600 bg-yellow-50', text: `Due in ${daysUntilDue} days` };
    } else {
      return { status: 'upcoming', color: 'text-green-600 bg-green-50', text: `Due in ${daysUntilDue} days` };
    }
  };

  // Enhanced date navigation
  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);

    if (selectedView === 'week') {
      newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
    } else if (selectedView === 'month') {
      newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
    }

    setCurrentDate(newDate);
  };

  // Get assignments for the current week
  const getWeekAssignments = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return assignments.filter(assignment => {
      const dueDate = assignment.dueDate.toDate();
      return dueDate >= startOfWeek && dueDate <= endOfWeek;
    });
  };

  // Get assignments for the current month
  const getMonthAssignments = () => {
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    return assignments.filter(assignment => {
      const dueDate = assignment.dueDate.toDate();
      return dueDate >= startOfMonth && dueDate <= endOfMonth;
    });
  };

  // Get filtered assignments based on search and filter criteria
  const getFilteredAssignments = () => {
    let filtered = selectedView === 'week' ? getWeekAssignments() :
                   selectedView === 'month' ? getMonthAssignments() :
                   assignments;

    // Apply search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(assignment =>
        assignment.title.toLowerCase().includes(term) ||
        assignment.description.toLowerCase().includes(term) ||
        getCourseTitle(assignment.courseId).toLowerCase().includes(term)
      );
    }

    // Apply status filter
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(assignment => {
        const status = getAssignmentStatus(assignment);
        return status.status === selectedFilter;
      });
    }

    return filtered.sort((a, b) => a.dueDate.seconds - b.dueDate.seconds);
  };

  // Get upcoming assignments (next 7 days)
  const getUpcomingAssignments = () => {
    const now = new Date();
    const nextWeek = new Date(now);
    nextWeek.setDate(now.getDate() + 7);

    return assignments.filter(assignment => {
      const dueDate = assignment.dueDate.toDate();
      return dueDate >= now && dueDate <= nextWeek;
    }).sort((a, b) => a.dueDate.seconds - b.dueDate.seconds);
  };

  const displayAssignments = getFilteredAssignments();
  const upcomingAssignments = getUpcomingAssignments();
  const todayStudySessions = studySessions.filter(session => {
    const today = new Date();
    const sessionDate = session.plannedDate;
    return sessionDate.toDateString() === today.toDateString();
  });

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="h-8 bg-gray-200 rounded w-32 animate-pulse"></div>
            <div className="flex space-x-2">
              <div className="h-10 bg-gray-200 rounded w-20 animate-pulse"></div>
              <div className="h-10 bg-gray-200 rounded w-20 animate-pulse"></div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading your schedule...</p>
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
              <h3 className="text-lg font-medium text-red-900">Error Loading Schedule</h3>
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
      {/* Firebase Index Information Banner */}
      {showIndexInfo && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-blue-900 mb-1">Database Optimization Notice</h3>
              <p className="text-sm text-blue-800 mb-3">
                For optimal performance, some advanced features are running in compatibility mode.
                Your data is still fully accessible and functional.
              </p>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowIndexInfo(false)}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Got it
                </button>
                <button
                  onClick={handleRefresh}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Retry with full features
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Header with Navigation and Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-gray-900">Schedule</h1>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              title="Refresh schedule"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
            {/* Date Navigation */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => navigateDate('prev')}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm font-medium text-gray-900 min-w-[120px] text-center">
                {selectedView === 'week'
                  ? `Week of ${currentDate.toLocaleDateString()}`
                  : selectedView === 'month'
                  ? currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                  : 'All Time'
                }
              </span>
              <button
                onClick={() => navigateDate('next')}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* View Toggle */}
            <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setSelectedView('week')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  selectedView === 'week'
                    ? 'bg-white text-green-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setSelectedView('month')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  selectedView === 'month'
                    ? 'bg-white text-green-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Month
              </button>
              <button
                onClick={() => setSelectedView('agenda')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  selectedView === 'agenda'
                    ? 'bg-white text-green-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Agenda
              </button>
            </div>
          </div>
        </div>

        {/* Search and Filter Controls */}
        <div className="mt-4 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search assignments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {/* Filter */}
          <select
            value={selectedFilter}
            onChange={(e) => setSelectedFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="all">All Assignments</option>
            <option value="overdue">Overdue</option>
            <option value="due-today">Due Today</option>
            <option value="due-soon">Due Soon</option>
            <option value="upcoming">Upcoming</option>
          </select>

          {/* Study Planner Toggle */}
          <button
            onClick={() => setShowStudyPlanner(!showStudyPlanner)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              showStudyPlanner
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Study Planner
          </button>
        </div>
      </div>

      {/* Study Planner Section */}
      {showStudyPlanner && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Study Planner</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Today's Study Sessions */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Today's Study Sessions</h3>
                {todayStudySessions.length === 0 ? (
                  <p className="text-gray-600 text-sm">No study sessions planned for today.</p>
                ) : (
                  <div className="space-y-2">
                    {todayStudySessions.map((session) => (
                      <div key={session.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            session.type === 'assignment' ? 'bg-red-100' :
                            session.type === 'lesson' ? 'bg-green-100' : 'bg-yellow-100'
                          }`}>
                            {session.type === 'assignment' ? <Target className="w-4 h-4 text-red-600" /> :
                             session.type === 'lesson' ? <BookOpen className="w-4 h-4 text-green-600" /> :
                             <RefreshCw className="w-4 h-4 text-yellow-600" />}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{session.courseName}</p>
                            <p className="text-sm text-gray-600">{session.duration} minutes</p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            // Mark session as completed
                            setStudySessions(prev =>
                              prev.map(s => s.id === session.id ? { ...s, completed: true } : s)
                            );
                          }}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Complete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Course Progress Overview */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Course Progress</h3>
                {courseProgress.length === 0 ? (
                  <p className="text-gray-600 text-sm">No course progress data available.</p>
                ) : (
                  <div className="space-y-3">
                    {courseProgress.slice(0, 3).map((progress) => (
                      <div key={progress.courseId} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900">{progress.courseName}</h4>
                          <span className="text-sm text-gray-600">{progress.overallProgress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress.overallProgress}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {progress.completedLessons} of {progress.totalLessons} lessons completed
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Upcoming Assignments Alert */}
      {upcomingAssignments.length > 0 && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
              <Bell className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <h3 className="font-semibold text-yellow-900">Upcoming Deadlines</h3>
              <p className="text-sm text-yellow-700">Stay on track with your assignments</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {upcomingAssignments.slice(0, 6).map((assignment) => {
              const status = getAssignmentStatus(assignment);
              const dueDate = assignment.dueDate.toDate();
              return (
                <div key={assignment.id} className="bg-white p-4 rounded-lg border border-yellow-200">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-gray-900 text-sm">{assignment.title}</h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                      {status.text}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mb-2">{getCourseTitle(assignment.courseId)}</p>
                  <div className="flex items-center space-x-1 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    <span>{dueDate.toLocaleDateString()} at {dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              );
            })}
          </div>
          {upcomingAssignments.length > 6 && (
            <p className="text-sm text-yellow-700 mt-4 text-center">
              +{upcomingAssignments.length - 6} more assignments due soon
            </p>
          )}
        </div>
      )}

      {/* Enhanced Assignment Calendar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              {selectedView === 'week' ? 'This Week' :
               selectedView === 'month' ? 'This Month' : 'All Assignments'}
            </h2>
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span>Overdue ({displayAssignments.filter(a => getAssignmentStatus(a).status === 'overdue').length})</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span>Due Soon ({displayAssignments.filter(a => getAssignmentStatus(a).status === 'due-soon').length})</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span>Upcoming ({displayAssignments.filter(a => getAssignmentStatus(a).status === 'upcoming').length})</span>
              </div>
            </div>
          </div>
        </div>
        <div className="p-6">
          {displayAssignments.length === 0 ? (
            <div className="text-center py-12">
              <CalendarDays className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm || selectedFilter !== 'all'
                  ? 'No assignments match your criteria'
                  : `No assignments scheduled for this ${selectedView === 'agenda' ? 'period' : selectedView}`
                }
              </h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || selectedFilter !== 'all'
                  ? 'Try adjusting your search or filter settings.'
                  : 'Enjoy your free time or get ahead on future assignments!'
                }
              </p>
              {(searchTerm || selectedFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedFilter('all');
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {displayAssignments.map((assignment) => {
                const status = getAssignmentStatus(assignment);
                const dueDate = assignment.dueDate.toDate();

                return (
                  <div key={assignment.id} className={`p-4 rounded-lg border-l-4 transition-all duration-200 hover:shadow-md ${
                    status.status === 'overdue' ? 'bg-red-50 border-l-red-500' :
                    status.status === 'due-today' ? 'bg-orange-50 border-l-orange-500' :
                    status.status === 'due-soon' ? 'bg-yellow-50 border-l-yellow-500' :
                    'bg-gray-50 border-l-green-500'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1">
                        <div className="flex-shrink-0">
                          {assignment.type === 'quiz' ? (
                            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                              <CheckCircle className="w-6 h-6 text-blue-600" />
                            </div>
                          ) : assignment.type === 'exam' ? (
                            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                              <AlertCircle className="w-6 h-6 text-red-600" />
                            </div>
                          ) : (
                            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                              <FileText className="w-6 h-6 text-purple-600" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className="font-semibold text-gray-900">{assignment.title}</h4>
                            <span className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded-full">
                              {assignment.type}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{getCourseTitle(assignment.courseId)}</p>
                          {assignment.description && (
                            <p className="text-sm text-gray-500 mb-2 line-clamp-2">{assignment.description}</p>
                          )}
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <div className="flex items-center space-x-1">
                              <Clock className="w-4 h-4" />
                              <span>
                                {dueDate.toLocaleDateString()} at {dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Award className="w-4 h-4" />
                              <span>{assignment.maxPoints} points</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end space-y-2">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${status.color}`}>
                          {status.text}
                        </span>
                        <button className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
                          View Details
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Study Recommendations */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Personalized Study Recommendations</h2>
            <div className="flex items-center space-x-1 text-sm text-gray-600">
              <TrendingUp className="w-4 h-4" />
              <span>AI-Powered</span>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Priority Focus */}
            <div className="p-4 bg-gradient-to-br from-red-50 to-orange-50 rounded-xl border border-red-200">
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                </div>
                <h4 className="font-semibold text-red-900">Priority Focus</h4>
              </div>
              <p className="text-sm text-red-800 mb-3">
                {upcomingAssignments.length > 0
                  ? `Focus on ${upcomingAssignments[0]?.title} due ${getAssignmentStatus(upcomingAssignments[0]).text.toLowerCase()}`
                  : 'No urgent assignments. Great time to get ahead!'
                }
              </p>
              <div className="text-xs text-red-600 font-medium">
                {upcomingAssignments.filter(a => getAssignmentStatus(a).status === 'overdue').length > 0
                  ? `${upcomingAssignments.filter(a => getAssignmentStatus(a).status === 'overdue').length} overdue items`
                  : 'All caught up!'
                }
              </div>
            </div>

            {/* Daily Goal */}
            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Target className="w-4 h-4 text-blue-600" />
                </div>
                <h4 className="font-semibold text-blue-900">Daily Goal</h4>
              </div>
              <p className="text-sm text-blue-800 mb-3">
                Complete {todayStudySessions.length > 0 ? todayStudySessions.length : 1} study session{todayStudySessions.length !== 1 ? 's' : ''} today
              </p>
              <div className="text-xs text-blue-600 font-medium">
                {todayStudySessions.filter(s => s.completed).length} of {todayStudySessions.length} completed
              </div>
            </div>

            {/* Progress Boost */}
            <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200">
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                </div>
                <h4 className="font-semibold text-green-900">Progress Boost</h4>
              </div>
              <p className="text-sm text-green-800 mb-3">
                {courseProgress.length > 0
                  ? `${courseProgress.find(c => c.overallProgress < 50)?.courseName || 'Continue'} needs attention`
                  : 'Keep up the great momentum!'
                }
              </p>
              <div className="text-xs text-green-600 font-medium">
                {courseProgress.length > 0
                  ? `Avg. ${Math.round(courseProgress.reduce((sum, c) => sum + c.overallProgress, 0) / courseProgress.length)}% complete`
                  : 'No progress data'
                }
              </div>
            </div>

            {/* Study Tips */}
            <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200">
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-purple-600" />
                </div>
                <h4 className="font-semibold text-purple-900">Study Tip</h4>
              </div>
              <p className="text-sm text-purple-800 mb-3">
                Use the Pomodoro Technique: 25 minutes focused study, 5 minute break.
              </p>
              <div className="text-xs text-purple-600 font-medium">
                Proven to improve retention by 40%
              </div>
            </div>

            {/* Optimal Time */}
            <div className="p-4 bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl border border-yellow-200">
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-4 h-4 text-yellow-600" />
                </div>
                <h4 className="font-semibold text-yellow-900">Best Time</h4>
              </div>
              <p className="text-sm text-yellow-800 mb-3">
                Your peak learning hours are typically 10 AM - 12 PM and 2 PM - 4 PM.
              </p>
              <div className="text-xs text-yellow-600 font-medium">
                Schedule important topics during these times
              </div>
            </div>

            {/* Achievement */}
            <div className="p-4 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-200">
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <Award className="w-4 h-4 text-indigo-600" />
                </div>
                <h4 className="font-semibold text-indigo-900">Achievement</h4>
              </div>
              <p className="text-sm text-indigo-800 mb-3">
                {courseProgress.filter(c => c.overallProgress >= 80).length > 0
                  ? `${courseProgress.filter(c => c.overallProgress >= 80).length} course${courseProgress.filter(c => c.overallProgress >= 80).length !== 1 ? 's' : ''} nearly complete!`
                  : 'Keep studying to unlock achievements!'
                }
              </p>
              <div className="text-xs text-indigo-600 font-medium">
                Next milestone: Complete 5 lessons
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Schedule;
