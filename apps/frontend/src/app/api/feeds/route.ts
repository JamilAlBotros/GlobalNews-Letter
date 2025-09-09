import { NextRequest, NextResponse } from 'next/server';

const BASE_API = process.env.BASE_API || 'http://api:3333';

// GET /api/feeds - Get all feeds
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  try {
    const backendUrl = new URL('/feeds', BASE_API);
    searchParams.forEach((value, key) => {
      backendUrl.searchParams.append(key, value);
    });

    console.log('Proxying feeds GET request to:', backendUrl.toString());

    const response = await fetch(backendUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Backend feeds GET response not ok:', response.status, response.statusText);
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      return NextResponse.json(
        { error: 'Failed to fetch feeds', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Feeds GET API error:', error);
    return NextResponse.json(
      { error: 'Feeds service unavailable' },
      { status: 503 }
    );
  }
}

// POST /api/feeds - Create a new feed
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('Proxying feeds POST request to:', `${BASE_API}/feeds`);
    
    const response = await fetch(`${BASE_API}/feeds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error('Backend feeds POST response not ok:', response.status, response.statusText);
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      return NextResponse.json(
        { error: 'Failed to create feed', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Feeds POST API error:', error);
    return NextResponse.json(
      { error: 'Feeds service unavailable' },
      { status: 503 }
    );
  }
}