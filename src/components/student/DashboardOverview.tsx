import { useState, useEffect } from 'react';
import {
  BookOpen,
  TrendingUp,
  Target,
  Play,
  Clock,
  Award,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import EnrollmentService from '../../services/enrollmentService';
import GradingService, { Grade } from '../../services/gradingService';
import AssignmentService, { Assignment } from '../../services/assignmentService';
import NotificationService, { Notification } from '../../services/notificationService';

interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  duration?: string;
  students: number;
  status: 'Published' | 'Draft' | 'Under Review';
  thumbnail?: string;
  createdAt: any;
  lastUpdated: any;
  modules: any[];
}

interface DashboardStats {
  totalEnrolledCourses: number;
  completedCourses: number;
  inProgressCourses: number;
  overallProgress: number;
  totalLessonsCompleted: number;
  currentGPA: number;
  upcomingAssignments: number;
  unreadNotifications: number;
}

interface RecentActivity {
  id: string;
  type: 'grade' | 'assignment' | 'course' | 'achievement';
  title: string;
  description: string;
  timestamp: any;
  courseTitle?: string;
  grade?: number;
  maxGrade?: number;
}

const DashboardOverview = () => {
  const { user } = useAuth();
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    totalEnrolledCourses: 0,
    completedCourses: 0,
    inProgressCourses: 0,
    overallProgress: 0,
    totalLessonsCompleted: 0,
    currentGPA: 0,
    upcomingAssignments: 0,
    unreadNotifications: 0
  });
  const [recentGrades, setRecentGrades] = useState<Grade[]>([]);
  const [upcomingAssignments, setUpcomingAssignments] = useState<Assignment[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch published courses from Firebase
  useEffect(() => {
    const fetchCourses = async () => {
      setLoading(true);
      try {
        console.log('Dashboard: Fetching courses from Firebase...');

        // Try different query strategies
        let querySnapshot;

        try {
          // First try: with status filter and orderBy
          const q1 = query(
            collection(db, 'courses'),
            where('status', '==', 'Published'),
            orderBy('createdAt', 'desc')
          );
          querySnapshot = await getDocs(q1);
        } catch (indexError: any) {
          console.log('Dashboard: OrderBy failed, trying without orderBy');
          try {
            // Second try: with status filter only
            const q2 = query(
              collection(db, 'courses'),
              where('status', '==', 'Published')
            );
            querySnapshot = await getDocs(q2);
          } catch (statusError: any) {
            console.log('Dashboard: Status filter failed, trying all courses');
            // Third try: get all courses and filter locally
            const q3 = query(collection(db, 'courses'));
            querySnapshot = await getDocs(q3);
          }
        }

        const coursesData: Course[] = [];

        querySnapshot.forEach(docSnap => {
          const data = docSnap.data();

          // Only include published courses (filter locally if needed)
          if (data.status === 'Published') {
            coursesData.push({
              id: docSnap.id,
              title: data.title || 'Untitled Course',
              description: data.description || 'No description available',
              category: data.category || 'General',
              level: data.level || 'Beginner',
              duration: data.duration || '',
              students: data.students || 0,
              status: data.status || 'Draft',
              thumbnail: data.thumbnail || '',
              createdAt: data.createdAt,
              lastUpdated: data.lastUpdated,
              modules: data.modules || [],
            });
          }
        });

        // Sort manually if we couldn't use orderBy
        coursesData.sort((a, b) => {
          if (a.createdAt && b.createdAt) {
            return b.createdAt.seconds - a.createdAt.seconds;
          }
          return 0;
        });

        console.log('Dashboard: Courses loaded successfully:', coursesData.length);
      } catch (err) {
        console.error('Dashboard: Error fetching courses:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, []);

  // Fetch comprehensive dashboard data with real-time updates
  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);

      try {
        console.log('Dashboard: Fetching comprehensive dashboard data...');

        // Fetch user enrollments first
        const userEnrollments = await EnrollmentService.getUserEnrollments(user.id);
        console.log('Dashboard: User enrollments:', userEnrollments);

        // Fetch enrolled courses
        const enrolledCourseIds = userEnrollments.map(e => e.courseId);
        if (enrolledCourseIds.length > 0) {
          // Fetch courses for enrolled courses only
          const coursesQuery = query(
            collection(db, 'courses'),
            where('__name__', 'in', enrolledCourseIds.slice(0, 10)) // Firestore 'in' limit
          );

          const coursesSnapshot = await getDocs(coursesQuery);
          const coursesData: Course[] = [];
          coursesSnapshot.forEach(doc => {
            const data = doc.data();
            coursesData.push({
              id: doc.id,
              title: data.title || 'Untitled Course',
              description: data.description || 'No description available',
              category: data.category || 'General',
              level: data.level || 'Beginner',
              duration: data.duration || '',
              students: data.students || 0,
              status: data.status || 'Draft',
              thumbnail: data.thumbnail || '',
              createdAt: data.createdAt,
              lastUpdated: data.lastUpdated,
              modules: data.modules || [],
            });
          });
          setEnrolledCourses(coursesData);
        } else {
          setEnrolledCourses([]);
        }

        // Fetch recent grades
        const grades = await GradingService.getRecentGrades(user.id, 5);
        setRecentGrades(grades);

        // Fetch upcoming assignments
        if (enrolledCourseIds.length > 0) {
          const assignments = await AssignmentService.getUpcomingAssignments(user.id, enrolledCourseIds, 5);
          setUpcomingAssignments(assignments);
        }

        // Calculate dashboard statistics
        const stats: DashboardStats = {
          totalEnrolledCourses: userEnrollments.length,
          completedCourses: userEnrollments.filter(e => e.status === 'completed').length,
          inProgressCourses: userEnrollments.filter(e => e.status === 'active').length,
          overallProgress: userEnrollments.length > 0
            ? Math.round(userEnrollments.reduce((sum, e) => sum + (e.progress || 0), 0) / userEnrollments.length)
            : 0,
          totalLessonsCompleted: 0, // Will be calculated from progress service
          currentGPA: grades.length > 0
            ? Math.round((grades.reduce((sum, g) => sum + (g.points / g.maxPoints * 4), 0) / grades.length) * 100) / 100
            : 0,
          upcomingAssignments: 0, // Will be set after fetching assignments
          unreadNotifications: 0 // Will be set after fetching notifications
        };

        setDashboardStats(stats);

        // Build recent activity feed
        const activities: RecentActivity[] = [];

        // Add recent grades to activity
        grades.slice(0, 3).forEach(grade => {
          activities.push({
            id: `grade-${grade.id}`,
            type: 'grade',
            title: `New Grade: ${grade.title}`,
            description: `Received ${grade.points}/${grade.maxPoints} points (${grade.letterGrade})`,
            timestamp: grade.gradedAt,
            courseTitle: grade.title,
            grade: grade.points,
            maxGrade: grade.maxPoints
          });
        });

        setRecentActivity(activities);

        // Fetch notifications
        const userNotifications = await NotificationService.getUserNotifications(user.id, 5);
        setNotifications(userNotifications);

      } catch (error) {
        console.error('Dashboard: Error fetching dashboard data:', error);
        setError('Failed to load dashboard data. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user?.id]);

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-green-600 to-green-800 rounded-xl p-6 text-white">
          <h1 className="text-2xl font-bold mb-2">Welcome back!</h1>
          <p className="text-green-100">Loading your dashboard...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 animate-pulse">
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-8 bg-gray-200 rounded mb-2"></div>
              <div className="h-3 bg-gray-200 rounded"></div>
            </div>
          ))}
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
              <h3 className="text-lg font-medium text-red-900">Error Loading Dashboard</h3>
              <p className="text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-green-600 to-green-800 rounded-xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">Welcome back, {user?.name}!</h1>
        <p className="text-green-100">Continue your learning journey and track your progress.</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Enrolled Courses</p>
              <p className="text-3xl font-bold text-gray-900">{dashboardStats.totalEnrolledCourses}</p>
              <p className="text-sm text-green-600 mt-1">Active learning</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Overall Progress</p>
              <p className="text-3xl font-bold text-gray-900">{dashboardStats.overallProgress}%</p>
              <p className="text-sm text-blue-600 mt-1">Keep going!</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completed Courses</p>
              <p className="text-3xl font-bold text-gray-900">{dashboardStats.completedCourses}</p>
              <p className="text-sm text-purple-600 mt-1">Achievements</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Current GPA</p>
              <p className="text-3xl font-bold text-gray-900">{dashboardStats.currentGPA.toFixed(2)}</p>
              <p className="text-sm text-orange-600 mt-1">Academic performance</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Award className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Continue Learning */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Continue Learning</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {enrolledCourses.length === 0 ? (
                <div className="text-center py-4">
                  <BookOpen className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">No enrolled courses yet. Visit "My Courses" to enroll!</p>
                </div>
              ) : (
                enrolledCourses.slice(0, 3).map((course) => {
                  const progressPercent = dashboardStats.overallProgress || 0;
                  return (
                    <div key={course.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{course.title}</h4>
                        <p className="text-sm text-gray-600">{course.category} • {course.level}</p>
                        <div className="flex items-center mt-2">
                          <div className="w-32 bg-gray-200 rounded-full h-2 mr-3">
                            <div
                              className="bg-green-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${progressPercent}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-600">{progressPercent}%</span>
                        </div>
                      </div>
                      <button className="ml-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2">
                        <Play className="w-4 h-4" />
                        <span>Continue</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Recent Activity</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {recentActivity.length === 0 ? (
                <div className="text-center py-4">
                  <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">No recent activity to show.</p>
                </div>
              ) : (
                recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      activity.type === 'grade' ? 'bg-green-100' :
                      activity.type === 'assignment' ? 'bg-blue-100' :
                      activity.type === 'course' ? 'bg-purple-100' : 'bg-yellow-100'
                    }`}>
                      {activity.type === 'grade' && <Award className="w-4 h-4 text-green-600" />}
                      {activity.type === 'assignment' && <Target className="w-4 h-4 text-blue-600" />}
                      {activity.type === 'course' && <BookOpen className="w-4 h-4 text-purple-600" />}
                      {activity.type === 'achievement' && <CheckCircle className="w-4 h-4 text-yellow-600" />}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{activity.title}</h4>
                      <p className="text-sm text-gray-600">{activity.description}</p>
                      {activity.courseTitle && (
                        <p className="text-xs text-gray-500 mt-1">{activity.courseTitle}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {activity.timestamp?.toDate?.()?.toLocaleDateString() || 'Recently'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Grades */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Recent Grades</h2>
        </div>
        <div className="p-6">
          {recentGrades.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Target className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-gray-600">No grades available yet.</p>
              <p className="text-sm text-gray-500 mt-1">
                Grades will appear here once your assignments are graded.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {recentGrades.map((grade) => (
                <div key={grade.id} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{grade.title}</h4>
                    <span className="text-lg font-bold text-green-600">{grade.letterGrade}</span>
                  </div>
                  <p className="text-sm text-gray-600">{grade.type}</p>
                  <p className="text-xs text-gray-500 mt-1">{grade.points}/{grade.maxPoints} pts</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upcoming Assignments */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Upcoming Assignments</h2>
        </div>
        <div className="p-6">
          {upcomingAssignments.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-gray-600">No upcoming assignments.</p>
              <p className="text-sm text-gray-500 mt-1">
                You're all caught up! Check back later for new assignments.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingAssignments.map((assignment) => {
                const dueDate = assignment.dueDate.toDate();
                const now = new Date();
                const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 3600 * 24));

                return (
                  <div key={assignment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900">{assignment.title}</h4>
                      <p className="text-sm text-gray-600">{assignment.type} • {assignment.maxPoints} pts</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {daysUntilDue === 0 ? 'Due Today' :
                         daysUntilDue === 1 ? 'Due Tomorrow' :
                         `Due in ${daysUntilDue} days`}
                      </p>
                      <p className="text-xs text-gray-500">
                        {dueDate.toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Notifications */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Recent Notifications</h2>
        </div>
        <div className="p-6">
          {notifications.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-gray-600">No notifications yet.</p>
              <p className="text-sm text-gray-500 mt-1">
                You'll see important updates and announcements here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.slice(0, 3).map((notification) => (
                <div key={notification.id} className={`p-3 rounded-lg border-l-4 ${
                  notification.priority === 'high' ? 'border-red-500 bg-red-50' :
                  notification.priority === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                  'border-blue-500 bg-blue-50'
                }`}>
                  <h4 className="font-medium text-gray-900">{notification.title}</h4>
                  <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    {notification.createdAt?.toDate?.()?.toLocaleDateString() || 'Recently'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
