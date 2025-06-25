import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  serverTimestamp,
  setDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import EnrollmentService from './enrollmentService';

// Progress tracking interfaces
export interface LessonProgress {
  id: string;
  userId: string;
  courseId: string;
  moduleId: string;
  lessonId: string;
  completed: boolean;
  completedAt?: any;
  timeSpent?: number; // in seconds
  lastAccessedAt: any;
}

export interface ModuleProgress {
  id: string;
  userId: string;
  courseId: string;
  moduleId: string;
  lessonsCompleted: number;
  totalLessons: number;
  completed: boolean;
  completedAt?: any;
  lastAccessedAt: any;
}

export interface CourseProgress {
  userId: string;
  courseId: string;
  modulesCompleted: number;
  totalModules: number;
  lessonsCompleted: number;
  totalLessons: number;
  overallProgress: number; // 0-100
  lastAccessedAt: any;
}

export class ProgressService {
  
  // Mark a lesson as completed
  static async markLessonCompleted(
    userId: string, 
    courseId: string, 
    moduleId: string, 
    lessonId: string
  ): Promise<boolean> {
    try {
      console.log('Marking lesson completed:', { userId, courseId, moduleId, lessonId });

      // Check if lesson progress already exists
      const existingProgress = await this.getLessonProgress(userId, courseId, moduleId, lessonId);
      
      if (existingProgress && existingProgress.completed) {
        console.log('Lesson already completed');
        return true;
      }

      const progressData = {
        userId,
        courseId,
        moduleId,
        lessonId,
        completed: true,
        completedAt: serverTimestamp(),
        lastAccessedAt: serverTimestamp()
      };

      if (existingProgress) {
        // Update existing progress
        await updateDoc(doc(db, 'lesson_progress', existingProgress.id), progressData);
      } else {
        // Create new progress record
        await addDoc(collection(db, 'lesson_progress'), progressData);
      }

      // Update module and course progress
      await this.updateModuleProgress(userId, courseId, moduleId);
      await this.updateCourseProgress(userId, courseId);

      console.log('Lesson progress updated successfully');
      return true;

    } catch (error) {
      console.error('Error marking lesson completed:', error);
      return false;
    }
  }

  // Get lesson progress
  static async getLessonProgress(
    userId: string, 
    courseId: string, 
    moduleId: string, 
    lessonId: string
  ): Promise<LessonProgress | null> {
    try {
      const q = query(
        collection(db, 'lesson_progress'),
        where('userId', '==', userId),
        where('courseId', '==', courseId),
        where('moduleId', '==', moduleId),
        where('lessonId', '==', lessonId)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data()
      } as LessonProgress;

    } catch (error) {
      console.error('Error getting lesson progress:', error);
      return null;
    }
  }

  // Update module progress
  static async updateModuleProgress(userId: string, courseId: string, moduleId: string): Promise<void> {
    try {
      // Get course data to count total lessons in module
      const courseDoc = await getDoc(doc(db, 'courses', courseId));
      if (!courseDoc.exists()) return;

      const courseData = courseDoc.data();
      const module = courseData.modules?.find((m: any) => m.id === moduleId);
      if (!module) return;

      const totalLessons = module.lessons?.length || 0;

      // Count completed lessons in this module
      const q = query(
        collection(db, 'lesson_progress'),
        where('userId', '==', userId),
        where('courseId', '==', courseId),
        where('moduleId', '==', moduleId),
        where('completed', '==', true)
      );
      
      const querySnapshot = await getDocs(q);
      const lessonsCompleted = querySnapshot.size;

      const moduleCompleted = lessonsCompleted >= totalLessons && totalLessons > 0;

      const moduleProgressData = {
        userId,
        courseId,
        moduleId,
        lessonsCompleted,
        totalLessons,
        completed: moduleCompleted,
        lastAccessedAt: serverTimestamp(),
        ...(moduleCompleted ? { completedAt: serverTimestamp() } : {})
      };

      // Use setDoc with composite key to ensure uniqueness
      const moduleProgressId = `${userId}_${courseId}_${moduleId}`;
      await setDoc(doc(db, 'module_progress', moduleProgressId), moduleProgressData);

      console.log('Module progress updated:', { moduleId, lessonsCompleted, totalLessons, moduleCompleted });

    } catch (error) {
      console.error('Error updating module progress:', error);
    }
  }

  // Update course progress and enrollment
  static async updateCourseProgress(userId: string, courseId: string): Promise<void> {
    try {
      // Get course data
      const courseDoc = await getDoc(doc(db, 'courses', courseId));
      if (!courseDoc.exists()) return;

      const courseData = courseDoc.data();
      const totalModules = courseData.modules?.length || 0;
      
      // Calculate total lessons across all modules
      const totalLessons = courseData.modules?.reduce((sum: number, module: any) => {
        return sum + (module.lessons?.length || 0);
      }, 0) || 0;

      // Count completed modules
      const moduleQuery = query(
        collection(db, 'module_progress'),
        where('userId', '==', userId),
        where('courseId', '==', courseId),
        where('completed', '==', true)
      );
      
      const moduleSnapshot = await getDocs(moduleQuery);
      const modulesCompleted = moduleSnapshot.size;

      // Count completed lessons
      const lessonQuery = query(
        collection(db, 'lesson_progress'),
        where('userId', '==', userId),
        where('courseId', '==', courseId),
        where('completed', '==', true)
      );
      
      const lessonSnapshot = await getDocs(lessonQuery);
      const lessonsCompleted = lessonSnapshot.size;

      // Calculate overall progress percentage
      const overallProgress = totalLessons > 0 ? Math.round((lessonsCompleted / totalLessons) * 100) : 0;

      // Update enrollment progress
      const enrollment = await EnrollmentService.getEnrollment(userId, courseId);
      if (enrollment) {
        await EnrollmentService.updateProgress(enrollment.id, overallProgress);
      }

      console.log('Course progress updated:', {
        courseId,
        modulesCompleted,
        totalModules,
        lessonsCompleted,
        totalLessons,
        overallProgress
      });

    } catch (error) {
      console.error('Error updating course progress:', error);
    }
  }

  // Get user's progress for a specific course
  static async getCourseProgress(userId: string, courseId: string): Promise<CourseProgress | null> {
    try {
      // Get course data
      const courseDoc = await getDoc(doc(db, 'courses', courseId));
      if (!courseDoc.exists()) return null;

      const courseData = courseDoc.data();
      const totalModules = courseData.modules?.length || 0;
      const totalLessons = courseData.modules?.reduce((sum: number, module: any) => {
        return sum + (module.lessons?.length || 0);
      }, 0) || 0;

      // Count completed modules
      const moduleQuery = query(
        collection(db, 'module_progress'),
        where('userId', '==', userId),
        where('courseId', '==', courseId),
        where('completed', '==', true)
      );
      
      const moduleSnapshot = await getDocs(moduleQuery);
      const modulesCompleted = moduleSnapshot.size;

      // Count completed lessons
      const lessonQuery = query(
        collection(db, 'lesson_progress'),
        where('userId', '==', userId),
        where('courseId', '==', courseId),
        where('completed', '==', true)
      );
      
      const lessonSnapshot = await getDocs(lessonQuery);
      const lessonsCompleted = lessonSnapshot.size;

      const overallProgress = totalLessons > 0 ? Math.round((lessonsCompleted / totalLessons) * 100) : 0;

      return {
        userId,
        courseId,
        modulesCompleted,
        totalModules,
        lessonsCompleted,
        totalLessons,
        overallProgress,
        lastAccessedAt: serverTimestamp()
      };

    } catch (error) {
      console.error('Error getting course progress:', error);
      return null;
    }
  }

  // Get all lesson progress for a course
  static async getCourseLessonProgress(userId: string, courseId: string): Promise<LessonProgress[]> {
    try {
      const q = query(
        collection(db, 'lesson_progress'),
        where('userId', '==', userId),
        where('courseId', '==', courseId)
      );
      
      const querySnapshot = await getDocs(q);
      const progress: LessonProgress[] = [];

      querySnapshot.forEach(doc => {
        progress.push({
          id: doc.id,
          ...doc.data()
        } as LessonProgress);
      });

      return progress;

    } catch (error) {
      console.error('Error getting course lesson progress:', error);
      return [];
    }
  }

  // Check if a lesson is completed
  static async isLessonCompleted(
    userId: string, 
    courseId: string, 
    moduleId: string, 
    lessonId: string
  ): Promise<boolean> {
    const progress = await this.getLessonProgress(userId, courseId, moduleId, lessonId);
    return progress?.completed || false;
  }

  // Get detailed analytics for a student
  static async getStudentAnalytics(userId: string): Promise<{
    totalCoursesEnrolled: number;
    coursesCompleted: number;
    totalLessonsCompleted: number;
    totalTimeSpent: number;
    averageProgress: number;
    weeklyProgress: { week: string; progress: number }[];
    courseProgress: { courseId: string; courseTitle: string; progress: number }[];
  }> {
    try {
      // Get enrollments
      const enrollments = await EnrollmentService.getUserEnrollments(userId);
      const totalCoursesEnrolled = enrollments.length;
      const coursesCompleted = enrollments.filter(e => e.status === 'completed').length;

      // Get lesson progress
      const lessonQuery = query(
        collection(db, 'lesson_progress'),
        where('userId', '==', userId),
        where('completed', '==', true)
      );

      const lessonSnapshot = await getDocs(lessonQuery);
      const totalLessonsCompleted = lessonSnapshot.size;

      // Calculate total time spent (if tracked)
      let totalTimeSpent = 0;
      lessonSnapshot.forEach(doc => {
        const data = doc.data();
        totalTimeSpent += data.timeSpent || 0;
      });

      // Calculate average progress
      const averageProgress = enrollments.length > 0
        ? Math.round(enrollments.reduce((sum, e) => sum + (e.progress || 0), 0) / enrollments.length)
        : 0;

      // Get weekly progress (last 8 weeks)
      const weeklyProgress = await this.getWeeklyProgress(userId, 8);

      // Get course progress details
      const courseProgress = await Promise.all(
        enrollments.map(async (enrollment) => {
          // Get course title
          const courseDoc = await getDoc(doc(db, 'courses', enrollment.courseId));
          const courseTitle = courseDoc.exists() ? courseDoc.data().title : 'Unknown Course';

          return {
            courseId: enrollment.courseId,
            courseTitle,
            progress: enrollment.progress || 0
          };
        })
      );

      return {
        totalCoursesEnrolled,
        coursesCompleted,
        totalLessonsCompleted,
        totalTimeSpent,
        averageProgress,
        weeklyProgress,
        courseProgress
      };
    } catch (error) {
      console.error('Error getting student analytics:', error);
      return {
        totalCoursesEnrolled: 0,
        coursesCompleted: 0,
        totalLessonsCompleted: 0,
        totalTimeSpent: 0,
        averageProgress: 0,
        weeklyProgress: [],
        courseProgress: []
      };
    }
  }

  // Get weekly progress for charts
  static async getWeeklyProgress(userId: string, weeks: number = 8): Promise<{ week: string; progress: number }[]> {
    try {
      const weeklyData: { week: string; progress: number }[] = [];
      const now = new Date();

      for (let i = weeks - 1; i >= 0; i--) {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - (i * 7));
        weekStart.setHours(0, 0, 0, 0);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        // Count lessons completed in this week
        const weekQuery = query(
          collection(db, 'lesson_progress'),
          where('userId', '==', userId),
          where('completed', '==', true),
          where('completedAt', '>=', weekStart),
          where('completedAt', '<=', weekEnd)
        );

        const weekSnapshot = await getDocs(weekQuery);
        const lessonsThisWeek = weekSnapshot.size;

        const weekLabel = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
        weeklyData.push({
          week: weekLabel,
          progress: lessonsThisWeek
        });
      }

      return weeklyData;
    } catch (error) {
      console.error('Error getting weekly progress:', error);
      return [];
    }
  }

  // Get learning streak (consecutive days with activity)
  static async getLearningStreak(userId: string): Promise<number> {
    try {
      const q = query(
        collection(db, 'lesson_progress'),
        where('userId', '==', userId),
        where('completed', '==', true),
        orderBy('completedAt', 'desc')
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) return 0;

      const completionDates: Date[] = [];
      querySnapshot.forEach(doc => {
        const data = doc.data();
        if (data.completedAt) {
          const date = data.completedAt.toDate();
          const dateString = date.toDateString();
          if (!completionDates.find(d => d.toDateString() === dateString)) {
            completionDates.push(date);
          }
        }
      });

      // Sort dates in descending order
      completionDates.sort((a, b) => b.getTime() - a.getTime());

      let streak = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (let i = 0; i < completionDates.length; i++) {
        const currentDate = new Date(completionDates[i]);
        currentDate.setHours(0, 0, 0, 0);

        const expectedDate = new Date(today);
        expectedDate.setDate(today.getDate() - i);

        if (currentDate.getTime() === expectedDate.getTime()) {
          streak++;
        } else {
          break;
        }
      }

      return streak;
    } catch (error) {
      console.error('Error calculating learning streak:', error);
      return 0;
    }
  }
}

export default ProgressService;
