import { NextRequest, NextResponse } from 'next/server';

const BASE_API = process.env.BASE_API || 'http://localhost:3333';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const { id } = params;
    
    console.log('Proxying article translation request to:', `${BASE_API}/articles/${id}/translate`);
    
    const response = await fetch(`${BASE_API}/articles/${id}/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error('Backend article translation response not ok:', response.status, response.statusText);
      const errorText = await response.text();
      return NextResponse.json(
        { error: 'Article translation failed', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Article translation API error:', error);
    return NextResponse.json(
      { error: 'Article translation service unavailable' },
      { status: 503 }
    );
  }
}