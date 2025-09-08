import { NextRequest, NextResponse } from 'next/server';

const BASE_API = process.env.BASE_API || 'http://localhost:3333';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('Proxying batch translation request to:', `${BASE_API}/llm/translate/batch`);
    
    const response = await fetch(`${BASE_API}/llm/translate/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error('Backend batch translation response not ok:', response.status, response.statusText);
      const errorText = await response.text();
      return NextResponse.json(
        { error: 'Batch translation failed', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Batch translation API error:', error);
    return NextResponse.json(
      { error: 'Batch translation service unavailable' },
      { status: 503 }
    );
  }
}