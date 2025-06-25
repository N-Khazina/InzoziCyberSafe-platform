import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  CheckCircle,
  Users,
  Clock,
  BookOpen,
  FileText,
  Play
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import ProgressService, { LessonProgress } from '../../services/progressService';

// Enhanced Image Component for Firebase Storage
const FirebaseImage: React.FC<{
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  onError?: () => void;
  onLoad?: () => void;
}> = ({ src, alt, className, style, onError, onLoad }) => {
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
      <div className={`bg-gray-200 flex items-center justify-center ${className}`} style={style}>
        <FileText className="w-8 h-8 text-gray-400" />
      </div>
    );
  }

  return (
    <>
      {isLoading && (
        <div className={`bg-gray-200 animate-pulse flex items-center justify-center ${className}`} style={style}>
          <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={`${className} ${isLoading ? 'hidden' : ''}`}
        style={style}
        onError={handleImageError}
        onLoad={handleImageLoad}
      />
    </>
  );
};

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
  options: QuizOption[];
}

interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
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

interface CourseViewerProps {
  course: Course;
  onBack: () => void;
}

const CourseViewer: React.FC<CourseViewerProps> = ({ course, onBack }) => {
  const { user } = useAuth();
  const [lessonProgress, setLessonProgress] = useState<LessonProgress[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(true);

  // Fetch lesson progress when component mounts
  useEffect(() => {
    const fetchProgress = async () => {
      if (!user?.id) return;
      
      setLoadingProgress(true);
      try {
        const progress = await ProgressService.getCourseLessonProgress(user.id, course.id);
        setLessonProgress(progress);
      } catch (error) {
        console.error('Error fetching lesson progress:', error);
      } finally {
        setLoadingProgress(false);
      }
    };

    fetchProgress();
  }, [user?.id, course.id]);

  // Check if a lesson is completed
  const isLessonCompleted = (moduleId: string, lessonId: string): boolean => {
    return lessonProgress.some(
      progress => progress.moduleId === moduleId && 
                 progress.lessonId === lessonId && 
                 progress.completed
    );
  };

  // Handle lesson completion
  const handleLessonComplete = async (moduleId: string, lessonId: string) => {
    if (!user?.id) return;

    try {
      await ProgressService.markLessonComplete(user.id, course.id, moduleId, lessonId);
      
      // Update local state
      setLessonProgress(prev => {
        const existing = prev.find(p => p.moduleId === moduleId && p.lessonId === lessonId);
        if (existing) {
          return prev.map(p => 
            p.moduleId === moduleId && p.lessonId === lessonId 
              ? { ...p, completed: true, completedAt: new Date() }
              : p
          );
        } else {
          return [...prev, {
            userId: user.id,
            courseId: course.id,
            moduleId,
            lessonId,
            completed: true,
            completedAt: new Date()
          }];
        }
      });
    } catch (error) {
      console.error('Error marking lesson complete:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <button
          onClick={onBack}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
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
              <Clock className="w-4 h-4" />
              <span>{course.duration || 'Self-paced'}</span>
            </div>
            <div className="flex items-center space-x-1">
              <BookOpen className="w-4 h-4" />
              <span>{course.modules.length} Modules</span>
            </div>
          </div>
        </div>

        {/* Progress Overview */}
        {!loadingProgress && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Progress</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {course.modules.length}
                </div>
                <div className="text-sm text-gray-600">Total Modules</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {course.modules.reduce((sum, module) => sum + (module.lessons?.length || 0), 0)}
                </div>
                <div className="text-sm text-gray-600">Total Lessons</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {course.modules.reduce((sum, module) => sum + (module.lessons?.length || 0), 0) > 0 
                    ? Math.round((lessonProgress.filter(p => p.completed).length / course.modules.reduce((sum, module) => sum + (module.lessons?.length || 0), 0)) * 100)
                    : 0}%
                </div>
                <div className="text-sm text-gray-600">Overall Progress</div>
              </div>
            </div>
          </div>
        )}
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
          course.modules.map((module, moduleIndex) => {
            const moduleCompletedLessons = module.lessons?.filter(lesson => 
              isLessonCompleted(module.id, lesson.id)
            ).length || 0;
            const moduleTotalLessons = module.lessons?.length || 0;
            const moduleProgress = moduleTotalLessons > 0 ? (moduleCompletedLessons / moduleTotalLessons) * 100 : 0;

            return (
              <div key={module.id} className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                {/* Module Header */}
                <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 p-8 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold">{moduleIndex + 1}</span>
                        </div>
                        <h3 className="text-2xl font-bold">
                          {module.title}
                        </h3>
                      </div>
                      <div className="flex items-center space-x-6 text-blue-100">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-blue-200 rounded-full"></div>
                          <span className="text-sm">
                            {moduleCompletedLessons} of {moduleTotalLessons} lessons completed
                          </span>
                        </div>
                        {moduleProgress > 0 && (
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-green-300 rounded-full"></div>
                            <span className="text-sm font-medium">
                              {Math.round(moduleProgress)}% progress
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    {moduleProgress > 0 && (
                      <div className="text-right ml-6">
                        <div className="w-20 h-20 bg-white bg-opacity-15 rounded-full flex items-center justify-center border-4 border-white border-opacity-20">
                          <span className="text-xl font-bold">{Math.round(moduleProgress)}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CourseViewer;
