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

  useEffect(() => {
    const fetchScheduleData = async () => {
      if (!user?.id) return;

      setLoading(true);
      try {
        // Fetch enrolled courses
        const enrollments = await EnrollmentService.getUserEnrollments(user.id);
        setEnrolledCourses(enrollments);

        // Get course IDs
        const courseIds = enrollments.map(e => e.courseId);

        if (courseIds.length > 0) {
          // Fetch assignments for enrolled courses
          const studentAssignments = await AssignmentService.getStudentAssignments(user.id, courseIds);
          setAssignments(studentAssignments);
        }
      } catch (error) {
        console.error('Error fetching schedule data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchScheduleData();
  }, [user?.id]);

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

  // Get assignments for the current week
  const getWeekAssignments = () => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
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
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return assignments.filter(assignment => {
      const dueDate = assignment.dueDate.toDate();
      return dueDate >= startOfMonth && dueDate <= endOfMonth;
    });
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

  const displayAssignments = selectedView === 'week' ? getWeekAssignments() : getMonthAssignments();
  const upcomingAssignments = getUpcomingAssignments();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with View Toggle */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Schedule</h1>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setSelectedView('week')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedView === 'week'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Week View
            </button>
            <button
              onClick={() => setSelectedView('month')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedView === 'month'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Month View
            </button>
          </div>
        </div>
      </div>

      {/* Upcoming Assignments Alert */}
      {upcomingAssignments.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <h3 className="font-medium text-yellow-800">Upcoming Deadlines</h3>
          </div>
          <div className="mt-2 space-y-2">
            {upcomingAssignments.slice(0, 3).map((assignment) => {
              const status = getAssignmentStatus(assignment);
              return (
                <div key={assignment.id} className="flex items-center justify-between text-sm">
                  <span className="text-yellow-800">{assignment.title} - {getCourseTitle(assignment.courseId)}</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                    {status.text}
                  </span>
                </div>
              );
            })}
            {upcomingAssignments.length > 3 && (
              <p className="text-xs text-yellow-600">
                +{upcomingAssignments.length - 3} more assignments
              </p>
            )}
          </div>
        </div>
      )}

      {/* Assignment Calendar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {selectedView === 'week' ? 'This Week' : 'This Month'}
          </h2>
        </div>
        <div className="p-6">
          {displayAssignments.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No assignments scheduled for this {selectedView}.</p>
              <p className="text-sm text-gray-500 mt-1">
                Enjoy your free time or get ahead on future assignments!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {displayAssignments.map((assignment) => {
                const status = getAssignmentStatus(assignment);
                const dueDate = assignment.dueDate.toDate();

                return (
                  <div key={assignment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        {assignment.type === 'quiz' ? (
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <CheckCircle className="w-5 h-5 text-blue-600" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <FileText className="w-5 h-5 text-purple-600" />
                          </div>
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">{assignment.title}</h4>
                        <p className="text-sm text-gray-600">{getCourseTitle(assignment.courseId)}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-500">
                            {dueDate.toLocaleDateString()} at {dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${status.color}`}>
                        {status.text}
                      </span>
                      <span className="text-sm text-gray-600">{assignment.maxPoints} pts</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Study Schedule Suggestions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Study Recommendations</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <BookOpen className="w-5 h-5 text-blue-600" />
                <h4 className="font-medium text-blue-900">Daily Study Goal</h4>
              </div>
              <p className="text-sm text-blue-800">
                Complete at least 1 lesson per day to maintain your learning streak.
              </p>
            </div>

            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Clock className="w-5 h-5 text-green-600" />
                <h4 className="font-medium text-green-900">Optimal Study Time</h4>
              </div>
              <p className="text-sm text-green-800">
                Studies show 25-30 minutes of focused learning is most effective.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Schedule;
