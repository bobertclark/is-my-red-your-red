import { collection, doc, addDoc } from 'firebase/firestore';
import { db } from '../config/firebase-config.ts';

export const saveToSubcollection = async (userId: string, data: any) => {
  try {
    // Reference the parent document
    const parentDocRef = doc(db, 'results', userId);

    // Reference the subcollection
    const subcollectionRef = collection(parentDocRef, 'userResults');

    // Add a document to the subcollection
    const docRef = await addDoc(subcollectionRef, data);

    console.log('Document written with ID:', docRef.id);
    return docRef; // Return the document reference
  } catch (error) {
    console.error('Error adding document:', error);
    return null; // Return null in case of an error
  }
};