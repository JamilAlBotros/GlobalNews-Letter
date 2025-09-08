import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.BASE_API || 'http://localhost:3333';

export async function GET(request: NextRequest) {
  try {
    console.log('Fetching dashboard stats from:', `${API_BASE_URL}/dashboard/stats`);
    
    const response = await fetch(`${API_BASE_URL}/dashboard/stats`, {
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Ensure fresh data for dashboard
    });

    if (!response.ok) {
      console.error('Backend dashboard stats response not ok:', response.status, response.statusText);
      return NextResponse.json(
        { error: 'Failed to fetch dashboard statistics' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Dashboard stats fetch error:', error);
    return NextResponse.json(
      { error: 'Backend connection failed' },
      { status: 503 }
    );
  }
}