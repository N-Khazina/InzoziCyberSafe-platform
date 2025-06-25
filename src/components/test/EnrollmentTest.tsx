import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import EnrollmentService from '../../services/enrollmentService';

const EnrollmentTest = () => {
  const { user } = useAuth();
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const runEnrollmentTests = async () => {
    if (!user?.id) {
      addResult('❌ No user logged in');
      return;
    }

    setIsRunning(true);
    setTestResults([]);
    addResult('🧪 Starting Enrollment System Tests...');

    try {
      // Test 1: Get user enrollments (should be empty initially)
      addResult('📋 Test 1: Getting user enrollments...');
      const enrollments = await EnrollmentService.getUserEnrollments(user.id);
      addResult(`✅ Found ${enrollments.length} existing enrollments`);

      // Test 2: Try to enroll in a non-existent course
      addResult('📋 Test 2: Testing enrollment in non-existent course...');
      const invalidResult = await EnrollmentService.enrollStudent(user.id, 'invalid-course-id');
      if (!invalidResult.success) {
        addResult('✅ Correctly rejected invalid course enrollment');
      } else {
        addResult('❌ Should have rejected invalid course');
      }

      // Test 3: Check enrollment status
      addResult('📋 Test 3: Testing enrollment status check...');
      const isEnrolled = await EnrollmentService.isEnrolled(user.id, 'test-course-id');
      addResult(`✅ Enrollment status check: ${isEnrolled ? 'enrolled' : 'not enrolled'}`);

      addResult('🎉 All tests completed successfully!');

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
          Enrollment System Test
        </h2>
        
        <div className="mb-4">
          <p className="text-gray-600">
            Current User: {user ? `${user.name} (${user.email})` : 'Not logged in'}
          </p>
        </div>

        <button
          onClick={runEnrollmentTests}
          disabled={isRunning || !user}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
        >
          {isRunning ? 'Running Tests...' : 'Run Enrollment Tests'}
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

        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Test Instructions:</h4>
          <ol className="text-sm text-blue-800 space-y-1">
            <li>1. Make sure you're logged in as a student</li>
            <li>2. Click "Run Enrollment Tests" to test the enrollment service</li>
            <li>3. Check the results to see if the enrollment system is working</li>
            <li>4. Go to "My Courses" to test the UI integration</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default EnrollmentTest;
