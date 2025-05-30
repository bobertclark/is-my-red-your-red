import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../config/firebase-config.ts';
import { collection, serverTimestamp, doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { useAuthState } from '../../hooks/useAuthState.ts';
import { saveToSubcollection } from '../../utils/index.ts';
import { getAuth, signOut } from 'firebase/auth';

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
      document.body.style.backgroundColor = '#000'; // Set to black during static
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
          // Allow saving even if user is not authenticated
          const data = {
            threshold_hue: boundaryT,
            timestamp: serverTimestamp(),
            user_id: user?.uid ?? null,
          };

          const docRef = await saveToSubcollection(user?.uid ?? "anonymous", data);
          if (!docRef) {
            console.error('Failed to save document to subcollection.');
            return;
          }
          // Instead of passing docId, pass the results data directly
          navigate('/results', { state: { ...data } });
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
          // Allow saving even if user is not authenticated
          const data = {
            threshold_hue: boundaryT,
            timestamp: serverTimestamp(),
            user_id: user?.uid ?? null,
          };

          const docRef = await saveToSubcollection(user?.uid ?? "null", data);
          if (!docRef) {
            console.error('Failed to save document to subcollection.');
            return;
          }
          // Instead of passing docId, pass the results data directly
          navigate('/results', { state: { ...data, docId: docRef.id } });
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

  useEffect(() => {
    if (!showTransition) return;
    const canvas = document.getElementById('static-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    // Set canvas size to fill the window
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imageData = ctx.createImageData(canvas.width, canvas.height);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const shade = Math.random() > 0.5 ? 255 : 0;
      imageData.data[i] = shade;     // R
      imageData.data[i + 1] = shade; // G
      imageData.data[i + 2] = shade; // B
      imageData.data[i + 3] = 255;   // A
    }
    ctx.putImageData(imageData, 0, 0);
  }, [showTransition]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-2 sm:px-0">
      {showTransition ? (
        <canvas
          id="static-canvas"
          style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 50 }}
        ></canvas>
      ) : (
        <>
          <div className="absolute top-2 right-2 sm:top-4 sm:right-4 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 z-10">
            {!user?.uid ? (
              <button
                onClick={() => navigate('/auth')}
                className="btn btn-primary text-base sm:text-lg px-4 py-2"
              >
                Sign In / Register
              </button>
            ) : (
              <button
                onClick={async () => {
                  const auth = getAuth();
                  await signOut(auth);
                  navigate('/auth');
                }}
                className="btn btn-danger text-base sm:text-lg px-4 py-2"
              >
                Sign Out
              </button>
            )}
            <button
              onClick={() => navigate('/user-results')}
              className="btn btn-success text-base sm:text-lg px-4 py-2"
            >
              My Results
            </button>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 text-center mt-20 sm:mt-0 mb-4">
            Is this color Red or Orange?
          </h2>
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 w-full max-w-xs sm:max-w-none justify-center items-center mb-4">
            <button
              onClick={() => handleSelection('red')}
              className="btn btn-light btn-lg border border-gray-400 text-gray-800 w-full sm:w-auto py-3"
            >
              Red
            </button>
            <button
              onClick={() => handleSelection('orange')}
              className="btn btn-light btn-lg border border-gray-400 text-gray-800 w-full sm:w-auto py-3"
            >
              Orange
            </button>
          </div>
          <p className="text-gray-600 text-base sm:text-lg mb-2">Selection {trial + 1} of 10</p>
          <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4">
            {/* <p className="text-gray-600">Hue: {(currentT * 30).toFixed(1)}°</p> */}
          </div>
        </>
      )}
    </div>
  );
};

export default Tests;