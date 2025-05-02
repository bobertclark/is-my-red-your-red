import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { db } from '../../config/firebase-config.ts';
import { doc, collection, getDocs, getDoc } from 'firebase/firestore';
import { useAuthState } from '../../hooks/useAuthState.ts';

export const Results: React.FC = () => {
  const { user } = useAuthState(); // Get the authenticated user
  const location = useLocation();
  const state = location.state as { boundaryT: number, docId: string, userId: string } | null;
  const [boundaryT, setBoundaryT] = useState<number>(state?.boundaryT ?? 0.5); // Default to midpoint if no data
  const [percentileData, setPercentileData] = useState<number[]>([]); // Array to store percentile data
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Draw gradient
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, 'hsl(0, 100%, 50%)');
    gradient.addColorStop(1, 'hsl(30, 100%, 50%)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Draw boundary line
    const boundaryX = boundaryT * width;
    ctx.beginPath();
    ctx.setLineDash([5, 5]);
    ctx.moveTo(boundaryX, 0);
    ctx.lineTo(boundaryX, height);
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw labels
    ctx.font = '14px Arial';
    ctx.fillStyle = 'black';
    ctx.textAlign = 'center';
    // Remove horizontal labels
    // ctx.fillText('Your Red', boundaryX / 2, height / 2);
    // ctx.fillText('Your Orange', boundaryX + (width - boundaryX) / 2, height / 2);

    // Draw fixed axis labels
    ctx.save();
    ctx.font = '14px Arial';
    ctx.fillStyle = 'black';
    ctx.textAlign = 'center';

    // Left label
    ctx.translate(10, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Your Red', 0, 0);
    ctx.restore();

    // Right label
    ctx.save();
    ctx.translate(width - 10, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Your Orange', 0, 0);
    ctx.restore();

    // Draw stair-step percentile graph
    if (percentileData.length > 0) {
      ctx.beginPath();
      ctx.strokeStyle = 'black'; // Change color to black
      ctx.lineWidth = 0.5; // Make the line even thinner
      let previousX = 0;
      let previousY = height;

      percentileData.forEach((percentile, index) => {
        const x = (index / (percentileData.length - 1)) * width;
        const y = height - percentile * height;

        // Draw horizontal line
        ctx.moveTo(previousX, previousY);
        ctx.lineTo(x, previousY);

        // Draw vertical line
        ctx.lineTo(x, y);

        previousX = x;
        previousY = y;
      });

      ctx.stroke();
    }
  }, [boundaryT, percentileData]);

  useEffect(() => {
    const fetchResultsAndPercentileData = async () => {
      if (!state?.docId) {
        console.error('No docId found in state:', state);
        return;
      }
      console.log('Fetching results for docId:', state.docId);

      // Use userId from state or fallback to authenticated user's ID
      const userId = state?.userId || user?.uid;
      if (!userId) {
        console.error('No userId found to construct Firestore path.');
        return;
      }

      const parentDocRef = doc(db, 'results', userId);
      const subcollectionRef = collection(parentDocRef, 'userResults');
      const specificDocRef = doc(subcollectionRef, state.docId);

      try {
        const specificDocSnapshot = await getDoc(specificDocRef);
        if (specificDocSnapshot.exists()) {
          const data = specificDocSnapshot.data();
          console.log('Fetched data from Firestore:', data);
          if (data.threshold_hue !== undefined) {
            setBoundaryT(data.threshold_hue / 30); // Update boundaryT with fetched data in normalized form
          } else {
            console.error('threshold_hue field is missing in the fetched data:', data);
          }
        } else {
          console.error('No document found for the given docId in subcollection!');
        }
      } catch (error) {
        console.error('Error fetching document from Firestore:', error);
        return;
      }

      try {
        const bucketRef = collection(db, 'bucket-counts');
        const bucketDocs = await getDocs(bucketRef);

        console.log('Fetched bucketDocs:', bucketDocs.docs.map(doc => ({ id: doc.id, data: doc.data() })));

        const bucketData: number[] = [];
        bucketDocs.forEach((doc) => {
          const bucketIndex = parseInt(doc.id, 10);
          const count = doc.data().count || 0;
          bucketData[bucketIndex] = count;
        });

        console.log('Populated bucketData array:', bucketData);

        // Include the user's most recent test result in the bucket data
        if (state?.boundaryT !== undefined) {
          const userBucketIndex = Math.round(state.boundaryT * (bucketData.length - 1));
          bucketData[userBucketIndex] = (bucketData[userBucketIndex] || 0) + 1;
        }

        // Normalize the data to percentile values
        const total = bucketData.reduce((sum, count) => sum + count, 0);
        console.log('Total count of all buckets:', total);

        const cumulativePercentiles: number[] = [];
        let cumulativeSum = 0;

        for (let i = 0; i < bucketData.length; i++) {
          cumulativeSum += bucketData[i] || 0; // Handle missing bucket indices
          cumulativePercentiles[i] = cumulativeSum / total;
        }

        console.log('Calculated cumulativePercentiles:', cumulativePercentiles);

        // Update percentileData after including the user's result
        setPercentileData(cumulativePercentiles);
      } catch (error) {
        console.error('Error fetching bucket-counts data:', error);
      }
    };

    fetchResultsAndPercentileData();
  }, [state, state?.docId, user]);

  const handleRetakeTest = (): void => {
    navigate('/tests');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
      <div className="absolute top-4 right-4">
        <button
          onClick={() => navigate('/auth')}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition"
        >
          Sign In / Register
        </button>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-lg flex flex-col items-center space-y-4">
        <h2 className="text-xl font-bold text-gray-800">Your Red-Orange Boundary</h2>
        <p className="text-gray-600">
          The black dotted line shows your approximate boundary between red and orange.
        </p>
        <canvas
          ref={canvasRef}
          width={300}
          height={300}
          className="border border-gray-300"
        />
        <p className="text-gray-600">
          Boundary at hue: {(boundaryT * 30).toFixed(1)}°
        </p>
        <p className="text-gray-600">
          {percentileData.length > 0 && percentileData[Math.round(boundaryT * (percentileData.length - 1))] !== undefined
            ? `${(100 - (percentileData[Math.round(boundaryT * (percentileData.length - 1))] * 100)).toFixed(1)}% of people are more red than you.`
            : 'Data unavailable to calculate percentile.'}
        </p>
        <p className="text-gray-600">
          Hues to the left of the line are what you call "red," and hues to the right are what you call "orange."
        </p>
        <button
          onClick={handleRetakeTest}
          className="px-6 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition"
        >
          Take Test Again
        </button>
      </div>
    </div>
  );
};

export default Results;