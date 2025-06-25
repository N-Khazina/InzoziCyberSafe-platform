import React, { useState, useEffect } from 'react';
import { Award, TrendingUp, BarChart3, Filter, Calendar } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import GradingService, { Grade, GradeStats } from '../../services/gradingService';
import EnrollmentService from '../../services/enrollmentService';

const Grades = () => {
  const { user } = useAuth();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [gradeStats, setGradeStats] = useState<{ [courseId: string]: GradeStats }>({});
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [enrolledCourses, setEnrolledCourses] = useState<any[]>([]);
  const [overallGPA, setOverallGPA] = useState<number>(0);

  // Fetch enrolled courses
  useEffect(() => {
    const fetchEnrolledCourses = async () => {
      if (!user?.id) return;

      try {
        const enrollments = await EnrollmentService.getUserEnrollments(user.id);
        setEnrolledCourses(enrollments);
      } catch (error) {
        console.error('Error fetching enrolled courses:', error);
      }
    };

    fetchEnrolledCourses();
  }, [user?.id]);

  // Fetch grades and statistics
  useEffect(() => {
    const fetchGrades = async () => {
      if (!user?.id) return;

      setLoading(true);
      try {
        // Fetch all grades for the student
        const allGrades = await GradingService.getStudentGrades(user.id);
        setGrades(allGrades);

        // Calculate overall GPA
        const gpa = await GradingService.calculateOverallGPA(user.id);
        setOverallGPA(gpa);

        // Calculate grade stats for each course
        const stats: { [courseId: string]: GradeStats } = {};
        const courseIds = [...new Set(allGrades.map(g => g.courseId))];

        for (const courseId of courseIds) {
          const courseStats = await GradingService.calculateCourseGradeStats(user.id, courseId);
          stats[courseId] = courseStats;
        }

        setGradeStats(stats);
      } catch (error) {
        console.error('Error fetching grades:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGrades();
  }, [user?.id]);

  // Filter grades based on selected course
  const filteredGrades = selectedCourse === 'all'
    ? grades
    : grades.filter(grade => grade.courseId === selectedCourse);

  // Get course title by ID
  const getCourseTitle = (courseId: string) => {
    const enrollment = enrolledCourses.find(e => e.courseId === courseId);
    return enrollment?.courseTitle || 'Unknown Course';
  };

  // Get grade color based on percentage
  const getGradeColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600 bg-green-50';
    if (percentage >= 80) return 'text-blue-600 bg-blue-50';
    if (percentage >= 70) return 'text-yellow-600 bg-yellow-50';
    if (percentage >= 60) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Overall GPA</p>
              <p className="text-3xl font-bold text-gray-900">{overallGPA.toFixed(2)}</p>
              <p className="text-sm text-green-600 mt-1">Current semester</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Award className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Assignments</p>
              <p className="text-3xl font-bold text-gray-900">{grades.length}</p>
              <p className="text-sm text-blue-600 mt-1">Graded items</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Average Score</p>
              <p className="text-3xl font-bold text-gray-900">
                {grades.length > 0
                  ? Math.round(grades.reduce((sum, g) => sum + g.percentage, 0) / grades.length)
                  : 0}%
              </p>
              <p className="text-sm text-purple-600 mt-1">All courses</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Courses</p>
              <p className="text-3xl font-bold text-gray-900">{enrolledCourses.length}</p>
              <p className="text-sm text-indigo-600 mt-1">Enrolled</p>
            </div>
            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Course Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Grade Details</h2>
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400" />
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
          </div>
        </div>

        {/* Grades List */}
        <div className="space-y-4">
          {filteredGrades.length === 0 ? (
            <div className="text-center py-8">
              <Award className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No grades available yet.</p>
              <p className="text-sm text-gray-500 mt-1">
                Grades will appear here once your assignments are graded.
              </p>
            </div>
          ) : (
            filteredGrades.map((grade) => (
              <div key={grade.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${getGradeColor(grade.percentage)}`}>
                      {grade.letterGrade}
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{grade.title}</h4>
                      <p className="text-sm text-gray-600">{getCourseTitle(grade.courseId)} • {grade.type}</p>
                    </div>
                  </div>
                  {grade.feedback && (
                    <p className="text-sm text-gray-600 mt-2 ml-16">{grade.feedback}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900">{grade.points}/{grade.maxPoints}</p>
                  <p className="text-sm text-gray-600">{grade.percentage}%</p>
                  <p className="text-xs text-gray-500">
                    {grade.gradedAt?.toDate?.()?.toLocaleDateString() || 'Recently graded'}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Grades;
