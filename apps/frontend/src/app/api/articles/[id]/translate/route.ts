import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://api:3333';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    console.log(`Translating article ${id} via ${API_BASE_URL}/articles/${id}/translate`);
    
    const response = await fetch(`${API_BASE_URL}/articles/${id}/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    console.log(`Translation response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Translation API error: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { 
          error: `Translation API error: ${response.status}`,
          details: errorText,
          apiUrl: `${API_BASE_URL}/articles/${id}/translate`
        }, 
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('Translation successful');
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error translating article:', error);
    console.error('API_BASE_URL:', API_BASE_URL);
    console.error('Full error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { 
        error: 'Failed to translate article', 
        details: error instanceof Error ? error.message : 'Unknown error',
        apiUrl: API_BASE_URL
      },
      { status: 500 }
    );
  }
}