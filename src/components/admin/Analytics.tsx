import React from 'react';
import { BarChart3, Users, BookOpen, TrendingUp, Activity } from 'lucide-react';

const Analytics = () => {
  const metrics = [
    {
      name: 'Total Users',
      value: '2,456',
      change: '+12%',
      trend: 'up',
      color: 'blue'
    },
    {
      name: 'Active Courses',
      value: '127',
      change: '+8%',
      trend: 'up',
      color: 'green'
    },
    {
      name: 'Completion Rate',
      value: '78%',
      change: '+3%',
      trend: 'up',
      color: 'purple'
    },
    {
      name: 'Revenue',
      value: '$45,230',
      change: '+15%',
      trend: 'up',
      color: 'orange'
    }
  ];

  const recentActivity = [
    { action: 'New user registration', time: '2 minutes ago', type: 'user' },
    { action: 'Course "Advanced Cryptography" published', time: '15 minutes ago', type: 'course' },
    { action: 'System backup completed', time: '1 hour ago', type: 'system' },
    { action: 'User "john.doe" completed certification', time: '2 hours ago', type: 'achievement' },
    { action: 'New instructor application received', time: '3 hours ago', type: 'application' }
  ];

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'blue':
        return 'bg-blue-100 text-blue-800';
      case 'green':
        return 'bg-green-100 text-green-800';
      case 'purple':
        return 'bg-purple-100 text-purple-800';
      case 'orange':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric, index) => (
          <div key={index} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{metric.name}</p>
                <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
              </div>
              <div className={`p-2 rounded-lg ${getColorClasses(metric.color)}`}>
                <BarChart3 className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-4 flex items-center">
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-sm text-green-600 font-medium">{metric.change}</span>
              <span className="text-sm text-gray-500 ml-2">from last month</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900">User Growth</h3>
            <select className="text-sm border-gray-300 rounded-md">
              <option>Last 30 days</option>
              <option>Last 90 days</option>
              <option>Last year</option>
            </select>
          </div>
          <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">User growth chart would be displayed here</p>
            </div>
          </div>
        </div>

        {/* Course Completion Rates */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900">Course Completion Rates</h3>
            <select className="text-sm border-gray-300 rounded-md">
              <option>All courses</option>
              <option>Fundamentals</option>
              <option>Advanced</option>
            </select>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Introduction to Cybersecurity</span>
                <span>85%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: '85%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Network Security Essentials</span>
                <span>72%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-600 h-2 rounded-full" style={{ width: '72%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Ethical Hacking Basics</span>
                <span>68%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-purple-600 h-2 rounded-full" style={{ width: '68%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Advanced Penetration Testing</span>
                <span>59%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-orange-600 h-2 rounded-full" style={{ width: '59%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {recentActivity.map((activity, index) => (
              <div key={index} className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <Activity className="h-4 w-4 text-blue-600" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                  <p className="text-sm text-gray-500">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Performing Courses */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Top Performing Courses</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="bg-yellow-100 rounded-full p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <BookOpen className="h-8 w-8 text-yellow-600" />
              </div>
              <h4 className="text-lg font-medium text-gray-900">Introduction to Cybersecurity</h4>
              <p className="text-sm text-gray-500 mt-1">324 students • 4.8★ rating</p>
              <p className="text-sm text-green-600 font-medium mt-2">85% completion rate</p>
            </div>
            <div className="text-center">
              <div className="bg-blue-100 rounded-full p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <BookOpen className="h-8 w-8 text-blue-600" />
              </div>
              <h4 className="text-lg font-medium text-gray-900">Ethical Hacking Basics</h4>
              <p className="text-sm text-gray-500 mt-1">156 students • 4.9★ rating</p>
              <p className="text-sm text-green-600 font-medium mt-2">68% completion rate</p>
            </div>
            <div className="text-center">
              <div className="bg-green-100 rounded-full p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <BookOpen className="h-8 w-8 text-green-600" />
              </div>
              <h4 className="text-lg font-medium text-gray-900">Network Security Essentials</h4>
              <p className="text-sm text-gray-500 mt-1">198 students • 4.6★ rating</p>
              <p className="text-sm text-green-600 font-medium mt-2">72% completion rate</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;