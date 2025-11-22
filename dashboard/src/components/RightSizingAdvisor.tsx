import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingDown, TrendingUp, CheckCircle, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
 
interface RightSizingAdvisorProps {
  serverId: string;
  isVisible: boolean; // New prop to control visibility
  onDismiss: () => void; // New callback for when the 'X' is clicked
}

type RecommendationType = "UPGRADE" | "DOWNGRADE" | "STABLE";

interface Recommendation {
  id: number;
  recommendation_type: RecommendationType;
  summary: string;
  created_at: string;
}
  
const fetchRecommendations = async (serverId: string, token: string): Promise<Recommendation[]> => {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/servers/${serverId}/recommendations`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch recommendations');
  }
  return response.json();
};

const recommendationStyles = {
  DOWNGRADE: {
    icon: <TrendingDown className="h-8 w-8 text-green-400" />,
    title: "Cost Savings Opportunity",
    bg: "bg-green-900/50 border-green-500/50",
  },
  UPGRADE: {
    icon: <TrendingUp className="h-8 w-8 text-yellow-400" />,
    title: "Performance Risk Detected",
    bg: "bg-yellow-900/50 border-yellow-500/50",
  },
  STABLE: {
    icon: <CheckCircle className="h-8 w-8 text-blue-400" />,
    title: "Server is Optimally Sized",
    bg: "bg-gray-800 border-gray-700",
  },
};

const RightSizingAdvisor: React.FC<RightSizingAdvisorProps> = ({ serverId, isVisible, onDismiss }) => {
  const { token } = useAuth(); 
 
  const { data, isLoading, error } = useQuery({
    queryKey: ['recommendations', serverId],
    // If useMockData is true, return a resolved promise with mock data. Otherwise, call the real API.
    queryFn: () => fetchRecommendations(serverId, token!),
    enabled: !!token,
    staleTime: 1000 * 60 * 60, // Recommendations are generated daily, so data is stale for 1 hour
  });

  const latestRecommendation = data?.[0];

  // --- UI LOGIC ---
  // Don't render anything if there's no actionable recommendation.
  if (isLoading || error || !latestRecommendation || latestRecommendation.recommendation_type === 'STABLE') {
    return null;
  }

  // Use the `isVisible` prop to control visibility with CSS.
  if (!isVisible) {
    return null; // Or return a placeholder if you prefer, but null is cleaner for this case.
  }

  const styles = recommendationStyles[latestRecommendation.recommendation_type];

  return (
    <div className={`relative p-6 rounded-lg border ${styles.bg} transition-all duration-300`}>
      <button
        onClick={onDismiss} // Use the callback prop
        className="absolute top-2 right-2 p-1 text-gray-500 hover:text-white rounded-full"
        aria-label="Dismiss recommendation"
      >
        <X size={18} />
      </button>
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0">{styles.icon}</div>
        <div>
          <h3 className="text-lg font-bold text-white">{styles.title}</h3>
          <p className="mt-1 text-gray-300">{latestRecommendation.summary}</p>
          <p className="mt-2 text-xs text-gray-500">
            Analysis based on 30-day performance. Last updated: {new Date(latestRecommendation.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default RightSizingAdvisor;