import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';

// Assignment interfaces
export interface Assignment {
  id: string;
  courseId: string;
  moduleId?: string;
  title: string;
  description: string;
  type: 'quiz' | 'essay' | 'project' | 'homework';
  dueDate: Timestamp;
  maxPoints: number;
  instructions?: string;
  attachments?: string[];
  createdAt: Timestamp;
  createdBy: string; // instructor ID
  isPublished: boolean;
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  courseId: string;
  submittedAt: Timestamp;
  content?: string;
  attachments?: string[];
  status: 'submitted' | 'graded' | 'late' | 'missing';
  grade?: number;
  feedback?: string;
  gradedAt?: Timestamp;
  gradedBy?: string; // instructor ID
}

export class AssignmentService {
  
  // Get assignments for a course
  static async getCourseAssignments(courseId: string): Promise<Assignment[]> {
    try {
      const q = query(
        collection(db, 'assignments'),
        where('courseId', '==', courseId),
        where('isPublished', '==', true),
        orderBy('dueDate', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      const assignments: Assignment[] = [];
      
      querySnapshot.forEach(doc => {
        assignments.push({
          id: doc.id,
          ...doc.data()
        } as Assignment);
      });
      
      return assignments;
    } catch (error) {
      console.error('Error fetching course assignments:', error);
      return [];
    }
  }

  // Get assignments for a student (across all enrolled courses)
  static async getStudentAssignments(studentId: string, enrolledCourseIds: string[]): Promise<Assignment[]> {
    try {
      if (enrolledCourseIds.length === 0) return [];
      
      const q = query(
        collection(db, 'assignments'),
        where('courseId', 'in', enrolledCourseIds),
        where('isPublished', '==', true),
        orderBy('dueDate', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      const assignments: Assignment[] = [];
      
      querySnapshot.forEach(doc => {
        assignments.push({
          id: doc.id,
          ...doc.data()
        } as Assignment);
      });
      
      return assignments;
    } catch (error) {
      console.error('Error fetching student assignments:', error);
      return [];
    }
  }

  // Get upcoming assignments for a student
  static async getUpcomingAssignments(studentId: string, enrolledCourseIds: string[], limit: number = 5): Promise<Assignment[]> {
    try {
      if (enrolledCourseIds.length === 0) return [];
      
      const now = Timestamp.now();
      const q = query(
        collection(db, 'assignments'),
        where('courseId', 'in', enrolledCourseIds),
        where('isPublished', '==', true),
        where('dueDate', '>', now),
        orderBy('dueDate', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      const assignments: Assignment[] = [];
      
      querySnapshot.forEach(doc => {
        if (assignments.length < limit) {
          assignments.push({
            id: doc.id,
            ...doc.data()
          } as Assignment);
        }
      });
      
      return assignments;
    } catch (error) {
      console.error('Error fetching upcoming assignments:', error);
      return [];
    }
  }

  // Get student's submission for an assignment
  static async getStudentSubmission(assignmentId: string, studentId: string): Promise<AssignmentSubmission | null> {
    try {
      const q = query(
        collection(db, 'assignment_submissions'),
        where('assignmentId', '==', assignmentId),
        where('studentId', '==', studentId)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }
      
      const doc = querySnapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data()
      } as AssignmentSubmission;
    } catch (error) {
      console.error('Error fetching student submission:', error);
      return null;
    }
  }

  // Submit assignment
  static async submitAssignment(
    assignmentId: string,
    studentId: string,
    courseId: string,
    content?: string,
    attachments?: string[]
  ): Promise<{ success: boolean; message: string; submissionId?: string }> {
    try {
      // Check if already submitted
      const existingSubmission = await this.getStudentSubmission(assignmentId, studentId);
      if (existingSubmission) {
        return {
          success: false,
          message: 'Assignment already submitted'
        };
      }

      // Get assignment to check due date
      const assignmentDoc = await getDoc(doc(db, 'assignments', assignmentId));
      if (!assignmentDoc.exists()) {
        return {
          success: false,
          message: 'Assignment not found'
        };
      }

      const assignment = assignmentDoc.data() as Assignment;
      const now = Timestamp.now();
      const isLate = now.seconds > assignment.dueDate.seconds;

      const submissionData: Omit<AssignmentSubmission, 'id'> = {
        assignmentId,
        studentId,
        courseId,
        submittedAt: serverTimestamp() as Timestamp,
        content: content || '',
        attachments: attachments || [],
        status: isLate ? 'late' : 'submitted'
      };

      const submissionRef = await addDoc(collection(db, 'assignment_submissions'), submissionData);

      return {
        success: true,
        message: isLate ? 'Assignment submitted late' : 'Assignment submitted successfully',
        submissionId: submissionRef.id
      };
    } catch (error) {
      console.error('Error submitting assignment:', error);
      return {
        success: false,
        message: 'Failed to submit assignment'
      };
    }
  }

  // Get student's submissions for a course
  static async getStudentSubmissions(studentId: string, courseId: string): Promise<AssignmentSubmission[]> {
    try {
      const q = query(
        collection(db, 'assignment_submissions'),
        where('studentId', '==', studentId),
        where('courseId', '==', courseId),
        orderBy('submittedAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const submissions: AssignmentSubmission[] = [];
      
      querySnapshot.forEach(doc => {
        submissions.push({
          id: doc.id,
          ...doc.data()
        } as AssignmentSubmission);
      });
      
      return submissions;
    } catch (error) {
      console.error('Error fetching student submissions:', error);
      return [];
    }
  }
}

export default AssignmentService;
