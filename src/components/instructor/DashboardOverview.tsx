import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Users,
  TrendingUp,
  Award,
  MessageSquare,
  Calendar,
  AlertCircle,
  CheckCircle,
  Star
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface Course {
  id: string;
  title: string;
  students: number;
  progress: number;
  status: string;
  description?: string;
  category?: string;
  level?: string;
  thumbnail?: string;
}

interface Activity {
  id: number;
  action: string;
  course: string;
  time: string;
  type: string;
}

const DashboardOverview = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch courses from Firebase with real-time updates
  useEffect(() => {
    setLoading(true);

    const q = query(collection(db, 'courses'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const coursesData: Course[] = [];

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        coursesData.push({
          id: docSnap.id,
          title: data.title,
          students: data.students || 0,
          progress: Math.round(Math.random() * 100), // Calculate actual progress later
          status: data.status || 'Draft',
          description: data.description,
          category: data.category,
          level: data.level,
          thumbnail: data.thumbnail,
        });
      });

      setCourses(coursesData);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching courses:', error);
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  const recentActivities: Activity[] = [
    { id: 1, action: 'New assignment submitted', course: 'Cybersecurity Fundamentals', time: '2 hours ago', type: 'submission' },
    { id: 2, action: 'Course completed by student', course: 'Network Security', time: '4 hours ago', type: 'completion' },
    { id: 3, action: 'New question posted', course: 'Social Engineering', time: '6 hours ago', type: 'question' },
    { id: 4, action: 'Course rating received', course: 'Cybersecurity Fundamentals', time: '1 day ago', type: 'rating' },
  ];



  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'submission': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'completion': return <Award className="w-4 h-4 text-blue-600" />;
      case 'question': return <MessageSquare className="w-4 h-4 text-orange-600" />;
      case 'rating': return <Star className="w-4 h-4 text-yellow-600" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };



  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">Welcome back, Instructor!</h1>
        <p className="text-blue-100">Here's what's happening with your courses today.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Courses</p>
              <p className="text-3xl font-bold text-gray-900">{loading ? '...' : courses.length}</p>
              <p className="text-sm text-green-600 mt-1">+2 this month</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Students</p>
              <p className="text-3xl font-bold text-gray-900">
                {loading ? '...' : courses.reduce((sum, course) => sum + course.students, 0)}
              </p>
              <p className="text-sm text-green-600 mt-1">+12 this week</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg. Progress</p>
              <p className="text-3xl font-bold text-gray-900">
                {loading ? '...' : courses.length > 0 ? Math.round(courses.reduce((sum, course) => sum + course.progress, 0) / courses.length) + '%' : '0%'}
              </p>
              <p className="text-sm text-green-600 mt-1">+5% this week</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Course Rating</p>
              <p className="text-3xl font-bold text-gray-900">4.8</p>
              <p className="text-sm text-yellow-600 mt-1">Average rating</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Star className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Course Performance */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Course Performance</h3>
          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Loading courses...</span>
              </div>
            ) : courses.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">No courses available yet</p>
              </div>
            ) : (
              courses.map((course) => (
                <div key={course.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{course.title}</h4>
                    <div className="flex items-center space-x-4 mt-2">
                      <div className="flex items-center text-sm text-gray-600">
                        <Users className="w-4 h-4 mr-1" />
                        {course.students} students
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        course.status === 'Published' ? 'bg-green-100 text-green-800' :
                        course.status === 'Draft' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {course.status}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-gray-900">{course.progress}%</div>
                    <div className="w-20 bg-gray-200 rounded-full h-2 mt-1">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${course.progress}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Activities */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activities</h3>
          <div className="space-y-4">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-1">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                  <p className="text-sm text-gray-600">{activity.course}</p>
                  <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium">
            View all activities
          </button>
        </div>
      </div>



      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <BookOpen className="w-8 h-8 text-blue-600 mb-2" />
            <span className="text-sm font-medium text-gray-900">Create Course</span>
          </button>
          <button className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Users className="w-8 h-8 text-green-600 mb-2" />
            <span className="text-sm font-medium text-gray-900">View Students</span>
          </button>
          <button className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Calendar className="w-8 h-8 text-purple-600 mb-2" />
            <span className="text-sm font-medium text-gray-900">Schedule</span>
          </button>
          <button className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <TrendingUp className="w-8 h-8 text-orange-600 mb-2" />
            <span className="text-sm font-medium text-gray-900">Analytics</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
