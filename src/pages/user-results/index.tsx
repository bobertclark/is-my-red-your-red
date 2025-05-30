import React, { useEffect, useState, useCallback } from 'react';
import { db } from '../../config/firebase-config.ts';
import { useAuthState } from '../../hooks/useAuthState.ts';
import { collection, doc, getDocs, query, orderBy } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

interface UserResult {
  id: string;
  threshold_hue: number;
  timestamp: { seconds: number; nanoseconds: number };
  user_id: string;
}

export const UserResults: React.FC = () => {
  const { user, loading } = useAuthState();
  const [results, setResults] = useState<UserResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchUserResults = useCallback(async () => {
    if (!user) return;
    try {
      const parentDocRef = doc(db, 'results', user.uid);
      const userResultsRef = collection(parentDocRef, 'userResults');
      const q = query(userResultsRef, orderBy('timestamp', 'desc'));
      const querySnapshot = await getDocs(q);
      const userResults: UserResult[] = querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<UserResult, 'id'>),
      }));
      setResults(userResults);
    } catch (err) {
      setError('Failed to fetch results.');
    }
  }, [user]);

  useEffect(() => {
    if (!user && !loading) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user || loading) return;
    fetchUserResults();
  }, [user, loading, fetchUserResults]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">Loading...</div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
      <div className="w-full flex justify-end px-6 pt-6">
        <button
          className="btn btn-success"
          onClick={() => navigate('/tests')}
        >
          Take Test Again
        </button>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-xl mt-4 flex flex-col items-center w-full">
        <h2 className="text-2xl font-bold mb-4 text-center">Your Past Test Results</h2>
        {error && <div className="text-red-500 mb-4">{error}</div>}
        {results.length === 0 ? (
          <div className="text-gray-600 text-center">No results found.</div>
        ) : (
          <div className="flex justify-center">
            <div className="overflow-x-auto flex justify-center">
              <table className="min-w-[350px] max-w-lg divide-y divide-gray-200 text-center mx-auto">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">Boundary Hue (°)</th>
                    <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">View</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {results.map(result => (
                    <tr key={result.id}>
                      <td className="px-4 py-2">
                        {result.timestamp &&
                          new Date(result.timestamp.seconds * 1000).toLocaleString()}
                      </td>
                      <td className="px-4 py-2">{result.threshold_hue}</td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => navigate('/results', { state: { ...result } })}
                          className="btn btn-primary btn-sm"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserResults;
