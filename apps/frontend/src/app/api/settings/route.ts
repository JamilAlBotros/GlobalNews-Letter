import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  try {
    const backendUrl = new URL('/settings', process.env.BASE_API || 'http://localhost:3333');
    searchParams.forEach((value, key) => {
      backendUrl.searchParams.append(key, value);
    });

    const response = await fetch(backendUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(data);
    } else {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      return NextResponse.json(
        { error: 'Backend request failed', details: errorData },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error('Backend connection failed:', error);
    return NextResponse.json(
      { error: 'Backend service unavailable', message: 'Unable to connect to the API service' },
      { status: 503 }
    );
  }
}