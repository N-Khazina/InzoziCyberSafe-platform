import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Play,
  Clock,
  Users,
  ArrowLeft,
  FileText,
  CheckCircle,
  UserPlus,
  Search,
  AlertCircle,
  Loader2,
  Grid,
  List
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
import EnrollmentService, { Enrollment } from '../../services/enrollmentService';
import ProgressService from '../../services/progressService';

// Enhanced Image Component for Firebase Storage
const FirebaseImage: React.FC<{
  src: string;
  alt: string;
  className?: string;
  onError?: () => void;
  onLoad?: () => void;
}> = ({ src, alt, className, onError, onLoad }) => {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleImageError = () => {
    console.error('Image failed to load:', src);
    setImageError(true);
    setIsLoading(false);
    onError?.();
  };

  const handleImageLoad = () => {
    console.log('Image loaded successfully:', src);
    setImageError(false);
    setIsLoading(false);
    onLoad?.();
  };

  if (imageError) {
    return (
      <div className={`${className} bg-gray-100 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center p-4`}>
        <div className="text-gray-500 text-center">
          <div className="text-2xl mb-2">🖼️</div>
          <p className="text-sm">Image failed to load</p>
          <button
            onClick={() => {
              setImageError(false);
              setIsLoading(true);
            }}
            className="text-xs text-blue-600 hover:text-blue-800 mt-1"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {isLoading && (
        <div className={`${className} bg-gray-100 flex items-center justify-center`}>
          <div className="text-gray-500 text-sm">Loading...</div>
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={`${className} ${isLoading ? 'hidden' : 'block'}`}
        onError={handleImageError}
        onLoad={handleImageLoad}
      />
    </div>
  );
};

// Course interfaces
interface ContentBlock {
  id: string;
  type: 'text' | 'image' | 'video' | 'quiz';
  content?: string;
  url?: string;
  quizData?: QuizQuestion[];
}

interface QuizQuestion {
  id: string;
  question: string;
  options: {
    id: string;
    text: string;
    isCorrect: boolean;
  }[];
}

interface Lesson {
  id: string;
  title: string;
  contentBlocks: ContentBlock[];
}

interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
  test?: QuizQuestion[];
}

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
  modules: Module[];
}

// Course Viewer Component
const CourseViewer: React.FC<{ course: Course; onBack: () => void }> = ({ course, onBack }) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <button
          onClick={onBack}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Courses
        </button>

        {/* Course Header */}
        <div className="mb-6">
          {course.thumbnail && (
            <FirebaseImage
              src={course.thumbnail}
              alt={course.title}
              className="w-full h-48 object-cover rounded-lg mb-4"
            />
          )}
          <div className="flex items-center space-x-4 mb-4">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              course.level === 'Beginner' ? 'bg-green-100 text-green-800' :
              course.level === 'Intermediate' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {course.level}
            </span>
            <span className="text-sm text-gray-600">{course.category}</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{course.title}</h1>
          <p className="text-gray-700 mb-4">{course.description}</p>
          <div className="flex items-center space-x-6 text-sm text-gray-600">
            <div className="flex items-center space-x-1">
              <Users className="w-4 h-4" />
              <span>{course.students} Students</span>
            </div>
            <div className="flex items-center space-x-1">
              <BookOpen className="w-4 h-4" />
              <span>{course.modules.length} Modules</span>
            </div>
          </div>
        </div>
      </div>

      {/* Course Content */}
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-gray-900">Course Content</h2>

        {course.modules.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 italic">No modules created yet.</p>
          </div>
        ) : (
          course.modules.map((module, moduleIndex) => (
            <div key={module.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Module {moduleIndex + 1}: {module.title}
              </h3>

              {/* Module Lessons */}
              {module.lessons.length === 0 ? (
                <p className="text-gray-500 text-sm italic ml-4">No lessons in this module.</p>
              ) : (
                <div className="space-y-4 ml-4">
                  {module.lessons.map((lesson, lessonIndex) => (
                    <div key={lesson.id} className="border-l-2 border-blue-200 pl-4">
                      <h4 className="font-medium text-gray-800 mb-3">
                        Lesson {lessonIndex + 1}: {lesson.title}
                      </h4>

                      {/* Lesson Content Blocks */}
                      {lesson.contentBlocks.length === 0 ? (
                        <p className="text-gray-500 text-sm italic">No content blocks in this lesson.</p>
                      ) : (
                        <div className="space-y-3">
                          {lesson.contentBlocks.map((block, blockIndex) => (
                            <div key={block.id} className="bg-gray-50 p-4 rounded-lg">
                              <div className="flex items-center space-x-2 mb-3">
                                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                                  {block.type.toUpperCase()}
                                </span>
                                <span className="text-gray-600 text-sm">Block {blockIndex + 1}</span>
                              </div>

                              {block.type === 'text' && block.content && (
                                <div className="text-gray-700 space-y-3">
                                  {block.content.split('\n\n').map((paragraph, pIndex) => {
                                    const trimmedParagraph = paragraph.trim();
                                    if (!trimmedParagraph) return null;

                                    return (
                                      <p key={pIndex} className="leading-relaxed text-justify">
                                        {trimmedParagraph.split('\n').join(' ')}
                                      </p>
                                    );
                                  }).filter(Boolean)}
                                </div>
                              )}

                              {(block.type === 'image' || block.type === 'video') && block.url && (
                                <div className="mt-2 border border-gray-200 rounded-lg p-2 bg-white">
                                  {block.type === 'image' ? (
                                    <FirebaseImage
                                      src={block.url}
                                      alt="Course content"
                                      className="max-w-full h-48 object-contain rounded mx-auto block"
                                      onError={() => {
                                        console.error('Course image failed to load:', block.url);
                                      }}
                                    />
                                  ) : (
                                    <video
                                      src={block.url}
                                      controls
                                      className="max-w-full h-48 rounded mx-auto block"
                                      onError={() => {
                                        console.error('Course video failed to load:', block.url);
                                      }}
                                    >
                                      Your browser does not support the video tag.
                                    </video>
                                  )}
                                  <p className="text-xs text-gray-500 mt-1 text-center">
                                    {block.type === 'image' ? 'Image Content' : 'Video Content'}
                                  </p>
                                </div>
                              )}

                              {block.type === 'quiz' && block.quizData && (
                                <div className="mt-2">
                                  <p className="font-medium text-gray-800 mb-2">Quiz ({block.quizData.length} questions)</p>
                                  {block.quizData.slice(0, 2).map((question, qIndex) => (
                                    <div key={question.id} className="ml-2 mb-2">
                                      <p className="text-gray-700 text-sm">Q{qIndex + 1}: {question.question}</p>
                                      <div className="ml-2 text-xs text-gray-600">
                                        {question.options.map((option, oIndex) => (
                                          <div key={option.id} className="flex items-center space-x-1">
                                            <span>{String.fromCharCode(65 + oIndex)}.</span>
                                            <span>{option.text}</span>
                                            {option.isCorrect && <span className="text-green-600">✓</span>}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                  {block.quizData.length > 2 && (
                                    <p className="text-xs text-gray-500 ml-2">... and {block.quizData.length - 2} more questions</p>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Module Test */}
              {module.test && module.test.length > 0 && (
                <div className="mt-6 ml-4 border-t border-gray-200 pt-4">
                  <h5 className="font-medium text-gray-800 mb-2">Module Test ({module.test.length} questions)</h5>
                  {module.test.slice(0, 2).map((question, qIndex) => (
                    <div key={question.id} className="mb-2 text-sm">
                      <p className="text-gray-700">Q{qIndex + 1}: {question.question}</p>
                      <div className="ml-2 text-xs text-gray-600">
                        {question.options.map((option, oIndex) => (
                          <div key={option.id} className="flex items-center space-x-1">
                            <span>{String.fromCharCode(65 + oIndex)}.</span>
                            <span>{option.text}</span>
                            {option.isCorrect && <span className="text-green-600">✓</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {module.test.length > 2 && (
                    <p className="text-xs text-gray-500 ml-2">... and {module.test.length - 2} more questions</p>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const MyCourses = () => {
  const { user } = useAuth();

  // Core state
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showCourseViewer, setShowCourseViewer] = useState(false);
  const [enrollingCourseId, setEnrollingCourseId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Filter and search state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [showEnrolledOnly, setShowEnrolledOnly] = useState(false);

  // Progress tracking
  const [courseProgress, setCourseProgress] = useState<{ [courseId: string]: number }>({});

  // Fetch published courses from Firebase
  useEffect(() => {
    const fetchCourses = async () => {
      setLoading(true);
      try {
        console.log('Fetching courses from Firebase...');
        console.log('Firebase db object:', db);

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
          console.log('Query with orderBy successful');
        } catch (indexError: any) {
          console.log('OrderBy failed, trying without orderBy:', indexError.message);
          try {
            // Second try: with status filter only
            const q2 = query(
              collection(db, 'courses'),
              where('status', '==', 'Published')
            );
            querySnapshot = await getDocs(q2);
            console.log('Query without orderBy successful');
          } catch (statusError: any) {
            console.log('Status filter failed, trying all courses:', statusError.message);
            // Third try: get all courses and filter locally
            const q3 = query(collection(db, 'courses'));
            querySnapshot = await getDocs(q3);
            console.log('Query all courses successful');
          }
        }
        const coursesData: Course[] = [];

        console.log(`Found ${querySnapshot.size} published courses`);

        querySnapshot.forEach(docSnap => {
          const data = docSnap.data();
          console.log('Course data:', { id: docSnap.id, title: data.title, status: data.status });

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

        setCourses(coursesData);
        setError(null);
        console.log('Courses loaded successfully:', coursesData.length);
      } catch (err: any) {
        console.error('Error fetching courses:', err);
        setError('Failed to load courses. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, []);

  // Fetch user enrollments and progress
  useEffect(() => {
    const fetchEnrollmentsAndProgress = async () => {
      if (!user?.id) return;

      try {
        console.log('Fetching enrollments and progress for user:', user.id);

        // Fetch enrollments
        const userEnrollments = await EnrollmentService.getUserEnrollments(user.id);
        setEnrollments(userEnrollments);
        console.log('User enrollments:', userEnrollments);

        // Fetch progress for each enrolled course
        const progressData: { [courseId: string]: number } = {};
        for (const enrollment of userEnrollments) {
          try {
            const progress = await ProgressService.getCourseProgress(user.id, enrollment.courseId);
            progressData[enrollment.courseId] = progress?.overallProgress || enrollment.progress || 0;
          } catch (progressError) {
            console.warn(`Failed to fetch progress for course ${enrollment.courseId}:`, progressError);
            progressData[enrollment.courseId] = enrollment.progress || 0;
          }
        }

        setCourseProgress(progressData);
        console.log('Course progress:', progressData);
      } catch (error) {
        console.error('Error fetching enrollments and progress:', error);
      }
    };

    fetchEnrollmentsAndProgress();
  }, [user?.id]);

  const handleOpenCourse = (course: Course) => {
    setSelectedCourse(course);
    setShowCourseViewer(true);
  };

  // Handle course enrollment with enhanced feedback
  const handleEnrollCourse = async (courseId: string) => {
    if (!user?.id) {
      setError('Please log in to enroll in courses');
      return;
    }

    setEnrollingCourseId(courseId);
    setError(null);

    try {
      console.log(`Enrolling user ${user.id} in course ${courseId}`);
      const result = await EnrollmentService.enrollStudent(user.id, courseId);

      if (result.success) {
        // Refresh enrollments and progress
        const userEnrollments = await EnrollmentService.getUserEnrollments(user.id);
        setEnrollments(userEnrollments);

        // Initialize progress for the new course
        setCourseProgress(prev => ({
          ...prev,
          [courseId]: 0
        }));

        // Show success message
        console.log('Enrollment successful:', result.message);

        // Update course student count locally for immediate feedback
        setCourses(prevCourses =>
          prevCourses.map(course =>
            course.id === courseId
              ? { ...course, students: course.students + 1 }
              : course
          )
        );
      } else {
        setError(result.message);
      }
    } catch (error) {
      console.error('Error enrolling in course:', error);
      setError('Failed to enroll in course. Please try again.');
    } finally {
      setEnrollingCourseId(null);
    }
  };

  // Check if user is enrolled in a course
  const isEnrolledInCourse = (courseId: string): boolean => {
    return enrollments.some(enrollment =>
      enrollment.courseId === courseId && enrollment.status === 'active'
    );
  };

  // Get enrollment for a course
  const getCourseEnrollment = (courseId: string): Enrollment | undefined => {
    return enrollments.find(enrollment =>
      enrollment.courseId === courseId && enrollment.status === 'active'
    );
  };

  // Get course progress
  const getCourseProgress = (courseId: string): number => {
    return courseProgress[courseId] || 0;
  };

  // Filter and search functionality
  const getFilteredCourses = (): Course[] => {
    let filtered = courses;

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(course =>
        course.title.toLowerCase().includes(term) ||
        course.description.toLowerCase().includes(term) ||
        course.category.toLowerCase().includes(term)
      );
    }

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(course => course.category === selectedCategory);
    }

    // Level filter
    if (selectedLevel !== 'all') {
      filtered = filtered.filter(course => course.level === selectedLevel);
    }

    // Enrolled only filter
    if (showEnrolledOnly) {
      filtered = filtered.filter(course => isEnrolledInCourse(course.id));
    }

    return filtered;
  };

  // Get unique categories and levels for filters
  const getUniqueCategories = (): string[] => {
    const categories = courses.map(course => course.category);
    return Array.from(new Set(categories)).sort();
  };

  const getUniqueLevels = (): string[] => {
    const levels = courses.map(course => course.level);
    return Array.from(new Set(levels)).sort();
  };

  const upcomingAssignments = [
    { id: 1, title: 'Math Problem Set 5', course: 'Advanced Mathematics', dueDate: 'Due in 2 days', priority: 'high' },
    { id: 2, title: 'Physics Lab Report', course: 'Physics Fundamentals', dueDate: 'Due in 5 days', priority: 'medium' },
    { id: 3, title: 'Chemistry Quiz', course: 'Chemistry Lab', dueDate: 'Due in 1 week', priority: 'low' },
  ];

  if (showCourseViewer && selectedCourse) {
    return <CourseViewer course={selectedCourse} onBack={() => setShowCourseViewer(false)} />;
  }

  const filteredCourses = getFilteredCourses();

  return (
    <div className="space-y-6">
      {/* Header with Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">My Courses</h2>
              <p className="text-sm text-gray-600 mt-1">
                {enrollments.length > 0
                  ? `Enrolled in ${enrollments.length} course${enrollments.length !== 1 ? 's' : ''}`
                  : 'Discover and enroll in courses'
                }
              </p>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-green-100 text-green-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <Grid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-green-100 text-green-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="p-6 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search courses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="all">All Categories</option>
              {getUniqueCategories().map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>

            {/* Level Filter */}
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="all">All Levels</option>
              {getUniqueLevels().map(level => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>

            {/* Enrolled Filter */}
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showEnrolledOnly}
                onChange={(e) => setShowEnrolledOnly(e.target.checked)}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm text-gray-700">Enrolled only</span>
            </label>
          </div>
        </div>

        {/* Results Summary */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
          <p className="text-sm text-gray-600">
            Showing {filteredCourses.length} of {courses.length} courses
            {searchTerm && ` for "${searchTerm}"`}
          </p>
        </div>

        {/* Course Content */}
        <div className="p-6">
          {loading && (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto mb-2" />
              <p className="text-gray-600">Loading courses...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <p className="text-red-600 font-medium">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && filteredCourses.length === 0 && courses.length > 0 && (
            <div className="text-center py-8">
              <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No courses match your search criteria.</p>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('all');
                  setSelectedLevel('all');
                  setShowEnrolledOnly(false);
                }}
                className="mt-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Clear filters
              </button>
            </div>
          )}

          {!loading && !error && courses.length === 0 && (
            <div className="text-center py-8">
              <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No courses available yet. Check back soon for new learning opportunities!</p>
            </div>
          )}

          {!loading && !error && filteredCourses.length > 0 && (
            <div className={viewMode === 'grid'
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              : "space-y-4"
            }>
              {filteredCourses.map((course) => {
                const isEnrolled = isEnrolledInCourse(course.id);
                const progress = getCourseProgress(course.id);
                const enrollment = getCourseEnrollment(course.id);

                return (
                  <div key={course.id} className={`border rounded-lg p-6 transition-all duration-200 ${
                    viewMode === 'grid'
                      ? 'hover:shadow-lg hover:border-green-300'
                      : 'hover:bg-gray-50'
                  } ${isEnrolled ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'}`}>

                    <div className={viewMode === 'list' ? 'flex items-center space-x-6' : ''}>
                      {/* Course Thumbnail */}
                      <div className={viewMode === 'list' ? 'flex-shrink-0' : 'mb-4'}>
                        {course.thumbnail ? (
                          <FirebaseImage
                            src={course.thumbnail}
                            alt={course.title}
                            className={`object-cover rounded-lg ${
                              viewMode === 'list' ? 'w-24 h-16' : 'w-full h-32'
                            }`}
                          />
                        ) : (
                          <div className={`bg-gradient-to-br from-green-400 to-green-600 rounded-lg flex items-center justify-center ${
                            viewMode === 'list' ? 'w-24 h-16' : 'w-full h-32'
                          }`}>
                            <BookOpen className="w-8 h-8 text-white" />
                          </div>
                        )}
                      </div>

                      <div className={viewMode === 'list' ? 'flex-1' : ''}>
                        {/* Header with Status Badge */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <h3 className="text-lg font-semibold text-gray-900">{course.title}</h3>
                              {isEnrolled && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Enrolled
                                </span>
                              )}
                            </div>
                            <p className="text-gray-600 text-sm">{course.category}</p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            course.level === 'Beginner' ? 'bg-green-100 text-green-800' :
                            course.level === 'Intermediate' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {course.level}
                          </span>
                        </div>

                        {/* Description */}
                        <p className="text-gray-600 text-sm mb-4 line-clamp-2">{course.description}</p>

                        {/* Progress Bar (for enrolled courses) */}
                        {isEnrolled && (
                          <div className="mb-4">
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="text-gray-600">Progress</span>
                              <span className="font-medium text-green-600">{progress}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              ></div>
                            </div>
                          </div>
                        )}

                        {/* Course Stats */}
                        <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center">
                              <Users className="w-4 h-4 mr-1" />
                              <span>{course.students} students</span>
                            </div>
                            <div className="flex items-center">
                              <BookOpen className="w-4 h-4 mr-1" />
                              <span>{course.modules.length} modules</span>
                            </div>
                            {course.duration && (
                              <div className="flex items-center">
                                <Clock className="w-4 h-4 mr-1" />
                                <span>{course.duration}</span>
                              </div>
                            )}
                          </div>
                          {isEnrolled && enrollment && (
                            <div className="text-xs text-gray-500">
                              Enrolled {enrollment.enrolledAt?.toDate?.()?.toLocaleDateString()}
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="space-y-2">
                          {isEnrolled ? (
                            <button
                              onClick={() => handleOpenCourse(course)}
                              className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
                            >
                              <Play className="w-4 h-4" />
                              <span>Continue Learning</span>
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => handleEnrollCourse(course.id)}
                                disabled={enrollingCourseId === course.id}
                                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {enrollingCourseId === course.id ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Enrolling...</span>
                                  </>
                                ) : (
                                  <>
                                    <UserPlus className="w-4 h-4" />
                                    <span>Enroll Now</span>
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => handleOpenCourse(course)}
                                className="w-full border border-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center space-x-2"
                              >
                                <FileText className="w-4 h-4" />
                                <span>Preview Course</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
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
          <div className="space-y-4">
            {upcomingAssignments.map((assignment) => (
              <div key={assignment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className={`w-3 h-3 rounded-full ${
                    assignment.priority === 'high' ? 'bg-red-500' :
                    assignment.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                  }`}></div>
                  <div>
                    <h4 className="font-medium text-gray-900">{assignment.title}</h4>
                    <p className="text-sm text-gray-600">{assignment.course}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{assignment.dueDate}</p>
                  <button className="text-sm text-green-600 hover:text-green-700">
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyCourses;
