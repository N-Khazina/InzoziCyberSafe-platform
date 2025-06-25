import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import ProgressService from '../../services/progressService';
import EnrollmentService from '../../services/enrollmentService';

const ProgressTest = () => {
  const { user } = useAuth();
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [enrollments, setEnrollments] = useState<any[]>([]);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  // Fetch user enrollments for testing
  useEffect(() => {
    const fetchEnrollments = async () => {
      if (!user?.id) return;
      
      try {
        const userEnrollments = await EnrollmentService.getUserEnrollments(user.id);
        setEnrollments(userEnrollments);
      } catch (error) {
        console.error('Error fetching enrollments:', error);
      }
    };

    fetchEnrollments();
  }, [user?.id]);

  const runProgressTests = async () => {
    if (!user?.id) {
      addResult('❌ No user logged in');
      return;
    }

    if (enrollments.length === 0) {
      addResult('❌ No enrollments found. Please enroll in a course first.');
      return;
    }

    setIsRunning(true);
    setTestResults([]);
    addResult('🧪 Starting Progress Tracking Tests...');

    try {
      const testCourseId = enrollments[0].courseId;
      addResult(`📚 Testing with course: ${testCourseId}`);

      // Test 1: Get course progress
      addResult('📋 Test 1: Getting course progress...');
      const courseProgress = await ProgressService.getCourseProgress(user.id, testCourseId);
      if (courseProgress) {
        addResult(`✅ Course progress: ${courseProgress.lessonsCompleted}/${courseProgress.totalLessons} lessons (${courseProgress.overallProgress}%)`);
      } else {
        addResult('✅ No progress found (expected for new enrollment)');
      }

      // Test 2: Get lesson progress
      addResult('📋 Test 2: Getting lesson progress...');
      const lessonProgress = await ProgressService.getCourseLessonProgress(user.id, testCourseId);
      addResult(`✅ Found ${lessonProgress.length} lesson progress records`);

      // Test 3: Test lesson completion (with dummy data)
      addResult('📋 Test 3: Testing lesson completion...');
      const testModuleId = 'test-module-1';
      const testLessonId = 'test-lesson-1';
      
      const completionResult = await ProgressService.markLessonCompleted(
        user.id, 
        testCourseId, 
        testModuleId, 
        testLessonId
      );
      
      if (completionResult) {
        addResult('✅ Lesson completion test successful');
      } else {
        addResult('❌ Lesson completion test failed');
      }

      // Test 4: Check if lesson is completed
      addResult('📋 Test 4: Checking lesson completion status...');
      const isCompleted = await ProgressService.isLessonCompleted(
        user.id, 
        testCourseId, 
        testModuleId, 
        testLessonId
      );
      addResult(`✅ Lesson completion status: ${isCompleted ? 'completed' : 'not completed'}`);

      // Test 5: Get updated course progress
      addResult('📋 Test 5: Getting updated course progress...');
      const updatedProgress = await ProgressService.getCourseProgress(user.id, testCourseId);
      if (updatedProgress) {
        addResult(`✅ Updated progress: ${updatedProgress.lessonsCompleted}/${updatedProgress.totalLessons} lessons (${updatedProgress.overallProgress}%)`);
      }

      addResult('🎉 All progress tests completed successfully!');

    } catch (error) {
      addResult(`❌ Test failed: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Progress Tracking System Test
        </h2>
        
        <div className="mb-4">
          <p className="text-gray-600">
            Current User: {user ? `${user.name} (${user.email})` : 'Not logged in'}
          </p>
          <p className="text-gray-600">
            Enrollments: {enrollments.length} courses
          </p>
        </div>

        <button
          onClick={runProgressTests}
          disabled={isRunning || !user || enrollments.length === 0}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
        >
          {isRunning ? 'Running Tests...' : 'Run Progress Tests'}
        </button>

        <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
          <h3 className="font-medium text-gray-900 mb-2">Test Results:</h3>
          {testResults.length === 0 ? (
            <p className="text-gray-500 italic">No tests run yet</p>
          ) : (
            <div className="space-y-1">
              {testResults.map((result, index) => (
                <div key={index} className="text-sm font-mono">
                  {result}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 p-4 bg-green-50 rounded-lg">
          <h4 className="font-medium text-green-900 mb-2">Test Instructions:</h4>
          <ol className="text-sm text-green-800 space-y-1">
            <li>1. Make sure you're logged in as a student</li>
            <li>2. Enroll in at least one course first</li>
            <li>3. Click "Run Progress Tests" to test the progress tracking service</li>
            <li>4. Go to a course and try marking lessons as complete</li>
            <li>5. Check that progress updates in real-time</li>
          </ol>
        </div>

        {enrollments.length > 0 && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Your Enrollments:</h4>
            <div className="space-y-2">
              {enrollments.map((enrollment, index) => (
                <div key={index} className="text-sm text-blue-800">
                  Course ID: {enrollment.courseId} - Progress: {enrollment.progress}%
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgressTest;
