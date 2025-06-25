import React, { useState, useEffect, ChangeEvent } from 'react';
import {
  BookOpen,
  Plus,
  Upload,
  Search,
  Filter,
  Edit,
  Trash2,
  Eye,
  Users,
  Clock,
  FileText,
} from 'lucide-react';

import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';

import { db } from '../../lib/firebase'; // Adjust path
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from 'firebase/storage';

const storage = getStorage();

// Utility function to test if an image URL is accessible
const testImageUrl = async (url: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
    // Timeout after 5 seconds
    setTimeout(() => resolve(false), 5000);
  });
};

// Utility function to get a working image URL
const getWorkingImageUrl = async (url: string): Promise<string | null> => {
  if (!url) return null;

  console.log('Testing image URL:', url);

  // Test the original URL
  const isWorking = await testImageUrl(url);
  if (isWorking) {
    console.log('✅ Original URL works:', url);
    return url;
  }

  console.log('❌ Original URL failed:', url);

  // Try adding token if it's a Firebase Storage URL
  if (url.includes('firebasestorage.googleapis.com')) {
    try {
      // Try to get a fresh download URL
      const urlParts = url.split('/');
      const fileName = urlParts[urlParts.length - 1].split('?')[0];
      console.log('Attempting to refresh Firebase Storage URL for:', fileName);

      // This would require the storage reference, but for now just return null
      // In a real scenario, you'd want to refresh the download URL
    } catch (error) {
      console.error('Error refreshing Firebase Storage URL:', error);
    }
  }

  return null;
};

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

interface ContentBlock {
  id: string;
  type: 'text' | 'image' | 'video' | 'quiz';
  content?: string; // for text
  url?: string; // for image/video URLs
  quizData?: QuizQuestion[]; // for quiz blocks
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
  test?: QuizQuestion[]; // General test for module
}

interface Course {
  id: string; // Firestore doc id
  title: string;
  description: string;
  category: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  duration?: string;
  students: number;
  status: 'Published' | 'Draft' | 'Under Review';
  thumbnail?: string;
  createdAt: any; // Firestore Timestamp
  lastUpdated: any; // Firestore Timestamp
  modules: Module[];
}

const categories = ['all', 'Security', 'Network', 'Awareness', 'Compliance'];

const Courses = () => {
  // State for courses from Firestore
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search/filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Modal control states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewCourse, setPreviewCourse] = useState<Course | null>(null);
  const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null);

  // Course creation states
  const [courseTitle, setCourseTitle] = useState('');
  const [courseDescription, setCourseDescription] = useState('');
  const [courseCategory, setCourseCategory] = useState('Security');
  const [courseLevel, setCourseLevel] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Beginner');
  const [courseStatus, setCourseStatus] = useState<'Published' | 'Draft' | 'Under Review'>('Draft');
  const [modules, setModules] = useState<Module[]>([]);
  const [courseThumbnail, setCourseThumbnail] = useState<string>('');
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  useEffect(() => {
    const fetchCourses = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'courses'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const coursesData: Course[] = [];
        querySnapshot.forEach(docSnap => {
          const data = docSnap.data();
          coursesData.push({
            id: docSnap.id,
            title: data.title,
            description: data.description,
            category: data.category,
            level: data.level,
            duration: data.duration || '',
            students: data.students || 0,
            status: data.status || 'Draft',
            thumbnail: data.thumbnail || '',
            createdAt: data.createdAt,
            lastUpdated: data.lastUpdated,
            modules: data.modules || [],
          });
        });
        setCourses(coursesData);
        setError(null);
      } catch (err) {
        setError('Failed to load courses');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, []);

  // Filtered courses
  const filteredCourses = courses.filter(course => {
    const matchesSearch =
      course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || course.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Colors for badges
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Published': return 'bg-green-100 text-green-800';
      case 'Draft': return 'bg-yellow-100 text-yellow-800';
      case 'Under Review': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'Beginner': return 'bg-green-100 text-green-800';
      case 'Intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'Advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // --- Create course modal logic ---

  const generateId = () => Math.random().toString(36).substr(2, 9);

  // Modules management
  const addModule = () => {
    setModules([...modules, { id: generateId(), title: '', lessons: [], test: [] }]);
  };

  const removeModule = (moduleId: string) => {
    setModules(modules.filter(m => m.id !== moduleId));
  };

  const updateModuleTitle = (moduleId: string, title: string) => {
    setModules(modules.map(m => m.id === moduleId ? { ...m, title } : m));
  };

  // Lessons management
  const addLesson = (moduleId: string) => {
    setModules(modules.map(m => {
      if (m.id === moduleId) {
        return {
          ...m,
          lessons: [...m.lessons, { id: generateId(), title: '', contentBlocks: [] }]
        };
      }
      return m;
    }));
  };

  const removeLesson = (moduleId: string, lessonId: string) => {
    setModules(modules.map(m => {
      if (m.id === moduleId) {
        return {
          ...m,
          lessons: m.lessons.filter(l => l.id !== lessonId)
        };
      }
      return m;
    }));
  };

  const updateLessonTitle = (moduleId: string, lessonId: string, title: string) => {
    setModules(modules.map(m => {
      if (m.id === moduleId) {
        return {
          ...m,
          lessons: m.lessons.map(l => l.id === lessonId ? { ...l, title } : l)
        };
      }
      return m;
    }));
  };

  // Content blocks management
  const addContentBlock = (moduleId: string, lessonId: string, type: ContentBlock['type']) => {
    const newBlock: ContentBlock = { id: generateId(), type };
    setModules(modules.map(m => {
      if (m.id === moduleId) {
        return {
          ...m,
          lessons: m.lessons.map(l => {
            if (l.id === lessonId) {
              return {
                ...l,
                contentBlocks: [...l.contentBlocks, newBlock]
              };
            }
            return l;
          })
        };
      }
      return m;
    }));
  };

  const removeContentBlock = (moduleId: string, lessonId: string, blockId: string) => {
    setModules(modules.map(m => {
      if (m.id === moduleId) {
        return {
          ...m,
          lessons: m.lessons.map(l => {
            if (l.id === lessonId) {
              return {
                ...l,
                contentBlocks: l.contentBlocks.filter(cb => cb.id !== blockId)
              };
            }
            return l;
          })
        };
      }
      return m;
    }));
  };

  const updateContentBlockText = (moduleId: string, lessonId: string, blockId: string, text: string) => {
    setModules(modules.map(m => {
      if (m.id === moduleId) {
        return {
          ...m,
          lessons: m.lessons.map(l => {
            if (l.id === lessonId) {
              return {
                ...l,
                contentBlocks: l.contentBlocks.map(cb => cb.id === blockId ? { ...cb, content: text } : cb)
              };
            }
            return l;
          })
        };
      }
      return m;
    }));
  };

  // *** Upload thumbnail image for course ***
  const handleThumbnailUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setThumbnailFile(file);

    // Create storage ref
    const storageRef = ref(storage, `course-thumbnails/${courseTitle || 'temp-course'}-${Date.now()}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      },
      (error) => {
        console.error('Thumbnail upload error:', error);
        alert('Thumbnail upload failed. Try again.');
        setUploadProgress(0);
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then(downloadURL => {
          setCourseThumbnail(downloadURL);
          setUploadProgress(0);
          alert('Thumbnail uploaded successfully!');
        });
      });
  };

  // *** Upload image or video file for content blocks ***

  const handleFileUpload = (
    e: ChangeEvent<HTMLInputElement>,
    moduleId: string,
    lessonId: string,
    blockId: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('Starting file upload:', {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      moduleId,
      lessonId,
      blockId
    });

    // Create storage ref
    const storageRef = ref(storage, `courses/${courseTitle || 'temp-course'}/${file.name}-${Date.now()}`);

    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        console.log('Upload progress:', progress + '%');
      },
      (error) => {
        console.error('Upload error:', error);
        alert('Upload failed. Try again. Error: ' + error.message);
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then(downloadURL => {
          console.log('Upload successful! Download URL:', downloadURL);

          // Update the URL of the content block
          setModules(currentModules => currentModules.map(m => {
            if (m.id === moduleId) {
              return {
                ...m,
                lessons: m.lessons.map(l => {
                  if (l.id === lessonId) {
                    return {
                      ...l,
                      contentBlocks: l.contentBlocks.map(cb => {
                        if (cb.id === blockId) {
                          console.log('Updating content block with URL:', downloadURL);
                          return { ...cb, url: downloadURL };
                        }
                        return cb;
                      })
                    };
                  }
                  return l;
                })
              };
            }
            return m;
          }));
          alert('Upload successful! File is now available.');
        }).catch(error => {
          console.error('Error getting download URL:', error);
          alert('Upload completed but failed to get download URL: ' + error.message);
        });
      });
  };

  // --- Multiple choice quiz inside content blocks ---

  // Add a quiz block to a lesson
  const addQuizBlock = (moduleId: string, lessonId: string) => {
    const newQuizBlock: ContentBlock = {
      id: generateId(),
      type: 'quiz',
      quizData: [
        {
          id: generateId(),
          question: '',
          options: [
            { id: generateId(), text: '', isCorrect: false },
          ],
        },
      ],
    };
    setModules(modules.map(m => {
      if (m.id === moduleId) {
        return {
          ...m,
          lessons: m.lessons.map(l => {
            if (l.id === lessonId) {
              return {
                ...l,
                contentBlocks: [...l.contentBlocks, newQuizBlock],
              };
            }
            return l;
          }),
        };
      }
      return m;
    }));
  };

  // Update quiz question text
  const updateQuizQuestion = (
    moduleId: string,
    lessonId: string,
    blockId: string,
    questionId: string,
    text: string
  ) => {
    setModules(modules.map(m => {
      if (m.id === moduleId) {
        return {
          ...m,
          lessons: m.lessons.map(l => {
            if (l.id === lessonId) {
              return {
                ...l,
                contentBlocks: l.contentBlocks.map(cb => {
                  if (cb.id === blockId && cb.quizData) {
                    return {
                      ...cb,
                      quizData: cb.quizData.map(q => q.id === questionId ? { ...q, question: text } : q)
                    };
                  }
                  return cb;
                })
              };
            }
            return l;
          })
        };
      }
      return m;
    }));
  };

  // Add a question to quiz block
  const addQuizQuestion = (moduleId: string, lessonId: string, blockId: string) => {
    const newQuestion: QuizQuestion = {
      id: generateId(),
      question: '',
      options: [
        { id: generateId(), text: '', isCorrect: false }
      ],
    };
    setModules(modules.map(m => {
      if (m.id === moduleId) {
        return {
          ...m,
          lessons: m.lessons.map(l => {
            if (l.id === lessonId) {
              return {
                ...l,
                contentBlocks: l.contentBlocks.map(cb => {
                  if (cb.id === blockId && cb.quizData) {
                    return { ...cb, quizData: [...cb.quizData, newQuestion] };
                  }
                  return cb;
                })
              };
            }
            return l;
          })
        };
      }
      return m;
    }));
  };

  // Remove a question from quiz block
  const removeQuizQuestion = (moduleId: string, lessonId: string, blockId: string, questionId: string) => {
    setModules(modules.map(m => {
      if (m.id === moduleId) {
        return {
          ...m,
          lessons: m.lessons.map(l => {
            if (l.id === lessonId) {
              return {
                ...l,
                contentBlocks: l.contentBlocks.map(cb => {
                  if (cb.id === blockId && cb.quizData) {
                    return { ...cb, quizData: cb.quizData.filter(q => q.id !== questionId) };
                  }
                  return cb;
                })
              };
            }
            return l;
          })
        };
      }
      return m;
    }));
  };

  // Update quiz option text
  const updateQuizOptionText = (
    moduleId: string,
    lessonId: string,
    blockId: string,
    questionId: string,
    optionId: string,
    text: string
  ) => {
    setModules(modules.map(m => {
      if (m.id === moduleId) {
        return {
          ...m,
          lessons: m.lessons.map(l => {
            if (l.id === lessonId) {
              return {
                ...l,
                contentBlocks: l.contentBlocks.map(cb => {
                  if (cb.id === blockId && cb.quizData) {
                    return {
                      ...cb,
                      quizData: cb.quizData.map(q => {
                        if (q.id === questionId) {
                          return {
                            ...q,
                            options: q.options.map(o => o.id === optionId ? { ...o, text } : o)
                          };
                        }
                        return q;
                      })
                    };
                  }
                  return cb;
                })
              };
            }
            return l;
          })
        };
      }
      return m;
    }));
  };

  // Toggle quiz option correctness
  const toggleQuizOptionCorrect = (
    moduleId: string,
    lessonId: string,
    blockId: string,
    questionId: string,
    optionId: string
  ) => {
    setModules(modules.map(m => {
      if (m.id === moduleId) {
        return {
          ...m,
          lessons: m.lessons.map(l => {
            if (l.id === lessonId) {
              return {
                ...l,
                contentBlocks: l.contentBlocks.map(cb => {
                  if (cb.id === blockId && cb.quizData) {
                    return {
                      ...cb,
                      quizData: cb.quizData.map(q => {
                        if (q.id === questionId) {
                          return {
                            ...q,
                            options: q.options.map(o => o.id === optionId ? { ...o, isCorrect: !o.isCorrect } : o)
                          };
                        }
                        return q;
                      })
                    };
                  }
                  return cb;
                })
              };
            }
            return l;
          })
        };
      }
      return m;
    }));
  };

  // Add option to question
  const addQuizOption = (
    moduleId: string,
    lessonId: string,
    blockId: string,
    questionId: string
  ) => {
    const newOption = { id: generateId(), text: '', isCorrect: false };
    setModules(modules.map(m => {
      if (m.id === moduleId) {
        return {
          ...m,
          lessons: m.lessons.map(l => {
            if (l.id === lessonId) {
              return {
                ...l,
                contentBlocks: l.contentBlocks.map(cb => {
                  if (cb.id === blockId && cb.quizData) {
                    return {
                      ...cb,
                      quizData: cb.quizData.map(q => {
                        if (q.id === questionId) {
                          return { ...q, options: [...q.options, newOption] };
                        }
                        return q;
                      })
                    };
                  }
                  return cb;
                })
              };
            }
            return l;
          })
        };
      }
      return m;
    }));
  };

  // Remove option from question
  const removeQuizOption = (
    moduleId: string,
    lessonId: string,
    blockId: string,
    questionId: string,
    optionId: string
  ) => {
    setModules(modules.map(m => {
      if (m.id === moduleId) {
        return {
          ...m,
          lessons: m.lessons.map(l => {
            if (l.id === lessonId) {
              return {
                ...l,
                contentBlocks: l.contentBlocks.map(cb => {
                  if (cb.id === blockId && cb.quizData) {
                    return {
                      ...cb,
                      quizData: cb.quizData.map(q => {
                        if (q.id === questionId) {
                          return { ...q, options: q.options.filter(o => o.id !== optionId) };
                        }
                        return q;
                      })
                    };
                  }
                  return cb;
                })
              };
            }
            return l;
          })
        };
      }
      return m;
    }));
  };

  // --- General test for each module ---

  // Add a new question to module test
  const addModuleTestQuestion = (moduleId: string) => {
    const newQuestion: QuizQuestion = {
      id: generateId(),
      question: '',
      options: [{ id: generateId(), text: '', isCorrect: false }],
    };
    setModules(modules.map(m => m.id === moduleId
      ? { ...m, test: m.test ? [...m.test, newQuestion] : [newQuestion] }
      : m
    ));
  };

  // Update module test question text
  const updateModuleTestQuestion = (moduleId: string, questionId: string, text: string) => {
    setModules(modules.map(m => {
      if (m.id === moduleId && m.test) {
        return {
          ...m,
          test: m.test.map(q => q.id === questionId ? { ...q, question: text } : q),
        };
      }
      return m;
    }));
  };

  // Remove module test question
  const removeModuleTestQuestion = (moduleId: string, questionId: string) => {
    setModules(modules.map(m => {
      if (m.id === moduleId && m.test) {
        return { ...m, test: m.test.filter(q => q.id !== questionId) };
      }
      return m;
    }));
  };

  // Add option to module test question
  const addModuleTestOption = (moduleId: string, questionId: string) => {
    const newOption = { id: generateId(), text: '', isCorrect: false };
    setModules(modules.map(m => {
      if (m.id === moduleId && m.test) {
        return {
          ...m,
          test: m.test.map(q => q.id === questionId ? { ...q, options: [...q.options, newOption] } : q),
        };
      }
      return m;
    }));
  };

  // Update module test option text
  const updateModuleTestOptionText = (moduleId: string, questionId: string, optionId: string, text: string) => {
    setModules(modules.map(m => {
      if (m.id === moduleId && m.test) {
        return {
          ...m,
          test: m.test.map(q => {
            if (q.id === questionId) {
              return {
                ...q,
                options: q.options.map(o => o.id === optionId ? { ...o, text } : o)
              };
            }
            return q;
          }),
        };
      }
      return m;
    }));
  };

  // Toggle module test option correctness
  const toggleModuleTestOptionCorrect = (moduleId: string, questionId: string, optionId: string) => {
    setModules(modules.map(m => {
      if (m.id === moduleId && m.test) {
        return {
          ...m,
          test: m.test.map(q => {
            if (q.id === questionId) {
              return {
                ...q,
                options: q.options.map(o => o.id === optionId ? { ...o, isCorrect: !o.isCorrect } : o)
              };
            }
            return q;
          }),
        };
      }
      return m;
    }));
  };

  // Remove option from module test question
  const removeModuleTestOption = (moduleId: string, questionId: string, optionId: string) => {
    setModules(modules.map(m => {
      if (m.id === moduleId && m.test) {
        return {
          ...m,
          test: m.test.map(q => {
            if (q.id === questionId) {
              return {
                ...q,
                options: q.options.filter(o => o.id !== optionId)
              };
            }
            return q;
          }),
        };
      }
      return m;
    }));
  };

  // --- Reset create modal ---
  const resetCreateModal = () => {
    setCourseTitle('');
    setCourseDescription('');
    setCourseCategory('Security');
    setCourseLevel('Beginner');
    setCourseStatus('Draft');
    setModules([]);
    setCourseThumbnail('');
    setThumbnailFile(null);
    setIsEditing(false);
    setEditingCourseId(null);
    setUploadProgress(0);
    setShowCreateModal(false);
  };

  // Edit course functionality
  const handleEditCourse = (course: Course) => {
    setCourseTitle(course.title);
    setCourseDescription(course.description);
    setCourseCategory(course.category);
    setCourseLevel(course.level);
    setCourseStatus(course.status);
    setModules(course.modules);
    setCourseThumbnail(course.thumbnail || '');
    setIsEditing(true);
    setEditingCourseId(course.id);
    setShowCreateModal(true);
  };

  // Quick status change functionality
  const handleStatusChange = async (courseId: string, newStatus: 'Published' | 'Draft' | 'Under Review') => {
    try {
      const courseRef = doc(db, 'courses', courseId);
      await updateDoc(courseRef, {
        status: newStatus,
        lastUpdated: serverTimestamp(),
      });

      // Update local state
      setCourses(prevCourses =>
        prevCourses.map(course =>
          course.id === courseId
            ? { ...course, status: newStatus }
            : course
        )
      );

      console.log('Course status updated successfully');
    } catch (error) {
      console.error('Error updating course status:', error);
    }
  };

  // Preview course functionality
  const handlePreviewCourse = (course: Course) => {
    setPreviewCourse(course);
    setShowPreviewModal(true);
  };

  // Delete course functionality with enhanced safety and feedback
  const handleDeleteCourse = async (courseId: string, courseTitle: string) => {
    // Prevent multiple simultaneous deletions
    if (deletingCourseId) {
      alert('Please wait for the current deletion to complete.');
      return;
    }

    // Show confirmation dialog
    const isConfirmed = window.confirm(
      `⚠️ DANGER: Delete Course "${courseTitle}"?\n\nThis action CANNOT be undone and will permanently remove:\n\n• All course content and modules\n• Student enrollments and progress\n• Associated media files\n• Quiz results and grades\n\nAre you absolutely sure you want to proceed?`
    );

    if (!isConfirmed) {
      return;
    }

    // Additional confirmation for safety
    const confirmText = prompt(
      `🔒 FINAL CONFIRMATION\n\nTo permanently delete "${courseTitle}", type exactly: DELETE\n\n(This action cannot be undone)`
    );

    if (confirmText !== 'DELETE') {
      alert('❌ Deletion cancelled. You must type "DELETE" exactly to confirm.');
      return;
    }

    // Set loading state
    setDeletingCourseId(courseId);

    try {
      console.log(`🗑️ Attempting to delete course: ${courseId} - "${courseTitle}"`);

      // Delete the course document from Firestore
      await deleteDoc(doc(db, 'courses', courseId));

      // Update local state to remove the deleted course
      setCourses(prevCourses =>
        prevCourses.filter(course => course.id !== courseId)
      );

      console.log('✅ Course deleted successfully');
      alert(`✅ Success!\n\nCourse "${courseTitle}" has been permanently deleted.`);

    } catch (error) {
      console.error('❌ Error deleting course:', error);

      // Provide user-friendly error messages
      if (error instanceof Error) {
        if (error.message.includes('permission-denied')) {
          alert('🚫 Permission Denied\n\nYou do not have permission to delete this course.\nPlease contact your administrator.');
        } else if (error.message.includes('not-found')) {
          alert('⚠️ Course Not Found\n\nThis course may have already been deleted.\nRefreshing the page...');
          window.location.reload();
        } else if (error.message.includes('network')) {
          alert('🌐 Network Error\n\nPlease check your internet connection and try again.');
        } else {
          alert(`❌ Deletion Failed\n\nError: ${error.message}\n\nPlease try again or contact support.`);
        }
      } else {
        alert('❌ Unexpected Error\n\nFailed to delete course. Please try again or contact support.');
      }
    } finally {
      // Clear loading state
      setDeletingCourseId(null);
    }
  };

  // --- Save course to Firestore ---
  const handleCreateCourse = async () => {
    if (!courseTitle.trim() || !courseDescription.trim()) {
      alert('Title and description are required');
      return;
    }
    try {
      const courseData = {
        title: courseTitle,
        description: courseDescription,
        category: courseCategory,
        level: courseLevel,
        modules,
        students: isEditing ? courses.find(c => c.id === editingCourseId)?.students || 0 : 0,
        status: courseStatus,
        thumbnail: courseThumbnail,
        ...(isEditing ? {} : { createdAt: serverTimestamp() }),
        lastUpdated: serverTimestamp(),
      };

      if (isEditing && editingCourseId) {
        // Update existing course
        const { doc, updateDoc } = await import('firebase/firestore');
        await updateDoc(doc(db, 'courses', editingCourseId), courseData);
        alert('Course updated successfully!');
      } else {
        // Create new course
        await addDoc(collection(db, 'courses'), courseData);
        alert('Course created successfully!');
      }

      resetCreateModal();
      // Refetch courses
      setLoading(true);
      const q = query(collection(db, 'courses'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const coursesData: Course[] = [];
      querySnapshot.forEach(docSnap => {
        const data = docSnap.data();
        coursesData.push({
          id: docSnap.id,
          title: data.title,
          description: data.description,
          category: data.category,
          level: data.level,
          duration: data.duration || '',
          students: data.students || 0,
          status: data.status || 'Draft',
          thumbnail: data.thumbnail || '',
          createdAt: data.createdAt,
          lastUpdated: data.lastUpdated,
          modules: data.modules || [],
        });
      });
      setCourses(coursesData);
      setLoading(false);
    } catch (error) {
      console.error(error);
      alert('Failed to create course');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Courses</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
        >
          + New Course
        </button>
      </div>

      {/* Search and filter */}
      <div className="flex items-center space-x-4 mb-6">
        <input
          type="text"
          placeholder="Search courses..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="flex-grow border border-gray-300 rounded-lg px-3 py-2"
        />
        <select
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2"
        >
          {categories.map(cat => (
            <option key={cat} value={cat}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Courses Grid */}
      {loading && <p>Loading courses...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && filteredCourses.length === 0 && <p>No courses found.</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCourses.map(course => (
          <div key={course.id} className="border rounded-lg overflow-hidden shadow hover:shadow-lg transition">
            <div className="relative">
              {course.thumbnail ? (
                <FirebaseImage
                  src={course.thumbnail}
                  alt={course.title}
                  className="w-full h-40 object-cover"
                />
              ) : (
                <div className="w-full h-40 bg-gray-200 flex items-center justify-center text-gray-500">
                  No Image
                </div>
              )}
              <select
                value={course.status}
                onChange={(e) => handleStatusChange(course.id, e.target.value as any)}
                className={`absolute top-2 left-2 px-2 py-1 rounded text-xs font-semibold border-none cursor-pointer ${getStatusColor(course.status)}`}
                onClick={(e) => e.stopPropagation()}
              >
                <option value="Draft">Draft</option>
                <option value="Under Review">Under Review</option>
                <option value="Published">Published</option>
              </select>
              <span
                className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-semibold ${getLevelColor(course.level)}`}
              >
                {course.level}
              </span>
            </div>
            <div className="p-4">
              <h3 className="text-lg font-semibold mb-2">{course.title}</h3>
              <p className="text-sm text-gray-600 mb-4 line-clamp-3">{course.description}</p>

              <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4" />
                  <span>{course.students} Students</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4" />
                  <span>{course.duration || '-'}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-2">
                <button
                  onClick={() => handlePreviewCourse(course)}
                  className="flex-1 flex items-center justify-center space-x-1 bg-blue-600 text-white py-2 px-3 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  <Eye className="w-4 h-4" />
                  <span>Preview</span>
                </button>
                <button
                  onClick={() => handleEditCourse(course)}
                  className="flex-1 flex items-center justify-center space-x-1 bg-green-600 text-white py-2 px-3 rounded-lg hover:bg-green-700 transition-colors text-sm"
                >
                  <Edit className="w-4 h-4" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => handleDeleteCourse(course.id, course.title)}
                  disabled={deletingCourseId === course.id}
                  className={`flex items-center justify-center py-2 px-3 rounded-lg transition-colors text-sm ${
                    deletingCourseId === course.id
                      ? 'bg-red-400 text-white cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                  title={
                    deletingCourseId === course.id
                      ? 'Deleting course...'
                      : `Delete course: ${course.title}`
                  }
                >
                  {deletingCourseId === course.id ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Course Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start overflow-auto justify-center z-50 pt-12 pb-12 px-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto">

            <h3 className="text-lg font-semibold mb-4">
              {isEditing ? 'Edit Course' : 'Create New Course'}
            </h3>

            <div className="space-y-4">

              {/* Course Info */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Course Title</label>
                <input
                  type="text"
                  value={courseTitle}
                  onChange={e => setCourseTitle(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter course title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={courseDescription}
                  onChange={e => setCourseDescription(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter course description"
                />
              </div>

              {/* Thumbnail Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Course Thumbnail</label>
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleThumbnailUpload}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {uploadProgress > 0 && (
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  )}
                  {courseThumbnail && (
                    <div className="mt-2">
                      <FirebaseImage
                        src={courseThumbnail}
                        alt="Course thumbnail preview"
                        className="w-32 h-20 object-cover rounded-lg border"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={courseCategory}
                    onChange={e => setCourseCategory(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option>Security</option>
                    <option>Network</option>
                    <option>Awareness</option>
                    <option>Compliance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
                  <select
                    value={courseLevel}
                    onChange={e => setCourseLevel(e.target.value as any)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option>Beginner</option>
                    <option>Intermediate</option>
                    <option>Advanced</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={courseStatus}
                    onChange={e => setCourseStatus(e.target.value as any)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Published">Published</option>
                  </select>
                </div>
              </div>

              {/* Modules Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-md font-semibold">Modules</h4>
                  <button
                    onClick={addModule}
                    className="flex items-center px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add Module
                  </button>
                </div>
                {modules.length === 0 && (
                  <p className="text-sm text-gray-500">No modules added yet.</p>
                )}

                {/* List Modules */}
                {modules.map((mod, mi) => (
                  <div key={mod.id} className="border rounded p-4 mb-4 bg-gray-50">

                    {/* Module Title and Remove */}
                    <div className="flex justify-between items-center mb-2">
                      <input
                        type="text"
                        placeholder={`Module ${mi + 1} Title`}
                        value={mod.title}
                        onChange={e => updateModuleTitle(mod.id, e.target.value)}
                        className="flex-grow border border-gray-300 rounded px-3 py-1 mr-3"
                      />
                      <button
                        onClick={() => removeModule(mod.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Remove module"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Module General Test (Quiz) */}
                    <div className="mb-4 border rounded p-3 bg-white">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-semibold text-sm">Module General Test (Quiz)</h5>
                        <button
                          onClick={() => addModuleTestQuestion(mod.id)}
                          className="flex items-center px-2 py-0.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-xs"
                        >
                          <Plus className="w-3 h-3 mr-1" /> Add Question
                        </button>
                      </div>
                      {(!mod.test || mod.test.length === 0) && (
                        <p className="text-xs text-gray-500">No questions added yet.</p>
                      )}

                      {/* List questions */}
                      {mod.test && mod.test.map((q, qi) => (
                        <div key={q.id} className="border rounded p-2 mb-2 bg-gray-100 relative">
                          <button
                            onClick={() => removeModuleTestQuestion(mod.id, q.id)}
                            className="absolute top-1 right-1 text-red-600 hover:text-red-800 text-xs"
                            title="Remove question"
                          >
                            ✕
                          </button>
                          <input
                            type="text"
                            placeholder={`Question ${qi + 1}`}
                            value={q.question}
                            onChange={e => updateModuleTestQuestion(mod.id, q.id, e.target.value)}
                            className="w-full border border-gray-300 rounded px-2 py-1 mb-2"
                          />
                          {/* Options */}
                          <div className="ml-2">
                            {q.options.map((opt, oi) => (
                              <div key={opt.id} className="flex items-center mb-1 space-x-2">
                                <input
                                  type="checkbox"
                                  checked={opt.isCorrect}
                                  onChange={() => toggleModuleTestOptionCorrect(mod.id, q.id, opt.id)}
                                />
                                <input
                                  type="text"
                                  placeholder={`Option ${oi + 1}`}
                                  value={opt.text}
                                  onChange={e => updateModuleTestOptionText(mod.id, q.id, opt.id, e.target.value)}
                                  className="border border-gray-300 rounded px-2 py-1 flex-grow"
                                />
                                <button
                                  onClick={() => removeModuleTestOption(mod.id, q.id, opt.id)}
                                  className="text-red-600 hover:text-red-800"
                                  title="Remove option"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => addModuleTestOption(mod.id, q.id)}
                              className="text-blue-600 hover:text-blue-800 text-xs"
                            >
                              + Add Option
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Lessons */}
                    <div className="ml-4">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-semibold text-sm">Lessons</h5>
                        <button
                          onClick={() => addLesson(mod.id)}
                          className="flex items-center px-2 py-0.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-xs"
                        >
                          <Plus className="w-3 h-3 mr-1" /> Add Lesson
                        </button>
                      </div>

                      {mod.lessons.length === 0 && (
                        <p className="text-xs text-gray-500">No lessons yet.</p>
                      )}

                      {/* List lessons */}
                      {mod.lessons.map((les, li) => (
                        <div key={les.id} className="border rounded p-3 mb-3 bg-white">

                          <div className="flex justify-between items-center mb-2">
                            <input
                              type="text"
                              placeholder={`Lesson ${li + 1} Title`}
                              value={les.title}
                              onChange={e => updateLessonTitle(mod.id, les.id, e.target.value)}
                              className="flex-grow border border-gray-300 rounded px-2 py-1 mr-3"
                            />
                            <button
                              onClick={() => removeLesson(mod.id, les.id)}
                              className="text-red-600 hover:text-red-800"
                              title="Remove lesson"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Content Blocks */}
                          <div className="mb-2">
                            <div className="flex space-x-2 mb-1 flex-wrap">
                              {['text', 'image', 'video', 'quiz'].map(type => (
                                <button
                                  key={type}
                                  onClick={() => {
                                    if(type === 'quiz') {
                                      addQuizBlock(mod.id, les.id);
                                    } else {
                                      addContentBlock(mod.id, les.id, type as ContentBlock['type']);
                                    }
                                  }}
                                  className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors whitespace-nowrap"
                                >
                                  + {type.charAt(0).toUpperCase() + type.slice(1)}
                                </button>
                              ))}
                            </div>

                            {les.contentBlocks.length === 0 && (
                              <p className="text-xs text-gray-500">No content blocks yet.</p>
                            )}

                            {les.contentBlocks.map((cb) => (
                              <div key={cb.id} className="border rounded p-3 mb-3 bg-gray-50 relative">

                                <button
                                  onClick={() => removeContentBlock(mod.id, les.id, cb.id)}
                                  className="absolute top-2 right-2 text-red-600 hover:text-red-800"
                                  title="Remove content block"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>

                                {/* Content Block UI */}
                                {cb.type === 'text' && (
                                  <textarea
                                    placeholder="Enter text content..."
                                    value={cb.content || ''}
                                    onChange={e => updateContentBlockText(mod.id, les.id, cb.id, e.target.value)}
                                    className="w-full border border-gray-300 rounded px-3 py-2 resize-y min-h-[80px]"
                                  />
                                )}

                                {(cb.type === 'image' || cb.type === 'video') && (
                                  <>
                                    <div className="space-y-2">
                                      <input
                                        type="file"
                                        accept={cb.type === 'image' ? 'image/*' : 'video/*'}
                                        onChange={e => handleFileUpload(e, mod.id, les.id, cb.id)}
                                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                                      />
                                      {cb.url && (
                                        <div className="flex space-x-2">
                                          <button
                                            onClick={() => {
                                              console.log('Testing URL:', cb.url);
                                              window.open(cb.url, '_blank');
                                            }}
                                            className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                                          >
                                            Test URL
                                          </button>
                                          <button
                                            onClick={() => {
                                              navigator.clipboard.writeText(cb.url || '');
                                              alert('URL copied to clipboard');
                                            }}
                                            className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200"
                                          >
                                            Copy URL
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                    {cb.url ? (
                                      <div className="mt-2 border border-gray-200 rounded-lg p-2 bg-gray-50">
                                        {cb.type === 'image' ? (
                                          <FirebaseImage
                                            src={cb.url}
                                            alt="uploaded content"
                                            className="max-w-full max-h-48 rounded object-contain mx-auto block"
                                          />
                                        ) : (
                                          <video
                                            src={cb.url}
                                            controls
                                            className="max-w-full max-h-48 rounded mx-auto block"
                                            onError={(e) => {
                                              console.error('Video failed to load:', cb.url);
                                            }}
                                            onLoadedData={() => console.log('Video loaded successfully:', cb.url)}
                                          >
                                            Your browser does not support the video tag.
                                          </video>
                                        )}
                                        <p className="text-xs text-gray-500 mt-1 text-center">
                                          {cb.type === 'image' ? 'Image' : 'Video'} uploaded successfully
                                        </p>
                                      </div>
                                    ) : (
                                      <div className="mt-2 p-4 border-2 border-dashed border-gray-300 rounded-lg text-center">
                                        <p className="text-gray-500 text-sm">
                                          {cb.type === 'image' ? '📷 No image uploaded yet' : '🎥 No video uploaded yet'}
                                        </p>
                                        <p className="text-gray-400 text-xs mt-1">
                                          Select a file above to upload
                                        </p>
                                      </div>
                                    )}
                                  </>
                                )}

                                {/* Quiz block UI */}
                                {cb.type === 'quiz' && cb.quizData && (
                                  <div className="space-y-4">
                                    {cb.quizData.map((q, qi) => (
                                      <div key={q.id} className="border rounded p-2 bg-white relative">
                                        <button
                                          onClick={() => removeQuizQuestion(mod.id, les.id, cb.id, q.id)}
                                          className="absolute top-1 right-1 text-red-600 hover:text-red-800 text-xs"
                                          title="Remove question"
                                        >
                                          ✕
                                        </button>
                                        <input
                                          type="text"
                                          placeholder={`Question ${qi + 1}`}
                                          value={q.question}
                                          onChange={e => updateQuizQuestion(mod.id, les.id, cb.id, q.id, e.target.value)}
                                          className="w-full border border-gray-300 rounded px-2 py-1 mb-2"
                                        />
                                        <div className="ml-2">
                                          {q.options.map((opt, oi) => (
                                            <div key={opt.id} className="flex items-center mb-1 space-x-2">
                                              <input
                                                type="checkbox"
                                                checked={opt.isCorrect}
                                                onChange={() => toggleQuizOptionCorrect(mod.id, les.id, cb.id, q.id, opt.id)}
                                              />
                                              <input
                                                type="text"
                                                placeholder={`Option ${oi + 1}`}
                                                value={opt.text}
                                                onChange={e => updateQuizOptionText(mod.id, les.id, cb.id, q.id, opt.id, e.target.value)}
                                                className="border border-gray-300 rounded px-2 py-1 flex-grow"
                                              />
                                              <button
                                                onClick={() => removeQuizOption(mod.id, les.id, cb.id, q.id, opt.id)}
                                                className="text-red-600 hover:text-red-800"
                                                title="Remove option"
                                              >
                                                ✕
                                              </button>
                                            </div>
                                          ))}
                                          <button
                                            onClick={() => addQuizOption(mod.id, les.id, cb.id, q.id)}
                                            className="text-blue-600 hover:text-blue-800 text-xs"
                                          >
                                            + Add Option
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                    <button
                                      onClick={() => addQuizQuestion(mod.id, les.id, cb.id)}
                                      className="text-green-600 hover:text-green-800 text-xs"
                                    >
                                      + Add Question
                                    </button>
                                  </div>
                                )}

                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                  </div>
                ))}

              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border rounded hover:bg-gray-100 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateCourse}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
                >
                  {isEditing ? 'Update Course' : 'Create Course'}
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* Preview Course Modal */}
      {showPreviewModal && previewCourse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start overflow-auto justify-center z-50 pt-12 pb-12 px-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">

            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Course Preview</h3>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {/* Course Header */}
            <div className="mb-6">
              {previewCourse.thumbnail && (
                <FirebaseImage
                  src={previewCourse.thumbnail}
                  alt={previewCourse.title}
                  className="w-full h-48 object-cover rounded-lg mb-4"
                />
              )}
              <div className="flex items-center space-x-4 mb-4">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(previewCourse.status)}`}>
                  {previewCourse.status}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getLevelColor(previewCourse.level)}`}>
                  {previewCourse.level}
                </span>
                <span className="text-sm text-gray-600">{previewCourse.category}</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{previewCourse.title}</h1>
              <p className="text-gray-700 mb-4">{previewCourse.description}</p>
              <div className="flex items-center space-x-6 text-sm text-gray-600">
                <div className="flex items-center space-x-1">
                  <Users className="w-4 h-4" />
                  <span>{previewCourse.students} Students</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Clock className="w-4 h-4" />
                  <span>{previewCourse.duration || 'Self-paced'}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <BookOpen className="w-4 h-4" />
                  <span>{previewCourse.modules.length} Modules</span>
                </div>
              </div>
            </div>

            {/* Course Content */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Course Content</h2>

              {previewCourse.modules.length === 0 ? (
                <p className="text-gray-500 italic">No modules created yet.</p>
              ) : (
                previewCourse.modules.map((module, moduleIndex) => (
                  <div key={module.id} className="border border-gray-200 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">
                      Module {moduleIndex + 1}: {module.title}
                    </h3>

                    {/* Module Lessons */}
                    {module.lessons.length === 0 ? (
                      <p className="text-gray-500 text-sm italic ml-4">No lessons in this module.</p>
                    ) : (
                      <div className="space-y-3 ml-4">
                        {module.lessons.map((lesson, lessonIndex) => (
                          <div key={lesson.id} className="border-l-2 border-blue-200 pl-4">
                            <h4 className="font-medium text-gray-800 mb-2">
                              Lesson {lessonIndex + 1}: {lesson.title}
                            </h4>

                            {/* Lesson Content Blocks */}
                            {lesson.contentBlocks.length === 0 ? (
                              <p className="text-gray-500 text-sm italic">No content blocks in this lesson.</p>
                            ) : (
                              <div className="space-y-2">
                                {lesson.contentBlocks.map((block, blockIndex) => (
                                  <div key={block.id} className="bg-gray-50 p-3 rounded text-sm">
                                    <div className="flex items-center space-x-2 mb-2">
                                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                                        {block.type.toUpperCase()}
                                      </span>
                                      <span className="text-gray-600">Block {blockIndex + 1}</span>
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
                                              console.error('Preview image failed to load:', block.url);
                                            }}
                                          />
                                        ) : (
                                          <video
                                            src={block.url}
                                            controls
                                            className="max-w-full h-48 rounded mx-auto block"
                                            onError={() => {
                                              console.error('Preview video failed to load:', block.url);
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
                      <div className="mt-4 ml-4 border-t border-gray-200 pt-3">
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

            {/* Close Button */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Courses;
