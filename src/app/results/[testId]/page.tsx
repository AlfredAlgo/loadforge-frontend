"use client"; // This component is a client component

import { TestResults } from "~/components/test-results";
import { DashboardNav } from "~/components/dashboard-nav";
import { api } from "~/trpc/react";
import { useParams } from 'next/navigation';

// import { useRouter } from 'next/navigation'; // Only import if you need programmatic navigation (e.g., router.push)

interface ResultsPageProps {
  params: {
    testId: string;
  };
}

export default function ResultsPage( ) {
  const params = useParams();
  const testId = params.testId as string;
   


  // Conditional rendering for when testId is not present in the URL
  if (!testId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl text-red-600">Error: Test ID is missing in the URL. Please navigate from the dashboard or provide a valid ID.</p>
      </div>
    );
  }

  // Fetch results for the specific testId using your tRPC client
  // The 'enabled' option prevents the query from running if testId is falsy
  const { data, isLoading, isError } = api.loadTest.getResults.useQuery(
    { testId },
    {
      enabled: !!testId, // CRITICAL: This ensures the query only runs when testId is a truthy value (not undefined/null/empty string)
      // refetchOnWindowFocus: false, // Optional: useful if you don't want it to refetch when the window regains focus
    }
  );


  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl text-gray-700">Loading test results...</p>
      </div>
    );
  }

  if (isError) {
    // data.error will contain the TRPCClientError object if there was an API error
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl text-red-600">Error loading results. Please check the Test ID and try again. (Details: {data?.testId})</p>
      </div>
    );
  }

  // This condition should ideally not be hit if enabled:!!testId is working correctly
  // and there's no error, but it's a good defensive check.
  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl text-gray-700">No results found for this test ID after loading.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <DashboardNav />
      <TestResults results={data} />
    </div>
  );
}