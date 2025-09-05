import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3333';

export async function GET(request: NextRequest) {
  try {
    console.log('Fetching polling status from:', `${API_BASE_URL}/dashboard/polling-status`);
    
    const response = await fetch(`${API_BASE_URL}/dashboard/polling-status`, {
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Ensure fresh data for polling status
    });

    if (!response.ok) {
      console.error('Backend polling status response not ok:', response.status, response.statusText);
      return NextResponse.json(
        { error: 'Failed to fetch polling status' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Polling status fetch error:', error);
    return NextResponse.json(
      { error: 'Backend connection failed' },
      { status: 503 }
    );
  }
}