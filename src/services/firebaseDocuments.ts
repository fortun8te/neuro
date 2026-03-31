import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { auth } from './firebase';

/**
 * Firestore Document Storage Service
 * Handles cloud storage and sync of canvas documents
 */

export interface FirebaseDocument {
  id: string;
  userId: string;
  title: string;
  content: string;
  fileType: 'docx' | 'pdf' | 'md' | 'html' | 'txt' | 'code';
  tags: string[];
  createdAt: number;
  updatedAt: number;
  cloudVersion: number;
  isPublic: boolean;
}

const db = getFirestore();
const DOCUMENTS_COLLECTION = 'canvas_documents';

/**
 * Upload or update document in Firestore
 */
export async function uploadDocument(document: FirebaseDocument): Promise<void> {
  if (!auth?.currentUser) {
    throw new Error('User not authenticated');
  }

  const userId = auth.currentUser.uid;
  const docRef = doc(db, DOCUMENTS_COLLECTION, document.id);

  await setDoc(docRef, {
    ...document,
    userId,
    updatedAt: Timestamp.now(),
    cloudVersion: document.cloudVersion || 1,
  });
}

/**
 * Download document from Firestore
 */
export async function downloadDocument(docId: string): Promise<FirebaseDocument | null> {
  if (!auth?.currentUser) {
    throw new Error('User not authenticated');
  }

  const docRef = doc(db, DOCUMENTS_COLLECTION, docId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data() as any;
  return {
    ...data,
    createdAt: data.createdAt?.toMillis?.() || Date.now(),
    updatedAt: data.updatedAt?.toMillis?.() || Date.now(),
  };
}

/**
 * List all documents for current user
 */
export async function listUserDocuments(): Promise<FirebaseDocument[]> {
  if (!auth?.currentUser) {
    throw new Error('User not authenticated');
  }

  const userId = auth.currentUser.uid;
  const q = query(
    collection(db, DOCUMENTS_COLLECTION),
    where('userId', '==', userId),
    orderBy('updatedAt', 'desc'),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
    const data = doc.data() as any;
    return {
      ...data,
      id: doc.id,
      createdAt: data.createdAt?.toMillis?.() || Date.now(),
      updatedAt: data.updatedAt?.toMillis?.() || Date.now(),
    };
  });
}

/**
 * List documents by tag
 */
export async function listDocumentsByTag(tag: string): Promise<FirebaseDocument[]> {
  if (!auth?.currentUser) {
    throw new Error('User not authenticated');
  }

  const userId = auth.currentUser.uid;
  const q = query(
    collection(db, DOCUMENTS_COLLECTION),
    where('userId', '==', userId),
    where('tags', 'array-contains', tag),
    orderBy('updatedAt', 'desc'),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
    const data = doc.data() as any;
    return {
      ...data,
      id: doc.id,
      createdAt: data.createdAt?.toMillis?.() || Date.now(),
      updatedAt: data.updatedAt?.toMillis?.() || Date.now(),
    };
  });
}

/**
 * Delete document from Firestore (soft delete)
 */
export async function deleteDocument(docId: string): Promise<void> {
  if (!auth?.currentUser) {
    throw new Error('User not authenticated');
  }

  const docRef = doc(db, DOCUMENTS_COLLECTION, docId);
  await deleteDoc(docRef);
}

/**
 * Update document tags
 */
export async function updateDocumentTags(docId: string, tags: string[]): Promise<void> {
  if (!auth?.currentUser) {
    throw new Error('User not authenticated');
  }

  const docRef = doc(db, DOCUMENTS_COLLECTION, docId);
  await updateDoc(docRef, {
    tags,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Increment document cloud version
 */
export async function incrementCloudVersion(docId: string): Promise<number> {
  if (!auth?.currentUser) {
    throw new Error('User not authenticated');
  }

  const docRef = doc(db, DOCUMENTS_COLLECTION, docId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    throw new Error('Document not found');
  }

  const currentVersion = snapshot.data().cloudVersion || 1;
  const newVersion = currentVersion + 1;

  await updateDoc(docRef, {
    cloudVersion: newVersion,
    updatedAt: Timestamp.now(),
  });

  return newVersion;
}

/**
 * Get sync metadata (for conflict detection)
 */
export async function getDocumentMetadata(docId: string): Promise<{
  cloudVersion: number;
  updatedAt: number;
} | null> {
  const docRef = doc(db, DOCUMENTS_COLLECTION, docId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();
  return {
    cloudVersion: data.cloudVersion || 1,
    updatedAt: data.updatedAt?.toMillis?.() || Date.now(),
  };
}
