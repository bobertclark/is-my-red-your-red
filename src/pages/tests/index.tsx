import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../config/firebase-config.ts';
import { collection, serverTimestamp, doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { useAuthState } from '../../hooks/useAuthState.ts';
import { saveToSubcollection } from '../../utils/index.ts';

interface Response {
  t: number;
  choice: 'red' | 'orange';
}

export const Tests: React.FC = () => {
  const [tMin, setTMin] = useState<number>(0); // Lower bound for color parameter
  const [tMax, setTMax] = useState<number>(1); // Upper bound for color parameter
  const [currentT, setCurrentT] = useState<number>(0.5); // Current color parameter
  const [trial, setTrial] = useState<number>(0); // Current trial number
  const [responses, setResponses] = useState<Response[]>([]); // Store user responses
  const [showTransition, setShowTransition] = useState(false); // State to control transition screen
  const navigate = useNavigate();
  const { user } = useAuthState(); // Move useAuthState hook here

  useEffect(() => {
    if (showTransition) {
      const randomColor = `rgb(${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)})`;
      document.body.style.backgroundColor = randomColor;
    } else {
      const color = `hsl(${currentT * 30}, 100%, 50%)`; // Hue from 0° (red) to 30° (orange)
      document.body.style.backgroundColor = color;
    }

    return () => {
      document.body.style.backgroundColor = ''; // Reset background color
    };
  }, [currentT, showTransition]);

  useEffect(() => {
    if (trial === 10) { // Ensure navigation happens exactly at trial 10
      const redResponses = responses.filter(r => r.choice === 'red');
      const orangeResponses = responses.filter(r => r.choice === 'orange');
      const avgRedT = redResponses.length > 0 
        ? redResponses.reduce((sum, r) => sum + r.t, 0) / redResponses.length 
        : 0;
      const avgOrangeT = orangeResponses.length > 0 
        ? orangeResponses.reduce((sum, r) => sum + r.t, 0) / orangeResponses.length 
        : 1;
      const boundaryT = parseFloat((((avgRedT + avgOrangeT) / 2) * 30).toFixed(1));

      const saveResults = async () => {
        try {
          if (!user?.uid) {
            console.error('User is not authenticated');
            return;
          }

          const data = {
            threshold_hue: boundaryT,
            timestamp: serverTimestamp(),
            user_id: user.uid,
          };

          const docRef = await saveToSubcollection(user.uid, data);
          if (!docRef) {
            console.error('Failed to save document to subcollection.');
            return;
          }
          const savedDocId = docRef.id; // Retrieve the actual document ID

          navigate('/results', { state: { docId: savedDocId } }); // Pass the actual document ID
        } catch (error) {
          console.error('Error saving results:', error);
        }
      };

      saveResults();
    }
  }, [trial, responses, navigate, user]);

  useEffect(() => {
    // Set the initial trial to an extreme value (either red or orange)
    setCurrentT(Math.random() < 0.5 ? tMin : tMax);
  }, [tMin, tMax]);

  const handleSelection = (choice: 'red' | 'orange'): void => {
    if (trial >= 10) return; // Prevent further updates after 10 trials

    const t = currentT;
    setResponses(prev => [...prev, { t, choice }]);

    if (trial === 9) { // Handle navigation on the 10th trial
      const redResponses = [...responses, { t, choice }].filter(r => r.choice === 'red');
      const orangeResponses = [...responses, { t, choice }].filter(r => r.choice === 'orange');
      const avgRedT = redResponses.length > 0 
        ? redResponses.reduce((sum, r) => sum + r.t, 0) / redResponses.length 
        : 0;
      const avgOrangeT = orangeResponses.length > 0 
        ? orangeResponses.reduce((sum, r) => sum + r.t, 0) / orangeResponses.length 
        : 1;
      const boundaryT = parseFloat((((avgRedT + avgOrangeT) / 2) * 30).toFixed(1));

      const saveResults = async () => {
        try {
          if (!user?.uid) {
            console.error('User is not authenticated');
            return;
          }

          const data = {
            threshold_hue: boundaryT,
            timestamp: serverTimestamp(),
            user_id: user.uid,
          };

          const docRef = await saveToSubcollection(user.uid, data);
          if (!docRef) {
            console.error('Failed to save document to subcollection.');
            return;
          }
          const savedDocId = docRef.id; // Retrieve the actual document ID

          const updateBucket = async (hue: number) => {
            try {
              const bucketRef = collection(db, 'bucket-counts'); // Updated collection name
              const bucketDocRef = doc(bucketRef, hue.toString());
              const bucketDoc = await getDoc(bucketDocRef);

              if (bucketDoc.exists()) {
                await updateDoc(bucketDocRef, {
                  count: bucketDoc.data().count + 1,
                });
              } else {
                await setDoc(bucketDocRef, {
                  count: 1,
                });
              }
            } catch (error) {
              console.error('Error updating bucket:', error);
            }
          };

          await updateBucket(boundaryT);

          navigate('/results', { state: { docId: savedDocId } }); // Pass the actual document ID
        } catch (error) {
          console.error('Error saving results:', error);
        }
      };

      saveResults();
      return; // Exit early to prevent further updates
    }

    setShowTransition(true); // Show transition screen
    setTimeout(() => {
      let newTMin = tMin;
      let newTMax = tMax;

      if (choice === 'red') {
        newTMin = t; // Adjust lower bound toward orange
      } else {
        newTMax = t; // Adjust upper bound toward red
      }

      // Calculate the new midpoint for the next test
      const newT = (newTMin + newTMax) / 2;

      setTMin(newTMin);
      setTMax(newTMax);
      setCurrentT(newT);
      setTrial(prev => prev + 1);
      setShowTransition(false); // Hide transition screen
    }, 500); // Show random color for 0.5 seconds
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      {showTransition ? (
        <div
          className="absolute inset-0"
          style={{ backgroundColor: `rgb(${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)})` }}
        ></div>
      ) : (
        <>
          <div className="absolute top-4 right-4">
            <button
              onClick={() => navigate('/auth')}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition"
            >
              Sign In / Register
            </button>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-lg flex flex-col items-center space-y-4">
            <h2 className="text-xl font-bold text-gray-800">Is this color Red or Orange?</h2>
            <div className="flex space-x-4">
              <button
                onClick={() => handleSelection('red')}
                className="px-6 py-3 bg-red-500 text-white rounded-md hover:bg-red-600 transition"
              >
                Red
              </button>
              <button
                onClick={() => handleSelection('orange')}
                className="px-6 py-3 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition"
              >
                Orange
              </button>
            </div>
            <p className="text-gray-600">Selection {trial + 1} of 10</p>
          </div>
          <div className="absolute bottom-4 right-4">
            <p className="text-gray-600">Hue: {(currentT * 30).toFixed(1)}°</p>
          </div>
        </>
      )}
    </div>
  );
};

export default Tests;