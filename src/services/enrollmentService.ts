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
  increment
} from 'firebase/firestore';
import { db } from '../lib/firebase';

// Enrollment interface
export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  enrolledAt: any;
  status: 'active' | 'completed' | 'dropped';
  progress: number; // 0-100
  lastAccessedAt?: any;
  completedAt?: any;
}

// Enrollment service class
export class EnrollmentService {
  
  // Enroll a student in a course
  static async enrollStudent(userId: string, courseId: string): Promise<{ success: boolean; message: string; enrollmentId?: string }> {
    try {
      console.log('Enrolling student:', { userId, courseId });

      // Check if already enrolled
      const existingEnrollment = await this.getEnrollment(userId, courseId);
      if (existingEnrollment) {
        return {
          success: false,
          message: 'You are already enrolled in this course'
        };
      }

      // Check if course exists and is published
      const courseDoc = await getDoc(doc(db, 'courses', courseId));
      if (!courseDoc.exists()) {
        return {
          success: false,
          message: 'Course not found'
        };
      }

      const courseData = courseDoc.data();
      if (courseData.status !== 'Published') {
        return {
          success: false,
          message: 'Course is not available for enrollment'
        };
      }

      // Create enrollment record
      const enrollmentData = {
        userId,
        courseId,
        enrolledAt: serverTimestamp(),
        status: 'active',
        progress: 0,
        lastAccessedAt: serverTimestamp()
      };

      const enrollmentRef = await addDoc(collection(db, 'enrollments'), enrollmentData);

      // Update course student count
      await updateDoc(doc(db, 'courses', courseId), {
        students: increment(1)
      });

      console.log('Enrollment successful:', enrollmentRef.id);

      return {
        success: true,
        message: 'Successfully enrolled in course',
        enrollmentId: enrollmentRef.id
      };

    } catch (error) {
      console.error('Error enrolling student:', error);
      return {
        success: false,
        message: 'Failed to enroll in course. Please try again.'
      };
    }
  }

  // Get enrollment for a specific user and course
  static async getEnrollment(userId: string, courseId: string): Promise<Enrollment | null> {
    try {
      const q = query(
        collection(db, 'enrollments'),
        where('userId', '==', userId),
        where('courseId', '==', courseId)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data()
      } as Enrollment;

    } catch (error) {
      console.error('Error getting enrollment:', error);
      return null;
    }
  }

  // Get all enrollments for a user
  static async getUserEnrollments(userId: string): Promise<Enrollment[]> {
    try {
      const q = query(
        collection(db, 'enrollments'),
        where('userId', '==', userId)
      );
      
      const querySnapshot = await getDocs(q);
      const enrollments: Enrollment[] = [];

      querySnapshot.forEach(doc => {
        enrollments.push({
          id: doc.id,
          ...doc.data()
        } as Enrollment);
      });

      return enrollments;

    } catch (error) {
      console.error('Error getting user enrollments:', error);
      return [];
    }
  }

  // Update enrollment progress
  static async updateProgress(enrollmentId: string, progress: number): Promise<boolean> {
    try {
      const updateData: any = {
        progress,
        lastAccessedAt: serverTimestamp()
      };

      // If progress is 100%, mark as completed
      if (progress >= 100) {
        updateData.status = 'completed';
        updateData.completedAt = serverTimestamp();
      }

      await updateDoc(doc(db, 'enrollments', enrollmentId), updateData);
      
      console.log('Progress updated:', { enrollmentId, progress });
      return true;

    } catch (error) {
      console.error('Error updating progress:', error);
      return false;
    }
  }

  // Check if user is enrolled in a course
  static async isEnrolled(userId: string, courseId: string): Promise<boolean> {
    const enrollment = await this.getEnrollment(userId, courseId);
    return enrollment !== null && enrollment.status === 'active';
  }

  // Get enrollment statistics for a course
  static async getCourseEnrollmentStats(courseId: string) {
    try {
      const q = query(
        collection(db, 'enrollments'),
        where('courseId', '==', courseId)
      );
      
      const querySnapshot = await getDocs(q);
      
      let totalEnrollments = 0;
      let activeEnrollments = 0;
      let completedEnrollments = 0;
      let totalProgress = 0;

      querySnapshot.forEach(doc => {
        const data = doc.data();
        totalEnrollments++;
        totalProgress += data.progress || 0;
        
        if (data.status === 'active') activeEnrollments++;
        if (data.status === 'completed') completedEnrollments++;
      });

      const averageProgress = totalEnrollments > 0 ? totalProgress / totalEnrollments : 0;

      return {
        totalEnrollments,
        activeEnrollments,
        completedEnrollments,
        averageProgress: Math.round(averageProgress),
        completionRate: totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0
      };

    } catch (error) {
      console.error('Error getting course enrollment stats:', error);
      return {
        totalEnrollments: 0,
        activeEnrollments: 0,
        completedEnrollments: 0,
        averageProgress: 0,
        completionRate: 0
      };
    }
  }
}

export default EnrollmentService;
