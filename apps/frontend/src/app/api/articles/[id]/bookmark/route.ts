import { NextRequest, NextResponse } from 'next/server';

const BASE_API = process.env.BASE_API || 'http://localhost:3333';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const { id } = params;
    
    console.log('Proxying article bookmark request to:', `${BASE_API}/api/articles/${id}/bookmark`);
    
    const response = await fetch(`${BASE_API}/api/articles/${id}/bookmark`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error('Backend article bookmark response not ok:', response.status, response.statusText);
      const errorText = await response.text();
      return NextResponse.json(
        { error: 'Article bookmark operation failed', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Article bookmark API error:', error);
    return NextResponse.json(
      { error: 'Article bookmark service unavailable' },
      { status: 503 }
    );
  }
}