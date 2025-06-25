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
  limit,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';

// Notification interfaces
export interface Notification {
  id: string;
  userId: string;
  type: 'assignment' | 'grade' | 'course' | 'system' | 'reminder';
  title: string;
  message: string;
  isRead: boolean;
  priority: 'low' | 'medium' | 'high';
  actionUrl?: string;
  actionText?: string;
  relatedId?: string; // courseId, assignmentId, etc.
  createdAt: Timestamp;
  readAt?: Timestamp;
  expiresAt?: Timestamp;
}

export interface NotificationPreferences {
  userId: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  assignmentReminders: boolean;
  gradeNotifications: boolean;
  courseUpdates: boolean;
  systemAnnouncements: boolean;
}

export class NotificationService {
  
  // Create a notification
  static async createNotification(notificationData: Omit<Notification, 'id' | 'createdAt' | 'isRead'>): Promise<{ success: boolean; message: string; notificationId?: string }> {
    try {
      const notification: Omit<Notification, 'id'> = {
        ...notificationData,
        isRead: false,
        createdAt: serverTimestamp() as Timestamp
      };

      const notificationRef = await addDoc(collection(db, 'notifications'), notification);

      return {
        success: true,
        message: 'Notification created successfully',
        notificationId: notificationRef.id
      };
    } catch (error) {
      console.error('Error creating notification:', error);
      return {
        success: false,
        message: 'Failed to create notification'
      };
    }
  }

  // Get notifications for a user
  static async getUserNotifications(userId: string, limitCount: number = 20): Promise<Notification[]> {
    try {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
      
      const querySnapshot = await getDocs(q);
      const notifications: Notification[] = [];
      
      querySnapshot.forEach(doc => {
        const data = doc.data();
        // Check if notification has expired
        if (!data.expiresAt || data.expiresAt.seconds > Date.now() / 1000) {
          notifications.push({
            id: doc.id,
            ...data
          } as Notification);
        }
      });
      
      return notifications;
    } catch (error) {
      console.error('Error fetching user notifications:', error);
      return [];
    }
  }

  // Get unread notifications count
  static async getUnreadCount(userId: string): Promise<number> {
    try {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('isRead', '==', false)
      );
      
      const querySnapshot = await getDocs(q);
      
      // Filter out expired notifications
      let count = 0;
      querySnapshot.forEach(doc => {
        const data = doc.data();
        if (!data.expiresAt || data.expiresAt.seconds > Date.now() / 1000) {
          count++;
        }
      });
      
      return count;
    } catch (error) {
      console.error('Error fetching unread count:', error);
      return 0;
    }
  }

  // Mark notification as read
  static async markAsRead(notificationId: string): Promise<boolean> {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        isRead: true,
        readAt: serverTimestamp()
      });
      
      return true;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  }

  // Mark all notifications as read for a user
  static async markAllAsRead(userId: string): Promise<boolean> {
    try {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('isRead', '==', false)
      );
      
      const querySnapshot = await getDocs(q);
      
      const updatePromises = querySnapshot.docs.map(doc => 
        updateDoc(doc.ref, {
          isRead: true,
          readAt: serverTimestamp()
        })
      );
      
      await Promise.all(updatePromises);
      return true;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return false;
    }
  }

  // Create assignment reminder notification
  static async createAssignmentReminder(
    userId: string,
    assignmentTitle: string,
    courseTitle: string,
    dueDate: Timestamp,
    assignmentId: string
  ): Promise<void> {
    try {
      const now = new Date();
      const due = dueDate.toDate();
      const timeDiff = due.getTime() - now.getTime();
      const daysUntilDue = Math.ceil(timeDiff / (1000 * 3600 * 24));

      let message = '';
      let priority: 'low' | 'medium' | 'high' = 'medium';

      if (daysUntilDue <= 1) {
        message = `Assignment "${assignmentTitle}" in ${courseTitle} is due today!`;
        priority = 'high';
      } else if (daysUntilDue <= 3) {
        message = `Assignment "${assignmentTitle}" in ${courseTitle} is due in ${daysUntilDue} days.`;
        priority = 'medium';
      } else {
        message = `Assignment "${assignmentTitle}" in ${courseTitle} is due in ${daysUntilDue} days.`;
        priority = 'low';
      }

      await this.createNotification({
        userId,
        type: 'assignment',
        title: 'Assignment Due Soon',
        message,
        priority,
        actionUrl: `/student/assignments/${assignmentId}`,
        actionText: 'View Assignment',
        relatedId: assignmentId
      });
    } catch (error) {
      console.error('Error creating assignment reminder:', error);
    }
  }

  // Create grade notification
  static async createGradeNotification(
    userId: string,
    assignmentTitle: string,
    courseTitle: string,
    grade: string,
    gradeId: string
  ): Promise<void> {
    try {
      await this.createNotification({
        userId,
        type: 'grade',
        title: 'New Grade Available',
        message: `Your grade for "${assignmentTitle}" in ${courseTitle} is now available: ${grade}`,
        priority: 'medium',
        actionUrl: `/student/grades`,
        actionText: 'View Grades',
        relatedId: gradeId
      });
    } catch (error) {
      console.error('Error creating grade notification:', error);
    }
  }

  // Create course update notification
  static async createCourseUpdateNotification(
    userIds: string[],
    courseTitle: string,
    updateMessage: string,
    courseId: string
  ): Promise<void> {
    try {
      const notifications = userIds.map(userId => ({
        userId,
        type: 'course' as const,
        title: `Course Update: ${courseTitle}`,
        message: updateMessage,
        priority: 'medium' as const,
        actionUrl: `/student/courses/${courseId}`,
        actionText: 'View Course',
        relatedId: courseId
      }));

      const createPromises = notifications.map(notification => 
        this.createNotification(notification)
      );

      await Promise.all(createPromises);
    } catch (error) {
      console.error('Error creating course update notifications:', error);
    }
  }

  // Get notification preferences for a user
  static async getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      const docRef = doc(db, 'notification_preferences', userId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return docSnap.data() as NotificationPreferences;
      } else {
        // Return default preferences
        return {
          userId,
          emailNotifications: true,
          pushNotifications: true,
          assignmentReminders: true,
          gradeNotifications: true,
          courseUpdates: true,
          systemAnnouncements: true
        };
      }
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
      return {
        userId,
        emailNotifications: true,
        pushNotifications: true,
        assignmentReminders: true,
        gradeNotifications: true,
        courseUpdates: true,
        systemAnnouncements: true
      };
    }
  }

  // Update notification preferences
  static async updateNotificationPreferences(preferences: NotificationPreferences): Promise<boolean> {
    try {
      const docRef = doc(db, 'notification_preferences', preferences.userId);
      await updateDoc(docRef, preferences);
      return true;
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      return false;
    }
  }
}

export default NotificationService;
