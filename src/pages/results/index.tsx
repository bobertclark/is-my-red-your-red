import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { db } from '../../config/firebase-config.ts';
import { collection, getDocs } from 'firebase/firestore';
import { useAuthState } from '../../hooks/useAuthState.ts';
import { getAuth, signOut } from 'firebase/auth';

export const Results: React.FC = () => {
  const { user } = useAuthState(); // Get the authenticated user
  const location = useLocation();
  // Now expecting state to have threshold_hue, user_id, and timestamp
  const state = location.state as { threshold_hue: number, user_id: string, timestamp: number } | null;
  // boundaryT is normalized threshold_hue (threshold_hue/30)
  const [boundaryT, setBoundaryT] = useState<number>(state?.threshold_hue !== undefined ? state.threshold_hue / 30 : 0.5); // Default to midpoint if no data
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
    const fetchPercentileData = async () => {
      if (state?.threshold_hue === undefined) {
        console.error('No threshold_hue value found in state:', state);
        return;
      }
      try {
        const bucketRef = collection(db, 'bucket-counts');
        const bucketDocs = await getDocs(bucketRef);

        const bucketData: number[] = [];
        bucketDocs.forEach((doc) => {
          const bucketIndex = parseInt(doc.id, 10);
          const count = doc.data().count || 0;
          bucketData[bucketIndex] = count;
        });

        // Include the user's most recent test result in the bucket data
        if (state?.threshold_hue !== undefined) {
          const userBucketIndex = Math.round((state.threshold_hue / 30) * (bucketData.length - 1));
          bucketData[userBucketIndex] = (bucketData[userBucketIndex] || 0) + 1;
        }

        // Normalize the data to percentile values
        const total = bucketData.reduce((sum, count) => sum + count, 0);
        const cumulativePercentiles: number[] = [];
        let cumulativeSum = 0;

        for (let i = 0; i < bucketData.length; i++) {
          cumulativeSum += bucketData[i] || 0; // Handle missing bucket indices
          cumulativePercentiles[i] = cumulativeSum / total;
        }

        setPercentileData(cumulativePercentiles);
      } catch (error) {
        console.error('Error fetching bucket-counts data:', error);
      }
    };
    fetchPercentileData();
  }, [state, user]);

  const handleRetakeTest = (): void => {
    navigate('/tests');
  };

  return (
    <div className="min-h-screen flex flex-col sm:flex-row items-center justify-center bg-gray-100 px-2 sm:px-0">
      <div className="flex-1 flex flex-col justify-center items-center w-full">
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
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-lg flex flex-col items-center space-y-3 sm:space-y-4 w-full max-w-xs sm:max-w-md my-8 sm:my-0">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 text-center">Your Red-Orange Boundary</h2>
          <p className="text-gray-600 text-base sm:text-lg text-center">
            The black dotted line shows your approximate boundary between red and orange.
          </p>
          <canvas
            ref={canvasRef}
            width={240}
            height={240}
            className="border border-gray-300 w-full h-auto max-w-[240px] sm:max-w-[300px] sm:w-[300px] sm:h-[300px]"
          />
          <p className="text-gray-600 text-base sm:text-lg text-center">
            Boundary at hue: {(boundaryT * 30).toFixed(1)}°
          </p>
          <p className="text-gray-600 text-base sm:text-lg text-center">
            {percentileData.length > 0 && percentileData[Math.round(boundaryT * (percentileData.length - 1))] !== undefined
              ? `${(100 - (percentileData[Math.round(boundaryT * (percentileData.length - 1))] * 100)).toFixed(1)}% of people are more red than you.`
              : 'Data unavailable to calculate percentile.'}
          </p>
          <p className="text-gray-600 text-base sm:text-lg text-center">
            Hues to the left of the line are what you call "red," and hues to the right are what you call "orange."
          </p>
          <button
            onClick={handleRetakeTest}
            className="btn btn-primary mt-2 sm:mt-3 w-full sm:w-auto"
          >
            Take Test Again
          </button>
        </div>
      </div>
    </div>
  );
};

export default Results;