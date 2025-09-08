import { NextRequest, NextResponse } from 'next/server';

const BASE_API = process.env.BASE_API || 'http://localhost:3333';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const { id } = params;
    
    console.log('Proxying article summarization request to:', `${BASE_API}/api/articles/${id}/summarize`);
    
    const response = await fetch(`${BASE_API}/api/articles/${id}/summarize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error('Backend article summarization response not ok:', response.status, response.statusText);
      const errorText = await response.text();
      return NextResponse.json(
        { error: 'Article summarization failed', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Article summarization API error:', error);
    return NextResponse.json(
      { error: 'Article summarization service unavailable' },
      { status: 503 }
    );
  }
}