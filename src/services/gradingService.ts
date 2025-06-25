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

// Grade interfaces
export interface Grade {
  id: string;
  studentId: string;
  courseId: string;
  assignmentId?: string;
  quizId?: string;
  type: 'assignment' | 'quiz' | 'exam' | 'participation';
  title: string;
  points: number;
  maxPoints: number;
  percentage: number;
  letterGrade: string;
  feedback?: string;
  gradedAt: Timestamp;
  gradedBy: string; // instructor ID
  isPublished: boolean;
}

export interface GradeStats {
  totalPoints: number;
  maxTotalPoints: number;
  averagePercentage: number;
  letterGrade: string;
  gpa: number;
  assignmentCount: number;
  quizCount: number;
  examCount: number;
}

export class GradingService {
  
  // Calculate letter grade from percentage
  static calculateLetterGrade(percentage: number): string {
    if (percentage >= 97) return 'A+';
    if (percentage >= 93) return 'A';
    if (percentage >= 90) return 'A-';
    if (percentage >= 87) return 'B+';
    if (percentage >= 83) return 'B';
    if (percentage >= 80) return 'B-';
    if (percentage >= 77) return 'C+';
    if (percentage >= 73) return 'C';
    if (percentage >= 70) return 'C-';
    if (percentage >= 67) return 'D+';
    if (percentage >= 63) return 'D';
    if (percentage >= 60) return 'D-';
    return 'F';
  }

  // Calculate GPA from letter grade
  static calculateGPA(letterGrade: string): number {
    const gradePoints: { [key: string]: number } = {
      'A+': 4.0, 'A': 4.0, 'A-': 3.7,
      'B+': 3.3, 'B': 3.0, 'B-': 2.7,
      'C+': 2.3, 'C': 2.0, 'C-': 1.7,
      'D+': 1.3, 'D': 1.0, 'D-': 0.7,
      'F': 0.0
    };
    return gradePoints[letterGrade] || 0.0;
  }

  // Add a grade
  static async addGrade(gradeData: Omit<Grade, 'id' | 'gradedAt' | 'percentage' | 'letterGrade'>): Promise<{ success: boolean; message: string; gradeId?: string }> {
    try {
      const percentage = Math.round((gradeData.points / gradeData.maxPoints) * 100);
      const letterGrade = this.calculateLetterGrade(percentage);

      const grade: Omit<Grade, 'id'> = {
        ...gradeData,
        percentage,
        letterGrade,
        gradedAt: serverTimestamp() as Timestamp
      };

      const gradeRef = await addDoc(collection(db, 'grades'), grade);

      return {
        success: true,
        message: 'Grade added successfully',
        gradeId: gradeRef.id
      };
    } catch (error) {
      console.error('Error adding grade:', error);
      return {
        success: false,
        message: 'Failed to add grade'
      };
    }
  }

  // Get student grades for a course
  static async getStudentCourseGrades(studentId: string, courseId: string): Promise<Grade[]> {
    try {
      const q = query(
        collection(db, 'grades'),
        where('studentId', '==', studentId),
        where('courseId', '==', courseId),
        where('isPublished', '==', true),
        orderBy('gradedAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const grades: Grade[] = [];
      
      querySnapshot.forEach(doc => {
        grades.push({
          id: doc.id,
          ...doc.data()
        } as Grade);
      });
      
      return grades;
    } catch (error) {
      console.error('Error fetching student course grades:', error);
      return [];
    }
  }

  // Get all grades for a student
  static async getStudentGrades(studentId: string): Promise<Grade[]> {
    try {
      const q = query(
        collection(db, 'grades'),
        where('studentId', '==', studentId),
        where('isPublished', '==', true),
        orderBy('gradedAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const grades: Grade[] = [];
      
      querySnapshot.forEach(doc => {
        grades.push({
          id: doc.id,
          ...doc.data()
        } as Grade);
      });
      
      return grades;
    } catch (error) {
      console.error('Error fetching student grades:', error);
      return [];
    }
  }

  // Get recent grades for a student
  static async getRecentGrades(studentId: string, limit: number = 5): Promise<Grade[]> {
    try {
      const q = query(
        collection(db, 'grades'),
        where('studentId', '==', studentId),
        where('isPublished', '==', true),
        orderBy('gradedAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const grades: Grade[] = [];
      
      querySnapshot.forEach(doc => {
        if (grades.length < limit) {
          grades.push({
            id: doc.id,
            ...doc.data()
          } as Grade);
        }
      });
      
      return grades;
    } catch (error) {
      console.error('Error fetching recent grades:', error);
      return [];
    }
  }

  // Calculate grade statistics for a student in a course
  static async calculateCourseGradeStats(studentId: string, courseId: string): Promise<GradeStats> {
    try {
      const grades = await this.getStudentCourseGrades(studentId, courseId);
      
      if (grades.length === 0) {
        return {
          totalPoints: 0,
          maxTotalPoints: 0,
          averagePercentage: 0,
          letterGrade: 'N/A',
          gpa: 0,
          assignmentCount: 0,
          quizCount: 0,
          examCount: 0
        };
      }

      const totalPoints = grades.reduce((sum, grade) => sum + grade.points, 0);
      const maxTotalPoints = grades.reduce((sum, grade) => sum + grade.maxPoints, 0);
      const averagePercentage = Math.round((totalPoints / maxTotalPoints) * 100);
      const letterGrade = this.calculateLetterGrade(averagePercentage);
      const gpa = this.calculateGPA(letterGrade);

      const assignmentCount = grades.filter(g => g.type === 'assignment').length;
      const quizCount = grades.filter(g => g.type === 'quiz').length;
      const examCount = grades.filter(g => g.type === 'exam').length;

      return {
        totalPoints,
        maxTotalPoints,
        averagePercentage,
        letterGrade,
        gpa,
        assignmentCount,
        quizCount,
        examCount
      };
    } catch (error) {
      console.error('Error calculating grade stats:', error);
      return {
        totalPoints: 0,
        maxTotalPoints: 0,
        averagePercentage: 0,
        letterGrade: 'N/A',
        gpa: 0,
        assignmentCount: 0,
        quizCount: 0,
        examCount: 0
      };
    }
  }

  // Calculate overall GPA for a student
  static async calculateOverallGPA(studentId: string): Promise<number> {
    try {
      const grades = await this.getStudentGrades(studentId);
      
      if (grades.length === 0) return 0;

      // Group grades by course
      const courseGrades: { [courseId: string]: Grade[] } = {};
      grades.forEach(grade => {
        if (!courseGrades[grade.courseId]) {
          courseGrades[grade.courseId] = [];
        }
        courseGrades[grade.courseId].push(grade);
      });

      // Calculate GPA for each course
      const courseGPAs: number[] = [];
      for (const courseId in courseGrades) {
        const courseGradeList = courseGrades[courseId];
        const totalPoints = courseGradeList.reduce((sum, grade) => sum + grade.points, 0);
        const maxTotalPoints = courseGradeList.reduce((sum, grade) => sum + grade.maxPoints, 0);
        const coursePercentage = (totalPoints / maxTotalPoints) * 100;
        const courseLetter = this.calculateLetterGrade(coursePercentage);
        const courseGPA = this.calculateGPA(courseLetter);
        courseGPAs.push(courseGPA);
      }

      // Calculate overall GPA
      const overallGPA = courseGPAs.reduce((sum, gpa) => sum + gpa, 0) / courseGPAs.length;
      return Math.round(overallGPA * 100) / 100; // Round to 2 decimal places
    } catch (error) {
      console.error('Error calculating overall GPA:', error);
      return 0;
    }
  }
}

export default GradingService;
