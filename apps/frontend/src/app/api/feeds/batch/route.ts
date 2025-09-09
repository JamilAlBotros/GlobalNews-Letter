import { NextRequest, NextResponse } from 'next/server';

const BASE_API = process.env.BASE_API || 'http://localhost:3333';

// POST /api/feeds/batch - Batch create RSS feeds
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('Proxying feeds batch request to:', `${BASE_API}/feeds/batch`);
    
    const response = await fetch(`${BASE_API}/feeds/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error('Backend feeds batch response not ok:', response.status, response.statusText);
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      return NextResponse.json(
        { error: 'Failed to batch create feeds', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Feeds batch API error:', error);
    return NextResponse.json(
      { error: 'Feeds batch service unavailable' },
      { status: 503 }
    );
  }
}