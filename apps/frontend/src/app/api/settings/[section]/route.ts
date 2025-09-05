import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { section: string } }
) {
  try {
    const backendUrl = new URL(`/settings/${params.section}`, process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3333');

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

export async function PUT(
  request: NextRequest,
  { params }: { params: { section: string } }
) {
  try {
    const body = await request.json();
    const backendUrl = new URL(`/settings/${params.section}`, process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3333');

    const response = await fetch(backendUrl.toString(), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
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