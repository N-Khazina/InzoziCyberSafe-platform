import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Target, Clock, Award, BookOpen, Flame } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import ProgressService from '../../services/progressService';
import EnrollmentService from '../../services/enrollmentService';

const Progress = () => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<any>(null);
  const [learningStreak, setLearningStreak] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProgressData = async () => {
      if (!user?.id) return;

      setLoading(true);
      try {
        // Fetch student analytics
        const analyticsData = await ProgressService.getStudentAnalytics(user.id);
        setAnalytics(analyticsData);

        // Fetch learning streak
        const streak = await ProgressService.getLearningStreak(user.id);
        setLearningStreak(streak);
      } catch (error) {
        console.error('Error fetching progress data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProgressData();
  }, [user?.id]);

  // Format time spent
  const formatTimeSpent = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <BarChart3 className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No Progress Data</h3>
        <p className="text-gray-600">Start learning to see your progress analytics.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Courses Enrolled</p>
              <p className="text-3xl font-bold text-gray-900">{analytics.totalCoursesEnrolled}</p>
              <p className="text-sm text-green-600 mt-1">
                {analytics.coursesCompleted} completed
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Lessons Completed</p>
              <p className="text-3xl font-bold text-gray-900">{analytics.totalLessonsCompleted}</p>
              <p className="text-sm text-blue-600 mt-1">Keep learning!</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Target className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Time Spent</p>
              <p className="text-3xl font-bold text-gray-900">
                {formatTimeSpent(analytics.totalTimeSpent)}
              </p>
              <p className="text-sm text-purple-600 mt-1">Learning time</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Learning Streak</p>
              <p className="text-3xl font-bold text-gray-900">{learningStreak}</p>
              <p className="text-sm text-orange-600 mt-1">
                {learningStreak === 1 ? 'day' : 'days'}
              </p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Flame className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Course Progress */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Course Progress</h2>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {analytics.courseProgress.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No courses enrolled yet.</p>
                <p className="text-sm text-gray-500 mt-1">
                  Enroll in courses to track your progress.
                </p>
              </div>
            ) : (
              analytics.courseProgress.map((course: any) => (
                <div key={course.courseId} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{course.courseTitle}</h4>
                    <span className="text-sm font-medium text-gray-600">{course.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${course.progress}%` }}
                    ></div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Weekly Progress Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Weekly Activity</h2>
        </div>
        <div className="p-6">
          {analytics.weeklyProgress.length === 0 ? (
            <div className="text-center py-8">
              <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No activity data yet.</p>
              <p className="text-sm text-gray-500 mt-1">
                Complete lessons to see your weekly progress.
              </p>
            </div>
          ) : (
            <div className="flex items-end justify-between h-40 space-x-2">
              {analytics.weeklyProgress.map((week: any, index: number) => (
                <div key={index} className="flex flex-col items-center flex-1">
                  <div
                    className="bg-green-600 rounded-t w-full transition-all duration-300 hover:bg-green-700"
                    style={{
                      height: `${Math.max((week.progress / Math.max(...analytics.weeklyProgress.map((w: any) => w.progress))) * 100, 5)}%`,
                      minHeight: '4px'
                    }}
                  ></div>
                  <span className="text-xs text-gray-600 mt-2">{week.week}</span>
                  <span className="text-xs text-gray-500">{week.progress}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Achievement Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Achievements</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Course Completion Achievement */}
            <div className={`p-4 rounded-lg border-2 ${analytics.coursesCompleted > 0 ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${analytics.coursesCompleted > 0 ? 'bg-green-600' : 'bg-gray-400'}`}>
                  <Award className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Course Completer</h4>
                  <p className="text-sm text-gray-600">
                    {analytics.coursesCompleted > 0 ? 'Completed your first course!' : 'Complete a course to unlock'}
                  </p>
                </div>
              </div>
            </div>

            {/* Streak Achievement */}
            <div className={`p-4 rounded-lg border-2 ${learningStreak >= 7 ? 'border-orange-200 bg-orange-50' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${learningStreak >= 7 ? 'bg-orange-600' : 'bg-gray-400'}`}>
                  <Flame className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Week Warrior</h4>
                  <p className="text-sm text-gray-600">
                    {learningStreak >= 7 ? '7-day learning streak!' : 'Learn for 7 days straight'}
                  </p>
                </div>
              </div>
            </div>

            {/* Lesson Achievement */}
            <div className={`p-4 rounded-lg border-2 ${analytics.totalLessonsCompleted >= 50 ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${analytics.totalLessonsCompleted >= 50 ? 'bg-blue-600' : 'bg-gray-400'}`}>
                  <Target className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Lesson Master</h4>
                  <p className="text-sm text-gray-600">
                    {analytics.totalLessonsCompleted >= 50 ? 'Completed 50+ lessons!' : 'Complete 50 lessons to unlock'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Progress;
