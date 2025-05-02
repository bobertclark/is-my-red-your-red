import { onDocumentCreated, FirestoreEvent } from "firebase-functions/v2/firestore"; // Import FirestoreEvent type
import { doc, collection, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../src/config/firebase-config'; // Adjust the path to your Firebase config file

// Trigger when a document is created in the userResults subcollection
exports.updateHueBucket = onDocumentCreated("/results/{userId}/userResults/{docId}", async (event: FirestoreEvent<any>) => {
    try {
        // Grab the newly created document's data
        const newDocData = event.data.data();
        const hue = newDocData.hue; // Assuming the document contains a 'hue' field

        if (typeof hue !== 'number') {
            console.error('Invalid hue value:', hue);
            return;
        }

        // Reference the bucket-counts collection
        const bucketRef = collection(db, 'bucket-counts');
        const bucketDocRef = doc(bucketRef, hue.toString());
        const bucketDoc = await getDoc(bucketDocRef);

        if (bucketDoc.exists()) {
            // Increment the count if the bucket already exists
            await updateDoc(bucketDocRef, {
                count: bucketDoc.data().count + 1,
            });
        } else {
            // Create a new bucket with an initial count of 1
            await setDoc(bucketDocRef, {
                count: 1,
            });
        }

        console.log(`Bucket for hue ${hue} updated successfully.`);
    } catch (error) {
        console.error('Error updating hue bucket:', error);
    }
});